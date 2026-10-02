const A = require('../scenario-analysis.js');
const { series, ...summary } = A.compare(30);
console.log(JSON.stringify(summary, null, 2));
