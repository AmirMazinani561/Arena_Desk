import React, { useState, useEffect } from 'react';
import { X, Layers, Check, AlertCircle } from 'lucide-react';
import type { CommodityGroup } from '../db/types';
import { createCommodityGroup, updateCommodityGroup } from '../db/sqlite';

interface CommodityGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupToEdit: CommodityGroup | null;
  onSuccess: () => Promise<void>;
}

const PRESET_COLORS = [
  '#0284c7', // Sky
  '#2563eb', // Blue
  '#4f46e5', // Indigo
  '#7c3aed', // Purple
  '#059669', // Emerald
  '#16a34a', // Green
  '#d97706', // Amber
  '#ea580c', // Orange
  '#dc2626', // Red
  '#e11d48', // Rose
  '#475569', // Slate
];

export const CommodityGroupModal: React.FC<CommodityGroupModalProps> = ({
  isOpen,
  onClose,
  groupToEdit,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (groupToEdit) {
        setName(groupToEdit.name || '');
        setColor(groupToEdit.color || PRESET_COLORS[0]);
      } else {
        setName('');
        setColor(PRESET_COLORS[0]);
      }
    }
  }, [isOpen, groupToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('لطفاً نام گروه کالا را وارد نمایید.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (groupToEdit) {
        await updateCommodityGroup(groupToEdit.id, name, color);
      } else {
        await createCommodityGroup(name, color);
      }

      await onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to save commodity group:', err);
      setError(err?.message || 'خطا در ثبت گروه کالا.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEdit = Boolean(groupToEdit);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden transition-all animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-sky-50 to-white">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl text-white flex items-center justify-center shadow-md"
              style={{ backgroundColor: color }}
            >
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {isEdit ? 'ویرایش گروه کالا' : 'تعریف گروه کالای جدید'}
              </h2>
              <span className="text-[11px] text-slate-500 block">دسته‌بندی و سرفصل اقلام انبار</span>
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

          {/* Group Name */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              نام گروه کالا <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: مواد غذایی، قطعات یدکی، لوازم تحریر"
              className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all text-slate-800"
              required
              autoFocus
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">
              رنگ شناسه گروه
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                    color === c ? 'ring-2 ring-offset-2 ring-slate-800 scale-110 shadow-xs' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
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
              <span>{isEdit ? 'ذخیره تغییرات' : 'ایجاد گروه'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
