import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { onAuthStateChanged, signInAnonymously, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  ensureAnonymousAuth,
  handleFirestoreError,
  OperationType,
  testConnection,
  WORKSPACE_KEY,
} from '../lib/firebase';
import { purgeLegacyFakeData, seedInitialWorkspace } from '../lib/seedData';
import {
  AppAlertItem,
  AttendanceLog,
  Employee,
  EmployeeRole,
  FIELD_LIMITS,
  SubtaskItem,
  TaskActivity,
  TaskItem,
  TaskPriority,
  TaskStatus,
  ToastMessage,
  WorkspaceSetting,
} from '../types/erp';
import {
  computeTaskProgress,
  evaluateTaskAlerts,
  getLocalTodayStr,
  markAlertSentToday,
  wasAlertSentToday,
} from '../utils/dateAndAlerts';

export type ActiveViewTab =
  | 'pm_dashboard'
  | 'today'
  | 'all_tasks'
  | 'attendance'
  | 'employees';

interface SessionStorageState {
  employeeId: string;
  activeAttendanceId: string;
}

interface CreateTaskInput {
  title: string;
  description: string;
  assigneeId: string;
  priority: TaskPriority;
  startDate: string;
  dueDate: string;
  subtasks: SubtaskItem[];
}

interface UpdateTaskAdminInput {
  title?: string;
  description?: string;
  assigneeId?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  startDate?: string;
  dueDate?: string;
  subtasks?: SubtaskItem[];
}

interface CreateEmployeeInput {
  username: string;
  password: string;
  name: string;
  department: string;
  title: string;
  role: EmployeeRole;
}

interface UpdateEmployeeInput {
  name: string;
  password: string;
  department: string;
  title: string;
  role: EmployeeRole;
}

interface ErpContextValue {
  firebaseUser: User | null;
  authReady: boolean;
  authError: string | null;
  retryAnonymousAuth: () => Promise<void>;
  dataLoading: boolean;
  seeding: boolean;
  employees: Employee[];
  tasks: TaskItem[];
  attendanceLogs: AttendanceLog[];
  taskActivities: TaskActivity[];
  workspaceSetting: WorkspaceSetting | null;

  currentEmployee: Employee | null;
  activeAttendanceId: string | null;
  activeTab: ActiveViewTab;
  setActiveTab: (tab: ActiveViewTab) => void;

