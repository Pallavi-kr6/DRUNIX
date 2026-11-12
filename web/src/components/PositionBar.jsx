import { HOLDER_COLOR, NAME } from '../lib/labels';
import { inr } from '../lib/money';
export function PositionBar({ positions, outstanding }) {
  const segs = positions.filter((p) => p.amountPaise > 0);
  return (
    <div className="flex h-5 rounded overflow-hidden bg-line min-w-[120px]" role="img" aria-label="Position split">
      {segs.map((p) => <i key={p.holderId} title={`${p.holderId} ${inr(p.amountPaise)}`} className="block h-full border-r-2 border-white last:border-0" style={{ width: `${(p.amountPaise / outstanding) * 100}%`, background: HOLDER_COLOR[p.holderId] || '#5d6b80' }} />)}
    </div>
  );
}
export const PositionLegend = ({ positions, outstanding }) => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
    {positions.map((p) => (
      <li key={p.holderId} className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: HOLDER_COLOR[p.holderId] || '#5d6b80' }} />{NAME[p.holderId] || p.holderId} {((p.amountPaise / outstanding) * 100).toFixed(0)}% · {inr(p.amountPaise)}{p.releasedPaise ? ` (released ${inr(p.releasedPaise)})` : ''}</li>
    ))}
  </ul>
);
