import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { User, Search, ChevronDown, Check, Phone } from 'lucide-react';
import type { Account } from '../db/types';
import { toPersianDigits, separateThousands } from '../utils/dateUtils';

interface SearchablePersonSelectProps {
  persons: Account[];
  selectedPersonId: string;
  onSelect: (person: Account) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
}

export const SearchablePersonSelect: React.FC<SearchablePersonSelectProps> = ({
  persons,
  selectedPersonId,
  onSelect,
  placeholder = 'جستجو و انتخاب طرف حساب...',
  label,
  required = false,
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

  const selectedPerson = useMemo(() => {
    return persons.find((p) => p.id === selectedPersonId);
  }, [persons, selectedPersonId]);

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
      width: Math.max(rect.width, 280),
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
      inputRef.current?.select();
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

  const filteredPersons = useMemo(() => {
    if (!searchTerm.trim()) return persons;
    const q = searchTerm.toLowerCase().trim();
    return persons.filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(q);
      const codeMatch = String(p.code || '').includes(q);
      const phoneMatch = p.card_number ? p.card_number.includes(q) : false;
      return nameMatch || codeMatch || phoneMatch;
    });
  }, [persons, searchTerm]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredPersons]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % (filteredPersons.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filteredPersons.length) % (filteredPersons.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredPersons[highlightedIndex]) {
        onSelect(filteredPersons[highlightedIndex]);
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
          {label} {required && <span className="text-rose-500">*</span>}
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
          <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
            <User size={14} />
          </div>

          {selectedPerson ? (
            <div className="flex items-center gap-1.5 truncate text-xs">
              <span className="font-bold text-slate-900 truncate">{selectedPerson.name}</span>
              <span className="font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] shrink-0 border border-slate-200">
                کد {toPersianDigits(String(selectedPerson.code))}
              </span>
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

      {/* منوی بازشونده جستجو */}
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
            <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <Search size={15} className="text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={handleKeyDown}
                placeholder="تایپ کنید (نام، کد، شماره تماس...)"
                className="w-full bg-transparent text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            <div
              style={{ maxHeight: `${Math.max(100, menuStyle.maxHeight - 56)}px` }}
              className="overflow-y-auto divide-y divide-slate-50"
            >
              {filteredPersons.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 font-medium">
                  هیچ طرف حسابی یافت نشد
                </div>
              ) : (
                filteredPersons.map((p, idx) => {
                  const isSelected = p.id === selectedPersonId;
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        onSelect(p);
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`px-3 py-2 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        isHighlighted ? 'bg-sky-50' : ''
                      } ${isSelected ? 'bg-sky-100/70 font-bold text-sky-900' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                        <div className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
                          {toPersianDigits(String(p.code))}
                        </div>
                        <div className="truncate">
                          <span className="font-bold block text-slate-900 truncate">{p.name}</span>
                          {p.card_number && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                              <Phone size={10} />
                              {p.card_number}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {p.balance !== undefined && (
                          <span
                            className={`text-[11px] font-mono font-bold ${
                              p.balance > 0
                                ? 'text-emerald-600'
                                : p.balance < 0
                                ? 'text-rose-600'
                                : 'text-slate-400'
                            }`}
                          >
                            {separateThousands(String(Math.abs(p.balance)))} ریال
                          </span>
                        )}
                        {isSelected && <Check size={15} className="text-sky-600 shrink-0" />}
                      </div>
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