/* Prepare observed telemetry with the same features as browser inference. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const F = require('../ml-features.js');
const HORIZON = 60;
const REQUIRED = ['episode_id', 'timestamp', 'buffer', 'demand_per_hour',
  'supply_per_hour', 'stopped', 'stop_reason', 'intervention'];

function csvRecords(text) {
  const records = [];
  let row = [], value = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else value += c;
    } else if (c === '"') {
      if (value || closed) throw new Error('Кавычки внутри неэкранированного CSV-поля.');
      quoted = true;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(value); value = ''; closed = false;
      if (c !== ',') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        if (row.some(field => field !== '')) records.push(row);
        row = [];
      }
    } else {
      if (closed) throw new Error('После закрывающей кавычки ожидается разделитель.');
      value += c;
    }
  }
  if (quoted) throw new Error('Незакрытые кавычки в CSV.');
  if (value || row.length || closed) { row.push(value); records.push(row); }
  return records;
}

function utcMinute(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))
    throw new Error('Время должно быть в UTC: YYYY-MM-DDTHH:mm:ssZ.');
  const milliseconds = Date.parse(value);
  const normalized = value.includes('.') ? value : value.replace('Z', '.000Z');
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== normalized)
    throw new Error('Некорректная календарная дата: ' + value);
  return milliseconds / 60000;
}

function number(value, label) {
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value))
    throw new Error('Нужно неотрицательное число: ' + label);
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error('Нужно конечное число: ' + label);
  return result;
}

function encode(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

function main() {
  const options = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i], value = process.argv[i + 1];
    if (!['--input', '--output', '--train-end', '--validation-end', '--max-gap'].includes(key) ||
        !value || options[key]) throw new Error('Неизвестный, повторный или неполный параметр: ' + key);
    options[key] = value;
  }
  for (const key of ['--input', '--output', '--train-end', '--validation-end'])
    if (!options[key]) throw new Error('Требуется параметр ' + key + '. Формат — в ml/telemetry-format.md.');
  const trainEnd = utcMinute(options['--train-end']);
  const validationEnd = utcMinute(options['--validation-end']);
  const maxGap = number(options['--max-gap'] || '15', '--max-gap');
  if (trainEnd >= validationEnd || maxGap <= 0 || maxGap > HORIZON)
    throw new Error('Границы времени должны возрастать; max-gap должен быть >0 и ≤60 минут.');
  const input = path.resolve(options['--input']), output = path.resolve(options['--output']);
  const local = path.resolve(__dirname, 'local');
  if (!output.startsWith(local + path.sep))
    throw new Error('Сохраняйте внешние данные внутри ml/local/<имя>: эта папка исключена из Git и архива.');
  if (fs.existsSync(output) && fs.readdirSync(output).length)
    throw new Error('Папка результата уже содержит файлы. Выберите новую папку.');
  if (fs.statSync(input).size > 32 * 1024 * 1024) throw new Error('CSV превышает 32 МБ.');
  const bytes = fs.readFileSync(input);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  const records = csvRecords(text);
  const header = records.shift();
  if (!header || new Set(header).size !== header.length || REQUIRED.some(name => !header.includes(name)))
    throw new Error('Нужны уникальные заголовки: ' + REQUIRED.join(',') + '.');
  const groups = new Map(), seen = new Set();
  for (const [index, record] of records.entries()) {
    if (record.length !== header.length) throw new Error('Неверное число полей, запись ' + (index + 2));
    const row = Object.fromEntries(header.map((name, i) => [name, record[i].trim()]));
    if (!row.episode_id || /[\x00-\x1f]/.test(row.episode_id)) throw new Error('Нужен корректный episode_id.');
    row.minute = utcMinute(row.timestamp);
    const key = JSON.stringify([row.episode_id, row.minute]);
    if (seen.has(key)) throw new Error('Дублированное время в смене ' + row.episode_id);
    seen.add(key);
    for (const name of ['buffer', 'demand_per_hour', 'supply_per_hour']) row[name] = number(row[name], name);
    if (row.demand_per_hour <= 0) throw new Error('Расход должен быть положительным.');
    for (const name of ['stopped', 'intervention']) {
      if (!['0', '1'].includes(row[name])) throw new Error(name + ' должен быть 0 или 1.');
      row[name] = Number(row[name]);
    }
    if (row.stopped && !['buffer_exhaustion', 'equipment_failure', 'planned', 'other'].includes(row.stop_reason))
      throw new Error('Для остановки укажите известную причину в stop_reason.');
    if (!row.stopped && row.stop_reason) throw new Error('Для работающей линии stop_reason должен быть пустым.');
    if (row.stop_reason === 'buffer_exhaustion' && row.buffer > 0)
      throw new Error('Остановка из-за исчерпания требует нулевого буфера.');
    if (!groups.has(row.episode_id)) groups.set(row.episode_id, []);
    groups.get(row.episode_id).push(row);
  }
  const prepared = [], episodes = [], skipped = {};
  const omit = reason => { skipped[reason] = (skipped[reason] || 0) + 1; };
  for (const [id, sequence] of groups) {
    sequence.sort((a, b) => a.minute - b.minute);
    const start = sequence[0].minute, end = sequence.at(-1).minute;
    const split = end < trainEnd ? 'train' : start >= trainEnd && end < validationEnd ? 'validation' :
      start >= validationEnd ? 'holdout' : null;
    if (!split) { skipped.episode_crosses_boundary = (skipped.episode_crosses_boundary || 0) + 1; continue; }
    episodes.push({ id, split, start: sequence[0].timestamp, end: sequence.at(-1).timestamp });
    let history = [];
    for (let i = 0; i < sequence.length; i++) {
      const row = sequence[i];
      if (row.intervention || row.stopped || row.buffer <= 0 ||
          (i && row.minute - sequence[i - 1].minute > maxGap)) history = [];
      history.push({ minute: row.minute, buffer: row.buffer, intervention: Boolean(row.intervention) });
      history = history.slice(-8);
      if (row.stopped || row.buffer <= 0) { omit('already_stopped_or_empty'); continue; }
      const features = F.extract({ id: 'assembly', buffer: row.buffer,
        demandPerHour: row.demand_per_hour, replenishmentPerHour: row.supply_per_hour, history });
      if (!features.available) { omit('insufficient_history'); continue; }
      let j = i + 1, label = 0, blocked = false;
      while (j < sequence.length) {
        const future = sequence[j];
        if (future.minute - sequence[j - 1].minute > maxGap) blocked = true;
        if (future.minute <= row.minute + HORIZON) {
          if (future.intervention || (future.stopped && future.stop_reason !== 'buffer_exhaustion')) blocked = true;
          if (future.stopped && future.stop_reason === 'buffer_exhaustion') label = 1;
        }
        if (future.minute >= row.minute + HORIZON) break;
        j++;
      }
      if (j >= sequence.length) { omit('incomplete_future'); continue; }
      if (blocked) { omit('future_gap_intervention_or_other_stop'); continue; }
      prepared.push([id, row.minute, row.timestamp, 'observed', split, ...features.values, label]);
    }
  }
  if (!prepared.length) throw new Error('Нет пригодных наблюдений. Проверьте длину смен, разрывы и границы.');
  const schema = ['episode_id', 'minute', 'timestamp', 'regime', 'split', ...F.names, 'stop_within_60m'];
  const csv = schema.join(',') + '\n' + prepared.map(row => row.map(encode).join(',')).join('\n') + '\n';
  const manifest = { schemaVersion: 1, source: 'observed', sourceVerified: false,
    sourceSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    sha256: crypto.createHash('sha256').update(csv).digest('hex'),
    features: F.names, target: 'stop_within_60m', horizonMinutes: HORIZON,
    splitMethod: 'chronological_whole_episodes',
    trainEnd: options['--train-end'], validationEnd: options['--validation-end'],
    maxGapMinutes: maxGap, episodes: groups.size, eligibleEpisodes: new Set(prepared.map(row => row[0])).size,
    rows: prepared.length, positiveRows: prepared.filter(row => row.at(-1) === 1).length,
    splitEpisodes: episodes, excluded: skipped, featuresUseFuture: false, labelUsesFuture: true,
    assumptions: ['Input provenance and stop labels need confirmation by the data owner.',
      'Labels describe observed stops at sampling resolution, not hidden events between observations.',
      'Windows with operator interventions, other stop causes or long gaps are excluded.',
      'Whole episodes crossing either time boundary are excluded.'] };
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'training.csv'), csv);
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ output, rows: manifest.rows, episodes: manifest.eligibleEpisodes,
    positiveRows: manifest.positiveRows, excluded: skipped }, null, 2));
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
