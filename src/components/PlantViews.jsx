import { useEffect, useRef } from "react";

export const fmt = (value, digits = 1) =>
  Number(value).toLocaleString("ru-RU", { maximumFractionDigits: digits });
export const statusLabel = {
  running: "В работе",
  warning: "Внимание",
  stopped: "Остановлена",
};
const names = {
  body: "Кузовной цех",
  paint: "Окраска",
  assembly: "Финальная сборка",
  logistics: "Логистика",
};

export function Icon({ name, size = 20 }) {
  const paths = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    lines: (
      <>
        <path d="M3 21V10l6 3V7l6 3V3h6v18Z" />
        <path d="M6 17h2m4 0h2m4 0h1" />
      </>
    ),
    incidents: (
      <>
        <path d="m12 3 10 18H2Z" />
        <path d="M12 9v5m0 3v1" />
      </>
    ),
    quality: (
      <>
        <path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    reports: (
      <>
        <path d="M4 3v18h17M8 16v-5m5 5V7m5 9V4" />
      </>
    ),
    sources: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z" />
      </>
    ),
    settings: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="8" cy="6" r="2" fill="currentColor" />
        <circle cx="16" cy="12" r="2" fill="currentColor" />
        <circle cx="10" cy="18" r="2" fill="currentColor" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h16m-6-6 6 6-6 6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l4 2" />
      </>
    ),
    play: <path d="m8 4 12 8-12 8Z" />,
    pause: (
      <>
        <path d="M8 4v16M16 4v16" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    close: <path d="m5 5 14 14M19 5 5 19" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.lines}
    </svg>
  );
}

export function Status({ status }) {
  return (
    <span className={`status-badge badge-${status}`}>
      <i aria-hidden="true" />
      {statusLabel[status]}
    </span>
  );
}

