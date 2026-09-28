import { useState, useMemo, useEffect } from "react";
import {
  PERSIAN_MONTH_NAMES,
  getCurrentShamsi,
  getShamsiMonthLength,
  parseShamsi,
  buildShamsi,
  toPersianDigits,
  shamsiToGregorian,
} from "../utils/dateUtils";
import { Calendar, ChevronRight, ChevronLeft, X } from "lucide-react";

interface Props {
  value: string; // "1405/01/05"
  onChange: (newValue: string) => void;
  label?: string;
  compact?: boolean;
  showTodayButton?: boolean;
}

const WEEK_DAYS = [
  { short: "ش", name: "شنبه" },     // اندیس 0
  { short: "ی", name: "یکشنبه" },   // اندیس 1
  { short: "د", name: "دوشنبه" },   // اندیس 2
  { short: "س", name: "سه‌شنبه" },  // اندیس 3
  { short: "چ", name: "چهارشنبه" }, // اندیس 4
  { short: "پ", name: "پنجشنبه" },  // اندیس 5
  { short: "ج", name: "جمعه" },     // اندیس 6
];

export function ShamsiDatePicker({
  value,
  onChange,
  label,
  compact = false,
  showTodayButton = true,
}: Props) {
  const today = getCurrentShamsi();
  const parsed = parseShamsi(value) || { jy: today.jy, jm: today.jm, jd: today.jd };

  const [isOpen, setIsOpen] = useState(false);
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
    for (let y = today.jy + 2; y >= today.jy - 7; y--) list.push(y);
    return list;
  }, [today.jy]);

  const { daysGrid } = useMemo(() => {
    const len = getShamsiMonthLength(viewYear, viewMonth);
    
    // تبدیل روز اول ماه شمسی به میلادی محلی
    const gDate = shamsiToGregorian(buildShamsi(viewYear, viewMonth, 1));
    
    // در جاوااسکریپت: یکشنبه = 0، دوشنبه = 1، ...، شنبه = 6
    // تبدیل به استاندارد ایران (شنبه = 0، یکشنبه = 1، ...، جمعه = 6)
    const dayOfWeek = gDate.getDay();
    const startWd = (dayOfWeek + 1) % 7;

    const emptyLeading: number[] = Array.from({ length: startWd }, (_, i) => i);
    const days: number[] = Array.from({ length: len }, (_, i) => i + 1);

    return {
      monthLength: len,
      daysGrid: { emptyLeading, days },
    };
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
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

  return (
    <div className="relative">
      {label && <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-full flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        <Calendar className="w-4 h-4 text-sky-600 absolute right-3 pointer-events-none" />
        <span className="font-bold text-slate-800 text-center">
          {toPersianDigits(value || today.formatted)}
        </span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-3xl p-5 shadow-2xl border border-sky-100 w-full max-w-sm">
            {/* هدر تقویم */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-sky-600" />
                <span>تقویم شمسی</span>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* کنترل ماه و سال */}
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
                      {y}
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

            {/* روزهای هفته */}
            <div className="grid grid-cols-7 gap-1 mb-2 text-center text-[11px] font-bold text-slate-400">
              {WEEK_DAYS.map((wd) => (
                <div key={wd.short} className="py-1">
                  {wd.short}
                </div>
              ))}
            </div>

            {/* سلول‌های روزهای ماه */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {daysGrid.emptyLeading.map((i) => (
                <div key={`empty-${i}`} className="p-2" />
              ))}
              {daysGrid.days.map((day) => {
                const isSelected =
                  day === selectedDay &&
                  viewMonth === parsed.jm &&
                  viewYear === parsed.jy;
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
                        ? "bg-sky-600 text-white shadow-md shadow-sky-600/30 scale-105"
                        : isToday
                        ? "bg-sky-50 text-sky-600 border border-sky-300 font-extrabold"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {toPersianDigits(day)}
                  </button>
                );
              })}
            </div>

            {/* دکمه امروز */}
            {showTodayButton && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleSetToday}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  برو به امروز ({toPersianDigits(today.jd)} {PERSIAN_MONTH_NAMES[today.jm - 1]})
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-slate-600 text-xs font-medium cursor-pointer"
                >
                  بستن
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}