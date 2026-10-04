const money = (value) =>
  Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " ₸";
export default function CostEvaluation({
  assumptions,
  onChange,
  result,
  error,
}) {
  return (
    <div className="cost-evaluation">
      <h3>Экономика решения</h3>
      <p className="form-hint">
        Введите свои допущения. Стоимость простоя и доставки Allur не известна;
        по умолчанию поля пустые.
      </p>
      <div className="two-column">
        <div className="field">
          <label htmlFor="hourly-downtime-cost">
            Стоимость часа простоя, ₸
          </label>
          <input
            id="hourly-downtime-cost"
            type="number"
            min="0"
            max="1000000000"
            step="0.01"
            placeholder="Введите стоимость"
            value={assumptions.hourly}
            aria-invalid={Boolean(error)}
            aria-describedby="cost-help"
            onChange={(event) =>
              onChange((previous) => ({
                ...previous,
                hourly: event.target.value,
              }))
            }
          />
        </div>
        <div className="field">
          <label htmlFor="intervention-cost">
            Стоимость пополнения и доставки, ₸
          </label>
          <input
            id="intervention-cost"
            type="number"
            min="0"
            max="1000000000"
            step="0.01"
            placeholder="Введите стоимость"
            value={assumptions.action}
            aria-invalid={Boolean(error)}
            aria-describedby="cost-help"
            onChange={(event) =>
              onChange((previous) => ({
                ...previous,
                action: event.target.value,
              }))
            }
          />
        </div>
      </div>
      {error ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <div aria-live="polite" aria-atomic="true">
          <div className="three-column cost-metrics">
            <div className="metric-pair">
              <strong>{money(result.avoidedCost)}</strong>
              <span>предотвращённые затраты на простой</span>
            </div>
            <div className="metric-pair">
              <strong>{money(result.appliedInterventionCost)}</strong>
              <span>затраты на действие в горизонте</span>
            </div>
            <div
              className={`metric-pair ${result.netEffect >= 0 ? "cost-positive" : "cost-negative"}`}
            >
              <strong>{money(result.netEffect)}</strong>
              <span>
                условный баланс{" "}
                {result.netEffect < 0 ? "· затраты выше эффекта" : ""}
              </span>
            </div>
          </div>
          <p className="form-hint">
            {result.breakEvenHourlyCost === null
              ? "Предотвращённого простоя нет: порог окупаемости не рассчитывается."
              : `Действие окупается при стоимости часа простоя от ${money(result.breakEvenHourlyCost)}.`}{" "}
            {!result.interventionApplied
              ? "В конце горизонта действие не выполняется, плата за него не учитывается."
              : ""}
          </p>
        </div>
      ) : (
        <p className="info-note">
          Для расчёта заполните оба поля. Нулевая стоимость допустима, если это
          ваше допущение.
        </p>
      )}
      <p className="chart-note" id="cost-help">
        Баланс = предотвращённый простой / 60 × стоимость часа − стоимость
        действия. Маржа дополнительных автомобилей отдельно не прибавляется.
        Налоги, неопределённость и прочие затраты не учтены. Это расчёт
        сценария, а не измеренная экономия предприятия.
      </p>
    </div>
  );
}
