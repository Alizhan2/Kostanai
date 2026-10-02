/* Independent synthetic scenarios for the operator's what-if comparison. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./engine.js') : root.PlantEngine);
  root.PlantScenarioAnalysis = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E) {
  'use strict';
  const HORIZON = 120;
  function compare(interventionAfterMinutes = 30) {
    if (!Number.isInteger(interventionAfterMinutes) || interventionAfterMinutes < 0 ||
        interventionAfterMinutes > HORIZON || interventionAfterMinutes % 5 !== 0) {
      throw new Error('Время пополнения: от 0 до 120 минут с шагом 5.');
    }
    const baseline = E.createState('shortage');
    const intervention = E.createState('shortage');
    const before = baseline.lines.find(line => line.id === 'assembly');
    const after = intervention.lines.find(line => line.id === 'assembly');
    const initialOutput = before.produced, initialDowntime = before.downtimeMinutes;
    const series = [{ minute: 0, baselineOutput: 0, interventionOutput: 0 }];
    for (let minute = 0; minute < HORIZON; minute += 5) {
      if (minute === interventionAfterMinutes) E.replenish(intervention, 30);
      E.tick(baseline, 5); E.tick(intervention, 5);
      series.push({ minute: minute + 5, baselineOutput: E.round(before.produced - initialOutput),
        interventionOutput: E.round(after.produced - initialOutput) });
    }
    return {
      source: 'synthetic simulation; not measured Allur results',
      scenario: 'shortage', horizonMinutes: HORIZON, interventionAfterMinutes,
      assumptions: { initialBufferKits: 12, demandPerHour: 20, initialSupplyPerHour: 4,
        addedKits: 30, restoredSupplyPerHour: 21, baselineStopAfterMinutes: 45 },
      interventionWithinHorizon: interventionAfterMinutes < HORIZON,
      baseline: { produced: E.round(before.produced - initialOutput),
        downtimeMinutes: E.round(before.downtimeMinutes - initialDowntime) },
      intervention: { produced: E.round(after.produced - initialOutput),
        downtimeMinutes: E.round(after.downtimeMinutes - initialDowntime) },
      additionalOutput: E.round(after.produced - before.produced),
      avoidedDowntimeMinutes: E.round(before.downtimeMinutes - after.downtimeMinutes),
      series
    };
  }
  return { compare };
});
