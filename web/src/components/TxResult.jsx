import { OutcomeChip } from './Chips';
import { Mono } from './Ui';
// Shows a ledger outcome record exactly as the API reported it (after the commit verdict). Never optimistic.
export function TxResult({ result }) {
  if (!result) return null;
  const r = result.data || {};
  if (!r.outcome) return <p role="alert" className="text-alert text-sm">{r.message || r.error || `HTTP ${result.status}`}</p>;
  return (
    <div className="rounded-md border border-line p-3 text-sm" data-testid="tx-result">
      <div className="flex items-center gap-2"><OutcomeChip outcome={r.outcome} code={r.reasonCode} /><span className="text-mute">{r.action}</span></div>
      <p className="mt-1">{r.message}</p>
      {r.txId && <p className="mt-1 text-mute">tx <Mono>{r.txId}</Mono>{r.blockNumber != null && <> · block {r.blockNumber}</>}</p>}
      <p className="mt-1 text-mute text-xs">actor {r.actor} · ref <Mono>{r.requestRef}</Mono> · {new Date(r.ts).toLocaleTimeString()}</p>
    </div>
  );
}
