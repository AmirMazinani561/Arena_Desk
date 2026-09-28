import React from 'react';
import { toEnglishDigits, toPersianDigits, separateThousands } from '../utils/dateUtils';

interface AmountInputProps {
  value: string | number;
  onChange: (formattedValue: string, numericValue?: number) => void;
  placeholder?: string;
  center?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  placeholder = '۰',
  center = false,
  className = '',
  autoFocus = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    
    // استخراج ارقام خام و تبدیل ارقام فارسی و عربی به انگلیسی
    const digitsOnly = toEnglishDigits(rawVal).replace(/[^\d]/g, '');

    if (!digitsOnly) {
      onChange('0', 0);
      return;
    }

    const num = parseInt(digitsOnly, 10);
    // ۳ رقم ۳ رقم کردن تمیز
    const formatted = separateThousands(num);

    onChange(formatted, num);
  };

  const displayVal = value === '0' || value === 0 ? '' : toPersianDigits(String(value));

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayVal}
      onChange={handleChange}
      onFocus={(e) => e.target.select()}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={`w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none transition-all ${
        center ? 'text-center' : 'text-left'
      } ${className}`}
    />
  );
};