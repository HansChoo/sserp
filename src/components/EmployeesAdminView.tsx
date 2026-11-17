import React, { useState } from 'react';
import { KeyRound, Plus, ShieldAlert, Trash2, UserPlus } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { EmployeeRole, FIELD_LIMITS } from '../types/erp';
import { Avatar } from './Avatar';

export function EmployeesAdminView() {
  const {
    currentEmployee,
    employees,
    createEmployeeAccount,
    updateEmployeeAccount,
    deleteEmployeeAccount,
  } = useErp();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [title, setTitle] = useState('');
  const [role, setRole] = useState<EmployeeRole>('member');
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<EmployeeRole>('member');
  const [editDept, setEditDept] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (currentEmployee?.role !== 'admin') {
    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <ShieldAlert className="w-7 h-7 text-red-600 mx-auto mb-3" />
        <p className="text-base font-semibold text-slate-900">
          관리자 전용 메뉴입니다
        </p>
        <p className="text-sm text-slate-500 mt-1.5">
          직원 아이디 및 비밀번호 관리는 관리자(PM)만 수행할 수 있습니다.
        </p>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setCreating(true);
    try {
      const res = await createEmployeeAccount({
        username,
        password,
        name,
        department,
        title,
        role,
      });
      if (!res.ok) {
        setFormError(res.error || '계정 생성에 실패했습니다.');
      } else {
        setUsername('');
        setPassword('');
        setName('');
        setDepartment('');
        setTitle('');
      }
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (empId: string) => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    setEditingId(empId);
    setEditError('');
    setEditName(emp.name);
    setEditPassword(emp.password);
    setEditDept(emp.department);
    setEditTitle(emp.title);
    setEditRole(emp.role);
  };

  const handleSaveEdit = async (empId: string) => {
    setEditError('');
    const res = await updateEmployeeAccount(empId, {
      name: editName,
      password: editPassword,
      department: editDept,
      title: editTitle,
      role: editRole,
    });
    if (res.ok) {
      setEditingId(null);
    } else {
      setEditError(res.error || '정보 수정에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Employee Account Form */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-2.5 mb-5">
          <UserPlus className="w-4 h-4 text-slate-700" />
          <h2 className="text-[15px] font-semibold text-slate-900">
            신규 직원 계정 생성
          </h2>
        </div>

        <form
          onSubmit={handleCreate}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3.5"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              로그인 아이디
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.USERNAME_MAX}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="영문·숫자 2자 이상"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              비밀번호 (4자 이상)
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.PASSWORD_MAX}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="초기 비밀번호"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              이름
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="직원 이름"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              부서
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.DEPT_MAX}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="소속 부서"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              직무
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="담당 직무"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              권한
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as EmployeeRole)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-blue-600"
            >
              <option value="member">일반 직원</option>
              <option value="admin">관리자 (PM)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={creating}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>계정 생성</span>
            </button>
          </div>
        </form>

        {formError && (
          <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[13px] font-medium text-red-700">
            {formError}
          </div>
        )}
      </section>

      {/* Employees Table */}
      <section className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="px-6 py-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-slate-900">
            등록된 직원 계정 ({employees.length}명)
          </h2>
          <span className="text-xs text-slate-500">
            여기서 관리자 및 직원의 비밀번호와 부서·직무를 수정할 수 있습니다
          </span>
        </div>

        {editError && (
          <div className="mx-6 mt-4 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[13px] font-medium text-red-700">
            {editError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70 text-xs font-semibold text-slate-500">
                <th className="px-6 py-3">직원</th>
                <th className="px-6 py-3">아이디</th>
                <th className="px-6 py-3">비밀번호</th>
                <th className="px-6 py-3">부서 / 직무</th>
                <th className="px-6 py-3">권한</th>
                <th className="px-6 py-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-[13px]">
              {employees.map((emp) => {
                const isEditing = editingId === emp.id;
                return (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={emp.name} src={emp.avatarUrl} size="sm" />
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg w-28"
                          />
                        ) : (
                          <span className="font-semibold text-slate-900 text-sm">
                            {emp.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 font-mono-tabular text-slate-700">
                      {emp.username}
                    </td>
                    <td className="px-6 py-3.5 font-mono-tabular text-slate-700">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg w-28"
                        />
                      ) : (
                        emp.password
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editDept}
                            onChange={(e) => setEditDept(e.target.value)}
                            placeholder="부서"
                            className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg w-24"
                          />
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="직무"
                            className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg w-28"
                          />
                        </div>
                      ) : (
                        <span>
                          {emp.department} · {emp.title}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {isEditing ? (
                        <select
                          value={editRole}
                          onChange={(e) =>
                            setEditRole(e.target.value as EmployeeRole)
                          }
                          className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
                        >
                          <option value="member">일반 직원</option>
                          <option value="admin">관리자 (PM)</option>
                        </select>
                      ) : (
                        <span
                          className={
                            emp.role === 'admin'
                              ? 'font-semibold text-blue-700'
                              : 'text-slate-600'
                          }
                        >
                          {emp.role === 'admin' ? '관리자 (PM)' : '일반 직원'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(emp.id)}
                              className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 whitespace-nowrap"
                            >
                              저장
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(emp.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>정보·비번 수정</span>
                            </button>
                            {emp.id !== currentEmployee.id &&
                              (confirmDeleteId === emp.id ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    deleteEmployeeAccount(emp.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 whitespace-nowrap"
                                >
                                  삭제 확인
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(emp.id)}
                                  aria-label={`${emp.name} 계정 삭제`}
                                  className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ))}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
