import Papa from "papaparse";

export const CSV_FIELDS = [
  "schemaVersion",
  "elapsedMinutes",
  "shift",
  "id",
  "capacity",
  "throughput",
  "produced",
  "defects",
  "downtimeMinutes",
  "status",
  "buffer",
  "demandPerHour",
  "replenishmentPerHour",
];
const NUMERIC = [
  "capacity",
  "throughput",
  "produced",
  "defects",
  "downtimeMinutes",
  "buffer",
  "demandPerHour",
  "replenishmentPerHour",
];
function numberCell(value, field, row) {
  const text = value.trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(text))
    throw new Error(
      `CSV: поле ${field}, строка ${row} должно содержать число.`,
    );
  const number = Number(text.replace(",", "."));
  if (!Number.isFinite(number))
    throw new Error(`CSV: некорректное число ${field}, строка ${row}.`);
  return number;
}

export function parseProductionCSV(text) {
  if (typeof text !== "string" || text.length > 1024 * 1024)
    throw new Error("CSV: максимальный размер — 1 МБ.");
  const parsed = Papa.parse(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";", "\t"],
  });
  if (parsed.errors.length)
    throw new Error("CSV: проверьте разделители, кавычки и строки файла.");
  const [rawHeader, ...rows] = parsed.data;
  const header = rawHeader?.map((cell) => cell.trim());
  if (
    !header ||
    header.length !== CSV_FIELDS.length ||
    new Set(header).size !== header.length ||
    CSV_FIELDS.some((name) => !header.includes(name))
  )
    throw new Error(
      "CSV: нужны все столбцы шаблона, без повторов и лишних полей.",
    );
  if (rows.length !== 4)
    throw new Error("CSV: нужны ровно четыре строки линий.");
  let metadata;
  const lines = rows.map((cells, index) => {
    const rowNumber = index + 2;
    if (cells.length !== header.length)
      throw new Error(
        `CSV: число столбцов в строке ${rowNumber} не совпадает с заголовком.`,
      );
    const row = Object.fromEntries(
      header.map((field, column) => [field, cells[column].trim()]),
    );
    const current = {
      schemaVersion: numberCell(row.schemaVersion, "schemaVersion", rowNumber),
      elapsedMinutes: numberCell(
        row.elapsedMinutes,
        "elapsedMinutes",
        rowNumber,
      ),
      shift: row.shift,
    };
    if (
      current.schemaVersion !== 1 ||
      !["day", "night"].includes(current.shift)
    )
      throw new Error(
        "CSV: schemaVersion должен быть 1, shift — day или night.",
      );
    if (
      metadata &&
      (current.elapsedMinutes !== metadata.elapsedMinutes ||
        current.shift !== metadata.shift)
    )
      throw new Error("CSV: время и смена должны совпадать во всех строках.");
    metadata = current;
    return {
      id: row.id,
      status: row.status,
      ...Object.fromEntries(
        NUMERIC.map((field) => [
          field,
          numberCell(row[field], field, rowNumber),
        ]),
      ),
    };
  });
  // The shared engine performs the final bounds, status and unique-line validation.
  return { ...metadata, lines };
}

export function snapshotToCSV(snapshot) {
  const rows = snapshot.lines.map((line) =>
    CSV_FIELDS.map((field) =>
      ["schemaVersion", "elapsedMinutes", "shift"].includes(field)
        ? snapshot[field]
        : line[field],
    ),
  );
  return (
    "\uFEFF" +
    Papa.unparse(
      { fields: CSV_FIELDS, data: rows },
      { delimiter: ";", newline: "\r\n", escapeFormulae: true },
    )
  );
}
