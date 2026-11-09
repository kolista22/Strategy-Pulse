import test from 'node:test';
import assert from 'node:assert/strict';
import { freshGoals, addGoal, updateProgress, overallProgress, decodeGoals, loadGoals, saveGoals, resetLocalData, STORAGE_KEY } from '../lib/goals.ts';
test('three presets; average is equal-weight and rounded',()=>{ assert.equal(freshGoals().length,3); assert.equal(overallProgress(freshGoals()),40); assert.equal(overallProgress([]),0); });
test('presets are independent copies',()=>{const a=freshGoals(); a[0].progress=0; assert.equal(freshGoals()[0].progress,60);});
test('new goal trims title, starts at zero and does not mutate input',()=>{const a=freshGoals(); const b=addGoal(a,'  Launch   a pilot  ','pilot'); assert.equal(b.length,4); assert.deepEqual(b[3],{id:'pilot',title:'Launch a pilot',progress:0}); assert.equal(a.length,3); assert.equal(overallProgress(b),30);});
test('blank, oversized, duplicate titles and duplicate IDs rejected',()=>{for(const title of ['  ','a'.repeat(81),freshGoals()[0].title.toUpperCase()]) assert.throws(()=>addGoal(freshGoals(),title,'new')); assert.throws(()=>addGoal(freshGoals(),'New',freshGoals()[0].id));});
test('goal capacity enforced',()=>{const a=Array.from({length:50},(_,i)=>({id:String(i),title:`Goal ${i}`,progress:0})); assert.throws(()=>addGoal(a,'Another','new'));});
test('progress boundaries accepted; immutable update',()=>{const a=freshGoals(); const b=updateProgress(a,'clarity',100); assert.equal(b[0].progress,100); assert.equal(a[0].progress,60); assert.equal(updateProgress(a,'clarity',0)[0].progress,0);});
test('invalid progress and missing record rejected',()=>{for(const n of [-1,101,1.5,NaN,Infinity,'50']) assert.throws(()=>updateProgress(freshGoals(),'clarity',n)); assert.throws(()=>updateProgress(freshGoals(),'missing',30));});
test('save then reload restores additions and progress',()=>{const m=new Map(); const store={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}; const goals=updateProgress(addGoal(freshGoals(),'Pilot','pilot'),'pilot',75); assert.equal(saveGoals(store,goals,null).status,"saved"); assert.deepEqual(loadGoals(store).goals,goals); assert.ok(m.has(STORAGE_KEY));});
test('first visit gets presets',()=>{assert.deepEqual(loadGoals({getItem:()=>null}).goals,freshGoals());});
test('corrupt or incompatible persisted data is rejected without overwrite',()=>{for(const raw of ['oops','null','{}',JSON.stringify({version:2,goals:freshGoals()}),JSON.stringify({version:1,goals:[]}),JSON.stringify({version:1,goals:[{id:'a',title:'A',progress:101}]}),JSON.stringify({version:1,goals:[freshGoals()[0],freshGoals()[0]]})]) { assert.throws(()=>decodeGoals(raw)); const result=loadGoals({getItem:()=>raw,setItem:()=>assert.fail('must not write')}); assert.equal(result.writable,false); assert.ok(result.warning); }});
test('storage access denial and quota errors are reported',()=>{const store={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('quota');}}; assert.equal(loadGoals(store).writable,false); assert.equal(saveGoals(store,freshGoals(),null).status,"error");});

function memoryStore(initial = null) {
  const map = new Map(initial === null ? [] : [[STORAGE_KEY, initial]]);
  return { map, getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
}
test('cancelling reset touches no storage and preserves corrupt data', () => {
  const store = memoryStore('corrupt');
  assert.equal(resetLocalData(store, false, 'corrupt').status, 'cancelled');
  assert.equal(store.getItem(STORAGE_KEY), 'corrupt');
  assert.equal(resetLocalData({ getItem:()=>assert.fail(), removeItem:()=>assert.fail() },false,null).status,'cancelled');
});
test('confirmed reset removes only this key; defaults save and restore normally', () => {
  const store = memoryStore('corrupt'); store.map.set('another-app', 'keep');
  assert.equal(loadGoals(store).writable,false);
  assert.equal(resetLocalData(store,true,'corrupt').status,'reset');
  assert.equal(store.getItem('another-app'),'keep');
  assert.equal(saveGoals(store,freshGoals(),null).status,'saved');
  assert.equal(loadGoals(store).writable,true);
  assert.deepEqual(loadGoals(store).goals,freshGoals());
});
test('failed removal never reports reset success', () => {
  const store = memoryStore('corrupt');store.removeItem=()=>{throw Error('denied');};
  assert.equal(resetLocalData(store,true,'corrupt').status,'error');
  assert.equal(store.getItem(STORAGE_KEY),'corrupt');
});
test('quota failure never produces a saved result and preserves old storage', () => {
  const store=memoryStore();store.setItem=()=>{throw Error('quota');};
  const result=saveGoals(store,freshGoals(),null);
  assert.equal(result.status,'error'); assert.match(result.message,/lost on refresh/);assert.equal(store.getItem(STORAGE_KEY),null);
});
test('progress update saves correct value and average with current baseline',()=>{
  const store=memoryStore();const first=saveGoals(store,freshGoals(),null);assert.equal(first.status,'saved');
  const goals=updateProgress(freshGoals(),'clarity',100);assert.equal(saveGoals(store,goals,first.raw).status,'saved');
  assert.equal(loadGoals(store).goals[0].progress,100);assert.equal(overallProgress(loadGoals(store).goals),53);
});
test('known external update blocks stale save without replacing latest data',()=>{
  const store=memoryStore();const a=saveGoals(store,freshGoals(),null);assert.equal(a.status,'saved');
  const external=updateProgress(freshGoals(),'clarity',80);const b=saveGoals(store,external,a.raw);assert.equal(b.status,'saved');
  assert.equal(saveGoals(store,updateProgress(freshGoals(),'feedback',90),a.raw).status,'conflict');
  assert.equal(store.getItem(STORAGE_KEY),b.raw);
  const latest=loadGoals(store);assert.equal(saveGoals(store,updateProgress(latest.goals,'feedback',90),latest.raw).status,'saved');
});
test('reset does not delete an external change made after initial read',()=>{
  const store=memoryStore('corrupt');store.setItem(STORAGE_KEY,JSON.stringify({version:1,goals:freshGoals()}));
  assert.equal(resetLocalData(store,true,'corrupt').status,'conflict');assert.equal(loadGoals(store).writable,true);
});
test('readback detects a competing write observed immediately after save',()=>{
  const store=memoryStore();const external=JSON.stringify({version:1,goals:updateProgress(freshGoals(),'clarity',99)});
  store.setItem=(key,value)=>store.map.set(key,external);
  assert.equal(saveGoals(store,freshGoals(),null).status,'conflict');assert.equal(store.getItem(STORAGE_KEY),external);
});
