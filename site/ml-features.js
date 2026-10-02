/* Shared feature extraction for dataset generation and browser inference. */
(function(root,factory){
  const api=factory();
  root.PlantMLFeatures=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const names=['buffer','demand_per_hour','supply_per_hour','net_deficit_per_hour',
    'coverage_minutes','buffer_trend_per_hour','flow_std_per_hour','mean_flow_per_hour'];
  function extract(line) {
    if(!line||line.id!=='assembly')return {available:false,reason:'Нужна линия сборки.'};
    const current=[line.buffer,line.demandPerHour,line.replenishmentPerHour];
    if(!current.every(Number.isFinite))return {available:false,reason:'Некорректные значения потока.'};
    const history=line.history||[];
    const start=history.map(x=>Boolean(x.intervention)).lastIndexOf(true);
    const samples=history.slice(Math.max(0,start)).slice(-8);
    if(samples.length<3)return {available:false,reason:'Нужны минимум 3 точки после последнего пополнения.'};
    if(!samples.every(x=>Number.isFinite(x.minute)&&Number.isFinite(x.buffer)))
      return {available:false,reason:'Некорректная история буфера.'};
    const span=samples.at(-1).minute-samples[0].minute;
    if(span<10)return {available:false,reason:'Нужна история минимум за 10 модельных минут.'};
    const xmean=samples.reduce((s,x)=>s+x.minute,0)/samples.length;
    const ymean=samples.reduce((s,x)=>s+x.buffer,0)/samples.length;
    const denominator=samples.reduce((s,x)=>s+(x.minute-xmean)**2,0);
    const slope=samples.reduce((s,x)=>s+(x.minute-xmean)*(x.buffer-ymean),0)/denominator*60;
    const flows=[];
    for(let i=1;i<samples.length;i++){
      const dt=samples[i].minute-samples[i-1].minute;
      if(dt<=0)return {available:false,reason:'Время наблюдений должно возрастать.'};
      flows.push((samples[i].buffer-samples[i-1].buffer)/dt*60);
    }
    const flowMean=flows.reduce((s,x)=>s+x,0)/flows.length;
    const flowStd=Math.sqrt(flows.reduce((s,x)=>s+(x-flowMean)**2,0)/flows.length);
    const values=[line.buffer,line.demandPerHour,line.replenishmentPerHour,
      line.demandPerHour-line.replenishmentPerHour,
      line.demandPerHour>0?line.buffer/line.demandPerHour*60:0,slope,flowStd,flowMean];
    return {available:true,names,values,historyPoints:samples.length,historyMinutes:span};
  }
  return {names,extract};
});
