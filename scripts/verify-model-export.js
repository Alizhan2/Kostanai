/* Compare portable inference to independent predictions saved by scikit-learn. */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const ML=require('../ml-runtime.js');
const ROOT=path.resolve(__dirname,'..');
function csv(file){
  const lines=fs.readFileSync(path.join(ROOT,file),'utf8').trim().split(/\r?\n/);
  const start=lines.findIndex(line=>line.startsWith('class,')||line.startsWith('episode_id,')||line.startsWith('official_row_id,'));
  assert(start>=0,'CSV header not found: '+file);
  const names=lines[start].split(',');
  return lines.slice(start+1).map(line=>{
    const values=line.split(',');assert.equal(values.length,names.length,'Unexpected public CSV shape');
    return Object.fromEntries(names.map((name,i)=>[name,values[i]]));
  });
}
function compare(label,model,pairs){
  let maxRawError=0,maxProbabilityError=0,alerts=0;
  for(const {values,expected} of pairs){
    const result=ML.score(model,values);
    const rawError=Math.abs(result.rawProbability-Number(expected.raw_probability));
    const probabilityError=Math.abs(result.probability-Number(expected.calibrated_probability));
    maxRawError=Math.max(maxRawError,rawError);maxProbabilityError=Math.max(maxProbabilityError,probabilityError);
    assert(rawError<=1e-10,label+': raw probability differs from scikit-learn');
    assert(probabilityError<=1e-10,label+': calibrated probability differs from scikit-learn');
    const alert=result.probability>=model.threshold;
    const expectedAlert=Number(expected.calibrated_probability)>=model.threshold;
    assert.equal(alert,expectedAlert,label+': warning decision differs');
    if(alert)alerts++;
  }
  return {model:label,rows:pairs.length,probabilityTolerance:1e-10,maxRawError,maxProbabilityError,
    alertDecisionsMatch:true,alerts};
}
const buffer=JSON.parse(fs.readFileSync(path.join(ROOT,'models/buffer-risk.json'),'utf8'));
const training=csv('ml/data/training.csv');
const index=new Map(training.map(row=>[row.episode_id+':'+row.minute,row]));
const bufferPairs=csv('ml/results/holdout-predictions.csv').map(expected=>{
  const row=index.get(expected.episode_id+':'+expected.minute);assert(row,'Buffer input row missing');
  return {values:buffer.features.map(name=>Number(row[name])),expected};
});
const aps=JSON.parse(fs.readFileSync(path.join(ROOT,'models/aps-diagnostic.json'),'utf8'));
const original=csv('ml/public/aps/aps_failure_test_set.csv');
const apsPairs=csv('ml/results/aps/holdout-predictions.csv').map(expected=>{
  const row=original[Number(expected.official_row_id)];assert(row,'APS input row missing');
  const values=aps.features.map((name,i)=>row[name]==='na'?aps.medians[i]:Number(row[name]));
  assert(values.every(Number.isFinite),'Invalid APS input');
  return {values,expected};
});
const report={scope:'Portable JavaScript forest and calibration against saved Python holdout predictions',
  results:[compare('buffer-risk',buffer,bufferPairs),compare('scania-aps',aps,apsPairs)]};
const output=path.join(ROOT,'docs/verification/model-export.json');
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
