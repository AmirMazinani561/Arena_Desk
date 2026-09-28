import React, { useState, useEffect } from 'react';
import { X, Save, BookOpen, AlertCircle } from 'lucide-react';
import type { Checkbook, Account } from '../db/types';
import { createCheckbook, updateCheckbook } from '../db/sqlite';
import { getCurrentShamsi, toPersianDigits, toEnglishDigits } from '../utils/dateUtils';
import { ShamsiDateInput } from './ShamsiDateInput';

interface CheckbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  checkbookToEdit?: Checkbook | null;
  bankAccounts: Account[];
}

export const CheckbookModal: React.FC<CheckbookModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  checkbookToEdit,
  bankAccounts,
}) => {
  const [bankId, setBankId] = useState('');
  const [serial, setSerial] = useState('');
  const [receiveDateShamsi, setReceiveDateShamsi] = useState('');
  const [fromNumber, setFromNumber] = useState<number | ''>('');
  const [toNumber, setToNumber] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const leafCount = (typeof fromNumber === 'number' && typeof toNumber === 'number' && toNumber >= fromNumber)
    ? toNumber - fromNumber + 1
    : 0;

  useEffect(() => {
    if (!isOpen) return;

    if (checkbookToEdit) {
      setBankId(checkbookToEdit.bank_id);
      setSerial(checkbookToEdit.serial);
      setReceiveDateShamsi(checkbookToEdit.receive_date_shamsi);
      setFromNumber(checkbookToEdit.from_number);
      setToNumber(checkbookToEdit.to_number);
      setDescription(checkbookToEdit.description || '');
    } else {
      setBankId(bankAccounts[0]?.id || '');
      setSerial('');
      setReceiveDateShamsi(getCurrentShamsi().formatted);
      setFromNumber(1001);
      setToNumber(1025);
      setDescription('');
    }
    setErrorMsg('');
  }, [isOpen, checkbookToEdit, bankAccounts]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!bankId) {
      setErrorMsg('لطفاً حساب بانکی مربوطه را انتخاب کنید.');
      return;
    }
    if (!serial.trim()) {
      setErrorMsg('لطفاً سریال دسته‌چک را وارد فرمایید.');
      return;
    }
    if (!fromNumber || !toNumber || toNumber < fromNumber) {
      setErrorMsg('شماره برگه پایان باید بزرگتر یا مساوی شماره برگه آغاز باشد.');
      return;
    }

    const selectedBank = bankAccounts.find((b) => b.id === bankId);
    const bankName = selectedBank?.name || 'بانک';

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      if (checkbookToEdit) {
        await updateCheckbook(checkbookToEdit.id, {
          bank_id: bankId,
          bank_name: bankName,
          serial: toEnglishDigits(serial.trim()),
          receive_date_shamsi: receiveDateShamsi,
          from_number: Number(fromNumber),
          to_number: Number(toNumber),
          leaf_count: leafCount,
          description: description.trim(),
        });
      } else {
        await createCheckbook({
          bank_id: bankId,
          bank_name: bankName,
          serial: toEnglishDigits(serial.trim()),
          receive_date_shamsi: receiveDateShamsi,
          from_number: Number(fromNumber),
          to_number: Number(toNumber),
          leaf_count: leafCount,
          description: description.trim(),
          is_active: 1,
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ثبت اطلاعات دسته‌چک');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        
        {/* هدر هماهنگ با فاکتور */}
        <div className="bg-gradient-to-r from-sky-700 to-sky-800 text-white px-6 py-4 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <BookOpen className="text-sky-200" size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base">
                {checkbookToEdit ? 'ویرایش مشخصات دسته‌چک' : 'تعریف دسته‌چک جدید'}
              </h3>
              <p className="text-[11px] text-white/70">مدیریت برگه‌ها و ثبت سریال صیادی</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* فرم */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-slate-800 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              حساب بانکی صادرکننده دسته‌چک <span className="text-rose-500">*</span>
            </label>
            <select
              value={bankId}
              onChange={(e) => setBankId(e.target.value)}
              className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {bankAccounts.length === 0 ? (
                <option value="">هیچ حساب بانکی تعریف نشده است</option>
              ) : (
                bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.account_number ? `(حساب: ${toPersianDigits(b.account_number)})` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                سریال دسته‌چک <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={toPersianDigits(serial)}
                onChange={(e) => setSerial(toEnglishDigits(e.target.value))}
                placeholder="مثال: ۱۶ رقمی صیاد یا شماره سریال"
                className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-center"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تاریخ دریافت دسته‌چک <span className="text-rose-500">*</span>
              </label>
              <ShamsiDateInput
                value={receiveDateShamsi}
                onChange={setReceiveDateShamsi}
              />
            </div>
          </div>

          {/* بازه برگه‌ها */}
          <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2">
            <span className="text-xs font-bold text-slate-700 block">بازه شماره برگه‌های چک</span>
            <div className="grid grid-cols-3 gap-3 items-center">
              <div>
                <label className="block text-[10.5px] font-semibold text-slate-500 mb-1">از شماره</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={fromNumber !== '' ? toPersianDigits(fromNumber) : ''}
                  onChange={(e) => {
                    const clean = toEnglishDigits(e.target.value).replace(/\D/g, '');
                    setFromNumber(clean ? Number(clean) : '');
                  }}
                  className="w-full h-9 bg-white border border-slate-300 rounded-xl px-2 text-center font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-semibold text-slate-500 mb-1">تا شماره</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={toNumber !== '' ? toPersianDigits(toNumber) : ''}
                  onChange={(e) => {
                    const clean = toEnglishDigits(e.target.value).replace(/\D/g, '');
                    setToNumber(clean ? Number(clean) : '');
                  }}
                  className="w-full h-9 bg-white border border-slate-300 rounded-xl px-2 text-center font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-semibold text-slate-500 mb-1">تعداد برگه</label>
                <div className="w-full h-9 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-center font-mono font-bold text-sky-800 text-xs">
                  {toPersianDigits(String(leafCount))} برگه
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">توضیحات دسته‌چک</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیحات اختیاری..."
              className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* دکمه‌ها */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Save size={15} />
              <span>ذخیره دسته‌چک</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};