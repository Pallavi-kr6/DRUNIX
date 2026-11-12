'use strict';
// Registers the demo participants on the ledger. Safe to re-run.
const ROLES = { OPERATOR: 'OPERATOR', FINANCIER_A: 'FINANCIER', FINANCIER_B: 'FINANCIER', FINANCIER_C: 'FINANCIER', FINANCIER_D: 'FINANCIER', INSURER: 'INSURER', AUDITOR: 'AUDITOR' };

async function seedParticipants(ledger, log = () => {}) {
  try { await ledger.commit(await ledger.propose('OPERATOR', 'BootstrapOperator', ['OPERATOR'])); log('operator bound'); }
  catch (e) { if (e.code !== 'ALREADY_BOOTSTRAPPED') throw e; log('operator already bound'); }
  for (const [name, role] of Object.entries(ROLES)) {
    if (name === 'OPERATOR') continue;
    const msp = ledger.mode === 'dev' ? 'DevMSP' : ledger.ids[name].mspId;
    const r = await ledger.commit(await ledger.propose('OPERATOR', 'RegisterParticipant', [ledger.cnOf(name), name, role, msp]));
    log(`${name} (${role}): ${r.status}`);
  }
}
module.exports = { seedParticipants, ROLES };
