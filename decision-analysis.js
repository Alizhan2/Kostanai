/* Conditional cost evaluation: assumptions entered by the operator, not Allur prices. */
(function (root, factory) {
  const api = factory();
  root.PlantDecisionAnalysis = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const money = value => Math.round((value + Number.EPSILON) * 100) / 100;
  function economicEffect(comparison, assumptions) {
    const { downtimeCostPerHour, interventionCost } = assumptions;
    for (const value of [downtimeCostPerHour, interventionCost])
      if (!Number.isFinite(value) || value < 0 || value > 1e9) throw new Error('Стоимость должна быть числом от 0 до 1 000 000 000 ₸.');
    const minutes = comparison.avoidedDowntimeMinutes;
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > comparison.horizonMinutes || typeof comparison.interventionWithinHorizon !== 'boolean')
      throw new Error('Некорректный результат сравнения сценариев.');
    const hours = minutes / 60;
    const cost = comparison.interventionWithinHorizon ? interventionCost : 0;
    const gross = hours * downtimeCostPerHour;
    return {
      source: 'operator-entered assumptions and synthetic scenario; not measured Allur savings',
      currency: 'KZT', assumptions: { downtimeCostPerHour, interventionCost },
      avoidedDowntimeMinutes: minutes, interventionApplied: comparison.interventionWithinHorizon,
      avoidedCost: money(gross), appliedInterventionCost: money(cost), netEffect: money(gross - cost),
      breakEvenHourlyCost: hours > 0 ? money(cost / hours) : null,
      roiPercent: cost > 0 ? money((gross - cost) / cost * 100) : null,
      excludes: ['vehicle margin (to avoid double counting)', 'taxes', 'uncertainty', 'other implementation costs'],
    };
  }
  return { economicEffect };
});
