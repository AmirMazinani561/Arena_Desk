import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  CheckCircle,
  Share2,
  AlertTriangle,
  CornerUpLeft,
  Trash2,
  Edit3,
  BookOpen,
  TrendingDown,
  TrendingUp,
  Clock,
  RefreshCw,
  Eye,
  RotateCcw
} from 'lucide-react';
import type { Cheque, Checkbook, Account } from '../db/types';
import {
  getAllCheques,
  getAllCheckbooks,
  deleteCheque,
  deleteCheckbook,
  revertChequeStatus
} from '../db/sqlite';
import { toPersianDigits, separateThousands } from '../utils/dateUtils';
import { ReceivedChequeModal } from './ReceivedChequeModal';
import { IssuedChequeModal } from './IssuedChequeModal';
import { CheckbookModal } from './CheckbookModal';
import { ChequeOperationModal, type ChequeOperationType } from './ChequeOperationModal';
import { CheckbookLeavesModal } from './CheckbookLeavesModal';

interface ChequesTabProps {
  allAccounts: Account[];
}

export const ChequesTab: React.FC<ChequesTabProps> = ({ allAccounts }) => {
  const [activeSubTab, setActiveSubTab] = useState<'received' | 'issued' | 'checkbooks'>('received');

  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [checkbooks, setCheckbooks] = useState<Checkbook[]>([]);
  const [loading, setLoading] = useState(false);

  const [isReceivedModalOpen, setIsReceivedModalOpen] = useState(false);
  const [chequeToEditReceived, setChequeToEditReceived] = useState<Cheque | null>(null);

  const [isIssuedModalOpen, setIsIssuedModalOpen] = useState(false);
  const [chequeToEditIssued, setChequeToEditIssued] = useState<Cheque | null>(null);
  const [targetLeafNumber, setTargetLeafNumber] = useState<number | undefined>(undefined);
  const [targetCheckbookId, setTargetCheckbookId] = useState<string | undefined>(undefined);

  const [isCheckbookModalOpen, setIsCheckbookModalOpen] = useState(false);
  const [checkbookToEdit, setCheckbookToEdit] = useState<Checkbook | null>(null);

  const [isOperationModalOpen, setIsOperationModalOpen] = useState(false);
  const [operationTargetCheque, setOperationTargetCheque] = useState<Cheque | null>(null);
  const [operationType, setOperationType] = useState<ChequeOperationType | null>(null);

  const [isLeavesModalOpen, setIsLeavesModalOpen] = useState(false);
  const [selectedCheckbookForLeaves, setSelectedCheckbookForLeaves] = useState<Checkbook | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [cbkBankSearch, setCbkBankSearch] = useState('');
  const [selectedCheckbookId, setSelectedCheckbookId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allChks, allCbs] = await Promise.all([
        getAllCheques(),
        getAllCheckbooks(),
      ]);
      setCheques(allChks);
      setCheckbooks(allCbs);
      if (allCbs.length > 0 && !selectedCheckbookId) {
        setSelectedCheckbookId(allCbs[0].id);
      }
    } catch (err) {
      console.error('Failed to load cheques data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const allPersons = useMemo(() => {
    return allAccounts.filter((a) => a.type === 'person');
  }, [allAccounts]);

  const bankAccounts = useMemo(() => {
    return allAccounts.filter(
      (a) =>
        a.type === 'asset' &&
        (a.name.includes('بانک') || (a.code && a.code.startsWith('102')) || (!a.name.includes('صندوق') && !a.name.includes('تنخواه')))
    );
  }, [allAccounts]);

  const handleDeleteCheque = async (chk: Cheque) => {
    if (window.confirm(`آیا از حذف چک شماره ${toPersianDigits(chk.check_number || '')} اطمینان دارید؟`)) {
      try {
        await deleteCheque(chk.id);
        await loadData();
      } catch (err: any) {
        alert(err.message || 'خطا در حذف چک');
      }
    }
  };

  const handleRevertStatus = async (chk: Cheque) => {
    const isReceived = chk.type === 'received';
    const targetStateName = isReceived ? '«نزد صندوق»' : '«صادرشده (در جریان وصول)»';
    if (!window.confirm(`آیا از بازگشت چک به وضعیت ${targetStateName} اطمینان دارید؟`)) return;

    try {
      await revertChequeStatus(chk.id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'خطا در تغییر وضعیت');
    }
  };

  const handleDeleteCheckbook = async (cb: Checkbook) => {
    const issuedCheques = cheques.filter((c) => c.checkbook_id === cb.id);
    if (issuedCheques.length > 0) {
      alert(`از این دسته‌چک ${toPersianDigits(String(issuedCheques.length))} برگه چک صادر شده است و قابل حذف نیست.`);
      return;
    }
    if (window.confirm(`آیا از حذف دسته‌چک ${cb.bank_name} اطمینان دارید؟`)) {
      await deleteCheckbook(cb.id);
      await loadData();
    }
  };

  const filteredCheques = useMemo(() => {
    return cheques.filter((chk) => {
      if (chk.type !== activeSubTab) return false;
      if (statusFilter !== 'all' && chk.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const numMatch = chk.check_number.toLowerCase().includes(q);
        const sayadMatch = (chk.sayad_id || '').toLowerCase().includes(q);
        const bankMatch = chk.bank_name.toLowerCase().includes(q);
        const personName = chk.person_name || allAccounts.find((a) => a.id === chk.person_id)?.name || '';
        const personMatch = personName.toLowerCase().includes(q);
        return numMatch || sayadMatch || bankMatch || personMatch;
      }
      return true;
    });
  }, [cheques, activeSubTab, statusFilter, searchQuery, allAccounts]);

  const filteredCheckbooks = useMemo(() => {
    return checkbooks.filter((cb) => {
      if (cbkBankSearch.trim()) {
        return cb.bank_name.toLowerCase().includes(cbkBankSearch.trim().toLowerCase());
      }
      return true;
    });
  }, [checkbooks, cbkBankSearch]);

  const receivedStats = useMemo(() => {
    const list = cheques.filter((c) => c.type === 'received');
    const totalAmount = list.reduce((sum, c) => sum + (c.amount || 0), 0);
    const inSafe = list.filter((c) => c.status === 'in_safe');
    const inSafeAmount = inSafe.reduce((sum, c) => sum + (c.amount || 0), 0);
    const cleared = list.filter((c) => c.status === 'cleared');
    const clearedAmount = cleared.reduce((sum, c) => sum + (c.amount || 0), 0);

    return {
      totalCount: list.length,
      totalAmount,
      inSafeCount: inSafe.length,
      inSafeAmount,
      clearedCount: cleared.length,
      clearedAmount,
    };
  }, [cheques]);

  const issuedStats = useMemo(() => {
    const list = cheques.filter((c) => c.type === 'issued');
    const totalAmount = list.reduce((sum, c) => sum + (c.amount || 0), 0);
    const issuedPending = list.filter((c) => c.status === 'issued');
    const pendingAmount = issuedPending.reduce((sum, c) => sum + (c.amount || 0), 0);

    return {
      totalCount: list.length,
      totalAmount,
      pendingCount: issuedPending.length,
      pendingAmount,
    };
  }, [cheques]);

  const selectedCheckbook = checkbooks.find((c) => c.id === selectedCheckbookId);

  // تولید برچسب وضعیت با نمایش کامل فرد گیرنده یا تاریخ برگشت/عودت
  const renderStatusDetails = (chk: Cheque) => {
    switch (chk.status) {
      case 'in_safe':
        return (
          <div className="flex flex-col items-center gap-0.5">
            <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
              نزد صندوق
            </span>
          </div>
        );

      case 'cleared':
        return (
          <div className="flex flex-col items-center gap-0.5">
            <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
              وصول‌شده
            </span>
            {chk.location && (
              <span className="text-[9.5px] text-slate-500 truncate max-w-[120px]" title={chk.location}>
                {chk.location}
              </span>
            )}
          </div>
        );

      case 'assigned': {
        const assignedPersonName =
          allAccounts.find((a) => a.id === chk.assigned_to_person_id)?.name ||
          chk.location?.replace('واگذار شده به ', '') ||
          'طرف‌حساب';

        return (
          <div className="flex flex-col items-center gap-0.5">
            <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-sky-50 text-sky-800 border border-sky-300">
              واگذارشده
            </span>
            <span className="text-[9.5px] font-semibold text-sky-900 truncate max-w-[120px]" title={`واگذار به: ${assignedPersonName}`}>
             {assignedPersonName}
            </span>
          </div>
        );
      }

      case 'bounced':
        return (
          <div className="flex flex-col items-center gap-0.5">
            <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
              برگشت‌خورده
            </span>
            {chk.status_description && (
              <span className="text-[9.5px] text-rose-800 font-mono truncate max-w-[120px]" title={chk.status_description}>
                {toPersianDigits(chk.status_description)}
              </span>
            )}
          </div>
        );

      case 'returned':
        return (
          <div className="flex flex-col items-center gap-0.5">
            <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
              عودت‌داده‌شده
            </span>
            {chk.status_description && (
              <span className="text-[9.5px] text-purple-800 font-mono truncate max-w-[120px]" title={chk.status_description}>
                {toPersianDigits(chk.status_description)}
              </span>
            )}
          </div>
        );

      case 'issued':
        return (
          <div className="flex flex-col items-center gap-0.5">
            <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
              در جریان وصول
            </span>
          </div>
        );

      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-100 text-slate-600">
            نامشخص
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 animate-fade-in text-slate-800" dir="rtl">
      {/* سربرگ تب‌ها */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl shadow-xs border border-slate-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('received');
              setStatusFilter('all');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeSubTab === 'received'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingDown size={15} />
            <span>چک‌های دریافتنی</span>
            <span className="bg-white/20 text-white px-2 py-0.2 rounded-full text-[10px] font-mono">
              {toPersianDigits(String(cheques.filter((c) => c.type === 'received').length))}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab('issued');
              setStatusFilter('all');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeSubTab === 'issued'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp size={15} />
            <span>چک‌های پرداختنی (صادره)</span>
            <span className="bg-white/20 text-white px-2 py-0.2 rounded-full text-[10px] font-mono">
              {toPersianDigits(String(cheques.filter((c) => c.type === 'issued').length))}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('checkbooks')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeSubTab === 'checkbooks'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen size={15} />
            <span>لیست دسته‌چک‌ها</span>
            <span className="bg-white/20 text-white px-2 py-0.2 rounded-full text-[10px] font-mono">
              {toPersianDigits(String(checkbooks.length))}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeSubTab === 'received' && (
            <button
              type="button"
              onClick={() => {
                setChequeToEditReceived(null);
                setIsReceivedModalOpen(true);
              }}
              className="flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={15} />
              <span>ثبت چک دریافتی جدید</span>
            </button>
          )}

          {activeSubTab === 'issued' && (
            <button
              type="button"
              onClick={() => {
                setChequeToEditIssued(null);
                setTargetLeafNumber(undefined);
                setTargetCheckbookId(undefined);
                setIsIssuedModalOpen(true);
              }}
              className="flex items-center gap-1 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={15} />
              <span>صدور چک پرداختی جدید</span>
            </button>
          )}

          {activeSubTab === 'checkbooks' && (
            <button
              type="button"
              onClick={() => {
                setCheckbookToEdit(null);
                setIsCheckbookModalOpen(true);
              }}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={15} />
              <span>تعریف دسته‌چک جدید</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadData}
            title="بازخوانی داده‌ها"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* خلاصه ارقام آماری */}
      {activeSubTab === 'received' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">کل چک‌های دریافتی</span>
            <span className="text-base font-black text-slate-900 font-mono mt-1 block">
              {separateThousands(String(receivedStats.totalAmount))} ریال
            </span>
            <span className="text-[10.5px] text-slate-400 font-mono">{toPersianDigits(String(receivedStats.totalCount))} فقره</span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
              <Clock size={14} />
              <span>موجود نزد صندوق</span>
            </span>
            <span className="text-base font-black text-amber-700 font-mono mt-1 block">
              {separateThousands(String(receivedStats.inSafeAmount))} ریال
            </span>
            <span className="text-[10.5px] text-slate-400 font-mono">{toPersianDigits(String(receivedStats.inSafeCount))} فقره چک آزاد</span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <CheckCircle size={14} className="text-sky-600" />
              <span>وصول‌شده به حساب بانکی</span>
            </span>
            <span className="text-base font-black text-slate-900 font-mono mt-1 block">
              {separateThousands(String(receivedStats.clearedAmount))} ریال
            </span>
            <span className="text-[10.5px] text-slate-400 font-mono">{toPersianDigits(String(receivedStats.clearedCount))} فقره پاس‌شده</span>
          </div>
        </div>
      )}

      {activeSubTab === 'issued' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">کل چک‌های صادره</span>
            <span className="text-base font-black text-slate-900 font-mono mt-1 block">
              {separateThousands(String(issuedStats.totalAmount))} ریال
            </span>
            <span className="text-[10.5px] text-slate-400 font-mono">{toPersianDigits(String(issuedStats.totalCount))} فقره</span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
              <Clock size={14} />
              <span>چک‌های در جریان وصول (تعهدات آتی)</span>
            </span>
            <span className="text-base font-black text-rose-700 font-mono mt-1 block">
              {separateThousands(String(issuedStats.pendingAmount))} ریال
            </span>
            <span className="text-[10.5px] text-slate-400 font-mono">{toPersianDigits(String(issuedStats.pendingCount))} فقره</span>
          </div>
        </div>
      )}

      {/* بخش نمایش جدول */}
      {activeSubTab === 'checkbooks' ? (
        <div className="bg-white rounded-2xl border border-slate-300 shadow-xs overflow-hidden space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="w-72 relative">
              <Search size={15} className="absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={cbkBankSearch}
                onChange={(e) => setCbkBankSearch(e.target.value)}
                placeholder="جستجو در نام بانک..."
                className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            {selectedCheckbook && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCheckbookForLeaves(selectedCheckbook);
                    setIsLeavesModalOpen(true);
                  }}
                  className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer border border-slate-300"
                >
                  <Eye size={13} className="text-sky-600" />
                  <span>مشاهده برگه‌ها</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCheckbookToEdit(selectedCheckbook);
                    setIsCheckbookModalOpen(true);
                  }}
                  className="p-1.5 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
                  title="ویرایش"
                >
                  <Edit3 size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCheckbook(selectedCheckbook)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                  title="حذف"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </div>

          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full text-xs border-collapse border border-slate-300 table-fixed">
              <thead>
                <tr className="bg-slate-100 text-slate-800 text-[11px] font-bold">
                  <th className="border border-slate-300 py-2.5 px-2 text-center" style={{ width: '15%' }}>تاریخ دریافت</th>
                  <th className="border border-slate-300 py-2.5 px-2 text-center" style={{ width: '25%' }}>سریال دسته‌چک</th>
                  <th className="border border-slate-300 py-2.5 px-3 text-right" style={{ width: '30%' }}>نام بانک</th>
                  <th className="border border-slate-300 py-2.5 px-2 text-center" style={{ width: '10%' }}>از شماره</th>
                  <th className="border border-slate-300 py-2.5 px-2 text-center" style={{ width: '10%' }}>تا شماره</th>
                  <th className="border border-slate-300 py-2.5 px-2 text-center" style={{ width: '10%' }}>تعداد برگه</th>
                </tr>
              </thead>
              <tbody>
                {filteredCheckbooks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400 border border-slate-300">
                      دسته‌چکی تعریف نشده است.
                    </td>
                  </tr>
                ) : (
                  filteredCheckbooks.map((cb) => {
                    const isSelected = cb.id === selectedCheckbookId;
                    return (
                      <tr
                        key={cb.id}
                        onClick={() => setSelectedCheckbookId(cb.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-sky-50 font-bold text-sky-950' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="border border-slate-300 py-2 px-2 text-center font-mono">{toPersianDigits(cb.receive_date_shamsi)}</td>
                        <td className="border border-slate-300 py-2 px-2 text-center font-mono">{toPersianDigits(cb.serial)}</td>
                        <td className="border border-slate-300 py-2 px-3 text-right truncate">{cb.bank_name}</td>
                        <td className="border border-slate-300 py-2 px-2 text-center font-mono">{toPersianDigits(String(cb.from_number))}</td>
                        <td className="border border-slate-300 py-2 px-2 text-center font-mono">{toPersianDigits(String(cb.to_number))}</td>
                        <td className="border border-slate-300 py-2 px-2 text-center font-mono font-bold text-slate-800">
                          {toPersianDigits(String(cb.leaf_count))}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-300 shadow-xs overflow-hidden space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[220px] relative">
              <Search size={15} className="absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در شماره چک، صیاد، نام شخص، بانک..."
                className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-bold text-xs">وضعیت:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="all">همه</option>
                <option value="in_safe">نزد صندوق</option>
                <option value="cleared">وصول‌شده</option>
                <option value="assigned">واگذارشده</option>
                <option value="bounced">برگشتی</option>
                <option value="returned">عودت‌داده‌شده</option>
              </select>
            </div>
          </div>

          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full text-xs border-collapse border border-slate-300 table-fixed">
              <thead>
                <tr className="bg-slate-100 text-slate-800 text-[11px] font-bold">
                  <th className="border border-slate-300 py-2.5 px-1 text-center" style={{ width: '4%' }}>ردیف</th>
                  <th className="border border-slate-300 py-2.5 px-2 text-center" style={{ width: '10%' }}>شماره چک</th>
                  <th className="border border-slate-300 py-2.5 px-2 text-center" style={{ width: '10%' }}>تاریخ سررسید</th>
                  {/* تراز وسط هدر ستون طرف‌حساب */}
                  <th className="border border-slate-300 py-2.5 px-3 text-center" style={{ width: '20%' }}>
                    {activeSubTab === 'received' ? 'طرف حساب (پرداخت‌کننده)' : 'در وجه'}
                  </th>
                  <th className="border border-slate-300 py-2.5 px-2 text-center" style={{ width: '13%' }}>بانک</th>
                  <th className="border border-slate-300 py-2.5 px-2 text-center" style={{ width: '13%' }}>مبلغ چک (ریال)</th>
                  <th className="border border-slate-300 py-2.5 px-2 text-center" style={{ width: '15%' }}>وضعیت</th>
                  <th className="border border-slate-300 py-2.5 px-2 text-center" style={{ width: '15%' }}>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filteredCheques.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 border border-slate-300">
                      چکی ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  filteredCheques.map((chk, idx) => {
                    const personDisplayName = chk.person_name || allAccounts.find((a) => a.id === chk.person_id)?.name || 'نامشخص';

                    return (
                      <tr key={chk.id} className="hover:bg-slate-50 transition-colors">
                        <td className="border border-slate-300 py-2 px-1 text-center font-mono text-[10.5px] text-slate-500">
                          {toPersianDigits(idx + 1)}
                        </td>
                        <td className="border border-slate-300 py-2 px-2 text-center font-mono font-bold text-slate-900">
                          {toPersianDigits(chk.check_number)}
                        </td>
                        <td className="border border-slate-300 py-2 px-2 text-center font-mono text-slate-700">
                          {toPersianDigits(chk.due_date_shamsi)}
                        </td>
                        {/* تراز وسط سلول طرف‌حساب */}
                        <td className="border border-slate-300 py-2 px-3 text-center font-medium text-slate-900 truncate">
                          {personDisplayName}
                        </td>
                        <td className="border border-slate-300 py-2 px-2 text-center text-slate-700 truncate">
                          {chk.bank_name}
                        </td>
                        <td className="border border-slate-300 py-2 px-2 text-center font-mono font-black text-slate-900">
                          {separateThousands(String(chk.amount))}
                        </td>
                        {/* ستون وضعیت با نمایش دقیق گیرنده، تاریخ برگشت یا تاریخ عودت */}
                        <td className="border border-slate-300 py-2 px-2 text-center">
                          {renderStatusDetails(chk)}
                        </td>
                        <td className="border border-slate-300 py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {/* عملیات چک‌های دریافتی نزد صندوق */}
                            {chk.type === 'received' && chk.status === 'in_safe' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOperationTargetCheque(chk);
                                    setOperationType('clear_received');
                                    setIsOperationModalOpen(true);
                                  }}
                                  title="وصول چک"
                                  className="p-1 rounded-lg text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                >
                                  <CheckCircle size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOperationTargetCheque(chk);
                                    setOperationType('assign_received');
                                    setIsOperationModalOpen(true);
                                  }}
                                  title="واگذاری و خرج چک"
                                  className="p-1 rounded-lg text-sky-700 hover:bg-sky-50 cursor-pointer"
                                >
                                  <Share2 size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOperationTargetCheque(chk);
                                    setOperationType('bounce_received');
                                    setIsOperationModalOpen(true);
                                  }}
                                  title="برگشت زدن چک"
                                  className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                                >
                                  <AlertTriangle size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOperationTargetCheque(chk);
                                    setOperationType('return_received');
                                    setIsOperationModalOpen(true);
                                  }}
                                  title="استرداد و عودت به طرف‌حساب"
                                  className="p-1 rounded-lg text-purple-600 hover:bg-purple-50 cursor-pointer"
                                >
                                  <CornerUpLeft size={14} />
                                </button>
                              </>
                            )}

                            {/* عملیات پاس شدن چک صادره */}
                            {chk.type === 'issued' && chk.status === 'issued' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOperationTargetCheque(chk);
                                  setOperationType('clear_issued');
                                  setIsOperationModalOpen(true);
                                }}
                                title="پاس شدن چک"
                                className="p-1 rounded-lg text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                              >
                                <CheckCircle size={14} />
                              </button>
                            )}

                            {/* دکمه لغو و بازگشت عملیات */}
                            {((chk.type === 'received' && chk.status !== 'in_safe') ||
                              (chk.type === 'issued' && chk.status !== 'issued')) && (
                              <button
                                type="button"
                                onClick={() => handleRevertStatus(chk)}
                                title="لغو عملیات و بازگشت به وضعیت قبلی"
                                className="p-1 rounded-lg text-amber-600 hover:bg-amber-50 cursor-pointer"
                              >
                                <RotateCcw size={14} />
                              </button>
                            )}

                            {/* ویرایش */}
                            <button
                              type="button"
                              onClick={() => {
                                if (chk.type === 'received') {
                                  setChequeToEditReceived(chk);
                                  setIsReceivedModalOpen(true);
                                } else {
                                  setChequeToEditIssued(chk);
                                  setIsIssuedModalOpen(true);
                                }
                              }}
                              title="ویرایش"
                              className="p-1 rounded-lg text-slate-600 hover:text-sky-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <Edit3 size={14} />
                            </button>

                            {/* حذف */}
                            <button
                              type="button"
                              onClick={() => handleDeleteCheque(chk)}
                              title="حذف"
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* مودال‌ها */}
      <ReceivedChequeModal
        isOpen={isReceivedModalOpen}
        onClose={() => setIsReceivedModalOpen(false)}
        onSaved={loadData}
        chequeToEdit={chequeToEditReceived}
        allPersons={allPersons}
      />

      <IssuedChequeModal
        isOpen={isIssuedModalOpen}
        onClose={() => setIsIssuedModalOpen(false)}
        onSaved={loadData}
        chequeToEdit={chequeToEditIssued}
        allPersons={allPersons}
        initialCheckbookId={targetCheckbookId}
        initialLeafNumber={targetLeafNumber}
      />

      <CheckbookModal
        isOpen={isCheckbookModalOpen}
        onClose={() => setIsCheckbookModalOpen(false)}
        onSaved={loadData}
        checkbookToEdit={checkbookToEdit}
        bankAccounts={bankAccounts}
      />

      <ChequeOperationModal
        isOpen={isOperationModalOpen}
        onClose={() => setIsOperationModalOpen(false)}
        onSuccess={loadData}
        cheque={operationTargetCheque}
        operationType={operationType}
        bankAccounts={bankAccounts}
        allPersons={allPersons}
      />

      <CheckbookLeavesModal
        isOpen={isLeavesModalOpen}
        onClose={() => setIsLeavesModalOpen(false)}
        checkbook={selectedCheckbookForLeaves}
        onIssueLeaf={(leafNum) => {
          if (selectedCheckbookForLeaves) {
            setTargetCheckbookId(selectedCheckbookForLeaves.id);
            setTargetLeafNumber(leafNum);
            setChequeToEditIssued(null);
            setIsIssuedModalOpen(true);
          }
        }}
      />
    </div>
  );
};