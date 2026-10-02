/* Diagnostic inference for the separate public Scania APS dataset. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./ml-runtime.js'));
  else root.PlantAPS=factory(root.PlantML);
})(typeof globalThis!=='undefined'?globalThis:this,function(ML){
  'use strict';
  function predict(features,model){
    if(!model||model.scope!=='scania_aps_diagnosis')
      return {available:false,reason:'Модель диагностики Scania APS не загружена.'};
    if(!features||typeof features!=='object'||Array.isArray(features))
      return {available:false,reason:'Нужен объект features с исходными признаками Scania.'};
    const expected=new Set(model.originalFeatures), keys=Object.keys(features);
    if(keys.length!==expected.size||keys.some(key=>!expected.has(key)))
      return {available:false,reason:'Нужны ровно 170 исходных признаков Scania. Неизвестные значения обозначьте null.'};
    if(keys.some(key=>features[key]!==null&&(!Number.isFinite(features[key])||typeof features[key]!=='number')))
      return {available:false,reason:'Значения признаков должны быть конечными числами или null.'};
    let missing=0,outside=0;
    const values=model.features.map((name,i)=>{
      const value=features[name];
      if(value===null){missing++;return model.medians[i];}
      const bounds=model.inputBounds[name];
      if(value<bounds[0]||value>bounds[1])outside++;
      return value;
    });
    if(missing/model.features.length>model.maxMissingFraction||model.features.length-missing<model.minimumObservedFeatures)
      return {available:false,reason:'Слишком мало измерений для диагностики: заполните больше признаков.'};
    const score=ML.score(model,values);
    return {...score,available:true,alert:score.probability>=model.threshold,threshold:model.threshold,
      missingFeatures:missing,outsideTrainingRanges:outside,
      reason:outside?'Часть значений вне диапазонов обучения; результат требует дополнительной проверки.':''};
  }
  return {predict};
});
