import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle, 
  Share2, 
  AlertTriangle, 
  CornerUpLeft, 
  Building2, 
  User
} from 'lucide-react';
import type { Cheque, Account } from '../db/types';
import { 
  clearReceivedCheque, 
  assignReceivedCheque, 
  bounceReceivedCheque, 
  returnReceivedCheque,
  clearIssuedCheque 
} from '../db/sqlite';
import { getCurrentShamsi, separateThousands } from '../utils/dateUtils';
import { ShamsiDateInput } from './ShamsiDateInput';

export type ChequeOperationType = 'clear_received' | 'assign_received' | 'bounce_received' | 'return_received' | 'clear_issued';

interface ChequeOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cheque: Cheque | null;
  operationType: ChequeOperationType | null;
  bankAccounts: Account[];
  allPersons: Account[];
}

export const ChequeOperationModal: React.FC<ChequeOperationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  cheque,
  operationType,
  bankAccounts,
  allPersons,
}) => {
  const [operationDateShamsi, setOperationDateShamsi] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen || !cheque) return;
    setOperationDateShamsi(getCurrentShamsi().formatted);
    setSelectedBankId(bankAccounts[0]?.id || '');
    setSelectedPersonId(allPersons[0]?.id || '');
    setReason('');
    setErrorMsg('');
  }, [isOpen, cheque, bankAccounts, allPersons, operationType]);

  if (!isOpen || !cheque || !operationType) return null;

  const getTitleAndColor = () => {
    switch (operationType) {
      case 'clear_received':
        return {
          title: 'وصول چک دریافتی و واریز به حساب بانکی',
          icon: <CheckCircle className="text-emerald-400" size={20} />,
          badgeClass: 'bg-emerald-600',
          btnText: 'تأیید وصول و واریز به بانک',
        };
      case 'assign_received':
        return {
          title: 'واگذاری و خرج کردن چک (انتقال به شخص دیگر)',
          icon: <Share2 className="text-blue-400" size={20} />,
          badgeClass: 'bg-blue-600',
          btnText: 'تأیید واگذاری چک به شخص',
        };
      case 'bounce_received':
        return {
          title: 'برگشت زدن چک دریافتی (عدم وصول)',
          icon: <AlertTriangle className="text-amber-400" size={20} />,
          badgeClass: 'bg-amber-600',
          btnText: 'ثبت برگشت چک',
        };
      case 'return_received':
        return {
          title: 'عودت چک به صاحب چک (مشتری)',
          icon: <CornerUpLeft className="text-purple-400" size={20} />,
          badgeClass: 'bg-purple-600',
          btnText: 'ثبت عودت چک',
        };
      case 'clear_issued':
        return {
          title: 'پاس شدن و کسر از حساب چک صادره',
          icon: <CheckCircle className="text-emerald-400" size={20} />,
          badgeClass: 'bg-emerald-600',
          btnText: 'ثبت پاس شدن چک بانکی',
        };
    }
  };

  const info = getTitleAndColor();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operationDateShamsi.trim()) {
      setErrorMsg('لطفاً تاریخ عملیات را مشخص فرمایید.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      if (operationType === 'clear_received') {
        if (!selectedBankId) {
          setErrorMsg('لطفاً حساب بانکی مقصد واریز را انتخاب کنید.');
          return;
        }
        await clearReceivedCheque(cheque.id, selectedBankId, operationDateShamsi.trim());
      } else if (operationType === 'assign_received') {
        if (!selectedPersonId) {
          setErrorMsg('لطفاً شخص تحویل‌گیرنده چک را انتخاب کنید.');
          return;
        }
        await assignReceivedCheque(cheque.id, selectedPersonId, operationDateShamsi.trim());
      } else if (operationType === 'bounce_received') {
        await bounceReceivedCheque(cheque.id, operationDateShamsi.trim(), reason.trim() || 'کسر موجودی');
      } else if (operationType === 'return_received') {
        await returnReceivedCheque(cheque.id, operationDateShamsi.trim(), reason.trim() || 'عودت داده شد');
      } else if (operationType === 'clear_issued') {
        if (!selectedBankId) {
          setErrorMsg('لطفاً حساب بانکی صادرکننده را انتخاب کنید.');
          return;
        }
        await clearIssuedCheque(cheque.id, selectedBankId, operationDateShamsi.trim());
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ثبت عملیات چک');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-fade-in" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        
        {/* هدر */}
        <div className={`text-white px-5 py-3.5 flex items-center justify-between border-b ${info.badgeClass}`}>
          <div className="flex items-center gap-2">
            {info.icon}
            <h3 className="font-bold text-sm sm:text-base">{info.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 hover:bg-black/10 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* اطلاعات خلاصه چک */}
        <div className="bg-slate-50 p-4 border-b border-slate-200 text-xs text-slate-700 grid grid-cols-2 gap-2">
          <div>
            <span className="text-slate-400">شماره چک: </span>
            <span className="font-mono font-bold text-slate-900">{cheque.check_number}</span>
          </div>
          <div>
            <span className="text-slate-400">بانک: </span>
            <span className="font-bold text-slate-900">{cheque.bank_name}</span>
          </div>
          <div>
            <span className="text-slate-400">مبلغ چک: </span>
            <span className="font-bold text-emerald-700 text-sm">{separateThousands(String(cheque.amount))} ریال</span>
          </div>
          <div>
            <span className="text-slate-400">تاریخ سررسید: </span>
            <span className="font-mono font-bold text-slate-900">{cheque.due_date_shamsi}</span>
          </div>
        </div>

        {/* فرم ثبت عملیات */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-slate-800 text-sm">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
              {errorMsg}
            </div>
          )}

          {/* تاریخ عملیات */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              تاریخ عملیات مالی <span className="text-rose-500">*</span>
            </label>
            <ShamsiDateInput
              value={operationDateShamsi}
              onChange={setOperationDateShamsi}
            />
          </div>

          {/* فیلد اختصاصی: حساب بانکی مقصد وصول */}
          {(operationType === 'clear_received' || operationType === 'clear_issued') && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building2 size={15} className="text-sky-600" />
                <span>حساب بانکی {operationType === 'clear_received' ? 'مقصد واریز وجه' : 'جهت کسر وجه'}</span>
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.account_number ? `(حساب: ${b.account_number})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* فیلد اختصاصی: شخص تحویل‌گیرنده در واگذاری */}
          {operationType === 'assign_received' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <User size={15} className="text-blue-600" />
                <span>شخص یا بستانکار تحویل‌گیرنده چک (خرج کردن به نام)</span>
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {allPersons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.code ? `(کد: ${p.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* فیلد اختصاصی: شرح یا دلیل برگشت / عودت */}
          {(operationType === 'bounce_received' || operationType === 'return_received') && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                علت {operationType === 'bounce_received' ? 'برگشت چک' : 'عودت به مشتری'}
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  operationType === 'bounce_received'
                    ? 'مثال: کسر موجودی، نقص امضا، خط‌خوردگی...'
                    : 'مثال: تسویه نقدی، فسخ معامله، تعویض چک...'
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          )}

          {/* دکمه‌ها */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-[#0b5f77] hover:bg-[#094c5f] text-white px-5 py-2 rounded-xl text-xs font-bold shadow hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <span>{info.btnText}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
