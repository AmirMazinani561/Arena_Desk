import * as jalaali from "jalaali-js";

export const PERSIAN_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

// ترتیب استاندارد روزهای هفته در ایران (آغاز از شنبه، پایان جمعه)
export const PERSIAN_WEEK_DAYS = [
  "شنبه",       // 0
  "یکشنبه",     // 1
  "دوشنبه",     // 2
  "سه‌شنبه",    // 3
  "چهارشنبه",   // 4
  "پنج‌شنبه",   // 5
  "جمعه",       // 6
];

/**
 * دریافت نام و اندیس روز هفته بر مبنای تقویم استاندارد ایران (شنبه = ۰ تا جمعه = ۶)
 */
export function getPersianDayOfWeek(date: Date = new Date()): { index: number; name: string } {
  // در جاوااسکریپت: یکشنبه = 0، دوشنبه = 1 ... شنبه = 6
  // تبدیل به هفته ایران: شنبه = 0، یکشنبه = 1 ... جمعه = 6
  const persianIndex = (date.getDay() + 1) % 7;
  return {
    index: persianIndex,
    name: PERSIAN_WEEK_DAYS[persianIndex],
  };
}

export function toPersianDigits(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "";
  const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return n.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x, 10)]);
}

export function toShamsiDateString(date: Date | string | number): string {
  const d = new Date(date);
  const j = jalaali.toJalaali(d);
  const m = String(j.jm).padStart(2, "0");
  const day = String(j.jd).padStart(2, "0");
  return toPersianDigits(`${j.jy}/${m}/${day}`);
}

export function formatShamsiDisplay(date: Date | string | number): string {
  const d = new Date(date);
  const j = jalaali.toJalaali(d);
  const monthName = PERSIAN_MONTH_NAMES[j.jm - 1] || "";
  const dayInfo = getPersianDayOfWeek(d);
  return `${dayInfo.name}، ${toPersianDigits(j.jd)} ${monthName} ${toPersianDigits(j.jy)}`;
}

export function getCurrentShamsi(): { 
  jy: number; 
  jm: number; 
  jd: number; 
  dayOfWeekName: string;
  dayOfWeekIndex: number;
  formatted: string; 
  fullText: string 
} {
  const now = new Date();
  const j = jalaali.toJalaali(now);
  const m = String(j.jm).padStart(2, "0");
  const d = String(j.jd).padStart(2, "0");
  const dayInfo = getPersianDayOfWeek(now);

  return {
    jy: j.jy,
    jm: j.jm,
    jd: j.jd,
    dayOfWeekName: dayInfo.name,
    dayOfWeekIndex: dayInfo.index,
    formatted: `${j.jy}/${m}/${d}`,
    fullText: `${dayInfo.name} ${toPersianDigits(j.jd)} ${PERSIAN_MONTH_NAMES[j.jm - 1]} ${toPersianDigits(j.jy)}`,
  };
}

export function getShamsiMonthLength(jy: number, jm: number): number {
  try {
    return jalaali.jalaaliMonthLength(jy, jm);
  } catch {
    return 31;
  }
}

export function parseShamsi(value: string): { jy: number; jm: number; jd: number } | null {
  if (!value) return null;
  const cleanVal = toEnglishDigits(value).trim();
  const digitsOnly = cleanVal.replace(/\D/g, '');
  if (digitsOnly.length === 8 && !cleanVal.includes('/')) {
    const jy = parseInt(digitsOnly.slice(0, 4), 10);
    const jm = parseInt(digitsOnly.slice(4, 6), 10);
    const jd = parseInt(digitsOnly.slice(6, 8), 10);
    if (!isNaN(jy) && !isNaN(jm) && !isNaN(jd)) {
      return { jy, jm, jd };
    }
  }
  const parts = cleanVal.split("/").map((p) => parseInt(p.trim(), 10));
  if (parts.length !== 3 || parts.some((p) => isNaN(p))) return null;
  return { jy: parts[0], jm: parts[1], jd: parts[2] };
}

export function formatShamsiWithSlash(value: string | number | null | undefined): string {
  if (!value) return '-';
  const clean = toEnglishDigits(String(value)).replace(/\D/g, '');
  if (clean.length === 8) {
    return toPersianDigits(`${clean.slice(0, 4)}/${clean.slice(4, 6)}/${clean.slice(6, 8)}`);
  }
  if (String(value).includes('/')) {
    return toPersianDigits(String(value));
  }
  return toPersianDigits(String(value));
}

