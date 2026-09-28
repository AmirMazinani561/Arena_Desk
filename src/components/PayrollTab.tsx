import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Printer, 
  Clock, 
  DollarSign, 
  Coins,
  Calendar,
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw
} from 'lucide-react';
import { syncWalletTransactions } from '../services/walletSync';
import type { PayrollEmployee, PayrollRecord, PayrollPayment } from '../db/types';
import { 
  getAllPayrollEmployees, 
  createPayrollEmployee, 
  updatePayrollEmployee, 
  deletePayrollEmployee, 
  getPayrollMonthlyRecord, 
  savePayrollMonthlyRecord, 
  getPayrollPayments, 
  createPayrollPayment, 
  updatePayrollPayment, 
  deletePayrollPayment 
} from '../db/sqlite';
import { PayrollAnnualReportModal } from './PayrollAnnualReportModal';
import { PayrollComprehensiveReportModal } from './PayrollComprehensiveReportModal';
import { 
  formatMoney, 
  toPersianDigits, 
  separateThousands, 
  parseAmount, 
  getCurrentShamsi, 
  PERSIAN_MONTH_NAMES,
  formatShamsiWithSlash
} from '../utils/dateUtils';
import { AmountInput } from './AmountInput';
import { ShamsiDateInput } from './ShamsiDateInput';

const PAYMENT_TYPES = ['پول نقد', 'حواله حساب', 'شارژ و اینترنت', 'خرید', 'در انتظار'];

// گرد کردن رو به بالا به مضارب ۵۰,۰۰۰ ریال (مطابق با فرمول رسمی نرم‌افزار)
const roundUp50k = (val: number): number => {
  if (val <= 0) return 0;
  const rem = val % 50000;
  if (rem === 0) return val;
  return val + (50000 - rem);
};

