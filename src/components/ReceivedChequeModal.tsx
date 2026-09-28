import React, { useState, useEffect } from 'react';
import { X, Save, FileText, AlertCircle } from 'lucide-react';
import type { Cheque, Account } from '../db/types';
import { createCheque, updateCheque, getNextChequeRowNumber } from '../db/sqlite';
import { getCurrentShamsi, toPersianDigits, toEnglishDigits, separateThousands, parseAmount } from '../utils/dateUtils';
import { ShamsiDateInput } from './ShamsiDateInput';
import { SearchablePersonSelect } from './SearchablePersonSelect';
import { AmountInput } from './AmountInput';

interface ReceivedChequeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  chequeToEdit?: Cheque | null;
  allPersons: Account[];
}

const COMMON_BANKS = [
  'بانک ملی ایران',
  'بانک ملت',
  'بانک صادرات ایران',
  'بانک تجارت',
  'بانک سپه',
  'بانک کشاورزی',
  'بانک مسکن',
  'بانک رفاه کارگران',
  'بانک سامان',
  'بانک پارسیان',
  'بانک پاسارگاد',
  'بانک آینده',
  'بانک اقتصاد نوین',
  'بانک شهر',
  'بانک سینا',
  'بانک دی',
  'بانک کارآفرین',
  'بانک رسالت',
  'بانک مهر ایران',
];