export function buildShamsi(jy: number, jm: number, jd: number): string {
  return `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
}

export function formatQuantity(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '۰';
  const num = parseFloat(String(value));
  if (isNaN(num)) return '۰';

  const cleanVal = Math.round((num + Number.EPSILON) * 1000) / 1000;
  return toPersianDigits(cleanVal.toString());
}

export function shamsiToGregorian(
  shamsiStr: string,
  hour = 12,
  minute = 0,
  second = 0
): Date {
  const cleanStr = toEnglishDigits(shamsiStr);
  const parts = cleanStr.split("/").map((p) => parseInt(p.trim(), 10));
  if (parts.length !== 3 || parts.some(isNaN)) {
    return new Date();
  }
  const [jy, jm, jd] = parts;
  const g = jalaali.toGregorian(jy, jm, jd);
  return new Date(Date.UTC(g.gy, g.gm - 1, g.gd, hour, minute, second));
}

export function formatMoney(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "۰";
  const num = typeof amount === "number" ? amount : Number(toEnglishDigits(String(amount)));
  if (isNaN(num)) return "۰";
  const formatted = Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return toPersianDigits(formatted);
}

export function toEnglishDigits(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

export function separateThousands(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0';
  
  const cleanStr = toEnglishDigits(String(value)).trim();
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return '0';

  const rounded = Math.round(num);
  return toPersianDigits(rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','));
}

export function parseAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const digitsOnly = toEnglishDigits(String(value)).replace(/[^\d]/g, "");
  return digitsOnly ? parseInt(digitsOnly, 10) : 0;
}

export function formatCardNumber(value: string): string {
  const digitsOnly = toEnglishDigits(value).replace(/[^\d]/g, "").slice(0, 16);
  if (!digitsOnly) return "";
  const parts: string[] = [];
  for (let i = 0; i < digitsOnly.length; i += 4) {
    parts.push(digitsOnly.slice(i, i + 4));
  }
  return parts.join("-");
}

export function cleanCardNumber(value: string): string {
  return toEnglishDigits(value).replace(/[^\d]/g, "");
}

export function calculateRunningBalances(
  accounts: { id: string; type: string; balance: number; initial_balance?: number }[],
  entries: { id: string; entry_number: number; status?: string; source_type: string; from_account_id?: string; to_account_id?: string; fee?: number; items?: { account_id: string; debit: number; credit: number }[] }[]
): Map<string, number> {
  const result = new Map<string, number>();

  const sortedEntries = [...entries].sort((a, b) => a.entry_number - b.entry_number);

  const bankBalances = new Map<string, number>();
  for (const acc of accounts) {
    if (acc.type === 'asset') {
      const openingBal = acc.initial_balance !== undefined && acc.initial_balance !== null
        ? Number(acc.initial_balance)
        : Number(acc.balance);
      bankBalances.set(acc.id, openingBal);
    }
  }

  for (const entry of sortedEntries) {
    if (entry.status === 'draft') {
      continue;
    }
    if (entry.source_type === 'manual') {
      const assetItem = entry.items?.find((i) => bankBalances.has(i.account_id));
      if (assetItem) {
        result.set(entry.id, bankBalances.get(assetItem.account_id) || 0);
      }
      continue;
    }

    const amount = entry.items?.reduce((max, i) => Math.max(max, i.debit), 0) || 0;
    const fee = Number(entry.fee) || 0;
    const fromId = entry.from_account_id;
    const toId = entry.to_account_id;

    let relevantBalance: number | undefined;

    if (fromId && bankBalances.has(fromId)) {
      const cur = bankBalances.get(fromId) || 0;
      const next = cur - amount - fee;
      bankBalances.set(fromId, next);
      relevantBalance = next;
    }

    if (toId && bankBalances.has(toId)) {
      const cur = bankBalances.get(toId) || 0;
      const next = cur + amount;
      bankBalances.set(toId, next);
      if (relevantBalance === undefined) {
        relevantBalance = next;
      }
    }

    if (relevantBalance !== undefined) {
      result.set(entry.id, relevantBalance);
    }
  }

  return result;
}

export function getDiagnosis(balance: number): { label: string; textClass: string } {
  if (balance > 0) {
    return { label: 'بد', textClass: 'text-slate-800 font-bold bg-slate-100 px-2 py-0.5 rounded text-[11px]' };
  } else if (balance < 0) {
    return { label: 'بس', textClass: 'text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded text-[11px]' };
  }
  return { label: 'بی‌حساب', textClass: 'text-slate-400 font-medium text-[11px]' };
}

export function formatShamsiInput(value: string): string {
  const digits = toEnglishDigits(value).replace(/[^\d]/g, '').slice(0, 8);
  if (digits.length <= 4) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}/${digits.slice(4)}`;
  }
  return `${digits.slice(0, 4)}/${digits.slice(4, 6)}/${digits.slice(6, 8)}`;
}