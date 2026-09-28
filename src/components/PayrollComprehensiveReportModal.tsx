import React, { useState, useEffect, useMemo } from 'react';
import { Printer, X, Calendar, FileText, Filter } from 'lucide-react';
import type { PayrollEmployee } from '../db/types';
import { getAllPayrollYearData, getPayrollMonthlyRecord, getAllPayrollEmployees } from '../db/sqlite';
import { 
  formatMoney, 
  toPersianDigits, 
  PERSIAN_MONTH_NAMES 
} from '../utils/dateUtils';

interface PayrollComprehensiveReportModalProps {
  isOpen: boolean;
  employees?: PayrollEmployee[];
  initialYear?: number;
  year?: number;
  initialMonth?: number;
  month?: number;
  onClose: () => void;
}

const roundUp50k = (val: number): number => {
  if (val <= 0) return 0;
  const rem = val % 50000;
  if (rem === 0) return val;
  return val + (50000 - rem);
};

export const PayrollComprehensiveReportModal: React.FC<PayrollComprehensiveReportModalProps> = ({
  isOpen,
  employees: passedEmployees,
  initialYear,
  year,
  initialMonth,
  month,
  onClose
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(initialYear || year || 1404);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth || month || 0); // 0 = all year, 1..12 = specific month
  const [loading, setLoading] = useState(true);
  const [reportRows, setReportRows] = useState<any[]>([]);
  const [localEmployees, setLocalEmployees] = useState<PayrollEmployee[]>(passedEmployees || []);

  useEffect(() => {
    if (!passedEmployees || passedEmployees.length === 0) {
      getAllPayrollEmployees().then(emps => setLocalEmployees(emps));
    } else {
      setLocalEmployees(passedEmployees);
    }
  }, [passedEmployees]);

  useEffect(() => {
    let isMounted = true;
    const fetchReport = async () => {
      setLoading(true);
      try {
        const { records, payments } = await getAllPayrollYearData(selectedYear, selectedMonth > 0 ? selectedMonth : undefined);
        
        // محاسبه وضعیت هر کارمند
        const rows = await Promise.all(localEmployees.map(async (emp) => {
          if (selectedMonth > 0) {
            // گزارش یک ماه خاص
            const { currentRecord: cur, accumulatedPrevBalance } = 
              await getPayrollMonthlyRecord(emp.id, selectedYear, selectedMonth);

            const prevBal = accumulatedPrevBalance;
            const baseSalary = cur ? cur.base_salary_rial : 0;
            const otDays = cur ? cur.overtime_days : 0;
            const otAmount = baseSalary > 0 ? roundUp50k((baseSalary / 30) * Math.round(otDays)) : 0;
            const grossEarnings = baseSalary + otAmount;

            const empPays = cur 
              ? payments.filter(p => p.record_id === cur.id).reduce((sum, p) => sum + p.amount_rial, 0)
              : 0;

            const finalBalance = (prevBal + grossEarnings) - empPays;

            return {
              emp,
              baseSalary,
              otDays,
              otAmount,
              grossEarnings,
              payments: empPays,
              prevBal,
              finalBalance
            };
          } else {
            // کل سال برای این کارمند
            const { accumulatedPrevBalance: startYearCarryover } = 
              await getPayrollMonthlyRecord(emp.id, selectedYear, 1);

            const empRecords = records.filter(r => r.employee_id === emp.id);
            const empRecIds = new Set(empRecords.map(r => r.id));
            const empPays = payments.filter(p => empRecIds.has(p.record_id)).reduce((sum, p) => sum + p.amount_rial, 0);

            const baseSalary = empRecords.reduce((sum, r) => sum + r.base_salary_rial, 0);
            const otDays = empRecords.reduce((sum, r) => sum + r.overtime_days, 0);
            const otAmount = empRecords.reduce((sum, r) => {
              if (r.base_salary_rial > 0 && r.overtime_days > 0) {
                return sum + roundUp50k((r.base_salary_rial / 30) * Math.round(r.overtime_days));
              }
              return sum;
            }, 0);
            const grossEarnings = baseSalary + otAmount;
            const prevBal = startYearCarryover;
            const finalBalance = (prevBal + grossEarnings) - empPays;

            return {
              emp,
              baseSalary,
              otDays,
              otAmount,
              grossEarnings,
              payments: empPays,
              prevBal,
              finalBalance
            };
          }
        }));

        if (isMounted) {
          setReportRows(rows);
          setLoading(false);
        }
      } catch (e) {
        console.error('Error fetching comprehensive report:', e);
        if (isMounted) setLoading(false);
      }
    };

    fetchReport();
    return () => { isMounted = false; };
  }, [localEmployees, selectedYear, selectedMonth]);

  const totals = useMemo(() => {
    const sumBase = reportRows.reduce((sum, r) => sum + r.baseSalary, 0);
    const sumOt = reportRows.reduce((sum, r) => sum + r.otAmount, 0);
    const sumGross = reportRows.reduce((sum, r) => sum + r.grossEarnings, 0);
    const sumPays = reportRows.reduce((sum, r) => sum + r.payments, 0);
    const sumFinal = reportRows.reduce((sum, r) => sum + r.finalBalance, 0);

    return { sumBase, sumOt, sumGross, sumPays, sumFinal };
  }, [reportRows]);

  const handlePrint = () => {
    const content = document.getElementById('printable-comprehensive-report');
    if (!content) {
      window.print();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(el => el.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
        <head>
          <meta charset="utf-8" />
          <title>گزارش جامع حقوق پرسنل - سال ${toPersianDigits(selectedYear)}</title>
          ${styles}
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm;
            }
            body {
              background: #fff !important;
              color: #0f172a !important;
              font-family: 'Vazirmatn', sans-serif !important;
              margin: 0 !important;
              padding: 0 !important;
              direction: rtl !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            * {
              font-family: 'Vazirmatn', sans-serif !important;
            }
            .print-container {
              width: 100% !important;
              box-sizing: border-box !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
            }
            th, td {
              border: 1px solid #94a3b8 !important;
            }
          </style>
        </head>
        <body>
          <div class="print-container space-y-4">
            ${content.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 250);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 md:p-6">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* نوار سربرگ */}
        <div className="shrink-0 flex items-center justify-between p-4 md:p-5 border-b border-slate-200 bg-slate-50/90">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-extrabold text-slate-900">
              گزارش جامع و مقایسه‌ای حقوق پرسنل
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ گزارش</span>
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* فیلتر دوره محاسباتی */}
        <div className="shrink-0 p-4 border-b border-slate-200 bg-white flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>سال مالی:</span>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {[1401, 1402, 1403, 1404, 1405, 1406, 1407].map(y => (
                <option key={y} value={y}>{toPersianDigits(y)}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Filter className="w-4 h-4 text-slate-500" />
            <span>ماه انتخابی:</span>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={0}>کل سال (مجموع ۱۲ ماه)</option>
              {PERSIAN_MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* محتوای قابل چاپ و اسکرول */}
        <div id="printable-comprehensive-report" className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          <div className="text-center pb-4 border-b border-slate-300">
            <h1 className="text-lg font-black text-slate-900">گزارش وضعیت حقوق و کارکرد کلیه پرسنل</h1>
            <div className="text-xs font-bold text-slate-700 mt-1">
              دوره: {selectedMonth > 0 ? `${PERSIAN_MONTH_NAMES[selectedMonth - 1]} ماه ` : 'مجموع ۱۲ ماهه '} سال مالی {toPersianDigits(selectedYear)}
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 font-bold">
              در حال استخراج و تحلیل محاسبات کلیه پرسنل...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-center border text-xs border-slate-300">
                <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                  <tr>
                    <th className="py-2.5 px-3 border border-slate-300 w-12 text-center">ردیف</th>
                    <th className="py-2.5 px-3 border border-slate-300 w-20 text-center">کد پرسنلی</th>
                    <th className="py-2.5 px-3 border border-slate-300 w-44 text-center">نام و نام خانوادگی</th>
                    <th className="py-2.5 px-3 border border-slate-300 w-36 text-center">حقوق پایه (ریال)</th>
                    <th className="py-2.5 px-3 border border-slate-300 w-24 text-center">اضافه‌کاری</th>
                    <th className="py-2.5 px-3 border border-slate-300 w-36 text-center">مبلغ اضافه‌کاری</th>
                    <th className="py-2.5 px-3 border border-slate-300 w-36 text-center">دریافتی‌ها / مساعده</th>
                    <th className="py-2.5 px-3 border border-slate-300 w-40 text-center">مانده نهایی (ریال)</th>
                    <th className="py-2.5 px-3 border border-slate-300 w-24 text-center">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((r, idx) => {
                    const isPositive = r.finalBalance > 0;
                    const isNegative = r.finalBalance < 0;
                    return (
                      <tr key={r.emp.id} className="hover:bg-slate-50/80">
                        <td className="py-2 px-3 border border-slate-300 font-mono text-center text-slate-800">
                          {toPersianDigits(idx + 1)}
                        </td>
                        <td className="py-2 px-3 border border-slate-300 font-mono text-center text-slate-800">
                          {toPersianDigits(r.emp.code || '-')}
                        </td>
                        <td className="py-2 px-3 border border-slate-300 font-bold text-center text-slate-900">
                          {r.emp.name}
                        </td>
                        <td className="py-2 px-3 border border-slate-300 font-mono text-center text-slate-800">
                          {r.baseSalary > 0 ? formatMoney(r.baseSalary) : '-'}
                        </td>
                        <td className="py-2 px-3 border border-slate-300 font-mono text-center text-slate-800">
                          {r.otDays > 0 ? `${toPersianDigits(r.otDays)} روز` : '-'}
                        </td>
                        <td className="py-2 px-3 border border-slate-300 font-mono text-center text-slate-800">
                          {r.otAmount > 0 ? formatMoney(r.otAmount) : '-'}
                        </td>
                        <td className="py-2 px-3 border border-slate-300 font-mono font-bold text-center text-amber-800">
                          {r.payments > 0 ? formatMoney(r.payments) : '-'}
                        </td>
                        <td className={`py-2 px-3 border border-slate-300 font-mono font-extrabold text-center ${
                          isPositive ? 'text-emerald-700' : isNegative ? 'text-rose-700' : 'text-slate-600'
                        }`}>
                          {formatMoney(Math.abs(r.finalBalance))}
                        </td>
                        <td className="py-2 px-3 border border-slate-300 text-center text-[11px] font-bold">
                          {isPositive ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">طلبکار</span>
                          ) : isNegative ? (
                            <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">بدهکار</span>
                          ) : (
                            <span className="text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">تسویه</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-400">
                  <tr>
                    <td colSpan={3} className="py-2.5 px-3 border border-slate-300 text-center font-bold text-slate-900">
                      جمع کل
                    </td>
                    <td className="py-2.5 px-3 border border-slate-300 font-mono font-black text-center text-slate-900">
                      {formatMoney(totals.sumBase)}
                    </td>
                    <td className="py-2.5 px-3 border border-slate-300 text-center text-slate-400">-</td>
                    <td className="py-2.5 px-3 border border-slate-300 font-mono font-black text-center text-slate-900">
                      {formatMoney(totals.sumOt)}
                    </td>
                    <td className="py-2.5 px-3 border border-slate-300 font-mono font-black text-center text-amber-900">
                      {formatMoney(totals.sumPays)}
                    </td>
                    <td className={`py-2.5 px-3 border border-slate-300 font-mono font-black text-center ${
                      totals.sumFinal >= 0 ? 'text-emerald-800' : 'text-rose-800'
                    }`}>
                      {formatMoney(Math.abs(totals.sumFinal))}
                    </td>
                    <td className="py-2.5 px-3 border border-slate-300 text-center text-[11px] font-bold text-slate-700">
                      {totals.sumFinal > 0 ? 'طلبکار نهایی' : totals.sumFinal < 0 ? 'بدهکار نهایی' : 'تسویه کامل'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
