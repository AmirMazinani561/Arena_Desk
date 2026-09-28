import React from 'react';
import { 
  LayoutDashboard, 
  CreditCard, 
  BookOpen, 
  BarChart3, 
  Warehouse, 
  Database, 
  ShieldCheck, 
  Calendar, 
  WalletCards, 
  ReceiptText, 
  Flame,
  Scale,
  Users,
  Clock
} from 'lucide-react';
import type { TabType } from './BottomTabBar';
import { getCurrentShamsi } from '../utils/dateUtils';

interface DesktopSidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  accountsCount: number;
  entriesCount: number;
  warehousesCount?: number;
  draftEntriesCount?: number;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  onTabChange,
  accountsCount,
  entriesCount,
  warehousesCount,
  draftEntriesCount,
}) => {
  const shamsi = getCurrentShamsi();

  const menuItems: { id: TabType; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    {
      id: 'home',
      label: 'داشبورد مالی',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'pending',
      label: 'لیست انتظار تراکنش‌ها',
      icon: <Clock className="w-5 h-5 text-amber-500" />,
      badge: draftEntriesCount && draftEntriesCount > 0 ? draftEntriesCount : undefined,
    },
    {
      id: 'accounts',
      label: 'سرفصل‌ها و حساب‌ها',
      icon: <CreditCard className="w-5 h-5" />,
      badge: accountsCount,
    },
    {
      id: 'ledger',
      label: 'تراکنش‌ها',
      icon: <BookOpen className="w-5 h-5" />,
      badge: entriesCount > 0 ? entriesCount : undefined,
    },
    {
      id: 'warehouses',
      label: 'انبار و کالاها',
      icon: <Warehouse className="w-5 h-5" />,
      badge: warehousesCount && warehousesCount > 0 ? warehousesCount : undefined,
    },
    {
      id: 'production',
      label: 'تولید',
      icon: <Flame className="w-5 h-5 text-amber-500" />,
    },
    {
      id: 'cheques',
      label: 'چک و دسته‌چک',
      icon: <CreditCard className="w-5 h-5" />,
    },
    {
      id: 'invoices',
      label: 'فاکتور خرید و فروش',
      icon: <ReceiptText className="w-5 h-5" />,
    },
    {
      id: 'equity',
      label: 'سرمایه‌گذاران و شمش',
      icon: <Scale className="w-5 h-5 text-amber-400" />,
    },
    {
      id: 'payroll',
      label: 'حقوق و دستمزد',
      icon: <Users className="w-5 h-5 text-indigo-400" />,
    },
    {
      id: 'reports',
      label: 'گزارش‌ها و ترازنامه',
      icon: <BarChart3 className="w-5 h-5" />,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col h-screen select-none border-l border-slate-800 shadow-xl z-20 shrink-0">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
          <WalletCards className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-base font-extrabold text-white tracking-wide">Arena Desk</h1>
          <p className="text-[11px] text-sky-400 font-medium">حسابداری شخصی و دوبل</p>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          بخش‌های اصلی نرم‌افزار
        </div>
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                    isActive 
                      ? 'bg-white/20 text-white' 
                      : item.id === 'pending'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer System Info */}
      <div className="p-4 border-t border-slate-800/80 space-y-2 bg-slate-950/40 text-[11px]">
        <div className="flex items-center justify-between text-slate-400">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            <span>سال مالی جاری:</span>
          </span>
          <span className="font-mono font-bold text-slate-300">{shamsi.jy}</span>
        </div>

        <div className="flex items-center justify-between text-slate-400">
          <span className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>پایگاه‌داده:</span>
          </span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SQLite محلی</span>
          </span>
        </div>
      </div>
    </aside>
  );
};