const { AsyncLocalStorage } = require('node:async_hooks');
const { randomUUID } = require('node:crypto');
const context = new AsyncLocalStorage();

function report(message) {
  const job = context.getStore();
  if (job && !job.signal?.aborted) job.message = message;
}

const MAX_DURATION_MS = 180_000;
const timeoutResult = () => ({ error: 'A leitura excedeu o tempo disponível e foi encerrada. Tente novamente.', code: 'AI_JOB_TIMEOUT' });
function createJobs(authenticate, { store, maxDurationMs = MAX_DURATION_MS } = {}) {
  if (store) return createPersistentJobs(authenticate, store, maxDurationMs);
  const jobs = new Map();
  function prune() {
    for (const [id, job] of jobs) {
      if (job.finishedAt && Date.now() - job.finishedAt > 30 * 60_000) jobs.delete(id);
    }
  }
  function wrap(handler) {
    return async function (req, res) {
      if (req.headers['x-bud-async'] !== '1') return handler(req, res);
      const user = req.budUser || await authenticate(req, res);
      if (!user) return;
      prune();
      if ([...jobs.values()].filter(j => j.uid === user.uid && !j.finishedAt).length >= 2) {
        return res.status(409).json({ error: 'Já há duas leituras em andamento. Aguarde a conclusão.' });
      }
      const id = randomUUID();
      const controller = new AbortController();
      const job = { uid: user.uid, signal: controller.signal, message: 'Preparando leitura...', state: 'running', createdAt: Date.now() };
      jobs.set(id, job);
      res.status(202).json({ jobId: id });
      // A resposta de trabalho fica isolada da conexão HTTP que já terminou.
      const output = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(data) {
          if (job.finishedAt) return this;
          job.status = this.statusCode;
          job.result = data;
          job.state = this.statusCode < 400 ? 'completed' : 'failed';
          job.finishedAt = Date.now();
          clearTimeout(deadline);
          return this;
        },
      };
      const deadline = setTimeout(() => { output.status(504).json(timeoutResult()); controller.abort(); }, maxDurationMs);
      deadline.unref?.();
      context.run(job, () => {
        Promise.resolve(handler(req, output)).catch(error => {
          console.error('[IA job]', error.message);
          output.status(500).json({ error: 'Não foi possível concluir a leitura. Tente novamente.' });
        });
      });
    };
  }
  async function poll(req, res) {
    const user = await authenticate(req, res);
    if (!user) return;
    prune();
    const job = jobs.get(req.params.id);
    if (!job || job.uid !== user.uid) return res.status(404).json({ error: 'Leitura não encontrada. O servidor pode ter reiniciado; reenvie o arquivo.' });
    res.set('Cache-Control', 'no-store');
    res.json({ state: job.state, message: job.message, status: job.status, result: job.result });
  }
  return { wrap, poll };
}

function requestPayload(req) {
  const file = value => value ? { mimetype: value.mimetype, originalname: value.originalname || 'documento', buffer: value.buffer.toString('base64') } : null;
  return { body: req.body || {}, file: file(req.file), files: (req.files || []).map(file), contentType: req.headers['content-type'] || '' };
}

function createPersistentJobs(authenticate, store, maxDurationMs) {
  const handlers = new Map(), running = new Map();
  const cleanup = () => store.sweep().catch(error => console.error('[IA cleanup]', error.code || 'storage-unavailable'));
  void cleanup();
  const cleanupTimer = setInterval(cleanup, 60000);cleanupTimer.unref?.();
  async function run(id, user) {
    if (running.has(id)) return;
    const controller = new AbortController();
    const task = { id, uid: user.uid, signal: controller.signal, message: 'Lendo documento...' };
    running.set(id, task);
    let timer, deadline;
    try {
      const claimed = await store.claim(user.uid, id);
      if (!claimed) return;
      Object.assign(task, { owner: claimed.owner, documentPath: store.ref(user.uid, id).path, quotaApplied: !!claimed.quotaApplied });
      timer = setInterval(() => store.heartbeat(user.uid, id, task.message).catch(() => {}), Math.max(50, Math.floor(store.leaseMs / 3)));
      timer.unref?.();
      const output = { statusCode: 200, status(code) { this.statusCode = code;return this; }, json(result) {
        if (controller.signal.aborted) return this;
        task.status = this.statusCode;task.result = result;task.state = this.statusCode < 400 ? 'completed' : 'failed';return this;
      } };
      try {
        const data = await store.payload(user.uid, id, claimed);
        const file = value => value ? { ...value, buffer: Buffer.from(value.buffer, 'base64') } : undefined;
        const req = { body: data.body, budUser: user, headers: { 'content-type': data.contentType }, file: file(data.file), files: data.files.map(file),
          is: type => data.contentType.split(';')[0] === type };
        const handler = handlers.get(claimed.route);
        if (!handler) throw new Error('Leitor temporariamente indisponível.');
        await Promise.race([
          context.run(task, () => handler(req, output)),
          new Promise((_, reject) => { deadline = setTimeout(() => {
            controller.abort();reject(Object.assign(new Error('Leitura excedeu o prazo.'), { code: 'AI_JOB_TIMEOUT' }));
          }, Math.max(1, maxDurationMs - (Date.now() - claimed.createdAt)));deadline.unref?.(); })
        ]);
        if (!task.state) throw new Error('Leitor não concluiu a resposta.');
      } catch (error) {
        console.error('[IA reader]', error.code || error.name || 'read-failed');
        if (error.code === 'AI_JOB_TIMEOUT') Object.assign(task, { status: 504, state: 'failed', result: timeoutResult() });
        else output.status(500).json({ error: 'Não foi possível concluir a leitura. Tente novamente.' });
      }
      await store.finish(user.uid, id, task);
    } catch (error) { console.error('[IA persistent job]', error.code || 'storage-unavailable'); }
    finally { if (timer) clearInterval(timer);if (deadline) clearTimeout(deadline);running.delete(id); }
  }
  function wrap(handler, route) {
    if (!route || handlers.has(route)) throw new Error('Identificador único de leitor necessário.');
    handlers.set(route, handler);
    return async (req, res) => {
      if (req.headers['x-bud-async'] !== '1') return handler(req, res);
      const user = req.budUser || await authenticate(req, res);
      if (!user) return;
      const id = randomUUID();
      try {
        await store.create(user.uid, id, route, requestPayload(req));
        res.status(202).json({ jobId: id });
        void run(id, user);
      } catch (error) { res.status(error.status || 503).json({ error: error.status === 409 ? error.message : 'Não foi possível preparar a leitura. Tente novamente.' }); }
    };
  }
  async function poll(req, res) {
    const user = await authenticate(req, res);
    if (!user) return;
    const id = req.params.id;
    if (!/^[\da-f-]{36}$/i.test(id)) return res.status(404).json({ error: 'Leitura não encontrada.' });
    res.set('Cache-Control', 'no-store');
    try {
      const data = await store.read(user.uid, id);
      if (!data) return res.status(404).json({ error: 'Leitura expirada ou não encontrada. Reenvie o documento.' });
      if (data.state === 'completed' || data.state === 'failed') {
        return res.json({ state: data.state, status: data.status, result: await store.result(user.uid, id, data), message: data.message });
      }
      void run(id, user);
      return res.json({ state: 'running', message: running.get(id)?.message || data.message || 'Retomando leitura...' });
    } catch (_) { return res.status(503).json({ error: 'A leitura foi preservada, mas o acompanhamento está temporariamente indisponível. Tente novamente.' }); }
  }
  return { wrap, poll };
}

module.exports = { createJobs, report, currentJob: () => context.getStore() };

