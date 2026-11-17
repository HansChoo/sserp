import React, { useEffect, useState } from 'react';
import { Calendar, Plus, Trash2, X } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { FIELD_LIMITS, SubtaskItem, TaskPriority } from '../types/erp';
import {
  addDaysYmd,
  getLocalTodayStr,
  getThisFridayYmd,
} from '../utils/dateAndAlerts';

interface QuickTaskModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (taskId: string) => void;
}

export function QuickTaskModal({ open, onClose, onCreated }: QuickTaskModalProps) {
  const { employees, currentEmployee, createTask } = useErp();

  const today = getLocalTodayStr();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [startDate, setStartDate] = useState(today);
  const [dueDate, setDueDate] = useState(addDaysYmd(today, 2));
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const defEmp =
        employees.find((e) => e.role === 'member')?.id ||
        employees[0]?.id ||
        '';
      setAssigneeId(defEmp);
      setStartDate(getLocalTodayStr());
      setDueDate(addDaysYmd(getLocalTodayStr(), 2));
      setTitle('');
      setDescription('');
      setPriority('medium');
      setSubtasks([]);
      setNewSubtask('');
    }
  }, [open, employees]);

  if (!open || currentEmployee?.role !== 'admin') return null;

  const handleAddSubtask = () => {
    const clean = newSubtask.trim();
    if (!clean || subtasks.length >= FIELD_LIMITS.SUBTASKS_MAX) return;
    setSubtasks((prev) => [
      ...prev,
      {
        id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: clean,
        completed: false,
      },
    ]);
    setNewSubtask('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !assigneeId) return;
    setSubmitting(true);
    try {
      const id = await createTask({
        title,
        description,
        assigneeId,
        priority,
        startDate,
        dueDate: dueDate < startDate ? startDate : dueDate,
        subtasks,
      });
      if (id && onCreated) {
        onCreated(id);
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const applyDuePreset = (targetDue: string) => {
    setDueDate(targetDue < startDate ? startDate : targetDue);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/35 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="새 업무 등록"
    >
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80">
          <h2 className="text-base font-bold text-slate-900">새 업무 등록</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              업무 제목
            </label>
            <input
              type="text"
              required
              autoFocus
              maxLength={FIELD_LIMITS.TASK_TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="업무 제목을 입력하세요"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                담당자
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-blue-600"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.department})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                우선순위
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-blue-600"
              >
                <option value="high">높음 (긴급)</option>
                <option value="medium">보통</option>
                <option value="low">낮음</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>일정 및 데드라인</span>
              </label>
              <div className="flex items-center gap-1">
                {[
                  { label: '오늘', date: today },
                  { label: '내일', date: addDaysYmd(today, 1) },
                  { label: '금주 금', date: getThisFridayYmd(today) },
                  { label: '+7일', date: addDaysYmd(today, 7) },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyDuePreset(preset.date)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      dueDate === preset.date
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <span className="block text-xs text-slate-500 mb-1">시작일</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <span className="block text-xs text-slate-500 mb-1">데드라인</span>
                <input
                  type="date"
                  value={dueDate}
                  min={startDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              업무 상세 내용
            </label>
            <textarea
              rows={2}
              maxLength={FIELD_LIMITS.TASK_DESC_MAX}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="업무 배경, 참고 사항이나 완료 기준을 적어주세요."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              세부 단계 체크리스트 ({subtasks.length}/{FIELD_LIMITS.SUBTASKS_MAX})
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                placeholder="세부 단계 입력 후 Enter"
                className="flex-1 px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="px-3.5 py-2 text-xs font-semibold border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                추가
              </button>
            </div>
            {subtasks.length > 0 && (
              <ul className="space-y-1.5 max-h-32 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50">
                {subtasks.map((st) => (
                  <li
                    key={st.id}
                    className="flex items-center justify-between gap-2 text-xs text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-200/80"
                  >
                    <span className="truncate">{st.title}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSubtasks((prev) => prev.filter((item) => item.id !== st.id))
                      }
                      aria-label="세부 단계 삭제"
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? '등록 중...' : '업무 등록하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
