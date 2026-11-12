'use strict';
// SIMULATED external systems. Every response carries simulated:true and the UI labels it.
const crypto = require('crypto');
const sha = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');

function verifyInvoice({ fuId, invoiceNo, buyer, amountPaise }) {
  const dup = /DUP/i.test(invoiceNo); // deterministic trigger so the failure path can be shown
  const checks = [
    { name: 'Duplicate-financing check (MonetaGo-style registry)', passed: !dup, detail: dup ? 'Invoice reference already financed' : 'No prior financing found' },
    { name: 'GST e-invoice IRN evidence', passed: true, detail: 'IRN hash kept as evidence' },
  ];
  return { simulated: true, passed: checks.every((c) => c.passed), checks, evidenceHash: sha({ fuId, invoiceNo, buyer, amountPaise }) };
}

function simulatePayment(fuId, amountPaise) {
  const paymentRef = 'SIM-PAY-' + crypto.randomBytes(5).toString('hex').toUpperCase();
  return { simulated: true, paymentRef, fuId, amountPaise, receivedAt: new Date().toISOString() };
}

function cersaiRecord(fu, positions, trail) {
  return {
    simulated: true, note: 'Filing-ready record only. Not filed with CERSAI. A ledger position is not legal title.',
    factoringUnit: fu.fuId, buyer: fu.buyer, outstandingPaise: fu.outstandingPaise, lifecycleStatus: fu.status,
    evidenceHash: fu.evidenceHash, holders: positions.map((p) => ({ holder: p.holderId, heldPaise: p.amountPaise, releasedPaise: p.releasedPaise })),
    events: trail.map((e) => ({ txId: e.txId, action: e.action, actor: e.actor, at: e.at })), generatedAt: new Date().toISOString(),
  };
}

// Illustrative policy: clearly labelled demo data, not an insurance integration.
function policyFor(fu, positions) {
  const coveragePct = 75;
  return {
    simulated: true, policyRef: 'ILLUSTRATIVE-POLICY-01', coveragePct,
    exposures: positions.filter((p) => p.amountPaise > 0).map((p) => ({ holder: p.holderId, heldPaise: p.amountPaise, coveredPaise: Math.floor((p.amountPaise * coveragePct) / 100) })),
    outstandingPaise: fu.outstandingPaise,
  };
}
module.exports = { verifyInvoice, simulatePayment, cersaiRecord, policyFor };
