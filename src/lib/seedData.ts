import {
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  AttendanceLog,
  Employee,
  TaskActivity,
  TaskItem,
  WorkspaceSetting,
} from '../types/erp';
import {
  db,
  handleFirestoreError,
  OperationType,
  WORKSPACE_KEY,
} from './firebase';

let seedInFlightPromise: Promise<void> | null = null;
let purgeInFlightPromise: Promise<void> | null = null;

const LEGACY_FAKE_EMPLOYEE_IDS = new Set(['emp_kim', 'emp_park', 'emp_choi']);
const LEGACY_FAKE_TASK_IDS = new Set([
  'task_seed_1',
  'task_seed_2',
  'task_seed_3',
  'task_seed_4',
  'task_seed_5',
  'task_seed_6',
]);
const LEGACY_FAKE_ACTIVITY_IDS = new Set([
  'act_seed_1',
  'act_seed_2',
  'act_seed_3',
]);
const LEGACY_FAKE_NOTICE =
  '금주 금요일 16:00 전사 스프린트 리뷰 — 담당 업무 진행률 및 메모를 사전에 업데이트해 주세요.';
const LEGACY_FAKE_ADMIN_NAME = '김지훈';

/**
 * 최초 빈 워크스페이스 구동 시 최소 관리자 계정(admin / 1234)만 생성합니다.
 * 가짜 직원, 가짜 업무, 가짜 댓글, 가짜 공지는 생성하지 않습니다.
 */
export async function seedInitialWorkspace(uid: string): Promise<void> {
  if (seedInFlightPromise) {
    return seedInFlightPromise;
  }

  seedInFlightPromise = (async () => {
    try {
      const batch = writeBatch(db);

      batch.set(doc(collection(db, 'employees'), 'emp_admin'), {
        username: 'admin',
        password: '1234',
        name: '관리자',
        department: '운영관리',
        title: 'PM 관리자',
        role: 'admin',
        avatarUrl: '',
        workspaceKey: WORKSPACE_KEY,
        ownerUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, 'workspaceSettings', 'main_settings'), {
        noticeText: '',
        updatedBy: '관리자',
        workspaceKey: WORKSPACE_KEY,
        ownerUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'employees/bootstrap');
    }
  })().finally(() => {
    seedInFlightPromise = null;
  });

  return seedInFlightPromise;
}

/**
 * 이전 버전에서 Firestore에 남아있을 수 있는 하드코딩 샘플 데이터를 1회 정리합니다.
 */
export async function purgeLegacyFakeData(params: {
  employees: Employee[];
  tasks: TaskItem[];
  taskActivities: TaskActivity[];
  attendanceLogs: AttendanceLog[];
  workspaceSetting: WorkspaceSetting | null;
}): Promise<boolean> {
  if (purgeInFlightPromise) {
    await purgeInFlightPromise;
    return false;
  }

  const fakeEmps = params.employees.filter((e) =>
    LEGACY_FAKE_EMPLOYEE_IDS.has(e.id),
  );
  const legacyAdmin = params.employees.find(
    (e) => e.id === 'emp_admin' && e.name === LEGACY_FAKE_ADMIN_NAME,
  );
  const fakeTasks = params.tasks.filter((t) =>
    LEGACY_FAKE_TASK_IDS.has(t.id),
  );
  const fakeActivities = params.taskActivities.filter(
    (a) =>
      LEGACY_FAKE_ACTIVITY_IDS.has(a.id) || LEGACY_FAKE_TASK_IDS.has(a.taskId),
  );
  const fakeAttendance = params.attendanceLogs.filter(
    (l) =>
      LEGACY_FAKE_EMPLOYEE_IDS.has(l.employeeId) ||
      l.employeeName === LEGACY_FAKE_ADMIN_NAME,
  );
  const hasFakeNotice =
    params.workspaceSetting?.noticeText === LEGACY_FAKE_NOTICE ||
    params.workspaceSetting?.updatedBy === LEGACY_FAKE_ADMIN_NAME;

  if (
    fakeEmps.length === 0 &&
    !legacyAdmin &&
    fakeTasks.length === 0 &&
    fakeActivities.length === 0 &&
    fakeAttendance.length === 0 &&
    !hasFakeNotice
  ) {
    return false;
  }

  purgeInFlightPromise = (async () => {
    try {
      const batch = writeBatch(db);
      fakeActivities.forEach((a) => batch.delete(doc(db, 'taskActivities', a.id)));
      fakeTasks.forEach((t) => batch.delete(doc(db, 'tasks', t.id)));
      fakeAttendance.forEach((l) =>
        batch.delete(doc(db, 'attendanceLogs', l.id)),
      );
      fakeEmps.forEach((e) => batch.delete(doc(db, 'employees', e.id)));
      await batch.commit();

      if (legacyAdmin) {
        await updateDoc(doc(db, 'employees', legacyAdmin.id), {
          name: '관리자',
          department: '운영관리',
          title: 'PM 관리자',
          avatarUrl: '',
          updatedAt: serverTimestamp(),
        });
      }

      if (hasFakeNotice && params.workspaceSetting) {
        await updateDoc(
          doc(db, 'workspaceSettings', params.workspaceSetting.id),
          {
            noticeText:
              params.workspaceSetting.noticeText === LEGACY_FAKE_NOTICE
                ? ''
                : params.workspaceSetting.noticeText,
            updatedBy: '관리자',
            updatedAt: serverTimestamp(),
          },
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'legacy_seed_cleanup');
    }
  })().finally(() => {
    purgeInFlightPromise = null;
  });

  await purgeInFlightPromise;
  return true;
}
