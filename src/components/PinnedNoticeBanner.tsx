import React, { useState } from 'react';
import { Check, Megaphone, Pencil, X } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { FIELD_LIMITS } from '../types/erp';

export function PinnedNoticeBanner() {
  const { workspaceSetting, currentEmployee, updatePinnedNotice } = useErp();
  const isAdmin = currentEmployee?.role === 'admin';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const noticeText = workspaceSetting?.noticeText || '';

  if (!noticeText && !isAdmin) return null;

  const startEdit = () => {
    setDraft(noticeText);
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updatePinnedNotice(draft);
    setEditing(false);
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Megaphone className="w-4 h-4 text-blue-700 shrink-0" />
        {editing ? (
          <form onSubmit={handleSave} className="flex items-center gap-2 flex-1">
            <input
              type="text"
              autoFocus
              maxLength={FIELD_LIMITS.NOTICE_MAX}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="전 직원에게 고정 표시할 한 줄 공지를 입력하세요 (비우면 숨김)"
              className="flex-1 px-3 py-1.5 text-sm border border-blue-600 rounded-xl focus:outline-none"
            />
            <button
              type="submit"
              aria-label="공지 저장"
              className="p-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              aria-label="공지 편집 취소"
              className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0 text-sm">
            <span className="font-semibold text-slate-900 shrink-0">팀 공지</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span
              className={`truncate ${
                noticeText ? 'text-slate-700' : 'text-slate-400'
              }`}
            >
              {noticeText ||
                '등록된 공지가 없습니다. 우측 버튼으로 공지를 작성할 수 있습니다.'}
            </span>
            {noticeText && workspaceSetting?.updatedBy && (
              <span className="hidden md:inline text-xs text-slate-400 shrink-0">
                — {workspaceSetting.updatedBy}
              </span>
            )}
          </div>
        )}
      </div>

      {isAdmin && !editing && (
        <button
          type="button"
          onClick={startEdit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 whitespace-nowrap shrink-0 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>공지 수정</span>
        </button>
      )}
    </div>
  );
}
