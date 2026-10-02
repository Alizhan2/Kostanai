import { useState } from "react";
import { downloadJSON, exportSnapshot, sourceLabel } from "../lib/exports.js";

export default function SettingsPage({
  state,
  engine,
  onImport,
  onReset,
  onNotice,
}) {
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  async function importFile(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setError("");
    setImporting(true);
    try {
      if (file.size > 1024 * 1024)
        throw new Error("Размер файла превышает 1 МБ.");
      const data = JSON.parse(await file.text());
      const candidate = engine.validateImport(data);
      onImport(candidate);
      onNotice?.("Снимок загружен. Симуляция на паузе.");
    } catch (cause) {
      setError(
        "Импорт не выполнен: " +
          (cause instanceof SyntaxError
            ? "некорректный JSON."
            : cause.message) +
          " Текущие данные сохранены.",
      );
    } finally {
      input.value = "";
      setImporting(false);
    }
  }

  return (
    <div className="stack">
      <div className="two-column">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Источник данных</h2>
              <p className="panel-subtitle">
                Снимок производства в формате JSON
              </p>
            </div>
          </div>
          <p>
            Текущий источник: <strong>{sourceLabel(state)}</strong>.
          </p>
          <p className="form-hint">
            Показатели модели демонстрационные. Открытая информация с сайтов
            Allur описывает предприятие; она не заменяет телеметрию линий.
          </p>
          <p>
            JSON должен содержать <code>schemaVersion: 1</code> и четыре линии:{" "}
            <code>body</code>, <code>paint</code>, <code>assembly</code>,{" "}
            <code>logistics</code>. Числа, идентификаторы и статусы проверяются
            перед заменой смены.
          </p>
          <div className="field">
            <label htmlFor="production-import">Загрузить снимок JSON</label>
            <input
              id="production-import"
              type="file"
              accept=".json,application/json"
              onChange={importFile}
              disabled={importing}
              aria-describedby="production-import-help"
            />
            <p id="production-import-help" className="form-hint">
              Максимум 1 МБ. После загрузки симуляция на паузе, история
              начинается с новой точки.
            </p>
          </div>
          {importing ? <p role="status">Проверяем файл…</p> : null}
          {error ? (
            <p className="error-message" role="alert">
              {error}
            </p>
          ) : null}
          <div className="field-grid">
            <button
              className="button button-secondary"
              onClick={() => exportSnapshot(state, engine)}
            >
              Экспорт снимка
            </button>
            <button
              className="button button-secondary"
              onClick={() =>
                downloadJSON(
                  "sample-production.json",
                  engine.exportSnapshot(engine.createState("shortage")),
                )
              }
            >
              Скачать пример
            </button>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Сессия и происхождение</h2>
              <p className="panel-subtitle">
                Данные хранятся в текущем браузере
              </p>
            </div>
          </div>
          <p>
            Снимок сохраняется локально. После перезагрузки симуляция находится
            на паузе. Экспорт JSON содержит состояние линий; журнал и
            исторические ряды в этот формат не входят.
          </p>
          <p className="info-note">
            Импортированный JSON не подтверждает, что данные получены от
            предприятия. Для промышленного обучения нужны согласованные
            временные ряды, причины остановок и отдельная проверочная выборка.
          </p>
          <button
            className="button button-secondary"
            onClick={() => {
              setError("");
              onReset();
            }}
          >
            Создать новую демосмену
          </button>
          <p className="form-hint">
            Сброс заменяет текущую смену синтетическим примером. Сначала
            скачайте снимок, если хотите сохранить её.
          </p>
        </section>
      </div>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Методика прогнозирования</h2>
            <p className="panel-subtitle">
              Прозрачные расчёты и границы модели
            </p>
          </div>
        </div>
        <div className="two-column">
          <div>
            <h3>Поток и индекс риска</h3>
            <p>
              <strong>До исчерпания:</strong> буфер / (расход − подача) × 60
              минут. При достаточной подаче исчерпание не прогнозируется.
              Линейный тренд использует последние 8 точек, минимум 3; после
              пополнения начинается новый ряд.
            </p>
            <p>
              Индекс риска: 90/100 при горизонте ≤30 минут, 75 при ≤60, 55 при
              ≤120, 25 при большем дефиците и 8 при достаточной подаче.
              Остановленная сборка — 100. Это индекс по правилам, а не
              вероятность поломки.
            </p>
            <p>
              Доступность = 1 − суммарный простой / суммарное время наблюдения
              линий.
            </p>
          </div>
          <div>
            <h3>Обученная модель буфера</h3>
            <p>
              Лес из 64 деревьев оценивает исчерпание буфера в ближайшие 60
              минут. Обучение использует синтетические смены с меняющейся
              подачей. Калибровка и порог выбираются на отдельных сменах.
            </p>
            <p>
              На импортированных снимках ML-прогноз отключён до обучения и
              проверки на данных предприятия. Поломки оборудования не входят в
              цель этой модели.
            </p>
            <p className="info-note">
              Диагностика Scania APS — отдельная задача на открытых
              эксплуатационных данных грузовиков. Её метрики нельзя переносить
              на Allur.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
