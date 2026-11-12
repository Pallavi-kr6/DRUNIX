// All balances are integer paise. These helpers never use floating point for amounts.
export const inr = (p) => '₹' + Math.trunc(p / 100).toLocaleString('en-IN') + (p % 100 ? '.' + String(p % 100).padStart(2, '0') : '');
export const toPaise = (s) => {
  const m = /^\s*(\d[\d,]*)(?:\.(\d{1,2}))?\s*$/.exec(String(s));
  if (!m) return NaN;
  return Number(m[1].replace(/,/g, '')) * 100 + Number((m[2] || '').padEnd(2, '0') || 0);
};
export const uid = (p) => `${p}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
