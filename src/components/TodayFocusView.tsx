import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Search,
} from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { TaskItem } from '../types/erp';
import { getDeadlineMeta, getLocalTodayStr } from '../utils/dateAndAlerts';
import { Avatar } from './Avatar';
import { PinnedNoticeBanner } from './PinnedNoticeBanner';

interface TodayFocusViewProps {
  mode: 'today' | 'all_tasks';
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenTask: (taskId: string) => void;
}

export function TodayFocusView({
  mode,
  searchQuery,
  onSearchChange,
  onOpenTask,
}: TodayFocusViewProps) {
  const {
    tasks,
    employees,
    currentEmployee,
    toggleSubtask,
    updateTaskStatus,
    notificationPermission,
    requestBrowserNotificationPermission,
  } = useErp();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'overdue' | 'due_today' | 'due_soon' | 'done'
  >('all');
  const [showCompleted, setShowCompleted] = useState(false);

  const today = getLocalTodayStr();
  const isAdmin = currentEmployee?.role === 'admin';

  const toggleExpand = (taskId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const myTasks = useMemo(() => {
    if (!currentEmployee) return [];
    const base =
      mode === 'today'
        ? tasks.filter((t) => t.assigneeId === currentEmployee.id)
        : isAdmin
          ? tasks
          : tasks.filter((t) => t.assigneeId === currentEmployee.id);

    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }, [tasks, currentEmployee, mode, isAdmin, searchQuery]);

  const categorized = useMemo(() => {
    const overdue: TaskItem[] = [];
    const dueTodayOrActive: TaskItem[] = [];
    const upcoming: TaskItem[] = [];
    const later: TaskItem[] = [];
    const done: TaskItem[] = [];

    for (const task of myTasks) {
      const meta = getDeadlineMeta(task.dueDate, task.status);
      if (task.status === 'done') {
        done.push(task);
      } else if (meta.tier === 'overdue') {
        overdue.push(task);
      } else if (meta.tier === 'due_today' || task.status === 'in_progress') {
        dueTodayOrActive.push(task);
      } else if (meta.tier === 'due_d1' || meta.tier === 'due_d3') {
        upcoming.push(task);
      } else {
        later.push(task);
      }
    }
    return { overdue, dueTodayOrActive, upcoming, later, done };
  }, [myTasks]);

  const filteredAllTasks = useMemo(() => {
    return myTasks.filter((task) => {
      const meta = getDeadlineMeta(task.dueDate, task.status);
      if (statusFilter === 'overdue') return meta.tier === 'overdue';
      if (statusFilter === 'due_today') return meta.tier === 'due_today';
      if (statusFilter === 'due_soon')
        return meta.tier === 'due_d1' || meta.tier === 'due_d3';
      if (statusFilter === 'done') return task.status === 'done';
      return true;
    });
  }, [myTasks, statusFilter]);

  const renderTaskRow = (task: TaskItem) => {
    const assignee = employees.find((e) => e.id === task.assigneeId);
    const meta = getDeadlineMeta(task.dueDate, task.status);
    const isExpanded = expandedIds.has(task.id);
    const doneSubtasks = task.subtasks.filter((s) => s.completed).length;

    return (
      <div
        key={task.id}
        className="border-b border-slate-200/80 last:border-b-0 bg-white"
      >
        <div className="px-5 py-3.5 flex items-center gap-3.5 hover:bg-slate-50/70 transition-colors">
          <button
            type="button"
            onClick={() =>
              updateTaskStatus(
                task.id,
                task.status === 'done' ? 'in_progress' : 'done',
              )
            }
            aria-label={
              task.status === 'done' ? '업무 완료 해제' : '업무 완료 처리'
            }
            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
              task.status === 'done'
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white border-slate-300 hover:border-slate-500'
            }`}
          >
            {task.status === 'done' && <Check className="w-3.5 h-3.5" />}
          </button>

          {task.subtasks.length > 0 ? (
            <button
              type="button"
              onClick={() => toggleExpand(task.id)}
              aria-label={isExpanded ? '세부 단계 접기' : '세부 단계 펼치기'}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <span className="w-6 shrink-0" aria-hidden="true" />
          )}

          <button
            type="button"
            onClick={() => onOpenTask(task.id)}
            className="flex-1 min-w-0 text-left"
          >
            <div className="flex items-center gap-2">
              <span
                className={`text-[15px] font-medium truncate ${
                  task.status === 'done'
                    ? 'line-through text-slate-400'
                    : 'text-slate-900'
                }`}
              >
                {task.title}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <span className={`font-semibold ${meta.textClass}`}>
                {meta.label}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">마감 {task.dueDate}</span>
              {task.subtasks.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">
                    세부단계 {doneSubtasks}/{task.subtasks.length}
                  </span>
                </>
              )}
              {mode === 'all_tasks' && assignee && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{assignee.name}</span>
                </>
              )}
            </div>
          </button>

          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:flex items-center gap-2.5 w-32">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    task.progress === 100
                      ? 'bg-emerald-600'
                      : meta.tier === 'overdue'
                        ? 'bg-red-600'
                        : 'bg-blue-700'
                  }`}
                  style={{ width: `${task.progress}%` }}
                />
              </div>
              <span className="text-xs font-mono-tabular font-medium text-slate-600 w-9 text-right">
                {task.progress}%
              </span>
            </div>

            {assignee && (
              <Avatar
                name={assignee.name}
                src={assignee.avatarUrl}
                size="xs"
              />
            )}
          </div>
        </div>

        {/* Notion-style Inline Subtasks Expansion */}
        {isExpanded && task.subtasks.length > 0 && (
          <div className="pl-16 pr-6 pb-3.5 pt-1.5 bg-slate-50/70 space-y-1.5 border-t border-slate-100">
            {task.subtasks.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => toggleSubtask(task.id, st.id)}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white text-left transition-colors"
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    st.completed
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-300'
                  }`}
                >
                  {st.completed && <Check className="w-3 h-3" />}
                </span>
                <span
                  className={`text-[13px] ${
                    st.completed
                      ? 'line-through text-slate-400'
                      : 'text-slate-700'
                  }`}
                >
                  {st.title}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (mode === 'all_tasks') {
    return (
      <div className="space-y-5">
        <PinnedNoticeBanner />

        <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl overflow-x-auto">
            {(
              [
                { id: 'all', label: '전체' },
                { id: 'overdue', label: '지연 업무' },
                { id: 'due_today', label: '오늘 마감' },
                { id: 'due_soon', label: '마감 임박 (D-3)' },
                { id: 'done', label: '완료' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-1.5 text-[13px] font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="업무 검색..."
              className="w-full pl-9 pr-3 py-2 text-[13px] border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          {filteredAllTasks.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              {myTasks.length === 0
                ? '등록된 업무가 아직 없습니다.'
                : '조건에 해당하는 업무가 없습니다.'}
            </div>
          ) : (
            filteredAllTasks.map(renderTaskRow)
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PinnedNoticeBanner />

      {/* Daily Focus Greeting & Browser Notification Prompt */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div>
          <div className="text-xs font-mono-tabular text-slate-500">
            {today} · {currentEmployee?.department}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">
            {currentEmployee?.name}님의 오늘 할 일
          </h2>
          <p className="text-sm text-slate-600 mt-1.5">
            지연 {categorized.overdue.length}건 · 오늘 및 진행중{' '}
            {categorized.dueTodayOrActive.length}건 · 다가오는 마감{' '}
            {categorized.upcoming.length}건
          </p>
        </div>

        {notificationPermission === 'default' && (
          <button
            type="button"
            onClick={requestBrowserNotificationPermission}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0"
          >
            <Bell className="w-4 h-4" />
            <span>마감 임박·지연 브라우저 알림 켜기</span>
          </button>
        )}
      </div>

      {/* Section 1: Overdue */}
      {categorized.overdue.length > 0 && (
        <section className="bg-white border border-red-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="px-5 py-3.5 bg-red-50/70 border-b border-red-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-700" />
              <h3 className="text-[15px] font-semibold text-red-900">
                밀린 일정 (지연 · Overdue)
              </h3>
            </div>
            <span className="text-xs font-mono-tabular font-semibold text-red-700">
              {categorized.overdue.length}건
            </span>
          </div>
          <div>{categorized.overdue.map(renderTaskRow)}</div>
        </section>
      )}

      {/* Section 2: Due Today & In Progress */}
      <section className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <h3 className="text-[15px] font-semibold text-slate-900">
              오늘 꼭 해야 할 일 (D-Day 및 진행 중)
            </h3>
          </div>
          <span className="text-xs font-mono-tabular font-semibold text-slate-700">
            {categorized.dueTodayOrActive.length}건
          </span>
        </div>
        {categorized.dueTodayOrActive.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            {myTasks.length === 0
              ? '현재 배정된 업무가 없습니다.'
              : '오늘 마감 예정이거나 진행 중인 업무가 모두 완료되었습니다.'}
          </div>
        ) : (
          <div>{categorized.dueTodayOrActive.map(renderTaskRow)}</div>
        )}
      </section>

      {/* Section 3: Upcoming D-1 ~ D-3 */}
      <section className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-blue-700" />
            <h3 className="text-[15px] font-semibold text-slate-900">
              다가오는 마감 (D-1 ~ D-3)
            </h3>
          </div>
          <span className="text-xs font-mono-tabular font-semibold text-slate-600">
            {categorized.upcoming.length}건
          </span>
        </div>
        {categorized.upcoming.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            3일 이내에 마감되는 예정 업무가 없습니다.
          </div>
        ) : (
          <div>{categorized.upcoming.map(renderTaskRow)}</div>
        )}
      </section>

      {/* Section 4: Scheduled Later + Completed */}
      {categorized.later.length > 0 && (
        <section className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-slate-800">
              예정된 후속 업무
            </h3>
            <span className="text-xs font-mono-tabular text-slate-500">
              {categorized.later.length}건
            </span>
          </div>
          <div>{categorized.later.map(renderTaskRow)}</div>
        </section>
      )}

      {categorized.done.length > 0 && (
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <button
            type="button"
            onClick={() => setShowCompleted((prev) => !prev)}
            className="w-full px-5 py-3.5 flex items-center justify-between text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            <span>완료된 내 업무 ({categorized.done.length}건)</span>
            {showCompleted ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          {showCompleted && (
            <div className="border-t border-slate-200/80">
              {categorized.done.map(renderTaskRow)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
