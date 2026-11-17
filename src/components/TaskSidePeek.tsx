import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Copy,
  Lock,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { FIELD_LIMITS, TaskPriority, TaskStatus } from '../types/erp';
import {
  addDaysYmd,
  formatShortDateTime,
  getDeadlineMeta,
  getLocalTodayStr,
  getThisFridayYmd,
} from '../utils/dateAndAlerts';
import { Avatar } from './Avatar';

interface TaskSidePeekProps {
  taskId: string | null;
  onClose: () => void;
  onSelectTask: (taskId: string) => void;
}

export function TaskSidePeek({
  taskId,
  onClose,
  onSelectTask,
}: TaskSidePeekProps) {
  const {
    tasks,
    employees,
    taskActivities,
    currentEmployee,
    updateTaskAdmin,
    duplicateTask,
    deleteTask,
    toggleSubtask,
    updateTaskStatus,
    addTaskComment,
  } = useErp();

  const task = useMemo(
    () => tasks.find((t) => t.id === taskId) || null,
    [tasks, taskId],
  );
  const activities = useMemo(
    () => taskActivities.filter((a) => a.taskId === taskId),
    [taskActivities, taskId],
  );

  const isAdmin = currentEmployee?.role === 'admin';
  const today = getLocalTodayStr();

  const [titleDraft, setTitleDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (task) {
      setTitleDraft(task.title);
      setDescDraft(task.description);
      setConfirmDelete(false);
    }
  }, [task]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && taskId) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [taskId, onClose]);

  if (!task) return null;

  const assignee = employees.find((e) => e.id === task.assigneeId);
  const deadlineMeta = getDeadlineMeta(task.dueDate, task.status);

  const handleSaveTitle = async () => {
    if (!isAdmin) return;
    const clean = titleDraft.trim();
    if (!clean) {
      setTitleDraft(task.title);
      return;
    }
    if (clean !== task.title) {
      await updateTaskAdmin(task.id, { title: clean });
    }
  };

  const handleSaveDescription = async () => {
    if (!isAdmin) return;
    if (descDraft.trim() !== task.description) {
      await updateTaskAdmin(task.id, { description: descDraft });
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const clean = newSubtaskText.trim();
    if (!clean || task.subtasks.length >= FIELD_LIMITS.SUBTASKS_MAX) return;
    const nextSubtasks = [
      ...task.subtasks,
      {
        id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: clean,
        completed: false,
      },
    ];
    setNewSubtaskText('');
    await updateTaskAdmin(task.id, { subtasks: nextSubtasks });
  };

  const handleRemoveSubtask = async (subtaskId: string) => {
    if (!isAdmin) return;
    const nextSubtasks = task.subtasks.filter((s) => s.id !== subtaskId);
    await updateTaskAdmin(task.id, { subtasks: nextSubtasks });
  };

  const handleSendComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = commentText.trim();
    if (!clean) return;
    setCommentText('');
    await addTaskComment(task.id, clean);
  };

  const handleDuplicate = async () => {
    if (!isAdmin) return;
    const newId = await duplicateTask(task.id);
    if (newId) {
      onSelectTask(newId);
    }
  };

  const handleDelete = async () => {
    if (!isAdmin) return;
    await deleteTask(task.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/25">
      <div className="flex-1" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="업무 상세 사이드 피크"
        className="w-full max-w-[560px] bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl"
      >
        {/* Top Action Bar */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-200/80">
          <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl">
            {(
              [
                { value: 'todo', label: '예정' },
                { value: 'in_progress', label: '진행중' },
                { value: 'done', label: '완료' },
              ] as { value: TaskStatus; label: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateTaskStatus(task.id, opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  task.status === opt.value
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={handleDuplicate}
                  title="업무 및 세부 단계 1클릭 복제"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>복제</span>
                </button>
                {confirmDelete ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 whitespace-nowrap"
                  >
                    삭제 확인
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    title="업무 삭제"
                    aria-label="업무 삭제"
                    className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="사이드 피크 닫기"
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {!isAdmin && (
            <div className="flex items-center gap-2.5 text-[13px] text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <Lock className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                업무 내용과 데드라인 수정은 관리자(PM) 전용입니다. 세부 단계 체크와 메모 작성은 자유롭게 가능합니다.
              </span>
            </div>
          )}

          {/* Title & Deadline Meta */}
          <div>
            <div className="flex items-center gap-2 text-xs mb-2.5">
              <span className={`font-semibold ${deadlineMeta.textClass}`}>
                {deadlineMeta.label}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="font-mono-tabular text-slate-600">
                마감 {task.dueDate}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="text-slate-600">
                우선순위{' '}
                {task.priority === 'high'
                  ? '높음'
                  : task.priority === 'low'
                    ? '낮음'
                    : '보통'}
              </span>
            </div>

            {isAdmin ? (
              <input
                type="text"
                maxLength={FIELD_LIMITS.TASK_TITLE_MAX}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                className="w-full text-xl font-bold text-slate-900 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl px-2.5 py-1.5 -mx-2.5 focus:outline-none"
              />
            ) : (
              <h2 className="text-xl font-bold text-slate-900 leading-snug">
                {task.title}
              </h2>
            )}
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-1 gap-3.5 py-5 border-y border-slate-200/80 text-[13px]">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500 font-medium w-24 shrink-0">담당자</span>
              {isAdmin ? (
                <select
                  value={task.assigneeId}
                  onChange={(e) =>
                    updateTaskAdmin(task.id, { assigneeId: e.target.value })
                  }
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.department})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex-1 flex items-center gap-2.5 text-slate-900 font-medium">
                  <Avatar
                    name={assignee?.name || '미정'}
                    src={assignee?.avatarUrl}
                    size="xs"
                  />
                  <span>
                    {assignee ? `${assignee.name} · ${assignee.department}` : '미지정'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500 font-medium w-24 shrink-0">우선순위</span>
              {isAdmin ? (
                <select
                  value={task.priority}
                  onChange={(e) =>
                    updateTaskAdmin(task.id, {
                      priority: e.target.value as TaskPriority,
                    })
                  }
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900"
                >
                  <option value="high">높음 (긴급)</option>
                  <option value="medium">보통</option>
                  <option value="low">낮음</option>
                </select>
              ) : (
                <span className="flex-1 text-slate-900">
                  {task.priority === 'high'
                    ? '높음 (긴급)'
                    : task.priority === 'low'
                      ? '낮음'
                      : '보통'}
                </span>
              )}
            </div>

            <div className="flex items-start justify-between gap-4">
              <span className="text-slate-500 font-medium w-24 shrink-0 pt-2">
                일정 · 마감
              </span>
              {isAdmin ? (
                <div className="flex-1 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={task.startDate}
                      onChange={(e) =>
                        updateTaskAdmin(task.id, {
                          startDate: e.target.value,
                          dueDate:
                            task.dueDate < e.target.value
                              ? e.target.value
                              : task.dueDate,
                        })
                      }
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-xl font-mono-tabular text-slate-900"
                    />
                    <span className="text-slate-400">~</span>
                    <input
                      type="date"
                      value={task.dueDate}
                      min={task.startDate}
                      onChange={(e) =>
                        updateTaskAdmin(task.id, { dueDate: e.target.value })
                      }
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-xl font-mono-tabular text-slate-900"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: '오늘', date: today },
                      { label: '내일', date: addDaysYmd(today, 1) },
                      { label: '금주 금', date: getThisFridayYmd(today) },
                      { label: '+7일', date: addDaysYmd(today, 7) },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          updateTaskAdmin(task.id, {
                            dueDate:
                              preset.date < task.startDate
                                ? task.startDate
                                : preset.date,
                          })
                        }
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                          task.dueDate === preset.date
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center gap-2 font-mono-tabular text-slate-900 pt-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>
                    {task.startDate} ~ {task.dueDate}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-[13px] font-semibold text-slate-700 mb-2">
              업무 상세 설명
            </h3>
            {isAdmin ? (
              <textarea
                rows={3}
                maxLength={FIELD_LIMITS.TASK_DESC_MAX}
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                onBlur={handleSaveDescription}
                placeholder="업무 설명이나 참고 사항을 입력하세요."
                className="w-full px-3.5 py-2.5 text-sm text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 resize-none leading-relaxed"
              />
            ) : (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                {task.description || '작성된 상세 설명이 없습니다.'}
              </p>
            )}
          </div>

          {/* Subtasks Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[13px] font-semibold text-slate-700">
                세부 단계 ({task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length})
              </h3>
              <span className="text-xs font-semibold font-mono-tabular text-slate-900">
                {task.progress}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3.5">
              <div
                className={`h-full transition-all duration-200 ${
                  task.progress === 100 ? 'bg-emerald-600' : 'bg-blue-700'
                }`}
                style={{ width: `${task.progress}%` }}
              />
            </div>

            {task.subtasks.length === 0 ? (
              <p className="text-[13px] text-slate-400 py-2">
                등록된 세부 단계가 없습니다.
              </p>
            ) : (
              <ul className="space-y-2 mb-3.5">
                {task.subtasks.map((st) => (
                  <li
                    key={st.id}
                    className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200/80 hover:bg-slate-50 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSubtask(task.id, st.id)}
                      className="flex items-center gap-3 flex-1 text-left min-w-0"
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          st.completed
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-300'
                        }`}
                      >
                        {st.completed && <Check className="w-3 h-3" />}
                      </span>
                      <span
                        className={`text-sm truncate ${
                          st.completed
                            ? 'line-through text-slate-400'
                            : 'text-slate-800'
                        }`}
                      >
                        {st.title}
                      </span>
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSubtask(st.id)}
                        aria-label="세부 단계 삭제"
                        className="p-1 text-slate-400 hover:text-red-600 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {isAdmin && (
              <form onSubmit={handleAddSubtask} className="flex gap-2">
                <input
                  type="text"
                  value={newSubtaskText}
                  onChange={(e) => setNewSubtaskText(e.target.value)}
                  placeholder="새 세부 단계 추가 후 Enter..."
                  className="flex-1 px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 text-xs font-semibold border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  추가
                </button>
              </form>
            )}
          </div>

          {/* Slack-style Thread & History */}
          <div className="pt-5 border-t border-slate-200/80">
            <div className="flex items-center gap-2 mb-3.5">
              <MessageSquare className="w-4 h-4 text-slate-500" />
              <h3 className="text-[13px] font-semibold text-slate-700">
                진행 메모 및 히스토리 ({activities.length})
              </h3>
            </div>

            <div className="space-y-3 mb-4">
              {activities.length === 0 ? (
                <p className="text-[13px] text-slate-400 py-2">
                  아직 작성된 메모가 없습니다. 첫 진행 메모를 남겨보세요.
                </p>
              ) : (
                activities.map((act) => {
                  const author = employees.find((e) => e.id === act.authorId);
                  if (act.type === 'comment') {
                    return (
                      <div
                        key={act.id}
                        className="flex items-start gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5"
                      >
                        <Avatar
                          name={act.authorName}
                          src={author?.avatarUrl}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-slate-900">
                              {act.authorName}
                            </span>
                            <span className="text-slate-400 font-mono-tabular">
                              {formatShortDateTime(act.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-800 mt-1.5 whitespace-pre-wrap leading-relaxed">
                            {act.message}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={act.id}
                      className="flex items-baseline justify-between gap-3 text-xs text-slate-500 px-1"
                    >
                      <span className="truncate">
                        <strong className="font-semibold text-slate-700">
                          {act.authorName}
                        </strong>{' '}
                        · {act.message}
                      </span>
                      <span className="font-mono-tabular text-slate-400 shrink-0">
                        {formatShortDateTime(act.createdAt)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Sticky Slack Comment Composer */}
        <form
          onSubmit={handleSendComment}
          className="p-4 border-t border-slate-200/80 bg-slate-50 flex items-end gap-2.5"
        >
          <textarea
            rows={2}
            maxLength={FIELD_LIMITS.ACTIVITY_MSG_MAX}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendComment();
              }
            }}
            placeholder="진행 메모를 입력하세요 (Enter 전송 · Shift+Enter 줄바꿈)"
            className="flex-1 px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 resize-none"
          />
          <button
            type="submit"
            disabled={!commentText.trim()}
            aria-label="메모 전송"
            className="px-4 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-40 transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </aside>
    </div>
  );
}
