(function(){
  'use strict';
  const model=window.PlantAPSModel,examples=window.PlantAPSExamples.examples;
  const select=document.getElementById('example'),output=document.getElementById('result');
  const percent=value=>(value*100).toLocaleString('ru-RU',{maximumFractionDigits:1})+'%';
  let current;
  const evaluation=model.evaluation;
  const matrix=evaluation.confusion_matrix;
  const metrics=[['Полнота',percent(evaluation.recall),matrix[1][1]+' из '+(matrix[1][0]+matrix[1][1])+' записей с неисправностью APS'],
    ['Точность предупреждений',percent(evaluation.precision),matrix[0][1]+' ложных предупреждений'],
    ['Пропуски',String(evaluation.confusion_matrix[1][0]),'из 16 000 записей оценки']];
  const metricsRoot=document.getElementById('metrics');
  metrics.forEach(([title,value,detail])=>{
    const card=document.createElement('div');card.className='aps-metric';
    const label=document.createElement('span'),strong=document.createElement('strong'),caption=document.createElement('span');
    label.textContent=title;strong.textContent=value;caption.textContent=detail;card.append(label,strong,caption);metricsRoot.append(card);
  });
  examples.forEach((record,index)=>{const option=document.createElement('option');option.value=index;option.textContent='Запись №'+record.id;select.append(option);});
  function show(record,knownReference){
    current=record;
    const result=window.PlantAPS.predict(record.features,model);
    output.replaceChildren();output.classList.toggle('alert',Boolean(result.alert));
    const heading=document.createElement('h3');
    heading.textContent=result.available?(result.alert?'Рекомендована проверка APS':'Порог проверки APS не достигнут'):'Расчёт недоступен';output.append(heading);
    const description=document.createElement('p');description.textContent=result.available?
      'Оценка класса APS: '+percent(result.probability)+'. Порог проверки: '+percent(result.threshold)+'.':result.reason;output.append(description);
    if(result.available){
      const details=document.createElement('p');details.className='small';
      details.textContent='Неизвестных используемых признаков: '+result.missingFeatures+'. Значений вне диапазонов обучения: '+result.outsideTrainingRanges+'. '+result.reason;output.append(details);
    }
    document.getElementById('reference').textContent=knownReference?'Эталон датасета: '+
      (record.label==='pos'?'неисправность компонента APS.':'неисправность другого компонента.'):'Для загруженной записи эталон неизвестен.';
    const tbody=document.getElementById('features');tbody.replaceChildren();
    for(const name of model.originalFeatures){
      const row=document.createElement('tr'),key=document.createElement('td'),value=document.createElement('td');
      key.textContent=name;value.textContent=record.features[name]===null?'Неизвестно':String(record.features[name]);row.append(key,value);tbody.append(row);
    }
  }
  select.addEventListener('change',()=>show(examples[Number(select.value)],true));
  document.getElementById('recordFile').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    try{
      if(file.size>200000)throw new Error('Максимальный размер JSON — 200 КБ.');
      const record=JSON.parse(await file.text());
      const prediction=window.PlantAPS.predict(record&&record.features,model);
      if(!prediction.available)throw new Error(prediction.reason);
      select.value='';show(record,false);
    }catch(error){output.replaceChildren();output.classList.remove('alert');output.textContent=error.message;document.getElementById('reference').textContent='Предыдущая выбранная запись сохранена.';}
    event.target.value='';
  });
  document.getElementById('download').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify({features:current.features,licenseNotice:model.licenseNotice},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='scania-aps-observation.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  show(examples[0],true);
})();