export const PayrollTab: React.FC = () => {
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  // سال و ماه فعال
  const nowShamsi = getCurrentShamsi();
  const [year, setYear] = useState<number>(nowShamsi.jy);
  const [month, setMonth] = useState<number>(nowShamsi.jm);

  // داده‌های پرونده ماهانه کارمند انتخابی
  const [currentRecord, setCurrentRecord] = useState<PayrollRecord | null>(null);
  const [accumulatedPrevBal, setAccumulatedPrevBal] = useState<number>(0);
  const [payments, setPayments] = useState<PayrollPayment[]>([]);

  // ورودی‌های حقوق و اضافه‌کاری
  const [baseSalaryInput, setBaseSalaryInput] = useState<string>('');
  const [overtimeDaysInput, setOvertimeDaysInput] = useState<string>('');
  const [isSavingRecord, setIsSavingRecord] = useState(false);

  // ورودی ثبت پرداخت جدید
  const [newPayDate, setNewPayDate] = useState<string>('');
  const [newPayAmount, setNewPayAmount] = useState<string>('');
  const [newPayType, setNewPayType] = useState<string>(PAYMENT_TYPES[0]);
  const [newPayDesc, setNewPayDesc] = useState<string>('');
  const [isAddingPayment, setIsAddingPayment] = useState(false);

  // ویرایش اینلاین پرداختی
  const [editingPayId, setEditingPayId] = useState<string | null>(null);
  const [editPayDate, setEditPayDate] = useState<string>('');
  const [editPayAmount, setEditPayAmount] = useState<string>('');
  const [editPayType, setEditPayType] = useState<string>('');
  const [editPayDesc, setEditPayDesc] = useState<string>('');

  // مودال‌ها
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<PayrollEmployee | null>(null);
  const [isPrintSlipOpen, setIsPrintSlipOpen] = useState(false);
  const [isAnnualReportOpen, setIsAnnualReportOpen] = useState(false);
  const [isComprehensiveReportOpen, setIsComprehensiveReportOpen] = useState(false);
  const [isSyncingWallet, setIsSyncingWallet] = useState(false);

  const handleSyncWithWallet = async () => {
    try {
      setIsSyncingWallet(true);
      const res = await syncWalletTransactions();
      if (res.success) {
        await loadEmployees();
        await loadMonthlyData();
        alert(res.message || 'همگام‌سازی با موفقیت انجام شد.');
      } else {
        alert(res.message || 'خطا در همگام‌سازی با کیف پول.');
      }
    } catch (e: any) {
      alert('خطا در ارتباط با سرور کیف پول: ' + (e?.message || 'نامشخص'));
    } finally {
      setIsSyncingWallet(false);
    }
  };

  const payrollFileInputRef = useRef<HTMLInputElement>(null);

  const handleImportPayrollFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let importedEmps = 0;
      let importedRecords = 0;
      let importedPayments = 0;

      if (file.name.endsWith('.csv') || (!text.trim().startsWith('{') && !text.trim().startsWith('['))) {
        // Parse CSV format: نام,کد,شماره تماس,شماره کارت
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        for (const line of lines) {
          const parts = line.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
          if (parts[0] && parts[0] !== 'نام' && parts[0] !== 'name') {
            await createPayrollEmployee({
              name: parts[0],
              code: parts[1] || '',
              phone: parts[2] || '',
              bank_card: parts[3] || ''
            });
            importedEmps++;
          }
        }
      } else {
        // Parse JSON format
        const data = JSON.parse(text);
        const empList = Array.isArray(data) ? data : (data.employees || data.payroll_employees || []);
        const recList = data.records || data.monthly_records || data.payroll_monthly_records || [];
        const payList = data.payments || data.payroll_payments || [];

        const empIdMap = new Map<string, string>();
        for (const emp of empList) {
          const created = await createPayrollEmployee({
            name: emp.name,
            code: emp.code,
            phone: emp.phone,
            bank_card: emp.bank_card || emp.bankCard
          });
          if (emp.id) empIdMap.set(emp.id, created.id);
          importedEmps++;
        }

        const recIdMap = new Map<string, string>();
        for (const r of recList) {
          const targetEmpId = empIdMap.get(r.employee_id) || r.employee_id;
          const created = await savePayrollMonthlyRecord({
            employee_id: targetEmpId,
            year: Number(r.year) || year,
            month: Number(r.month) || month,
            base_salary_rial: Number(r.base_salary_rial) || 0,
            overtime_days: Number(r.overtime_days) || 0
          });
          if (r.id) recIdMap.set(r.id, created.id);
          importedRecords++;
        }

        for (const p of payList) {
          const targetRecId = recIdMap.get(p.record_id) || p.record_id;
          if (targetRecId) {
            await createPayrollPayment({
              record_id: targetRecId,
              payment_date: (p.payment_date || '').replace(/\D/g, ''),
              amount_rial: Number(p.amount_rial) || 0,
              payment_type: p.payment_type || 'پول نقد',
              description: p.description || ''
            });
            importedPayments++;
          }
        }
      }

      alert(`ایمپورت با موفقیت انجام شد: ${toPersianDigits(importedEmps)} کارمند، ${toPersianDigits(importedRecords)} پرونده ماهانه و ${toPersianDigits(importedPayments)} پرداخت.`);
      await loadEmployees();
    } catch (err: any) {
      alert('خطا در بارگذاری فایل: ' + err.message);
    }
    if (payrollFileInputRef.current) payrollFileInputRef.current.value = '';
  };

  const handleDownloadSampleJson = () => {
    const sample = {
      employees: [
        { name: "علی رضایی", code: "101", phone: "09121111111", bank_card: "603799..." },
        { name: "محمد محمدی", code: "102", phone: "09122222222", bank_card: "589210..." }
      ],
      records: [
        { employee_id: "101", year: 1404, month: 7, base_salary_rial: 120000000, overtime_days: 2.5 }
      ],
      payments: [
        { record_id: "101", payment_date: "14040715", amount_rial: 30000000, payment_type: "حواله حساب", description: "مساعده نیمه ماه" }
      ]
    };
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payroll_template_sample.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // بارگذاری اولیه لیست کارمندان
  const loadEmployees = async () => {
    try {
      const list = await getAllPayrollEmployees();
      setEmployees(list);
      if (list.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(list[0].id);
      }
    } catch (e) {
      console.error('Failed to load employees:', e);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  // بارگذاری پرونده ماهانه و پرداختی‌های کارمند فعال
  const loadMonthlyData = async () => {
    if (!selectedEmployeeId) return;
    try {
      const { currentRecord: cur, accumulatedPrevBalance } = 
        await getPayrollMonthlyRecord(selectedEmployeeId, year, month);
      
      setCurrentRecord(cur);
      setAccumulatedPrevBal(accumulatedPrevBalance);

      setBaseSalaryInput(cur ? separateThousands(cur.base_salary_rial) : '');
      setOvertimeDaysInput(cur ? String(cur.overtime_days) : '0');

      if (cur?.id) {
        const payList = await getPayrollPayments(cur.id);
        setPayments(payList);
      } else {
        setPayments([]);
      }
    } catch (e) {
      console.error('Failed to load monthly payroll data:', e);
    }
  };

  useEffect(() => {
    loadMonthlyData();
  }, [selectedEmployeeId, year, month]);

  // کارمند فعال
  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  // محاسبات هوشمند مالی حقوق ماه
  const calculated = useMemo(() => {
    // ۱. مانده منتقل‌شده واقعی از ماه‌های قبل (انباشته کل سوابق قبل از ماه جاری)
    const prevBal = accumulatedPrevBal;

    // ۲. حقوق و اضافه‌کاری این ماه
    const cSal = parseAmount(baseSalaryInput) || 0;
    const otDays = parseFloat(overtimeDaysInput.replace(/[^\d.]/g, '')) || 0;
    const cOtAmt = roundUp50k((cSal / 30) * Math.round(otDays));

    // ۳. جمع کل پرداختی‌های این ماه
    const cPays = payments.reduce((sum, p) => sum + p.amount_rial, 0);

    // ۴. مانده نهایی طلب کارمند در پایان ماه
    const finalBalance = (prevBal + cSal + cOtAmt) - cPays;

    return {
      prevBal,
      cSal,
      cOtAmt,
      otDays,
      cPays,
      finalBalance
    };
  }, [accumulatedPrevBal, baseSalaryInput, overtimeDaysInput, payments]);

  // ذخیره اطلاعات حقوق پایه و اضافه‌کاری
  const handleSaveRecord = async () => {
    if (!selectedEmployeeId) return;
    setIsSavingRecord(true);
    try {
      const rawSalary = parseAmount(baseSalaryInput);
      const rawOt = parseFloat(overtimeDaysInput.replace(/[^\d.]/g, '')) || 0;
      const saved = await savePayrollMonthlyRecord({
        employee_id: selectedEmployeeId,
        year,
        month,
        base_salary_rial: rawSalary,
        overtime_days: rawOt
      });
      setCurrentRecord(saved);
      // بروزرسانی تاریخ پیش‌فرض پرداخت جدید
      if (!newPayDate) {
        setNewPayDate(`${year}${String(month).padStart(2, '0')}15`);
      }
    } catch (e: any) {
      alert('خطا در ذخیره کارکرد ماهانه: ' + e.message);
    } finally {
      setIsSavingRecord(false);
    }
  };

  // افزودن پرداختی جدید
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRecord?.id) {
      alert('ابتدا باید حقوق پایه را ذخیره کنید تا پرونده این ماه ایجاد شود.');
      return;
    }
    const cleanD = newPayDate.replace(/\D/g, '');
    const cleanAmt = parseAmount(newPayAmount);
    if (!cleanD || cleanAmt <= 0) {
      alert('لطفاً تاریخ و مبلغ معتبر وارد فرمایید.');
      return;
    }

    setIsAddingPayment(true);
    try {
      await createPayrollPayment({
        record_id: currentRecord.id,
        payment_date: cleanD,
        amount_rial: cleanAmt,
        payment_type: newPayType,
        description: newPayDesc
      });
      setNewPayAmount('');
      setNewPayDesc('');
      await loadMonthlyData();
    } catch (err: any) {
      alert('خطا در ثبت پرداخت: ' + err.message);
    } finally {
      setIsAddingPayment(false);
    }
  };

  // شروع ویرایش اینلاین
  const startEditPay = (p: PayrollPayment) => {
    setEditingPayId(p.id);
    setEditPayDate(p.payment_date);
    setEditPayAmount(separateThousands(p.amount_rial));
    setEditPayType(p.payment_type);
    setEditPayDesc(p.description || '');
  };

  // ذخیره ویرایش اینلاین
  const saveEditPay = async (id: string) => {
    const cleanD = editPayDate.replace(/\D/g, '');
    const cleanAmt = parseAmount(editPayAmount);
    if (!cleanD || cleanAmt <= 0) {
      alert('لطفاً تاریخ و مبلغ معتبر وارد فرمایید.');
      return;
    }
    try {
      await updatePayrollPayment(id, {
        payment_date: cleanD,
        amount_rial: cleanAmt,
        payment_type: editPayType,
        description: editPayDesc
      });
      setEditingPayId(null);
      await loadMonthlyData();
    } catch (err: any) {
      alert('خطا در ذخیره ویرایش: ' + err.message);
    }
  };

  // حذف پرداختی
  const handleDeletePay = async (id: string) => {
    if (window.confirm('آیا از حذف این پرداختی اطمینان دارید؟')) {
      await deletePayrollPayment(id);
      await loadMonthlyData();
    }
  };

  // حذف پرسنل
  const handleDeleteEmployee = async (emp: PayrollEmployee) => {
    if (window.confirm(`آیا از حذف پرسنل «${emp.name}» اطمینان دارید؟ تمامی سوابق حقوقی ایشان نیز حذف خواهد شد.`)) {
      await deletePayrollEmployee(emp.id);
      const remaining = employees.filter(e => e.id !== emp.id);
      setEmployees(remaining);
      if (remaining.length > 0) {
        setSelectedEmployeeId(remaining[0].id);
      } else {
        setSelectedEmployeeId('');
      }
    }
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'پول نقد': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'حواله حساب': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'شارژ و اینترنت': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'خرید': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'در انتظار': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* سربرگ ماژول حقوق و دستمزد */}
      <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/70 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">حقوق و دستمزد پرسنل</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              مدیریت کارکرد، اضافه‌کاری، ریز مساعده‌ها، کارنامه سالانه و گزارشات جامع
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* انتخاب سال و ماه */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-300">
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {[1403, 1404, 1405, 1406, 1407].map(y => (
                <option key={y} value={y}>{toPersianDigits(y)}</option>
              ))}
            </select>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {PERSIAN_MONTH_NAMES.map((mName, idx) => (
                <option key={idx + 1} value={idx + 1}>{mName}</option>
              ))}
            </select>
          </div>

          <input 
            type="file" 
            ref={payrollFileInputRef} 
            onChange={handleImportPayrollFile} 
            accept=".json,.csv" 
            className="hidden" 
          />
          <button
            onClick={handleSyncWithWallet}
            disabled={isSyncingWallet}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-xl px-3 py-2 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="دریافت پرداختی‌های جدید پرسنل از کیف پول آنلاین"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isSyncingWallet ? 'animate-spin' : ''}`} />
            <span>{isSyncingWallet ? 'در حال دریافت...' : 'همگام‌سازی کیف پول'}</span>
          </button>

          <button
            onClick={() => payrollFileInputRef.current?.click()}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold transition-all flex items-center gap-1.5"
            title="ایمپورت پرسنل و سوابق از فایل JSON یا CSV"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>ایمپورت</span>
          </button>

          <button
            onClick={handleDownloadSampleJson}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all flex items-center gap-1"
            title="دانلود فایل نمونه جهت وارد کردن اطلاعات پرسنل"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>قالب</span>
          </button>

          <button
            onClick={() => setIsComprehensiveReportOpen(true)}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl px-3 py-2 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
            title="گزارش تجمیعی ماهانه و سالانه کلیه پرسنل"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>گزارش جامع پرسنل</span>
          </button>

          <button
            onClick={() => {
              setEditingEmployee(null);
              setIsEmployeeModalOpen(true);
            }}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>تعریف کارمند</span>
          </button>

          {selectedEmployee && (
            <>
              <button
                onClick={() => setIsAnnualReportOpen(true)}
                className="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-300 rounded-xl px-3 py-2 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                title="مشاهده کارنامه ۱۲ ماهه کارمند انتخابی"
              >
                <FileText className="w-4 h-4 text-sky-600" />
                <span>کارنامه سالانه {selectedEmployee.name}</span>
              </button>

              <button
                onClick={() => setIsPrintSlipOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-3.5 py-2 text-xs font-bold shadow-xs hover:shadow transition-all flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>فیش حقوقی ماه</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ناحیه انتخاب پرسنل (تگ‌های افقی سریع) */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-300 shadow-xs flex items-center gap-2 overflow-x-auto">
        <span className="text-xs font-bold text-slate-600 shrink-0 ml-2">انتخاب پرسنل:</span>
        {employees.length === 0 ? (
          <span className="text-xs text-slate-400">هنوز کارمندی ثبت نشده است. لطفاً از دکمه «تعریف کارمند» استفاده کنید.</span>
        ) : (
          employees.map(emp => (
            <div key={emp.id} className="flex items-center shrink-0">
              <button
                onClick={() => setSelectedEmployeeId(emp.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border ${
                  selectedEmployeeId === emp.id
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-2 ring-indigo-200'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                <span>{emp.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  selectedEmployeeId === emp.id ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {toPersianDigits(emp.code)}
                </span>
              </button>
            </div>
          ))
        )}
      </div>

      {selectedEmployee && (
        <>
          {/* کادرهای شاخص مالی کارکرد ماه */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* ۱. مانده ماه قبل */}
            <div className="bg-white rounded-2xl p-4 border border-slate-300 shadow-xs flex items-center justify-between min-h-[110px]">
              <div className="flex flex-col justify-between h-full">
                <span className="text-xs font-bold text-slate-500 block mb-1">مانده منتقل‌شده از ماه قبل</span>
                <div className={`text-lg font-extrabold font-mono ${calculated.prevBal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatMoney(Math.abs(calculated.prevBal))}{' '}
                  <span className="text-xs font-normal text-slate-400">ریال</span>
                  <span className="text-[11px] font-bold mr-1">
                    {calculated.prevBal > 0 ? '(طلب)' : calculated.prevBal < 0 ? '(بدهی)' : '(تسویه)'}
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
            </div>

            {/* ۲. حقوق ماه */}
            <div className="bg-white rounded-2xl p-4 border border-slate-300 shadow-xs flex items-center justify-between min-h-[110px]">
              <div className="flex flex-col justify-between h-full">
                <span className="text-xs font-bold text-slate-500 block mb-1">
                  حقوق ماه {PERSIAN_MONTH_NAMES[month - 1]}
                </span>
                <div className="text-lg font-extrabold text-slate-900 font-mono">
                  {formatMoney(calculated.cSal)}{' '}
                  <span className="text-xs font-normal text-slate-400">ریال</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            {/* ۳. اضافه‌کاری ماه */}
            <div className="bg-white rounded-2xl p-4 border border-slate-300 shadow-xs flex items-center justify-between min-h-[110px]">
              <div className="flex flex-col justify-between h-full">
                <span className="text-xs font-bold text-slate-500 block mb-1">
                  اضافه‌کاری {PERSIAN_MONTH_NAMES[month - 1]}
                </span>
                <div className="text-lg font-extrabold text-sky-700 font-mono">
                  {formatMoney(calculated.cOtAmt)}{' '}
                  <span className="text-xs font-normal text-slate-400">ریال</span>
                </div>
                {calculated.otDays > 0 ? (
                  <div className="text-[11px] font-bold text-slate-500 mt-1">
                    کارکرد: <span className="font-mono text-sky-600">{toPersianDigits(calculated.otDays)}</span> روز
                  </div>
                ) : (
                  <div className="text-[11px] font-normal text-slate-400 mt-1">
                    بدون اضافه‌کاری
                  </div>
                )}
              </div>
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            {/* ۴. جمع پرداختی‌های این ماه */}
            <div className="bg-white rounded-2xl p-4 border border-slate-300 shadow-xs flex items-center justify-between min-h-[110px]">
              <div className="flex flex-col justify-between h-full">
                <span className="text-xs font-bold text-slate-500 block mb-1">مجموع مبالغ دریافتی ماه</span>
                <div className="text-lg font-extrabold text-amber-600 font-mono">
                  {formatMoney(calculated.cPays)}{' '}
                  <span className="text-xs font-normal text-slate-400">ریال</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                <Coins className="w-6 h-6" />
              </div>
            </div>

            {/* ۵. مانده نهایی تسویه در پایان ماه */}
            <div className="bg-white rounded-2xl p-4 border border-slate-300 shadow-xs flex items-center justify-between min-h-[110px]">
              <div className="flex flex-col justify-between h-full">
                <span className="text-xs font-bold text-slate-500 block mb-1">مانده نهایی پایان ماه</span>
                <div className={`text-lg font-extrabold font-mono ${calculated.finalBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatMoney(Math.abs(calculated.finalBalance))}{' '}
                  <span className="text-xs font-normal text-slate-400">ریال</span>
                  <span className="text-[11px] font-bold mr-1">
                    {calculated.finalBalance > 0 ? '(طلبکار)' : calculated.finalBalance < 0 ? '(بدهکار)' : '(تسویه کامل)'}
                  </span>
                </div>
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                calculated.finalBalance >= 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'
              }`}>
                <Check className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* پنل تنظیم حقوق پایه و اضافه‌کاری ماه */}
          <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
              <h3 className="text-xs font-extrabold text-slate-900">
                تنظیمات کارکرد ماهانه ({selectedEmployee.name} - {PERSIAN_MONTH_NAMES[month - 1]} {toPersianDigits(year)})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingEmployee(selectedEmployee);
                    setIsEmployeeModalOpen(true);
                  }}
                  className="text-xs text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-3 py-1.5 rounded-xl transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>ویرایش پرسنل</span>
                </button>
                <button
                  onClick={() => handleDeleteEmployee(selectedEmployee)}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف پرسنل</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">حقوق پایه ماهیانه (ریال):</label>
                <AmountInput
                  value={baseSalaryInput}
                  onChange={(fmt) => setBaseSalaryInput(fmt)}
                  placeholder="مثلاً: ۶۵,۰۰۰,۰۰۰"
                  className="!h-10 !bg-white !border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">تعداد روزهای اضافه‌کاری:</label>
                  {calculated.cOtAmt > 0 && (
                    <span className="text-[11px] text-indigo-600 font-bold font-mono">
                      ({formatMoney(calculated.cOtAmt)} ریال)
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="0.5"
                  value={overtimeDaysInput}
                  onChange={e => setOvertimeDaysInput(e.target.value)}
                  placeholder="مثلاً: ۳.۵"
                  className="w-full h-10 text-center font-bold bg-white border border-slate-300 rounded-xl px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <button
                  onClick={handleSaveRecord}
                  disabled={isSavingRecord}
                  className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingRecord ? 'در حال ذخیره...' : 'ذخیره کارکرد ماه'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* فرم و جدول ریز پرداختی‌ها و مساعده‌ها */}
          <div className="bg-white rounded-2xl border border-slate-300 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50">
              <h3 className="text-xs font-extrabold text-slate-900">
                ریز پرداختی‌ها، مساعده‌ها و خریدهای ماهانه ({toPersianDigits(payments.length)} ردیف)
              </h3>
            </div>

            {/* فرم ورود سریع پرداخت جدید */}
            <form onSubmit={handleAddPayment} className="p-4 bg-indigo-50/40 border-b border-indigo-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">تاریخ پرداخت:</label>
                <ShamsiDateInput
                  value={newPayDate}
                  onChange={setNewPayDate}
                  placeholder="مثال: ۱۴۰۵/۰۱/۱۵"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">نوع پرداخت:</label>
                <select
                  value={newPayType}
                  onChange={e => setNewPayType(e.target.value)}
                  className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {PAYMENT_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">مبلغ پرداختی (ریال):</label>
                <AmountInput
                  value={newPayAmount}
                  onChange={(fmt) => setNewPayAmount(fmt)}
                  placeholder="مبلغ پرداختی..."
                  className="!h-10 !bg-white !border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">شرح و توضیحات:</label>
                <input
                  type="text"
                  value={newPayDesc}
                  onChange={e => setNewPayDesc(e.target.value)}
                  placeholder="مساعده، خرید، شارژ..."
                  className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isAddingPayment}
                  className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAddingPayment ? 'در حال ثبت...' : 'ثبت پرداختی'}</span>
                </button>
              </div>
            </form>

            {/* جدول پرداختی‌ها با کادربندی کامل و خطوط مشخص */}
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-center border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-[11px] font-extrabold">
                    <th className="py-2.5 px-3 border border-slate-300 w-16">ردیف</th>
                    <th className="py-2.5 px-3 border border-slate-300 w-32">تاریخ</th>
                    <th className="py-2.5 px-3 border border-slate-300 w-32">نوع پرداخت</th>
                    <th className="py-2.5 px-3 border border-slate-300 text-right">شرح و بابت</th>
                    <th className="py-2.5 px-3 border border-slate-300 w-44">مبلغ (ریال)</th>
                    <th className="py-2.5 px-3 border border-slate-300 w-28">عملیات</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-slate-400 text-center font-medium border border-slate-300">
                        هیچ پرداختی در این ماه ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p, idx) => {
                      const isEditing = editingPayId === p.id;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 border border-slate-300 font-mono text-slate-500">{toPersianDigits(idx + 1)}</td>
                          <td className="py-2.5 px-3 border border-slate-300 font-mono text-slate-700">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editPayDate}
                                onChange={e => setEditPayDate(e.target.value)}
                                className="w-full text-center font-mono text-xs border border-indigo-400 rounded px-1.5 py-0.5"
                              />
                            ) : (
                              formatShamsiWithSlash(p.payment_date)
                            )}
                          </td>
                          <td className="py-2.5 px-3 border border-slate-300">
                            {isEditing ? (
                              <select
                                value={editPayType}
                                onChange={e => setEditPayType(e.target.value)}
                                className="w-full text-xs border border-indigo-400 rounded px-1 py-0.5"
                              >
                                {PAYMENT_TYPES.map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            ) : (
                              <span className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded-md border ${getBadgeStyle(p.payment_type)}`}>
                                {p.payment_type}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 border border-slate-300 text-slate-700 text-right">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editPayDesc}
                                onChange={e => setEditPayDesc(e.target.value)}
                                className="w-full text-right text-xs border border-indigo-400 rounded px-2 py-0.5"
                              />
                            ) : (
                              p.description || '-'
                            )}
                          </td>
                          <td className="py-2.5 px-3 border border-slate-300 font-mono font-extrabold text-slate-900">
                            {isEditing ? (
                              <AmountInput
                                value={editPayAmount}
                                onChange={(fmt) => setEditPayAmount(fmt)}
                              />
                            ) : (
                              formatMoney(p.amount_rial)
                            )}
                          </td>
                          <td className="py-2.5 px-3 border border-slate-300">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => saveEditPay(p.id)}
                                  className="p-1 text-emerald-600 hover:text-emerald-800 rounded hover:bg-emerald-50"
                                  title="ذخیره"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingPayId(null)}
                                  className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100"
                                  title="انصراف"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => startEditPay(p)}
                                  className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-100"
                                  title="ویرایش"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeletePay(p.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100"
                                  title="حذف"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {payments.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 font-extrabold text-slate-800">
                      <td colSpan={4} className="py-3 px-4 text-right text-xs border border-slate-300 font-bold">
                        جمع کل پرداختی‌های ماه:
                      </td>
                      <td className="py-3 px-3 font-mono text-sm text-indigo-700 border border-slate-300 font-black">
                        {formatMoney(calculated.cPays)} ریال
                      </td>
                      <td className="border border-slate-300" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {/* مودال تعریف / ویرایش کارمند */}
      {isEmployeeModalOpen && (
        <EmployeeModal
          isOpen={isEmployeeModalOpen}
          employee={editingEmployee}
          onClose={() => setIsEmployeeModalOpen(false)}
          onSuccess={async (emp) => {
            setIsEmployeeModalOpen(false);
            await loadEmployees();
            setSelectedEmployeeId(emp.id);
          }}
        />
      )}

      {/* مودال فیش چاپی ماهانه */}
      {isPrintSlipOpen && selectedEmployee && (
        <PaySlipModal
          isOpen={isPrintSlipOpen}
          employee={selectedEmployee}
          year={year}
          month={month}
          calculated={calculated}
          payments={payments}
          onClose={() => setIsPrintSlipOpen(false)}
        />
      )}

      {/* مودال کارنامه سالانه کارمند */}
      {isAnnualReportOpen && selectedEmployee && (
        <PayrollAnnualReportModal
          isOpen={isAnnualReportOpen}
          employee={selectedEmployee}
          year={year}
          onClose={() => setIsAnnualReportOpen(false)}
        />
      )}

      {/* مودال گزارش جامع کلیه پرسنل */}
      {isComprehensiveReportOpen && (
        <PayrollComprehensiveReportModal
          isOpen={isComprehensiveReportOpen}
          employees={employees}
          year={year}
          initialMonth={month}
          onClose={() => setIsComprehensiveReportOpen(false)}
        />
      )}
    </div>
  );
};

// =========================================================================
// کامپوننت مودال تعریف / ویرایش کارمند
// =========================================================================
interface EmployeeModalProps {
  isOpen: boolean;
  employee: PayrollEmployee | null;
  onClose: () => void;
  onSuccess: (emp: PayrollEmployee) => Promise<void>;
}

const EmployeeModal: React.FC<EmployeeModalProps> = ({
  employee,
  onClose,
  onSuccess
}) => {
  const [name, setName] = useState(employee ? employee.name : '');
  const [code, setCode] = useState(employee ? employee.code : '');
  const [phone, setPhone] = useState(employee ? employee.phone || '' : '');
  const [bankCard, setBankCard] = useState(employee ? employee.bank_card || '' : '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('لطفاً نام کارمند را وارد فرمایید.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (employee) {
        await updatePayrollEmployee(employee.id, { name, code, phone, bank_card: bankCard });
        await onSuccess({ ...employee, name, code, phone, bank_card: bankCard });
      } else {
        const emp = await createPayrollEmployee({ name, code, phone, bank_card: bankCard, is_active: 1 });
        await onSuccess(emp);
      }
    } catch (err: any) {
      alert('خطا در ذخیره کارمند: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <h3 className="text-sm font-extrabold text-slate-900">
            {employee ? 'ویرایش اطلاعات کارمند' : 'تعریف کارمند جدید'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">نام و نام خانوادگی:</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="مثلاً: علی رضایی"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">کد پرسنلی:</label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="مثلاً: 101"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">شماره تماس (اختیاری):</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="۰۹۱۲..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">شماره کارت یا شبا (اختیاری):</label>
            <input
              type="text"
              value={bankCard}
              onChange={e => setBankCard(e.target.value)}
              placeholder="شماره حساب جهت واریز..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
            >
              {isSubmitting ? 'در حال ثبت...' : 'ذخیره'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// کامپوننت مودال فیش حقوقی چاپی استاندارد
// =========================================================================
interface PaySlipProps {
  isOpen: boolean;
  employee: PayrollEmployee;
  year: number;
  month: number;
  calculated: any;
  payments: PayrollPayment[];
  onClose: () => void;
}

const PaySlipModal: React.FC<PaySlipProps> = ({
  employee,
  year,
  month,
  calculated,
  payments,
  onClose
}) => {
  const handlePrint = () => {
    const content = document.getElementById('printable-payslip');
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
          <title>فیش حقوقی ${employee.name} - ${PERSIAN_MONTH_NAMES[month - 1]} ${toPersianDigits(year)}</title>
          ${styles}
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm;
            }
            body {
              font-family: 'Vazirmatn', sans-serif !important;
              background: white !important;
              color: black !important;
              padding: 0;
              margin: 0;
            }
            table {
              border-collapse: collapse !important;
              width: 100% !important;
            }
            th, td {
              border: 1px solid #cbd5e1 !important;
            }
          </style>
        </head>
        <body class="bg-white p-4">
          <div class="space-y-4">
            ${content.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 300);
  };

  const formatD = (d: string) => {
    const c = (d || '').replace(/\D/g, '');
    if (c.length === 8) return `${c.slice(0, 4)}/${c.slice(4, 6)}/${c.slice(6, 8)}`;
    return d || '-';
  };

  // گروه‌بندی تراکنش‌ها بر اساس نوع پرداخت یکسان
  const groupedPayments = useMemo(() => {
    const groups: { [type: string]: PayrollPayment[] } = {};
    for (const p of payments) {
      const type = p.payment_type?.trim() || 'سایر پرداختی‌ها';
      if (!groups[type]) groups[type] = [];
      groups[type].push(p);
    }
    return groups;
  }, [payments]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-300 max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* نوار بالایی فیش حقوقی - پین‌شده و ثابت در بالای کادر */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-200 shrink-0 print:hidden bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-extrabold text-slate-900">
              پیش‌نمایش و چاپ فیش حقوقی ({employee.name})
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ فیش حقوقی</span>
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* محتوای برگه فیش چاپی - اسکرول‌پذیر داخل مودال */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5" id="printable-payslip">
          <div className="p-4 border-2 border-slate-300 rounded-xl space-y-4 text-xs bg-white">
            <div className="text-center pb-3 border-b-2 border-slate-200">
              <h1 className="text-base font-black text-slate-900">فیش حقوق و دستمزد پرسنل</h1>
              <div className="text-[11px] text-slate-600 mt-1">
                دوره: {PERSIAN_MONTH_NAMES[month - 1]} ماه سال {toPersianDigits(year)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>نام کارمند: <span className="font-extrabold text-slate-900">{employee.name}</span></div>
              <div>کد پرسنلی: <span className="font-mono font-bold text-slate-900">{toPersianDigits(employee.code)}</span></div>
              {employee.phone && <div>شماره تماس: <span className="font-mono">{toPersianDigits(employee.phone)}</span></div>}
              {employee.bank_card && <div>شماره حساب/کارت: <span className="font-mono">{toPersianDigits(employee.bank_card)}</span></div>}
            </div>

            {/* جدول کارکرد و مزایا */}
            <div className="space-y-1.5">
              <span className="font-bold text-xs text-slate-800 block">کارکرد، حقوق و مزایای دوره:</span>
              <table className="w-full text-center border border-slate-300 text-[11px]">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="py-2 border border-slate-300">حقوق پایه ماهیانه</th>
                    <th className="py-2 border border-slate-300">اضافه‌کاری (روز)</th>
                    <th className="py-2 border border-slate-300">مبلغ اضافه‌کاری</th>
                    <th className="py-2 border border-slate-300">مانده ماه قبل</th>
                    <th className="py-2 border border-slate-300">جمع کل استحقاقی</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2 border border-slate-300 font-mono font-bold">{formatMoney(calculated.cSal)}</td>
                    <td className="py-2 border border-slate-300 font-mono">{toPersianDigits(calculated.otDays)}</td>
                    <td className="py-2 border border-slate-300 font-mono">{formatMoney(calculated.cOtAmt)}</td>
                    <td className="py-2 border border-slate-300 font-mono">{formatMoney(calculated.prevBal)}</td>
                    <td className="py-2 border border-slate-300 font-mono font-extrabold bg-slate-50">
                      {formatMoney(calculated.prevBal + calculated.cSal + calculated.cOtAmt)} ریال
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* جداول تفکیک‌شده ریز مساعده‌ها و پرداختی‌ها بر اساس نوع یکسان */}
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="font-extrabold text-xs text-slate-900">
                  ریز مساعده‌ها و پرداختی‌های دوره (تفکیک‌شده بر اساس نوع پرداخت):
                </span>
                <span className="text-[11px] text-slate-500 font-bold">
                  کل تراکنش‌ها: {toPersianDigits(payments.length)} مورد
                </span>
              </div>

              {Object.keys(groupedPayments).length === 0 ? (
                <div className="p-3 text-center text-slate-400 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  هیچ پرداختی یا مساعده‌ای در این دوره ثبت نشده است.
                </div>
              ) : (
                Object.entries(groupedPayments).map(([type, list]) => {
                  const groupTotal = list.reduce((sum, item) => sum + (Number(item.amount_rial) || 0), 0);
                  return (
                    <div key={type} className="space-y-1.5">
                      <div className="flex items-center justify-between bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                        <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block"></span>
                          جدول پرداختی‌های «{type}»
                        </span>
                        <span className="text-[10px] text-slate-600 font-medium">
                          تعداد: <span className="font-mono font-bold text-slate-900">{toPersianDigits(list.length)}</span> فقره
                        </span>
                      </div>

                      <table className="w-full text-center border border-slate-300 text-[10px]">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="py-1 border border-slate-300 w-12">ردیف</th>
                            <th className="py-1 border border-slate-300 w-24">تاریخ</th>
                            <th className="py-1 border border-slate-300 w-24">نوع</th>
                            <th className="py-1 border border-slate-300 text-right px-2">شرح / توضیحات</th>
                            <th className="py-1 border border-slate-300 w-32">مبلغ (ریال)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((p, i) => (
                            <tr key={p.id}>
                              <td className="py-1 border border-slate-300 font-mono">{toPersianDigits(i + 1)}</td>
                              <td className="py-1 border border-slate-300 font-mono">{toPersianDigits(formatD(p.payment_date))}</td>
                              <td className="py-1 border border-slate-300">{p.payment_type}</td>
                              <td className="py-1 border border-slate-300 text-right px-2">{p.description || '-'}</td>
                              <td className="py-1 border border-slate-300 font-mono font-bold">{formatMoney(p.amount_rial)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100/80 font-bold">
                            <td colSpan={4} className="py-1.5 px-3 text-right">
                              جمع کل پرداختی‌های «{type}»:
                            </td>
                            <td className="py-1.5 border border-slate-300 font-mono font-extrabold text-slate-900">
                              {formatMoney(groupTotal)} ریال
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })
              )}

              {/* مجموع کل تمام پرداختی‌ها */}
              {payments.length > 0 && (
                <div className="bg-amber-50/70 p-2.5 rounded-lg border border-amber-300 flex items-center justify-between text-xs font-bold text-amber-950">
                  <span>مجموع کل دریافتی‌ها و مساعده‌های دوره ({toPersianDigits(payments.length)} مورد):</span>
                  <span className="font-mono text-sm font-extrabold text-amber-700">
                    {formatMoney(calculated.cPays)} ریال
                  </span>
                </div>
              )}
            </div>

            {/* نتیجه نهایی و امضا */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-300 flex items-center justify-between mt-4">
              <span className="font-bold text-xs">
                مانده نهایی تسویه‌نشده در پایان {PERSIAN_MONTH_NAMES[month - 1]}:
              </span>
              <span className={`text-sm font-extrabold font-mono ${calculated.finalBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatMoney(Math.abs(calculated.finalBalance))} ریال{' '}
                <span className="text-xs font-normal">
                  {calculated.finalBalance > 0 ? '(طلبکار)' : calculated.finalBalance < 0 ? '(بدهکار)' : '(تسویه کامل)'}
                </span>
              </span>
            </div>

            <div className="grid grid-cols-2 pt-8 text-center text-xs text-slate-600">
              <div>امضای کارمند: .................................</div>
              <div>امضا و مهر امور مالی: .................................</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
