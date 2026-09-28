import React, { useState, useEffect } from 'react';
import { 
  X, 
  Package, 
  Hash, 
  Barcode, 
  Warehouse as WarehouseIcon, 
  Layers, 
  Boxes, 
  DollarSign, 
  Check, 
  AlertCircle,
  Plus
} from 'lucide-react';
import type { Commodity, Warehouse, CommodityGroup } from '../db/types';
import { getNextCommodityCode, createCommodity, updateCommodity } from '../db/sqlite';
import { toPersianDigits } from '../utils/dateUtils';

interface CommodityModalProps {
  isOpen: boolean;
  onClose: () => void;
  commodityToEdit: Commodity | null;
  warehouses: Warehouse[];
  groups: CommodityGroup[];
  onOpenCreateGroup?: () => void;
  onSuccess: () => Promise<void> | void;
  defaultWarehouseId?: string;
  initialName?: string;
}

const COMMON_UNITS = ['عدد', 'کیلوگرم', 'بسته', 'کارتن', 'جعبه', 'متر', 'لیتر', 'شاخه', 'طاقه', 'جفت'];

export const CommodityModal: React.FC<CommodityModalProps> = ({
  isOpen,
  onClose,
  commodityToEdit,
  warehouses,
  groups,
  onOpenCreateGroup,
  onSuccess,
  defaultWarehouseId,
  initialName = '',
}) => {
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [unit, setUnit] = useState('عدد');
  const [customUnit, setCustomUnit] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [initialQuantity, setInitialQuantity] = useState<string>('');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [salesPrice, setSalesPrice] = useState<string>('');

  const [nextCode, setNextCode] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (commodityToEdit) {
        setName(commodityToEdit.name || '');
        setBarcode(commodityToEdit.barcode || '');
        if (COMMON_UNITS.includes(commodityToEdit.unit)) {
          setUnit(commodityToEdit.unit);
          setCustomUnit('');
        } else {
          setUnit('custom');
          setCustomUnit(commodityToEdit.unit || '');
        }
        setWarehouseId(commodityToEdit.warehouse_id || '');
        setGroupId(commodityToEdit.group_id || '');
        setInitialQuantity(String(commodityToEdit.initial_quantity || '0'));
        setPurchasePrice(commodityToEdit.purchase_price ? String(commodityToEdit.purchase_price) : '');
        setSalesPrice(commodityToEdit.sales_price ? String(commodityToEdit.sales_price) : '');
      } else {
        setName(initialName || '');
        setBarcode('');
        setUnit('عدد');
        setCustomUnit('');
        const preferredWh = defaultWarehouseId && warehouses.some((w) => w.id === defaultWarehouseId)
          ? defaultWarehouseId
          : (warehouses.length > 0 ? warehouses[0].id : '');
        setWarehouseId(preferredWh);
        setGroupId(groups.length > 0 ? groups[0].id : '');
        setInitialQuantity('');
        setPurchasePrice('');
        setSalesPrice('');
        getNextCommodityCode().then((code) => setNextCode(code));
      }
    }
  }, [isOpen, commodityToEdit, warehouses, groups, defaultWarehouseId, initialName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('لطفاً نام کالا را وارد فرمایید.');
      return;
    }

    if (!warehouseId) {
      setError('انتخاب انبار کالا اجباری است. ابتدا حداقل یک انبار تعریف فرمایید.');
      return;
    }

    const finalUnit = unit === 'custom' ? customUnit.trim() || 'عدد' : unit;

    try {
      setIsSubmitting(true);
      setError(null);

      if (commodityToEdit) {
        await updateCommodity(commodityToEdit.id, {
          name,
          barcode,
          unit: finalUnit,
          warehouse_id: warehouseId,
          group_id: groupId || null,
          purchase_price: purchasePrice ? Number(purchasePrice) : 0,
          sales_price: salesPrice ? Number(salesPrice) : 0,
        });
      } else {
        await createCommodity({
          name,
          barcode,
          unit: finalUnit,
          warehouse_id: warehouseId,
          group_id: groupId || null,
          initial_quantity: initialQuantity ? Number(initialQuantity) : 0,
          purchase_price: purchasePrice ? Number(purchasePrice) : 0,
          sales_price: salesPrice ? Number(salesPrice) : 0,
        });
      }

      await onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to save commodity:', err);
      setError(err?.message || 'خطا در ثبت اطلاعات کالا.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEdit = Boolean(commodityToEdit);
  const currentCode = isEdit ? commodityToEdit!.code : nextCode;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden transition-all animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-sky-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {isEdit ? 'ویرایش اطلاعات کالا' : 'تعریف کالای جدید'}
              </h2>
              <span className="text-[11px] text-slate-500 block">
                {isEdit ? `ویرایش کالای کد ${toPersianDigits(currentCode)}` : 'تولید خودکار کد و تخصیص به انبار'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {warehouses.length === 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>هیچ انباری در سیستم وجود ندارد. لطفاً ابتدا در بخش انبارها حداقل یک انبار تعریف نمایید.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Commodity Code (Immutable) */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                کد کالا <span className="text-[10px] text-slate-400 font-normal">(سیستمی - غیرقابل تغییر)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  disabled
                  value={`کد ${toPersianDigits(currentCode)}`}
                  className="w-full text-xs font-bold pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed select-none font-mono"
                />
                <Hash className="w-4 h-4 text-slate-400 absolute right-2.5 top-3" />
              </div>
            </div>

            {/* Barcode */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                بارکد کالا <span className="text-[10px] text-slate-400 font-normal">(اختیاری)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  dir="ltr"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="مثال: 6260123456789"
                  className="w-full text-xs font-mono pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all text-left"
                />
                <Barcode className="w-4 h-4 text-slate-400 absolute right-2.5 top-3" />
              </div>
            </div>
          </div>

          {/* Commodity Name (Required) */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              نام کالا <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: شیر پاکتی کم چرب یک لیتری"
                className="w-full text-xs font-bold pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all text-slate-800"
                required
                autoFocus
              />
              <Package className="w-4 h-4 text-slate-400 absolute right-2.5 top-3" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Warehouse (Mandatory) */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                انبار کالا <span className="text-rose-500">* (اجباری)</span>
              </label>
              <div className="relative">
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full text-xs font-semibold pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 cursor-pointer"
                  required
                >
                  <option value="" disabled>-- انتخاب انبار --</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} (کد {toPersianDigits(w.code)})
                    </option>
                  ))}
                </select>
                <WarehouseIcon className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Commodity Group */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  گروه کالا <span className="text-[10px] text-slate-400 font-normal">(سرفصل)</span>
                </label>
                {onOpenCreateGroup && (
                  <button
                    type="button"
                    onClick={onOpenCreateGroup}
                    className="text-[11px] text-sky-600 hover:text-sky-800 font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>گروه جدید</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full text-xs font-semibold pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 cursor-pointer"
                >
                  <option value="">بدون گروه (سرفصل عمومی)</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <Layers className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Unit */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                واحد اندازه‌گیری <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="flex-1 text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  {COMMON_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                  <option value="custom">سایر (تایپ دستی)...</option>
                </select>
                {unit === 'custom' && (
                  <input
                    type="text"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    placeholder="واحد دلخواه"
                    className="w-24 text-xs px-2 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500"
                    required
                  />
                )}
              </div>
            </div>

            {/* Initial Quantity (Optional) */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                مقدار موجودی اولیه <span className="text-[10px] text-slate-400 font-normal">(اختیاری)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  disabled={isEdit}
                  value={initialQuantity}
                  onChange={(e) => setInitialQuantity(e.target.value)}
                  placeholder="0"
                  className="w-full text-xs font-bold pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all text-slate-800 font-mono disabled:bg-slate-100 disabled:text-slate-500"
                />
                <Boxes className="w-4 h-4 text-slate-400 absolute right-2.5 top-3" />
              </div>
              {isEdit && (
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  موجودی اولیه پس از ثبت تنها از طریق کاردکس قابل تغییر است.
                </span>
              )}
            </div>
          </div>

          {/* Pricing (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                قیمت خرید تخمینی (ریال) <span className="text-[10px] text-slate-400 font-normal">(اختیاری)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="0"
                  className="w-full text-xs pl-3 pr-8 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 font-mono text-left"
                />
                <DollarSign className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                قیمت فروش مصرف‌کننده (ریال) <span className="text-[10px] text-slate-400 font-normal">(اختیاری)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={salesPrice}
                  onChange={(e) => setSalesPrice(e.target.value)}
                  placeholder="0"
                  className="w-full text-xs pl-3 pr-8 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 font-mono text-left"
                />
                <DollarSign className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting || warehouses.length === 0}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isEdit ? 'ذخیره تغییرات' : 'ثبت و ایجاد کالا'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};