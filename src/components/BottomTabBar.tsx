import React from 'react';
import { Home, CreditCard, BookOpen, BarChart3, Plus } from 'lucide-react';

export type TabType = 'home' | 'pending' | 'accounts' | 'ledger' | 'reports' | 'warehouses' | 'cheques' | 'invoices'| 'production' | 'equity' | 'payroll';

interface BottomTabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onNewTransaction: () => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onTabChange,
  onNewTransaction,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-xl border-t border-sky-100 shadow-lg px-4 py-2 flex items-center justify-around max-w-lg md:max-w-2xl mx-auto rounded-t-3xl">
      <button
        onClick={() => onTabChange('home')}
        className={`flex flex-col items-center gap-1 py-1 px-3 transition-colors ${
          activeTab === 'home' ? 'text-sky-600 font-bold' : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[11px]">داشبورد</span>
      </button>

      <button
        onClick={() => onTabChange('accounts')}
        className={`flex flex-col items-center gap-1 py-1 px-3 transition-colors ${
          activeTab === 'accounts' ? 'text-sky-600 font-bold' : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <CreditCard className="w-5 h-5" />
        <span className="text-[11px]">حساب‌ها</span>
      </button>

      {/* دکمه ثبت تراکنش جدید */}
      <button
        onClick={onNewTransaction}
        className="-mt-5 w-12 h-12 rounded-full bg-gradient-to-tr from-sky-600 to-sky-400 text-white flex items-center justify-center shadow-lg shadow-sky-500/30 hover:scale-105 active:scale-95 transition-all"
        title="ثبت تراکنش جدید"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      <button
        onClick={() => onTabChange('ledger')}
        className={`flex flex-col items-center gap-1 py-1 px-3 transition-colors ${
          activeTab === 'ledger' ? 'text-sky-600 font-bold' : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <BookOpen className="w-5 h-5" />
        <span className="text-[11px]">دفتر اسناد</span>
      </button>

      <button
        onClick={() => onTabChange('reports')}
        className={`flex flex-col items-center gap-1 py-1 px-3 transition-colors ${
          activeTab === 'reports' ? 'text-sky-600 font-bold' : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <BarChart3 className="w-5 h-5" />
        <span className="text-[11px]">گزارش‌ها</span>
      </button>
    </nav>
  );
};
