const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../engine.js');
const parser=import('../src/lib/production-csv.mjs');

test('Excel-compatible CSV round-trips a snapshot, retains equipment stops and gets imported provenance',async()=>{
 const {snapshotToCSV,parseProductionCSV}=await parser;
 const snapshot=E.exportSnapshot(E.createState('shortage','night'));
 snapshot.lines[0].status='stopped';snapshot.lines[0].throughput=0;
 const imported=E.validateImport(parseProductionCSV(snapshotToCSV(snapshot)));
 assert.deepEqual(E.exportSnapshot(imported),snapshot);
 assert.equal(imported.source,'imported');E.tick(imported,5);
 assert.equal(imported.lines[0].status,'stopped');
});
test('CSV accepts comma, tab and semicolon delimiters, quoted numbers and decimal commas',async()=>{
 const Papa=require('papaparse');const {snapshotToCSV,parseProductionCSV}=await parser;
 const snapshot=E.exportSnapshot(E.createState());const data=Papa.parse(snapshotToCSV(snapshot)).data;
 for(const delimiter of [',','\t',';']) {
  const csv=Papa.unparse(data,{delimiter,quotes:true});
  assert.deepEqual(E.exportSnapshot(E.validateImport(parseProductionCSV(csv))),snapshot);
 }
 const csv=snapshotToCSV(snapshot).replace('23.92','"23,92"');
 assert.equal(parseProductionCSV(csv).lines[0].throughput,23.92);
});
test('missing numeric values, formulas, duplicate headers and inconsistent timestamps are rejected',async()=>{
 const Papa=require('papaparse');const {snapshotToCSV,parseProductionCSV}=await parser;
 const data=Papa.parse(snapshotToCSV(E.exportSnapshot(E.createState()))).data;
 function mutated(row,column,value){const clone=structuredClone(data);clone[row][column]=value;return Papa.unparse(clone,{delimiter:';'});}
 for(const value of ['', '=2+2', 'Infinity', '0x10']) assert.throws(()=>parseProductionCSV(mutated(1,4,value)),/число/);
 assert.throws(()=>parseProductionCSV(mutated(0,4,'id')),/столбцы/);
 assert.throws(()=>parseProductionCSV(mutated(2,1,'125')),/время и смена/);
 assert.throws(()=>parseProductionCSV(mutated(2,2,'other')),/shift/);
 assert.throws(()=>parseProductionCSV('id;capacity\nbody;22'),/столбцы/);
});
test('CSV cannot bypass engine validation with duplicate IDs, invalid bounds or stopped output',async()=>{
 const {snapshotToCSV,parseProductionCSV}=await parser;
 for(const mutate of [s=>s.lines[1].id='body',s=>s.lines[0].capacity=-1,s=>s.lines[0].status='stopped']) {
  const s=E.exportSnapshot(E.createState());mutate(s);
  assert.throws(()=>E.validateImport(parseProductionCSV(snapshotToCSV(s))));
 }
});
