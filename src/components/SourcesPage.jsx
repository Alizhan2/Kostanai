import allurData from "../../data/allur-public.json";
import { PanelHeader } from "./PlantViews.jsx";
import { downloadJSON } from "../lib/exports.js";

export default function SourcesPage() {
  return (
    <div className="stack">
      <section className="panel hero-factory">
        <p className="eyebrow">Allur · контекст проекта</p>
        <h2>Проверяемые сведения и прозрачные границы данных</h2>
        <p>
          Открытые сведения о предприятии, показатели симуляции и
          диагностический набор Scania относятся к разным источникам. Они
          показаны отдельно.
        </p>
        <div className="source-chip">Без подключения к телеметрии Allur</div>
      </section>
      <section className="panel">
        <PanelHeader
          title="Подтверждено в официальном кейсе"
          subtitle="Конкурсный контекст, не производственная статистика"
        />
        <div className="two-column">
          {allurData.facts.map((fact) => (
            <article className="fact-card" key={fact.id}>
              <p className="eyebrow">
                {fact.category === "event_context" ? "Событие" : "Задание"}
              </p>
              <h3>{fact.label}</h3>
              <p className="fact-value">
                {Array.isArray(fact.value)
                  ? fact.value.join(" · ")
                  : fact.id === "demo-day"
                    ? "16 октября 2026"
                    : fact.value}
              </p>
              <p className="form-hint">
                Период: {fact.period}. Дата публикации в тексте не указана.
              </p>
              {fact.limitation ? (
                <p className="form-hint">{fact.limitation}</p>
              ) : null}
              <a
                className="source-link"
                href={fact.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Открыть первоисточник ↗
              </a>
            </article>
          ))}
        </div>
      </section>
      <section className="panel">
        <PanelHeader
          title="Производственные сведения Allur"
          subtitle="Неподтверждённые показатели не используются в модели"
        />
        <div className="three-column">
          {["Годовой выпуск", "Мощность завода", "Штат предприятия"].map(
            (label) => (
              <div className="fact-card" key={label}>
                <span>{label}</span>
                <strong className="kpi-value">—</strong>
                <p className="form-hint">
                  Проверенный источник с датой ещё не добавлен.
                </p>
              </div>
            ),
          )}
        </div>
        <p className="info-note">
          Доступ к страницам Allur при проверке источников был ограничен.
          Годовые объёмы, бренды, адрес завода, официальный логотип и фирменная
          палитра не подтверждены. Вместо них используются явно обозначенные
          демонстрационные параметры.
        </p>
        <p>
          Адрес Demo Day из кейса относится к мероприятию. Его нельзя считать
          адресом завода.
        </p>
        <div className="field-grid">
          <a
            className="button button-secondary"
            href="https://allur.kz/"
            target="_blank"
            rel="noreferrer"
          >
            Открыть сайт Allur ↗
          </a>
          <button
            className="button button-secondary"
            onClick={() => downloadJSON("allur-public-sources.json", allurData)}
          >
            Скачать каталог источников
          </button>
        </div>
      </section>
      <section className="panel">
        <PanelHeader
          title="Как читаются данные проекта"
          subtitle="Происхождение определяет смысл показателя"
        />
        <div className="three-column">
          <div className="fact-card">
            <h3>Симуляция завода</h3>
            <p>
              Буферы, темпы, простои и качество сгенерированы. Используются для
              сценария подачи и сборки, а не для заявления о работе Allur.
            </p>
          </div>
          <div className="fact-card">
            <h3>Публичный контекст</h3>
            <p>
              Официальный кейс определяет организатора и задачу. Корпоративные
              показатели с сайта потребуют отдельного источника и периода.
            </p>
          </div>
          <div className="fact-card">
            <h3>Scania APS</h3>
            <p>
              Реальные открытые измерения грузовиков для классификации
              компонента неисправности. Это отдельная диагностика.
            </p>
          </div>
        </div>
        <p className="form-hint">
          Оформление интерфейса авторское. Надпись Allur Plant Twin обозначает
          хакатонный прототип; официальный логотип и статус продукта Allur не
          заявляются.
        </p>
      </section>
    </div>
  );
}
