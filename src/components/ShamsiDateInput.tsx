import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, 
  ChevronRight, 
  ChevronLeft, 
  X 
} from 'lucide-react';
import { 
  PERSIAN_MONTH_NAMES, 
  getCurrentShamsi, 
  getShamsiMonthLength, 
  parseShamsi, 
  buildShamsi, 
  toPersianDigits, 
  toEnglishDigits,
  formatShamsiInput,
  shamsiToGregorian
} from '../utils/dateUtils';

interface ShamsiDateInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

const WEEK_DAYS = [
  { short: 'ش', name: 'شنبه' },     // 0
  { short: 'ی', name: 'یکشنبه' },   // 1
  { short: 'د', name: 'دوشنبه' },   // 2
  { short: 'س', name: 'سه‌شنبه' },  // 3
  { short: 'چ', name: 'چهارشنبه' }, // 4
  { short: 'پ', name: 'پنجشنبه' },  // 5
  { short: 'ج', name: 'جمعه' },     // 6
];

export const ShamsiDateInput: React.FC<ShamsiDateInputProps> = ({
  value,
  onChange,
  label,
  placeholder = 'مثال: ۱۴۰۵/۰۱/۰۱',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const today = getCurrentShamsi();
  const parsed = parseShamsi(value) || { jy: today.jy, jm: today.jm, jd: today.jd };

  const [viewYear, setViewYear] = useState(parsed.jy);
  const [viewMonth, setViewMonth] = useState(parsed.jm);
  const [selectedDay, setSelectedDay] = useState(parsed.jd);

  useEffect(() => {
    const p = parseShamsi(value) || { jy: today.jy, jm: today.jm, jd: today.jd };
    setViewYear(p.jy);
    setViewMonth(p.jm);
    setSelectedDay(p.jd);
  }, [value, isOpen, today.jy, today.jm, today.jd]);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = today.jy + 3; y >= today.jy - 10; y--) list.push(y);
    return list;
  }, [today.jy]);

  // حساب طول الشهر وموقع أول يوم من الشهر بدقة
  const { daysGrid } = useMemo(() => {
    const len = getShamsiMonthLength(viewYear, viewMonth);
    
    // تحويل اليوم الأول من الشهر الشمسي إلى الميلادي
    const gDate = shamsiToGregorian(buildShamsi(viewYear, viewMonth, 1));
    
    // تحويل يوم الأسبوع (الأحد = 0 في جافاسكريبت) إلى ترتيب أسبوع إيران (السبت = 0)
    const dayOfWeek = gDate.getDay();
    const startWd = (dayOfWeek + 1) % 7;

    const emptyLeading: number[] = Array.from({ length: startWd }, (_, i) => i);
    const days: number[] = Array.from({ length: len }, (_, i) => i + 1);

    return { 
      daysGrid: { 
        emptyLeading, 
        days 
      } 
    };
  }, [viewYear, viewMonth]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = toEnglishDigits(e.target.value);
    const formatted = formatShamsiInput(raw);
    onChange(formatted);
  };

  const handleSelectDay = (day: number) => {
    setSelectedDay(day);
    const formatted = buildShamsi(viewYear, viewMonth, day);
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSetToday = () => {
    setViewYear(today.jy);
    setViewMonth(today.jm);
    setSelectedDay(today.jd);
    onChange(today.formatted);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <div className={`relative ${className}`} dir="rtl">
      {label && (
        <label className="text-[11px] font-bold text-slate-600 block mb-1">
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {/* Calendar Picker Icon Button */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="absolute right-2 p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
          title="باز کردن باکس انتخاب تاریخ شمسی"
        >
          <Calendar className="w-4 h-4" />
        </button>

        {/* Text Input with Persian formatted digits */}
        <input
          type="text"
          value={toPersianDigits(value)}
          onChange={handleInputChange}
          placeholder={placeholder}
          maxLength={10}
          className="w-full h-10 text-xs font-mono font-bold pr-9 pl-8 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-200 transition-all text-center"
        />

        {/* Clear Button */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute left-2 p-1 text-slate-300 hover:text-rose-500 rounded-md transition-colors cursor-pointer"
            title="پاک کردن تاریخ"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Calendar Modal Picker */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 w-full max-w-sm animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-sky-600" />
                <span>انتخاب تاریخ شمسی</span>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Month & Year Selectors */}
            <div className="flex items-center justify-between mb-4 px-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                title="ماه قبل"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  {PERSIAN_MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>

                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 font-mono focus:outline-none cursor-pointer"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {toPersianDigits(y)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                title="ماه بعد"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Week Days */}
            <div className="grid grid-cols-7 gap-1 mb-2 text-center text-[11px] font-bold text-slate-400">
              {WEEK_DAYS.map((wd) => (
                <div key={wd.short} className="py-1">
                  {wd.short}
                </div>
              ))}
            </div>

            {/* Days Grid مع الخلايا الفارغة في بداية الشهر */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {daysGrid.emptyLeading.map((i) => (
                <div key={`empty-${i}`} className="p-2" />
              ))}
              {daysGrid.days.map((day) => {
                const isSelected =
                  day === selectedDay &&
                  viewMonth === parsed.jm &&
                  viewYear === parsed.jy &&
                  Boolean(value);
                const isToday =
                  day === today.jd &&
                  viewMonth === today.jm &&
                  viewYear === today.jy;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleSelectDay(day)}
                    className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 scale-105'
                        : isToday
                        ? 'bg-sky-50 text-sky-600 border border-sky-300 font-extrabold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {toPersianDigits(day)}
                  </button>
                );
              })}
            </div>

            {/* Footer Buttons */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleSetToday}
                className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold transition-colors cursor-pointer"
              >
                انتخاب امروز ({toPersianDigits(today.jd)} {PERSIAN_MONTH_NAMES[today.jm - 1]})
              </button>

              <div className="flex items-center gap-1.5">
                {value && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-2.5 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer"
                  >
                    پاک کردن
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-medium cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};