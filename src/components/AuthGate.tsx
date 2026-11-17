import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  User as UserIcon,
} from 'lucide-react';
import { useErp } from '../context/ErpContext';

export function AuthGate() {
  const {
    authError,
    retryAnonymousAuth,
    dataLoading,
    seeding,
    loginEmployee,
  } = useErp();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await loginEmployee(username, password);
      if (!res.ok) {
        setError(res.error || '로그인에 실패했습니다.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (authError) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-7 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="flex items-center gap-3 text-red-700 mb-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h2 className="text-base font-semibold text-slate-900">
              데이터베이스 연결 확인 필요
            </h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed mb-5 break-words">
            {authError}
          </p>
          <button
            type="button"
            onClick={retryAnonymousAuth}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>다시 연결 시도</span>
          </button>
        </div>
      </div>
    );
  }

  if (dataLoading || seeding) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-7 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-800">
            {seeding
              ? '초기 사내 워크스페이스를 준비하고 있습니다...'
              : '사내 업무 데이터를 불러오는 중입니다...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-8 sm:p-9 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              TeamPulse ERP
            </h1>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
              발급받은 사내 계정으로 로그인하면 출근이 자동 기록됩니다.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="emp-username"
                className="block text-[13px] font-semibold text-slate-700 mb-2"
              >
                직원 아이디
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="emp-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="아이디 입력"
                  className="w-full pl-10 pr-3.5 py-2.5 text-[15px] bg-slate-50/70 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="emp-password"
                className="block text-[13px] font-semibold text-slate-700 mb-2"
              >
                비밀번호
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="emp-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  className="w-full pl-10 pr-11 py-2.5 text-[15px] bg-slate-50/70 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="px-3.5 py-3 rounded-xl bg-red-50 border border-red-200 text-[13px] font-medium text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-60 transition-colors"
            >
              <span>{submitting ? '출근 기록 중...' : '로그인 및 자동 출근'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
