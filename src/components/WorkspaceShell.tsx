import { useState } from 'react';
import {
  CalendarCheck2,
  Clock,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Plus,
  Users,
  X,
} from 'lucide-react';
import { ActiveViewTab, useErp } from '../context/ErpContext';
import { AttendanceAdminView } from './AttendanceAdminView';
import { Avatar } from './Avatar';
import { EmployeesAdminView } from './EmployeesAdminView';
import { NotificationCenter } from './NotificationCenter';
import { PmDashboardView } from './PmDashboardView';
import { QuickTaskModal } from './QuickTaskModal';
import { TaskSidePeek } from './TaskSidePeek';
import { ToastStack } from './ToastStack';
import { TodayFocusView } from './TodayFocusView';

const TAB_TITLES: Record<ActiveViewTab, string> = {
  pm_dashboard: 'PM 관리자 대시보드',
  today: '오늘의 할 일',
  all_tasks: '전체 업무 목록',
  attendance: '출퇴근 기록',
  employees: '직원 계정 관리',
};

export function WorkspaceShell() {
  const {
    currentEmployee,
    activeTab,
    setActiveTab,
    checkoutAndLogout,
  } = useErp();

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newTaskModalOpen, setNewTaskModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  if (!currentEmployee) return null;

  const isAdmin = currentEmployee.role === 'admin';

  const navItems: Array<{
    id: ActiveViewTab;
    label: string;
    icon: typeof LayoutDashboard;
  }> = isAdmin
    ? [
        { id: 'pm_dashboard', label: 'PM 대시보드', icon: LayoutDashboard },
        { id: 'today', label: '오늘의 할 일', icon: CalendarCheck2 },
        { id: 'all_tasks', label: '전체 업무', icon: ListTodo },
        { id: 'attendance', label: '출퇴근 기록', icon: Clock },
        { id: 'employees', label: '직원 계정 관리', icon: Users },
      ]
    : [
        { id: 'today', label: '오늘의 할 일', icon: CalendarCheck2 },
        { id: 'all_tasks', label: '내 전체 업무', icon: ListTodo },
      ];

  const handleCheckout = async () => {
    setLoggingOut(true);
    try {
      await checkoutAndLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/90 w-64">
      <div className="px-6 py-5 border-b border-slate-200/80 flex items-center justify-between">
        <span className="text-[17px] font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          TeamPulse ERP
        </span>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="메뉴 닫기"
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 px-3.5 py-5 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[14px] font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Current Logged-in Employee & Auto-Logout Check-out */}
      <div className="p-4 border-t border-slate-200/80 space-y-3 bg-slate-50/50">
        <div className="flex items-center gap-3 px-1">
          <Avatar
            name={currentEmployee.name}
            src={currentEmployee.avatarUrl}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-slate-900 truncate">
              {currentEmployee.name}
            </div>
            <div className="text-xs text-slate-500 truncate mt-0.5">
              {currentEmployee.department} · {isAdmin ? 'PM 관리자' : '근무중'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCheckout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold text-red-700 bg-white border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{loggingOut ? '퇴근 처리 중...' : '퇴근하기 (자동 로그아웃)'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div className="relative z-50 h-full">{sidebarContent}</div>
          <div
            className="flex-1 bg-slate-900/30"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb Left — Actions Right */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/90 px-6 lg:px-8 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="메뉴 열기"
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5 text-[15px] min-w-0">
              <span className="text-slate-400 font-medium hidden sm:inline whitespace-nowrap">
                TeamPulse
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-bold text-slate-900 truncate">
                {TAB_TITLES[activeTab]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <NotificationCenter onOpenTask={(id) => setSelectedTaskId(id)} />
            {isAdmin && (
              <button
                type="button"
                onClick={() => setNewTaskModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>새 업무 등록</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeTab === 'pm_dashboard' && isAdmin && (
            <PmDashboardView
              onOpenTask={(id) => setSelectedTaskId(id)}
              onOpenNewTask={() => setNewTaskModalOpen(true)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          )}

          {(activeTab === 'today' || (activeTab === 'pm_dashboard' && !isAdmin)) && (
            <TodayFocusView
              mode="today"
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onOpenTask={(id) => setSelectedTaskId(id)}
            />
          )}

          {activeTab === 'all_tasks' && (
            <TodayFocusView
              mode="all_tasks"
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onOpenTask={(id) => setSelectedTaskId(id)}
            />
          )}

          {activeTab === 'attendance' && <AttendanceAdminView />}
          {activeTab === 'employees' && <EmployeesAdminView />}
        </main>
      </div>

      {/* Side Peek Drawer, Quick Task Modal & Toast Stack */}
      <TaskSidePeek
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onSelectTask={(id) => setSelectedTaskId(id)}
      />

      <QuickTaskModal
        open={newTaskModalOpen}
        onClose={() => setNewTaskModalOpen(false)}
        onCreated={(id) => setSelectedTaskId(id)}
      />

      <ToastStack onOpenTask={(id) => setSelectedTaskId(id)} />
    </div>
  );
}