  loginEmployee: (
    username: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  checkoutAndLogout: () => Promise<void>;

  createTask: (input: CreateTaskInput) => Promise<string | null>;
  updateTaskAdmin: (taskId: string, input: UpdateTaskAdminInput) => Promise<void>;
  duplicateTask: (taskId: string) => Promise<string | null>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  addTaskComment: (taskId: string, message: string) => Promise<void>;

  createEmployeeAccount: (
    input: CreateEmployeeInput,
  ) => Promise<{ ok: boolean; error?: string }>;
  updateEmployeeAccount: (
    employeeId: string,
    input: UpdateEmployeeInput,
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteEmployeeAccount: (employeeId: string) => Promise<void>;
  updatePinnedNotice: (noticeText: string) => Promise<void>;

  alerts: AppAlertItem[];
  unreadAlertCount: number;
  markAllAlertsRead: () => void;
  markAlertRead: (alertId: string) => void;
  notificationPermission: NotificationPermission | 'unsupported';
  requestBrowserNotificationPermission: () => Promise<void>;
  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const ErpContext = createContext<ErpContextValue | null>(null);
const SESSION_KEY = 'teampulse_active_employee_session';

function toDateOrNull(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (
    typeof val === 'object' &&
    val !== null &&
    'toDate' in val &&
    typeof (val as { toDate: () => Date }).toDate === 'function'
  ) {
    return (val as { toDate: () => Date }).toDate();
  }
  if (typeof val === 'string') {
    const parsed = new Date(val);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function getBrowserNotifSupport(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function ErpProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [taskActivities, setTaskActivities] = useState<TaskActivity[]>([]);
  const [workspaceSetting, setWorkspaceSetting] =
    useState<WorkspaceSetting | null>(null);

  const [sessionState, setSessionState] = useState<SessionStorageState | null>(
    () => {
      try {
        const raw = window.sessionStorage.getItem(SESSION_KEY);
        return raw ? (JSON.parse(raw) as SessionStorageState) : null;
      } catch {
        return null;
      }
    },
  );

  const [activeTab, setActiveTab] = useState<ActiveViewTab>('today');
  const [alerts, setAlerts] = useState<AppAlertItem[]>([]);
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(getBrowserNotifSupport);

  const initialLoginAlertedRef = useRef<string | null>(null);
  const anonSignInInFlightRef = useRef(false);
  const seedAttemptedRef = useRef(false);
  const legacyPurgeAttemptedRef = useRef(false);

  const pushToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = generateId('toast');
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 5500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const triggerSilentAnonSignIn = useCallback(async () => {
    if (anonSignInInFlightRef.current) return;
    anonSignInInFlightRef.current = true;
    setAuthError(null);
    try {
      await signInAnonymously(auth);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAuthError(
        `Firebase 익명 인증 연결에 실패했습니다 (${msg}). Firebase Console에서 익명 로그인이 활성화되어 있는지 확인해 주세요.`,
      );
      setDataLoading(false);
      setAuthReady(true);
    } finally {
      anonSignInInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUser(user);
        setAuthError(null);
        setAuthReady(true);
        testConnection();
      } else {
        setFirebaseUser(null);
        triggerSilentAnonSignIn();
      }
    });
    return () => unsubscribe();
  }, [triggerSilentAnonSignIn]);

  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    setDataLoading(true);
    let employeesLoaded = false;

    const unsubEmployees = onSnapshot(
      query(
        collection(db, 'employees'),
        where('workspaceKey', '==', WORKSPACE_KEY),
      ),
      async (snapshot) => {
        if (snapshot.empty && !seedAttemptedRef.current) {
          seedAttemptedRef.current = true;
          setSeeding(true);
          try {
            await seedInitialWorkspace(firebaseUser.uid);
          } finally {
            setSeeding(false);
          }
          return;
        }

        const list: Employee[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            username: String(data.username || ''),
            password: String(data.password || ''),
            name: String(data.name || ''),
            department: String(data.department || ''),
            title: String(data.title || ''),
            role: data.role === 'admin' ? 'admin' : 'member',
            avatarUrl: String(data.avatarUrl || ''),
            workspaceKey: String(data.workspaceKey || WORKSPACE_KEY),
            ownerUid: String(data.ownerUid || ''),
            createdAt: toDateOrNull(data.createdAt),
            updatedAt: toDateOrNull(data.updatedAt),
          };
        });

        list.sort((a, b) =>
          a.role === 'admin'
            ? -1
            : b.role === 'admin'
              ? 1
              : a.name.localeCompare(b.name, 'ko'),
        );
        setEmployees(list);
        employeesLoaded = true;
        setDataLoading(false);
      },
      (error) => {
        setDataLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'employees');
      },
    );

    const unsubTasks = onSnapshot(
      query(
        collection(db, 'tasks'),
        where('workspaceKey', '==', WORKSPACE_KEY),
      ),
      (snapshot) => {
        const list: TaskItem[] = snapshot.docs.map((d) => {
          const data = d.data();
          const subtasks = Array.isArray(data.subtasks)
            ? (data.subtasks as SubtaskItem[])
            : [];
          return {
            id: d.id,
            title: String(data.title || ''),
            description: String(data.description || ''),
            assigneeId: String(data.assigneeId || ''),
            creatorId: String(data.creatorId || ''),
            priority:
              data.priority === 'high' || data.priority === 'low'
                ? data.priority
                : 'medium',
            status:
              data.status === 'done' || data.status === 'in_progress'
                ? data.status
                : 'todo',
            startDate: String(data.startDate || getLocalTodayStr()),
            dueDate: String(data.dueDate || getLocalTodayStr()),
            subtasks,
            progress: Number(data.progress || 0),
            workspaceKey: String(data.workspaceKey || WORKSPACE_KEY),
            ownerUid: String(data.ownerUid || ''),
            createdAt: toDateOrNull(data.createdAt),
            updatedAt: toDateOrNull(data.updatedAt),
          };
        });
        list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        setTasks(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'tasks');
      },
    );

