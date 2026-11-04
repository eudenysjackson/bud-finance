const { test }=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {sealArchive,openArchive,encode,decode,validateArchive}=require('../backend/recovery-archive');
const key=crypto.randomBytes(32).toString('base64');
test('encrypted recovery roundtrip preserves financial values and detects tampering or wrong keys',()=>{
  const data={version:1,scope:'financial-only',uid:'fictitious',documents:[{path:'transacoes/a',data:encode({valor:19.91,descricao:'Dado privado fictício'})}]};
  const encrypted=sealArchive(data,key);assert(!encrypted.includes(Buffer.from('Dado privado')));assert.deepEqual(validateArchive(openArchive(encrypted,key)),data);
  const corrupt=Buffer.from(encrypted);corrupt[corrupt.length-1]^=1;assert.throws(()=>openArchive(corrupt,key));assert.throws(()=>openArchive(encrypted,crypto.randomBytes(32).toString('base64')));
  assert(!sealArchive(data,key).equals(encrypted));
});
test('recovery refuses privileged paths, duplicate documents and prototype fields',()=>{
  for(const path of ['../admins/me','_seguranca/code','_owner_events/event','metas/a/../../admin'])assert.throws(()=>validateArchive({version:1,scope:'financial-only',documents:[{path}]}));
  assert.throws(()=>validateArchive({version:1,scope:'financial-only',documents:[{path:'metas/a'},{path:'metas/a'}]}));
  assert.throws(()=>decode(['object',[['__proto__',['scalar','bad']]]],null));
});
test('recovery preserves exact Firestore timestamp precision and buffers',()=>{
  class Timestamp {constructor(seconds,nanoseconds){this.seconds=seconds;this.nanoseconds=nanoseconds;}toMillis(){return this.seconds*1000;}}
  const data={at:new Timestamp(123,999999),raw:Buffer.from([1,2]),items:[1,'x']};assert.deepEqual(decode(encode(data),Timestamp),data);
});
