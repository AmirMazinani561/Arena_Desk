import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, RefreshCw, Calendar, Search, X, CreditCard, BookOpen, Upload, Cloud, Database } from 'lucide-react';
import { getCurrentShamsi, formatMoney, toPersianDigits } from '../utils/dateUtils';
import type { Account, JournalEntry, JournalItem } from '../db/types';
import { convertWalletBackup } from '../utils/importer';
import { importConvertedDataset } from '../db/sqlite';

interface TopBarProps {
  onRefresh?: () => void;
  isLoading?: boolean;
  onNewTransaction: () => void;
  accounts: Account[];
  entries: (JournalEntry & { items: JournalItem[] })[];
  onSelectAccount: (accountId: string) => void;
  onSelectEntry?: (entry: JournalEntry & { items: JournalItem[] }) => void;
  onSearchChange?: (q: string) => void;
  onOpenSyncModal?: () => void;
  onOpenBackupModal?: () => void;
}

type SearchResultItem =
  | { type: 'account'; data: Account }
  | { type: 'entry'; data: JournalEntry & { items: JournalItem[] } };

export const TopBar: React.FC<TopBarProps> = ({
  onRefresh,
  isLoading,
  onNewTransaction,
  accounts,
  entries,
  onSelectAccount,
  onSelectEntry,
  onSearchChange,
  onOpenSyncModal,
  onOpenBackupModal,
}) => {
  const shamsi = getCurrentShamsi();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const text = await file.text();
      const rawBackup = JSON.parse(text);

      if (!rawBackup.accounts || !rawBackup.transactions) {
        alert('فایل انتخاب‌شده ساختار معتبر پشتیبان کیف پول را ندارد.');
        return;
      }

      const converted = convertWalletBackup(rawBackup);
      await importConvertedDataset(converted);
      alert(`اطلاعات با موفقیت انتقال یافت!\nتعداد حساب‌ها: ${toPersianDigits(converted.accounts.length)}\nتعداد اسناد و تراکنش‌ها: ${toPersianDigits(converted.entries.length)}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to import wallet backup:', err);
      alert('خطا در خواندن و تبدیل فایل پشتیبان کیف پول.');
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  // میانبر صفحه‌کلید Ctrl + K برای فوکوس مستقیم روی کادر جستجو
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // بستن منو هنگام کلیک بیرون
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const q = query.trim().toLowerCase();

  const matchingAccounts = useMemo(() => {
    if (!q) return [];
    return accounts.filter((a) => {
      return (
        a.name.toLowerCase().includes(q) ||
        a.code.includes(q) ||
        (a.card_number && a.card_number.includes(q)) ||
        (a.account_number && a.account_number.includes(q))
      );
    });
  }, [accounts, q]);

  const matchingEntries = useMemo(() => {
    if (!q) return [];
    return entries.filter((e) => {
      const matchDesc = e.description?.toLowerCase().includes(q);
      const matchNum = String(e.entry_number).includes(q);
      const matchDate = e.entry_date_shamsi.includes(q);
      const matchItems = e.items?.some(
        (i) => i.account_name?.toLowerCase().includes(q) || (i.note && i.note.toLowerCase().includes(q))
      );
      return matchDesc || matchNum || matchDate || matchItems;
    });
  }, [entries, q]);

  const searchResults: SearchResultItem[] = useMemo(() => {
    const list: SearchResultItem[] = [];
    matchingAccounts.forEach((a) => list.push({ type: 'account', data: a }));
    matchingEntries.forEach((e) => list.push({ type: 'entry', data: e }));
    return list;
  }, [matchingAccounts, matchingEntries]);

  useEffect(() => {
    setSelectedIndex(-1);
    if (onSearchChange) {
      onSearchChange(query);
    }
  }, [query, onSearchChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || searchResults.length === 0) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
        const item = searchResults[selectedIndex];
        if (item.type === 'account') {
          onSelectAccount(item.data.id);
        } else if (item.type === 'entry' && onSelectEntry) {
          onSelectEntry(item.data);
        }
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <header className="h-16 px-6 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between shadow-xs select-none shrink-0 relative z-40">
      {/* Date & Title Info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-100/90 px-3.5 py-1.5 rounded-xl border border-slate-200/60 shrink-0">
          <Calendar className="w-4 h-4 text-sky-600" />
          <span>امروز: {shamsi.fullText}</span>
        </div>

        {/* کادر جستجوی مستقیم در هدر */}
        <div ref={searchContainerRef} className="relative w-72 sm:w-80 md:w-96">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (query.trim()) setIsOpen(true);
              }}
              placeholder="جستجوی مستقیم در تمام بخش‌ها..."
              className="w-full pr-9 pl-14 py-1.5 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-sky-500 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white transition-all shadow-2xs"
            />
            {query ? (
              <button
                onClick={() => {
                  setQuery('');
                  setIsOpen(false);
                }}
                className="absolute left-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block absolute left-2.5 px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-500 text-[10px] font-mono pointer-events-none">
                Ctrl+K
              </kbd>
            )}
          </div>

          {/* دراپ‌داون نتایج متصل به کادر سرچ با پشتیبانی کامل از کلیدهای مکان‌نما */}
          {isOpen && q && (
            <div className="absolute top-full right-0 left-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2.5 max-h-96 overflow-y-auto z-50">
              {matchingAccounts.length === 0 && matchingEntries.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  نتیجه‌ای یافت نشد.
                </div>
              ) : (
                <div className="space-y-3">
                  {matchingAccounts.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 mb-1 px-2 flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5 text-sky-600" />
                        <span>حساب‌ها و اشخاص ({toPersianDigits(matchingAccounts.length)})</span>
                      </div>
                      <div className="space-y-1">
                        {matchingAccounts.map((acc, aIdx) => {
                          const isSelected = selectedIndex === aIdx;
                          return (
                            <div
                              key={acc.id}
                              onMouseDown={() => {
                                onSelectAccount(acc.id);
                                setIsOpen(false);
                              }}
                              className={`p-2 rounded-xl cursor-pointer transition-colors flex items-center justify-between text-xs ${
                                isSelected ? 'bg-sky-100 ring-1 ring-sky-400' : 'hover:bg-sky-50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800">{acc.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">کد: {toPersianDigits(acc.code)}</span>
                              </div>
                              <span className="font-extrabold text-slate-700">
                                {formatMoney(Math.abs(acc.balance))} ریال
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {matchingEntries.length > 0 && (
                    <div className="border-t border-slate-100 pt-2">
                      <div className="text-[11px] font-bold text-slate-400 mb-1 px-2 flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-sky-600" />
                        <span>اسناد و تراکنش‌ها ({toPersianDigits(matchingEntries.length)})</span>
                      </div>
                      <div className="space-y-1">
                        {matchingEntries.map((e, eIdx) => {
                          const globalIdx = matchingAccounts.length + eIdx;
                          const isSelected = selectedIndex === globalIdx;
                          const amt = e.items?.reduce((max, i) => Math.max(max, i.debit), 0) || 0;
                          return (
                            <div
                              key={e.id}
                              onMouseDown={() => {
                                if (onSelectEntry) onSelectEntry(e);
                                setIsOpen(false);
                              }}
                              className={`p-2 rounded-xl cursor-pointer transition-colors flex items-center justify-between text-xs ${
                                isSelected ? 'bg-sky-100 ring-1 ring-sky-400' : 'bg-slate-50 hover:bg-slate-100'
                              }`}
                            >
                              <div>
                                <div className="font-bold text-slate-800">
                                  #{toPersianDigits(e.entry_number)} {e.description || 'بدون شرح'}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {toPersianDigits(e.entry_date_shamsi)}
                                </div>
                              </div>
                              <span className="font-bold text-sky-700">
                                {formatMoney(amt)} ریال
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2.5">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImportFile}
          accept=".json"
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-sky-700 hover:border-sky-300 hover:bg-sky-50 text-xs font-bold transition-all cursor-pointer"
          title="ایمپورت مستقیم فایل پشتیبان کیف پول (JSON)"
        >
          <Upload className={`w-4 h-4 ${isImporting ? 'animate-bounce text-sky-600' : 'text-slate-500'}`} />
          <span className="hidden sm:inline">ایمپورت از کیف پول</span>
        </button>

        {onOpenSyncModal && (
          <button
            type="button"
            onClick={onOpenSyncModal}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-sky-200 text-sky-700 bg-sky-50/70 hover:bg-sky-100 hover:border-sky-300 text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="اتصال و همگام‌سازی ابری با کیف پول آنلاین"
          >
            <Cloud className="w-4 h-4 text-sky-600" />
            <span className="hidden sm:inline">همگام‌سازی ابری</span>
          </button>
        )}

        {/* دکمه پشتیبان‌گیری و بازیابی اطلاعات */}
        {onOpenBackupModal && (
          <button
            type="button"
            onClick={onOpenBackupModal}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 hover:border-sky-300 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
            title="پشتیبان‌گیری و بازیابی دیتابیس"
          >
            <Database className="w-4 h-4 text-sky-600" />
            <span className="hidden sm:inline">پشتیبان‌گیری</span>
          </button>
        )}

        {onRefresh && (
          <button
            onClick={onRefresh}
            className={`p-2.5 rounded-xl text-slate-500 hover:text-sky-600 hover:bg-slate-100 border border-slate-200/60 transition-all cursor-pointer ${
              isLoading ? 'animate-spin text-sky-600' : ''
            }`}
            title="به‌روزرسانی داده‌ها"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onNewTransaction}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 active:scale-98 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>ثبت رویداد مالی جدید</span>
        </button>
      </div>
    </header>
  );
};