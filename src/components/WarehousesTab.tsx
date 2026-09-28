import React, { useState, useEffect, useMemo } from 'react';
import { 
  Warehouse as WarehouseIcon, 
  Package, 
  Layers, 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  Boxes, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle,
  FolderPlus
} from 'lucide-react';
import type { Warehouse, Commodity, CommodityGroup } from '../db/types';
import { 
  getAllWarehouses, 
  getWarehouseCommoditiesCount, 
  deleteWarehouse, 
  canDeleteWarehouse,
  getAllCommodities,
  deleteCommodity,
  canDeleteCommodity,
  getAllCommodityGroups,
  deleteCommodityGroup
} from '../db/sqlite';
import { WarehouseModal } from './WarehouseModal';
import { WarehouseReportModal } from './WarehouseReportModal';
import { CommodityModal } from './CommodityModal';
import { CommodityGroupModal } from './CommodityGroupModal';
import { CommodityReportModal } from './CommodityReportModal';
import { CommodityGroupReportModal } from './CommodityGroupReportModal';
import { toPersianDigits, formatMoney } from '../utils/dateUtils';

interface WarehouseWithCount extends Warehouse {
  commoditiesCount: number;
}

type SubTab = 'commodities' | 'groups' | 'warehouses';

export const WarehousesTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('commodities');
  
  const [warehouses, setWarehouses] = useState<WarehouseWithCount[]>([]);
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [groups, setGroups] = useState<CommodityGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('all');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');

  const [isCommodityModalOpen, setIsCommodityModalOpen] = useState(false);
  const [commodityToEdit, setCommodityToEdit] = useState<Commodity | null>(null);
  const [isCommodityReportOpen, setIsCommodityReportOpen] = useState(false);
  const [commodityForReport, setCommodityForReport] = useState<Commodity | null>(null);

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState<CommodityGroup | null>(null);
  const [isGroupReportOpen, setIsGroupReportOpen] = useState(false);
  const [groupForReport, setGroupForReport] = useState<CommodityGroup | null>(null);

  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [warehouseToEdit, setWarehouseToEdit] = useState<Warehouse | null>(null);
  const [isWarehouseReportOpen, setIsWarehouseReportOpen] = useState(false);
  const [warehouseForReport, setWarehouseForReport] = useState<Warehouse | null>(null);

  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [commodityToDelete, setCommodityToDelete] = useState<Commodity | null>(null);
  const [warehouseToDelete, setWarehouseToDelete] = useState<WarehouseWithCount | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<CommodityGroup | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setIsLoading(true);
      const [whList, cmdList, grpList] = await Promise.all([
        getAllWarehouses(),
        getAllCommodities(),
        getAllCommodityGroups(),
      ]);

      const withCounts: WarehouseWithCount[] = await Promise.all(
        whList.map(async (w) => {
          const count = await getWarehouseCommoditiesCount(w.id);
          return { ...w, commoditiesCount: count };
        })
      );

      setWarehouses(withCounts);
      setCommodities(cmdList);
      setGroups(grpList);
    } catch (err) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const warehouseMap = useMemo(() => {
    const map = new Map<string, Warehouse>();
    for (const w of warehouses) map.set(w.id, w);
    return map;
  }, [warehouses]);

  const groupMap = useMemo(() => {
    const map = new Map<string, CommodityGroup>();
    for (const g of groups) map.set(g.id, g);
    return map;
  }, [groups]);

  const handleOpenCreateCommodity = () => {
    setCommodityToEdit(null);
    setIsCommodityModalOpen(true);
  };

  const handleOpenEditCommodity = (c: Commodity) => {
    setCommodityToEdit(c);
    setIsCommodityModalOpen(true);
  };

  const handleOpenCommodityReport = (c: Commodity) => {
    setCommodityForReport(c);
    setIsCommodityReportOpen(true);
  };

  const handleDeleteCommodityClick = async (c: Commodity) => {
    setDeleteWarning(null);
    const check = await canDeleteCommodity(c.id);
    if (!check.canDelete) {
      setDeleteWarning(check.reason || 'این کالا دارای گردش کاردکس می‌باشد و امکان حذف آن وجود ندارد.');
      setCommodityToDelete(null);
      return;
    }
    setCommodityToDelete(c);
  };

  const handleConfirmDeleteCommodity = async () => {
    if (!commodityToDelete) return;
    try {
      await deleteCommodity(commodityToDelete.id);
      setCommodityToDelete(null);
      await loadAllData();
    } catch (err: any) {
      setDeleteWarning(err?.message || 'خطا در حذف کالا.');
    }
  };

  const handleOpenCreateGroup = () => {
    setGroupToEdit(null);
    setIsGroupModalOpen(true);
  };

  const handleOpenEditGroup = (g: CommodityGroup) => {
    setGroupToEdit(g);
    setIsGroupModalOpen(true);
  };

  const handleOpenGroupReport = (g: CommodityGroup) => {
    setGroupForReport(g);
    setIsGroupReportOpen(true);
  };

  const handleDeleteGroupClick = (g: CommodityGroup) => {
    setGroupToDelete(g);
  };

  const handleConfirmDeleteGroup = async () => {
    if (!groupToDelete) return;
    try {
      await deleteCommodityGroup(groupToDelete.id);
      setGroupToDelete(null);
      await loadAllData();
    } catch (err: any) {
      setDeleteWarning(err?.message || 'خطا در حذف گروه کالا.');
    }
  };

  const handleOpenCreateWarehouse = () => {
    setWarehouseToEdit(null);
    setIsWarehouseModalOpen(true);
  };

  const handleOpenEditWarehouse = (w: Warehouse) => {
    setWarehouseToEdit(w);
    setIsWarehouseModalOpen(true);
  };

  const handleOpenWarehouseReport = (w: Warehouse) => {
    setWarehouseForReport(w);
    setIsWarehouseReportOpen(true);
  };

  const handleDeleteWarehouseClick = async (w: WarehouseWithCount) => {
    setDeleteWarning(null);
    const check = await canDeleteWarehouse(w.id);
    if (!check.canDelete) {
      setDeleteWarning(check.reason || 'این انبار دارای کالا می‌باشد و امکان حذف آن وجود ندارد.');
      setWarehouseToDelete(null);
      return;
    }
    setWarehouseToDelete(w);
  };

  const handleConfirmDeleteWarehouse = async () => {
    if (!warehouseToDelete) return;
    try {
      await deleteWarehouse(warehouseToDelete.id);
      setWarehouseToDelete(null);
      await loadAllData();
    } catch (err: any) {
      setDeleteWarning(err?.message || 'خطا در حذف انبار.');
    }
  };

  const filteredCommodities = useMemo(() => {
    return commodities.filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = c.name.toLowerCase().includes(q);
        const matchCode = String(c.code).includes(q);
        const matchBarcode = c.barcode && c.barcode.toLowerCase().includes(q);
        const matchUnit = c.unit && c.unit.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchBarcode && !matchUnit) return false;
      }

      if (selectedWarehouseFilter !== 'all' && c.warehouse_id !== selectedWarehouseFilter) {
        return false;
      }

      if (selectedGroupFilter !== 'all') {
        if (selectedGroupFilter === 'none') {
          if (c.group_id) return false;
        } else if (c.group_id !== selectedGroupFilter) {
          return false;
        }
      }

      if (stockFilter === 'in_stock' && (c.current_quantity || 0) <= 0) return false;
      if (stockFilter === 'out_of_stock' && (c.current_quantity || 0) > 0) return false;

      return true;
    });
  }, [commodities, searchQuery, selectedWarehouseFilter, selectedGroupFilter, stockFilter]);

  const filteredWarehouses = useMemo(() => {
    if (!searchQuery.trim()) return warehouses;
    const q = searchQuery.trim().toLowerCase();
    return warehouses.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        String(w.code).includes(q) ||
        (w.address && w.address.toLowerCase().includes(q)) ||
        (w.description && w.description.toLowerCase().includes(q))
    );
  }, [warehouses, searchQuery]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.trim().toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, searchQuery]);

  const totalStockQty = useMemo(() => {
    return commodities.reduce((acc, c) => acc + (c.current_quantity || 0), 0);
  }, [commodities]);

  const outOfStockCount = useMemo(() => {
    return commodities.filter((c) => (c.current_quantity || 0) <= 0).length;
  }, [commodities]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900">مدیریت انبار و کالاها</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              مدیریت و کنترل موجودی کالاها، انبارها و گروه‌بندی‌ها
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/60 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('commodities')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'commodities'
                ? 'bg-white text-sky-700 shadow-xs border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>کالاها و خدمات</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-sky-100 text-sky-800">
              {toPersianDigits(commodities.length)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('groups')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'groups'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>گروه‌های کالا</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-indigo-100 text-indigo-800">
              {toPersianDigits(groups.length)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('warehouses')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'warehouses'
                ? 'bg-white text-sky-700 shadow-xs border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <WarehouseIcon className="w-4 h-4" />
            <span>انبارها</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-slate-200 text-slate-800">
              {toPersianDigits(warehouses.length)}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeSubTab === 'commodities' && (
            <>
              <button
                type="button"
                onClick={handleOpenCreateGroup}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <FolderPlus className="w-4 h-4 text-sky-600" />
                <span className="hidden sm:inline">+ گروه جدید</span>
              </button>
              <button
                type="button"
                onClick={handleOpenCreateCommodity}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 active:scale-98 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>تعریف کالای جدید</span>
              </button>
            </>
          )}

          {activeSubTab === 'groups' && (
            <button
              type="button"
              onClick={handleOpenCreateGroup}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 active:scale-98 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>تعریف گروه کالا</span>
            </button>
          )}

          {activeSubTab === 'warehouses' && (
            <button
              type="button"
              onClick={handleOpenCreateWarehouse}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 active:scale-98 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>تعریف انبار جدید</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">تعداد کل کالاها</span>
            <div className="text-xl font-extrabold text-slate-900 font-mono">
              {toPersianDigits(commodities.length)}{' '}
              <span className="text-xs font-normal text-slate-400">قلم</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">موجودی کل انبارها</span>
            <div className="text-xl font-extrabold text-emerald-600 font-mono">
              {toPersianDigits(totalStockQty)}{' '}
              <span className="text-xs font-normal text-slate-400">واحد</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">اقلام بدون موجودی</span>
            <div className="text-xl font-extrabold text-amber-600 font-mono">
              {toPersianDigits(outOfStockCount)}{' '}
              <span className="text-xs font-normal text-slate-400">کالا</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">تعداد انبارهای فعال</span>
            <div className="text-xl font-extrabold text-indigo-600 font-mono">
              {toPersianDigits(warehouses.length)}{' '}
              <span className="text-xs font-normal text-slate-400">انبار</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <WarehouseIcon className="w-6 h-6" />
          </div>
        </div>
      </div>

      {deleteWarning && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
            <span className="font-semibold">{deleteWarning}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteWarning(null)}
            className="text-amber-700 hover:text-amber-900 text-xs font-bold px-2 py-1 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
          >
            متوجه شدم
          </button>
        </div>
      )}

      {commodityToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">تایید حذف کالا</h3>
                <span className="text-xs text-slate-500">این عملیات غیرقابل بازگشت است</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              آیا از حذف کالای <strong>«{commodityToDelete.name}»</strong> (کد {toPersianDigits(commodityToDelete.code)}) اطمینان دارید؟
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCommodityToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCommodity}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                حذف قطعی
              </button>
            </div>
          </div>
        </div>
      )}

      {warehouseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">تایید حذف انبار</h3>
                <span className="text-xs text-slate-500">این عملیات غیرقابل بازگشت است</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              آیا از حذف انبار <strong>«{warehouseToDelete.name}»</strong> اطمینان دارید؟
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setWarehouseToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteWarehouse}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                حذف قطعی
              </button>
            </div>
          </div>
        </div>
      )}

      {groupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">تایید حذف گروه کالا</h3>
                <span className="text-xs text-slate-500">کالاهای این گروه بدون گروه خواهند شد</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              آیا از حذف گروه <strong>«{groupToDelete.name}»</strong> اطمینان دارید؟
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setGroupToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteGroup}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                حذف گروه
              </button>
            </div>
          </div>
        </div>
      )}

      {/* بخش جدول با کادربندی کامل و تفکیک سطر و ستون‌ها */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {activeSubTab === 'commodities' && (
          <div>
            <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجوی سریع کالا بر اساس نام، کد، بارکد یا واحد..."
                  className="w-full text-xs pl-3 pr-9 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-sky-500 transition-all text-slate-800"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedWarehouseFilter}
                  onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
                  className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="all">همه انبارها</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>

                <select
                  value={selectedGroupFilter}
                  onChange={(e) => setSelectedGroupFilter(e.target.value)}
                  className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="all">همه گروه‌ها</option>
                  <option value="none">بدون گروه</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>

                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as any)}
                  className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="all">همه وضعیت‌ها</option>
                  <option value="in_stock">دارای موجودی</option>
                  <option value="out_of_stock">بدون موجودی</option>
                </select>

                <div className="text-xs text-slate-500 font-semibold mr-1">
                  نمایش: <span className="font-bold text-slate-800 font-mono">{toPersianDigits(filteredCommodities.length)}</span> کالا
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-slate-400 text-xs font-semibold">در حال بارگذاری اطلاعات...</div>
            ) : filteredCommodities.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">کالایی یافت نشد.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 text-[11px] font-bold">
                      <th className="py-3 px-4 text-center align-middle border-l border-slate-200">کد کالا</th>
                      <th className="py-3 px-4 text-right align-middle border-l border-slate-200">نام کالا</th>
                      <th className="py-3 px-4 text-center align-middle border-l border-slate-200">گروه / سرفصل</th>
                      <th className="py-3 px-4 text-center align-middle border-l border-slate-200">انبار مربوطه</th>
                      <th className="py-3 px-4 text-center align-middle border-l border-slate-200">موجودی انبار</th>
                      <th className="py-3 px-4 text-center align-middle border-l border-slate-200">قیمت فروش (ریال)</th>
                      <th className="py-3 px-4 text-center align-middle">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredCommodities.map((c) => {
                      const wh = warehouseMap.get(c.warehouse_id);
                      const grp = c.group_id ? groupMap.get(c.group_id) : null;
                      const hasStock = (c.current_quantity || 0) > 0;

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 text-center align-middle font-mono font-bold text-sky-700 border-l border-slate-200">
                            #{toPersianDigits(c.code)}
                          </td>
                          <td className="py-3.5 px-4 text-right align-middle font-bold text-slate-900 border-l border-slate-200">
                            <div className="flex items-center gap-2">
                              <span>{c.name}</span>
                              {c.barcode && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-100 text-slate-600 border border-slate-200">
                                  {c.barcode}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center align-middle border-l border-slate-200">
                            {grp ? (
                              <span 
                                className="text-[10px] px-2.5 py-0.5 rounded-full font-bold border inline-block"
                                style={{ backgroundColor: `${grp.color}10`, color: grp.color, borderColor: `${grp.color}30` }}
                              >
                                {grp.name}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center align-middle text-slate-700 font-medium border-l border-slate-200">
                            {wh ? wh.name : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-center align-middle border-l border-slate-200">
                            <span className={`px-2.5 py-1 rounded-xl font-bold font-mono text-xs inline-flex items-center gap-1 border ${
                              hasStock ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              {toPersianDigits(c.current_quantity || 0)} {c.unit}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center align-middle font-mono font-bold text-slate-900 border-l border-slate-200">
                            {c.sales_price ? formatMoney(c.sales_price) : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-center align-middle">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenCommodityReport(c)}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-sky-50 text-sky-700 text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                              >
                                کاردکس
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditCommodity(c)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 cursor-pointer"
                                title="ویرایش"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCommodityClick(c)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="حذف"
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
            )}
          </div>
        )}

        {activeSubTab === 'groups' && (
          <div>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجو در گروه‌های کالا..."
                  className="w-full text-xs pl-3 pr-9 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-sky-500 transition-all text-slate-800"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              </div>
              <div className="text-xs text-slate-500 font-semibold">
                مجموع گروه‌ها: <span className="font-bold text-slate-800 font-mono">{toPersianDigits(filteredGroups.length)}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              {filteredGroups.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-semibold">گروهی یافت نشد.</div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 text-[11px] font-bold">
                      <th className="py-3 px-4 text-right align-middle border-l border-slate-200">نام گروه / سرفصل</th>
                      <th className="py-3 px-4 text-center align-middle border-l border-slate-200">تعداد اقلام کالا</th>
                      <th className="py-3 px-4 text-center align-middle">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredGroups.map((g) => {
                      const count = commodities.filter((c) => c.group_id === g.id).length;
                      return (
                        <tr key={g.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 text-right align-middle font-bold text-slate-900 border-l border-slate-200">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color || '#0284c7' }} />
                              <span>{g.name}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center align-middle font-mono font-medium text-slate-700 border-l border-slate-200">
                            {toPersianDigits(count)} قلم
                          </td>
                          <td className="py-3.5 px-4 text-center align-middle">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenGroupReport(g)}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 text-indigo-700 text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                              >
                                گزارش گروه
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditGroup(g)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteGroupClick(g)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer"
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
              )}
            </div>
          </div>
        )}

        {activeSubTab === 'warehouses' && (
          <div>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجو در انبارها..."
                  className="w-full text-xs pl-3 pr-9 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-sky-500 transition-all text-slate-800"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              </div>
              <div className="text-xs text-slate-500 font-semibold">
                مجموع انبارها: <span className="font-bold text-slate-800 font-mono">{toPersianDigits(filteredWarehouses.length)}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              {filteredWarehouses.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-semibold">انباری یافت نشد.</div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 text-[11px] font-bold">
                      <th className="py-3 px-4 text-center align-middle border-l border-slate-200">کد انبار</th>
                      <th className="py-3 px-4 text-right align-middle border-l border-slate-200">نام انبار</th>
                      <th className="py-3 px-4 text-right align-middle border-l border-slate-200">آدرس / موقعیت</th>
                      <th className="py-3 px-4 text-center align-middle border-l border-slate-200">تعداد اقلام موجود</th>
                      <th className="py-3 px-4 text-center align-middle">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredWarehouses.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 text-center align-middle font-mono font-bold text-sky-700 border-l border-slate-200">
                          #{toPersianDigits(w.code)}
                        </td>
                        <td className="py-3.5 px-4 text-right align-middle font-bold text-slate-900 border-l border-slate-200">
                          {w.name}
                        </td>
                        <td className="py-3.5 px-4 text-right align-middle text-slate-600 border-l border-slate-200">
                          {w.address || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-center align-middle border-l border-slate-200">
                          <span className="px-2.5 py-0.5 rounded-full font-bold font-mono text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {toPersianDigits(w.commoditiesCount)} قلم
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center align-middle">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenWarehouseReport(w)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-sky-50 text-sky-700 text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                            >
                              گزارش انبار
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditWarehouse(w)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteWarehouseClick(w)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      <CommodityModal
        isOpen={isCommodityModalOpen}
        onClose={() => setIsCommodityModalOpen(false)}
        commodityToEdit={commodityToEdit}
        warehouses={warehouses}
        groups={groups}
        onOpenCreateGroup={() => {
          setIsCommodityModalOpen(false);
          setIsGroupModalOpen(true);
        }}
        onSuccess={loadAllData}
      />

      <CommodityGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        groupToEdit={groupToEdit}
        onSuccess={loadAllData}
      />

      <CommodityReportModal
        isOpen={isCommodityReportOpen}
        onClose={() => setIsCommodityReportOpen(false)}
        commodity={commodityForReport}
        warehouse={commodityForReport ? warehouseMap.get(commodityForReport.warehouse_id) || null : null}
        group={commodityForReport?.group_id ? groupMap.get(commodityForReport.group_id) || null : null}
      />

      <CommodityGroupReportModal
        isOpen={isGroupReportOpen}
        onClose={() => setIsGroupReportOpen(false)}
        group={groupForReport}
        commodities={commodities}
        warehouses={warehouses}
        onOpenCommodityKardex={(c) => {
          setIsGroupReportOpen(false);
          handleOpenCommodityReport(c);
        }}
      />

      <WarehouseModal
        isOpen={isWarehouseModalOpen}
        onClose={() => setIsWarehouseModalOpen(false)}
        warehouseToEdit={warehouseToEdit}
        onSuccess={loadAllData}
      />

      <WarehouseReportModal
        isOpen={isWarehouseReportOpen}
        onClose={() => setIsWarehouseReportOpen(false)}
        warehouse={warehouseForReport}
      />
    </div>
  );
};