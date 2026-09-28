import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, Search, ChevronDown, Check } from 'lucide-react';
import type { Account } from '../db/types';
import { toPersianDigits } from '../utils/dateUtils';

interface SearchableAccountSelectProps {
  accounts: Account[];
  selectedAccountId: string;
  onSelect: (account: Account) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export const SearchableAccountSelect: React.FC<SearchableAccountSelectProps> = ({
  accounts,
  selectedAccountId,
  onSelect,
  placeholder = 'جستجو و انتخاب سرفصل...',
  label,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number; maxHeight: number }>({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 280,
  });

  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedHeight = 280;

    let top = rect.bottom + 4;
    let maxHeight = 260;

    if (spaceBelow < 200 && spaceAbove > spaceBelow) {
      const h = Math.min(spaceAbove - 10, estimatedHeight);
      top = rect.top - h - 4;
      maxHeight = h;
    } else {
      maxHeight = Math.min(spaceBelow - 10, estimatedHeight);
    }

    setMenuStyle({
      top: Math.max(10, top),
      left: Math.max(10, rect.left),
      width: Math.max(rect.width, 240),
      maxHeight: Math.max(120, maxHeight),
    });
  };

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      return;
    }

    updatePosition();
    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      clearTimeout(timer);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredAccounts = useMemo(() => {
    const list = accounts.filter((a) => {
      if (a.id === selectedAccountId) return true;
      const isSystem = (
        a.id === 'acc_inventory_default' ||
        a.id === 'acc_purchase_cost_default' ||
        a.id === 'acc_notes_receivable_default' ||
        a.id === 'acc_notes_payable_default' ||
        a.id === 'acc_sales_revenue_default' ||
        a.name.includes('موجودی کالا') ||
        a.name.includes('موجودی انبار') ||
        a.name.includes('اسناد دریافتنی') ||
        a.name.includes('اسناد پرداختنی') ||
        a.name.includes('انبار')
      );
      return !isSystem;
    });

    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase().trim();
    return list.filter((a) => {
      const nameMatch = a.name.toLowerCase().includes(q);
      const codeMatch = String(a.code || '').includes(q);
      return nameMatch || codeMatch;
    });
  }, [accounts, searchTerm, selectedAccountId]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredAccounts]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % (filteredAccounts.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filteredAccounts.length) % (filteredAccounts.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredAccounts[highlightedIndex]) {
        onSelect(filteredAccounts[highlightedIndex]);
        setIsOpen(false);
        setSearchTerm('');
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative w-full ${className}`} dir="rtl">
      {label && (
        <label className="block text-xs font-bold text-slate-700 mb-1.5">
          {label}
        </label>
      )}

      {/* دکمه انتخابگر اصلی */}
      <div
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-10 bg-white border rounded-xl px-3 py-1 flex items-center justify-between cursor-pointer transition-all ${
          isOpen
            ? 'ring-2 ring-sky-500 border-sky-500 bg-white'
            : 'border-slate-300 hover:border-sky-300'
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
            <Bookmark size={14} />
          </div>

          {selectedAccount ? (
            <div className="flex items-center gap-1.5 truncate text-xs">
              <span className="font-bold text-slate-900 truncate">{selectedAccount.name}</span>
              {selectedAccount.code && (
                <span className="font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] shrink-0 border border-slate-200">
                  کد {toPersianDigits(String(selectedAccount.code))}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 text-xs font-medium truncate">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {/* منوی بازشونده جستجوی پویا متصل به پورتال */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: `${menuStyle.top}px`,
              left: `${menuStyle.left}px`,
              width: `${menuStyle.width}px`,
              zIndex: 999999,
            }}
            dir="rtl"
            className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 divide-y divide-slate-100"
          >
            {/* کادر سرچ داینامیک */}
            <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <Search size={15} className="text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="تایپ کنید (نام یا کد سرفصل...)"
                className="w-full bg-transparent text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {/* لیست سرفصل‌ها */}
            <div
              style={{ maxHeight: `${Math.max(100, menuStyle.maxHeight - 56)}px` }}
              className="overflow-y-auto divide-y divide-slate-50"
            >
              {filteredAccounts.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 font-medium">
                  سرفصلی یافت نشد
                </div>
              ) : (
                filteredAccounts.map((a, idx) => {
                  const isSelected = a.id === selectedAccountId;
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <div
                      key={a.id}
                      onClick={() => {
                        onSelect(a);
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`px-3 py-2 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        isHighlighted ? 'bg-sky-50' : ''
                      } ${isSelected ? 'bg-sky-100/70 font-bold text-sky-900' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                        {a.code && (
                          <div className="w-6 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
                            {toPersianDigits(String(a.code))}
                          </div>
                        )}
                        <span className="font-bold block text-slate-900 truncate">{a.name}</span>
                      </div>

                      {isSelected && <Check size={15} className="text-sky-600 shrink-0" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