export function PanelHeader({ title, subtitle, children }) {
  return (
    <div className="panel-header">
      <div>
        <h2 className="panel-title">{title}</h2>
        {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function Kpis({ state, engine, filter }) {
  const metrics = engine.metrics(state, filter);
  const final = filter === "all" || filter === "assembly";
  const items = [
    [
      final ? "Выпуск за смену" : "Обработано единиц",
      `${fmt(metrics.produced, 0)} ${final ? "авто" : "ед."}`,
      `План ${fmt(metrics.plan, 0)} · ${fmt(metrics.planPercent)}%`,
    ],
    ["Загрузка линий", `${fmt(metrics.load)}%`, "Текущий темп / мощность"],
    [
      "Доступность",
      `${fmt(metrics.availability)}%`,
      `Простой ${fmt(metrics.downtime)} машино-мин`,
    ],
    [
      "Первичное качество",
      `${fmt(metrics.quality)}%`,
      final
        ? "Годные / операции финальной сборки"
        : "Годные / обработанные операции",
    ],
  ];
  return (
    <section className="kpi-grid" aria-label="Показатели текущей смены">
      {items.map(([label, value, note], index) => (
        <article className="kpi-card" key={label}>
          <div className="kpi-label">
            <span>{label}</span>
            <Icon
              name={["lines", "reports", "clock", "quality"][index]}
              size={18}
            />
          </div>
          <strong className="kpi-value">{value}</strong>
          <p className="kpi-note">{note}</p>
        </article>
      ))}
    </section>
  );
}

export function HistoryChart({ line, metric = "throughput" }) {
  const data = line.history.slice(-16);
  if (!data.length)
    return <p className="empty-state">История ещё не накоплена.</p>;
  const isBuffer = metric === "buffer";
  const limit =
    Math.max(
      ...data.map((point) => point[metric]),
      isBuffer ? 12 : line.capacity,
      1,
    ) * 1.1;
  const start = data[0].minute,
    end = Math.max(data.at(-1).minute, start + 1);
  const x = (minute) => 36 + ((minute - start) / (end - start)) * 504;
  const y = (value) => 156 - (value / limit) * 126;
  const d = data
    .map(
      (point, index) =>
        `${index ? "L" : "M"}${x(point.minute).toFixed(2)},${y(point[metric]).toFixed(2)}`,
    )
    .join(" ");
  return (
    <figure className="chart">
      <svg
        viewBox="0 0 570 192"
        role="img"
        aria-label={`${isBuffer ? "Запас комплектов" : "Темп выпуска"}: от ${fmt(data[0][metric])} до ${fmt(data.at(-1)[metric])}. ${data.length} наблюдений.`}
      >
        {[0, 0.5, 1].map((ratio) => (
          <g key={ratio}>
            <line
              x1="36"
              y1={y(limit * ratio)}
              x2="540"
              y2={y(limit * ratio)}
              stroke="currentColor"
              opacity=".1"
            />
            <text x="28" y={y(limit * ratio) + 4} textAnchor="end">
              {fmt(limit * ratio, 0)}
            </text>
          </g>
        ))}
        {!isBuffer ? (
          <line
            x1="36"
            y1={y(line.capacity)}
            x2="540"
            y2={y(line.capacity)}
            className="capacity-line"
            strokeDasharray="5 5"
          />
        ) : null}
        <path
          d={`${d} L${x(data.at(-1).minute).toFixed(2)},156 L36,156 Z`}
          fill="var(--brand)"
          opacity=".06"
        />
        <path d={d} fill="none" stroke="var(--brand)" strokeWidth="2.5" />
        {data.length === 1 ? (
          <circle cx="36" cy={y(data[0][metric])} r="4" fill="var(--brand)" />
        ) : null}
        <text x="36" y="182">
          {Math.floor(start)} мин смены
        </text>
        <text x="540" y="182" textAnchor="end">
          {Math.floor(data.at(-1).minute)} мин
        </text>
      </svg>
      <figcaption className="chart-legend">
        <span>{isBuffer ? "Буфер, комплекты" : "Темп, единиц в час"}</span>
        {!isBuffer ? (
          <span>Пунктир — мощность {fmt(line.capacity)} ед./ч</span>
        ) : null}
      </figcaption>
    </figure>
  );
}

export function LineTable({ lines, onDetail }) {
  return (
    <div className="table-wrap">
      <table className="line-table">
        <caption>
          Выпуск завода считается по финальной сборке; операции разных участков
          не суммируются.
        </caption>
        <thead>
          <tr>
            {[
              "Производственная линия",
              "Загрузка",
              "Выпуск, ед.",
              "Темп, ед./ч",
              "Простой, мин",
              "Статус",
            ].map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <th scope="row">
                <button
                  className="table-link"
                  onClick={() => onDetail(line.id)}
                >
                  {line.line}
                </button>
                <small>{line.name}</small>
              </th>
              <td>{fmt((line.throughput / line.capacity) * 100)}%</td>
              <td>{fmt(Math.floor(line.produced), 0)}</td>
              <td>{fmt(line.throughput)}</td>
              <td>{fmt(line.downtimeMinutes)}</td>
              <td>
                <Status status={line.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RiskPanel({
  state,
  engine,
  prediction,
  onReplenish,
  compact = false,
}) {
  const assembly = state.lines.find((line) => line.id === "assembly");
  const risk = engine.riskFor(assembly);
  const stopped = assembly.status === "stopped";
  return (
    <section
      className={`panel risk-panel ${stopped ? "is-stopped" : risk.score >= 70 ? "is-warning" : ""}`}
      aria-label="Прогноз остановки сборки"
    >
      <PanelHeader
        title="Риск остановки сборки"
        subtitle="Узкое место: подача комплектующих"
      >
        <span className="source-chip">Модель</span>
      </PanelHeader>
      <div className="risk-split">
        <div>
          <strong className="risk-number">
            {stopped
              ? "Остановка"
              : risk.minutesToStop === null
                ? "Поток стабилен"
                : `${fmt(risk.minutesToStop, 0)} мин`}
          </strong>
          <p className="form-hint">
            {stopped
              ? "Линия требует вмешательства"
              : risk.minutesToStop === null
                ? "Подача покрывает расход"
                : "до исчерпания буфера при текущих потоках"}
          </p>
        </div>
        <div className="risk-score">
          <strong>{risk.score}</strong>
          <span>/100 · индекс риска</span>
        </div>
      </div>
      <ul className="risk-reasons">
        {risk.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      {risk.trend && !compact ? (
        <p className="chart-note">
          Тренд:{" "}
          {risk.trend.minutes === null
            ? "исчерпание не прогнозируется"
            : `${fmt(risk.trend.minutes)} мин`}{" "}
          · R² {fmt(risk.trend.rSquared, 2)} · {risk.trend.samples} точек
        </p>
      ) : null}
      <button className="button button-primary" onClick={onReplenish}>
        Пополнить буфер · +30
      </button>
      {!compact ? (
        <details className="ml-disclosure">
          <summary>
            Обученная модель буфера <span>синтетические смены</span>
          </summary>
          <div className="ml-result">
            {prediction.available ? (
              <>
                <strong>{fmt(prediction.probability * 100)}%</strong>
                <p>
                  Оценка исчерпания в следующие 60 минут.{" "}
                  {prediction.alert
                    ? "Порог предупреждения достигнут."
                    : "Ниже порога предупреждения."}
                </p>
              </>
            ) : (
              <p>{prediction.reason}</p>
            )}
            <p className="form-hint">
              Лес из 64 деревьев · полнота 90,2% · точность предупреждений 72,6%
              на синтетических данных. Качество на Allur не оценено.
            </p>
          </div>
        </details>
      ) : null}
    </section>
  );
}

export function ProcessMap({ lines, selected, onSelect, onDetail }) {
  return (
    <section className="panel">
      <PanelHeader
        title="Производственные участки"
        subtitle="Условная схема · выберите участок"
      >
        <span className="source-chip">4 участка</span>
      </PanelHeader>
      <div className="process-map">
        {lines.map((line, index) => (
          <button
            key={line.id}
            className={`process-stage ${line.status === "warning" ? "is-warning" : line.status === "stopped" ? "is-stopped" : ""} ${selected === line.id ? "is-selected" : ""}`}
            aria-pressed={selected === line.id}
            onClick={() => onSelect(line.id)}
          >
            <div className="stage-top">
              <span className="stage-number">0{index + 1}</span>
              <Icon
                name={
                  line.id === "paint"
                    ? "quality"
                    : line.id === "logistics"
                      ? "sources"
                      : "lines"
                }
                size={28}
              />
            </div>
            <strong>{names[line.id]}</strong>
            <span className="stage-rate">
              {fmt(line.throughput)} <small>ед./ч</small>
            </span>
            <Status status={line.status} />
          </button>
        ))}
      </div>
      <div className="scope-banner">
        <Icon name="arrow" size={17} />
        <span>
          Логистика → буфер комплектующих → сборка. Детальная связь в модели.
        </span>
      </div>
      <div className="map-selection">
        <span>{lines.find((line) => line.id === selected)?.equipment}</span>
        <button
          className="button button-secondary"
          onClick={() => onDetail(selected)}
        >
          Карточка участка <Icon name="arrow" size={16} />
        </button>
      </div>
    </section>
  );
}

export function IncidentList({
  incidents,
  state,
  engine,
  onAcknowledge,
  full = false,
}) {
  if (!incidents.length)
    return (
      <p className="empty-state">
        Нет активных отклонений в выбранном участке.
      </p>
    );
  return (
    <div className="incident-list">
      {incidents.map((item) => (
        <article
          className={`incident-row ${item.status === "resolved" ? "is-resolved" : ""}`}
          key={item.id}
        >
          <span
            className={`incident-severity ${item.severity}`}
            aria-hidden="true"
          />
          <div className="incident-body">
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <div className="incident-meta">
              <time>{engine.timeLabel(item.minute, state.shift)}</time>
              <span>{engine.ZONES[item.zone].name}</span>
              <span>
                {item.status === "resolved"
                  ? "Причина устранена"
                  : item.acknowledged
                    ? "Принят в работу"
                    : "Открыт"}
              </span>
            </div>
          </div>
          {full && item.status === "open" && !item.acknowledged ? (
            <button
              className="button button-secondary"
              onClick={() => onAcknowledge(item.id)}
            >
              Принять в работу
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function LineDialog({ line, engine, state, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (line && !dialog.open) dialog.showModal();
    if (!line && dialog.open) dialog.close();
  }, [line?.id]);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="line-dialog-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {line ? (
        <>
          <div className="dialog-header">
            <div>
              <p className="eyebrow">Условный участок</p>
              <h2 id="line-dialog-title">{line.name}</h2>
            </div>
            <button
              className="icon-button"
              aria-label="Закрыть карточку"
              onClick={onClose}
            >
              <Icon name="close" />
            </button>
          </div>
          <Status status={line.status} />
          <div className="two-column">
            <div className="metric-pair">
              <strong>{fmt(line.throughput)} ед./ч</strong>
              <span>текущий темп</span>
            </div>
            <div className="metric-pair">
              <strong>{fmt(line.downtimeMinutes)} мин</strong>
              <span>накопленный простой</span>
            </div>
          </div>
          <h3>Оборудование участка</h3>
          <ul className="equipment-list">
            {line.equipment.split(" · ").map((name) => (
              <li className="equipment-item" key={name}>
                <Icon name="lines" size={18} />
                {name}
              </li>
            ))}
          </ul>
          <p className="form-hint">
            Названия оборудования демонстрационные. Статус относится к линии;
            состояния отдельных агрегатов не измеряются.
          </p>
          <HistoryChart line={line} />
          <button className="button button-secondary" onClick={onClose}>
            Закрыть
          </button>
        </>
      ) : null}
    </dialog>
  );
}
