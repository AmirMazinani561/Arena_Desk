import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, Package, X, Barcode, Plus } from 'lucide-react';
import type { Commodity } from '../db/types';
import { toPersianDigits } from '../utils/dateUtils';

interface SearchableCommoditySelectProps {
  commodities: Commodity[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAddNew?: (searchQuery: string) => void;
  label?: string;
  placeholder?: string;
  allowAll?: boolean;
  allLabel?: string;
  className?: string;
}

export const SearchableCommoditySelect: React.FC<SearchableCommoditySelectProps> = ({
  commodities,
  selectedId,
  onSelect,
  onAddNew,
  label,
  placeholder = 'جستجو و انتخاب کالا...',
  allowAll = true,
  allLabel = 'همه کالاها و اقلام',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number; maxHeight: number }>({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 280,
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      setSearchQuery('');
      return;
    }

    updatePosition();
    const handleScrollOrResize = () => updatePosition();

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

  const selectedCommodity = useMemo(() => {
    if (selectedId === 'all') return null;
    return commodities.find((c) => c.id === selectedId) || null;
  }, [commodities, selectedId]);

  const filteredCommodities = useMemo(() => {
    if (!searchQuery.trim()) return commodities;
    const q = searchQuery.trim().toLowerCase();
    return commodities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        String(c.code).includes(q) ||
        (c.barcode && c.barcode.toLowerCase().includes(q))
    );
  }, [commodities, searchQuery]);

  const handleSelect = (id: string) => {
    onSelect(id);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} dir="rtl">
      {label && (
        <label className="text-[11px] font-bold text-slate-600 block mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-10 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 hover:border-sky-300 focus:outline-none focus:border-sky-500 flex items-center justify-between gap-2 cursor-pointer transition-all shadow-2xs"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
          <Package className="w-4 h-4 text-sky-600 shrink-0" />
          {selectedId === 'all' || !selectedCommodity ? (
            <span className="text-slate-600 font-bold truncate">
              {allLabel}
            </span>
          ) : (
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-sky-100 text-sky-800 shrink-0">
                کد {toPersianDigits(selectedCommodity.code)}
              </span>
              <span className="truncate font-bold text-slate-900">
                {selectedCommodity.name}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedId !== 'all' && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onSelect('all');
              }}
              className="p-1 text-slate-400 hover:text-rose-500 rounded-md hover:bg-slate-100 transition-colors"
              title="نمایش همه کالاها"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu via React Portal */}
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
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
          >
            {/* Search Box */}
            <div className="p-2 border-b border-slate-100 bg-slate-50/90">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={placeholder}
                  className="w-full text-xs pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-200 font-medium"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
            </div>

            {/* List Options */}
            <div
              style={{ maxHeight: `${Math.max(100, menuStyle.maxHeight - 56)}px` }}
              className="overflow-y-auto p-1.5 space-y-1"
            >
              {allowAll && (
                <button
                  type="button"
                  onClick={() => handleSelect('all')}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    selectedId === 'all'
                      ? 'bg-sky-50 text-sky-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-400" />
                    <span>{allLabel}</span>
                  </div>
                  {selectedId === 'all' && <Check className="w-4 h-4 text-sky-600" />}
                </button>
              )}

              {/* دکمه تعریف سریع کالا */}
              {onAddNew && searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    onAddNew(searchQuery.trim());
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold bg-sky-50 hover:bg-sky-100 text-sky-700 transition-colors cursor-pointer border border-dashed border-sky-300"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Plus className="w-4 h-4 text-sky-600 shrink-0" />
                    <span className="truncate">تعریف سریع کالای جدید: «{searchQuery.trim()}»</span>
                  </div>
                  <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-sky-200 text-sky-600 shrink-0">
                    جدید
                  </span>
                </button>
              )}

              {filteredCommodities.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  {onAddNew ? 'کالایی با این نام یافت نشد. می‌توانید با گزینه بالا آن را ایجاد کنید.' : 'کالایی با این مشخصات یافت نشد'}
                </div>
              ) : (
                filteredCommodities.map((c) => {
                  const isSelected = c.id === selectedId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelect(c.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer text-right ${
                        isSelected
                          ? 'bg-sky-50 text-sky-700 font-bold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200/80 shrink-0">
                          {toPersianDigits(c.code)}
                        </span>
                        <div className="min-w-0 flex-1 truncate">
                          <span className="truncate block font-semibold text-slate-900">
                            {c.name}
                          </span>
                          {c.barcode && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                              <Barcode className="w-3 h-3" />
                              {c.barcode}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-mono text-slate-500">
                          {toPersianDigits(c.current_quantity || 0)} {c.unit}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-sky-600" />}
                      </div>
                    </button>
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