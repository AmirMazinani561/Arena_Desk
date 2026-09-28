import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Save, 
  FileText, 
  User, 
  BookOpen, 
  AlertCircle 
} from 'lucide-react';
import type { Cheque, Account, Checkbook } from '../db/types';
import { 
  getNextChequeRowNumber, 
  createCheque, 
  updateCheque, 
  getAllCheckbooks, 
  getAvailableCheckbookLeaves 
} from '../db/sqlite';
import { 
  getCurrentShamsi, 
  toPersianDigits, 
  toEnglishDigits, 
  separateThousands, 
  parseAmount 
} from '../utils/dateUtils';
import { ShamsiDateInput } from './ShamsiDateInput';

interface IssuedChequeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  chequeToEdit?: Cheque | null;
  allPersons: Account[];
  initialCheckbookId?: string;
  initialLeafNumber?: number;
}

export const IssuedChequeModal: React.FC<IssuedChequeModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  chequeToEdit,
  allPersons,
  initialCheckbookId,
  initialLeafNumber,
}) => {
  const [checkbooks, setCheckbooks] = useState<Checkbook[]>([]);
  const [selectedCheckbookId, setSelectedCheckbookId] = useState('');
  const [availableLeaves, setAvailableLeaves] = useState<{
    checkbook_id: string;
    leaf_number: number;
    serial: string;
  }[]>([]);

  const [checkNumber, setCheckNumber] = useState('');
  const [sayadId, setSayadId] = useState('');
  const [dueDateShamsi, setDueDateShamsi] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [rowNumber, setRowNumber] = useState(1);
  const [description, setDescription] = useState('');
  const [personId, setPersonId] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [isPersonDropdownOpen, setIsPersonDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const personContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (personContainerRef.current && !personContainerRef.current.contains(event.target as Node)) {
        setIsPersonDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // کلیدهای میانبر: F3 برای ذخیره و Esc برای خروج
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'F3') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // واکشی دسته‌چک‌ها و برگه‌های سفید آزاد
  useEffect(() => {
    if (!isOpen) return;
    Promise.all([getAllCheckbooks(), getAvailableCheckbookLeaves()])
      .then(([cbs, leaves]) => {
        setCheckbooks(cbs);
        setAvailableLeaves(leaves);
      })
      .catch(console.error);
  }, [isOpen]);

  // مقداردهی اولیه فرم در حالت صدور یا ویرایش
  useEffect(() => {
    if (!isOpen) return;

    if (chequeToEdit) {
      setSelectedCheckbookId(chequeToEdit.checkbook_id || '');
      setCheckNumber(chequeToEdit.check_number || '');
      setSayadId(chequeToEdit.sayad_id || '');
      setDueDateShamsi(chequeToEdit.due_date_shamsi || getCurrentShamsi().formatted);
      setAmount(chequeToEdit.amount || 0);
      setRowNumber(chequeToEdit.row_number || 1);
      setDescription(chequeToEdit.description || '');
      setPersonId(chequeToEdit.person_id || '');
      const p = allPersons.find((x) => x.id === chequeToEdit.person_id);
      setPersonSearch(p ? `${p.code ? p.code + ' - ' : ''}${p.name}` : '');
    } else {
      setDueDateShamsi(getCurrentShamsi().formatted);
      setAmount(0);
      setDescription('');
      
      const defaultPerson = allPersons[0];
      if (defaultPerson) {
        setPersonId(defaultPerson.id);
        setPersonSearch(`${defaultPerson.code ? defaultPerson.code + ' - ' : ''}${defaultPerson.name}`);
      } else {
        setPersonId('');
        setPersonSearch('');
      }

      getNextChequeRowNumber('issued').then((num) => setRowNumber(num));

      if (initialCheckbookId) {
        setSelectedCheckbookId(initialCheckbookId);
      }
      if (initialLeafNumber !== undefined) {
        setCheckNumber(String(initialLeafNumber));
      }
    }
    setErrorMsg('');
  }, [isOpen, chequeToEdit, allPersons, initialCheckbookId, initialLeafNumber]);

  // همگام‌سازی سریال صیاد با دسته‌چک انتخاب‌شده
  const handleCheckbookChange = (cbId: string) => {
    setSelectedCheckbookId(cbId);
    const cb = checkbooks.find((c) => c.id === cbId);
    if (cb && cb.serial && !sayadId) {
      setSayadId(cb.serial);
    }
    const firstLeaf = availableLeaves.find((l) => l.checkbook_id === cbId);
    if (firstLeaf && !checkNumber) {
      setCheckNumber(String(firstLeaf.leaf_number));
    }
  };

  const filteredPersons = allPersons.filter((p) => {
    if (!personSearch.trim()) return true;
    const q = personSearch.trim().toLowerCase();
    const nameMatch = p.name.toLowerCase().includes(q);
    const codeMatch = String(p.code || '').includes(q);
    return nameMatch || codeMatch;
  });

  const selectedPerson = allPersons.find((p) => p.id === personId);
  const selectedCheckbook = checkbooks.find((c) => c.id === selectedCheckbookId);

  const handleSubmit = async () => {
    if (!dueDateShamsi.trim()) {
      setErrorMsg('لطفاً تاریخ سررسید چک را وارد فرمایید.');
      return;
    }
    if (!checkNumber.trim()) {
      setErrorMsg('لطفاً شماره برگه چک را وارد فرمایید.');
      return;
    }
    if (amount <= 0) {
      setErrorMsg('لطفاً مبلغ معتبر برای چک وارد فرمایید.');
      return;
    }
    if (!personId) {
      setErrorMsg('لطفاً شخص دریافت‌کننده چک (در وجه) را مشخص کنید.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      const bankName = selectedCheckbook?.bank_name || 'بانک';

      if (chequeToEdit) {
        await updateCheque(chequeToEdit.id, {
          bank_name: bankName,
          checkbook_id: selectedCheckbookId || undefined,
          due_date_shamsi: dueDateShamsi.trim(),
          check_number: toEnglishDigits(checkNumber.trim()),
          sayad_id: toEnglishDigits(sayadId.trim()),
          amount: amount,
          description: description.trim(),
          person_id: personId,
        });
      } else {
        await createCheque({
          type: 'issued',
          check_number: toEnglishDigits(checkNumber.trim()),
          sayad_id: toEnglishDigits(sayadId.trim()),
          amount: amount,
          due_date_shamsi: dueDateShamsi.trim(),
          issue_date_shamsi: getCurrentShamsi().formatted,
          bank_name: bankName,
          checkbook_id: selectedCheckbookId || undefined,
          row_number: rowNumber,
          status: 'issued',
          status_description: 'صادرشده (در جریان وصول)',
          person_id: personId,
          description: description.trim(),
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ثبت و صدور چک');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in" dir="rtl">
      <div className="bg-white text-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* ۱. نوار سربرگ */}
        <div className="bg-gradient-to-r from-sky-700 to-sky-800 px-6 py-4 flex items-center justify-between text-white border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <FileText className="text-sky-200" size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold flex items-center gap-2">
                <span>{chequeToEdit ? 'ویرایش مشخصات چک پرداختی' : 'صدور و ثبت چک پرداختی'}</span>
                <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">
                  ردیف {toPersianDigits(String(rowNumber))}
                </span>
              </h2>
              <p className="text-[11px] text-white/75 font-medium">ثبت در جریان وصول اسناد پرداختنی</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="بستن فرم"
          >
            <X size={18} />
          </button>
        </div>

        {/* ۲. بدنه فرم */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 font-bold flex items-center gap-2 shadow-xs">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* بخش اول: مشخصات دسته‌چک و برگه */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <BookOpen size={14} className="text-sky-600" />
                <span>انتخاب دسته‌چک:</span>
              </label>
              <select
                value={selectedCheckbookId}
                onChange={(e) => handleCheckbookChange(e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
              >
                <option value="">-- انتخاب دسته‌چک فعال --</option>
                {checkbooks.map((cb) => (
                  <option key={cb.id} value={cb.id}>
                    {cb.bank_name} - سریال: {toPersianDigits(cb.serial)} (از {toPersianDigits(String(cb.from_number))} تا {toPersianDigits(String(cb.to_number))})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  شماره برگه چک <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={toPersianDigits(checkNumber)}
                  onChange={(e) => setCheckNumber(toEnglishDigits(e.target.value))}
                  placeholder="مثال: ۱۶۰۵۷۱"
                  className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 font-mono font-bold text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 text-center"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">شناسه صیادی (۱۶ رقم):</label>
                <input
                  type="text"
                  maxLength={16}
                  value={toPersianDigits(sayadId)}
                  onChange={(e) => setSayadId(toEnglishDigits(e.target.value).replace(/\D/g, ''))}
                  placeholder="شناسه ۱۶ رقمی صیادی چک صادره"
                  className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 font-mono font-bold text-xs text-slate-900 tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* بخش دوم: سررسید، مبلغ و بابت */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تاریخ سررسید چک <span className="text-rose-500">*</span>
              </label>
              <ShamsiDateInput
                value={dueDateShamsi}
                onChange={setDueDateShamsi}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                مبلغ چک (ریال) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={amount > 0 ? separateThousands(String(amount)) : ''}
                placeholder="۰"
                onFocus={(e) => e.target.select()}
                onChange={(e) => setAmount(parseAmount(e.target.value))}
                className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 font-mono font-black text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">بابت / توضیحات:</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="بابت خرید کالا، تسویه حساب، دستمزد یا..."
                className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* بخش سوم: دریافت‌کننده (در وجه شخص) */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-2">
            <div ref={personContainerRef}>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                در وجه شخص (طرف حساب) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={selectedPerson?.code ? `کد ${toPersianDigits(String(selectedPerson.code))}` : '-'}
                  disabled
                  className="w-20 h-10 bg-slate-200/60 text-slate-700 font-mono font-bold text-center px-2 rounded-xl border border-slate-300 cursor-not-allowed select-none text-xs"
                />

                <div className="relative flex-1">
                  <input
                    type="text"
                    value={personSearch}
                    onFocus={() => setIsPersonDropdownOpen(true)}
                    onChange={(e) => {
                      setPersonSearch(e.target.value);
                      setIsPersonDropdownOpen(true);
                    }}
                    placeholder="جستجو و انتخاب طرف‌حساب..."
                    className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />

                  {isPersonDropdownOpen && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-300 rounded-2xl shadow-xl divide-y divide-slate-100 text-slate-800">
                      {filteredPersons.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400 font-medium">
                          طرف حسابی یافت نشد
                        </div>
                      ) : (
                        filteredPersons.map((p) => (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => {
                              setPersonId(p.id);
                              setPersonSearch(`${p.code ? p.code + ' - ' : ''}${p.name}`);
                              setIsPersonDropdownOpen(false);
                            }}
                            className={`w-full text-right px-3 py-2.5 flex items-center justify-between text-xs hover:bg-sky-50 transition-colors cursor-pointer ${
                              p.id === personId ? 'bg-sky-50 font-bold text-sky-800' : ''
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <User size={14} className="text-slate-400" />
                              <span>{p.name}</span>
                            </span>
                            <span className="font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              کد {toPersianDigits(String(p.code || '-'))}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ۳. دکمه‌های اقدام زیرین */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            انصراف (Esc)
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-sky-600 hover:bg-sky-700 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Save size={16} />
            <span>{isSubmitting ? 'در حال ثبت...' : 'ذخیره و صدور (F3)'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};