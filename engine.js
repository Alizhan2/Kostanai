/* Browser + Node module. All initial production data is synthetic. */
(function (root, factory) {
  const api = factory();
  root.PlantEngine = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ZONES = {
    body: { name: 'Кузовной цех', line: 'Сварка кузова', equipment: 'Робот R-04 · Пресс P-12 · Конвейер K-03', capacity: 26 },
    paint: { name: 'Окрасочный участок', line: 'Окраска · линия 1', equipment: 'Камера C-01 · Печь O-02 · Фильтр F-08', capacity: 24 },
    assembly: { name: 'Сборочная линия', line: 'Финальная сборка', equipment: 'Пост A-01 · Тест-стенд T-04 · Конвейер S-02', capacity: 22 },
    logistics: { name: 'Логистика и склад', line: 'Подача комплектующих', equipment: 'Склад W-1 · AGV-3 · Буфер S-2', capacity: 28 }
  };
  const round = (n, places = 1) => Number(n.toFixed(places));
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const timeLabel = (minute, shift = 'day') => {
    const t = (minute + (shift === 'night' ? 1200 : 480)) % 1440;
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  };
  function createState(scenario = 'normal', shift = 'day') {
    const lines = Object.entries(ZONES).map(([id, z], i) => ({ id, ...z,
      throughput: z.capacity * [0.92, 0.86, 0.91, 0.92][i],
      produced: [47, 42, 39, 51][i], defects: [1, 1, 1, 0][i], downtimeMinutes: [3, 4, 2, 3][i],
      status: 'running', buffer: id === 'assembly' ? 30 : 0,
      demandPerHour: id === 'assembly' ? 20 : 0,
      replenishmentPerHour: id === 'assembly' ? 21 : 0,
      history: []
    }));
    const state = { schemaVersion: 1, elapsedMinutes: 120, shift, scenario, source: 'synthetic',
      lines, incidents: [], actions: [], nextId: 1, running: false };
    lines.forEach(line => {
      for (let minute = 0; minute <= 120; minute += 15) line.history.push({ minute,
        throughput: round(line.throughput * (0.96 + 0.04 * Math.sin(minute / 25))),
        buffer: line.id === 'assembly' ? 30 + minute / 120 : 0 });
    });
    if (scenario !== 'normal') setScenario(state, scenario);
    return state;
  }
  function incident(state, type, zone, severity, title, description) {
    const existing = state.incidents.find(x => x.type === type && x.status === 'open');
    if (existing) { existing.description = description; return existing; }
    const item = { id: state.nextId++, type, zone, severity, title, description,
      minute: state.elapsedMinutes, status: 'open' };
    state.incidents.unshift(item);
    return item;
  }
  function resolveType(state, type) {
    state.incidents.filter(x => x.type === type && x.status === 'open').forEach(x => {
      x.status = 'resolved'; x.resolvedMinute = state.elapsedMinutes;
    });
  }
  function setScenario(state, scenario) {
    if (!['normal', 'shortage', 'quality'].includes(scenario)) throw new Error('Неизвестный сценарий');
    state.scenario = scenario;
    const assembly = state.lines.find(l => l.id === 'assembly');
    const logistics = state.lines.find(l => l.id === 'logistics');
    const paint = state.lines.find(l => l.id === 'paint');
    assembly.replenishmentPerHour = scenario === 'shortage' ? 4 : 21;
    logistics.throughput = logistics.capacity * (scenario === 'shortage' ? 0.38 : 0.92);
    logistics.status = scenario === 'shortage' ? 'warning' : 'running';
    paint.status = scenario === 'quality' ? 'warning' : 'running';
    if (scenario === 'shortage') {
      assembly.buffer = 12;
      // This synthetic history represents a supply disruption during the last hour.
      assembly.history = Array.from({ length: 9 }, (_, i) => ({ minute: state.elapsedMinutes - 120 + i * 15,
        throughput: round(assembly.throughput), buffer: i <= 4 ? 28 : 28 - (i - 4) * 4 }));
      incident(state, 'supply', 'logistics', 'critical', 'Задержка подачи комплектующих',
        'Подача: 4 комплекта/ч при потребности 20. Буфер сборки сокращается.');
    } else resolveType(state, 'supply');
    if (scenario === 'quality') incident(state, 'quality', 'paint', 'warning', 'Рост дефектов окраски',
      'Сценарий: повышенная доля дефектов на окрасочной линии.');
    else resolveType(state, 'quality');
    recordAction(state, 'scenario', 'Выбран сценарий: ' + {normal:'обычная смена',shortage:'задержка деталей',quality:'дефекты окраски'}[scenario]);
    refresh(state);
    return state;
  }
  function recordAction(state, type, text) {
    state.actions.unshift({ minute: state.elapsedMinutes, type, text });
    state.actions = state.actions.slice(0, 100);
  }
  function refresh(state) {
    // Imported equipment stops are observations, not supply alarms that a simulation may clear.
    if (state.source === 'imported') state.lines.forEach(line => {
      if (line.importedEquipmentStop) { line.status = 'stopped'; line.throughput = 0; }
    });
    const assembly = state.lines.find(l => l.id === 'assembly');
    if (state.source === 'imported' && assembly.importedEquipmentStop) {
      incident(state, 'stop', 'assembly', 'critical', 'Сборочная линия остановлена',
        'В снимке зафиксирована остановка оборудования. Пополнение деталей не подтверждает его восстановление.');
    } else if (assembly.buffer <= 0 && assembly.replenishmentPerHour < assembly.demandPerHour) {
      assembly.status = 'stopped'; assembly.throughput = 0;
      incident(state, 'stop', 'assembly', 'critical', 'Сборочная линия остановлена', 'Буфер комплектующих исчерпан. Требуется поставка деталей.');
    } else {
      // Recompute from current supply instead of retaining the previous stop state.
      assembly.status = 'running';
      assembly.status = riskFor(assembly).score >= 35 ? 'warning' : 'running';
      if (assembly.throughput === 0) assembly.throughput = assembly.capacity * 0.91;
      resolveType(state, 'stop');
    }
  }
  function tick(state, delta = 5) {
    if (!Number.isFinite(delta) || delta <= 0 || delta > 60) throw new Error('Шаг симуляции: от 1 до 60 минут');
    delta = Math.min(delta, 720 - state.elapsedMinutes);
    if (delta <= 0) { state.running = false; return state; }
    const assembly = state.lines.find(l => l.id === 'assembly');
    const equipmentStopped = state.source === 'imported' && assembly.importedEquipmentStop;
    const drain = (equipmentStopped ? 0 : assembly.demandPerHour) - assembly.replenishmentPerHour;
    const availableMinutes = equipmentStopped ? 0 : drain > 0 ? Math.min(delta, assembly.buffer / drain * 60) : delta;
    assembly.buffer = clamp(assembly.buffer - drain * delta / 60, 0, 150);
    // Repeated fractional steps can leave ~1e-15 kits at an exact depletion boundary.
    if (drain > 0 && assembly.buffer < 1e-9) assembly.buffer = 0;
    state.elapsedMinutes += delta;
    state.lines.forEach((line, i) => {
      const multiplier = line.id === 'logistics' && state.scenario === 'shortage' ? 0.38
        : line.id === 'paint' && state.scenario === 'quality' ? 0.75 : [0.92, 0.86, 0.91, 0.92][i];
      const rate = line.capacity * multiplier * (1 + 0.025 * Math.sin(state.elapsedMinutes / 17 + i));
      const activeMinutes = state.source === 'imported' && line.importedEquipmentStop ? 0
        : line.id === 'assembly' ? availableMinutes : delta;
      line.produced += rate * activeMinutes / 60;
      line.defects += rate * activeMinutes / 60 * (line.id === 'paint' && state.scenario === 'quality' ? 0.12 : 0.012);
      line.downtimeMinutes += delta - activeMinutes;
      line.throughput = activeMinutes < delta ? 0 : round(rate);
      line.history.push({ minute: state.elapsedMinutes, throughput: line.throughput, buffer: round(line.buffer, 2) });
      line.history = line.history.slice(-150);
    });
    refresh(state);
    if (state.elapsedMinutes >= 720) state.running = false;
    return state;
  }
  function replenish(state, amount = 30) {
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100) throw new Error('Объём пополнения: 1–100 комплектов');
    const assembly = state.lines.find(l => l.id === 'assembly');
    assembly.buffer = clamp(assembly.buffer + amount, 0, 150);
    assembly.replenishmentPerHour = 21;
    const logistics = state.lines.find(l => l.id === 'logistics');
    logistics.throughput = round(logistics.capacity * 0.92); logistics.status = 'running';
    if (state.scenario === 'shortage') state.scenario = 'normal';
    resolveType(state, 'supply');
    if (!(state.source === 'imported' && assembly.importedEquipmentStop)) resolveType(state, 'stop');
    recordAction(state, 'replenish', 'Пополнен буфер сборки: +' + amount + ' комплектов; подача восстановлена до 21 комплекта/ч.');
    // Restart trend estimation after the intervention, so obsolete decline does not predict another stop.
    assembly.history.push({ minute: state.elapsedMinutes, throughput: state.source === 'imported' && assembly.importedEquipmentStop ? 0 : assembly.capacity * 0.91, buffer: round(assembly.buffer,2), intervention: true });
    refresh(state);
    return state;
  }
  function acknowledge(state, id) {
    const item = state.incidents.find(x => x.id === id);
    if (!item || item.status !== 'open') return false;
    item.acknowledged = true;
    recordAction(state, 'acknowledge', 'Оператор принял инцидент №' + id + ' в работу.');
    return true;
  }
  function repairQuality(state) {
    const assembly = state.lines.find(l => l.id === 'assembly');
    state.scenario = assembly.replenishmentPerHour < assembly.demandPerHour ? 'shortage' : 'normal';
    state.lines.find(l => l.id === 'paint').status = 'running';
    resolveType(state, 'quality');
    recordAction(state, 'quality', 'Параметры окраски скорректированы. Новые операции возвращаются к нормальной доле дефектов.');
    if (state.source === 'imported') refresh(state);
    return state;
  }
  function trend(history, key) {
    let start = history.map(x => Boolean(x.intervention)).lastIndexOf(true);
    const samples = history.slice(Math.max(0, start)).slice(-8);
    if (samples.length < 3) return null;
    const xmean = samples.reduce((s, x) => s + x.minute, 0) / samples.length;
    const ymean = samples.reduce((s, x) => s + x[key], 0) / samples.length;
    const denom = samples.reduce((s, x) => s + (x.minute - xmean) ** 2, 0);
    if (!denom) return null;
    const slope = samples.reduce((s, x) => s + (x.minute - xmean) * (x[key] - ymean), 0) / denom;
    const intercept = ymean - slope * xmean;
    const residual = samples.reduce((s,x)=>s + (x[key] - (intercept + slope*x.minute)) ** 2, 0);
    const total = samples.reduce((s,x)=>s + (x[key] - ymean) ** 2, 0);
    return { slope, rSquared: total > 0 ? clamp(1 - residual / total, 0, 1) : 1, samples: samples.length };
  }
  function riskFor(line) {
    if (line.id !== 'assembly') {
      const quality = line.produced > 0 ? 100 * (1 - line.defects / line.produced) : 100;
      const score = line.status === 'stopped' ? 100 : line.id === 'paint' && quality < 97 ? 55 : line.status === 'warning' ? 45 : 8;
      return { score, level: score >= 70 ? 'Высокий' : score >= 35 ? 'Средний' : 'Низкий', minutesToStop: null,
        reasons: [quality < 97 ? 'Доля брака выше контрольного порога 3%.' : 'Состояние оборудования и производительность в текущем режиме.'], trend: null };
    }
    const net = line.demandPerHour - line.replenishmentPerHour;
    const minutesToStop = net > 0 ? line.buffer / net * 60 : null;
    const model = trend(line.history, 'buffer');
    const trendMinutes = model && model.slope < -0.01 ? line.buffer / -model.slope : null;
    const score = line.status === 'stopped' || line.buffer <= 0 && net > 0 ? 100
      : minutesToStop !== null && minutesToStop <= 30 ? 90
      : minutesToStop !== null && minutesToStop <= 60 ? 75
      : minutesToStop !== null && minutesToStop <= 120 ? 55 : net > 0 ? 25 : 8;
    const reasons = [
      'Буфер: ' + round(line.buffer) + ' комплектов.',
      'Расход: ' + round(line.demandPerHour) + ', подача: ' + round(line.replenishmentPerHour) + ' комплектов/ч.',
      net > 0 ? 'Дефицит потока: ' + round(net) + ' комплектов/ч.' : 'Подача покрывает расход.'
    ];
    return { score, level: score >= 70 ? 'Высокий' : score >= 35 ? 'Средний' : 'Низкий',
      minutesToStop: minutesToStop === null ? null : round(minutesToStop), reasons,
      trend: model ? { minutes: trendMinutes === null ? null : round(trendMinutes), rSquared: round(model.rSquared, 2), samples: model.samples } : null };
  }
  function metrics(state, zone = 'all') {
    const lines = zone === 'all' ? state.lines : state.lines.filter(l => l.id === zone);
    const outputLine = zone === 'all' ? state.lines.find(l => l.id === 'assembly') : lines[0];
    const capacity = lines.reduce((s,l)=>s+l.capacity,0);
    const actual = lines.reduce((s,l)=>s+l.throughput,0);
    const plan = outputLine.capacity * state.elapsedMinutes / 60;
    return { produced: Math.floor(outputLine.produced), plan: Math.floor(plan),
      planPercent: round(outputLine.produced / plan * 100),
      load: round(actual / capacity * 100),
      availability: round(100 * (1 - lines.reduce((s,l)=>s+l.downtimeMinutes,0) / (lines.length * state.elapsedMinutes))),
      quality: round(100 * (1 - outputLine.defects / Math.max(outputLine.produced, 1))),
      downtime: round(lines.reduce((s,l)=>s+l.downtimeMinutes,0)), throughput: round(outputLine.throughput),
      openIncidents: state.incidents.filter(x => x.status === 'open' && (zone === 'all' || x.zone === zone)).length };
  }
  function validateImport(input) {
    if (!input || input.schemaVersion !== 1 || !Array.isArray(input.lines) || input.lines.length !== 4)
      throw new Error('Нужны schemaVersion: 1 и ровно четыре линии в lines.');
    const state = createState();
    if (!Number.isFinite(input.elapsedMinutes) || input.elapsedMinutes < 1 || input.elapsedMinutes > 720)
      throw new Error('elapsedMinutes должен быть от 1 до 720.');
    const seen = new Set();
    const numeric = ['capacity','throughput','produced','defects','downtimeMinutes','buffer','demandPerHour','replenishmentPerHour'];
    const bounds = { capacity: 500, throughput: 500, produced: 100000, defects: 100000, downtimeMinutes: input.elapsedMinutes, buffer: 150, demandPerHour: 500, replenishmentPerHour: 500 };
    input.lines.forEach(row=> {
      if (!row || typeof row !== 'object' || !Object.hasOwn(ZONES, row.id) || seen.has(row.id))
        throw new Error('Идентификаторы линий: body, paint, assembly, logistics — без повторов.');
      seen.add(row.id);
      const line = state.lines.find(l=>l.id===row.id);
      numeric.forEach(key=> {
        if (!Number.isFinite(row[key]) || row[key] < 0 || row[key] > bounds[key]) throw new Error('Некорректное поле ' + key + ' у линии ' + row.id + '.');
        line[key] = row[key];
      });
      if (line.capacity <= 0 || line.throughput > line.capacity || line.defects > line.produced)
        throw new Error('Проверьте мощность, производительность и число дефектов линии ' + row.id + '.');
      if (!['running','warning','stopped'].includes(row.status)) throw new Error('Некорректный статус линии ' + row.id + '.');
      if (row.status === 'stopped' && row.throughput > 0) throw new Error('У остановленной линии производительность должна быть нулевой.');
      line.status = row.status;
      line.importedEquipmentStop = row.status === 'stopped' &&
        !(row.id === 'assembly' && line.buffer <= 0 && line.replenishmentPerHour < line.demandPerHour);
      line.history = [{ minute: input.elapsedMinutes, throughput: line.throughput, buffer: line.buffer }];
    });
    state.elapsedMinutes = input.elapsedMinutes;
    state.shift = input.shift === 'night' ? 'night' : 'day';
    state.source = 'imported';
    state.scenario = 'normal'; state.running = false;
    const assembly = state.lines.find(l=>l.id==='assembly');
    if (assembly.replenishmentPerHour < assembly.demandPerHour) {
      state.scenario = 'shortage';
      incident(state,'supply','logistics','critical','Дефицит потока комплектующих','Подача в снимке ниже потребности сборочной линии.');
    }
    if(state.lines.find(l=>l.id==='paint').status==='warning') incident(state,'quality','paint','warning','Отклонение окраски','Импортирован статус, требующий внимания.');
    refresh(state);
    recordAction(state, 'import', 'Загружен снимок производства.');
    return state;
  }
  function exportSnapshot(state) {
    const { schemaVersion, elapsedMinutes, shift, lines } = state;
    return { schemaVersion, elapsedMinutes, shift, lines: lines.map(l=>({
      id:l.id, capacity:l.capacity, throughput:round(l.throughput,2), produced:round(l.produced,2),
      defects:round(l.defects,2), downtimeMinutes:round(l.downtimeMinutes,2), status:l.status,
      buffer:round(l.buffer,2), demandPerHour:l.demandPerHour, replenishmentPerHour:l.replenishmentPerHour
    })) };
  }
  return { ZONES, createState, setScenario, tick, replenish, acknowledge, repairQuality,
    riskFor, metrics, trend, validateImport, exportSnapshot, timeLabel, round };
});
