import { useSearchParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { api } from '../services/api';
import { Card, Empty, ErrorBox, Field, Loading, Mono, PageHeader } from '../components/Ui';
import { SimChip, StatusChip } from '../components/Chips';
import { inr } from '../lib/money';
import { NAME } from '../lib/labels';
export default function Exposure() {
  const [sp, setSp] = useSearchParams(); const list = useAsync(() => api.receivables(), []);
  const id = sp.get('fu') || list.data?.[0]?.fu.fuId;
  const x = useAsync(() => (id ? api.exposure(id) : Promise.resolve({ ok: true, data: null })), [id]);
  if (list.loading && !list.data) return <Loading />;
  if (list.error) return <ErrorBox error={list.error} onRetry={list.reload} />;
  return (
    <>
      <PageHeader title="Insurer exposure" sub="Read-only. Holdings come from the ledger; the policy is illustrative demo data, not an insurer integration."><SimChip>SIMULATED policy · {x.data?.coveragePct ?? 75}% cover</SimChip></PageHeader>
      {!list.data.length ? <Empty>No factoring units yet.</Empty> : (
        <>
          <Card><Field label="Factoring unit"><select value={id} onChange={(e) => setSp({ fu: e.target.value })}>{list.data.map((r) => <option key={r.fu.fuId}>{r.fu.fuId}</option>)}</select></Field></Card>
          {x.loading && !x.data ? <Loading what="exposure" /> : x.error ? <ErrorBox error={x.error} onRetry={x.reload} /> : x.data && (
            <Card className="overflow-x-auto">
              <p className="text-sm mb-2">Outstanding <b>{inr(x.data.outstandingPaise)}</b> · financed <b>{inr(x.data.allocatedPaise)}</b> · <StatusChip status={x.data.status} /> · policy <Mono>{x.data.policyRef}</Mono></p>
              <table><thead><tr><th>Holder</th><th className="text-right">Active exposure</th><th className="text-right">Covered (illustrative)</th></tr></thead>
                <tbody>{x.data.exposures.length ? x.data.exposures.map((e) => <tr key={e.holder}><td>{NAME[e.holder] || e.holder}</td><td className="text-right">{inr(e.heldPaise)}</td><td className="text-right">{inr(e.coveredPaise)}</td></tr>) : <tr><td colSpan={3} className="text-mute">No active positions (released or not yet discounted).</td></tr>}</tbody></table>
            </Card>)}
        </>)}
    </>
  );
}
