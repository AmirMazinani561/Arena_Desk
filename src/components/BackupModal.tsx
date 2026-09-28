import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Upload, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle,
  Database
} from 'lucide-react';
import { exportDatabaseBackup, importDatabaseBackup } from '../db/sqlite';
import { getCurrentShamsi, toPersianDigits } from '../utils/dateUtils';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  // ۱. عملیات پشتیبان‌گیری و دانلود فایل
  const handleBackup = async () => {
    try {
      setIsProcessing(true);
      setMessage(null);

      const backupBytes = await exportDatabaseBackup();
      const blob = new Blob([backupBytes as any], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      
      const todayShamsi = getCurrentShamsi().formatted.replace(/\//g, '_');
      const filename = `Hesab_Backup_${todayShamsi}.db`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({
        text: `فایل پشتیبان با موفقیت دانلود شد: ${filename}`,
        type: 'success',
      });
    } catch (err: any) {
      setMessage({
        text: err.message || 'خطا در تهیه نسخه پشتیبان',
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // ۲. عملیات انتخاب فایل و بازیابی اطلاعات
  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('هشدار مهم: با بازیابی اطلاعات، داده‌های فعلی با اطلاعات فایل پشتیبان جایگزین خواهند شد. آیا ادامه می‌دهید؟')) {
      e.target.value = '';
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        const report = await importDatabaseBackup(buffer);
        setMessage({
          text: `بازیابی اطلاعات با موفقیت کامل انجام شد: ${toPersianDigits(report.tablesRestored)} جدول و ${toPersianDigits(report.totalRecordsRestored)} رکورد بدون نقص بازنشانی شدند. در حال بارگذاری مجدد...`,
          type: 'success',
        });
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch (err: any) {
        setMessage({
          text: err.message || 'فایل پشتیبان نامعتبر است یا در خواندن آن خطایی رخ داد.',
          type: 'error',
        });
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in" dir="rtl">
      <div className="bg-white text-slate-800 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        
        {/* نوار سربرگ هماهنگ با فاکتور */}
        <div className="bg-gradient-to-r from-sky-700 to-sky-800 px-6 py-4 flex items-center justify-between text-white border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Database className="text-sky-200" size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold">پشتیبان‌گیری و بازیابی داده‌ها</h2>
              <p className="text-[11px] text-white/75 font-medium">ذخیره نسخه امن و بازگردانی اطلاعات مالی</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* بدنه مودال */}
        <div className="p-6 space-y-4 text-xs">
          
          {message && (
            <div className={`p-3 rounded-2xl flex items-center gap-2 font-bold ${
              message.type === 'success' 
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border border-rose-200 text-rose-700'
            }`}>
              {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              <span>{message.text}</span>
            </div>
          )}

          {/* کارت ۱: دانلود نسخه پشتیبان */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-sky-100 text-sky-800 shrink-0 mt-0.5">
                <ShieldCheck size={18} />
              </div>
              <div className="space-y-1">
                <strong className="text-xs text-slate-900 block">تهیه نسخه پشتیبان (خروجی دیتابیس)</strong>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  یک نسخه کامل از فاکتورها، حساب‌ها، چک‌ها و اسناد دوبل با تاریخ روز ({toPersianDigits(getCurrentShamsi().formatted)}) دانلود می‌شود.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleBackup}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Download size={15} />
              <span>{isProcessing ? 'در حال تهیه فایل...' : 'دانلود و ذخیره فایل پشتیبان (.db)'}</span>
            </button>
          </div>

          {/* کارت ۲: بازیابی اطلاعات */}
          <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-900 shrink-0 mt-0.5">
                <AlertTriangle size={18} />
              </div>
              <div className="space-y-1">
                <strong className="text-xs text-slate-900 block">بازیابی اطلاعات از فایل قبلی (Restore)</strong>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  در صورت تعویض سیستم یا نیاز به بازگردانی، فایل پشتیبان را انتخاب کنید تا برنامه به همان تاریخ بازگردد.
                </p>
              </div>
            </div>

            <label className="w-full flex items-center justify-center gap-2 bg-white border border-amber-300 hover:bg-amber-100/50 text-amber-900 font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer shadow-2xs">
              <Upload size={15} />
              <span>انتخاب و بازگردانی فایل پشتیبان</span>
              <input
                type="file"
                accept=".db,.sqlite,.json"
                onChange={handleRestore}
                disabled={isProcessing}
                className="hidden"
              />
            </label>
          </div>

        </div>

        {/* دکمه خروج */}
        <div className="p-4 border-t border-slate-200 flex justify-end shrink-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            بستن
          </button>
        </div>

      </div>
    </div>
  );
};