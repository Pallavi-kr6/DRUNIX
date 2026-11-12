import { useState } from 'react';
import { api } from '../services/api';
import { Button, Card, ErrorBox, Field, Mono, PageHeader } from '../components/Ui';
import { OutcomeChip, SimChip, StatusChip } from '../components/Chips';
import { PositionBar, PositionLegend } from '../components/PositionBar';
import { inr } from '../lib/money';
import { NAME } from '../lib/labels';

const STEPS = [
  [1, 'Register', 'Create the unit for ₹4,80,000. Simulated checks run; buyer acceptance recorded.'],
  [2, 'Discount', 'Financier A takes 100%.'],
  [3, 'Re-discount', 'A transfers 60% to Financier B.'],
  [4, 'Attack', 'Two sales of A’s remaining 40%, endorsed on the same state before either is submitted.'],
  [5, 'Break the rules', 'Over-balance, non-holder, invalid lifecycle, replay, unauthorised role.'],
  [6, 'Settle', 'Simulated payment, one-time release, replay refused, CERSAI-ready record.'],
];
const newRunId = () => `FU-2041-R${Date.now().toString(36).slice(-4).toUpperCase()}`;

function Outcomes({ rows }) {
  return (
    <div className="overflow-x-auto"><table><thead><tr><th>Actor</th><th>Action</th><th>Outcome</th><th>Detail</th></tr></thead>
      <tbody>{rows.map((x) => <tr key={x.requestRef + x.action}><td>{NAME[x.actor] || x.actor}</td><td>{x.action}</td><td><OutcomeChip outcome={x.outcome} code={x.reasonCode} /></td><td>{x.message}{x.txId && <div><Mono>tx {x.txId}</Mono></div>}</td></tr>)}</tbody></table></div>
  );
}

function StepResult({ n, r }) {
  if (r.error) return <ErrorBox error={`${r.error}: ${r.message || ''}`} />;
  return (
    <div data-testid={`step-${n}-result`}>
      {n === 4 && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {r.outcomes.map((x) => { const won = x.outcome === 'ACCEPTED'; return (
              <div key={x.requestRef} data-testid={won ? 'attack-winner' : 'attack-loser'} className={`rounded-lg border-2 p-3 text-sm ${won ? 'border-teal bg-teal-bg' : 'border-alert bg-alert-bg'}`}>
                <b>A → {x.requestRef.endsWith('-C') ? 'Financier C' : 'Financier D'}</b> · {inr(r.attempted)}<div className="mt-1"><OutcomeChip outcome={x.outcome} code={x.reasonCode} /></div>
                <div className="mt-1"><Mono>tx {x.txId}</Mono>{x.blockNumber != null && <span className="text-xs"> · block {x.blockNumber}</span>}</div></div>); })}
          </div>
          <p className={`mt-2 text-sm font-semibold ${r.exactlyOne ? 'text-teal' : 'text-alert'}`}>{r.committed} of 2 committed. {r.exactlyOne ? 'Exactly one sale was accepted.' : 'Unexpected result: investigate before demoing.'}</p>
        </>)}
      {n !== 4 && r.outcomes && <Outcomes rows={r.outcomes} />}
      {r.simulated?.verification && <ul className="text-xs mt-2">{r.simulated.verification.checks.map((c) => <li key={c.name}><SimChip /> {c.name}: {c.passed ? 'passed' : 'failed'}</li>)}</ul>}
      {r.simulated?.payment && (
        <>
          <p className="mt-2 text-sm"><SimChip /> payment event <Mono>{r.simulated.payment.paymentRef}</Mono></p>
          <h3 className="text-sm font-semibold mt-3">CERSAI filing-ready record <SimChip>SIMULATED · not filed</SimChip></h3>
          <pre className="bg-navy text-slate-200 text-xs rounded-md p-3 overflow-auto max-h-72">{JSON.stringify(r.simulated.cersai, null, 2)}</pre>
        </>)}
      {r.final?.fu && <div className="mt-3 rounded-md border border-line p-3"><b className="text-sm">Ledger now</b> <StatusChip status={r.final.fu.status} /><div className="mt-2"><PositionBar positions={r.final.positions} outstanding={r.final.fu.outstandingPaise} /><PositionLegend positions={r.final.positions} outstanding={r.final.fu.outstandingPaise} /></div></div>}
    </div>
  );
}

export default function AttackLab() {
  const [fuId, setFuId] = useState('FU-2041'); const [pending, setPending] = useState(null); const [last, setLast] = useState(null);
  const run = async (n) => { setPending(n); const res = await api.demoStep(n, fuId.trim()).catch((e) => ({ data: { error: 'NETWORK', message: e.message } })); setPending(null); setLast({ n, r: { ...res.data } }); };
  return (
    <>
      <PageHeader title="Concurrency attack lab" sub="Each step runs real ledger transactions as the named identities and waits for the commit verdict." />
      <Card className="flex flex-wrap items-end gap-3"><Field label="Factoring unit ID"><input id="fu-id" aria-label="Factoring unit ID" value={fuId} onChange={(e) => setFuId(e.target.value)} /></Field><Button variant="alt" onClick={() => { setFuId(newRunId()); setLast(null); }}>New run ID</Button></Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4">
        {STEPS.map(([n, title, desc]) => (
          <div key={n} className="rounded-lg border border-line bg-white p-3"><b className="text-sm">{n}. {title}</b><p className="text-sm text-mute my-1.5">{desc}</p>
            <Button variant={n === 4 ? 'go' : 'primary'} disabled={pending !== null} onClick={() => run(n)} data-testid={`run-step-${n}`}>{pending === n ? 'Waiting for commit…' : `Run step ${n}`}</Button></div>))}
      </div>
      {last && <Card><h2 className="font-semibold text-sm mb-2">Step {last.n} result</h2><StepResult n={last.n} r={last.r} /></Card>}
    </>
  );
}
