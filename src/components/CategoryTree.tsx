import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronLeft, Plus, Edit3, Trash2, History, Folder, FolderOpen, Tag, CornerDownLeft } from 'lucide-react';
import type { Account } from '../db/types';
import { toPersianDigits } from '../utils/dateUtils';

interface CategoryTreeProps {
  accounts: Account[];
  searchTerm?: string;
  onAddSubcategory: (parentId: string) => void;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  onViewLedger: (accountId: string) => void;
  tone: 'rose' | 'emerald';
}

export const CategoryTree: React.FC<CategoryTreeProps> = ({
  accounts,
  searchTerm = '',
  onAddSubcategory,
  onEdit,
  onDelete,
  onViewLedger,
  tone,
}) => {
  const [openParents, setOpenParents] = useState<Record<string, boolean>>({});

  const toggleParent = (id: string) => {
    setOpenParents((prev) => ({ ...prev, [id]: !(prev[id] ?? false) }));
  };

  const q = searchTerm.trim().toLowerCase();

  const { parents, childrenMap } = useMemo(() => {
    const parentList: Account[] = [];
    const childrenMap = new Map<string, Account[]>();

    for (const a of accounts) {
      if (!a.parent_id) {
        parentList.push(a);
      } else {
        const arr = childrenMap.get(a.parent_id) || [];
        arr.push(a);
        childrenMap.set(a.parent_id, arr);
      }
    }
    return { parents: parentList, childrenMap };
  }, [accounts]);

  // متد بررسی تطابق مستقیم سرفصل با عبارت جستجو
  const isDirectMatch = (acc: Account): boolean => {
    if (!q) return true;
    return (
      acc.name.toLowerCase().includes(q) ||
      acc.code.toLowerCase().includes(q)
    );
  };

  // متد بررسی بازگشتی فرزندان و نوه‌ها (سطوح ۲ و ۳)
  const hasMatchingDescendant = (accId: string): boolean => {
    const children = childrenMap.get(accId) || [];
    for (const ch of children) {
      if (isDirectMatch(ch) || hasMatchingDescendant(ch.id)) return true;
    }
    return false;
  };

  // فیلتر کردن سرفصل‌های والد که خودشان یا زیرمجموعه‌شان با سرچ همخوانی دارد
  const visibleParents = useMemo(() => {
    if (!q) return parents;
    return parents.filter((p) => isDirectMatch(p) || hasMatchingDescendant(p.id));
  }, [parents, q, childrenMap]);

  const isRose = tone === 'rose';

  // رندر بازگشتی زیرمجموعه‌ها برای پشتیبانی از سطوح مختلف (فرزندان و نوه‌ها)
  const renderChildNode = (child: Account, depth = 1): React.ReactNode => {
    const subChildren = childrenMap.get(child.id) || [];
    const isMatched = q ? isDirectMatch(child) : false;
    const hasMatchBelow = q ? hasMatchingDescendant(child.id) : false;

    // اگر سرچ فعال است، فقط در صورتی نمایش داده شود که خود یا فرزندش تطابق داشته باشد یا والد اصلی مستقیماً مچ شده باشد
    if (q && !isMatched && !hasMatchBelow) {
      return null;
    }

    return (
      <div key={child.id} className="space-y-1">
        <div
          className={`py-2.5 flex items-center justify-between hover:bg-slate-50/80 rounded-xl px-2 transition-colors ${
            depth > 1 ? 'pr-8 border-r-2 border-slate-200 mr-2' : ''
          } ${isMatched ? 'bg-amber-50/60 ring-1 ring-amber-300' : ''}`}
        >
          <div className="flex items-center gap-2">
            {depth > 1 ? (
              <CornerDownLeft className="w-3 h-3 text-slate-400" />
            ) : (
              <Tag className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className={`text-xs font-semibold ${isMatched ? 'text-amber-900 font-bold' : 'text-slate-700'}`}>
              {child.name}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              کد: {toPersianDigits(child.code)}
            </span>
            {isMatched && (
              <span className="text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-md font-bold">
                تطابق
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onAddSubcategory(child.id)}
              className="p-1 text-slate-400 hover:text-sky-600 cursor-pointer"
              title="افزودن زیرمجموعه"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onViewLedger(child.id)}
              className="p-1 text-slate-400 hover:text-sky-600 cursor-pointer"
              title="ریزگردش زیرمجموعه"
            >
              <History className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onEdit(child)}
              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              title="ویرایش"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(child)}
              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
              title="حذف"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* رندر فرزندان سطح بعدی (نوه‌ها) */}
        {subChildren.length > 0 && (
          <div className="space-y-1">
            {subChildren.map((sc) => renderChildNode(sc, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {visibleParents.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
          {q ? 'هیچ سرفصل یا زیرمجموعه‌ای مطابق با جستجوی شما یافت نشد.' : 'هنوز سرفصلی تعریف نشده است. با دکمه «افزودن سرفصل جدید» در بالا سرفصل اول را بسازید.'}
        </div>
      ) : (
        visibleParents.map((parent) => {
          const children = childrenMap.get(parent.id) || [];
          const parentMatched = q ? isDirectMatch(parent) : false;
          const descendantMatched = q ? hasMatchingDescendant(parent.id) : false;
          // اگر جستجو شده و فرزندی همخوانی دارد، والد خودکار باز می‌شود
          const isOpen = (q && descendantMatched) ? true : (openParents[parent.id] ?? false);

          return (
            <div
              key={parent.id}
              className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                parentMatched ? 'border-sky-400 shadow-sm' : 'border-slate-200/80 shadow-xs'
              }`}
            >
              {/* ردیف سرفصل والد */}
              <div className="p-4 flex items-center justify-between bg-slate-50/60 hover:bg-slate-100/50 transition-colors">
                <div
                  className="flex items-center gap-3 cursor-pointer flex-1"
                  onClick={() => toggleParent(parent.id)}
                >
                  <button type="button" className="text-slate-400 hover:text-slate-600">
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </button>

                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold ${
                      isRose ? 'bg-rose-500' : 'bg-emerald-600'
                    }`}
                  >
                    {isOpen ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${parentMatched ? 'text-sky-900 bg-sky-100 px-1.5 py-0.5 rounded' : 'text-slate-800'}`}>
                        {parent.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        کد: {toPersianDigits(parent.code)}
                      </span>
                      {children.length > 0 && (
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.2 rounded-full font-bold">
                          {toPersianDigits(children.length)} زیرمجموعه
                        </span>
                      )}
                      {descendantMatched && (
                        <span className="text-[9px] bg-sky-100 text-sky-700 px-1.5 py-0.2 rounded-md font-bold">
                          تطابق در زیرمجموعه‌ها
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* دکمه‌های عملیات سرفصل والد */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onAddSubcategory(parent.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 text-[11px] font-bold transition-colors cursor-pointer"
                    title="افزودن زیرمجموعه به این سرفصل"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>زیرمجموعه</span>
                  </button>

                  <button
                    onClick={() => onViewLedger(parent.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-sky-600 transition-colors cursor-pointer"
                    title="ریزگردش و اسناد سرفصل"
                  >
                    <History className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onEdit(parent)}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
                    title="ویرایش سرفصل"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onDelete(parent)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                    title="حذف سرفصل"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* لیست زیرمجموعه‌ها (در صورت باز بودن والد) */}
              {isOpen && children.length > 0 && (
                <div className="divide-y divide-slate-100 bg-white pr-10 pl-4 py-1.5 space-y-1">
                  {children.map((child) => renderChildNode(child, 1))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
