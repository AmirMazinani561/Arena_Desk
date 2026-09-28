import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, ChevronDown, ArrowRightLeft } from 'lucide-react';
import type { Account, TransactionInput, JournalEntry, JournalItem } from '../db/types';
import { getCurrentShamsi, toPersianDigits, separateThousands } from '../utils/dateUtils';
import { AmountInput } from './AmountInput';
import { ShamsiDatePicker } from './ShamsiDatePicker';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  allAccounts: Account[];
  transactionToEdit?: (JournalEntry & { items: JournalItem[] }) | null;
  onSubmit: (tx: TransactionInput) => Promise<void>;
  onOpenReceivedCheque?: () => void;
  onOpenIssuedCheque?: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  allAccounts,
  transactionToEdit,
  onSubmit,
  onOpenReceivedCheque,
  onOpenIssuedCheque,
}) => {
  const [formattedAmount, setFormattedAmount] = useState('');
  const [rawAmount, setRawAmount] = useState(0);
  const [formattedFee, setFormattedFee] = useState('');
  const [rawFee, setRawFee] = useState(0);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [fromInputText, setFromInputText] = useState('');
  const [toInputText, setToInputText] = useState('');
  const [description, setDescription] = useState('');
  const [dateShamsi, setDateShamsi] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isFromDropdownOpen, setIsFromDropdownOpen] = useState(false);
  const [isToDropdownOpen, setIsToDropdownOpen] = useState(false);
  const [fromSelectedIndex, setFromSelectedIndex] = useState(-1);
  const [toSelectedIndex, setToSelectedIndex] = useState(-1);

  const fromContainerRef = useRef<HTMLDivElement>(null);
  const toContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (fromContainerRef.current && !fromContainerRef.current.contains(event.target as Node)) {
        setIsFromDropdownOpen(false);
        const f = allAccounts.find(a => a.id === fromAccountId);
        if (f) setFromInputText(f.name);
      }
      if (toContainerRef.current && !toContainerRef.current.contains(event.target as Node)) {
        setIsToDropdownOpen(false);
        const t = allAccounts.find(a => a.id === toAccountId);
        if (t) setToInputText(t.name);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [allAccounts, fromAccountId, toAccountId]);

  useEffect(() => {
    if (isOpen) {
      if (transactionToEdit) {
        const amt = transactionToEdit.items?.reduce((max, i) => Math.max(max, i.debit), 0) || 0;
        setFormattedAmount(separateThousands(String(amt)));
        setRawAmount(amt);
        const f = transactionToEdit.fee || 0;
        setFormattedFee(f > 0 ? separateThousands(String(f)) : '');
        setRawFee(f);
        setFromAccountId(transactionToEdit.from_account_id || '');
        setToAccountId(transactionToEdit.to_account_id || '');
        
        const fAcc = allAccounts.find((a) => a.id === transactionToEdit.from_account_id);
        const tAcc = allAccounts.find((a) => a.id === transactionToEdit.to_account_id);
        setFromInputText(fAcc ? fAcc.name : '');
        setToInputText(tAcc ? tAcc.name : '');

        setDescription(transactionToEdit.description || '');
        setDateShamsi(transactionToEdit.entry_date_shamsi);
      } else {
        setDateShamsi(getCurrentShamsi().formatted);
        setFormattedAmount('');
        setRawAmount(0);
        setFormattedFee('');
        setRawFee(0);
        setDescription('');
        const assets = allAccounts.filter((a) => a.type === 'asset');
        const expenses = allAccounts.filter((a) => a.type === 'expense');
        const defaultFrom = assets[0]?.id || '';
        const defaultTo = expenses[0]?.id || assets[1]?.id || '';
        setFromAccountId(defaultFrom);
        setToAccountId(defaultTo);
        const fAcc = allAccounts.find((a) => a.id === defaultFrom);
        const tAcc = allAccounts.find((a) => a.id === defaultTo);
        setFromInputText(fAcc ? fAcc.name : '');
        setToInputText(tAcc ? tAcc.name : '');
      }
      setIsFromDropdownOpen(false);
      setIsToDropdownOpen(false);
    }
  }, [isOpen, transactionToEdit, allAccounts]);

  const fromAccount = useMemo(() => allAccounts.find((a) => a.id === fromAccountId), [allAccounts, fromAccountId]);
  const toAccount = useMemo(() => allAccounts.find((a) => a.id === toAccountId), [allAccounts, toAccountId]);

  const filteredFromList = useMemo(() => {
    const q = fromInputText.trim().toLowerCase();
    if (!q) return allAccounts;
    return allAccounts.filter((a) => {
      return a.name.toLowerCase().includes(q) || a.code.includes(q) || (a.card_number && a.card_number.includes(q));
    });
  }, [allAccounts, fromInputText]);

  const filteredToList = useMemo(() => {
    const q = toInputText.trim().toLowerCase();
    if (!q) return allAccounts;
    return allAccounts.filter((a) => {
      return a.name.toLowerCase().includes(q) || a.code.includes(q) || (a.card_number && a.card_number.includes(q));
    });
  }, [allAccounts, toInputText]);

  useEffect(() => {
    setFromSelectedIndex(-1);
  }, [fromInputText]);

  useEffect(() => {
    setToSelectedIndex(-1);
  }, [toInputText]);

  const handleFromKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isFromDropdownOpen || filteredFromList.length === 0) {
      if (e.key === 'ArrowDown') {
        setIsFromDropdownOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFromSelectedIndex((prev) => (prev + 1) % filteredFromList.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFromSelectedIndex((prev) => (prev - 1 + filteredFromList.length) % filteredFromList.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (fromSelectedIndex >= 0 && fromSelectedIndex < filteredFromList.length) {
        const acc = filteredFromList[fromSelectedIndex];
        setFromAccountId(acc.id);
        setFromInputText(acc.name);
        setIsFromDropdownOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsFromDropdownOpen(false);
    }
  };

  const handleToKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isToDropdownOpen || filteredToList.length === 0) {
      if (e.key === 'ArrowDown') {
        setIsToDropdownOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setToSelectedIndex((prev) => (prev + 1) % filteredToList.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setToSelectedIndex((prev) => (prev - 1 + filteredToList.length) % filteredToList.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (toSelectedIndex >= 0 && toSelectedIndex < filteredToList.length) {
        const acc = filteredToList[toSelectedIndex];
        setToAccountId(acc.id);
        setToInputText(acc.name);
        setIsToDropdownOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsToDropdownOpen(false);
    }
  };

  if (!isOpen) return null;

  const resetForm = () => {
    setFormattedAmount('');
    setRawAmount(0);
    setFormattedFee('');
    setRawFee(0);
    setFromAccountId('');
    setToAccountId('');
    setFromInputText('');
    setToInputText('');
    setDescription('');
    setDateShamsi(getCurrentShamsi().formatted);
  };

  const processSubmit = async (keepOpen = false) => {
    if (!rawAmount || rawAmount <= 0) {
      alert('لطفاً مبلغ معتبری وارد کنید.');
      return;
    }
    if (!fromAccountId || !toAccountId) {
      alert('لطفاً حساب مبدأ و مقصد را انتخاب کنید.');
      return;
    }
    if (fromAccountId === toAccountId) {
      alert('حساب مبدأ و مقصد نمی‌تواند یکسان باشد.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        id: transactionToEdit?.id,
        remote_id: transactionToEdit?.remote_id || (transactionToEdit && !transactionToEdit.id.startsWith('je_') ? transactionToEdit.id : undefined),
        amount: rawAmount,
        fee: rawFee,
        fromAccountId,
        toAccountId,
        description: description.trim(),
        dateShamsi: dateShamsi || getCurrentShamsi().formatted,
      });

      if (keepOpen) {
        resetForm();
      } else {
        onClose();
      }
    } catch (err) {
      console.error(err);
      alert('خطا در ثبت رویداد');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await processSubmit(false);
  };

  const detectedTypeLabel = toAccount?.type === 'expense'
    ? 'هزینه'
    : fromAccount?.type === 'revenue'
    ? 'درآمد'
    : 'انتقال / تسویه';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white w-[520px] h-[660px] max-h-[92vh] rounded-2xl p-6 shadow-2xl border border-slate-200 flex flex-col justify-between overflow-hidden">
        {/* هدر مدال */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0 bg-slate-50/80 -mx-6 -mt-6 px-6 pt-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                {transactionToEdit ? 'ویرایش تراکنش' : 'ثبت تراکنش و رویداد مالی'}
              </h2>
              <span className="text-[11px] text-sky-700 font-bold">
                ماهیت خودکار: {detectedTypeLabel}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* سوییچ نوع رویداد */}
        {!transactionToEdit && (
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 my-3 text-xs font-bold shrink-0">
            <button
              type="button"
              className="flex-1 py-2 px-2 rounded-lg bg-white text-sky-700 shadow-xs border border-slate-200/50 text-center"
            >
              نقدی / بانکی
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenReceivedCheque) onOpenReceivedCheque();
              }}
              className="flex-1 py-2 px-2 rounded-lg text-slate-600 hover:text-sky-700 hover:bg-white/60 transition-colors text-center cursor-pointer"
            >
              دریافت چک
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenIssuedCheque) onOpenIssuedCheque();
              }}
              className="flex-1 py-2 px-2 rounded-lg text-slate-600 hover:text-sky-700 hover:bg-white/60 transition-colors text-center cursor-pointer"
            >
              پرداخت چک
            </button>
          </div>
        )}

        {/* فرم ثبت */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between overflow-hidden pt-1">
          <div className="flex-1 overflow-y-auto px-1 space-y-4">
            {/* کادر تفکیک‌شده مبلغ رویداد */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <label className="block text-xs font-bold text-slate-700 text-center">
                مبلغ رویداد مالی (ریال)
              </label>
              <AmountInput
                value={formattedAmount}
                onChange={(formatted, raw) => {
                  setFormattedAmount(formatted);
                  setRawAmount(raw ?? 0);
                }}
                center
                autoFocus
              />
            </div>

            {/* کارمزد بانکی */}
            {fromAccount?.type === 'asset' && (
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 text-center">
                  کارمزد بانکی (اختیاری - ریال)
                </label>
                <AmountInput
                  value={formattedFee}
                  onChange={(formatted, raw) => {
                    setFormattedFee(formatted);
                    setRawFee(raw ?? 0);
                  }}
                  center
                  placeholder="۰"
                />
              </div>
            )}

            {/* حساب مبدأ */}
            <div ref={fromContainerRef} className="relative p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                از حساب (مبدأ / کسر موجودی)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={fromInputText}
                  onChange={(e) => {
                    setFromInputText(e.target.value);
                    setIsFromDropdownOpen(true);
                  }}
                  onKeyDown={handleFromKeyDown}
                  onFocus={() => {
                    setFromInputText('');
                    setIsFromDropdownOpen(true);
                  }}
                  onClick={() => {
                    if (!isFromDropdownOpen) {
                      setFromInputText('');
                      setIsFromDropdownOpen(true);
                    }
                  }}
                  placeholder="تایپ نام یا کد حساب مبدأ..."
                  className="w-full px-3.5 py-2.5 pl-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setIsFromDropdownOpen(!isFromDropdownOpen)}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {isFromDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 max-h-48 overflow-y-auto">
                  {filteredFromList.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">حسابی یافت نشد</div>
                  ) : (
                    filteredFromList.map((acc, accIdx) => {
                      const isSelected = fromSelectedIndex === accIdx;
                      return (
                        <div
                          key={acc.id}
                          onMouseDown={() => {
                            setFromAccountId(acc.id);
                            setFromInputText(acc.name);
                            setIsFromDropdownOpen(false);
                          }}
                          className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-sky-100 text-sky-900 font-bold ring-1 ring-sky-400'
                              : acc.id === fromAccountId
                              ? 'bg-sky-50 text-sky-800 font-bold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="font-semibold">{acc.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">کد: {toPersianDigits(acc.code)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* حساب مقصد */}
            <div ref={toContainerRef} className="relative p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                به حساب (مقصد / واریز یا هزینه)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={toInputText}
                  onChange={(e) => {
                    setToInputText(e.target.value);
                    setIsToDropdownOpen(true);
                  }}
                  onKeyDown={handleToKeyDown}
                  onFocus={() => {
                    setToInputText('');
                    setIsToDropdownOpen(true);
                  }}
                  onClick={() => {
                    if (!isToDropdownOpen) {
                      setToInputText('');
                      setIsToDropdownOpen(true);
                    }
                  }}
                  placeholder="تایپ نام یا کد سرفصل مقصد..."
                  className="w-full px-3.5 py-2.5 pl-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setIsToDropdownOpen(!isToDropdownOpen)}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {isToDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 max-h-48 overflow-y-auto">
                  {filteredToList.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">سرفصلی یافت نشد</div>
                  ) : (
                    filteredToList.map((acc, accIdx) => {
                      const isSelected = toSelectedIndex === accIdx;
                      return (
                        <div
                          key={acc.id}
                          onMouseDown={() => {
                            setToAccountId(acc.id);
                            setToInputText(acc.name);
                            setIsToDropdownOpen(false);
                          }}
                          className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-sky-100 text-sky-900 font-bold ring-1 ring-sky-400'
                              : acc.id === toAccountId
                              ? 'bg-sky-50 text-sky-800 font-bold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="font-semibold">{acc.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">کد: {toPersianDigits(acc.code)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* تاریخ و شرح */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
              <div>
                <ShamsiDatePicker
                  label="تاریخ رویداد مالی"
                  value={dateShamsi}
                  onChange={(newDate) => setDateShamsi(newDate)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">شرح تراکنش (اختیاری)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="متن شرح آرتیکل/سند..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-sky-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* دکمه‌های پایانی */}
          <div className="pt-4 border-t border-slate-200 shrink-0 flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-600/20 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'در حال ثبت...' : transactionToEdit ? 'ذخیره تغییرات' : 'ثبت'}
            </button>

            {!transactionToEdit && (
              <button
                type="button"
                onClick={() => processSubmit(true)}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
                title="ثبت این تراکنش و خالی کردن فرم جهت ثبت سریع تراکنش بعدی"
              >
                {isSubmitting ? 'در حال ثبت...' : 'ثبت و جدید'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};