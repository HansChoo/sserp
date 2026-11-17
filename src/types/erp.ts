export type EmployeeRole = 'admin' | 'member';
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type ActivityType =
  | 'comment'
  | 'status_change'
  | 'subtask_toggle'
  | 'deadline_change'
  | 'created';

export type DeadlineTier =
  | 'overdue'
  | 'due_today'
  | 'due_d1'
  | 'due_d3'
  | 'normal'
  | 'done';

export interface SubtaskItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface Employee {
  id: string;
  username: string;
  password: string;
  name: string;
  department: string;
  title: string;
  role: EmployeeRole;
  avatarUrl: string;
  workspaceKey: string;
  ownerUid: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  creatorId: string;
  priority: TaskPriority;
  status: TaskStatus;
  startDate: string;
  dueDate: string;
  subtasks: SubtaskItem[];
  progress: number;
  workspaceKey: string;
  ownerUid: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface AttendanceLog {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  durationMinutes: number;
  status: 'active' | 'completed';
  workspaceKey: string;
  ownerUid: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  type: ActivityType;
  message: string;
  workspaceKey: string;
  ownerUid: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface WorkspaceSetting {
  id: string;
  noticeText: string;
  updatedBy: string;
  workspaceKey: string;
  ownerUid: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface AppAlertItem {
  id: string;
  taskId: string;
  taskTitle: string;
  assigneeId: string;
  tier: 'overdue' | 'due_today' | 'due_d1' | 'due_d3';
  title: string;
  body: string;
  dueDate: string;
  read: boolean;
  createdAt: string;
}

export interface ToastMessage {
  id: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  description?: string;
  taskId?: string;
}

export const FIELD_LIMITS = {
  USERNAME_MIN: 2,
  USERNAME_MAX: 32,
  USERNAME_PATTERN: /^[a-zA-Z0-9_-]+$/,
  PASSWORD_MIN: 4,
  PASSWORD_MAX: 64,
  NAME_MAX: 40,
  DEPT_MAX: 40,
  TITLE_MAX: 40,
  TASK_TITLE_MAX: 160,
  TASK_DESC_MAX: 2000,
  SUBTASKS_MAX: 30,
  NOTICE_MAX: 200,
  ACTIVITY_MSG_MAX: 1000,
} as const;
