import { useCallback, useEffect, useState } from "react";
import { engine as E, analysis, ml, bufferModel } from "./lib/runtime.js";
import {
  Icon,
  PanelHeader,
  Kpis,
  HistoryChart,
  LineTable,
  RiskPanel,
  ProcessMap,
  IncidentList,
  LineDialog,
  fmt,
} from "./components/PlantViews.jsx";
import ReportsPage from "./components/ReportsPage.jsx";
import SettingsPage from "./components/SettingsPage.jsx";
import SourcesPage from "./components/SourcesPage.jsx";

const STORAGE = "allur-twin-v1";
const pages = {
  overview: [
    "Обзор производства",
    "Текущая смена, поток комплектующих и отклонения.",
  ],
  lines: [
    "Производственные линии",
    "Состояние участков и история темпа обработки.",
  ],
  incidents: ["Инциденты", "Отклонения, причины и действия оператора."],
  quality: [
    "Контроль качества",
    "Дефекты операций и первичное качество каждого участка.",
  ],
  reports: ["Отчёты и сценарии", "Сравнение решений и экспорт текущей смены."],
  sources: [
    "Источники данных",
    "Происхождение сведений и границы применимости.",
  ],
  settings: [
    "Данные и настройки",
    "Импорт снимка, локальная сессия и методика расчётов.",
  ],
};
const scenarios = {
  normal: "Обычная смена",
  shortage: "Задержка деталей",
  quality: "Дефекты окраски",
};
function initialState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE));
    if (saved?.snapshot) {
      const restored = E.validateImport(saved.snapshot);
      // A reloaded snapshot has no observed history. Retain provenance, never invent it.
      if (saved.source === "synthetic") {
        restored.source = "synthetic";
        restored.scenario =
          saved.scenario in scenarios ? saved.scenario : "normal";
      }
      return restored;
    }
  } catch {
    /* An invalid saved snapshot falls back to a fresh demo. */
  }
  return E.createState("shortage");
}

