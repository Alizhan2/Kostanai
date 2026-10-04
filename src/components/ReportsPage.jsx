import { decisions } from "../lib/runtime.js";
import CostEvaluation from "./CostEvaluation.jsx";
import { useId, useMemo } from "react";
import {
  downloadJSON,
  exportCSV,
  exportReport,
  exportSnapshot,
  sourceLabel,
} from "../lib/exports.js";

const number = (value, digits = 1) =>
  Number(value).toLocaleString("ru-RU", { maximumFractionDigits: digits });
const statuses = {
  running: "В работе",
  warning: "Внимание",
  stopped: "Остановлена",
};

function ComparisonChart({ result }) {
  const max = Math.max(
    result.baseline.produced,
    result.intervention.produced,
    1,
  );
  const x = (minute) => 48 + (minute / result.horizonMinutes) * 504;
  const y = (output) => 155 - (output / max) * 120;
  const path = (key) =>
    result.series
      .map(
        (point, index) =>
          `${index ? "L" : "M"}${x(point.minute).toFixed(2)},${y(point[key]).toFixed(2)}`,
      )
      .join(" ");
  return (
    <figure className="chart">
      <svg
        viewBox="0 0 600 190"
        role="img"
        aria-label={`Накопленный выпуск за 120 минут. Без действий: ${number(result.baseline.produced)}. С пополнением: ${number(result.intervention.produced)} эквивалентных автомобилей.`}
      >
        <line
          x1="48"
          y1="155"
          x2="552"
          y2="155"
          stroke="currentColor"
          opacity=".2"
        />
        {[0, 60, 120].map((minute) => (
          <text
            key={minute}
            x={x(minute)}
            y="179"
            textAnchor="middle"
            fill="currentColor"
            fontSize="12"
          >
            {minute} мин
          </text>
        ))}
        <text x="38" y="158" textAnchor="end" fill="currentColor" fontSize="12">
          0
        </text>
        <text x="38" y="39" textAnchor="end" fill="currentColor" fontSize="12">
          {number(max, 0)}
        </text>
        <line
          x1={x(result.interventionAfterMinutes)}
          y1="25"
          x2={x(result.interventionAfterMinutes)}
          y2="155"
          stroke="currentColor"
          opacity=".4"
          strokeDasharray="4 4"
        />
        <path
          d={path("baselineOutput")}
          fill="none"
          stroke="#9297a6"
          strokeWidth="3"
          strokeDasharray="6 4"
        />
        <path
          d={path("interventionOutput")}
          fill="none"
          stroke="#cb2433"
          strokeWidth="3"
        />
      </svg>
      <figcaption className="chart-legend">
        <span>Пунктир — без действий</span>
        <span>Красная линия — с пополнением</span>
        <span>Вертикальная линия — время пополнения</span>
      </figcaption>
    </figure>
  );
}

