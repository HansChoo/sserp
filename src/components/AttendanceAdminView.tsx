import { useMemo, useState } from 'react';
import { Clock, ShieldAlert } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import {
  formatDurationMinutes,
  formatTimeKst,
  getLocalTodayStr,
} from '../utils/dateAndAlerts';
import { Avatar } from './Avatar';

export function AttendanceAdminView() {
  const { currentEmployee, employees, attendanceLogs } = useErp();
  const [rangeFilter, setRangeFilter] = useState<'today' | 'all'>('today');
  const [empFilter, setEmpFilter] = useState<string>('all');

  const today = getLocalTodayStr();

  const livePresence = useMemo(() => {
    return employees.map((emp) => {
      const todayLogs = attendanceLogs.filter(
        (l) => l.employeeId === emp.id && l.date === today,
      );
      const activeLog = todayLogs.find((l) => l.status === 'active');
      const latestLog = todayLogs[0];
      return {
        emp,
        isWorking: Boolean(activeLog),
        latestLog,
      };
    });
  }, [employees, attendanceLogs, today]);

  const filteredLogs = useMemo(() => {
    return attendanceLogs.filter((log) => {
      if (rangeFilter === 'today' && log.date !== today) return false;
      if (empFilter !== 'all' && log.employeeId !== empFilter) return false;
      return true;
    });
  }, [attendanceLogs, rangeFilter, empFilter, today]);

  if (currentEmployee?.role !== 'admin') {
    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <ShieldAlert className="w-7 h-7 text-red-600 mx-auto mb-3" />
        <p className="text-base font-semibold text-slate-900">
          관리자 전용 메뉴입니다
        </p>
        <p className="text-sm text-slate-500 mt-1.5">
          출퇴근 시간 및 근태 로그는 관리자(PM)만 열람할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Live Team Attendance Presence */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-slate-600" />
            <h2 className="text-[15px] font-semibold text-slate-900">
              오늘 실시간 출퇴근 현황 ({today})
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            직원 로그인 시 자동 출근 · 퇴근 버튼 클릭 시 자동 로그아웃
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {livePresence.map(({ emp, isWorking, latestLog }) => (
            <div
              key={emp.id}
              className="border border-slate-200/80 rounded-xl p-4 flex items-center gap-3 bg-slate-50/50"
            >
              <Avatar name={emp.name} src={emp.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900 truncate">
                    {emp.name}
                  </span>
                  <span
                    className={`text-xs font-semibold shrink-0 ${
                      isWorking
                        ? 'text-emerald-700'
                        : latestLog
                          ? 'text-slate-600'
                          : 'text-slate-400'
                    }`}
                  >
                    {isWorking
                      ? '근무중'
                      : latestLog
                        ? '퇴근 완료'
                        : '미출근'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono-tabular mt-1 truncate">
                  {latestLog
                    ? `출근 ${formatTimeKst(latestLog.checkInAt)}`
                    : `${emp.department} · 기록 없음`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Attendance Log Table */}
      <section className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="px-6 py-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl">
            <button
              type="button"
              onClick={() => setRangeFilter('today')}
              className={`px-3.5 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${
                rangeFilter === 'today'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              오늘 기록
            </button>
            <button
              type="button"
              onClick={() => setRangeFilter('all')}
              className={`px-3.5 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${
                rangeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              전체 이력
            </button>
          </div>

          <select
            value={empFilter}
            onChange={(e) => setEmpFilter(e.target.value)}
            aria-label="직원별 근태 필터"
            className="px-3.5 py-2 text-[13px] border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="all">전체 직원</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.department})
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70 text-xs font-semibold text-slate-500">
                <th className="px-6 py-3">날짜</th>
                <th className="px-6 py-3">직원</th>
                <th className="px-6 py-3">출근 시각</th>
                <th className="px-6 py-3">퇴근 시각</th>
                <th className="px-6 py-3 text-right">근무 시간</th>
                <th className="px-6 py-3 text-right">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-[13px]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    조회된 출퇴근 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const emp = employees.find((e) => e.id === log.employeeId);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-3.5 font-mono-tabular text-slate-700">
                        {log.date}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            name={log.employeeName}
                            src={emp?.avatarUrl}
                            size="xs"
                          />
                          <span className="font-semibold text-slate-900">
                            {log.employeeName}
                          </span>
                          {emp && (
                            <span className="text-xs text-slate-500">
                              · {emp.department}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 font-mono-tabular text-slate-900">
                        {formatTimeKst(log.checkInAt)}
                      </td>
                      <td className="px-6 py-3.5 font-mono-tabular text-slate-700">
                        {log.status === 'active'
                          ? '근무 진행 중'
                          : formatTimeKst(log.checkOutAt)}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono-tabular text-slate-700">
                        {log.status === 'active'
                          ? '집계 중'
                          : formatDurationMinutes(log.durationMinutes)}
                      </td>
                      <td className="px-6 py-3.5 text-right font-semibold">
                        <span
                          className={
                            log.status === 'active'
                              ? 'text-emerald-700'
                              : 'text-slate-600'
                          }
                        >
                          {log.status === 'active' ? '근무중' : '퇴근 완료'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
