(function () {
  'use strict';
  const E = window.PlantEngine;
  const fmt = (n, p = 1) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: p });
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const titles = {
    overview:['Цифровой двойник завода','Наблюдайте за линиями и предупреждайте остановки'],
    lines:['Производственные линии','Состояние оборудования, загрузка и выпуск по участкам'],
    incidents:['Остановки и инциденты','Примите отклонение в работу и устраните его причину'],
    quality:['Качество продукции','Выход годных операций с первого прохода по каждому участку'],
    reports:['Отчёты и аналитика','Результаты смены, прогнозы и журнал действий оператора'],
    settings:['Данные и настройки','Импорт снимка производства и описание расчётов']
  };
  let page = 'overview', filter = 'all', selectedZone = 'body', speed = 1;
  let state = E.createState('shortage');
  try {
    const saved = JSON.parse(localStorage.getItem('allur-twin-v1'));
    if (saved) {
      state = E.validateImport(saved.snapshot);
      state.source = saved.source === 'synthetic' ? 'synthetic' : 'imported';
    }
  } catch (_) { /* Storage may be disabled; the application still works. */ }
  let toastTimer;
  const $ = id => document.getElementById(id);
  function notify(message) {
    $('toast').textContent = message; $('toast').classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3500);
  }
  function save() {
    try { localStorage.setItem('allur-twin-v1', JSON.stringify({snapshot:E.exportSnapshot(state),source:state.source})); } catch (_) {}
  }
  const sourceText = () => state.source === 'synthetic' ? 'Данные синтетические · схема условная' : 'Импортированный снимок · продолжение моделируется';
  const statusText = status => ({ running:'В норме', warning:'Внимание', stopped:'Остановлена' }[status]);
  const statusClass = status => ({ running:'st-ok', warning:'st-warn', stopped:'st-bad' }[status]);
  const dotClass = status => ({ running:'ok', warning:'warn', stopped:'bad' }[status]);
  function badge(status, label = statusText(status)) {
    return '<span class="state '+statusClass(status)+'"><i class="status-dot '+dotClass(status)+'" aria-hidden="true"></i>'+esc(label)+'</span>';
  }
  const lines = () => filter === 'all' ? state.lines : state.lines.filter(l => l.id === filter);
  const activeIncidents = () => state.incidents.filter(i => i.status === 'open' && (filter === 'all' || i.zone === filter));
  function header(title, sub, extra = '') {
    return '<div class="section-head"><div><h2>'+title+'</h2><p>'+sub+'</p></div>'+extra+'</div>';
  }
  function kpis() {
    const m = E.metrics(state, filter);
    const outputLabel = filter === 'all' || filter === 'assembly' ? 'Выпуск за смену' : 'Обработано единиц';
    return '<section class="kpis">'+[
      [outputLabel,fmt(m.produced,0)+(filter === 'all' || filter === 'assembly' ? ' авто' : ' ед.'), 'План: '+fmt(m.plan,0)+' · '+fmt(m.planPercent)+'%'],
      ['Загрузка линий',fmt(m.load)+'%', 'Темп / мощность'],
      ['Доступность',fmt(m.availability)+'%', 'Простой: '+fmt(m.downtime)+' машино-мин'],
      ['Первичное качество',fmt(m.quality)+'%', 'Годные / обработано']
    ].map(x=>'<article class="card kpi"><div class="kpi-top">'+x[0]+'</div><div class="kpi-val">'+x[1]+'</div><div class="kpi-foot">'+x[2]+'</div></article>').join('')+'</section>';
  }
  function mapCard() {
    const zone = state.lines.find(l=>l.id===selectedZone);
    const shortNames={body:'Кузовной',paint:'Окраска',assembly:'Сборка',logistics:'Логистика'};
    return '<section class="card section-card map-card">'+header('Карта производственных участков','Условная схема · выберите участок')+
      '<div class="factory-map"><div class="map-zones">'+state.lines.map(l=>
      '<button class="building '+(l.id===selectedZone?'selected':'')+'" data-zone="'+l.id+'" aria-label="'+esc(l.name)+': '+statusText(l.status)+'" aria-pressed="'+(l.id===selectedZone)+'"><span class="btitle"><span class="desktop-zone-name">'+esc(l.name)+'</span><span class="mobile-zone-name">'+shortNames[l.id]+'</span></span><small>'+fmt(l.throughput)+' ед./ч</small>'+badge(l.status)+'</button>').join('')+
      '</div><div class="map-legend"><span><i class="ok"></i>В норме</span><span><i class="warn"></i>Внимание</span><span><i class="bad"></i>Остановка</span></div></div><p class="map-note">Сборка зависит от подачи комплектующих из логистики.</p><button class="subtle-btn map-detail" data-detail="'+zone.id+'">Оборудование · '+esc(zone.name)+' →</button></section>';
  }
  function incidentRows(list, full = false) {
    if (!list.length) return '<div class="empty">✓ Активных инцидентов нет<br>Участки работают в текущем режиме</div>';
    return '<div class="incidents">'+list.map(i=>'<article class="incident"><div class="incident-title"><i class="incident-dot '+(i.status==='resolved'?'ok':i.severity==='critical'?'bad':'warn')+'" aria-hidden="true"></i><b>'+esc(i.title)+'</b></div><p>'+esc(E.ZONES[i.zone].name)+' · '+esc(i.description)+'</p><p class="incident-time"><time>'+E.timeLabel(i.minute,state.shift)+'</time> · '+(i.status==='resolved'?'Устранён в '+E.timeLabel(i.resolvedMinute,state.shift):i.acknowledged?'Принят в работу':'Ожидает реакции')+'</p>'+(full&&i.status==='open'&&!i.acknowledged?'<button class="control-btn" data-ack="'+i.id+'">Принять в работу</button>':'')+'</article>').join('')+'</div>';
  }
  function mlPrediction() {
    const line=state.lines.find(l=>l.id==='assembly');
    return window.PlantML
      ? window.PlantML.predict(line,window.PlantRiskModel,state.source)
      : {available:false,reason:'Модуль ML-прогноза не загружен.'};
  }
  function mlCard() {
    const result=mlPrediction(), model=window.PlantRiskModel;
    if(!result.available)return '<div class="ml-card"><span class="ml-label">Обученная модель · демо</span><p class="ml-unavailable">'+esc(result.reason)+'</p></div>';
    return '<div class="ml-card"><span class="ml-label">Обученная модель · демо</span><div class="ml-value">'+fmt(result.probability*100)+'% <span class="ml-decision '+(result.alert?'ml-alert':'')+'">'+(result.alert?'Предупреждение':'Ниже порога')+'</span></div><p>ML-оценка исчерпания буфера в ближайшие '+result.horizonMinutes+' минут без пополнения оператором.</p><div class="ml-meta">Лес из '+model.trees.length+' деревьев · порог предупреждения '+fmt(result.threshold*100)+'%<br>Обучение: '+model.trainingEpisodes+' синтетических смен · '+fmt(model.trainingRows,0)+' наблюдений</div><details class="ml-explanation"><summary>Как читать эту оценку</summary><p>Вероятность откалибрована на синтетических сменах с меняющейся подачей. Она относится к условиям генератора данных. Это не подтверждённая вероятность простоя Allur и не прогноз поломки оборудования.</p><p>В оценку входят запас, расход, подача и изменения буфера по последним '+result.historyPoints+' точкам. После пополнения нужна новая история.</p></details></div>';
  }
  function riskCard() {
    const a = state.lines.find(l=>l.id==='assembly'), r=E.riskFor(a);
    const label = r.minutesToStop===0 ? 'Сборка остановлена: буфер исчерпан.' : r.minutesToStop!==null
      ? 'При текущем потоке деталей буфер исчерпается примерно через '+fmt(r.minutesToStop)+' мин.' : 'Текущая подача покрывает потребность сборки. Исчерпание буфера не прогнозируется.';
    const model = r.trend && r.trend.minutes!==null ? 'Линейный тренд буфера: '+fmt(r.trend.minutes)+' мин до исчерпания · R² '+fmt(r.trend.rSquared,2)+' · '+r.trend.samples+' точек.'
      : 'Для независимой оценки тренда нужны минимум 3 точки изменения буфера.';
    const horizon = r.minutesToStop===0 ? 'Сборка остановлена' : r.minutesToStop!==null
      ? fmt(r.minutesToStop)+' мин до исчерпания буфера' : 'Подача покрывает расход';
    return '<section class="risk-box" aria-label="Прогноз остановки сборки"><div class="risk-top"><b>Риск остановки</b><span class="risk-badge '+(r.score>=70?'high':r.score<35?'low':'')+'">'+r.level+' · '+r.score+'/100</span></div><h3>'+horizon+'</h3><p>'+label+'</p><div class="risk-evidence"><span>Буфер: '+fmt(a.buffer)+' комплектов</span><span>Расход: '+fmt(a.demandPerHour)+'/ч · подача: '+fmt(a.replenishmentPerHour)+'/ч</span><span>Дефицит: '+fmt(Math.max(0,a.demandPerHour-a.replenishmentPerHour))+' комплектов/ч</span></div><details class="forecast-details"><summary>Обоснование прогноза</summary><ul>'+r.reasons.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul><p>'+model+'</p></details><div class="forecast-meta">Индекс по правилам, не вероятность отказа. Данные демонстрационные.</div>'+mlCard()+ (r.minutesToStop!==null?'<button class="primary-btn" data-action="replenish">Пополнить буфер · +30</button>':'<div class="recommend">✓ Подача деталей покрывает расход</div>')+'</section>';
  }
  function chart(line, key = 'throughput') {
    const h = line.history;
    if(h.length < 2) return '<div class="empty">История пока содержит одну точку.<br>Продвиньте модельное время для построения графика.</div>';
    const max=Math.max(...h.map(x=>x[key]),key==='throughput'?line.capacity:1)*1.15;
    const lo=h[0].minute, span=Math.max(1,h[h.length-1].minute-lo);
    const pts=h.map(x=>[(x.minute-lo)/span*600,130-x[key]/max*115]);
    const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' ');
    const planY=130-line.capacity/max*115;
    return '<div class="chart"><svg role="img" aria-label="История '+(key==='buffer'?'буфера комплектующих':'производительности')+'" viewBox="0 0 600 140" preserveAspectRatio="none"><path d="'+d+' L600 140 L0 140 Z" fill="#cbf36b" opacity=".20"/><path d="'+d+'" fill="none" stroke="#86ad33" stroke-width="2.5" vector-effect="non-scaling-stroke"/>'+ (key==='throughput'?'<path d="M0 '+planY+' L600 '+planY+'" stroke="#b5bec8" stroke-dasharray="5 5" stroke-width="1.5" vector-effect="non-scaling-stroke"/>':'')+'</svg></div><div class="axis"><span>'+E.timeLabel(lo,state.shift)+'</span><span>'+(key==='throughput'?'Последнее: '+fmt(line.throughput)+' ед./ч':'Буфер: '+fmt(line.buffer)+' компл.')+'</span><span>'+E.timeLabel(h[h.length-1].minute,state.shift)+'</span></div>';
  }
  function lineTable(full = false) {
    return '<div class="'+(full?'full-table':'')+'"><table class="line-table"><thead><tr><th>Линия</th><th>Загрузка</th>'+(full?'<th>Выпуск, ед.</th><th>Темп, ед./ч</th><th>Простой, мин</th>':'')+'<th>Статус</th></tr></thead><tbody>'+lines().map(l=>{
      const load=E.round(l.throughput/l.capacity*100);
      return '<tr><td><button data-detail="'+l.id+'">'+esc(l.line)+'</button></td><td>'+fmt(load)+'%</td>'+(full?'<td>'+fmt(Math.floor(l.produced),0)+'</td><td>'+fmt(l.throughput)+'</td><td>'+fmt(l.downtimeMinutes)+'</td>':'')+'<td>'+badge(l.status)+'</td></tr>';
    }).join('')+'</tbody><caption>Загрузка = текущий темп / мощность. Выпуск завода считается по финальной сборке; операции разных цехов не суммируются.</caption></table></div>';
  }
  function overview() {
    const plotLine=state.lines.find(l=>l.id===(filter==='all'?'assembly':filter));
    const assembly=state.lines.find(l=>l.id==='assembly');
    return kpis()+'<div class="body-grid">'+mapCard()+'<div class="right-col"><section class="card section-card incident-card">'+header('Инциденты и отклонения',activeIncidents().length+' событий требуют реакции','<button class="subtle-btn" data-page="incidents">Все →</button>')+incidentRows(activeIncidents().slice(0,3))+'</section>'+riskCard()+'</div></div><div class="bottom-grid"><section class="card section-card">'+header('Производительность · '+esc(plotLine.line),'Единиц в час · фактический темп и мощность')+chart(plotLine)+'<p class="chart-note">Мощность: '+fmt(plotLine.capacity)+' ед./ч · выпуск за смену: '+fmt(Math.floor(plotLine.produced),0)+' ед.</p></section><section class="card section-card">'+header('Динамика буфера сборки','Комплекты · история текущей смены')+chart(assembly,'buffer')+'<p class="chart-note">История обновляется после шага модели и вмешательства оператора.</p></section></div><section class="card section-card overview-table">'+header('Состояние производственных линий','Показатели текущей смены','<button class="subtle-btn" data-page="lines">Подробнее →</button>')+lineTable(true)+'</section>';
  }
  function linesPage() {
    return kpis()+'<div class="page-stack"><section class="card section-card">'+header('Оборудование и выпуск','Выберите линию для подробных показателей')+lineTable(true)+'</section><div class="view-grid">'+lines().map(l=>'<section class="card section-card">'+header(esc(l.line),esc(l.equipment),'<span class="state '+statusClass(l.status)+'">'+statusText(l.status)+'</span>')+chart(l)+'</section>').join('')+'</div></div>';
  }
  function incidentsPage() {
    const selected=state.incidents.filter(i=>filter==='all'||i.zone===filter);
    return '<div class="view-grid"><section class="card section-card">'+header('Журнал инцидентов',selected.length+' событий · отметка в журнале не устраняет причину')+incidentRows(selected,true)+'</section><section class="card section-card">'+header('Решение оператора','Сначала устраните причину отклонения')+riskCard()+ (selected.some(i=>i.type==='quality'&&i.status==='open')?'<div class="tip">Проверьте фильтр F-08 и параметры окрасочной камеры.<div class="report-actions"><button class="primary-btn" data-action="repair-quality">Скорректировать параметры окраски</button></div></div>':'')+'<div class="tip">Симуляция: один шаг — 5 минут. При дефиците потока буфер сборки уменьшается до остановки. Пополнение восстанавливает подачу и движение линии.</div></section></div>';
  }
  function qualityPage() {
    return '<div class="page-stack"><div class="view-grid">'+lines().map(l=>{
      const quality=100*(1-l.defects/Math.max(1,l.produced));
      return '<section class="card section-card quality-card '+(quality<97?'quality-attention':'')+'"><h2>'+esc(l.name)+'</h2><div class="detail-value">'+fmt(quality)+'%</div><p class="detail-sub">'+fmt(Math.floor(l.produced),0)+' обработанных ед. · '+(l.defects>0?'дефекты: '+fmt(l.defects)+' эквивалентных ед.':'дефектов нет')+'</p>'+(quality<97?badge('warning','Ниже порога 97%'):'')+(l.id==='paint'&&state.scenario==='quality'?'<div class="report-actions"><button class="primary-btn" data-action="repair-quality">Скорректировать параметры</button></div>':'')+'</section>';
    }).join('')+'</div><section class="card section-card">'+header('Как считаем качество','Показатель каждой производственной операции')+'<p class="setting-text">Качество = годные операции / все обработанные операции. Контрольный порог — 97%. В модели дефекты могут быть дробными: это ожидаемый объём брака.</p><p class="detail-sub">После корректировки параметров улучшаются новые операции; история дефектов сохраняется.</p><div class="report-actions"><button class="primary-btn" data-action="quality-scenario">Сценарий дефектов окраски</button></div></section></div>';
  }
  function diagnosticsCard() {
    const data=window.PlantAPSSummary;
    if(!data)return '';
    const score=data.evaluation;
    return '<section class="card section-card">'+header('Диагностика Scania APS','Открытые эксплуатационные данные грузовиков')+
      '<div class="setting-text"><p>Отдельная модель различает неисправность пневмосистемы APS и неисправность другого компонента. Оценка выполнена на '+fmt(score.rows,0)+' исходных записях Scania.</p><div class="risk-evidence"><span>Полнота: '+fmt(score.recall*100)+'%</span><span>Точность предупреждений: '+fmt(score.precision*100)+'%</span><span>Ложные предупреждения: '+fmt(score.confusion_matrix[0][1],0)+'</span></div><p>Порог учитывает высокую стоимость пропуска. Эти показатели не относятся к оборудованию Allur или запасу комплектующих.</p></div><div class="report-actions"><a class="primary-btn" style="display:inline-flex;text-decoration:none" href="docs/aps-demo.html">Открыть диагностику</a><a class="control-btn" style="display:inline-flex;text-decoration:none" href="ml/results/aps/evaluation.png">Графики оценки</a></div></section>';
  }
  function reportsPage() {
    const m=E.metrics(state,filter),r=E.riskFor(state.lines.find(l=>l.id==='assembly'));
    return '<div class="page-stack"><section class="card section-card">'+header('Отчёт за текущую смену','Срез на '+E.timeLabel(state.elapsedMinutes,state.shift)+' · '+(filter==='all'?'весь завод':esc(E.ZONES[filter].name)))+'<p class="report-total">'+fmt(m.produced,0)+(filter==='all'?' автомобилей':' ед.')+' из '+fmt(m.plan,0)+' по плану</p><p class="report-summary">Загрузка: '+fmt(m.load)+'% · доступность: '+fmt(m.availability)+'% · первичное качество: '+fmt(m.quality)+'%<br>Простой оборудования: '+fmt(m.downtime)+' машино-мин · активные инциденты: '+m.openIncidents+'</p><details class="report-forecast"><summary>Прогноз финальной сборки</summary><p class="detail-sub">Риск: '+r.score+'/100'+(r.minutesToStop!==null?' · до исчерпания буфера '+fmt(r.minutesToStop)+' мин.':'; подача покрывает расход.')+'</p>'+mlCard()+'</details><div class="report-actions"><button class="primary-btn" data-export="csv">Скачать CSV</button><button class="control-btn" data-export="report">Отчёт .txt</button><button class="control-btn" data-action="print">Печать / PDF</button></div></section><section class="card section-card">'+header('Состояние производственных линий','Показатели текущей смены')+lineTable(true)+'</section><section class="card section-card">'+header('Журнал действий оператора','Текущая демонстрационная сессия')+(state.actions.length?'<ul class="timeline">'+state.actions.map(a=>'<li><time>'+E.timeLabel(a.minute,state.shift)+'</time>'+esc(a.text)+'</li>').join('')+'</ul>':'<div class="empty">Действий пока нет. Запустите сценарий или вмешайтесь в работу линии.</div>')+'</section>'+diagnosticsCard()+'</div>';
  }
  function settingsPage() {
    return '<div class="view-grid"><section class="card section-card">'+header('Источник данных','Снимок производства в формате JSON')+'<div class="setting-text"><p>Текущий источник: <b>'+(state.source==='synthetic'?'синтетическая модель':'импортированный снимок')+'</b>. Для демонстрации используйте готовый пример или загрузите снимок по описанной схеме.</p><p>Файл должен содержать четыре линии: <code>body</code>, <code>paint</code>, <code>assembly</code>, <code>logistics</code>. Все значения проверяются перед заменой данных. Максимальный размер — 1 МБ.</p></div><div class="report-actions"><label class="file-label">Загрузить JSON<input id="importFile" type="file" accept=".json,application/json" class="visually-hidden"></label><button class="control-btn" data-export="snapshot">Экспорт снимка</button><button class="control-btn" data-export="sample">Скачать пример</button></div><div id="importError" class="validation-error" role="alert"></div><div class="tip">Снимок сохраняется в этом браузере. После перезагрузки симуляция на паузе; история графиков и журнал начинают новую сессию. Кнопка «Сбросить» создаёт новую синтетическую смену.</div></section><section class="card section-card">'+header('Методика прогнозирования','Прозрачные расчёты, которые можно объяснить на защите')+'<div class="setting-text"><ul><li><b>До остановки:</b> буфер / (расход − подача) × 60 минут. При достаточной подаче остановка не прогнозируется.</li><li><b>Линейный тренд:</b> регрессия по последним 8 точкам буфера, минимум 3. После пополнения начинается новый ряд. R² показывает соответствие прямой наблюдаемым точкам.</li><li><b>Индекс риска:</b> 90/100 при горизонте ≤30 мин, 75 при ≤60, 55 при ≤120, 25 при большем дефиците и 8 при достаточной подаче. Остановленная сборка — 100.</li><li><b>Доступность:</b> 1 − суммарный простой / суммарное время наблюдения линий.</li></ul><p>Лес из 64 деревьев оценивает исчерпание буфера в ближайшие 60 минут. Он обучен на синтетических сменах с меняющейся подачей; калибровка и порог выбираются на отдельных сменах. На импортированных снимках ML-прогноз недоступен до обучения и оценки на данных предприятия. Поломки оборудования не входят в цель этой модели.</p></div></section></div>';
  }
  function render() {
    // Preserve operator disclosures and keyboard focus across simulation updates.
    const content=$('content'), focused=document.activeElement;
    const openDetails=new Set([...content.querySelectorAll('details[open]')].map(n=>n.className));
    const focusKey=content.contains(focused) ? {
      data:Object.entries(focused.dataset), tag:focused.tagName,
      disclosure:focused.tagName==='SUMMARY' ? focused.parentElement.className : null
    } : null;
    $('pageTitle').textContent=titles[page][0]; $('pageSubtitle').textContent=titles[page][1];
    $('breadcrumb').textContent=page==='overview'?'Обзор завода':titles[page][0];
    document.querySelectorAll('.nav button[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);if(b.dataset.page===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
    $('mobilePage').value=page;
    $('shift').value=state.shift; $('scenario').value=state.scenario;
    $('simulationClock').textContent='Модель · '+E.timeLabel(state.elapsedMinutes,state.shift);
    $('liveStatus').textContent=state.running?'Симуляция работает':state.elapsedMinutes>=720?'Смена завершена':'Симуляция на паузе';
    $('play').textContent=state.running?'Пауза':'Запустить';
    $('play').setAttribute('aria-pressed',String(state.running));
    $('play').disabled=state.elapsedMinutes>=720; $('step').disabled=state.elapsedMinutes>=720;
    $('dataSource').textContent=sourceText();
    document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('sel',b.dataset.filter===filter);b.setAttribute('aria-pressed',String(b.dataset.filter===filter))});
    const views={overview,lines:linesPage,incidents:incidentsPage,quality:qualityPage,reports:reportsPage,settings:settingsPage};
    $('content').innerHTML=(filter!=='all'?'<p class="filter-note">Выбран участок: '+esc(E.ZONES[filter].name)+'. Прогноз сборки учитывает общую цепочку поставки.</p>':'')+views[page]();
    content.querySelectorAll('details').forEach(n=>{n.open=openDetails.has(n.className);});
    if(focusKey) {
      const replacement=focusKey.disclosure
        ? [...content.querySelectorAll('details')].find(n=>n.className===focusKey.disclosure)?.querySelector('summary')
        : [...content.querySelectorAll('button')].find(n=>focusKey.tag==='BUTTON' && focusKey.data.length && focusKey.data.every(([key,value])=>n.dataset[key]===value));
      if(replacement) replacement.focus({preventScroll:true});
    }
    const input=$('importFile'); if(input) input.addEventListener('change',importFile);
    save();
  }
  function detail(id) {
    const l=state.lines.find(l=>l.id===id),m=E.metrics(state,id);
    $('detailContent').innerHTML='<h2>'+esc(l.name)+'</h2><p class="detail-sub">'+esc(l.equipment)+'</p><dl><dt>Статус</dt><dd>'+statusText(l.status)+'</dd><dt>Мощность</dt><dd>'+fmt(l.capacity)+' ед./ч</dd><dt>Текущий темп</dt><dd>'+fmt(l.throughput)+' ед./ч</dd><dt>Выпуск за смену</dt><dd>'+fmt(Math.floor(l.produced),0)+' ед.</dd><dt>Доступность</dt><dd>'+fmt(m.availability)+'%</dd><dt>Простой</dt><dd>'+fmt(l.downtimeMinutes)+' мин</dd></dl>'+(id==='assembly'?riskCard():'');
    $('detailDialog').showModal();
  }
  function download(name,text,type='text/plain') {
    const url=URL.createObjectURL(new Blob([text],{type}));
    const link=document.createElement('a'); link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
    notify('Скачан файл '+name);
  }
  function exportData(type) {
    if(type==='snapshot'||type==='sample') {
      const snapshot=E.exportSnapshot(type==='sample'?E.createState('shortage'):state);
      download(type==='sample'?'sample-production.json':'production-snapshot.json',JSON.stringify(snapshot,null,2),'application/json');return;
    }
    if(type==='csv') {
      const rows=[['Источник','Модельное время','Участок','Линия','Выпуск, ед.','Темп, ед./ч','Мощность, ед./ч','Простой, мин','Статус'],...lines().map(l=>[sourceText(),E.timeLabel(state.elapsedMinutes,state.shift),l.name,l.line,Math.floor(l.produced),l.throughput,l.capacity,E.round(l.downtimeMinutes),statusText(l.status)])];
      download('shift-report.csv','\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n'),'text/csv;charset=utf-8');return;
    }
    const m=E.metrics(state,filter),r=E.riskFor(state.lines.find(l=>l.id==='assembly'));
    const prediction=mlPrediction();
    const report=['Allur Plant Twin — отчёт за смену','Источник: '+sourceText(),'Время: '+E.timeLabel(state.elapsedMinutes,state.shift),
      'Участок: '+(filter==='all'?'Весь завод':E.ZONES[filter].name), 'Выпуск: '+m.produced+' ед. / план '+m.plan,
      'Загрузка: '+m.load+'%', 'Доступность: '+m.availability+'%', 'Качество: '+m.quality+'%',
      'Простой: '+m.downtime+' машино-мин','Индекс риска сборки: '+r.score+'/100',
      'До исчерпания буфера: '+(r.minutesToStop===null?'не прогнозируется':r.minutesToStop+' мин'),
      'ML-прогноз: '+(prediction.available?fmt(prediction.probability*100)+'% на 60 мин; обучение на синтетических сменах':prediction.reason),
      ...r.reasons,'','Журнал действий:',...state.actions.map(a=>E.timeLabel(a.minute,state.shift)+' '+a.text)].join('\n');
    download('shift-report.txt',report);
  }
  async function importFile(event) {
    const file=event.target.files[0]; if(!file)return;
    try {
      if(file.size>1024*1024)throw new Error('Размер файла превышает 1 МБ.');
      const parsed=JSON.parse(await file.text());
      const candidate=E.validateImport(parsed);
      state=candidate;filter='all';selectedZone='body';render();notify('Снимок загружен. Симуляция на паузе.');
    } catch(err) {
      if($('importError'))$('importError').textContent='Импорт не выполнен: '+(err instanceof SyntaxError?'некорректный JSON.':err.message);
    }
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.page){page=b.dataset.page;render();return;}
    if(b.dataset.filter){filter=b.dataset.filter;if(filter!=='all')selectedZone=filter;render();return;}
    if(b.dataset.zone){selectedZone=b.dataset.zone;render();return;}
    if(b.dataset.detail){detail(b.dataset.detail);return;}
    if(b.dataset.ack){E.acknowledge(state,Number(b.dataset.ack));render();notify('Инцидент принят в работу');return;}
    if(b.dataset.export){exportData(b.dataset.export);return;}
    if(b.dataset.action==='replenish'){E.replenish(state);if($('detailDialog').open)$('detailDialog').close();render();notify('Добавлено 30 комплектов. Подача восстановлена.');}
    if(b.dataset.action==='repair-quality'){E.repairQuality(state);render();notify('Параметры окраски скорректированы');}
    if(b.dataset.action==='quality-scenario'){E.setScenario(state,'quality');render();notify('Включён сценарий дефектов окраски');}
    if(b.dataset.action==='print')window.print();
  });
  $('play').addEventListener('click',()=>{state.running=!state.running;render();});
  $('step').addEventListener('click',()=>{E.tick(state,5);render();});
  $('speed').addEventListener('change',e=>{speed=Number(e.target.value);});
  $('scenario').addEventListener('change',e=>{E.setScenario(state,e.target.value);render();notify('Сценарий изменён');});
  $('shift').addEventListener('change',e=>{state=E.createState(state.scenario,e.target.value);filter='all';selectedZone='body';render();notify('Создана новая '+(state.shift==='day'?'дневная':'ночная')+' смена');});
  $('reset').addEventListener('click',()=>{state=E.createState('shortage',state.shift);filter='all';selectedZone='body';render();notify('Создана новая демонстрационная смена');});
  $('mobilePage').addEventListener('change',e=>{page=e.target.value;render();});
  $('closeDialog').addEventListener('click',()=>$('detailDialog').close());
  setInterval(()=>{
    // Keep dialogs and file selection stable while the operator is interacting.
    if(state.running && !$('detailDialog').open && page!=='settings'){E.tick(state,5*speed);render();}
  },2500);
  render();
})();
