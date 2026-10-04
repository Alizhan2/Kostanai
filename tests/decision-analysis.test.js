const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../scenario-analysis.js');
const D = require('../decision-analysis.js');

test('early replenishment values 75 saved minutes and subtracts the action once', () => {
  const effect = D.economicEffect(A.compare(30), { downtimeCostPerHour: 100000, interventionCost: 20000 });
  assert.equal(effect.avoidedCost,125000);
  assert.equal(effect.netEffect,105000);
  assert.equal(effect.breakEvenHourlyCost,16000);
  assert.equal(effect.roiPercent,525);
});
test('cost evaluation follows late action and does not charge actions outside the horizon', () => {
  const costs = { downtimeCostPerHour: 100000, interventionCost: 20000 };
  assert.equal(D.economicEffect(A.compare(60),costs).netEffect,80000);
  const end=D.economicEffect(A.compare(120),costs);
  assert.equal(end.netEffect,0); assert.equal(end.appliedInterventionCost,0);
  assert.equal(end.breakEvenHourlyCost,null); assert.equal(end.roiPercent,null);
});
test('zero assumptions stay finite and invalid costs cannot generate a profit', () => {
  const zero=D.economicEffect(A.compare(30),{downtimeCostPerHour:0,interventionCost:0});
  assert.equal(zero.netEffect,0); assert.equal(zero.roiPercent,null);
  assert.equal(D.economicEffect(A.compare(30),{downtimeCostPerHour:0,interventionCost:20000}).netEffect,-20000);
  for (const cost of [-1,Infinity,NaN,'100',1e10,null]) assert.throws(()=>D.economicEffect(A.compare(30),{downtimeCostPerHour:cost,interventionCost:0}),/Стоимость/);
});
