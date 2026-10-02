const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

test('plant output counts final assembly once, rather than summing all stages', () => {
  const state = E.createState();
  assert.equal(E.metrics(state).produced, 39);
  assert.equal(E.metrics(state,'body').produced, 47);
  assert.equal(E.metrics(state).plan, 44);
});

test('supply disruption predicts 45 minutes until buffer depletion', () => {
  const state = E.createState('shortage');
  const r = E.riskFor(state.lines.find(l => l.id === 'assembly'));
  assert.equal(r.minutesToStop,45);
  assert.equal(r.score,75);
});

test('buffer depletion stops assembly and accumulates downtime accurately', () => {
  const state = E.createState('shortage');
  for(let i=0;i<12;i++) E.tick(state,5);
  const line=state.lines.find(l=>l.id==='assembly');
  assert.equal(line.buffer,0);
  assert.equal(line.status,'stopped');
  assert.equal(line.throughput,0);
  assert.ok(Math.abs(line.downtimeMinutes-17)<1e-8);
  assert.equal(state.incidents.filter(i=>i.type==='stop'&&i.status==='open').length,1);
  assert.equal(E.riskFor(line).score,100);
});

test('a step spanning the stop only produces for the time with inventory', () => {
  const state = E.createState('shortage');
  E.tick(state,60);
  const line=state.lines.find(l=>l.id==='assembly');
  assert.equal(line.status,'stopped');
  assert.equal(line.downtimeMinutes,17);
  assert.ok(line.produced>39 && line.produced<60);
});

test('depletion status agrees at 45 minutes for single and fractional step partitions', () => {
  for (const steps of [[45], [15,15,15], Array(9).fill(5)]) {
    const state=E.createState('shortage');
    steps.forEach(delta=>E.tick(state,delta));
    const line=state.lines.find(l=>l.id==='assembly');
    assert.equal(line.buffer,0);
    assert.equal(line.status,'stopped');
    assert.equal(line.throughput,0);
    assert.equal(E.riskFor(line).score,100);
    assert.ok(Math.abs(line.downtimeMinutes-2)<1e-9);
    const produced=line.produced;
    E.tick(state,5);
    assert.equal(line.produced,produced);
    assert.ok(Math.abs(line.downtimeMinutes-7)<1e-9);
    assert.equal(state.incidents.filter(i=>i.type==='stop'&&i.status==='open').length,1);
  }
});

test('replenishment restarts assembly, resolves incident, and clears obsolete trend', () => {
  const state=E.createState('shortage');
  E.tick(state,60);
  E.replenish(state);
  const line=state.lines.find(l=>l.id==='assembly');
  assert.equal(line.status,'running');
  assert.equal(line.buffer,30);
  assert.equal(E.riskFor(line).minutesToStop,null);
  assert.equal(E.riskFor(line).trend,null);
  assert.equal(state.incidents.filter(i=>i.status==='open').length,0);
  const before=line.produced;
  E.tick(state,5);
  assert.ok(line.produced>before);
  assert.equal(line.downtimeMinutes,17);
});

test('linear regression recovers a known inventory trend', () => {
  const trend=E.trend([{minute:0,buffer:30},{minute:15,buffer:26},{minute:30,buffer:22}], 'buffer');
  assert.ok(Math.abs(trend.slope+4/15)<1e-9);
  assert.equal(trend.rSquared,1);
});

test('acknowledgement does not remove unresolved incident', () => {
  const state=E.createState('shortage');
  const id=state.incidents[0].id;
  assert.equal(E.acknowledge(state,id),true);
  assert.equal(state.incidents[0].status,'open');
  assert.equal(state.incidents[0].acknowledged,true);
});

test('snapshot export and import preserve metrics and supply parameters', () => {
  const state=E.createState('shortage');
  E.tick(state,20);
  const imported=E.validateImport(E.exportSnapshot(state));
  assert.equal(E.metrics(imported).produced,E.metrics(state).produced);
  assert.equal(imported.lines.find(l=>l.id==='assembly').buffer,6.67);
  assert.equal(imported.running,false);
  assert.equal(imported.source,'imported');
  assert.equal(imported.scenario,'shortage');
});

test('invalid and duplicate line data is rejected', () => {
  const snapshot=E.exportSnapshot(E.createState());
  assert.throws(()=>E.validateImport({...snapshot,elapsedMinutes:0}));
  snapshot.lines[0].defects=snapshot.lines[0].produced+1;
  assert.throws(()=>E.validateImport(snapshot),/дефектов/);
  const duplicate=E.exportSnapshot(E.createState());duplicate.lines[1].id='body';
  assert.throws(()=>E.validateImport(duplicate),/повторов/);
  const bad=E.exportSnapshot(E.createState());bad.lines[0].capacity=Infinity;
  assert.throws(()=>E.validateImport(bad),/capacity/);
});

