import React, { useState, useEffect } from 'react';
import { X, CreditCard, Palette, Folder, Lock } from 'lucide-react';
import type { Account, AccountType } from '../db/types';
import { AmountInput } from './AmountInput';
import { separateThousands, parseAmount, toPersianDigits, formatCardNumber, cleanCardNumber } from '../utils/dateUtils';
import { getNextAccountCode } from '../db/sqlite';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountToEdit?: Account | null;
  defaultType?: AccountType;
  defaultParentId?: string | null;
  allAccounts: Account[];
  onSave: (data: {
    id?: string;
    name: string;
    code: string;
    type: AccountType;
    bank_name?: string;
    account_number?: string;
    card_number?: string;
    color?: string;
    balance?: number;
    initial_balance?: number;
    parent_id?: string | null;
  }) => Promise<void>;
}

const PRESET_COLORS = [
  '#0284c7', // sky
  '#059669', // emerald
  '#7c3aed', // violet
  '#d97706', // amber
  '#e11d48', // rose
  '#475569', // slate
];

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  accountToEdit,
  defaultType = 'asset',
  defaultParentId = null,
  allAccounts,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<AccountType>(defaultType);
  const [parentId, setParentId] = useState<string | null>(defaultParentId);
  const [accountNumber, setAccountNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [formattedBalance, setFormattedBalance] = useState('0');
  const [balanceNature, setBalanceNature] = useState<'debit' | 'credit'>('credit');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (accountToEdit) {
        setName(accountToEdit.name);
        setCode(accountToEdit.code);
        setType(accountToEdit.type);
        setParentId(accountToEdit.parent_id || null);
        setAccountNumber(accountToEdit.account_number || '');
        setCardNumber(accountToEdit.card_number || '');
        setBankName(accountToEdit.bank_name || '');
        setColor(accountToEdit.color || PRESET_COLORS[0]);

        // خواندن مانده اولیه واقعی (سند افتتاحیه) به جای مانده گردشی جاری
        const initBal = accountToEdit.initial_balance !== undefined && accountToEdit.initial_balance !== null
          ? Number(accountToEdit.initial_balance)
          : Number(accountToEdit.balance) || 0;

        setBalanceNature(initBal < 0 ? 'credit' : 'debit');
        setFormattedBalance(separateThousands(String(Math.round(Math.abs(initBal)))));
      } else {
        setName('');
        setType(defaultType);
        setParentId(defaultParentId);
        setAccountNumber('');
        setCardNumber('');
        setBankName('');
        setColor(PRESET_COLORS[0]);
        setBalanceNature(defaultType === 'person' || defaultType === 'liability' ? 'credit' : 'debit');
        setFormattedBalance('0');
        getNextAccountCode(defaultType).then((nextCode) => {
          setCode(nextCode);
        });
      }
    }
  }, [isOpen, accountToEdit, defaultType, defaultParentId]);

  const handleTypeChange = async (newType: AccountType) => {
    setType(newType);
    setParentId(null);
    if (!accountToEdit) {
      const nextCode = await getNextAccountCode(newType);
      setCode(nextCode);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('لطفاً نام حساب را وارد کنید.');
      return;
    }

    try {
      setIsSubmitting(true);
      const parsed = parseAmount(formattedBalance);
      const finalInitialBalance = ((type === 'person' || type === 'liability') && balanceNature === 'credit')
        ? -Math.abs(parsed)
        : Math.abs(parsed);

      await onSave({
        id: accountToEdit?.id,
        name: name.trim(),
        code: code.trim(),
        type,
        parent_id: parentId || null,
        bank_name: bankName.trim() || name.trim(),
        account_number: accountNumber.trim(),
        card_number: cleanCardNumber(cardNumber),
        color,
        balance: finalInitialBalance,
        initial_balance: finalInitialBalance,
      });
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      console.error(err);
      alert('خطا در ذخیره‌سازی اطلاعات حساب');
      setIsSubmitting(false);
    }
  };

  const potentialParents = allAccounts.filter((a) => a.type === type && !a.parent_id && a.id !== accountToEdit?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" dir="rtl">
      <div className="bg-white w-[480px] h-[620px] max-h-[92vh] rounded-3xl p-6 shadow-2xl border border-sky-100 flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-sky-600" />
            <span>
              {accountToEdit
                ? 'ویرایش حساب / سرفصل'
                : defaultParentId
                ? 'افزودن زیرمجموعه جدید'
                : 'تعریف سرفصل یا حساب جدید'}
            </span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between overflow-hidden pt-3">
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {!defaultParentId && !accountToEdit && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">نوع سرفصل حسابداری</label>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('asset')}
                    className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                      type === 'asset'
                        ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-xs'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    بانک و صندوق
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('person')}
                    className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                      type === 'person'
                        ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-xs'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    اشخاص
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('expense')}
                    className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                      type === 'expense'
                        ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-xs'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    هزینه
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('revenue')}
                    className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                      type === 'revenue'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-xs'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    درآمد
                  </button>
                </div>
              </div>
            )}

            {(type === 'expense' || type === 'revenue') && potentialParents.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-slate-500" />
                  <span>سرفصل والد (سرگروه)</span>
                </label>
                <select
                  value={parentId || ''}
                  onChange={(e) => setParentId(e.target.value || null)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-sky-500/20"
                >
                  <option value="">سرفصل اصلی (بدون والد)</option>
                  {potentialParents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (کد: {toPersianDigits(p.code)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {type === 'person'
                  ? 'نام و نام خانوادگی شخص'
                  : type === 'asset'
                  ? 'نام بانک یا صندوق'
                  : 'عنوان سرفصل یا زیرمجموعه'}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  type === 'person'
                    ? 'مثال: علی رضایی'
                    : type === 'asset'
                    ? 'مثال: کارت اصلی بانک سامان'
                    : 'مثال: سوپرمارکت، اجاره و ...'
                }
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>کد سیستم (تولید خودکار استاندارد)</span>
                </span>
                <span className="text-[10px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded font-bold">
                  {type === 'asset'
                    ? 'بانک از ۱'
                    : type === 'person'
                    ? 'اشخاص از ۱۰۱'
                    : type === 'expense'
                    ? 'هزینه از ۱۰۰۱'
                    : 'درآمد از ۳۰۰۱'}
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={toPersianDigits(code)}
                  readOnly
                  className="w-full px-3.5 py-2.5 bg-slate-100/90 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 text-center cursor-not-allowed select-none"
                  title="کد حسابداری به طور هوشمند و خودکار توسط سیستم تولید می‌شود"
                />
              </div>
            </div>

            {type === 'asset' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">شماره حساب بانکی</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="مثلاً: 12345678"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-center focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">شماره کارت بانکی</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    placeholder="۶۰۳۷-۹۹۱۸-۱۲۳۴-۵۶۷۸"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-center font-bold tracking-wider focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* مانده حساب اولیه (سند افتتاحیه) */}
            {(type === 'asset' || type === 'person' || type === 'liability') && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-600">
                  {accountToEdit ? 'مانده حساب اولیه (سند افتتاحیه - ریال)' : 'موجودی اولیه (ریال)'}
                </label>
                <AmountInput
                  value={formattedBalance}
                  onChange={(formatted) => setFormattedBalance(formatted)}
                  center
                />

                {(type === 'person' || type === 'liability') && (
                  <div className="pt-1">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      ماهیت مانده اولیه:
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setBalanceNature('credit')}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          balanceNature === 'credit'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-800'
                        }`}
                      >
                        <span>بستانکار (طلبکار از ما / بس)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBalanceNature('debit')}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          balanceNature === 'debit'
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-800'
                        }`}
                      >
                        <span>بدهکار (بدهکار به ما / بد)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {type === 'asset' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-slate-500" />
                  <span>رنگ شناسه کارت</span>
                </label>
                <div className="flex items-center gap-3">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                        color === c ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'opacity-80 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2.5 pt-4 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'در حال ثبت...' : accountToEdit ? 'ذخیره تغییرات' : 'ایجاد حساب'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};