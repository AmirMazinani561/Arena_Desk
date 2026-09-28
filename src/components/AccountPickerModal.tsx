import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Landmark, Users, ArrowDownRight, ArrowUpRight, Check } from 'lucide-react';
import type { Account, AccountType } from '../db/types';
import { formatMoney, toPersianDigits } from '../utils/dateUtils';

interface AccountPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (account: Account) => void;
  title?: string;
  allowedTypes?: AccountType[];
  selectedId?: string;
  allAccounts: Account[];
}

export const AccountPickerModal: React.FC<AccountPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  title = 'انتخاب حساب یا سرفصل',
  allowedTypes,
  selectedId,
  allAccounts,
}) => {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setSearch('');
    }
  }, [isOpen]);

  const accountMap = useMemo(() => {
    const map = new Map<string, Account>();
    for (const a of allAccounts) map.set(a.id, a);
    return map;
  }, [allAccounts]);

  const filteredAccounts = useMemo(() => {
    let list = allAccounts;
    if (allowedTypes && allowedTypes.length > 0) {
      list = list.filter((a) => allowedTypes.includes(a.type));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const parentName = a.parent_id ? accountMap.get(a.parent_id)?.name.toLowerCase() || '' : '';
        return (
          a.name.toLowerCase().includes(q) ||
          a.code.includes(q) ||
          (a.card_number && a.card_number.includes(q)) ||
          (a.account_number && a.account_number.includes(q)) ||
          parentName.includes(q)
        );
      });
    }
    return list;
  }, [allAccounts, allowedTypes, search, accountMap]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-sky-100 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* جستجوی زنده */}
        <div className="p-3 border-b border-slate-100 bg-white">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو بر اساس نام، کد معین، شماره حساب یا کارت..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* لیست نتایج */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 divide-y divide-slate-50">
          {filteredAccounts.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              موردی مطابق با جستجوی شما یافت نشد.
            </div>
          ) : (
            filteredAccounts.map((acc) => {
              const isSelected = acc.id === selectedId;
              const parent = acc.parent_id ? accountMap.get(acc.parent_id) : null;

              return (
                <button
                  key={acc.id}
                  onClick={() => {
                    onSelect(acc);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-right ${
                    isSelected
                      ? 'bg-sky-50 border border-sky-200 text-sky-900'
                      : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 text-xs font-bold"
                      style={{
                        backgroundColor:
                          acc.color ||
                          (acc.type === 'person'
                            ? '#9333ea'
                            : acc.type === 'expense'
                            ? '#e11d48'
                            : acc.type === 'revenue'
                            ? '#059669'
                            : '#0284c7'),
                      }}
                    >
                      {acc.type === 'person' ? (
                        <Users className="w-4 h-4" />
                      ) : acc.type === 'expense' ? (
                        <ArrowDownRight className="w-4 h-4" />
                      ) : acc.type === 'revenue' ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <Landmark className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold">
                        {parent && (
                          <span className="text-slate-400 font-normal ml-1">
                            {parent.name} ←
                          </span>
                        )}
                        {acc.name}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        کد: {toPersianDigits(acc.code)}
                        {acc.card_number ? ` • کارت: ${toPersianDigits(acc.card_number)}` : ''}
                        {acc.account_number ? ` • حساب: ${toPersianDigits(acc.account_number)}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {acc.type === 'asset' || acc.type === 'person' ? (
                      <span className="text-xs font-bold text-slate-700">
                        {formatMoney(acc.balance)}{' '}
                        <span className="text-[10px] font-normal text-slate-400">ریال</span>
                      </span>
                    ) : null}
                    {isSelected && <Check className="w-4 h-4 text-sky-600" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
