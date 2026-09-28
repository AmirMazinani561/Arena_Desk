import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  History, 
  Users, 
  Landmark, 
  FolderPlus 
} from 'lucide-react';
import type { Account } from '../db/types';
import { formatMoney, toPersianDigits, getDiagnosis } from '../utils/dateUtils';
import { AccountModal } from './AccountModal';
import { CategoryTree } from './CategoryTree';
import { updateAccount, deleteAccount, insertAccount, hasAccountTransactions } from '../db/sqlite';

interface AccountsTabProps {
  accounts: Account[];
  onRefresh: () => Promise<void> | void;
  onViewAccountLedger: (accountId: string) => void;
}

type TabCategory = 'banking' | 'person' | 'expense' | 'revenue';

export const AccountsTab: React.FC<AccountsTabProps> = ({ 
  accounts, 
  onRefresh, 
  onViewAccountLedger 
}) => {
  const [activeTab, setActiveTab] = useState<TabCategory>('banking');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  const q = searchTerm.trim().toLowerCase();

  const isSystemAccount = (a: Account) => (
    a.id === 'acc_inventory_default' ||
    a.id === 'acc_purchase_cost_default' ||
    a.id === 'acc_notes_receivable_default' ||
    a.id === 'acc_notes_payable_default' ||
    a.id === 'acc_sales_revenue_default' ||
    a.name.includes('موجودی کالا') ||
    a.name.includes('موجودی انبار') ||
    a.name.includes('اسناد دریافتنی') ||
    a.name.includes('اسناد پرداختنی') ||
    a.name.includes('انبار')
  );

  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (activeTab === 'expense') return a.type === 'expense';
      if (activeTab === 'revenue') return a.type === 'revenue';

      const matchSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.code.includes(q) ||
        (a.card_number && a.card_number.includes(q)) ||
        (a.account_number && a.account_number.includes(q));
      if (!matchSearch) return false;

      if (activeTab === 'banking') return a.type === 'asset' && !isSystemAccount(a);
      if (activeTab === 'person') return a.type === 'person' && !isSystemAccount(a);
      return true;
    });
  }, [accounts, activeTab, q]);

  const handleOpenCreateParent = () => {
    setAccountToEdit(null);
    setSelectedParentId(null);
    setIsModalOpen(true);
  };

  const handleAddSubcategory = (parentId: string) => {
    setAccountToEdit(null);
    setSelectedParentId(parentId);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (acc: Account) => {
    setAccountToEdit(acc);
    setSelectedParentId(acc.parent_id || null);
    setIsModalOpen(true);
  };

  const handleDelete = async (acc: Account) => {
    const hasTx = await hasAccountTransactions(acc.id);
    if (hasTx) {
      alert(`حساب «${acc.name}» دارای تراکنش و گردش مالی ثبت‌شده است و امکان حذف آن وجود ندارد!\n\nجهت حذف این حساب، ابتدا باید تمام تراکنش‌های آن را حذف کنید یا حساب مبدأ/مقصد آن‌ها را ویرایش فرمایید.`);
      return;
    }

    if (window.confirm(`آیا از حذف حساب «${acc.name}» اطمینان دارید؟`)) {
      try {
        await deleteAccount(acc.id);
        await onRefresh();
      } catch (err: any) {
        alert(err.message || 'خطا در حذف حساب.');
      }
    }
  };

  const handleSaveAccount = async (data: any) => {
    if (data.id) {
      await updateAccount(data.id, data);
    } else {
      await insertAccount(data);
    }
    await onRefresh();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">سرفصل‌ها و حساب‌ها (کدینگ خودکار)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            مدیریت حساب‌های بانکی، اشخاص و درخت سرفصل‌های هزینه و درآمد با کدهای استاندارد
          </p>
        </div>

        <button
          onClick={handleOpenCreateParent}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 transition-all cursor-pointer"
        >
          {activeTab === 'expense' || activeTab === 'revenue' ? (
            <>
              <FolderPlus className="w-4 h-4" />
              <span>افزودن سرفصل اصلی</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>افزودن حساب جدید</span>
            </>
          )}
        </button>
      </div>

      {/* جستجو و تب‌های دسته‌بندی */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/60 shrink-0">
          <button
            onClick={() => setActiveTab('banking')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'banking' ? 'bg-white text-sky-700 shadow-xs border border-slate-200/50' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            بانک و صندوق (از ۱)
          </button>
          <button
            onClick={() => setActiveTab('person')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'person' ? 'bg-white text-purple-700 shadow-xs border border-slate-200/50' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            اشخاص (از ۱۰۱)
          </button>
          <button
            onClick={() => setActiveTab('expense')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'expense' ? 'bg-white text-rose-700 shadow-xs border border-slate-200/50' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            درخت هزینه‌ها (از ۱۰۰۱)
          </button>
          <button
            onClick={() => setActiveTab('revenue')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'revenue' ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/50' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            درخت درآمدها (از ۳۰۰۱)
          </button>
        </div>

        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجو در نام، شماره حساب، کارت یا کدینگ..."
            className="w-full pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* نمایش محتوا در قالب جدول کادربندی‌شده */}
      {activeTab === 'expense' || activeTab === 'revenue' ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden p-4">
          <CategoryTree
            accounts={filteredAccounts}
            searchTerm={searchTerm}
            onAddSubcategory={handleAddSubcategory}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
            onViewLedger={onViewAccountLedger}
            tone={activeTab === 'expense' ? 'rose' : 'emerald'}
          />
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200/90 text-center text-slate-400 text-xs">
          حسابی در این بخش یافت نشد.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 text-[11px] font-bold">
                  <th className="py-3 px-4 text-center align-middle border-l border-slate-200" style={{ width: '12%' }}>کد حساب</th>
                  <th className="py-3 px-4 text-center align-middle border-l border-slate-200" style={{ width: '32%' }}>
                    {activeTab === 'person' ? 'نام و مشخصات شخص' : 'عنوان حساب / بانک'}
                  </th>
                  <th className="py-3 px-4 text-center align-middle border-l border-slate-200" style={{ width: '22%' }}>شماره حساب / کارت</th>
                  <th className="py-3 px-4 text-center align-middle border-l border-slate-200" style={{ width: '20%' }}>موجودی لحظه‌ای (ریال)</th>
                  <th className="py-3 px-4 text-center align-middle" style={{ width: '14%' }}>عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAccounts.map((acc) => {
                  const isPerson = acc.type === 'person';

                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 text-center align-middle font-mono font-bold text-sky-700 border-l border-slate-200">
                        #{toPersianDigits(acc.code)}
                      </td>
                      <td className="py-3.5 px-4 align-middle border-l border-slate-200">
                        {/* کانتینر با تراز یکنواخت برای آیکون و نام */}
                        <div className="flex items-center justify-center">
                          <div className="grid grid-cols-[28px_1fr] items-center gap-2.5 w-[210px] max-w-full">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs justify-self-center"
                              style={{ backgroundColor: acc.color || (isPerson ? '#9333ea' : '#0284c7') }}
                            >
                              {isPerson ? <Users className="w-3.5 h-3.5" /> : <Landmark className="w-3.5 h-3.5" />}
                            </div>
                            <span className="font-bold text-slate-900 text-right truncate">{acc.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center align-middle font-mono text-slate-600 border-l border-slate-200">
                        {acc.card_number ? (
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                            {toPersianDigits(acc.card_number)}
                          </span>
                        ) : acc.account_number ? (
                          <span>{toPersianDigits(acc.account_number)}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center align-middle font-mono font-extrabold text-slate-900 border-l border-slate-200">
                        {/* تراز دقیق عدد و تشخیص: ارقام از راست و برچسب‌های بد/بس/بی‌حساب در یک ستون ثابت ۵۵ پیکسلی */}
                        <div className="flex items-center justify-center">
                          <div className="flex items-center justify-end gap-2 w-[170px]">
                            <span className="text-left font-mono font-extrabold text-slate-900 flex-1 truncate">
                              {formatMoney(Math.abs(acc.balance))}
                            </span>
                            {isPerson ? (() => {
                              const diag = getDiagnosis(acc.balance);
                              return (
                                <span className={`${diag.textClass} w-[52px] text-center shrink-0 block py-0.5 rounded text-[11px]`}>
                                  {diag.label}
                                </span>
                              );
                            })() : (
                              <span className="w-[52px] shrink-0" />
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center align-middle">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onViewAccountLedger(acc.id)}
                            className="flex items-center gap-1 py-1 px-2.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
                            title="مشاهده ریز اسناد و گردش این حساب"
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>گردش</span>
                          </button>

                          <button
                            onClick={() => handleOpenEdit(acc)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="ویرایش حساب"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(acc)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="حذف حساب"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* مودال ایجاد و ویرایش حساب */}
      <AccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        accountToEdit={accountToEdit}
        defaultType={
          activeTab === 'banking'
            ? 'asset'
            : activeTab === 'person'
            ? 'person'
            : activeTab === 'expense'
            ? 'expense'
            : 'revenue'
        }
        defaultParentId={selectedParentId}
        allAccounts={accounts}
        onSave={handleSaveAccount}
      />
    </div>
  );
};