import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Scale, 
  TrendingUp, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Clock, 
  Printer, 
  Upload, 
  X, 
  Coins, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Users, 
  FileText,
  RefreshCw 
} from 'lucide-react';
import { syncWalletTransactions } from '../services/walletSync';
import type { EquityPartner, EquityTransaction } from '../db/types';
import { 
  getAllEquityPartners, 
  createEquityPartner, 
  updateEquityPartner, 
  deleteEquityPartner, 
  getAllEquityTransactions, 
  createEquityTransaction, 
  updateEquityTransaction, 
  deleteEquityTransaction, 
  getEquityCurrentPrice, 
  setEquityCurrentPrice,
  healEquityPartnership,
  clearAllEquityData
} from '../db/sqlite';
import { 
  formatMoney, 
  toPersianDigits, 
  separateThousands, 
  parseAmount, 
  getCurrentShamsi,
  formatShamsiWithSlash 
} from '../utils/dateUtils';
import { AmountInput } from './AmountInput';
import { ShamsiDateInput } from './ShamsiDateInput';

export const EquityTab: React.FC = () => {
  const [partners, setPartners] = useState<EquityPartner[]>([]);
  const [transactions, setTransactions] = useState<EquityTransaction[]>([]);
  const [curPrice, setCurPrice] = useState<number>(0);

  const [activeSubTab, setActiveSubTab] = useState<'all' | 'pending' | 'partners'>('all');
  const [selectedPartnerFilter, setSelectedPartnerFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [txStartDate, setTxStartDate] = useState('');
  const [txEndDate, setTxEndDate] = useState('');

  // Modals
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<EquityTransaction | null>(null);

  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<EquityPartner | null>(null);

  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [tempPriceInput, setTempPriceInput] = useState('');

  const [reportPartner, setReportPartner] = useState<EquityPartner | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      await healEquityPartnership();
      const [pList, txList, price] = await Promise.all([
        getAllEquityPartners(),
        getAllEquityTransactions(),
        getEquityCurrentPrice()
      ]);
      setPartners(pList);
      setTransactions(txList);
      setCurPrice(price);
    } catch (e) {
      console.error('Failed to load equity data:', e);
    }
  };

  const [isSyncingWallet, setIsSyncingWallet] = useState(false);

  const handleSyncWithWallet = async () => {
    try {
      setIsSyncingWallet(true);
      const res = await syncWalletTransactions();
      if (res.success) {
        await loadData();
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

  useEffect(() => {
    loadData();
  }, []);

  // آخرین قیمت شمش ثبت‌شده در تراکنش‌ها به عنوان قیمت پیش‌فرض سیستم
  const latestTxPrice = useMemo(() => {
    const txsWithPrice = transactions.filter(t => t.price_rial_per_kg > 0);
    if (txsWithPrice.length === 0) return 0;
    const sorted = [...txsWithPrice].sort((a, b) => {
      const da = a.jdate.replace(/\D/g, '');
      const db = b.jdate.replace(/\D/g, '');
      if (da !== db) return db.localeCompare(da);
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
    return sorted[0].price_rial_per_kg;
  }, [transactions]);

  // اگر نرخ شمش در تنظیمات ثبت نشده باشد، به طور خودکار از آخرین نرخ تراکنش‌ها استفاده می‌شود
  const effectiveCurPrice = curPrice > 0 ? curPrice : latestTxPrice;

  // محاسبات سهم و مانده وزنی شرکا
  const partnerStats = useMemo(() => {
    const map: Record<string, { inWeight: number; outWeight: number; netWeight: number; inRial: number; outRial: number }> = {};
    partners.forEach(p => {
      map[p.id] = { inWeight: 0, outWeight: 0, netWeight: 0, inRial: 0, outRial: 0 };
    });

    transactions.forEach(t => {
      if (map[t.partner_id]) {
        if (t.kind === 'IN') {
          map[t.partner_id].inRial += t.amount_rial;
          if (t.status === 'confirmed') {
            map[t.partner_id].inWeight += t.weight_kg;
          }
        } else {
          map[t.partner_id].outRial += t.amount_rial;
          if (t.status === 'confirmed') {
            map[t.partner_id].outWeight += t.weight_kg;
          }
        }
      }
    });

    let totalWeightAll = 0;
    let totalInRialAll = 0;
    let totalOutRialAll = 0;

    Object.keys(map).forEach(pId => {
      map[pId].netWeight = map[pId].inWeight - map[pId].outWeight;
      totalWeightAll += map[pId].netWeight;
      totalInRialAll += map[pId].inRial;
      totalOutRialAll += map[pId].outRial;
    });

    return {
      partnerMap: map,
      totalWeight: totalWeightAll,
      totalInRial: totalInRialAll,
      totalOutRial: totalOutRialAll,
      totalCurrentValue: totalWeightAll * effectiveCurPrice
    };
  }, [partners, transactions, effectiveCurPrice]);

  const pendingCount = useMemo(() => {
    return transactions.filter(t => t.status === 'pending' || t.price_rial_per_kg === 0).length;
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const cleanStart = txStartDate.replace(/\D/g, '');
    const cleanEnd = txEndDate.replace(/\D/g, '');

    return transactions.filter(t => {
      if (activeSubTab === 'pending' && t.status !== 'pending' && t.price_rial_per_kg > 0) return false;
      if (selectedPartnerFilter !== 'all' && t.partner_id !== selectedPartnerFilter) return false;

      const d = (t.jdate || '').replace(/\D/g, '');
      if (cleanStart && d < cleanStart) return false;
      if (cleanEnd && d > cleanEnd) return false;

      if (searchTerm) {
        const q = searchTerm.trim().toLowerCase();
        const pName = t.partner_name || '';
        const desc = t.description || '';
        const match = pName.toLowerCase().includes(q) || desc.toLowerCase().includes(q) || t.jdate.includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [transactions, activeSubTab, selectedPartnerFilter, searchTerm, txStartDate, txEndDate]);

  const handleOpenNewTx = () => {
    setEditingTx(null);
    setIsTxModalOpen(true);
  };

  const handleEditTx = (tx: EquityTransaction) => {
    setEditingTx(tx);
    setIsTxModalOpen(true);
  };

  const handleDeleteTx = async (id: string) => {
    if (window.confirm('آیا از حذف این تراکنش سرمایه اطمینان دارید؟')) {
      await deleteEquityTransaction(id);
      await loadData();
    }
  };

  const handleOpenPartnerModal = (p?: EquityPartner) => {
    setEditingPartner(p || null);
    setIsPartnerModalOpen(true);
  };

  const handleDeletePartner = async (p: EquityPartner) => {
    const hasTxs = transactions.some(t => t.partner_id === p.id);
    if (hasTxs) {
      alert(`شریک «${p.name}» دارای تراکنش ثبت‌شده است و ابتدا باید تراکنش‌های ایشان را حذف یا منتقل نمایید.`);
      return;
    }
    if (window.confirm(`آیا از حذف شریک «${p.name}» اطمینان دارید؟`)) {
      await deleteEquityPartner(p.id);
      await loadData();
    }
  };

  const handleSavePrice = async () => {
    const raw = parseAmount(tempPriceInput);
    if (raw > 0) {
      await setEquityCurrentPrice(raw);
      setCurPrice(raw);
      setIsPriceModalOpen(false);
    }
  };

  const handleOpenReport = (p: EquityPartner) => {
    setReportPartner(p);
    const now = getCurrentShamsi();
    const m = String(now.jm).padStart(2, '0');
    const startOfMonth = `${now.jy}/${m}/01`;
    setReportStartDate(startOfMonth);
    setReportEndDate(now.formatted);
    setIsReportModalOpen(true);
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.partners && !parsed.txs) {
        alert('فایل انتخاب‌شده ساختار پشتیبان معتبر حساب سرمایه‌گذاران را ندارد.');
        return;
      }
      if (window.confirm(`این فایل شامل ${toPersianDigits(parsed.partners?.length || 0)} شریک و ${toPersianDigits(parsed.txs?.length || 0)} تراکنش است. آیا مایل به ایمپورت هستید؟`)) {
        const wipe = window.confirm('آیا تراکنش‌های قبلی سرمایه پیش از ایمپورت پاک شوند تا از تکراری شدن جلوگیری شود؟ (پیشنهاد می‌شود: تایید)');
        if (wipe) {
          await clearAllEquityData();
        }
        for (const p of (parsed.partners || [])) {
          await createEquityPartner({ id: p.id, name: p.name, color: p.color, note: p.note });
        }
        for (const t of (parsed.txs || [])) {
          await createEquityTransaction({
            partner_id: t.p,
            kind: t.k === 'OUT' ? 'OUT' : 'IN',
            amount_rial: Number(t.a) || 0,
            price_rial_per_kg: Number(t.pr) || 0,
            weight_kg: Number(t.pr) > 0 ? (Number(t.a) / Number(t.pr)) : 0,
            jdate: t.d || '',
            description: t.t || '',
            status: t.s || 'confirmed'
          });
        }
        if (parsed.curPrice) {
          await setEquityCurrentPrice(Number(parsed.curPrice));
        }
        await healEquityPartnership();
        alert('ایمپورت اطلاعات با موفقیت انجام شد.');
        await loadData();
      }
    } catch (err: any) {
      alert('خطا در خواندن فایل: ' + err.message);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* سربرگ عملیاتی */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/70 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">حساب سرمایه‌گذاران و سهم وزنی شمش</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                محاسبه ارزش سرمایه بر مبنای کیلوگرم شمش آلومینیوم و تفکیک سهم شرکا
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportJsonFile} 
            accept=".json" 
            className="hidden" 
          />
          <button
            onClick={handleSyncWithWallet}
            disabled={isSyncingWallet}
            className="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl px-3 py-2 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="دریافت تراکنش‌های جدید شرکا از کیف پول آنلاین"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isSyncingWallet ? 'animate-spin' : ''}`} />
            <span>{isSyncingWallet ? 'در حال دریافت...' : 'همگام‌سازی کیف پول'}</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-semibold transition-all flex items-center gap-1.5"
            title="ایمپورت سوابق از فایل JSON"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>ایمپورت پشتیبان</span>
          </button>

          <button
            onClick={() => {
              setTempPriceInput(separateThousands(effectiveCurPrice));
              setIsPriceModalOpen(true);
            }}
            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl px-3 py-2 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Coins className="w-4 h-4 text-amber-600" />
            <span>نرخ شمش: {effectiveCurPrice > 0 ? `${formatMoney(effectiveCurPrice)} ریال` : 'تعیین نشده'}</span>
          </button>

          <button
            onClick={() => handleOpenPartnerModal()}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Users className="w-4 h-4 text-slate-600" />
            <span>تعریف شریک</span>
          </button>

          <button
            onClick={handleOpenNewTx}
            className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl px-4 py-2 text-xs font-bold shadow-xs hover:shadow transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>تراکنش جدید سرمایه</span>
          </button>
        </div>
      </div>

      {/* کارت‌های شاخص KPI چهارگانه */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* مانده کل وزنی شمش */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">موجودی کل وزنی شمش</span>
            <div className="text-xl font-extrabold text-slate-900 font-mono">
              {toPersianDigits(partnerStats.totalWeight.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}{' '}
              <span className="text-xs font-normal text-slate-400">کیلوگرم</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
            <Scale className="w-6 h-6" />
          </div>
        </div>

        {/* ارزش روز کل سرمایه به ریال */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">ارزش روز کل سرمایه</span>
            <div className="text-xl font-extrabold text-emerald-600 font-mono">
              {formatMoney(partnerStats.totalCurrentValue)}{' '}
              <span className="text-xs font-normal text-slate-400">ریال</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* مجموع واریزها */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">مجموع واریزهای پولی</span>
            <div className="text-xl font-extrabold text-sky-600 font-mono">
              {formatMoney(partnerStats.totalInRial)}{' '}
              <span className="text-xs font-normal text-slate-400">ریال</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        {/* مجموع برداشت‌ها */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">مجموع برداشت‌های پولی</span>
            <div className="text-xl font-extrabold text-rose-600 font-mono">
              {formatMoney(partnerStats.totalOutRial)}{' '}
              <span className="text-xs font-normal text-slate-400">ریال</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* کارت‌های تفکیک سهم شرکا */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">سهم و مانده سرمایه‌گذاران</h3>
          </div>
          <span className="text-xs text-slate-400">محاسبه درصدی از کل وزن تأییدشده</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {partners.map(p => {
            const stat = partnerStats.partnerMap[p.id] || { netWeight: 0, inRial: 0, outRial: 0 };
            const pct = partnerStats.totalWeight > 0 ? (stat.netWeight / partnerStats.totalWeight) * 100 : 0;
            const rialVal = stat.netWeight * effectiveCurPrice;

            return (
              <div 
                key={p.id}
                className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70 hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: p.color || '#4ade80' }} />
                      <span className="font-extrabold text-slate-900 text-sm">{p.name}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-700 font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {toPersianDigits(pct.toFixed(2))}%
                    </span>
                  </div>

                  {/* نوار سهم */}
                  <div className="w-full bg-slate-200 rounded-full h-2 mb-3 overflow-hidden">
                    <div 
                      className="h-2 rounded-full transition-all duration-500" 
                      style={{ 
                        width: `${Math.max(0, Math.min(100, pct))}%`, 
                        backgroundColor: p.color || '#4ade80' 
                      }} 
                    />
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>مانده وزنی:</span>
                      <span className="font-bold text-slate-900 font-mono">
                        {toPersianDigits(stat.netWeight.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))} کیلوگرم
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>ارزش روز ریالی:</span>
                      <span className="font-bold text-emerald-700 font-mono">
                        {formatMoney(rialVal)} ریال
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenReport(p)}
                    className="text-xs text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1 bg-sky-50 hover:bg-sky-100 px-2.5 py-1.5 rounded-lg transition-all"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>صورت‌حساب ۴بخشی</span>
                  </button>
                  <button
                    onClick={() => handleOpenPartnerModal(p)}
                    className="text-xs text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-200/60"
                    title="ویرایش مشخصات"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* تب‌های جدول تراکنش‌ها و ابزارها */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* نوار تب و فیلتر */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === 'all'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              تمام تراکنش‌ها ({toPersianDigits(transactions.length)})
            </button>
            <button
              onClick={() => setActiveSubTab('pending')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>در انتظار قیمت ({toPersianDigits(pendingCount)})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('partners')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === 'partners'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              مدیریت شرکا ({toPersianDigits(partners.length)})
            </button>
          </div>

          {activeSubTab !== 'partners' && (
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              {/* فیلتر شریک */}
              <select
                value={selectedPartnerFilter}
                onChange={e => setSelectedPartnerFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="all">همه شرکا</option>
                {partners.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              {/* فیلتر بازه تاریخ تراکنش‌ها */}
              <div className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1">
                <span className="text-slate-500 font-bold text-[11px]">از:</span>
                <div className="w-28">
                  <ShamsiDateInput
                    value={txStartDate}
                    onChange={setTxStartDate}
                    placeholder="همه"
                  />
                </div>
                <span className="text-slate-500 font-bold text-[11px]">تا:</span>
                <div className="w-28">
                  <ShamsiDateInput
                    value={txEndDate}
                    onChange={setTxEndDate}
                    placeholder="همه"
                  />
                </div>
                {(txStartDate || txEndDate) && (
                  <button
                    onClick={() => { setTxStartDate(''); setTxEndDate(''); }}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                    title="حذف فیلتر تاریخ"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* کادر جستجو */}
              <div className="relative flex-1 md:w-56">
                <input
                  type="text"
                  placeholder="جستجو در شرح..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
              </div>
            </div>
          )}
        </div>

        {/* محتوای تب مدیریت شرکا */}
        {activeSubTab === 'partners' ? (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs font-extrabold text-slate-800">لیست شرکا و رنگ اختصاصی</h4>
              <button
                onClick={() => handleOpenPartnerModal()}
                className="bg-sky-50 text-sky-700 hover:bg-sky-100 font-bold text-xs px-3 py-1.5 rounded-xl border border-sky-200 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن شریک جدید</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {partners.map(p => (
                <div key={p.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: p.color || '#4ade80' }} />
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{p.name}</div>
                      {p.note && <div className="text-[11px] text-slate-400 mt-0.5">{p.note}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenPartnerModal(p)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200"
                      title="ویرایش"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePartner(p)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* جدول تراکنش‌ها */
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="bg-slate-100/70 text-slate-600 text-[11px] font-extrabold border-b border-slate-200">
                  <th className="py-3 px-3">ردیف</th>
                  <th className="py-3 px-3">تاریخ</th>
                  <th className="py-3 px-3">سرمایه‌گذار</th>
                  <th className="py-3 px-3">نوع</th>
                  <th className="py-3 px-3">مبلغ ریالی</th>
                  <th className="py-3 px-3">نرخ هر کیلو (ریال)</th>
                  <th className="py-3 px-3">وزن شمش (کیلوگرم)</th>
                  <th className="py-3 px-3">شرح</th>
                  <th className="py-3 px-3">وضعیت</th>
                  <th className="py-3 px-3">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-slate-400 text-center font-medium">
                      هیچ تراکنشی یافت نشد.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx, idx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-400">{toPersianDigits(idx + 1)}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{formatShamsiWithSlash(tx.jdate)}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">{tx.partner_name || '-'}</td>
                      <td className="py-2.5 px-3">
                        {tx.kind === 'IN' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/60">
                            واریز
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60">
                            برداشت
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-extrabold text-slate-900">
                        {formatMoney(tx.amount_rial)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {tx.price_rial_per_kg > 0 ? formatMoney(tx.price_rial_per_kg) : (
                          <span className="text-amber-600 font-bold">تعیین‌نشده</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-extrabold text-amber-700">
                        {tx.weight_kg > 0 ? toPersianDigits(tx.weight_kg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '۰'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-right max-w-xs truncate" title={tx.description || ''}>
                        {tx.description || '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        {tx.status === 'confirmed' && tx.price_rial_per_kg > 0 ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            تأییدشده
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            در انتظار قیمت
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEditTx(tx)}
                            className="p-1 text-slate-500 hover:text-sky-600 rounded hover:bg-slate-100"
                            title="ویرایش"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTx(tx.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* مودال ثبت / ویرایش تراکنش سرمایه */}
      {isTxModalOpen && (
        <TransactionModal
          isOpen={isTxModalOpen}
          tx={editingTx}
          partners={partners}
          defaultPrice={effectiveCurPrice}
          onClose={() => setIsTxModalOpen(false)}
          onSuccess={async () => {
            setIsTxModalOpen(false);
            await loadData();
          }}
        />
      )}

      {/* مودال ایجاد / ویرایش شریک */}
      {isPartnerModalOpen && (
        <PartnerModal
          isOpen={isPartnerModalOpen}
          partner={editingPartner}
          onClose={() => setIsPartnerModalOpen(false)}
          onSuccess={async () => {
            setIsPartnerModalOpen(false);
            await loadData();
          }}
        />
      )}

      {/* مودال بروزرسانی نرخ شمش آلومینیوم */}
      {isPriceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-extrabold text-slate-900">بروزرسانی نرخ روز شمش آلومینیوم</h3>
              <button onClick={() => setIsPriceModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  نرخ هر کیلوگرم شمش آلومینیوم (ریال):
                </label>
                <AmountInput
                  value={tempPriceInput}
                  onChange={(fmt) => setTempPriceInput(fmt)}
                  placeholder="مثلاً ۴,۵۰۰,۰۰۰"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-500">
                این نرخ به عنوان مبنای ارزش‌گذاری روز کل سرمایه و نرخ پیش‌فرض برای تراکنش‌های جدید اعمال خواهد شد.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPriceModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSavePrice}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors"
              >
                ذخیره نرخ جدید
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال صورت‌حساب ۴بخشی با چاپ تمیز */}
      {isReportModalOpen && reportPartner && (
        <EquityReportModal
          isOpen={isReportModalOpen}
          partner={reportPartner}
          allTransactions={transactions}
          curPrice={effectiveCurPrice}
          startDate={reportStartDate}
          endDate={reportEndDate}
          onStartDateChange={setReportStartDate}
          onEndDateChange={setReportEndDate}
          onClose={() => setIsReportModalOpen(false)}
        />
      )}
    </div>
  );
};

// =========================================================================
// کامپوننت مودال ثبت / ویرایش تراکنش
// =========================================================================
interface TxModalProps {
  isOpen: boolean;
  tx: EquityTransaction | null;
  partners: EquityPartner[];
  defaultPrice: number;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const TransactionModal: React.FC<TxModalProps> = ({
  tx,
  partners,
  defaultPrice,
  onClose,
  onSuccess
}) => {
  const [partnerId, setPartnerId] = useState(tx ? tx.partner_id : partners[0]?.id || '');
  const [kind, setKind] = useState<'IN' | 'OUT'>(tx ? tx.kind : 'IN');
  const [amountStr, setAmountStr] = useState(tx ? separateThousands(tx.amount_rial) : '');
  const [priceStr, setPriceStr] = useState(tx ? separateThousands(tx.price_rial_per_kg) : separateThousands(defaultPrice));
  const [jdate, setJdate] = useState(tx ? tx.jdate : () => {
    const cur = getCurrentShamsi();
    return `${cur.jy}${String(cur.jm).padStart(2, '0')}${String(cur.jd).padStart(2, '0')}`;
  });
  const [description, setDescription] = useState(tx ? tx.description || '' : '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rawAmount = parseAmount(amountStr);
  const rawPrice = parseAmount(priceStr);
  const calcWeight = rawPrice > 0 ? rawAmount / rawPrice : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerId) {
      alert('لطفاً سرمایه‌گذار را انتخاب کنید.');
      return;
    }
    if (rawAmount <= 0) {
      alert('لطفاً مبلغ معتبر وارد کنید.');
      return;
    }
    const cleanDate = jdate.replace(/\D/g, '');
    if (cleanDate.length !== 8) {
      alert('لطفاً تاریخ ۸ رقمی معتبر مانند 14050701 وارد فرمایید.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (tx) {
        await updateEquityTransaction(tx.id, {
          partner_id: partnerId,
          kind,
          amount_rial: rawAmount,
          price_rial_per_kg: rawPrice,
          jdate: cleanDate,
          description,
          status: rawPrice > 0 ? 'confirmed' : 'pending'
        });
      } else {
        await createEquityTransaction({
          partner_id: partnerId,
          kind,
          amount_rial: rawAmount,
          price_rial_per_kg: rawPrice,
          weight_kg: calcWeight,
          jdate: cleanDate,
          description,
          status: rawPrice > 0 ? 'confirmed' : 'pending'
        });
      }
      await onSuccess();
    } catch (err: any) {
      alert('خطا در ثبت: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <h3 className="text-sm font-extrabold text-slate-900">
            {tx ? 'ویرایش تراکنش سرمایه' : 'ثبت تراکنش جدید سرمایه‌گذار'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">سرمایه‌گذار:</label>
              <select
                value={partnerId}
                onChange={e => setPartnerId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {partners.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">نوع رویداد:</label>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setKind('IN')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    kind === 'IN' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  واریز
                </button>
                <button
                  type="button"
                  onClick={() => setKind('OUT')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    kind === 'OUT' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  برداشت
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">مبلغ به ریال:</label>
              <AmountInput
                value={amountStr}
                onChange={(fmt) => setAmountStr(fmt)}
                placeholder="مبلغ ریالی..."
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">نرخ هر کیلوگرم شمش (ریال):</label>
              <AmountInput
                value={priceStr}
                onChange={(fmt) => setPriceStr(fmt)}
                placeholder="نرخ شمش..."
              />
            </div>
          </div>

          {/* پیش‌نمایش وزن محاسبه‌شده */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex items-center justify-between text-xs">
            <span className="font-bold text-amber-900">وزن متناظر شمش آلومینیوم:</span>
            <span className="font-mono font-extrabold text-amber-800 text-sm">
              {calcWeight > 0 ? toPersianDigits(calcWeight.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '۰'}{' '}
              کیلوگرم
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">تاریخ تراکنش:</label>
              <ShamsiDateInput
                value={jdate}
                onChange={setJdate}
                placeholder="مثال: ۱۴۰۵/۰۱/۰۱"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">توضیحات (اختیاری):</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="شرح و بابت..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
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
              className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors"
            >
              {isSubmitting ? 'در حال ذخیره...' : 'ذخیره تراکنش'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// کامپوننت مودال تعریف / ویرایش شریک
// =========================================================================
interface PartnerModalProps {
  isOpen: boolean;
  partner: EquityPartner | null;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const PartnerModal: React.FC<PartnerModalProps> = ({
  partner,
  onClose,
  onSuccess
}) => {
  const [name, setName] = useState(partner ? partner.name : '');
  const [color, setColor] = useState(partner ? partner.color : '#4ade80');
  const [note, setNote] = useState(partner ? partner.note || '' : '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const colors = ['#4ade80', '#f472b6', '#38bdf8', '#fbbf24', '#a78bfa', '#f87171', '#34d399', '#818cf8'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('لطفاً نام سرمایه‌گذار را وارد کنید.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (partner) {
        await updateEquityPartner(partner.id, { name, color, note });
      } else {
        await createEquityPartner({ name, color, note });
      }
      await onSuccess();
    } catch (err: any) {
      alert('خطا در ذخیره شریک: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <h3 className="text-sm font-extrabold text-slate-900">
            {partner ? 'ویرایش مشخصات شریک' : 'تعریف سرمایه‌گذار جدید'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">نام سرمایه‌گذار:</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="مثلاً: مزینانی یا سلطانی"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">رنگ اختصاصی در نمودارها:</label>
            <div className="flex items-center gap-2 flex-wrap">
              {colors.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${
                    color === c ? 'ring-3 ring-sky-500 scale-110 shadow-xs' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">یادداشت:</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="توضیحات اختیاری..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
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
              className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors"
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
// کامپوننت مودال صورت‌حساب ۴بخشی با استایل چاپی دقیق
// =========================================================================
interface ReportModalProps {
  isOpen: boolean;
  partner: EquityPartner;
  allTransactions: EquityTransaction[];
  curPrice: number;
  startDate: string;
  endDate: string;
  onStartDateChange: (d: string) => void;
  onEndDateChange: (d: string) => void;
  onClose: () => void;
}

const EquityReportModal: React.FC<ReportModalProps> = ({
  partner,
  allTransactions,
  curPrice,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClose
}) => {
  const cleanStart = startDate.replace(/\D/g, '');
  const cleanEnd = endDate.replace(/\D/g, '');

  const reportData = useMemo(() => {
    const pTxs = allTransactions.filter(t => t.partner_id === partner.id);

    // ۱ و ۲: فقط تراکنش‌های داخل بازه
    const inRangeTxs = pTxs.filter(t => {
      const d = t.jdate.replace(/\D/g, '');
      if (cleanStart && d < cleanStart) return false;
      if (cleanEnd && d > cleanEnd) return false;
      return true;
    });

    const inTxs = inRangeTxs.filter(t => t.kind === 'IN');
    const outTxs = inRangeTxs.filter(t => t.kind === 'OUT');

    const sumInRial = inTxs.reduce((sum, t) => sum + t.amount_rial, 0);
    const sumOutRial = outTxs.reduce((sum, t) => sum + t.amount_rial, 0);

    // ۳: مانده وزنی کل از روز اول تا پایان بازه (تاریخ شروع نادیده گرفته می‌شود)
    const cumulativeTxs = pTxs.filter(t => {
      const d = t.jdate.replace(/\D/g, '');
      if (cleanEnd && d > cleanEnd) return false;
      return t.status === 'confirmed';
    });

    const sortedCumulativeTxs = [...cumulativeTxs].sort((a, b) => {
      const da = a.jdate.replace(/\D/g, '');
      const db = b.jdate.replace(/\D/g, '');
      if (da !== db) return da.localeCompare(db);
      return (a.created_at || '').localeCompare(b.created_at || '');
    });

    const cumInWeight = cumulativeTxs.filter(t => t.kind === 'IN').reduce((sum, t) => sum + t.weight_kg, 0);
    const cumOutWeight = cumulativeTxs.filter(t => t.kind === 'OUT').reduce((sum, t) => sum + t.weight_kg, 0);
    const netWeight = cumInWeight - cumOutWeight;

    // آخرین قیمت شمش آخرین تراکنش ثبت شده تا تاریخ درخواست گزارش
    const txsWithPrice = sortedCumulativeTxs.filter(t => t.price_rial_per_kg > 0);
    const latestTxWithPrice = txsWithPrice.length > 0 ? txsWithPrice[txsWithPrice.length - 1] : null;
    const latestPrice = latestTxWithPrice ? latestTxWithPrice.price_rial_per_kg : (curPrice > 0 ? curPrice : 0);
    const latestPriceDate = latestTxWithPrice ? latestTxWithPrice.jdate : null;

    const lastTx = sortedCumulativeTxs.length > 0 ? sortedCumulativeTxs[sortedCumulativeTxs.length - 1] : null;
    const lastTxDate = lastTx ? lastTx.jdate : null;

    // ۴: مانده ریالی = مانده وزنی از ابتدای دوره تا آخرین تراکنش * آخرین قیمت شمش آخرین تراکنش
    const finalRialValue = netWeight * latestPrice;

    return {
      inTxs,
      outTxs,
      sumInRial,
      sumOutRial,
      netWeight,
      latestPrice,
      latestPriceDate,
      lastTxDate,
      finalRialValue
    };
  }, [allTransactions, partner.id, cleanStart, cleanEnd, curPrice]);

  const handlePrint = () => {
    const content = document.getElementById('printable-equity-report');
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
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    // کپی تمام استایل‌ها، فونت وزیرمتن و تیلویند به آی‌فریم اختصاصی پرینت
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(el => el.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
        <head>
          <meta charset="utf-8" />
          <title>${partner.name}</title>
          ${styles}
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm;
            }
            html, body {
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: 'Vazirmatn', -apple-system, sans-serif !important;
              margin: 0 !important;
              padding: 0 !important;
              direction: rtl !important;
              text-align: right !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            * {
              font-family: 'Vazirmatn', -apple-system, sans-serif !important;
            }
            .print-wrapper {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              padding: 8px !important;
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
          <div class="print-wrapper space-y-6">
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 md:p-6">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* نوار کنترل بالا - پین شده در سربرگ */}
        <div className="shrink-0 flex items-center justify-between p-4 md:p-5 border-b border-slate-200 bg-slate-50/90">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-600" />
            <h3 className="text-base font-extrabold text-slate-900">
              صورت‌حساب ۴بخشی سهم سرمایه‌گذار: {partner.name}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl px-4 py-2 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ / ذخیره PDF</span>
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* فیلتر بازه تاریخ - پین شده زیر سربرگ */}
        <div className="no-print shrink-0 p-4 border-b border-slate-200 bg-white flex flex-wrap items-center gap-4 print:hidden">
          <span className="text-xs font-bold text-slate-700">بازه محاسباتی گزارش:</span>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-slate-500 font-bold">از تاریخ:</label>
            <div className="w-36">
              <ShamsiDateInput
                value={startDate}
                onChange={onStartDateChange}
                placeholder="مثال: ۱۴۰۲/۰۱/۰۱"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-slate-500 font-bold">تا تاریخ:</label>
            <div className="w-36">
              <ShamsiDateInput
                value={endDate}
                onChange={onEndDateChange}
                placeholder="مثال: ۱۴۰۵/۰۱/۰۱"
              />
            </div>
          </div>
        </div>

        {/* برگه قابل چاپ و اسکرول‌پذیر داخل مودال */}
        <div id="printable-equity-report" className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 print:overflow-visible print:p-0 print:space-y-4 print:max-w-full print:w-full">
          <div className="text-center pb-4 border-b border-slate-300 print:border-slate-400">
            <h1 className="text-lg font-black text-slate-900">گزارش وضعیت حساب {partner.name}</h1>
            <div className="text-xs font-bold text-slate-700 mt-1">
              بازه گزارش: {formatShamsiWithSlash(startDate)} الی {formatShamsiWithSlash(endDate)}
            </div>
          </div>

          {/* بخش ۱: واریزها */}
          <div>
            <div className="flex items-center mb-2">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-600" />
                بخش ۱: واریزها
              </h4>
            </div>
            <table className="w-full text-center border text-xs border-slate-300 print:border-slate-400">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300 print:border-slate-400">
                <tr>
                  <th className="py-2.5 px-3 border border-slate-300 print:border-slate-400 w-16 text-center">ردیف</th>
                  <th className="py-2.5 px-3 border border-slate-300 print:border-slate-400 w-28 text-center">تاریخ</th>
                  <th className="py-2.5 px-3 border border-slate-300 print:border-slate-400 w-44 text-center">مبلغ (ریال)</th>
                  <th className="py-2.5 px-3 border border-slate-300 print:border-slate-400 text-center">توضیحات</th>
                </tr>
              </thead>
              <tbody>
                {reportData.inTxs.length === 0 ? (
                  <tr><td colSpan={4} className="py-3 text-slate-500 font-medium text-center">واردی در این بازه ثبت نشده است.</td></tr>
                ) : (
                  reportData.inTxs.map((t, i) => (
                    <tr key={t.id} className="hover:bg-slate-50/80">
                      <td className="py-2 px-3 border border-slate-300 print:border-slate-400 font-mono text-center text-slate-900">{toPersianDigits(i + 1)}</td>
                      <td className="py-2 px-3 border border-slate-300 print:border-slate-400 font-mono text-center text-slate-900">{formatShamsiWithSlash(t.jdate)}</td>
                      <td className="py-2 px-3 border border-slate-300 print:border-slate-400 font-mono font-bold text-center text-sky-800">{formatMoney(t.amount_rial)}</td>
                      <td className="py-2 px-3 border border-slate-300 print:border-slate-400 text-center text-slate-900 font-medium">{t.description || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-400">
                <tr>
                  <td colSpan={2} className="py-2.5 px-3 border border-slate-300 print:border-slate-400 text-center font-bold text-slate-900">
                    جمع کل
                  </td>
                  <td className="py-2.5 px-3 border border-slate-300 print:border-slate-400 font-mono font-black text-center text-sky-900">
                    {formatMoney(reportData.sumInRial)}
                  </td>
                  <td className="py-2.5 px-3 border border-slate-300 print:border-slate-400 text-center text-slate-700 font-bold">
                    ریال
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* بخش ۲: برداشت‌ها */}
          <div>
            <div className="flex items-center mb-2">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                بخش ۲: برداشت‌ها
              </h4>
            </div>
            <table className="w-full text-center border text-xs border-slate-300 print:border-slate-400">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300 print:border-slate-400">
                <tr>
                  <th className="py-2.5 px-3 border border-slate-300 print:border-slate-400 w-16 text-center">ردیف</th>
                  <th className="py-2.5 px-3 border border-slate-300 print:border-slate-400 w-28 text-center">تاریخ</th>
                  <th className="py-2.5 px-3 border border-slate-300 print:border-slate-400 w-44 text-center">مبلغ (ریال)</th>
                  <th className="py-2.5 px-3 border border-slate-300 print:border-slate-400 text-center">توضیحات</th>
                </tr>
              </thead>
              <tbody>
                {reportData.outTxs.length === 0 ? (
                  <tr><td colSpan={4} className="py-3 text-slate-500 font-medium text-center">برداشتی در این بازه ثبت نشده است.</td></tr>
                ) : (
                  reportData.outTxs.map((t, i) => (
                    <tr key={t.id} className="hover:bg-slate-50/80">
                      <td className="py-2 px-3 border border-slate-300 print:border-slate-400 font-mono text-center text-slate-900">{toPersianDigits(i + 1)}</td>
                      <td className="py-2 px-3 border border-slate-300 print:border-slate-400 font-mono text-center text-slate-900">{formatShamsiWithSlash(t.jdate)}</td>
                      <td className="py-2 px-3 border border-slate-300 print:border-slate-400 font-mono font-bold text-center text-rose-800">{formatMoney(t.amount_rial)}</td>
                      <td className="py-2 px-3 border border-slate-300 print:border-slate-400 text-center text-slate-900 font-medium">{t.description || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-400">
                <tr>
                  <td colSpan={2} className="py-2.5 px-3 border border-slate-300 print:border-slate-400 text-center font-bold text-slate-900">
                    جمع کل
                  </td>
                  <td className="py-2.5 px-3 border border-slate-300 print:border-slate-400 font-mono font-black text-center text-rose-900">
                    {formatMoney(reportData.sumOutRial)}
                  </td>
                  <td className="py-2.5 px-3 border border-slate-300 print:border-slate-400 text-center text-slate-700 font-bold">
                    ریال
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* بخش ۳ و ۴: کادرهای برجسته مانده وزنی و ریالی */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="bg-amber-50/90 p-4 rounded-xl border border-slate-300 print:border-slate-400 text-center flex flex-col items-center justify-center">
              <span className="text-xs md:text-sm font-extrabold text-slate-800 block mb-2">
                مانده وزنی شمش
              </span>
              <div className="text-lg md:text-xl font-black text-slate-900 font-mono">
                {toPersianDigits(reportData.netWeight.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}{' '}
                <span className="text-xs md:text-sm font-bold text-slate-700">کیلوگرم</span>
              </div>
            </div>

            <div className="bg-emerald-50/90 p-4 rounded-xl border border-slate-300 print:border-slate-400 text-center flex flex-col items-center justify-center">
              <span className="text-xs md:text-sm font-extrabold text-slate-800 block mb-2">
                ارزش ریالی سرمایه
              </span>
              <div className="text-lg md:text-xl font-black text-slate-900 font-mono">
                {formatMoney(reportData.finalRialValue)}{' '}
                <span className="text-xs md:text-sm font-bold text-slate-700">ریال</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
