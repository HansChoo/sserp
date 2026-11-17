import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
} from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { FIELD_LIMITS } from '../types/erp';
import {
  addDaysYmd,
  getDeadlineMeta,
  getLocalTodayStr,
  getThisFridayYmd,
  parseYmd,
} from '../utils/dateAndAlerts';
import { Avatar } from './Avatar';
import { PinnedNoticeBanner } from './PinnedNoticeBanner';

interface PmDashboardViewProps {
  onOpenTask: (taskId: string) => void;
  onOpenNewTask: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

type FilterTab = 'all' | 'overdue' | 'due_today' | 'due_soon' | 'in_progress' | 'done';

export function PmDashboardView({
  onOpenTask,
  onOpenNewTask,
  searchQuery,
  onSearchChange,
}: PmDashboardViewProps) {
  const {
    tasks,
    employees,
    attendanceLogs,
    currentEmployee,
    createTask,
  } = useErp();

  const today = getLocalTodayStr();
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [timelineStart, setTimelineStart] = useState<string>(() =>
    addDaysYmd(today, -3),
  );

  // Notion-style Quick Inline Task Add Bar state
  const [quickTitle, setQuickTitle] = useState('');
  const [quickAssignee, setQuickAssignee] = useState<string>('');
  const [quickDueDate, setQuickDueDate] = useState<string>(() =>
    addDaysYmd(today, 2),
  );
  const [addingQuick, setAddingQuick] = useState(false);

  const effectiveQuickAssignee = useMemo(() => {
    if (quickAssignee && employees.some((e) => e.id === quickAssignee)) {
      return quickAssignee;
    }
    return (
      employees.find((e) => e.role === 'member')?.id ||
      employees[0]?.id ||
      currentEmployee?.id ||
      ''
    );
  }, [quickAssignee, employees, currentEmployee]);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || !effectiveQuickAssignee) return;
    setAddingQuick(true);
    try {
      await createTask({
        title: quickTitle.trim(),
        description: '',
        assigneeId: effectiveQuickAssignee,
        priority: 'medium',
        startDate: today,
        dueDate: quickDueDate < today ? today : quickDueDate,
        subtasks: [],
      });
      setQuickTitle('');
    } finally {
      setAddingQuick(false);
    }
  };

  // KPI computations
  const kpis = useMemo(() => {
    const avgProgress =
      tasks.length > 0
        ? Math.round(
            tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length,
          )
        : 0;
    const activeTodayIds = new Set(
      attendanceLogs
        .filter((l) => l.date === today && l.status === 'active')
        .map((l) => l.employeeId),
    );
    let overdueCount = 0;
    let dueSoonCount = 0;
    for (const t of tasks) {
      const meta = getDeadlineMeta(t.dueDate, t.status);
      if (meta.tier === 'overdue') overdueCount += 1;
      else if (
        meta.tier === 'due_today' ||
        meta.tier === 'due_d1' ||
        meta.tier === 'due_d3'
      ) {
        dueSoonCount += 1;
      }
    }
    return {
      avgProgress,
      checkedInCount: activeTodayIds.size,
      totalEmployees: employees.length,
      dueSoonCount,
      overdueCount,
    };
  }, [tasks, attendanceLogs, today, employees.length]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tasks.filter((t) => {
      if (assigneeFilter !== 'all' && t.assigneeId !== assigneeFilter) {
        return false;
      }
      if (
        q &&
        !t.title.toLowerCase().includes(q) &&
        !t.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      const meta = getDeadlineMeta(t.dueDate, t.status);
      if (filterTab === 'overdue') return meta.tier === 'overdue';
      if (filterTab === 'due_today') return meta.tier === 'due_today';
      if (filterTab === 'due_soon') {
        return (
          meta.tier === 'due_today' ||
          meta.tier === 'due_d1' ||
          meta.tier === 'due_d3'
        );
      }
      if (filterTab === 'in_progress') return t.status === 'in_progress';
      if (filterTab === 'done') return t.status === 'done';
      return true;
    });
  }, [tasks, assigneeFilter, searchQuery, filterTab]);

  // 14-day timeline columns
  const timelineDays = useMemo(() => {
    return Array.from({ length: 14 }, (_, idx) => {
      const ymd = addDaysYmd(timelineStart, idx);
      const dt = parseYmd(ymd);
      const weekday = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()];
      return {
        ymd,
        dayLabel: `${dt.getMonth() + 1}/${dt.getDate()}`,
        weekday,
        isToday: ymd === today,
        isWeekend: dt.getDay() === 0 || dt.getDay() === 6,
      };
    });
  }, [timelineStart, today]);

  const employeeStats = useMemo(() => {
    return employees.map((emp) => {
      const empTasks = tasks.filter((t) => t.assigneeId === emp.id);
      const doneCount = empTasks.filter((t) => t.status === 'done').length;
      const overdueCount = empTasks.filter(
        (t) => getDeadlineMeta(t.dueDate, t.status).tier === 'overdue',
      ).length;
      const avgProgress =
        empTasks.length > 0
          ? Math.round(
              empTasks.reduce((acc, t) => acc + t.progress, 0) / empTasks.length,
            )
          : 0;
      return {
        emp,
        total: empTasks.length,
        doneCount,
        overdueCount,
        avgProgress,
      };
    });
  }, [employees, tasks]);

  const timelineEnd = timelineDays[timelineDays.length - 1].ymd;

  return (
    <div className="space-y-6">
      <PinnedNoticeBanner />

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setFilterTab('all')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 text-left hover:border-slate-300 transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
        >
          <div className="text-[13px] font-medium text-slate-500">전체 업무 진행률</div>
          <div className="text-[28px] leading-tight font-bold font-mono-tabular text-slate-900 mt-1.5">
            {kpis.avgProgress}%
          </div>
          <div className="text-xs text-slate-500 mt-1.5 font-mono-tabular">
            총 {tasks.length}건 기준
          </div>
        </button>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="text-[13px] font-medium text-slate-500">오늘 출근 인원</div>
          <div className="text-[28px] leading-tight font-bold font-mono-tabular text-emerald-700 mt-1.5">
            {kpis.checkedInCount} / {kpis.totalEmployees}명
          </div>
          <div className="text-xs text-slate-500 mt-1.5">실시간 근무중 기준</div>
        </div>

        <button
          type="button"
          onClick={() => setFilterTab('due_soon')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 text-left hover:border-amber-300 transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
        >
          <div className="text-[13px] font-medium text-slate-500">마감 임박 (D-3 이내)</div>
          <div className="text-[28px] leading-tight font-bold font-mono-tabular text-amber-700 mt-1.5">
            {kpis.dueSoonCount}건
          </div>
          <div className="text-xs text-amber-700 font-medium mt-1.5">
            클릭해 필터링
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('overdue')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 text-left hover:border-red-300 transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
        >
          <div className="text-[13px] font-medium text-slate-500">지연 업무</div>
          <div className="text-[28px] leading-tight font-bold font-mono-tabular text-red-700 mt-1.5">
            {kpis.overdueCount}건
          </div>
          <div className="text-xs text-red-700 font-medium mt-1.5">
            즉시 확인 필요
          </div>
        </button>
      </div>

      {/* Notion-style Quick 1-Line Task Add Bar */}
      <form
        onSubmit={handleQuickAdd}
        className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-wrap items-center gap-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
      >
        <input
          type="text"
          maxLength={FIELD_LIMITS.TASK_TITLE_MAX}
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="빠른 업무 등록: 할 일을 입력하고 Enter를 누르세요..."
          className="flex-1 min-w-[240px] px-3.5 py-2.5 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-600 transition-colors"
        />
        <select
          value={effectiveQuickAssignee}
          onChange={(e) => setQuickAssignee(e.target.value)}
          aria-label="빠른 업무 담당자 선택"
          className="px-3.5 py-2.5 text-[13px] font-medium border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:border-blue-600"
        >
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          {[
            { label: '오늘', date: today },
            { label: '내일', date: addDaysYmd(today, 1) },
            { label: '금주 금', date: getThisFridayYmd(today) },
            { label: '+7일', date: addDaysYmd(today, 7) },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setQuickDueDate(preset.date)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap ${
                quickDueDate === preset.date
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={addingQuick || !quickTitle.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold text-white bg-blue-700 rounded-xl hover:bg-blue-800 disabled:opacity-40 whitespace-nowrap transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>빠른 추가</span>
        </button>
      </form>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl overflow-x-auto">
          {(
            [
              { id: 'all', label: '전체' },
              { id: 'overdue', label: '지연 업무' },
              { id: 'due_today', label: '오늘 마감' },
              { id: 'due_soon', label: '마감 임박 (D-3)' },
              { id: 'in_progress', label: '진행중' },
              { id: 'done', label: '완료' },
            ] as { id: FilterTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={`px-3.5 py-1.5 text-[13px] font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                filterTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            aria-label="담당자 필터"
            className="px-3.5 py-2 text-[13px] border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="all">전체 직원</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>

          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="업무명 검색..."
              className="w-full pl-9 pr-3 py-2 text-[13px] border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Interactive Team Timeline (Gantt Chart) */}
      <section className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-slate-600" />
            <h2 className="text-[15px] font-semibold text-slate-900">
              팀 일정 타임라인 (2주 뷰)
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTimelineStart((prev) => addDaysYmd(prev, -7))}
              className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
              aria-label="이전 주"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setTimelineStart(addDaysYmd(today, -3))}
              className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              오늘 기준
            </button>
            <button
              type="button"
              onClick={() => setTimelineStart((prev) => addDaysYmd(prev, 7))}
              className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
              aria-label="다음 주"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            {/* Timeline Day Headers */}
            <div className="grid grid-cols-[270px_1fr] border-b border-slate-200/80 bg-slate-50/70 text-xs font-mono-tabular">
              <div className="px-5 py-2.5 font-sans font-semibold text-slate-600 border-r border-slate-200/80">
                업무 및 담당자
              </div>
              <div className="grid grid-cols-14">
                {timelineDays.map((d) => (
                  <div
                    key={d.ymd}
                    className={`py-2 text-center border-r border-slate-200/70 last:border-r-0 ${
                      d.isToday
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : d.isWeekend
                          ? 'text-slate-400'
                          : 'text-slate-600'
                    }`}
                  >
                    <div>{d.dayLabel}</div>
                    <div className="text-[11px] font-sans mt-0.5">{d.weekday}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline Rows */}
            {filteredTasks.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-sm text-slate-500">
                  {tasks.length === 0
                    ? '아직 등록된 업무가 없습니다. 첫 업무를 등록해 일정을 시작해 보세요.'
                    : '현재 필터 조건에 해당하는 일정이 없습니다.'}
                </p>
                {tasks.length === 0 && (
                  <button
                    type="button"
                    onClick={onOpenNewTask}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>첫 업무 등록하기</span>
                  </button>
                )}
              </div>
            ) : (
              filteredTasks.map((task) => {
                const assignee = employees.find((e) => e.id === task.assigneeId);
                const meta = getDeadlineMeta(task.dueDate, task.status);

                const effectiveStart =
                  task.startDate < timelineStart ? timelineStart : task.startDate;
                const effectiveEnd =
                  task.dueDate > timelineEnd ? timelineEnd : task.dueDate;
                const outOfWindow =
                  task.dueDate < timelineStart || task.startDate > timelineEnd;

                let startIdx = 0;
                let spanCols = 1;
                if (!outOfWindow) {
                  startIdx = Math.max(
                    0,
                    timelineDays.findIndex((d) => d.ymd === effectiveStart),
                  );
                  const endIdx = Math.max(
                    startIdx,
                    timelineDays.findIndex((d) => d.ymd === effectiveEnd),
                  );
                  spanCols = Math.max(1, endIdx - startIdx + 1);
                }

                const barColor =
                  meta.tier === 'done'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : meta.tier === 'overdue'
                      ? 'bg-red-50 border-red-300 text-red-950'
                      : meta.tier === 'due_today' || meta.tier === 'due_d1'
                        ? 'bg-amber-50 border-amber-300 text-amber-950'
                        : 'bg-blue-50 border-blue-300 text-blue-950';

                const fillColor =
                  meta.tier === 'done'
                    ? 'bg-emerald-500/20'
                    : meta.tier === 'overdue'
                      ? 'bg-red-500/20'
                      : meta.tier === 'due_today' || meta.tier === 'due_d1'
                        ? 'bg-amber-500/20'
                        : 'bg-blue-500/15';

                return (
                  <div
                    key={task.id}
                    className="grid grid-cols-[270px_1fr] border-b border-slate-200/70 last:border-b-0 hover:bg-slate-50/70 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenTask(task.id)}
                      className="px-5 py-3 flex items-center gap-3 text-left border-r border-slate-200/80 min-w-0"
                    >
                      <Avatar
                        name={assignee?.name || '미정'}
                        src={assignee?.avatarUrl}
                        size="xs"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-slate-900 truncate">
                          {task.title}
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {assignee?.name || '미정'} ·{' '}
                          <span className={`font-medium ${meta.textClass}`}>
                            {meta.label}
                          </span>
                        </div>
                      </div>
                    </button>

                    <div className="relative grid grid-cols-14 items-center px-1">
                      {timelineDays.map((d) => (
                        <div
                          key={d.ymd}
                          className={`h-full border-r border-slate-100 last:border-r-0 ${
                            d.isToday ? 'bg-blue-50/40' : ''
                          }`}
                        />
                      ))}

                      {!outOfWindow ? (
                        <button
                          type="button"
                          onClick={() => onOpenTask(task.id)}
                          style={{
                            left: `${(startIdx / 14) * 100}%`,
                            width: `${(spanCols / 14) * 100}%`,
                          }}
                          className={`absolute h-7 rounded-lg border px-2.5 flex items-center justify-between overflow-hidden text-xs font-medium ${barColor} hover:brightness-95 transition-all`}
                        >
                          <div
                            className={`absolute inset-y-0 left-0 ${fillColor}`}
                            style={{ width: `${task.progress}%` }}
                          />
                          <span className="relative z-10 truncate">
                            {task.title}
                          </span>
                          <span className="relative z-10 font-mono-tabular ml-2 shrink-0">
                            {task.progress}%
                          </span>
                        </button>
                      ) : (
                        <div className="absolute inset-x-3 text-xs text-slate-400 font-mono-tabular">
                          표시 기간 외 ({task.startDate} ~ {task.dueDate})
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Bottom Split: Employee Progress Comparison Chart + Priority Task Table */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <h2 className="text-[15px] font-semibold text-slate-900 mb-5">
            직원별 업무 진행률 현황
          </h2>
          <div className="space-y-4">
            {employeeStats.map(({ emp, total, doneCount, overdueCount, avgProgress }) => (
              <div key={emp.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={emp.name} src={emp.avatarUrl} size="xs" />
                    <span className="font-semibold text-slate-900 truncate">
                      {emp.name}
                    </span>
                    <span className="text-xs text-slate-500 truncate">
                      {emp.department}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 font-mono-tabular text-xs">
                    {overdueCount > 0 && (
                      <span className="text-red-700 font-semibold">
                        지연 {overdueCount}
                      </span>
                    )}
                    <span className="text-slate-600">
                      {doneCount}/{total}건
                    </span>
                    <span className="font-semibold text-slate-900 w-9 text-right">
                      {avgProgress}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      overdueCount > 0
                        ? 'bg-amber-600'
                        : avgProgress === 100 && total > 0
                          ? 'bg-emerald-600'
                          : 'bg-blue-700'
                    }`}
                    style={{ width: `${avgProgress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-3 bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-slate-900">
              업무 상세 목록 ({filteredTasks.length}건)
            </h2>
            <span className="text-xs text-slate-500">
              항목 클릭 시 상세 편집·복제
            </span>
          </div>
          <div className="divide-y divide-slate-200/70 max-h-[380px] overflow-y-auto">
            {filteredTasks.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                {tasks.length === 0
                  ? '등록된 업무가 없습니다.'
                  : '검색 또는 필터와 일치하는 업무가 없습니다.'}
              </div>
            ) : (
              filteredTasks.map((task) => {
                const assignee = employees.find((e) => e.id === task.assigneeId);
                const meta = getDeadlineMeta(task.dueDate, task.status);
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onOpenTask(task.id)}
                    className="w-full px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 text-left transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {meta.tier === 'overdue' && (
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        )}
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {task.title}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {assignee?.name || '미정'} ·{' '}
                        <span className={`font-semibold ${meta.textClass}`}>
                          {meta.label}
                        </span>{' '}
                        · <span className="font-mono-tabular">마감 {task.dueDate}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono-tabular font-semibold text-slate-700">
                        {task.progress}%
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