test('simulation stops exactly at end of shift and preserves bounded metrics', () => {
  const state=E.createState('shortage');state.elapsedMinutes=718;state.running=true;
  E.tick(state,15);
  assert.equal(state.elapsedMinutes,720);
  assert.equal(state.running,false);
  E.tick(state,5);
  assert.equal(state.elapsedMinutes,720);
  const m=E.metrics(state);
  for(const metric of ['load','availability','quality'])assert.ok(m[metric]>=0&&m[metric]<=100);
});

test('quality intervention changes future defects without rewriting production history', () => {
  const state=E.createState('quality');
  E.tick(state,30);
  const paint=state.lines.find(l=>l.id==='paint'),defects=paint.defects;
  E.repairQuality(state);
  assert.equal(paint.defects,defects);
  assert.equal(paint.status,'running');
  E.tick(state,30);
  assert.ok(paint.defects>defects && paint.defects-defects<1);
});

test('imported equipment stops remain observations and accumulate downtime without output', () => {
  const snapshot=E.exportSnapshot(E.createState('shortage'));
  for (const id of ['body', 'paint', 'assembly', 'logistics']) {
    const line=snapshot.lines.find(l=>l.id===id);
    line.status='stopped'; line.throughput=0;
  }
  const state=E.validateImport(snapshot);
  const initial=state.lines.map(line=>({produced:line.produced,defects:line.defects,downtime:line.downtimeMinutes}));
  E.tick(state,5);
  state.lines.forEach((line,i)=>{
    assert.equal(line.status,'stopped');
    assert.equal(line.throughput,0);
    assert.equal(line.produced,initial[i].produced);
    assert.equal(line.defects,initial[i].defects);
    assert.equal(line.downtimeMinutes,initial[i].downtime+5);
  });
  assert.ok(Math.abs(state.lines.find(l=>l.id==='assembly').buffer-(12+4*5/60))<1e-9);
  const stop=state.incidents.find(item=>item.type==='stop'&&item.status==='open');
  E.replenish(state);
  assert.equal(state.lines.find(l=>l.id==='assembly').history.at(-1).throughput,0);
  E.repairQuality(state);
  assert.equal(state.lines.find(l=>l.id==='assembly').status,'stopped');
  assert.equal(state.lines.find(l=>l.id==='paint').status,'stopped');
  assert.equal(stop.status,'open');
  assert.equal(state.incidents.filter(item=>item.type==='stop'&&item.status==='open').length,1);
  const roundTrip=E.validateImport(E.exportSnapshot(state));
  assert.equal(roundTrip.lines.find(l=>l.id==='assembly').status,'stopped');
});

test('an imported buffer stop can resume after replenishment, unlike an equipment stop', () => {
  const original=E.createState('shortage'); E.tick(original,60);
  const state=E.validateImport(E.exportSnapshot(original));
  const line=state.lines.find(l=>l.id==='assembly');
  assert.equal(line.status,'stopped');
  assert.equal(line.importedEquipmentStop,false);
  E.replenish(state);
  E.tick(state,5);
  assert.equal(line.status,'running');
  assert.ok(line.produced>39);
  assert.equal(state.incidents.filter(item=>item.type==='stop'&&item.status==='open').length,0);
});

test('quality repair preserves an independent supply shortage and its incident', () => {
  const snapshot=E.exportSnapshot(E.createState('shortage'));
  snapshot.lines.find(line=>line.id==='paint').status='warning';
  const state=E.validateImport(snapshot);
  assert.ok(state.incidents.some(item=>item.type==='supply'&&item.status==='open'));
  assert.ok(state.incidents.some(item=>item.type==='quality'&&item.status==='open'));
  E.repairQuality(state);
  assert.equal(state.scenario,'shortage');
  assert.equal(state.lines.find(line=>line.id==='assembly').replenishmentPerHour,4);
  assert.ok(state.incidents.some(item=>item.type==='supply'&&item.status==='open'));
  assert.ok(!state.incidents.some(item=>item.type==='quality'&&item.status==='open'));
  E.tick(state,5);
  assert.ok(state.lines.find(line=>line.id==='logistics').throughput<15);
});

test('malformed and inherited zone identifiers are rejected by snapshot validation', () => {
  for (const row of [null, undefined, 1, {id:'__proto__'}, {id:'constructor'}, {id:'toString'}]) {
    const snapshot=E.exportSnapshot(E.createState());
    snapshot.lines[0]=row;
    assert.throws(()=>E.validateImport(snapshot),/Идентификаторы линий/);
  }
});
