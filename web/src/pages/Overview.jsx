import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { api } from '../services/api';
import { Card, Empty, ErrorBox, Loading, PageHeader } from '../components/Ui';
import { OutcomeChip, StatusChip } from '../components/Chips';
import { inr } from '../lib/money';
import { NAME } from '../lib/labels';
export default function Overview() {
  const units = useAsync(() => api.receivables(), []); const recent = useAsync(() => api.recent(), []);
  if (units.loading && !units.data) return <Loading />;
  if (units.error) return <ErrorBox error={units.error} onRetry={units.reload} />;
  const list = units.data; const by = {};
  for (const r of list) { const k = r.fu.status; by[k] ||= { n: 0, outstanding: 0, allocated: 0 }; by[k].n++; by[k].outstanding += r.fu.outstandingPaise; by[k].allocated += r.allocatedPaise; }
  const live = list.filter((r) => r.fu.status !== 'SETTLED');
  return (
    <>
      <PageHeader title="Overview" sub="What Rasid manages: who holds how much of each discounted receivable, right now. All figures come from the ledger." />
      <Card>
        <p className="text-sm"><b data-testid="live-count">{live.length}</b> live factoring unit{live.length === 1 ? '' : 's'} · outstanding <b>{inr(live.reduce((s, r) => s + r.fu.outstandingPaise, 0))}</b> · financed <b>{inr(live.reduce((s, r) => s + r.allocatedPaise, 0))}</b> · {list.length - live.length} settled</p>
        {list.length === 0 ? <Empty>No factoring units yet. The operator registers units on the Receivables page, or run the six steps in the Attack lab.</Empty> : (
          <table className="mt-3"><thead><tr><th>Lifecycle status</th><th>Units</th><th className="text-right">Outstanding</th><th className="text-right">Currently allocated</th></tr></thead>
            <tbody>{Object.entries(by).map(([s, v]) => <tr key={s}><td><StatusChip status={s} /></td><td>{v.n}</td><td className="text-right">{inr(v.outstanding)}</td><td className="text-right">{inr(v.allocated)}</td></tr>)}</tbody></table>)}
      </Card>
      <Card><h2 className="font-semibold text-sm mb-2">Recent transactions</h2>
        {recent.loading && !recent.data ? <Loading what="activity" /> : recent.error ? <ErrorBox error={recent.error} /> : !recent.data.length ? <Empty>No activity recorded yet.</Empty> : (
          <div className="overflow-x-auto"><table><thead><tr><th>Time</th><th>Actor</th><th>Unit</th><th>Action</th><th>Outcome</th></tr></thead><tbody>
            {recent.data.slice(0, 8).map((r) => <tr key={r.seq}><td className="font-mono text-xs">{new Date(r.ts).toLocaleTimeString([], { hour12: false })}</td><td>{NAME[r.actor] || r.actor}</td><td><Link className="underline" to={`/receivables/${r.fuId}`}>{r.fuId}</Link></td><td>{r.action}</td><td><OutcomeChip outcome={r.outcome} code={r.reasonCode} /></td></tr>)}</tbody></table></div>)}
      </Card>
    </>
  );
}