export default function ReportsPage({
  state,
  engine,
  analysis,
  mlPrediction,
  interventionMinute,
  onInterventionChange,
  costAssumptions,
  onCostChange,
}) {
  const sliderId = useId();
  const helpId = useId();
  const result = useMemo(
    () => analysis?.compare(interventionMinute),
    [analysis, interventionMinute],
  );
  const financial = useMemo(() => {
    if (
      !result ||
      costAssumptions.hourly.trim() === "" ||
      costAssumptions.action.trim() === ""
    )
      return { value: null, error: "" };
    try {
      return {
        value: decisions.economicEffect(result, {
          downtimeCostPerHour: Number(costAssumptions.hourly),
          interventionCost: Number(costAssumptions.action),
        }),
        error: "",
      };
    } catch (error) {
      return { value: null, error: error.message };
    }
  }, [result, costAssumptions.hourly, costAssumptions.action]);
  const metrics = engine.metrics(state);
  const risk = engine.riskFor(
    state.lines.find((line) => line.id === "assembly"),
  );
  const aps = globalThis.PlantAPSSummary;
  const timing =
    interventionMinute <= 45
      ? "Пополнение до исчерпания буфера предотвращает простой."
      : interventionMinute === 120
        ? "Пополнение в конце горизонта не меняет результат этих двух часов."
        : `До пополнения линия простаивает ${interventionMinute - 45} минут. Этот простой уже не вернуть.`;

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Отчёт за текущую смену</h2>
            <p className="panel-subtitle">
              Срез на {engine.timeLabel(state.elapsedMinutes, state.shift)} ·{" "}
              {sourceLabel(state)}
            </p>
          </div>
        </div>
        <div className="three-column">
          <div className="metric-pair">
            <strong>
              {number(metrics.produced, 0)} / {number(metrics.plan, 0)}
            </strong>
            <span>выпуск / план, автомобилей</span>
          </div>
          <div className="metric-pair">
            <strong>{number(metrics.availability)}%</strong>
            <span>доступность оборудования</span>
          </div>
          <div className="metric-pair">
            <strong>{number(metrics.quality)}%</strong>
            <span>первичное качество</span>
          </div>
        </div>
        <p>
          Загрузка {number(metrics.load)}% · простой {number(metrics.downtime)}{" "}
          машино-мин · активных инцидентов {metrics.openIncidents}
        </p>
        <details>
          <summary>Прогноз финальной сборки</summary>
          <p>
            Индекс риска {risk.score}/100.{" "}
            {risk.minutesToStop === null
              ? "Исчерпание буфера не прогнозируется."
              : `До исчерпания буфера ${number(risk.minutesToStop)} мин.`}
          </p>
          <p>
            {mlPrediction?.available
              ? `ML-оценка исчерпания: ${number(mlPrediction.probability * 100)}% в ближайшие 60 минут. ${mlPrediction.alert ? "Порог предупреждения достигнут." : "Ниже порога предупреждения."}`
              : mlPrediction?.reason || "ML-оценка недоступна."}
          </p>
          <p className="form-hint">
            ML-модель обучена на синтетических сменах. Оценка не является
            подтверждённой вероятностью простоя Allur.
          </p>
        </details>
        <div className="field-grid">
          <button
            className="button button-primary"
            onClick={() => exportCSV(state, engine)}
          >
            Скачать CSV
          </button>
          <button
            className="button button-secondary"
            onClick={() => exportReport(state, engine, mlPrediction)}
          >
            Отчёт TXT
          </button>
          <button
            className="button button-secondary"
            onClick={() => window.print()}
          >
            Печать / PDF
          </button>
          <button
            className="button button-secondary"
            onClick={() => exportSnapshot(state, engine)}
          >
            Снимок JSON
          </button>
        </div>
      </section>
      {result ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Что будет, если пополнить буфер?</h2>
              <p className="panel-subtitle">
                Два сценария задержки комплектующих · горизонт 120 минут
              </p>
            </div>
          </div>
          <p>
            Одинаковый старт: 12 комплектов, расход 20 в час, подача 4 в час. В
            выбранный момент добавляем 30 комплектов и восстанавливаем подачу до
            21 в час.
          </p>
          <div className="comparison-control">
            <label htmlFor={sliderId}>
              Пополнить через{" "}
              <output htmlFor={sliderId}>{interventionMinute}</output> мин
            </label>
            <input
              id={sliderId}
              type="range"
              min="0"
              max="120"
              step="5"
              value={interventionMinute}
              onChange={(event) =>
                onInterventionChange(Number(event.target.value))
              }
              aria-valuetext={`Через ${interventionMinute} минут`}
              aria-describedby={helpId}
            />
            <div className="chart-legend">
              <span>Сейчас</span>
              <span>Через 2 часа</span>
            </div>
          </div>
          <div aria-live="polite" aria-atomic="true">
            <p>{timing}</p>
            <div className="comparison-gains">
              <div>
                <strong>{number(result.avoidedDowntimeMinutes, 0)} мин</strong>
                <span>предотвращённого простоя</span>
              </div>
              <div>
                <strong>+{number(result.additionalOutput)}</strong>
                <span>эквивалентных авто за 2 часа</span>
              </div>
            </div>
          </div>
          <ComparisonChart result={result} />
          <div className="table-wrap">
            <table className="line-table">
              <caption>
                Дополнительный выпуск и простой за следующие 120 минут
              </caption>
              <thead>
                <tr>
                  <th scope="col">Сценарий</th>
                  <th scope="col">Выпуск, экв. авто</th>
                  <th scope="col">Простой, мин</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Без действий</th>
                  <td>{number(result.baseline.produced)}</td>
                  <td>{number(result.baseline.downtimeMinutes, 0)}</td>
                </tr>
                <tr>
                  <th scope="row">Пополнение через {interventionMinute} мин</th>
                  <td>{number(result.intervention.produced)}</td>
                  <td>{number(result.intervention.downtimeMinutes, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <CostEvaluation
            assumptions={costAssumptions}
            onChange={onCostChange}
            result={financial.value}
            error={financial.error}
          />
          <p className="chart-note" id={helpId}>
            Независимый синтетический эксперимент. Ползунок не меняет текущую
            смену. Эффект на Allur не измерялся; дробный выпуск — расчётный
            эквивалент.
          </p>
          <button
            className="button button-secondary"
            onClick={() =>
              downloadJSON("scenario-comparison.json", {
                ...result,
                economicEvaluation: financial.value,
              })
            }
          >
            Скачать сравнение JSON
          </button>
        </section>
      ) : null}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Производственные линии</h2>
            <p className="panel-subtitle">Показатели текущей смены</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="line-table">
            <thead>
              <tr>
                <th scope="col">Линия</th>
                <th scope="col">Выпуск, экв. ед.</th>
                <th scope="col">Темп, ед./ч</th>
                <th scope="col">Загрузка</th>
                <th scope="col">Простой, мин</th>
                <th scope="col">Статус</th>
              </tr>
            </thead>
            <tbody>
              {state.lines.map((line) => (
                <tr key={line.id}>
                  <th scope="row">{line.line}</th>
                  <td>{number(line.produced)}</td>
                  <td>{number(line.throughput)}</td>
                  <td>{number((line.throughput / line.capacity) * 100)}%</td>
                  <td>{number(line.downtimeMinutes)}</td>
                  <td>{statuses[line.status] || line.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Журнал действий оператора</h2>
            <p className="panel-subtitle">Текущая демонстрационная сессия</p>
          </div>
        </div>
        {state.actions.length ? (
          <ol className="timeline">
            {state.actions.map((action, index) => (
              <li key={`${action.minute}-${index}`}>
                <time>{engine.timeLabel(action.minute, state.shift)}</time>
                <span>{action.text}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-state">
            Действий пока нет. Запустите сценарий или вмешайтесь в работу линии.
          </p>
        )}
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Диагностика Scania APS</h2>
            <p className="panel-subtitle">
              Отдельная задача на публичных эксплуатационных данных
            </p>
          </div>
        </div>
        <p>
          Модель различает неисправность пневмосистемы APS и неисправность
          другого компонента грузовика.
        </p>
        {aps ? (
          <p>
            Проверочная выборка: {number(aps.evaluation.rows, 0)} записей ·
            полнота {number(aps.evaluation.recall * 100)}% · точность
            предупреждений {number(aps.evaluation.precision * 100)}%.
          </p>
        ) : null}
        <p className="info-note">
          Эти показатели не относятся к оборудованию Allur, запасу комплектующих
          или прогнозу остановки сборки.
        </p>
        <div className="field-grid">
          <a className="button button-primary" href="docs/aps-demo.html">
            Открыть диагностику
          </a>
          <a
            className="button button-secondary"
            href="ml/results/aps/evaluation.png"
          >
            Графики оценки
          </a>
        </div>
      </section>
    </div>
  );
}
