import assert from 'node:assert/strict';

export function validateExplanations(before, proposals, years) {
 const targets=before.filter(r=>years.includes(r.data.year));
 assert.ok(targets.length>0&&targets.length<=500,'Invalid atomic release size');
 assert.equal(proposals.length,targets.length,'Missing or extra explanations');
 assert.equal(new Set(proposals.map(p=>p.id)).size,targets.length,'Duplicate IDs');
 const map=new Map(targets.map(r=>[r.id,r.data]));
 for(const p of proposals){
  assert.deepEqual(Object.keys(p).sort(),['explanation','id'],'Only ID and explanation are allowed');
  assert.ok(map.has(p.id),'Out-of-scope ID');
  assert.equal(typeof p.explanation,'string');
  assert.ok(p.explanation.trim().length>=50&&p.explanation.length<=950,p.id+': invalid length');
  assert.ok(!/[#*]{2}|麻酔科専門医として/.test(p.explanation),p.id+': formatting');
  const header=p.explanation.match(/^正答：([A-E](?:[・、][A-E])*)/);
  assert.equal(header?.[1].replace(/[・、]/g,'').toLowerCase(),map.get(p.id).answer.toLowerCase(),p.id+': answer mismatch');
 }
 return map;
}
