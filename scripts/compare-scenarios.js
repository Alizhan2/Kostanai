const E = require('../engine.js');
const baseline=E.createState('shortage');
const intervention=E.createState('shortage');
for(let step=0;step<24;step++) {
  if(step===6)E.replenish(intervention);
  E.tick(baseline,5); E.tick(intervention,5);
}
const before=baseline.lines.find(l=>l.id==='assembly');
const after=intervention.lines.find(l=>l.id==='assembly');
console.log(JSON.stringify({
  source:'synthetic simulation; not measured Allur results',
  horizonMinutes:120, interventionAfterMinutes:30,
  baseline:{produced:E.round(before.produced-39),downtimeMinutes:E.round(before.downtimeMinutes-2)},
  intervention:{produced:E.round(after.produced-39),downtimeMinutes:E.round(after.downtimeMinutes-2)},
  additionalOutput:E.round(after.produced-before.produced),
  avoidedDowntimeMinutes:E.round(before.downtimeMinutes-after.downtimeMinutes)
},null,2));
