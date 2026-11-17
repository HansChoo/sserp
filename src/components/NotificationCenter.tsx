import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useErp } from '../context/ErpContext';

interface NotificationCenterProps {
  onOpenTask: (taskId: string) => void;
}

export function NotificationCenter({ onOpenTask }: NotificationCenterProps) {
  const {
    alerts,
    unreadAlertCount,
    markAllAlertsRead,
    markAlertRead,
    notificationPermission,
    requestBrowserNotificationPermission,
  } = useErp();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="업무 알림 센터 열기"
        className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 bg-white transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unreadAlertCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[11px] font-mono-tabular font-semibold rounded-full flex items-center justify-center">
            {unreadAlertCount > 9 ? '9+' : unreadAlertCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-slate-900">
                일정 및 마감 알림 ({alerts.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                지연 · 오늘 마감 · D-1/D-3 임박 기준
              </p>
            </div>
            {unreadAlertCount > 0 && (
              <button
                type="button"
                onClick={markAllAlertsRead}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>모두 읽음</span>
              </button>
            )}
          </div>

          {notificationPermission !== 'granted' &&
            notificationPermission !== 'unsupported' && (
              <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between gap-2">
                <span className="text-xs text-blue-900">
                  데스크톱 브라우저 알림이 꺼져 있습니다.
                </span>
                <button
                  type="button"
                  onClick={requestBrowserNotificationPermission}
                  className="px-3 py-1 text-xs font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-800 whitespace-nowrap"
                >
                  알림 허용
                </button>
              </div>
            )}

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-200/70">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                현재 지연되거나 마감이 임박한 알림이 없습니다.
              </div>
            ) : (
              alerts.map((alert) => {
                const tierColor =
                  alert.tier === 'overdue'
                    ? 'text-red-700'
                    : alert.tier === 'due_today' || alert.tier === 'due_d1'
                      ? 'text-amber-700'
                      : 'text-blue-700';
                return (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => {
                      markAlertRead(alert.id);
                      onOpenTask(alert.taskId);
                      setOpen(false);
                    }}
                    className={`w-full px-4 py-3.5 text-left hover:bg-slate-50 transition-colors ${
                      alert.read ? 'opacity-70' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className={`font-semibold ${tierColor}`}>
                        {alert.title}
                      </span>
                      <span className="font-mono-tabular text-slate-400">
                        {alert.dueDate}
                      </span>
                    </div>
                    <div className="text-[13px] font-semibold text-slate-900 mt-1 truncate">
                      {alert.taskTitle}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                      {alert.body}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
