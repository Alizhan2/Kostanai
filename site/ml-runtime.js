/* Offline inference for the trained random forest; no Python server is needed. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports ? require('./ml-features.js') : root.PlantMLFeatures);
  root.PlantML=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(F){
  'use strict';
  function interpolate(value,calibration){
    const x=calibration.x,y=calibration.y;
    if(value<=x[0])return y[0];
    if(value>=x.at(-1))return y.at(-1);
    for(let i=1;i<x.length;i++){
      if(value<=x[i]){
        const weight=(value-x[i-1])/(x[i]-x[i-1]);
        return y[i-1]+weight*(y[i]-y[i-1]);
      }
    }
    return y.at(-1);
  }
  function score(model,values){
    // scikit-learn tree predictors cast their inputs to float32.
    const x=values.map(Math.fround);
    let sum=0;
    for(const tree of model.trees){
      let node=0,steps=0;
      while(tree.left[node]!==-1){
        if(++steps>200)throw new Error('Некорректная структура дерева.');
        node=x[tree.feature[node]]<=tree.threshold[node]?tree.left[node]:tree.right[node];
        if(node<0||node>=tree.left.length)throw new Error('Некорректный узел дерева.');
      }
      sum+=tree.probability[node];
    }
    const raw=sum/model.trees.length;
    return {rawProbability:raw,probability:interpolate(raw,model.calibration)};
  }
  function predict(line,model,source){
    if(!model||model.schemaVersion!==1||!Array.isArray(model.trees)||!model.trees.length)
      return {available:false,reason:'Артефакт обученной модели не загружен.',code:'missing_model'};
    if(model.source!=='synthetic'||source!=='synthetic')
      return {available:false,reason:'Для импортированных данных модель нужно обучить и оценить на истории предприятия.',code:'source_mismatch'};
    if(line.status==='stopped'||line.buffer<=0)
      return {available:false,reason:'Буфер уже исчерпан: событие наблюдается, прогноз не требуется.',code:'observed_event'};
    const features=F.extract(line);
    if(!features.available)return {...features,code:'insufficient_history'};
    if(features.names.join(',')!==model.features.join(','))
      return {available:false,reason:'Версия признаков не совпадает с моделью.',code:'schema_mismatch'};
    for(let i=0;i<features.values.length;i++){
      const bounds=model.inputBounds[features.names[i]],value=features.values[i];
      if(!bounds||!Number.isFinite(value)||value<bounds[0]-1e-7||value>bounds[1]+1e-7)
        return {available:false,reason:'Показатели находятся вне диапазонов синтетического обучения.',code:'outside_domain'};
    }
    const result=score(model,features.values);
    return {...result,available:true,alert:result.probability>=model.threshold,modelId:model.id,
      horizonMinutes:model.horizonMinutes,source:model.source,historyPoints:features.historyPoints,
      historyMinutes:features.historyMinutes,threshold:model.threshold};
  }
  return {score,predict};
});
