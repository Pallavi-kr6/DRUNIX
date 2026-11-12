import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { api } from '../services/api';
import { Button, Card, Empty, ErrorBox, Field, Loading, PageHeader } from '../components/Ui';
import { SimChip, StatusChip } from '../components/Chips';
import { PositionBar } from '../components/PositionBar';
import { TxResult } from '../components/TxResult';
import { inr, toPaise, uid } from '../lib/money';

function RegisterForm({ onDone }) {
  const toast = useToast(); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState({}); const [result, setResult] = useState(null); const [checks, setChecks] = useState(null);
  const submit = async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const er = {};
    if (!/^[A-Za-z0-9_.-]{3,40}$/.test(f.fuId)) er.fuId = 'Use 3–40 letters, digits, - _ .';
    if (f.buyer.trim().length < 2) er.buyer = 'Buyer name required';
    if (!f.invoiceNo.trim()) er.invoiceNo = 'Invoice number required';
    const amountPaise = toPaise(f.amount); if (!(amountPaise > 0)) er.amount = 'Enter an amount such as 4,80,000';
    setErrs(er); if (Object.keys(er).length) return;
    setBusy(true); const r = await api.register({ fuId: f.fuId, buyer: f.buyer, invoiceNo: f.invoiceNo, amountPaise, requestRef: uid(f.fuId) }); setBusy(false);
    setResult(r); setChecks(r.data.checks || null); toast(r.data.outcome === 'ACCEPTED' ? `${f.fuId} registered on the ledger` : `Not registered: ${r.data.reasonCode || r.data.error}`); if (r.data.outcome === 'ACCEPTED') onDone();
  };
  const E = ({ k }) => (errs[k] ? <span role="alert" className="text-alert text-xs">{errs[k]}</span> : null);
  return (
    <Card><h2 className="font-semibold text-sm mb-3 flex items-center gap-2">Register factoring unit <SimChip>invoice verification SIMULATED</SimChip></h2>
      <form onSubmit={submit} noValidate className="flex flex-wrap items-start gap-3">
        <Field label="Unit ID"><input name="fuId" defaultValue={`FU-${Math.floor(1000 + Math.random() * 8999)}`} /><E k="fuId" /></Field>
        <Field label="Buyer"><input name="buyer" defaultValue="Acme Retail Ltd (illustrative)" /><E k="buyer" /></Field>
        <Field label="Invoice no."><input name="invoiceNo" defaultValue={`INV-${Math.floor(Math.random() * 9999)}`} /><E k="invoiceNo" /></Field>
        <Field label="Amount (₹)"><input name="amount" defaultValue="4,80,000" inputMode="decimal" /><E k="amount" /></Field>
        <Button className="mt-5" disabled={busy}>{busy ? 'Waiting for commit…' : 'Register'}</Button>
      </form>
      <p className="text-xs text-mute mt-2">Tip: an invoice number containing “DUP” triggers the simulated duplicate-financing failure.</p>
      {checks && <ul className="text-xs mt-2">{checks.map((c) => <li key={c.name}><SimChip>SIMULATED</SimChip> {c.name}: {c.passed ? 'passed' : 'failed'} – {c.detail}</li>)}</ul>}
      <div className="mt-3"><TxResult result={result} /></div>
    </Card>
  );
}

export default function Receivables() {
  const { role } = useAuth(); const { data, error, loading, reload } = useAsync(() => api.receivables(), []);
  return (
    <>
      <PageHeader title="Receivables" sub="Positions are read from the ledger. Nothing on this page is a cached balance." />
      <Card className="overflow-x-auto">
        {loading && !data ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : !data.length ? <Empty>No factoring units yet. {role === 'OPERATOR' ? 'Register one below.' : 'The operator registers units.'}</Empty> : (
          <table data-testid="receivables-table"><thead><tr><th>Unit</th><th>Buyer</th><th className="text-right">Outstanding</th><th className="min-w-[160px]">Holders</th><th>Status</th></tr></thead>
            <tbody>{data.map((r) => <tr key={r.fu.fuId}><td><Link className="font-semibold underline" to={`/receivables/${r.fu.fuId}`}>{r.fu.fuId}</Link></td><td>{r.fu.buyer}</td><td className="text-right">{inr(r.fu.outstandingPaise)}</td><td><PositionBar positions={r.positions} outstanding={r.fu.outstandingPaise} /></td><td><StatusChip status={r.fu.status} /></td></tr>)}</tbody></table>)}
      </Card>
      {role === 'OPERATOR' && <RegisterForm onDone={reload} />}
    </>
  );
}