export const ReceivedChequeModal: React.FC<ReceivedChequeModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  chequeToEdit,
  allPersons,
}) => {
  const [checkNumber, setCheckNumber] = useState('');
  const [sayadId, setSayadId] = useState('');
  const [amountFormatted, setAmountFormatted] = useState('0');
  const [issueDateShamsi, setIssueDateShamsi] = useState('');
  const [dueDateShamsi, setDueDateShamsi] = useState('');
  const [bankName, setBankName] = useState('بانک ملی ایران');
  const [branch, setBranch] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [sheba, setSheba] = useState('');
  const [personId, setPersonId] = useState('');
  const [personName, setPersonName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (chequeToEdit) {
      setCheckNumber(chequeToEdit.check_number || '');
      setSayadId(chequeToEdit.sayad_id || '');
      setAmountFormatted(separateThousands(String(chequeToEdit.amount || 0)));
      setIssueDateShamsi(chequeToEdit.issue_date_shamsi || getCurrentShamsi().formatted);
      setDueDateShamsi(chequeToEdit.due_date_shamsi || getCurrentShamsi().formatted);
      setBankName(chequeToEdit.bank_name || 'بانک ملی ایران');
      setBranch(chequeToEdit.branch || '');
      setAccountNumber(chequeToEdit.account_number || '');
      setSheba(chequeToEdit.sheba || '');
      setPersonId(chequeToEdit.person_id || '');
      setPersonName(chequeToEdit.person_name || '');
      setDescription(chequeToEdit.description || '');
    } else {
      setCheckNumber('');
      setSayadId('');
      setAmountFormatted('0');
      setIssueDateShamsi(getCurrentShamsi().formatted);
      setDueDateShamsi(getCurrentShamsi().formatted);
      setBankName('بانک ملی ایران');
      setBranch('');
      setAccountNumber('');
      setSheba('');
      if (allPersons.length > 0) {
        setPersonId(allPersons[0].id);
        setPersonName(allPersons[0].name);
      } else {
        setPersonId('');
        setPersonName('');
      }
      setDescription('');
    }
    setErrorMsg('');
  }, [isOpen, chequeToEdit, allPersons]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!personId) {
      setErrorMsg('لطفاً طرف حساب (پرداخت‌کننده چک) را انتخاب فرمایید.');
      return;
    }
    const cleanCheckNum = toEnglishDigits(checkNumber.trim());
    if (!cleanCheckNum) {
      setErrorMsg('لطفاً شماره چک را وارد کنید.');
      return;
    }
    const numAmount = parseAmount(amountFormatted);
    if (numAmount <= 0) {
      setErrorMsg('مبلغ چک باید بزرگتر از صفر باشد.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      if (chequeToEdit) {
        await updateCheque(chequeToEdit.id, {
          check_number: cleanCheckNum,
          sayad_id: toEnglishDigits(sayadId.trim()) || undefined,
          amount: numAmount,
          issue_date_shamsi: issueDateShamsi || getCurrentShamsi().formatted,
          due_date_shamsi: dueDateShamsi,
          bank_name: bankName.trim(),
          branch: branch.trim() || undefined,
          account_number: toEnglishDigits(accountNumber.trim()) || undefined,
          sheba: toEnglishDigits(sheba.trim().toUpperCase()) || undefined,
          person_id: personId,
          person_name: personName,
          description: description.trim() || undefined,
        });
      } else {
        const nextRow = await getNextChequeRowNumber('received');
        await createCheque({
          type: 'received',
          check_number: cleanCheckNum,
          sayad_id: toEnglishDigits(sayadId.trim()) || '',
          amount: numAmount,
          issue_date_shamsi: issueDateShamsi || getCurrentShamsi().formatted,
          due_date_shamsi: dueDateShamsi,
          bank_name: bankName.trim(),
          branch: branch.trim() || undefined,
          account_number: toEnglishDigits(accountNumber.trim()) || undefined,
          sheba: toEnglishDigits(sheba.trim().toUpperCase()) || undefined,
          row_number: nextRow,
          location: 'نزد صندوق',
          status: 'in_safe',
          status_description: 'موجود نزد صندوق',
          person_id: personId,
          person_name: personName,
          description: description.trim() || undefined,
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ثبت اطلاعات چک');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col">
        
        {/* سربرگ */}
        <div className="bg-gradient-to-r from-sky-700 to-sky-800 text-white px-6 py-4 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <FileText className="text-sky-200" size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base">
                {chequeToEdit ? 'ویرایش مشخصات چک دریافتی' : 'ثبت چک دریافتی جدید (نزد صندوق)'}
              </h3>
              <p className="text-[11px] text-white/70">دریافت اسناد صیادی از مشتریان و طرف‌های حساب</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-slate-800 text-xs overflow-y-auto max-h-[82vh]">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <SearchablePersonSelect
              label="طرف حساب (پرداخت‌کننده چک)"
              required
              persons={allPersons}
              selectedPersonId={personId}
              onSelect={(p) => {
                setPersonId(p.id);
                setPersonName(p.name);
              }}
              placeholder="جستجو و انتخاب طرف‌حساب..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                شماره چک <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={toPersianDigits(checkNumber)}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="مثال: ۱۲۳۴۵۶"
                className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-center"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                مبلغ چک (ریال) <span className="text-rose-500">*</span>
              </label>
              <AmountInput
                value={amountFormatted}
                onChange={(formatted) => setAmountFormatted(formatted)}
                center
              />
            </div>
          </div>

          {/* فیلد تاریخ دریافت به همراه تاریخ سررسید */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تاریخ دریافت چک <span className="text-rose-500">*</span>
              </label>
              <ShamsiDateInput
                value={issueDateShamsi}
                onChange={setIssueDateShamsi}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تاریخ سررسید چک <span className="text-rose-500">*</span>
              </label>
              <ShamsiDateInput
                value={dueDateShamsi}
                onChange={setDueDateShamsi}
              />
            </div>
          </div>

          {/* انتخاب بانک صادرکننده با قابلیت تایپ و سرچ سریع از لیست */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                نام بانک صادرکننده <span className="text-rose-500">*</span>
              </label>
              <input
                list="received-bank-list"
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="تایپ یا انتخاب نام بانک..."
                className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <datalist id="received-bank-list">
                {COMMON_BANKS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">نام شعبه</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="مثال: مرکزی، آزادی..."
                className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">شناسه صیادی (۱۶ رقم)</label>
            <input
              type="text"
              maxLength={16}
              value={toPersianDigits(sayadId)}
              onChange={(e) => setSayadId(toEnglishDigits(e.target.value))}
              placeholder="شناسه ۱۶ رقمی صیاد"
              className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-center tracking-widest"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">شماره حساب صاحب چک</label>
              <input
                type="text"
                value={toPersianDigits(accountNumber)}
                onChange={(e) => setAccountNumber(toEnglishDigits(e.target.value))}
                placeholder="شماره حساب..."
                className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-center"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">شماره شبا (IBAN)</label>
              <input
                type="text"
                maxLength={26}
                value={sheba}
                onChange={(e) => setSheba(e.target.value.toUpperCase())}
                placeholder="IR000000000000000000000000"
                className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-center uppercase tracking-wider"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">شرح / بابت</label>
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
              <span>{isSubmitting ? 'در حال ثبت...' : 'ذخیره چک'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};