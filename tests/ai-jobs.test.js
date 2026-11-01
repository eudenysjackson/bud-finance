const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createJobs, report } = require('../backend/ai-jobs');

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, set() { return this; }, json(data) { this.data = data; return this; } };
}

test('leitura segue após o upload, expõe progresso e só entrega resultado ao titular', async () => {
  const jobs = createJobs(async req => ({ uid: req.uid }));
  let resume;
  const gate = new Promise(resolve => { resume = resolve; });
  const handler = jobs.wrap(async (_, output) => {
    report('Aguardando serviço...');
    await gate;
    output.json({ transacoes: [{ valor: 15 }] });
  });
  const accepted = response();
  await handler({ uid: 'titular', headers: { 'x-bud-async': '1' } }, accepted);
  assert.equal(accepted.statusCode, 202);
  const id = accepted.data.jobId;
  const denied = response();
  await jobs.poll({ uid: 'outro', params: { id } }, denied);
  assert.equal(denied.statusCode, 404);
  const running = response();
  await jobs.poll({ uid: 'titular', params: { id } }, running);
  assert.equal(running.data.state, 'running');
  assert.equal(running.data.message, 'Aguardando serviço...');
  resume();
  await new Promise(resolve => setImmediate(resolve));
  const completed = response();
  await jobs.poll({ uid: 'titular', params: { id } }, completed);
  assert.equal(completed.data.state, 'completed');
  assert.equal(completed.data.result.transacoes[0].valor, 15);
});

test('erro de leitura termina o acompanhamento com falha, sem resultado parcial', async () => {
  const jobs = createJobs(async () => ({ uid: 'local' }));
  const accepted = response();
  await jobs.wrap(async (_, output) => output.status(422).json({ error: 'Arquivo ilegível.' }))({ headers: { 'x-bud-async': '1' } }, accepted);
  const result = response();
  await jobs.poll({ params: { id: accepted.data.jobId } }, result);
  assert.equal(result.data.state, 'failed');
  assert.equal(result.data.status, 422);
  assert.equal(result.data.result.error, 'Arquivo ilegível.');
});

test('leitor travado termina com 504 e resposta tardia não substitui a falha', async () => {
  const jobs = createJobs(async () => ({ uid: 'local' }), { maxDurationMs: 10 });
  let finish;
  const accepted = response();
  await jobs.wrap(async (_, output) => { await new Promise(resolve => { finish = resolve; });output.json({ transacoes: [] }); })({ headers: { 'x-bud-async': '1' } }, accepted);
  await new Promise(resolve => setTimeout(resolve, 30));
  const failed = response();await jobs.poll({ params: { id: accepted.data.jobId } }, failed);
  assert.equal(failed.data.state, 'failed');assert.equal(failed.data.status, 504);assert.equal(failed.data.result.code, 'AI_JOB_TIMEOUT');
  finish();await new Promise(resolve => setImmediate(resolve));
  const late = response();await jobs.poll({ params: { id: accepted.data.jobId } }, late);assert.equal(late.data.status, 504);
});

test('worker persistente travado finaliza a falha no armazenamento compartilhado', async () => {
  let record, finish;
  const store = { leaseMs: 30000, sweep: async () => {}, ref: () => ({path:'usuarios/local/_ai_jobs/teste'}),
    create: async (_, id, route) => { record = { route, createdAt: Date.now(), state: 'queued' }; },
    claim: async () => record.state === 'queued' ? { ...record, owner: 'worker' } : null,
    payload: async () => ({body:{},files:[],contentType:'application/json'}), heartbeat: async () => {},
    finish: async (_, id, task) => { record = {...record,...task}; }, read: async () => record, result: async () => record.result };
  const jobs = createJobs(async () => ({uid:'local'}), {store,maxDurationMs:10});
  const accepted = response();await jobs.wrap(async (_, output) => { await new Promise(resolve => { finish = resolve; });output.json({ok:true}); }, 'test')({headers:{'x-bud-async':'1'}}, accepted);
  await new Promise(resolve => setTimeout(resolve, 30));
  const failed=response();await jobs.poll({params:{id:accepted.data.jobId}},failed);assert.equal(failed.data.status,504);assert.equal(failed.data.state,'failed');
  finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(record.status,504);
});

