import React, { useState, useEffect } from 'react';
import { X, Warehouse as WarehouseIcon, Hash, MapPin, FileText, Check, AlertCircle } from 'lucide-react';
import type { Warehouse } from '../db/types';
import { getNextWarehouseCode, createWarehouse, updateWarehouse } from '../db/sqlite';
import { toPersianDigits } from '../utils/dateUtils';

interface WarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouseToEdit: Warehouse | null;
  onSuccess: () => Promise<void>;
}

export const WarehouseModal: React.FC<WarehouseModalProps> = ({
  isOpen,
  onClose,
  warehouseToEdit,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [nextCode, setNextCode] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (warehouseToEdit) {
        setName(warehouseToEdit.name || '');
        setDescription(warehouseToEdit.description || '');
        setAddress(warehouseToEdit.address || '');
      } else {
        setName('');
        setDescription('');
        setAddress('');
        getNextWarehouseCode().then((code) => setNextCode(code));
      }
    }
  }, [isOpen, warehouseToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('لطفاً نام انبار را وارد فرمایید.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (warehouseToEdit) {
        await updateWarehouse(warehouseToEdit.id, name, description, address);
      } else {
        await createWarehouse(name, description, address);
      }

      await onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to save warehouse:', err);
      setError(err?.message || 'خطا در ثبت اطلاعات انبار.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEdit = Boolean(warehouseToEdit);
  const currentCode = isEdit ? warehouseToEdit!.code : nextCode;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden transition-all animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-sky-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20">
              <WarehouseIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {isEdit ? 'ویرایش مشخصات انبار' : 'تعریف انبار جدید'}
              </h2>
              <span className="text-[11px] text-slate-500 block">
                {isEdit ? `ویرایش اطلاعات انبار کد ${toPersianDigits(currentCode)}` : 'اختصاص خودکار کد و ثبت در سامانه'}
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Warehouse Code (Immutable) */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              کد انبار <span className="text-[10px] text-slate-400 font-normal">(سیستمی و غیرقابل تغییر)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                disabled
                value={`کد ${toPersianDigits(currentCode)}`}
                className="w-full text-xs font-bold pl-3 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed select-none"
              />
              <Hash className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            </div>
          </div>

          {/* Warehouse Name (Required) */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              نام انبار <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: انبار مرکزی، انبار مواد اولیه، انبار فروشگاه"
                className="w-full text-xs font-bold pl-3 pr-9 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all text-slate-800"
                required
                autoFocus
              />
              <WarehouseIcon className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            </div>
          </div>

          {/* Address / Location */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              آدرس یا موقعیت فیزیکی <span className="text-[10px] text-slate-400 font-normal">(اختیاری)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="مثال: سوله شماره ۲، طبقه همکف"
                className="w-full text-xs pl-3 pr-9 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all text-slate-700"
              />
              <MapPin className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              توضیحات و یادداشت <span className="text-[10px] text-slate-400 font-normal">(اختیاری)</span>
            </label>
            <div className="relative">
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="توضیحات تکمیلی درباره نوع کاربری این انبار..."
                className="w-full text-xs pl-3 pr-9 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all text-slate-700 resize-none"
              />
              <FileText className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isEdit ? 'ثبت تغییرات' : 'ایجاد انبار'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