export default function App() {
  const [state, setState] = useState(initialState);
  const [page, setPage] = useState("overview");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState("assembly");
  const [detail, setDetail] = useState(null);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [notice, setNotice] = useState("");
  const [comparisonMinute, setComparisonMinute] = useState(30);
  const mutate = useCallback(
    (operation) =>
      setState((previous) => {
        const next = structuredClone(previous);
        operation(next);
        return next;
      }),
    [],
  );
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE,
        JSON.stringify({
          snapshot: E.exportSnapshot(state),
          source: state.source,
          scenario: state.scenario,
        }),
      );
    } catch {
      /* Local persistence is optional. */
    }
  }, [state]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (
      !running ||
      detail ||
      page === "settings" ||
      state.elapsedMinutes >= 720
    )
      return;
    const timer = setInterval(
      () =>
        mutate((next) =>
          E.tick(next, Math.min(5 * speed, 720 - next.elapsedMinutes)),
        ),
      2500,
    );
    return () => clearInterval(timer);
  }, [running, detail, page, speed, state.elapsedMinutes, mutate]);
  const prediction = ml.predict(
    state.lines.find((line) => line.id === "assembly"),
    bufferModel,
    state.source,
  );
  const lines =
    filter === "all"
      ? state.lines
      : state.lines.filter((line) => line.id === filter);
  const incidents = state.incidents.filter(
    (item) => filter === "all" || item.zone === filter,
  );
  const activeIncidents = incidents.filter((item) => item.status === "open");
  function newDemo(scenario = "shortage", shift = state.shift) {
    setRunning(false);
    setState(E.createState(scenario, shift));
    setFilter("all");
    setDetail(null);
    setNotice("Создана новая синтетическая смена.");
  }
  function replenish() {
    mutate((next) => E.replenish(next));
    setNotice(
      "Добавлено 30 комплектов, подача восстановлена. Остановка оборудования сохраняется.",
    );
  }
  const canFilter = ["overview", "lines", "incidents", "quality"].includes(
    page,
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#overview"
          onClick={(event) => {
            event.preventDefault();
            setPage("overview");
          }}
        >
          <Icon name="lines" size={36} />
          <div>
            <strong>ALLUR</strong>
            <small>Plant Twin · прототип</small>
          </div>
        </a>
        <nav aria-label="Разделы приложения">
          {Object.entries(pages).map(([id, [title]]) => (
            <button
              key={id}
              className={`nav-link ${page === id ? "is-active" : ""}`}
              aria-current={page === id ? "page" : undefined}
              onClick={() => setPage(id)}
            >
              <Icon name={id} />
              <span>
                {id === "overview"
                  ? "Обзор"
                  : id === "lines"
                    ? "Линии"
                    : id === "reports"
                      ? "Отчёты"
                      : id === "sources"
                        ? "Источники"
                        : id === "settings"
                          ? "Настройки"
                          : title}
              </span>
              {id === "incidents" &&
              state.incidents.some((item) => item.status === "open") ? (
                <span className="nav-count">
                  {
                    state.incidents.filter((item) => item.status === "open")
                      .length
                  }
                </span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <strong>Qostanai AI Industry 2026</strong>
          <p>Кейс №2 · цифровой двойник</p>
          <p>
            Хакатонный прототип.
            <br />
            Без подключения к заводу.
          </p>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Производство</span>
            <Icon name="arrow" />
            <strong>{pages[page][0]}</strong>
          </div>
          <div className="header-actions">
            <span>
              <Icon name="clock" size={14} />{" "}
              {E.timeLabel(state.elapsedMinutes, state.shift)} · модельное время
            </span>
            <label className="sr-only" htmlFor="shift">
              Смена
            </label>
            <select
              id="shift"
              className="select"
              value={state.shift}
              disabled={state.source !== "synthetic"}
              onChange={(event) => newDemo(state.scenario, event.target.value)}
            >
              <option value="day">Дневная смена</option>
              <option value="night">Ночная смена</option>
            </select>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">Цифровой двойник · кейс №2</p>
              <h1>{pages[page][0]}</h1>
              <p className="page-subtitle">{pages[page][1]}</p>
            </div>
            <span
              className={`source-chip ${state.source === "synthetic" ? "is-synthetic" : ""}`}
            >
              {state.source === "synthetic"
                ? "Синтетические данные"
                : "Импортированный снимок"}
            </span>
          </div>
          {canFilter ? (
            <div className="toolbar">
              <div className="filter-pills" aria-label="Фильтр участков">
                {[
                  ["all", "Все участки"],
                  ...Object.entries(E.ZONES).map(([id, zone]) => [
                    id,
                    zone.name,
                  ]),
                ].map(([id, title]) => (
                  <button
                    key={id}
                    className={filter === id ? "is-selected" : ""}
                    aria-pressed={filter === id}
                    onClick={() => setFilter(id)}
                  >
                    {title}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {page !== "sources" && page !== "settings" ? (
            <div className="toolbar simulation-toolbar">
              <div>
                <label htmlFor="scenario" className="form-hint">
                  Новая демосмена
                </label>
                <select
                  id="scenario"
                  className="select"
                  value={state.source === "synthetic" ? state.scenario : ""}
                  onChange={(event) => newDemo(event.target.value)}
                  disabled={state.source !== "synthetic"}
                >
                  {state.source !== "synthetic" ? (
                    <option value="">Снимок JSON</option>
                  ) : null}
                  {Object.entries(scenarios).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="speed" className="sr-only">
                  Скорость симуляции
                </label>
                <select
                  id="speed"
                  className="select"
                  value={speed}
                  onChange={(event) => setSpeed(Number(event.target.value))}
                >
                  {[1, 3, 6].map((value) => (
                    <option key={value} value={value}>
                      ×{value}
                    </option>
                  ))}
                </select>
                <button
                  className="button button-secondary"
                  disabled={state.elapsedMinutes >= 720}
                  onClick={() => setRunning((value) => !value)}
                >
                  <Icon name={running ? "pause" : "play"} />
                  {running ? "Пауза" : "Запустить"}
                </button>
                <button
                  className="button button-secondary"
                  disabled={running || state.elapsedMinutes >= 720}
                  onClick={() =>
                    mutate((next) =>
                      E.tick(next, Math.min(5, 720 - next.elapsedMinutes)),
                    )
                  }
                >
                  +5 мин
                </button>
              </div>
            </div>
          ) : null}
          {state.elapsedMinutes >= 720 ? (
            <p className="info-note">
              Демонстрационная смена завершена. Скачайте отчёт или создайте
              новую смену в настройках.
            </p>
          ) : null}
          {page === "overview" ? (
            <div className="stack">
              <Kpis state={state} engine={E} filter={filter} />
              <div className="content-grid">
                <ProcessMap
                  lines={state.lines}
                  selected={selected}
                  onSelect={setSelected}
                  onDetail={setDetail}
                />
                <RiskPanel
                  state={state}
                  engine={E}
                  prediction={prediction}
                  onReplenish={replenish}
                />
              </div>
              <section className="panel">
                <PanelHeader
                  title="Отклонения сейчас"
                  subtitle={
                    filter === "all" ? "Все участки" : E.ZONES[filter].name
                  }
                />
                <IncidentList
                  incidents={activeIncidents}
                  state={state}
                  engine={E}
                />
              </section>
              <div className="two-column">
                <section className="panel">
                  <PanelHeader
                    title="Темп финальной сборки"
                    subtitle="Расчётная история, ед./ч"
                  />
                  <HistoryChart
                    line={state.lines.find((line) => line.id === "assembly")}
                  />
                </section>
                <section className="panel">
                  <PanelHeader
                    title="Буфер комплектующих"
                    subtitle="Запас на входе сборочной линии"
                  />
                  <HistoryChart
                    line={state.lines.find((line) => line.id === "assembly")}
                    metric="buffer"
                  />
                </section>
              </div>
              <section className="panel">
                <PanelHeader title="Состояние линий" />
                <LineTable lines={lines} onDetail={setDetail} />
              </section>
            </div>
          ) : null}
          {page === "lines" ? (
            <div className="stack">
              <Kpis state={state} engine={E} filter={filter} />
              <section className="panel">
                <PanelHeader title="Производственные участки" />
                <LineTable lines={lines} onDetail={setDetail} />
              </section>
              <div className="two-column">
                {lines.map((line) => (
                  <section className="panel" key={line.id}>
                    <PanelHeader title={line.name} />
                    <HistoryChart line={line} />
                    <p className="form-hint">{line.equipment}</p>
                    <button
                      className="button button-secondary"
                      onClick={() => setDetail(line.id)}
                    >
                      Карточка участка
                    </button>
                  </section>
                ))}
              </div>
            </div>
          ) : null}
          {page === "incidents" ? (
            <div className="stack">
              <section className="panel">
                <PanelHeader
                  title="Журнал отклонений"
                  subtitle="Принятие в работу не устраняет причину инцидента"
                />
                <IncidentList
                  incidents={incidents}
                  state={state}
                  engine={E}
                  full
                  onAcknowledge={(id) =>
                    mutate((next) => E.acknowledge(next, id))
                  }
                />
              </section>
              <RiskPanel
                state={state}
                engine={E}
                prediction={prediction}
                onReplenish={replenish}
              />
            </div>
          ) : null}
          {page === "quality" ? (
            <div className="stack">
              <div className="two-column">
                {lines.map((line) => (
                  <section className="panel" key={line.id}>
                    <PanelHeader title={line.name} />
                    <strong className="kpi-value">
                      {fmt(
                        (1 - line.defects / Math.max(line.produced, 1)) * 100,
                      )}
                      %
                    </strong>
                    <p className="form-hint">
                      Первичное качество · {fmt(line.defects)} дефектов /{" "}
                      {fmt(line.produced)} операций
                    </p>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${(1 - line.defects / Math.max(line.produced, 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </section>
                ))}
              </div>
              <section className="panel">
                <PanelHeader
                  title="Корректирующее действие"
                  subtitle="Устранение отклонения окраски"
                />
                <p>
                  Действие восстанавливает нормальный темп образования дефектов.
                  Накопленные дефекты и независимая остановка оборудования
                  сохраняются.
                </p>
                <button
                  className="button button-primary"
                  disabled={
                    !state.incidents.some(
                      (item) =>
                        item.type === "quality" && item.status === "open",
                    )
                  }
                  onClick={() => {
                    mutate((next) => E.repairQuality(next));
                    setNotice("Отклонение окраски устранено.");
                  }}
                >
                  Устранить отклонение окраски
                </button>
              </section>
            </div>
          ) : null}
          {page === "reports" ? (
            <ReportsPage
              state={state}
              engine={E}
              analysis={analysis}
              mlPrediction={prediction}
              interventionMinute={comparisonMinute}
              onInterventionChange={setComparisonMinute}
            />
          ) : null}
          {page === "sources" ? <SourcesPage /> : null}
          {page === "settings" ? (
            <SettingsPage
              state={state}
              engine={E}
              onImport={(candidate) => {
                setRunning(false);
                setState(candidate);
                setFilter("all");
                setDetail(null);
              }}
              onReset={() => newDemo()}
              onNotice={setNotice}
            />
          ) : null}
          <footer className="page-footer">
            Allur Plant Twin · авторский хакатонный прототип. Показатели
            симуляции не являются данными предприятия.
          </footer>
        </main>
      </div>
      <LineDialog
        line={state.lines.find((line) => line.id === detail)}
        engine={E}
        state={state}
        onClose={() => setDetail(null)}
      />
      {notice ? (
        <div className="toast" role="status">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
