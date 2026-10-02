const labels = {
  running: "В работе",
  warning: "Внимание",
  stopped: "Остановлена",
};

export function sourceLabel(state) {
  return state.source === "synthetic"
    ? "Синтетическая симуляция"
    : "Импортированный снимок; происхождение не подтверждено";
}

export function downloadText(
  filename,
  text,
  type = "text/plain;charset=utf-8",
) {
  const href = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Keep the URL alive until the browser has started its download.
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export function downloadJSON(filename, value) {
  downloadText(
    filename,
    JSON.stringify(value, null, 2),
    "application/json;charset=utf-8",
  );
}

export function exportSnapshot(state, engine) {
  downloadJSON("production-snapshot.json", engine.exportSnapshot(state));
}

function csvCell(value) {
  let text = String(value ?? "");
  // Spreadsheet applications may execute formulas even inside quoted CSV cells.
  if (/^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function exportCSV(state, engine) {
  const rows = [
    [
      "Источник",
      "Модельное время",
      "Участок",
      "Линия",
      "Выпуск, экв. ед.",
      "Темп, ед./ч",
      "Мощность, ед./ч",
      "Простой, мин",
      "Статус",
    ],
    ...state.lines.map((line) => [
      sourceLabel(state),
      engine.timeLabel(state.elapsedMinutes, state.shift),
      line.name,
      line.line,
      engine.round(line.produced, 2),
      engine.round(line.throughput, 2),
      line.capacity,
      engine.round(line.downtimeMinutes, 2),
      labels[line.status] || line.status,
    ]),
  ];
  downloadText(
    "shift-report.csv",
    "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n"),
    "text/csv;charset=utf-8",
  );
}

export function exportReport(state, engine, prediction) {
  const metrics = engine.metrics(state);
  const risk = engine.riskFor(
    state.lines.find((line) => line.id === "assembly"),
  );
  const text = [
    "Allur Plant Twin — отчёт за смену",
    "Источник: " + sourceLabel(state),
    "Время: " + engine.timeLabel(state.elapsedMinutes, state.shift),
    "Выпуск: " + metrics.produced + " ед. / план " + metrics.plan,
    "Загрузка: " + metrics.load + "%",
    "Доступность: " + metrics.availability + "%",
    "Первичное качество: " + metrics.quality + "%",
    "Простой оборудования: " + metrics.downtime + " машино-мин",
    "Индекс риска сборки: " + risk.score + "/100 (не вероятность)",
    "До исчерпания буфера: " +
      (risk.minutesToStop === null
        ? "не прогнозируется"
        : risk.minutesToStop + " мин"),
    "ML-оценка: " +
      (prediction?.available
        ? engine.round(prediction.probability * 100) +
          "%; горизонт 60 мин; синтетическое обучение"
        : prediction?.reason || "недоступна"),
    ...risk.reasons,
    "",
    "Показатели смены и экономический эффект не являются измеренными результатами Allur.",
    "",
    "Журнал действий:",
    ...state.actions.map(
      (action) =>
        engine.timeLabel(action.minute, state.shift) + " " + action.text,
    ),
  ].join("\n");
  downloadText("shift-report.txt", text);
}
