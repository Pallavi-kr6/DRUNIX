'use strict';
// Real integration: Fabric Gateway client against the Drunix test network (Fabric v2.5 programming model).
// propose() = evaluate + endorse (chaincode runs here, so chaincode rejections surface here).
// commit()  = order + wait for the committing peer's validation code (MVCC_READ_CONFLICT etc.).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { LedgerError } = require('./ledger-dev');

const TX_CODES = { 0: 'COMMITTED', 9: 'DUPLICATE_TXID', 10: 'ENDORSEMENT_POLICY_FAILURE', 11: 'MVCC_READ_CONFLICT', 12: 'PHANTOM_READ_CONFLICT', 22: 'BAD_RWSET', 254: 'NOT_VALIDATED', 255: 'INVALID_OTHER_REASON' };
const firstFile = (p) => (fs.statSync(p).isDirectory() ? path.join(p, fs.readdirSync(p).sort()[0]) : p);

function parseErr(e) {
  const text = [e.message, ...(e.details || []).map((d) => d.message)].join(' | ');
  const m = /RASID:([A-Z_]+):\s*([^|"\n]*)/.exec(text);
  return m ? new LedgerError('REJECTED_CHAINCODE', m[1], m[2].trim()) : new LedgerError('NETWORK_ERROR', 'ENDORSEMENT_FAILED', text.slice(0, 300));
}

class FabricLedger {
  constructor(cfg) { this.mode = 'drunix'; this.cfg = cfg; this.clients = new Map(); this.contracts = new Map(); this.ids = JSON.parse(fs.readFileSync(cfg.identitiesFile, 'utf8')); }
  cnOf(name) {
    const id = this.ids[name]; if (!id || !id.certPath) throw new Error(`identity ${name} missing in identities file`);
    const x = new crypto.X509Certificate(fs.readFileSync(firstFile(id.certPath)));
    return /CN=([^\n,]+)/.exec(x.subject)[1];
  }
  contract(name) {
    if (this.contracts.has(name)) return this.contracts.get(name);
    const grpc = require('@grpc/grpc-js'); const { connect, signers } = require('@hyperledger/fabric-gateway');
    const id = this.ids[name]; if (!id || !id.certPath) throw new LedgerError('NETWORK_ERROR', 'NO_IDENTITY', `no identity configured for ${name}`);
    let client = this.clients.get(id.peerEndpoint);
    if (!client) {
      client = new grpc.Client(id.peerEndpoint, grpc.credentials.createSsl(fs.readFileSync(id.tlsCertPath)), { 'grpc.ssl_target_name_override': id.hostAlias });
      this.clients.set(id.peerEndpoint, client);
    }
    const gw = connect({
      client, identity: { mspId: id.mspId, credentials: fs.readFileSync(firstFile(id.certPath)) },
      signer: signers.newPrivateKeySigner(crypto.createPrivateKey(fs.readFileSync(firstFile(id.keyPath)))),
    });
    const c = gw.getNetwork(this.cfg.channel).getContract(this.cfg.chaincode);
    this.contracts.set(name, c); return c;
  }
  async propose(identity, fn, args) {
    try {
      const proposal = this.contract(identity).newProposal(fn, { arguments: args.map(String) });
      const transaction = await proposal.endorse(); // chaincode simulated against the CURRENT state
      return { txId: proposal.getTransactionId(), transaction };
    } catch (e) { throw e instanceof LedgerError ? e : parseErr(e); }
  }
  async commit(p) {
    try {
      const submitted = await p.transaction.submit(); // sent to the ordering service
      const st = await submitted.getStatus();         // wait for the committing peer's verdict
      return { txId: p.txId, status: st.successful ? 'COMMITTED' : (TX_CODES[st.code] || `CODE_${st.code}`), blockNumber: Number(st.blockNumber) };
    } catch (e) { throw parseErr(e); }
  }
  async query(identity, fn, args) {
    try { return JSON.parse(Buffer.from(await this.contract(identity).evaluateTransaction(fn, ...args.map(String))).toString() || 'null'); }
    catch (e) { throw parseErr(e); }
  }
  async health() {
    try { const me = await this.query('OPERATOR', 'WhoAmI', []); return { ok: true, mode: 'drunix', detail: `connected as ${me.id}` }; }
    catch (e) { return { ok: false, mode: 'drunix', detail: `${e.code || ''} ${e.message}` }; }
  }
}
module.exports = { FabricLedger };
