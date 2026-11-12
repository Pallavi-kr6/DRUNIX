import { NavLink, Outlet } from 'react-router-dom';
import { Activity, ArrowLeftRight, FileText, Landmark, LayoutDashboard, LogOut, ScrollText, ShieldAlert, Umbrella } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAsync } from '../hooks/useAsync';
import { api } from '../services/api';
import { NAME } from '../lib/labels';

export const NAV = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/receivables', label: 'Receivables', icon: FileText },
  { to: '/transfer', label: 'Discount & transfer', icon: ArrowLeftRight, roles: ['OPERATOR', 'FINANCIER'] },
  { to: '/lab', label: 'Attack lab', icon: ShieldAlert, roles: ['OPERATOR', 'AUDITOR'] },
  { to: '/settlement', label: 'Settlement', icon: Landmark, roles: ['OPERATOR', 'AUDITOR'] },
  { to: '/exposure', label: 'Insurer exposure', icon: Umbrella, roles: ['INSURER', 'OPERATOR', 'AUDITOR'] },
  { to: '/audit', label: 'Audit timeline', icon: ScrollText, roles: ['OPERATOR', 'AUDITOR', 'FINANCIER'] },
  { to: '/network', label: 'Network', icon: Activity },
];

function NetworkBanner() {
  const { data: h, error } = useAsync(() => api.health(), []);
  if (error) return <div role="alert" className="mb-4 rounded-md border border-alert bg-alert-bg text-alert px-3 py-2 text-sm">API unreachable: {error}</div>;
  if (!h) return null;
  if (h.mode === 'dev') return <div role="note" data-testid="mode-banner" className="mb-4 rounded-md border border-amber bg-amber-bg text-amber px-3 py-2 text-sm"><b>DEV ENGINE – NOT DRUNIX.</b> Local mirror of the chaincode for UI work. Results here are not evidence of Drunix enforcement.</div>;
  return h.ok
    ? <div data-testid="mode-banner" className="mb-4 rounded-md border border-teal bg-teal-bg text-teal px-3 py-2 text-sm"><b>DRUNIX – CONNECTED.</b> {h.detail}</div>
    : <div role="alert" data-testid="mode-banner" className="mb-4 rounded-md border border-alert bg-alert-bg text-alert px-3 py-2 text-sm"><b>DRUNIX – NOT CONNECTED.</b> {h.detail}. No transaction will be simulated.</div>;
}

export default function AppLayout() {
  const { identity, role, logout } = useAuth();
  const items = NAV.filter((n) => !n.roles || n.roles.includes(role));
  return (
    <div className="min-h-screen grid md:grid-cols-[230px_1fr]">
      <nav aria-label="Main" className="bg-navy text-slate-300 p-3 flex md:flex-col flex-wrap gap-0.5">
        <div className="px-2 pt-1 pb-4 w-full"><div className="text-white text-xl font-semibold">Rasid</div><div className="text-[11px] text-slate-400">Position ledger</div></div>
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-navy-2 ${isActive ? 'bg-navy-2 text-white shadow-[inset_3px_0_0_#0f8f7e]' : ''}`}><Icon size={16} aria-hidden />{label}</NavLink>
        ))}
        <div className="md:mt-auto w-full border-t border-navy-2 pt-3 px-2 text-xs"><b className="block text-white" data-testid="whoami">{NAME[identity]}</b>
          <button onClick={logout} className="mt-1 flex items-center gap-1.5 text-slate-400 hover:text-white"><LogOut size={13} aria-hidden />Sign out</button></div>
      </nav>
      <main className="p-5 md:p-6 min-w-0"><NetworkBanner /><Outlet /></main>
    </div>
  );
}
