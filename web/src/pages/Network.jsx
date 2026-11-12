import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { Button, Card, ErrorBox, Loading, PageHeader } from '../components/Ui';
export default function Network() {
  const { role } = useAuth(); const h = useAsync(() => api.health(), []); const m = useAsync(() => api.metrics(), []);
  if ((h.loading && !h.data) || (m.loading && !m.data)) return <Loading what="network status" />;
  if (h.error || m.error) return <ErrorBox error={h.error || m.error} onRetry={() => { h.reload(); m.reload(); }} />;
  const ms = (v) => (v == null ? 'n/a' : `${v} ms`);
  return (
    <>
      <PageHeader title="Network health & transaction status" sub="Connection status and measured latency. Nothing on this page is hard-coded."><Button variant="alt" onClick={() => { h.reload(); m.reload(); }}>Refresh</Button></PageHeader>
      <Card><p className="text-sm">Mode <b data-testid="net-mode">{h.data.mode}</b> · ledger {h.data.ok ? <span className="text-teal font-semibold">reachable</span> : <span className="text-alert font-semibold">unreachable</span>} · {h.data.detail}</p>
        <p className="text-sm mt-2">Successful transactions measured: <b>{m.data.samples}</b> · p50 <b>{ms(m.data.p50Ms)}</b> · p95 <b>{ms(m.data.p95Ms)}</b></p>
        <p className="text-xs text-mute mt-2">{m.data.note} Environment: {m.data.environment}. {m.data.mode === 'dev' ? 'Dev-engine timings say nothing about Drunix.' : ''}</p>
        {role && <p className="text-xs text-mute mt-2">For benchmark reports with sample counts, run <code>npm run benchmark</code> and <code>npm run verify:concurrency</code>; reports are written to <code>reports/</code>.</p>}</Card>
    </>
  );
}
