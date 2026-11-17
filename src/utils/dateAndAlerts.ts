import { AppAlertItem, DeadlineTier, SubtaskItem, TaskItem, TaskStatus } from '../types/erp';

export function formatLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getLocalTodayStr(): string {
  return formatLocalYmd(new Date());
}

export function parseYmd(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

export function addDaysYmd(baseYmd: string, offsetDays: number): string {
  const dt = parseYmd(baseYmd);
  dt.setDate(dt.getDate() + offsetDays);
  return formatLocalYmd(dt);
}

export function getThisFridayYmd(baseYmd = getLocalTodayStr()): string {
  const dt = parseYmd(baseYmd);
  const day = dt.getDay(); // 0=Sun .. 5=Fri .. 6=Sat
  const diff = day <= 5 ? 5 - day : 6;
  dt.setDate(dt.getDate() + diff);
  return formatLocalYmd(dt);
}

export function diffDaysFromToday(targetYmd: string): number {
  const today = parseYmd(getLocalTodayStr());
  const target = parseYmd(targetYmd);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((target.getTime() - today.getTime()) / msPerDay);
}

export interface DeadlineBadgeMeta {
  tier: DeadlineTier;
  diffDays: number;
  label: string;
  textClass: string;
  surfaceClass: string;
}

export function getDeadlineMeta(
  dueDate: string,
  status: TaskStatus,
): DeadlineBadgeMeta {
  const diffDays = diffDaysFromToday(dueDate);
  if (status === 'done') {
    return {
      tier: 'done',
      diffDays,
      label: '완료',
      textClass: 'text-emerald-700',
      surfaceClass: 'bg-emerald-50 border-emerald-200',
    };
  }
  if (diffDays < 0) {
    return {
      tier: 'overdue',
      diffDays,
      label: `지연 +${Math.abs(diffDays)}일`,
      textClass: 'text-red-700',
      surfaceClass: 'bg-red-50 border-red-200',
    };
  }
  if (diffDays === 0) {
    return {
      tier: 'due_today',
      diffDays,
      label: '오늘 마감',
      textClass: 'text-amber-700',
      surfaceClass: 'bg-amber-50 border-amber-200',
    };
  }
  if (diffDays === 1) {
    return {
      tier: 'due_d1',
      diffDays,
      label: '내일 마감 (D-1)',
      textClass: 'text-amber-700',
      surfaceClass: 'bg-amber-50 border-amber-200',
    };
  }
  if (diffDays <= 3) {
    return {
      tier: 'due_d3',
      diffDays,
      label: `임박 D-${diffDays}`,
      textClass: 'text-blue-700',
      surfaceClass: 'bg-blue-50 border-blue-200',
    };
  }
  return {
    tier: 'normal',
    diffDays,
    label: `D-${diffDays}`,
    textClass: 'text-slate-600',
    surfaceClass: 'bg-slate-50 border-slate-200',
  };
}

export function computeTaskProgress(
  subtasks: SubtaskItem[],
  status: TaskStatus,
): number {
  if (subtasks.length > 0) {
    const doneCount = subtasks.filter((s) => s.completed).length;
    return Math.round((doneCount / subtasks.length) * 100);
  }
  if (status === 'done') return 100;
  if (status === 'in_progress') return 50;
  return 0;
}

export function formatTimeKst(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatShortDateTime(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes <= 0) return '1분 미만';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

export function evaluateTaskAlerts(
  tasks: TaskItem[],
  employeeId: string,
  role: 'admin' | 'member',
): AppAlertItem[] {
  const relevantTasks =
    role === 'admin'
      ? tasks.filter((t) => t.status !== 'done')
      : tasks.filter((t) => t.assigneeId === employeeId && t.status !== 'done');

  const alerts: AppAlertItem[] = [];
  const nowIso = new Date().toISOString();

  for (const task of relevantTasks) {
    const meta = getDeadlineMeta(task.dueDate, task.status);
    if (meta.tier === 'overdue') {
      alerts.push({
        id: `${task.id}_overdue`,
        taskId: task.id,
        taskTitle: task.title,
        assigneeId: task.assigneeId,
        tier: 'overdue',
        title: `지연된 업무 (${meta.label})`,
        body: `"${task.title}" 마감일(${task.dueDate})이 지났습니다.`,
        dueDate: task.dueDate,
        read: false,
        createdAt: nowIso,
      });
    } else if (meta.tier === 'due_today') {
      alerts.push({
        id: `${task.id}_due_today`,
        taskId: task.id,
        taskTitle: task.title,
        assigneeId: task.assigneeId,
        tier: 'due_today',
        title: '오늘 마감 업무 (D-Day)',
        body: `"${task.title}" 오늘(${task.dueDate})까지 완료가 필요합니다.`,
        dueDate: task.dueDate,
        read: false,
        createdAt: nowIso,
      });
    } else if (meta.tier === 'due_d1') {
      alerts.push({
        id: `${task.id}_due_d1`,
        taskId: task.id,
        taskTitle: task.title,
        assigneeId: task.assigneeId,
        tier: 'due_d1',
        title: '내일 마감 임박 (D-1)',
        body: `"${task.title}" 마감이 내일(${task.dueDate})입니다.`,
        dueDate: task.dueDate,
        read: false,
        createdAt: nowIso,
      });
    } else if (meta.tier === 'due_d3') {
      alerts.push({
        id: `${task.id}_due_d3`,
        taskId: task.id,
        taskTitle: task.title,
        assigneeId: task.assigneeId,
        tier: 'due_d3',
        title: `마감 임박 (${meta.label})`,
        body: `"${task.title}" 마감일이 ${meta.diffDays}일 남았습니다.`,
        dueDate: task.dueDate,
        read: false,
        createdAt: nowIso,
      });
    }
  }

  const orderWeight: Record<AppAlertItem['tier'], number> = {
    overdue: 0,
    due_today: 1,
    due_d1: 2,
    due_d3: 3,
  };
  return alerts.sort((a, b) => orderWeight[a.tier] - orderWeight[b.tier]);
}

export function wasAlertSentToday(
  employeeId: string,
  alertId: string,
): boolean {
  try {
    const key = `teampulse_alert_${employeeId}_${getLocalTodayStr()}_${alertId}`;
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function markAlertSentToday(employeeId: string, alertId: string): void {
  try {
    const key = `teampulse_alert_${employeeId}_${getLocalTodayStr()}_${alertId}`;
    window.localStorage.setItem(key, '1');
  } catch {
    // ignore storage quota failures for dedup markers
  }
}
