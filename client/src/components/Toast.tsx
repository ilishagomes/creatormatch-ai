import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { cx } from "./ui";

type ToastTone = "success" | "error" | "info";
interface Toast { id: number; tone: ToastTone; message: string }

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {});

/** Small notifications in the corner ("Draft saved", "Copied"). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={cx(
            "pointer-events-auto flex animate-toast-in items-center gap-2.5 rounded-xl border bg-white px-4 py-3 text-sm font-medium shadow-[var(--shadow-pop)]",
            t.tone === "success" && "border-emerald-200 text-emerald-800",
            t.tone === "error" && "border-red-200 text-red-800",
            t.tone === "info" && "border-line text-ink",
          )}>
            <Icon name={t.tone === "success" ? "checkCircle" : t.tone === "error" ? "alert" : "info"} className="size-4 shrink-0" />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
