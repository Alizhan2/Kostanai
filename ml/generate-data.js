/* Synthetic supply trajectories, using the same material balance as the app. */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const E=require('../engine.js');
const F=require('../ml-features.js');
const SEED=20261002, EPISODES=600, STEP=5, HORIZON=60, DURATION=480;
let seed=SEED>>>0;
function random(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;}
function uniform(lo,hi){return lo+(hi-lo)*random();}
function gaussian(){return Math.sqrt(-2*Math.log(Math.max(random(),1e-12)))*Math.cos(2*Math.PI*random());}
const round=n=>Math.round(n*10000)/10000;
const output=path.join(__dirname,'data');fs.mkdirSync(output,{recursive:true});
const rows=[],telemetry=[],regimes=['stable','persistent_shortage','recovering','variable'];
const schema=['episode_id','minute','regime',...F.names,'stop_within_60m'];
for(let episode=0;episode<EPISODES;episode++){
  const regime=regimes[episode%regimes.length];
  const observationCadence=[5,10,15][episode%3];
  const state=E.createState('normal');state.elapsedMinutes=0;state.actions=[];state.incidents=[];
  state.lines.forEach(l=>{l.history=[];l.downtimeMinutes=0;});
  const a=state.lines.find(l=>l.id==='assembly');
  const demand=uniform(12,28);a.demandPerHour=demand;
  a.buffer=uniform(2,random()<.8?55:120);
  let ratio=regime==='stable'?uniform(.85,1.25):regime==='persistent_shortage'?uniform(.05,.7):
    regime==='recovering'?uniform(.05,.6):uniform(.3,1.3);
  const recoveryMinute=uniform(45,240);
  const snapshots=[];
  for(let minute=0;minute<=DURATION;minute+=STEP){
    if(regime==='recovering'&&minute>=recoveryMinute)ratio=Math.min(1.25,ratio+.07);
    if(regime==='variable'&&random()<.12)ratio=uniform(.05,1.4);
    if(regime==='stable'&&random()<.025)ratio=uniform(.7,1.25);
    if(regime==='persistent_shortage'&&random()<.035)ratio=uniform(.02,.8);
    const supply=Math.max(0,Math.min(36,demand*ratio+gaussian()*uniform(.2,1.5)));
    a.replenishmentPerHour=supply;
    if(minute>0)E.tick(state,STEP);
    else a.history=[{minute:0,buffer:a.buffer,throughput:a.throughput}];
    const observedHistory=a.history.filter(point=>point.minute%observationCadence===0);
    snapshots.push({minute,buffer:a.buffer,
      features:minute%observationCadence===0?F.extract({...a,history:observedHistory}):{available:false},
      stopped:a.buffer<=0&&supply<demand});
    telemetry.push([episode,minute,regime,round(a.buffer),round(demand),round(supply),
      a.buffer<=0&&supply<demand?1:0]);
  }
  for(let i=0;i<snapshots.length;i++){
    const point=snapshots[i];
    if(!point.features.available||point.stopped||point.buffer<=0||point.minute>DURATION-HORIZON)continue;
    const future=snapshots.slice(i+1,i+1+HORIZON/STEP);
    const target=future.some(x=>x.stopped)?1:0;
    rows.push([episode,point.minute,regime,...point.features.values.map(round),target]);
  }
}
const csv=schema.join(',')+'\n'+rows.map(r=>r.join(',')).join('\n')+'\n';
fs.writeFileSync(path.join(output,'training.csv'),csv);
fs.writeFileSync(path.join(output,'telemetry.csv'),
  'episode_id,minute,regime,buffer,demand_per_hour,supply_per_hour,stopped\n'+telemetry.map(r=>r.join(',')).join('\n')+'\n');
const manifest={schemaVersion:1,source:'synthetic',seed:SEED,episodes:EPISODES,stepMinutes:STEP,
  horizonMinutes:HORIZON,durationMinutes:DURATION,observationCadencesMinutes:[5,10,15],
  rows:rows.length,telemetryRows:telemetry.length,eligibleEpisodes:new Set(rows.map(row=>row[0])).size,
  features:F.names,target:'stop_within_60m',targetMeaning:'Buffer exhaustion in the next 60 minutes without operator intervention.',
  labelUsesFuture:true,featuresUseFuture:false,regimeIsFeature:false,
  positiveRows:rows.filter(r=>r.at(-1)===1).length,
  sha256:crypto.createHash('sha256').update(csv).digest('hex'),
  generator:'ml/generate-data.js',engine:'engine.js',featureExtractor:'ml-features.js',
  assumptions:['Supply changes stochastically every five minutes.','Demand is constant within each synthetic episode.',
    'No manual replenishment in forecast horizon.','Not Allur telemetry or equipment failure labels.']};
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
