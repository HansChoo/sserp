import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useErp } from '../context/ErpContext';

interface ToastStackProps {
  onOpenTask?: (taskId: string) => void;
}

export function ToastStack({ onOpenTask }: ToastStackProps) {
  const { toasts, dismissToast } = useErp();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((t) => {
        const icon =
          t.tone === 'danger' ? (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          ) : t.tone === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          ) : t.tone === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          );

        const borderClass =
          t.tone === 'danger'
            ? 'border-red-200'
            : t.tone === 'warning'
              ? 'border-amber-200'
              : t.tone === 'success'
                ? 'border-emerald-200'
                : 'border-slate-200';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto bg-white border ${borderClass} rounded-xl shadow-lg p-3.5 flex items-start gap-3 transition-all`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-900">
                {t.title}
              </div>
              {t.description && (
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  {t.description}
                </p>
              )}
              {t.taskId && onOpenTask && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenTask(t.taskId!);
                    dismissToast(t.id);
                  }}
                  className="mt-1.5 text-xs font-medium text-blue-700 hover:underline"
                >
                  업무 바로 보기
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="알림 닫기"
              className="p-1 text-slate-400 hover:text-slate-700 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
