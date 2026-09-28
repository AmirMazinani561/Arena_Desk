import React, { useState } from 'react';
import { X, Cloud, RefreshCw, CheckCircle2, AlertCircle, Lock, User, Globe } from 'lucide-react';
import { getSyncConfig, saveSyncConfig, syncWalletTransactions } from '../services/walletSync';
import { saveDraftEntry } from '../db/sqlite';
import type { Account, JournalEntry } from '../db/types';

interface WalletSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  entries: JournalEntry[];
  onRefreshData: () => Promise<void>;
}

export const WalletSyncModal: React.FC<WalletSyncModalProps> = ({
  isOpen,
  onClose,
  accounts,
  entries,
  onRefreshData,
}) => {
  const [config, setConfig] = useState(getSyncConfig);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.username?.trim() || !config.password) {
      setSyncResult({
        success: false,
        message: 'لطفاً نام کاربری و رمز عبور کیف پول خود را وارد نمایید.',
      });
      return;
    }

    saveSyncConfig(config);
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const res = await syncWalletTransactions(
        entries,
        accounts,
        async (entry, items) => {
          await saveDraftEntry(entry, items);
        }
      );

      setSyncResult({ success: res.success, message: res.message });
      if (res.success && (res.newDraftsCount > 0 || res.newAccountsCount > 0 || res.newEquityCount > 0 || res.newPayrollCount > 0)) {
        await onRefreshData();
      }
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: err?.message || 'خطا در ارتباط با سرور کیف پول.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden transition-all animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-sky-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">همگام‌سازی با کیف پول آنلاین</h2>
              <span className="text-[11px] text-slate-500 block">دریافت خودکار تراکنش‌ها در حالت پیش‌نویس</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSync} className="p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-800 leading-relaxed">
            💡 تراکنش‌های جدید پس از دریافت به صورت خودکار در وضعیت <strong>«پیش‌نویس (در انتظار ثبت نهایی)»</strong> ذخیره می‌شوند تا پس از بازبینی شما تراز و قطعی شوند.
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">آدرس سرور کیف پول (URL)</label>
            <div className="relative">
              <input
                type="text"
                dir="ltr"
                value={config.url}
                onChange={(e) => setConfig({ ...config, url: e.target.value })}
                placeholder="https://arena-wallet-pi.vercel.app"
                className="w-full text-xs font-mono pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all text-left"
                required
              />
              <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                نام کاربری کیف پول <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  dir="ltr"
                  value={config.username || ''}
                  onChange={(e) => setConfig({ ...config, username: e.target.value })}
                  placeholder="admin"
                  required
                  className="w-full text-xs font-mono pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all text-left"
                />
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                رمز عبور کیف پول <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  dir="ltr"
                  value={config.password || ''}
                  onChange={(e) => setConfig({ ...config, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  className="w-full text-xs font-mono pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all text-left"
                />
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>
          </div>

          {/* Sync Result Feedback */}
          {syncResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                syncResult.success
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              {syncResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{syncResult.message}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
            >
              بستن
            </button>
            <button
              type="submit"
              disabled={isSyncing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'در حال دریافت اطلاعات...' : 'شروع همگام‌سازی'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