    const unsubAttendance = onSnapshot(
      query(
        collection(db, 'attendanceLogs'),
        where('workspaceKey', '==', WORKSPACE_KEY),
      ),
      (snapshot) => {
        const list: AttendanceLog[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            employeeId: String(data.employeeId || ''),
            employeeName: String(data.employeeName || ''),
            date: String(data.date || ''),
            checkInAt: toDateOrNull(data.checkInAt),
            checkOutAt: toDateOrNull(data.checkOutAt),
            durationMinutes: Number(data.durationMinutes || 0),
            status: data.status === 'completed' ? 'completed' : 'active',
            workspaceKey: String(data.workspaceKey || WORKSPACE_KEY),
            ownerUid: String(data.ownerUid || ''),
            createdAt: toDateOrNull(data.createdAt),
            updatedAt: toDateOrNull(data.updatedAt),
          };
        });
        list.sort(
          (a, b) => (b.checkInAt?.getTime() || 0) - (a.checkInAt?.getTime() || 0),
        );
        setAttendanceLogs(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'attendanceLogs');
      },
    );

    const unsubActivities = onSnapshot(
      query(
        collection(db, 'taskActivities'),
        where('workspaceKey', '==', WORKSPACE_KEY),
      ),
      (snapshot) => {
        const list: TaskActivity[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            taskId: String(data.taskId || ''),
            authorId: String(data.authorId || ''),
            authorName: String(data.authorName || ''),
            type:
              data.type === 'status_change' ||
              data.type === 'subtask_toggle' ||
              data.type === 'deadline_change' ||
              data.type === 'created'
                ? data.type
                : 'comment',
            message: String(data.message || ''),
            workspaceKey: String(data.workspaceKey || WORKSPACE_KEY),
            ownerUid: String(data.ownerUid || ''),
            createdAt: toDateOrNull(data.createdAt),
            updatedAt: toDateOrNull(data.updatedAt),
          };
        });
        list.sort(
          (a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0),
        );
        setTaskActivities(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'taskActivities');
      },
    );

    const unsubSettings = onSnapshot(
      query(
        collection(db, 'workspaceSettings'),
        where('workspaceKey', '==', WORKSPACE_KEY),
      ),
      (snapshot) => {
        const first = snapshot.docs[0];
        if (first) {
          const data = first.data();
          setWorkspaceSetting({
            id: first.id,
            noticeText: String(data.noticeText || ''),
            updatedBy: String(data.updatedBy || ''),
            workspaceKey: String(data.workspaceKey || WORKSPACE_KEY),
            ownerUid: String(data.ownerUid || ''),
            createdAt: toDateOrNull(data.createdAt),
            updatedAt: toDateOrNull(data.updatedAt),
          });
        } else {
          setWorkspaceSetting(null);
        }
        if (employeesLoaded) {
          setDataLoading(false);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'workspaceSettings');
      },
    );

    return () => {
      unsubEmployees();
      unsubTasks();
      unsubAttendance();
      unsubActivities();
      unsubSettings();
    };
  }, [authReady, firebaseUser]);

  const currentEmployee = useMemo(() => {
    if (!sessionState) return null;
    return employees.find((e) => e.id === sessionState.employeeId) || null;
  }, [employees, sessionState]);

  const dispatchNotificationsForEmployee = useCallback(
    (emp: Employee, taskList: TaskItem[], triggerPopups: boolean) => {
      const evaluated = evaluateTaskAlerts(taskList, emp.id, emp.role);
      setAlerts(
        evaluated.map((item) => ({
          ...item,
          read: readAlertIds.has(item.id),
        })),
      );

      if (!triggerPopups || evaluated.length === 0) return;

      const unsent = evaluated.filter((a) => !wasAlertSentToday(emp.id, a.id));
      if (unsent.length === 0) return;

      const overdueCount = unsent.filter((a) => a.tier === 'overdue').length;
      const todayCount = unsent.filter((a) => a.tier === 'due_today').length;
      const soonCount = unsent.filter(
        (a) => a.tier === 'due_d1' || a.tier === 'due_d3',
      ).length;

      const summaryParts: string[] = [];
      if (overdueCount > 0) summaryParts.push(`지연 ${overdueCount}건`);
      if (todayCount > 0) summaryParts.push(`오늘 마감 ${todayCount}건`);
      if (soonCount > 0) summaryParts.push(`마감 임박 ${soonCount}건`);

      if (summaryParts.length > 0) {
        const headline =
          overdueCount > 0
            ? '확인이 필요한 지연·마감 업무가 있습니다'
            : todayCount > 0
              ? '오늘 완료해야 할 업무를 확인하세요'
              : '마감이 임박한 업무가 있습니다';
        const body = `${summaryParts.join(' · ')} — "${unsent[0].taskTitle}" 외 확인 필요`;

        pushToast({
          tone: overdueCount > 0 ? 'danger' : 'warning',
          title: headline,
          description: body,
          taskId: unsent[0].taskId,
        });

        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          window.Notification.permission === 'granted'
        ) {
          try {
            new window.Notification(`TeamPulse ERP · ${headline}`, {
              body,
              tag: `teampulse_${emp.id}_${getLocalTodayStr()}`,
            });
          } catch {
            // ignore OS notification failure in restricted contexts
          }
        }

        unsent.forEach((a) => markAlertSentToday(emp.id, a.id));
      }
    },
    [pushToast, readAlertIds],
  );

  useEffect(() => {
    if (
      !authReady ||
      !firebaseUser ||
      dataLoading ||
      seeding ||
      legacyPurgeAttemptedRef.current
    ) {
      return;
    }
    legacyPurgeAttemptedRef.current = true;
    void purgeLegacyFakeData({
      employees,
      tasks,
      taskActivities,
      attendanceLogs,
      workspaceSetting,
    });
  }, [
    authReady,
    firebaseUser,
    dataLoading,
    seeding,
    employees,
    tasks,
    taskActivities,
    attendanceLogs,
    workspaceSetting,
  ]);

  useEffect(() => {
    if (!currentEmployee) {
      setAlerts([]);
      initialLoginAlertedRef.current = null;
      return;
    }
    const isFreshLogin = initialLoginAlertedRef.current !== currentEmployee.id;
    dispatchNotificationsForEmployee(currentEmployee, tasks, isFreshLogin);
    if (isFreshLogin) {
      initialLoginAlertedRef.current = currentEmployee.id;
      if (currentEmployee.role === 'admin') {
        setActiveTab((prev) => (prev === 'today' ? 'pm_dashboard' : prev));
      } else {
        setActiveTab('today');
      }
    }
  }, [currentEmployee, tasks, dispatchNotificationsForEmployee]);

  useEffect(() => {
    if (!currentEmployee) return;
    const timer = window.setInterval(() => {
      const evaluated = evaluateTaskAlerts(
        tasks,
        currentEmployee.id,
        currentEmployee.role,
      );
      const urgent = evaluated.filter(
        (a) => a.tier === 'overdue' || a.tier === 'due_today',
      );
      if (urgent.length > 0) {
        pushToast({
          tone: urgent[0].tier === 'overdue' ? 'danger' : 'warning',
          title: '미완료 마감 리마인더',
          description: `아직 완료되지 않은 긴급/당일 마감 업무 ${urgent.length}건이 있습니다.`,
          taskId: urgent[0].taskId,
        });
      }
    }, 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [currentEmployee, tasks, pushToast]);

  const requestBrowserNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported');
      pushToast({
        tone: 'info',
        title: '인앱 알림 모드로 동작 중입니다',
        description: '상단 알림센터와 토스트를 통해 마감 알림을 확인하실 수 있습니다.',
      });
      return;
    }
    try {
      const result = await window.Notification.requestPermission();
      setNotificationPermission(result);
      if (result === 'granted') {
        pushToast({
          tone: 'success',
          title: '브라우저 알림이 활성화되었습니다',
          description: '마감 임박 및 지연 업무 발생 시 데스크톱 알림으로 안내합니다.',
        });
        try {
          new window.Notification('TeamPulse ERP 알림 연결 완료', {
            body: '지연 일정과 마감 임박 업무를 브라우저 알림으로 받아보실 수 있습니다.',
          });
        } catch {
          // ignore
        }
      } else {
        pushToast({
          tone: 'warning',
          title: '브라우저 알림 권한이 차단되어 있습니다',
          description: '대신 우측 상단 토스트와 알림 센터에서 모든 알림을 확인하실 수 있습니다.',
        });
      }
    } catch {
      pushToast({
        tone: 'info',
        title: '인앱 알림 센터로 안내합니다',
      });
    }
  }, [pushToast]);

  const markAllAlertsRead = useCallback(() => {
    setReadAlertIds((prev) => {
      const next = new Set(prev);
      alerts.forEach((a) => next.add(a.id));
      return next;
    });
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
  }, [alerts]);

  const markAlertRead = useCallback((alertId: string) => {
    setReadAlertIds((prev) => new Set(prev).add(alertId));
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, read: true } : a)),
    );
  }, []);

  const unreadAlertCount = useMemo(
    () => alerts.filter((a) => !a.read).length,
    [alerts],
  );

  const appendActivity = useCallback(
    async (
      taskId: string,
      type: TaskActivity['type'],
      message: string,
      actor?: Employee,
    ) => {
      const user = await ensureAnonymousAuth();
      const author = actor || currentEmployee;
      if (!author) return;
      const activityId = generateId('act');
      const cleanMsg = message.trim().slice(0, FIELD_LIMITS.ACTIVITY_MSG_MAX);
      if (!cleanMsg) return;

      try {
        await setDoc(doc(db, 'taskActivities', activityId), {
          taskId,
          authorId: author.id,
          authorName: author.name.slice(0, FIELD_LIMITS.NAME_MAX),
          type,
          message: cleanMsg,
          workspaceKey: WORKSPACE_KEY,
          ownerUid: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.CREATE,
          `taskActivities/${activityId}`,
        );
      }
    },
    [currentEmployee],
  );

  const loginEmployee = useCallback(
    async (
      username: string,
      password: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      const cleanUser = username.trim().toLowerCase();
      const matched = employees.find(
        (e) => e.username.toLowerCase() === cleanUser && e.password === password,
      );

      if (!matched) {
        return {
          ok: false,
          error: '아이디 또는 비밀번호가 일치하지 않습니다.',
        };
      }

      const user = await ensureAnonymousAuth();
      const logId = generateId('att');
      const today = getLocalTodayStr();

      try {
        await setDoc(doc(db, 'attendanceLogs', logId), {
          employeeId: matched.id,
          employeeName: matched.name.slice(0, FIELD_LIMITS.NAME_MAX),
          date: today,
          checkInAt: serverTimestamp(),
          checkOutAt: null,
          durationMinutes: 0,
          status: 'active',
          workspaceKey: WORKSPACE_KEY,
          ownerUid: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.CREATE,
          `attendanceLogs/${logId}`,
        );
      }

      const nextSession: SessionStorageState = {
        employeeId: matched.id,
        activeAttendanceId: logId,
      };
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSessionState(nextSession);
      setActiveTab(matched.role === 'admin' ? 'pm_dashboard' : 'today');

      const nowStr = new Date().toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      pushToast({
        tone: 'success',
        title: `${matched.name}님 출근이 자동 기록되었습니다 (${nowStr})`,
        description:
          matched.role === 'admin'
            ? 'PM 관리자 대시보드에 접속했습니다.'
            : '오늘의 할 일을 확인하고 업무를 시작해 보세요.',
      });

      return { ok: true };
    },
    [employees, pushToast],
  );

  const checkoutAndLogout = useCallback(async () => {
    if (!currentEmployee) return;
    await ensureAnonymousAuth();

    const targetLog =
      attendanceLogs.find(
        (l) =>
          l.id === sessionState?.activeAttendanceId && l.status === 'active',
      ) ||
      attendanceLogs.find(
        (l) => l.employeeId === currentEmployee.id && l.status === 'active',
      );

    if (targetLog) {
      const checkInMs = targetLog.checkInAt?.getTime() || Date.now();
      const durationMinutes = Math.min(
        1440,
        Math.max(0, Math.round((Date.now() - checkInMs) / 60000)),
      );
      try {
        await updateDoc(doc(db, 'attendanceLogs', targetLog.id), {
          checkOutAt: serverTimestamp(),
          durationMinutes,
          status: 'completed',
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `attendanceLogs/${targetLog.id}`,
        );
      }
    }

    window.sessionStorage.removeItem(SESSION_KEY);
    setSessionState(null);
    initialLoginAlertedRef.current = null;
    pushToast({
      tone: 'info',
      title: '퇴근 처리 및 자동 로그아웃 완료',
      description: '오늘 하루도 수고하셨습니다.',
    });
  }, [attendanceLogs, currentEmployee, pushToast, sessionState]);

  const createTask = useCallback(
    async (input: CreateTaskInput): Promise<string | null> => {
      if (!currentEmployee || currentEmployee.role !== 'admin') return null;
      const cleanTitle = input.title
        .trim()
        .slice(0, FIELD_LIMITS.TASK_TITLE_MAX);
      if (!cleanTitle) return null;

      const user = await ensureAnonymousAuth();
      const taskId = generateId('task');
      const subtasks = input.subtasks
        .slice(0, FIELD_LIMITS.SUBTASKS_MAX)
        .map((st, idx) => ({
          id: st.id || `st_${Date.now()}_${idx}`,
          title: st.title.trim().slice(0, 140),
          completed: Boolean(st.completed),
        }));
      const progress = computeTaskProgress(subtasks, 'todo');

      try {
        await setDoc(doc(db, 'tasks', taskId), {
          title: cleanTitle,
          description: input.description
            .trim()
            .slice(0, FIELD_LIMITS.TASK_DESC_MAX),
          assigneeId: input.assigneeId,
          creatorId: currentEmployee.id,
          priority: input.priority,
          status: 'todo',
          startDate: input.startDate,
          dueDate: input.dueDate < input.startDate ? input.startDate : input.dueDate,
          subtasks,
          progress,
          workspaceKey: WORKSPACE_KEY,
          ownerUid: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `tasks/${taskId}`);
      }

      const assignee = employees.find((e) => e.id === input.assigneeId);
      await appendActivity(
        taskId,
        'created',
        `새 업무를 등록하고 ${assignee?.name || '담당자'}님에게 할당했습니다.`,
      );

      pushToast({
        tone: 'success',
        title: '새 업무가 등록되었습니다',
        description: cleanTitle,
        taskId,
      });

      return taskId;
    },
    [appendActivity, currentEmployee, employees, pushToast],
  );

  const updateTaskAdmin = useCallback(
    async (taskId: string, input: UpdateTaskAdminInput) => {
      if (!currentEmployee || currentEmployee.role !== 'admin') return;
      const existing = tasks.find((t) => t.id === taskId);
      if (!existing) return;

      await ensureAnonymousAuth();

      const nextSubtasks =
        input.subtasks !== undefined
          ? input.subtasks.slice(0, FIELD_LIMITS.SUBTASKS_MAX)
          : existing.subtasks;
      const nextStatus = input.status ?? existing.status;
      const nextProgress = computeTaskProgress(nextSubtasks, nextStatus);
      const nextStartDate = input.startDate ?? existing.startDate;
      const nextDueDateRaw = input.dueDate ?? existing.dueDate;
      const nextDueDate =
        nextDueDateRaw < nextStartDate ? nextStartDate : nextDueDateRaw;

      const patch: Record<string, unknown> = {
        progress: nextProgress,
        updatedAt: serverTimestamp(),
      };
      if (input.title !== undefined) {
        const cleanTitle = input.title
          .trim()
          .slice(0, FIELD_LIMITS.TASK_TITLE_MAX);
        if (cleanTitle) patch.title = cleanTitle;
      }
      if (input.description !== undefined) {
        patch.description = input.description
          .trim()
          .slice(0, FIELD_LIMITS.TASK_DESC_MAX);
      }
      if (input.assigneeId !== undefined) patch.assigneeId = input.assigneeId;
      if (input.priority !== undefined) patch.priority = input.priority;
      if (input.status !== undefined) patch.status = nextStatus;
      if (input.startDate !== undefined) patch.startDate = nextStartDate;
      if (input.dueDate !== undefined || input.startDate !== undefined) {
        patch.dueDate = nextDueDate;
      }
      if (input.subtasks !== undefined) patch.subtasks = nextSubtasks;

      try {
        await updateDoc(doc(db, 'tasks', taskId), patch);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
      }

      if (input.dueDate && input.dueDate !== existing.dueDate) {
        await appendActivity(
          taskId,
          'deadline_change',
          `마감일을 ${existing.dueDate}에서 ${nextDueDate}(으)로 변경했습니다.`,
        );
      }
      if (input.status && input.status !== existing.status) {
        const labelMap: Record<TaskStatus, string> = {
          todo: '예정',
          in_progress: '진행중',
          done: '완료',
        };
        await appendActivity(
          taskId,
          'status_change',
          `상태를 '${labelMap[input.status]}'(으)로 변경했습니다.`,
        );
      }
    },
    [appendActivity, currentEmployee, tasks],
  );

  const duplicateTask = useCallback(
    async (taskId: string): Promise<string | null> => {
      if (!currentEmployee || currentEmployee.role !== 'admin') return null;
      const src = tasks.find((t) => t.id === taskId);
      if (!src) return null;

      const user = await ensureAnonymousAuth();
      const newTaskId = generateId('task');
      const clonedSubtasks = src.subtasks.map((st, idx) => ({
        id: `st_${Date.now()}_${idx}`,
        title: st.title,
        completed: false,
      }));
      const clonedTitle = `[복사] ${src.title}`.slice(
        0,
        FIELD_LIMITS.TASK_TITLE_MAX,
      );

      try {
        await setDoc(doc(db, 'tasks', newTaskId), {
          title: clonedTitle,
          description: src.description,
          assigneeId: src.assigneeId,
          creatorId: currentEmployee.id,
          priority: src.priority,
          status: 'todo',
          startDate: src.startDate,
          dueDate: src.dueDate,
          subtasks: clonedSubtasks,
          progress: 0,
          workspaceKey: WORKSPACE_KEY,
          ownerUid: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.CREATE,
          `tasks/${newTaskId}`,
        );
      }

      await appendActivity(
        newTaskId,
        'created',
        `"${src.title}" 업무 및 세부 단계를 복제하여 생성했습니다.`,
      );

      pushToast({
        tone: 'success',
        title: '업무 및 세부 단계가 복제되었습니다',
        description: clonedTitle,
        taskId: newTaskId,
      });

      return newTaskId;
    },
    [appendActivity, currentEmployee, pushToast, tasks],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!currentEmployee || currentEmployee.role !== 'admin') return;
      await ensureAnonymousAuth();

      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'tasks', taskId));
        taskActivities
          .filter((a) => a.taskId === taskId)
          .forEach((a) => batch.delete(doc(db, 'taskActivities', a.id)));
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
      }

      pushToast({
        tone: 'info',
        title: '업무가 삭제되었습니다',
      });
    },
    [currentEmployee, pushToast, taskActivities],
  );

  const toggleSubtask = useCallback(
    async (taskId: string, subtaskId: string) => {
      if (!currentEmployee) return;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      await ensureAnonymousAuth();

      let toggledTitle = '';
      let nowCompleted = false;
      const nextSubtasks = task.subtasks.map((st) => {
        if (st.id !== subtaskId) return st;
        toggledTitle = st.title;
        nowCompleted = !st.completed;
        return { ...st, completed: nowCompleted };
      });

      const nextStatus: TaskStatus =
        nextSubtasks.length > 0 && nextSubtasks.every((s) => s.completed)
          ? 'done'
          : nextSubtasks.some((s) => s.completed)
            ? 'in_progress'
            : 'todo';
      const nextProgress = computeTaskProgress(nextSubtasks, nextStatus);

      try {
        await updateDoc(doc(db, 'tasks', taskId), {
          subtasks: nextSubtasks,
          progress: nextProgress,
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
      }

      if (toggledTitle) {
        await appendActivity(
          taskId,
          'subtask_toggle',
          `세부 단계 '${toggledTitle}'을(를) ${nowCompleted ? '완료' : '미완료'}로 표시했습니다.`,
        );
      }
    },
    [appendActivity, currentEmployee, tasks],
  );

  const updateTaskStatus = useCallback(
    async (taskId: string, status: TaskStatus) => {
      if (!currentEmployee) return;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      await ensureAnonymousAuth();
      const nextProgress =
        task.subtasks.length > 0
          ? task.progress
          : computeTaskProgress(task.subtasks, status);

      try {
        await updateDoc(doc(db, 'tasks', taskId), {
          status,
          progress: nextProgress,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
      }

      const labelMap: Record<TaskStatus, string> = {
        todo: '예정',
        in_progress: '진행중',
        done: '완료',
      };
      await appendActivity(
        taskId,
        'status_change',
        `업무 상태를 '${labelMap[status]}'(으)로 변경했습니다.`,
      );
    },
    [appendActivity, currentEmployee, tasks],
  );

  const addTaskComment = useCallback(
    async (taskId: string, message: string) => {
      if (!currentEmployee) return;
      if (!message.trim()) return;
      await appendActivity(taskId, 'comment', message);
    },
    [appendActivity, currentEmployee],
  );

  const createEmployeeAccount = useCallback(
    async (
      input: CreateEmployeeInput,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!currentEmployee || currentEmployee.role !== 'admin') {
        return { ok: false, error: '관리자만 계정을 생성할 수 있습니다.' };
      }

      const username = input.username.trim();
      const password = input.password;
      const name = input.name.trim().slice(0, FIELD_LIMITS.NAME_MAX);
      const department = input.department.trim().slice(0, FIELD_LIMITS.DEPT_MAX);
      const title = input.title.trim().slice(0, FIELD_LIMITS.TITLE_MAX);

      if (
        username.length < FIELD_LIMITS.USERNAME_MIN ||
        username.length > FIELD_LIMITS.USERNAME_MAX ||
        !FIELD_LIMITS.USERNAME_PATTERN.test(username)
      ) {
        return {
          ok: false,
          error: '아이디는 영문·숫자·밑줄·하이픈 2~32자로 입력해 주세요.',
        };
      }
      if (
        password.length < FIELD_LIMITS.PASSWORD_MIN ||
        password.length > FIELD_LIMITS.PASSWORD_MAX
      ) {
        return {
          ok: false,
          error: '비밀번호는 4~64자로 입력해 주세요.',
        };
      }
      if (!name || !department || !title) {
        return {
          ok: false,
          error: '이름, 부서, 직무를 모두 입력해 주세요.',
        };
      }
      if (
        employees.some(
          (e) => e.username.toLowerCase() === username.toLowerCase(),
        )
      ) {
        return {
          ok: false,
          error: '이미 사용 중인 아이디입니다.',
        };
      }

      const user = await ensureAnonymousAuth();
      const empId = generateId('emp');

      try {
        await setDoc(doc(db, 'employees', empId), {
          username,
          password,
          name,
          department,
          title,
          role: input.role,
          avatarUrl: '',
          workspaceKey: WORKSPACE_KEY,
          ownerUid: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.CREATE,
          `employees/${empId}`,
        );
      }

      pushToast({
        tone: 'success',
        title: `${name} 계정이 생성되었습니다`,
        description: `로그인 아이디: ${username}`,
      });
      return { ok: true };
    },
    [currentEmployee, employees, pushToast],
  );

  const updateEmployeeAccount = useCallback(
    async (
      employeeId: string,
      input: UpdateEmployeeInput,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!currentEmployee || currentEmployee.role !== 'admin') {
        return { ok: false, error: '관리자만 직원 정보를 수정할 수 있습니다.' };
      }

      const target = employees.find((e) => e.id === employeeId);
      if (!target) {
        return { ok: false, error: '직원 계정을 찾을 수 없습니다.' };
      }

      const name = input.name.trim().slice(0, FIELD_LIMITS.NAME_MAX);
      const department = input.department.trim().slice(0, FIELD_LIMITS.DEPT_MAX);
      const title = input.title.trim().slice(0, FIELD_LIMITS.TITLE_MAX);
      const password = input.password;

      if (!name || !department || !title) {
        return {
          ok: false,
          error: '이름, 부서, 직무는 비워둘 수 없습니다.',
        };
      }
      if (
        password.length < FIELD_LIMITS.PASSWORD_MIN ||
        password.length > FIELD_LIMITS.PASSWORD_MAX
      ) {
        return {
          ok: false,
          error: '비밀번호는 4~64자로 입력해 주세요.',
        };
      }
      if (
        target.role === 'admin' &&
        input.role !== 'admin' &&
        employees.filter((e) => e.role === 'admin').length <= 1
      ) {
        return {
          ok: false,
          error: '최소 1명의 관리자(PM) 계정은 유지되어야 합니다.',
        };
      }

      await ensureAnonymousAuth();
      try {
        await updateDoc(doc(db, 'employees', employeeId), {
          name,
          password,
          department,
          title,
          role: input.role,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `employees/${employeeId}`,
        );
      }

      pushToast({
        tone: 'success',
        title: '직원 계정 정보가 수정되었습니다',
      });
      return { ok: true };
    },
    [currentEmployee, employees, pushToast],
  );

  const deleteEmployeeAccount = useCallback(
    async (employeeId: string) => {
      if (!currentEmployee || currentEmployee.role !== 'admin') return;
      if (employeeId === currentEmployee.id) {
        pushToast({
          tone: 'warning',
          title: '현재 로그인 중인 본인 계정은 삭제할 수 없습니다',
        });
        return;
      }

      const target = employees.find((e) => e.id === employeeId);
      if (
        target?.role === 'admin' &&
        employees.filter((e) => e.role === 'admin').length <= 1
      ) {
        pushToast({
          tone: 'warning',
          title: '최소 1명의 관리자 계정은 유지되어야 합니다',
        });
        return;
      }

      await ensureAnonymousAuth();
      try {
        await deleteDoc(doc(db, 'employees', employeeId));
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `employees/${employeeId}`,
        );
      }

      pushToast({
        tone: 'info',
        title: '직원 계정이 삭제되었습니다',
      });
    },
    [currentEmployee, employees, pushToast],
  );

  const updatePinnedNotice = useCallback(
    async (noticeText: string) => {
      if (!currentEmployee || currentEmployee.role !== 'admin') return;
      const user = await ensureAnonymousAuth();
      const cleanNotice = noticeText.trim().slice(0, FIELD_LIMITS.NOTICE_MAX);
      const updatedBy = currentEmployee.name.slice(0, FIELD_LIMITS.NAME_MAX);

      try {
        if (workspaceSetting) {
          await updateDoc(doc(db, 'workspaceSettings', workspaceSetting.id), {
            noticeText: cleanNotice,
            updatedBy,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'workspaceSettings', 'main_settings'), {
            noticeText: cleanNotice,
            updatedBy,
            workspaceKey: WORKSPACE_KEY,
            ownerUid: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          'workspaceSettings/main_settings',
        );
      }

      pushToast({
        tone: 'success',
        title: cleanNotice
          ? '상단 팀 공지가 업데이트되었습니다'
          : '팀 공지가 비워졌습니다',
      });
    },
    [currentEmployee, pushToast, workspaceSetting],
  );

  const value: ErpContextValue = {
    firebaseUser,
    authReady,
    authError,
    retryAnonymousAuth: triggerSilentAnonSignIn,
    dataLoading,
    seeding,
    employees,
    tasks,
    attendanceLogs,
    taskActivities,
    workspaceSetting,
    currentEmployee,
    activeAttendanceId: sessionState?.activeAttendanceId || null,
    activeTab,
    setActiveTab,
    loginEmployee,
    checkoutAndLogout,
    createTask,
    updateTaskAdmin,
    duplicateTask,
    deleteTask,
    toggleSubtask,
    updateTaskStatus,
    addTaskComment,
    createEmployeeAccount,
    updateEmployeeAccount,
    deleteEmployeeAccount,
    updatePinnedNotice,
    alerts,
    unreadAlertCount,
    markAllAlertsRead,
    markAlertRead,
    notificationPermission,
    requestBrowserNotificationPermission,
    toasts,
    pushToast,
    dismissToast,
  };

  return <ErpContext.Provider value={value}>{children}</ErpContext.Provider>;
}

export function useErp() {
  const ctx = useContext(ErpContext);
  if (!ctx) {
    throw new Error('useErp must be used inside ErpProvider');
  }
  return ctx;
}
