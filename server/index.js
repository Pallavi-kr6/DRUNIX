'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const { LedgerError } = require('./ledger-dev');
const { seedParticipants, ROLES } = require('./seed');
const ad = require('./adapters');

function makeLedger() {
  if ((process.env.LEDGER_MODE || 'drunix') === 'dev') return new (require('./ledger-dev').DevLedger)();
  return new (require('./ledger-fabric').FabricLedger)({ channel: process.env.CHANNEL || 'mychannel', chaincode: process.env.CHAINCODE || 'rasid', identitiesFile: process.env.IDENTITIES_FILE || './identities.json' });
}

function createApp({ ledger, dataDir = process.env.DATA_DIR || './data', secret = process.env.SESSION_SECRET || 'dev-secret', password = process.env.RASID_DEMO_PASSWORD || 'rasid-demo' }) {
  fs.mkdirSync(dataDir, { recursive: true });
  const auditFile = path.join(dataDir, 'audit.jsonl'); // append-only attempt log (all outcomes)
  const latencies = [];
  const roleOf = (id) => ROLES[id];
  const sign = (s) => crypto.createHmac('sha256', secret).update(s).digest('base64url');
  const issue = (id) => { const b = Buffer.from(JSON.stringify({ id, exp: Date.now() + 8 * 3600e3 })).toString('base64url'); return `${b}.${sign(b)}`; };
  const verify = (t = '') => { const [b, s] = t.split('.'); if (!b || s !== sign(b)) return null; const p = JSON.parse(Buffer.from(b, 'base64url')); return p.exp > Date.now() ? p.id : null; };

  // Hash-chained, append-only application audit log. Records are only ever appended (flag 'a'); each carries seq,
  // prevHash and hash so silent edits/deletions are detectable via GET /api/audit/verify. Single-process writer.
  const sha = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
  let seq = 0; let prev = '0'.repeat(64);
  if (fs.existsSync(auditFile)) for (const l of fs.readFileSync(auditFile, 'utf8').split('\n').filter(Boolean)) { try { const r = JSON.parse(l); seq = r.seq; prev = r.hash; } catch { /* verify reports it */ } }
  const log = (rec) => { const body = { ...rec, seq: ++seq, prevHash: prev }; body.hash = sha(body); prev = body.hash; fs.appendFileSync(auditFile, JSON.stringify(body) + '\n', { flag: 'a' }); return body; };
  const verifyChain = () => {
    let p = '0'.repeat(64); let n = 0; if (!fs.existsSync(auditFile)) return { ok: true, records: 0 };
    for (const l of fs.readFileSync(auditFile, 'utf8').split('\n').filter(Boolean)) {
      let r; try { r = JSON.parse(l); } catch { return { ok: false, records: n, brokenAt: n + 1, reason: 'unparseable record' }; }
      const { hash, ...rest } = r; n++;
      if (r.seq !== n || r.prevHash !== p || sha(rest) !== hash) return { ok: false, records: n, brokenAt: n, reason: 'chain mismatch' };
      p = hash;
    }
    return { ok: true, records: n };
  };
  const attempts = (fuId) => (fs.existsSync(auditFile) ? fs.readFileSync(auditFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []).filter((r) => !fuId || r.fuId === fuId);

  // One ledger mutation: propose (endorse) -> commit -> classify -> append to audit log. Never throws.
  const finish = (rec, p, c, t0) => {
    const ok = c.status === 'COMMITTED';
    if (ok) latencies.push(Math.round(performance.now() - t0));
    return log({ ...rec, txId: p.txId, blockNumber: c.blockNumber, outcome: ok ? 'ACCEPTED' : 'REJECTED_COMMIT', reasonCode: ok ? null : c.status, message: ok ? 'Validated and committed' : 'Rejected by commit-time validation; no state change' });
  };
  const fail = (rec, e) => log({ ...rec, txId: null, outcome: e.kind === 'REJECTED_CHAINCODE' ? 'REJECTED_CHAINCODE' : 'ERROR', reasonCode: e.code || 'INTERNAL', message: e.message });
  async function exec(identity, action, fuId, fn, args, ref) {
    const rec = { ts: new Date().toISOString(), actor: identity, action, fuId, requestRef: ref }; const t0 = performance.now();
    try { const p = await ledger.propose(identity, fn, args); return finish(rec, p, await ledger.commit(p), t0); }
    catch (e) { return fail(rec, e instanceof LedgerError ? e : new LedgerError('ERROR', 'INTERNAL', e.message)); }
  }
  const state = async (id, fuId) => {
    const fu = await ledger.query(id, 'GetFactoringUnit', [fuId]); const positions = await ledger.query(id, 'GetPositions', [fuId]);
    const allocated = positions.reduce((s, p) => s + p.amountPaise, 0);
    return { fu, positions, allocatedPaise: allocated, unallocatedPaise: fu.outstandingPaise - allocated };
  };

  const app = express(); app.use(express.json());
  app.get('/api/health', (_q, r) => r.json({ ok: true }));
  app.post('/api/login', (req, res) => {
    const { identity, password: pw } = req.body || {};
    if (!ROLES[identity] || pw !== password) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    res.json({ token: issue(identity), identity, role: ROLES[identity] });
  });
  app.use('/api', (req, res, next) => {
    if (req.path === '/health' || req.path === '/login') return next();
    const id = verify((req.headers.authorization || '').replace('Bearer ', '')); if (!id) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    req.id = id; req.role = roleOf(id); next();
  });
  const wrap = (f) => async (req, res) => { try { await f(req, res); } catch (e) { res.status(e.code === 'FU_NOT_FOUND' ? 404 : e.code === 'NO_POSITION' ? 422 : 500).json({ error: e.code || 'INTERNAL', message: e.message }); } };
  const send = (res, rec, extra = {}) => res.status(rec.outcome === 'ACCEPTED' ? 200 : rec.outcome === 'REJECTED_COMMIT' ? 409 : 422).json({ ...rec, ...extra });

  app.get('/api/audit/verify', (req, res) => (['AUDITOR', 'OPERATOR'].includes(req.role) ? res.json(verifyChain()) : res.status(403).json({ error: 'ROLE_NOT_AUTHORISED' })));
  app.get('/api/audit/recent', (req, res) => res.json(attempts().filter((r) => req.role !== 'FINANCIER' || r.actor === req.id).slice(-20).reverse()));
  app.get('/api/network/health', wrap(async (_q, r) => r.json(await ledger.health())));
  app.get('/api/metrics', (_q, r) => {
    const s = [...latencies].sort((a, b) => a - b); const q = (p) => (s.length ? s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)] : null);
    r.json({ mode: ledger.mode, samples: s.length, p50Ms: q(0.5), p95Ms: q(0.95), environment: `${ledger.mode} · node ${process.version} · ${process.platform}`, note: 'Measured propose→commit latency of successful transactions since server start.' });
  });
  app.get('/api/receivables', wrap(async (req, res) => {
    const list = await ledger.query(req.id, 'ListFactoringUnits', []);
    res.json(await Promise.all(list.map((fu) => state(req.id, fu.fuId))));
  }));
  app.get('/api/receivables/:id', wrap(async (req, res) => res.json(await state(req.id, req.params.id))));

  // Mutations: validation -> server-side role check -> ledger. The chaincode re-checks role from the network identity.
  const ALLOW = { register: ['OPERATOR'], accept: ['OPERATOR'], discount: ['FINANCIER'], transfer: ['FINANCIER'], release: ['FINANCIER'], settle: ['OPERATOR'] };
  const ref = z.string().min(3).max(80).regex(/^[A-Za-z0-9:_.-]+$/);
  const fuIdZ = z.string().min(3).max(40).regex(/^[A-Za-z0-9_.-]+$/);
  const amt = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
  const mutation = (action, schema, build) => wrap(async (req, res) => {
    const base = { ts: new Date().toISOString(), actor: req.id, action: action.toUpperCase(), fuId: req.params.id || req.body?.fuId, requestRef: req.body?.requestRef };
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return send(res, log({ ...base, txId: null, outcome: 'REJECTED_API', reasonCode: 'INVALID_REQUEST', message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }));
    if (!ALLOW[action].includes(req.role)) return send(res, log({ ...base, txId: null, outcome: 'REJECTED_API', reasonCode: 'ROLE_NOT_AUTHORISED', message: `${req.role} may not ${action}` }));
    const b = build(parsed.data, req); if (b.precheck) return send(res, log({ ...base, txId: null, ...b.precheck }), { simulated: true, checks: b.checks });
    const rec = await exec(req.id, base.action, base.fuId, b.fn, b.args, parsed.data.requestRef); send(res, rec, b.extra);
  });
  app.post('/api/receivables', mutation('register', z.object({ fuId: fuIdZ, buyer: z.string().min(2).max(80), invoiceNo: z.string().min(1).max(40), amountPaise: amt, requestRef: ref }), (d) => {
    const v = ad.verifyInvoice(d);
    if (!v.passed) return { precheck: { outcome: 'REJECTED_PRECHECK', reasonCode: 'SIMULATED_VERIFICATION_FAILED', message: v.checks.filter((c) => !c.passed).map((c) => c.detail).join('; ') + ' (SIMULATED adapter)' }, checks: v.checks };
    return { fn: 'RegisterFactoringUnit', args: [d.fuId, d.buyer, d.amountPaise, v.evidenceHash, d.requestRef], extra: { simulated: true, checks: v.checks } };
  }));
  const one = (action, fn, schemaExtra = {}, mk = (d, req) => [req.params.id, d.requestRef], alias = '') => app.post([`/api/receivables/:id/${action}`, ...(alias ? [`/api/receivables/:id/${alias}`] : [])], mutation(action, z.object({ requestRef: ref, ...schemaExtra }), (d, req) => ({ fn, args: mk(d, req) })));
  one('accept', 'AcceptFactoringUnit');
  one('discount', 'DiscountFactoringUnit');
  one('transfer', 'TransferPosition', { toHolderId: z.string(), amountPaise: amt }, (d, r) => [r.params.id, d.toHolderId, d.amountPaise, d.requestRef], 'transfers');
  one('release', 'ReleasePosition', { amountPaise: amt }, (d, r) => [r.params.id, d.amountPaise, d.requestRef]);
  app.post('/api/receivables/:id/settle', wrap(async (req, res) => {
    if (req.role !== 'OPERATOR') return send(res, log({ ts: new Date().toISOString(), actor: req.id, action: 'SETTLE', fuId: req.params.id, outcome: 'REJECTED_API', reasonCode: 'ROLE_NOT_AUTHORISED', message: `${req.role} may not settle` }));
    const fu = await ledger.query(req.id, 'GetFactoringUnit', [req.params.id]);
    const pay = req.body?.paymentRef ? { simulated: true, paymentRef: req.body.paymentRef } : ad.simulatePayment(fu.fuId, fu.outstandingPaise);
    const rec = await exec(req.id, 'SETTLE', fu.fuId, 'SettleReceivable', [fu.fuId, pay.paymentRef], pay.paymentRef); send(res, rec, { payment: pay });
  }));
  app.get('/api/receivables/:id/audit', wrap(async (req, res) => {
    const onChain = await ledger.query(req.id, 'GetAuditTrail', [req.params.id]);
    let a = attempts(req.params.id); if (req.role === 'FINANCIER') a = a.filter((r) => r.actor === req.id); if (req.role === 'INSURER') a = []; // insurers get the read-only exposure view, not attempt logs
    res.json({ onChain, attempts: a });
  }));
  app.get('/api/receivables/:id/cersai', wrap(async (req, res) => {
    const s = await state(req.id, req.params.id); res.json(ad.cersaiRecord(s.fu, s.positions, await ledger.query(req.id, 'GetAuditTrail', [req.params.id])));
  }));
  app.get('/api/receivables/:id/exposure', wrap(async (req, res) => {
    if (!['INSURER', 'AUDITOR', 'OPERATOR'].includes(req.role)) return res.status(403).json({ error: 'ROLE_NOT_AUTHORISED' });
    const s = await state(req.id, req.params.id); res.json({ ...ad.policyFor(s.fu, s.positions), status: s.fu.status, allocatedPaise: s.allocatedPaise });
  }));

  // ---- Demo runner: acts as the named identities against the real ledger path ----
  const demoOnly = (req, res) => (req.role === 'OPERATOR' || req.role === 'AUDITOR' ? false : (res.status(403).json({ error: 'ROLE_NOT_AUTHORISED', message: 'Demo runner is for Operator or Auditor' }), true));
  async function attack(fuId, tag = 'atk') {
    const A = 'FINANCIER_A'; const pos = (await ledger.query(A, 'GetPositions', [fuId])).find((p) => p.holderId === A);
    const amount = pos?.amountPaise; if (!amount) throw Object.assign(new Error('Financier A holds no position to attack'), { code: 'NO_POSITION' });
    const specs = [['FINANCIER_C', `${fuId}:${tag}-C`], ['FINANCIER_D', `${fuId}:${tag}-D`]];
    const recs = specs.map(([to, r]) => ({ ts: new Date().toISOString(), actor: A, action: 'TRANSFER', fuId, requestRef: r, to }));
    const t0 = performance.now();
    // 1) both proposals execute/endorse against the SAME pre-transfer state, before either is submitted
    const props = []; for (const [to, r] of specs) props.push(await ledger.propose(A, 'TransferPosition', [fuId, to, amount, r]));
    // 2) then both are submitted together and we wait for the real commit verdicts
    const commits = await Promise.all(props.map((p) => ledger.commit(p).catch((e) => ({ txId: p.txId, status: e.code || 'ERROR' }))));
    const out = recs.map((rec, i) => finish(rec, props[i], commits[i], t0));
    const after = await state(A, fuId);
    return { attempted: amount, outcomes: out, committed: out.filter((o) => o.outcome === 'ACCEPTED').length, final: after, exactlyOne: out.filter((o) => o.outcome === 'ACCEPTED').length === 1 };
  }
  app.post('/api/demo/concurrency-run', wrap(async (req, res) => { if (demoOnly(req, res)) return; res.json(await attack(req.body?.fuId || 'FU-2041', req.body?.tag || 'atk')); }));
  app.post('/api/demo/step/:n', wrap(async (req, res) => {
    if (demoOnly(req, res)) return;
    const fuId = req.body?.fuId || 'FU-2041'; const n = Number(req.params.n); const R = (s) => `${fuId}:${s}`; const out = [];
    if (n === 1) {
      const v = ad.verifyInvoice({ fuId, invoiceNo: 'INV-2041', buyer: 'Acme Retail Ltd (illustrative)', amountPaise: 48000000 });
      out.push(await exec('OPERATOR', 'REGISTER', fuId, 'RegisterFactoringUnit', [fuId, 'Acme Retail Ltd (illustrative)', 48000000, v.evidenceHash, R('reg')], R('reg')));
      out.push(await exec('OPERATOR', 'ACCEPT', fuId, 'AcceptFactoringUnit', [fuId, R('acc')], R('acc')));
      return res.json({ step: n, simulated: { verification: v }, outcomes: out });
    }
    if (n === 2) out.push(await exec('FINANCIER_A', 'DISCOUNT', fuId, 'DiscountFactoringUnit', [fuId, R('disc')], R('disc')));
    if (n === 3) { const fu = await ledger.query('OPERATOR', 'GetFactoringUnit', [fuId]); out.push(await exec('FINANCIER_A', 'TRANSFER', fuId, 'TransferPosition', [fuId, 'FINANCIER_B', Math.floor((fu.outstandingPaise * 60) / 100), R('xfer-B')], R('xfer-B'))); }
    if (n === 4) return res.json({ step: n, ...(await attack(fuId)) });
    if (n === 5) {
      const pos = await ledger.query('OPERATOR', 'GetPositions', [fuId]); const b = pos.find((p) => p.holderId === 'FINANCIER_B')?.amountPaise || 0;
      const loser = ['FINANCIER_C', 'FINANCIER_D'].find((h) => !(pos.find((p) => p.holderId === h)?.amountPaise > 0)) || 'FINANCIER_D';
      const t = (who, label, to, a, r) => exec(who, label, fuId, 'TransferPosition', [fuId, to, a, r], r);
      out.push(await t('FINANCIER_B', 'TRANSFER (over balance)', 'FINANCIER_C', b + 1, R('bad-over')));
      out.push(await t(loser, 'TRANSFER (non-holder)', 'FINANCIER_B', 100, R('bad-nonholder')));
      out.push(await exec('OPERATOR', 'ACCEPT (invalid lifecycle)', fuId, 'AcceptFactoringUnit', [fuId, R('bad-life')], R('bad-life')));
      out.push(await t('FINANCIER_A', 'TRANSFER (replayed request)', 'FINANCIER_B', 1, R('xfer-B')));
      out.push(await t('INSURER', 'TRANSFER (unauthorised role)', 'FINANCIER_B', 100, R('bad-role')));
    }
    if (n === 6) {
      const fu = await ledger.query('OPERATOR', 'GetFactoringUnit', [fuId]); const pay = ad.simulatePayment(fuId, fu.outstandingPaise);
      out.push(await exec('OPERATOR', 'SETTLE', fuId, 'SettleReceivable', [fuId, pay.paymentRef], pay.paymentRef));
      out.push(await exec('OPERATOR', 'SETTLE (replayed reference)', fuId, 'SettleReceivable', [fuId, pay.paymentRef], pay.paymentRef));
      const s = await state('OPERATOR', fuId);
      return res.json({ step: n, simulated: { payment: pay, cersai: ad.cersaiRecord(s.fu, s.positions, await ledger.query('OPERATOR', 'GetAuditTrail', [fuId])) }, outcomes: out, final: s });
    }
    if (![1, 2, 3, 4, 5, 6].includes(n)) return res.status(404).json({ error: 'NO_SUCH_STEP' });
    res.json({ step: n, outcomes: out, final: await state('OPERATOR', fuId).catch(() => null) });
  }));
  // React build (web/dist) when present; otherwise the legacy static console in public/.
  const dist = path.join(__dirname, '..', 'web', 'dist'); const staticDir = fs.existsSync(dist) ? dist : path.join(__dirname, '..', 'public');
  app.use(express.static(staticDir)); app.get(/^\/(?!api\/).*/, (_q, r) => r.sendFile(path.join(staticDir, 'index.html')));
  return app;
}

module.exports = { createApp, makeLedger };
if (require.main === module) {
  (async () => {
    const ledger = makeLedger();
    if (ledger.mode === 'dev') { await seedParticipants(ledger); console.warn('⚠ DEV ENGINE active — this is NOT Drunix.'); }
    createApp({ ledger }).listen(process.env.PORT || 3000, () => console.log(`Rasid on :${process.env.PORT || 3000} (${ledger.mode})`));
  })();
}
