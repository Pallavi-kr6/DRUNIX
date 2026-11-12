import { createContext, useCallback, useContext, useState } from 'react';
const Ctx = createContext(() => {});
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const toast = useCallback((m) => { setMsg(m); setTimeout(() => setMsg(null), 6000); }, []);
  return <Ctx.Provider value={toast}>{children}{msg && <div role="status" className="fixed right-4 bottom-4 max-w-md rounded-lg bg-navy text-white px-4 py-3 shadow-lg">{msg}</div>}</Ctx.Provider>;
}
export const useToast = () => useContext(Ctx);
