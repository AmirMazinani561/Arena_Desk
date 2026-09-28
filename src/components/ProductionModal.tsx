import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Flame, AlertTriangle, ChevronDown, ChevronUp, DollarSign } from 'lucide-react';
import type { Commodity, Warehouse, ProductionOrder, Invoice } from '../db/types';
import { toPersianDigits, getCurrentShamsi, separateThousands } from '../utils/dateUtils';
import { ShamsiDatePicker } from './ShamsiDatePicker';
import { insertProductionOrder, updateProductionOrder, getAllInvoices } from '../db/sqlite';

interface OutputRow {
  commodity_id: string;
  warehouse_id: string;
  quantity: string;
  note: string;
}

interface ProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderToEdit?: ProductionOrder | null;
  commodities: Commodity[];
  warehouses: Warehouse[];
  onSuccess: () => void;
}

export const ProductionModal: React.FC<ProductionModalProps> = ({
  isOpen,
  onClose,
  orderToEdit,
  commodities,
  warehouses,
  onSuccess,
}) => {
  const [dateShamsi, setDateShamsi] = useState(getCurrentShamsi().formatted);
  const [inputCommodityId, setInputCommodityId] = useState('');
  const [inputWarehouseId, setInputWarehouseId] = useState('');
  const [inputQuantity, setInputQuantity] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // استیت‌های جدید برای بخش بهای تمام‌شده
  const [showCostSection, setShowCostSection] = useState(false);
  const [purchaseInvoiceId, setPurchaseInvoiceId] = useState('');
  const [purchaseInvoiceNumber, setPurchaseInvoiceNumber] = useState<number | undefined>();
  const [inputUnitPrice, setInputUnitPrice] = useState('');
  const [wageCost, setWageCost] = useState('');
  const [transportCost, setTransportCost] = useState('');
  const [overheadCost, setOverheadCost] = useState('');
  const [availablePurchaseInvoices, setAvailablePurchaseInvoices] = useState<Invoice[]>([]);

  const [outputRows, setOutputRows] = useState<OutputRow[]>([
    { commodity_id: '', warehouse_id: '', quantity: '', note: 'محصول اصلی (شمش)' },
    { commodity_id: '', warehouse_id: '', quantity: '', note: 'خاک / سرباره کوره' },
  ]);

  // لود فاکتورهای خرید مرتبط با کالای انتخابی
  useEffect(() => {
    if (inputCommodityId) {
      getAllInvoices({ type: 'purchase' }).then((invs) => {
        const related = invs.filter((inv) =>
          inv.items?.some((it) => it.commodity_id === inputCommodityId)
        );
        setAvailablePurchaseInvoices(related);
      });
    } else {
      setAvailablePurchaseInvoices([]);
    }
  }, [inputCommodityId]);

  useEffect(() => {
    const defaultWh = warehouses[0]?.id || '';
    if (orderToEdit) {
      setDateShamsi(orderToEdit.date_shamsi);
      setInputCommodityId(orderToEdit.input_commodity_id);
      setInputWarehouseId(orderToEdit.input_warehouse_id || defaultWh);
      setInputQuantity(String(orderToEdit.input_quantity));
      setNote(orderToEdit.note || '');

      // لود اطلاعات بهای تمام‌شده در صورت وجود
      setPurchaseInvoiceId(orderToEdit.purchase_invoice_id || '');
      setPurchaseInvoiceNumber(orderToEdit.purchase_invoice_number);
      setInputUnitPrice(orderToEdit.input_unit_price ? String(orderToEdit.input_unit_price) : '');
      setWageCost(orderToEdit.wage_cost ? String(orderToEdit.wage_cost) : '');
      setTransportCost(orderToEdit.transport_cost ? String(orderToEdit.transport_cost) : '');
      setOverheadCost(orderToEdit.overhead_cost ? String(orderToEdit.overhead_cost) : '');
      if (orderToEdit.input_unit_price || orderToEdit.wage_cost || orderToEdit.purchase_invoice_id) {
        setShowCostSection(true);
      }

      if (orderToEdit.outputs && orderToEdit.outputs.length > 0) {
        setOutputRows(
          orderToEdit.outputs.map((o) => ({
            commodity_id: o.commodity_id,
            warehouse_id: o.warehouse_id || defaultWh,
            quantity: String(o.quantity),
            note: o.note || '',
          }))
        );
      }
    } else {
      setDateShamsi(getCurrentShamsi().formatted);
      setInputCommodityId('');
      setInputWarehouseId(defaultWh);
      setInputQuantity('');
      setNote('');
      setPurchaseInvoiceId('');
      setPurchaseInvoiceNumber(undefined);
      setInputUnitPrice('');
      setWageCost('');
      setTransportCost('');
      setOverheadCost('');
      setShowCostSection(false);
      setOutputRows([
        { commodity_id: '', warehouse_id: defaultWh, quantity: '', note: 'محصول اصلی (شمش)' },
        { commodity_id: '', warehouse_id: defaultWh, quantity: '', note: 'خاک / سرباره کوره' },
      ]);
    }
  }, [orderToEdit, isOpen, warehouses]);

  const numInputQty = parseFloat(inputQuantity) || 0;

  const selectedInputCommodity = useMemo(() => {
    return commodities.find((c) => c.id === inputCommodityId);
  }, [commodities, inputCommodityId]);

  // آزادی وزن قبلی در حالت ویرایش
  const maxAvailableStock = useMemo(() => {
    if (!selectedInputCommodity) return 0;
    let available = Number(selectedInputCommodity.current_quantity) || 0;
    if (orderToEdit && String(orderToEdit.input_commodity_id) === String(inputCommodityId)) {
      available += Number(orderToEdit.input_quantity) || 0;
    }
    return available;
  }, [selectedInputCommodity, orderToEdit, inputCommodityId]);

  const totalOutputQty = useMemo(() => {
    return outputRows.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
  }, [outputRows]);

  const isInputExceedsStock = numInputQty > maxAvailableStock && inputCommodityId !== '';
  const isOutputExceedsInput = totalOutputQty > numInputQty && numInputQty > 0;

  const lossQuantity = Math.max(0, numInputQty - totalOutputQty);
  const yieldPercentage = numInputQty > 0 ? (totalOutputQty / numInputQty) * 100 : 0;
  const lossPercentage = numInputQty > 0 ? (lossQuantity / numInputQty) * 100 : 0;

  // محاسبات بهای تمام‌شده
  const numRawPrice = parseFloat(inputUnitPrice) || 0;
  const numWage = parseFloat(wageCost) || 0;
  const numTransport = parseFloat(transportCost) || 0;
  const numOverhead = parseFloat(overheadCost) || 0;

  const totalRawCost = numRawPrice * numInputQty;
  const totalProductionCost = totalRawCost + numWage + numTransport + numOverhead;
  const costPerUnit = totalOutputQty > 0 && totalProductionCost > 0 ? totalProductionCost / totalOutputQty : 0;

  const handleSelectPurchaseInvoice = (invId: string) => {
    setPurchaseInvoiceId(invId);
    if (!invId) {
      setPurchaseInvoiceNumber(undefined);
      return;
    }
    const inv = availablePurchaseInvoices.find((i) => i.id === invId);
    if (inv) {
      setPurchaseInvoiceNumber(inv.invoice_number);
      const item = inv.items?.find((it) => it.commodity_id === inputCommodityId);
      if (item && item.unit_price) {
        setInputUnitPrice(String(item.unit_price));
      }
    }
  };

  const handleAddOutputRow = () => {
    const defaultWh = warehouses[0]?.id || '';
    setOutputRows((prev) => [
      ...prev,
      { commodity_id: '', warehouse_id: defaultWh, quantity: '', note: '' },
    ]);
  };

  const handleRemoveOutputRow = (index: number) => {
    setOutputRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOutputChange = (index: number, field: keyof OutputRow, val: string) => {
    setOutputRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputCommodityId) {
      alert('لطفاً ماده اولیه ورودی را انتخاب کنید.');
      return;
    }

    if (numInputQty <= 0) {
      alert('مقدار ورودی باید بزرگتر از صفر باشد.');
      return;
    }

    if (numInputQty > maxAvailableStock) {
      alert(
        `خطای موجودی انبار:\nمقدار ورودی (${toPersianDigits(numInputQty)}) از سقف مجاز برای این بچ (${toPersianDigits(maxAvailableStock)} ${selectedInputCommodity?.unit || ''}) بیشتر است.`
      );
      return;
    }

    const validOutputs = outputRows.filter((r) => r.commodity_id && (parseFloat(r.quantity) || 0) > 0);
    if (validOutputs.length === 0) {
      alert('حداقل یک محصول خروجی با مقدار معتبر وارد کنید.');
      return;
    }

    if (totalOutputQty > numInputQty) {
      alert('مجموع وزن خروجی‌ها نمی‌تواند از وزن ورودی کوره بیشتر باشد!');
      return;
    }

    setIsSubmitting(true);
    try {
      const defaultWh = warehouses[0]?.id || '';
      const formattedOutputs = validOutputs.map((o) => {
        const q = parseFloat(o.quantity) || 0;
        return {
          commodity_id: o.commodity_id,
          warehouse_id: o.warehouse_id || defaultWh,
          quantity: q,
          percentage: numInputQty > 0 ? (q / numInputQty) * 100 : 0,
          note: o.note || '',
        };
      });

      const payload = {
        date_shamsi: dateShamsi,
        input_commodity_id: inputCommodityId,
        input_warehouse_id: inputWarehouseId || defaultWh,
        input_quantity: numInputQty,
        total_output_quantity: totalOutputQty,
        loss_quantity: lossQuantity,
        yield_percentage: yieldPercentage,
        note: note || '',
        purchase_invoice_id: purchaseInvoiceId || undefined,
        purchase_invoice_number: purchaseInvoiceNumber || undefined,
        input_unit_price: numRawPrice || undefined,
        wage_cost: numWage || undefined,
        transport_cost: numTransport || undefined,
        overhead_cost: numOverhead || undefined,
        total_production_cost: totalProductionCost || undefined,
        cost_per_unit: costPerUnit || undefined,
      };

      if (orderToEdit) {
        await updateProductionOrder(orderToEdit.id, payload, formattedOutputs);
      } else {
        await insertProductionOrder(payload, formattedOutputs);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('خطا در ذخیره فرآیند تولید:\n' + (err?.message || JSON.stringify(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" dir="rtl">
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl w-[90vw] max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        
        {/* سربرگ */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                {orderToEdit ? `ویرایش فاکتور تولید #${toPersianDigits(orderToEdit.order_number)}` : 'ثبت بچ تولید و تبدیل کالا'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">ثبت مصرف مواد اولیه، تفکیک خروجی‌ها و محاسبه بهای تمام‌شده</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* بدنه فرم */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* مشخصات ماده اولیه */}
          <div className="p-4 rounded-xl border border-slate-300 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                مشخصات ماده اولیه ورودی (شارژ کوره)
              </h3>
              {selectedInputCommodity && (
                <span className="text-[11px] font-mono font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  موجودی قابل مصرف: <strong className="text-sky-700">{toPersianDigits(maxAvailableStock)}</strong> {selectedInputCommodity.unit}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">تاریخ تولید</label>
                <ShamsiDatePicker value={dateShamsi} onChange={setDateShamsi} compact showTodayButton={false} />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">کالای ورودی (مواد اولیه)</label>
                <select
                  value={inputCommodityId}
                  onChange={(e) => setInputCommodityId(e.target.value)}
                  className="w-full h-9 bg-white border border-slate-300 rounded-xl px-2 font-medium"
                  required
                >
                  <option value="">انتخاب کالا...</option>
                  {commodities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (موجودی: {toPersianDigits(c.current_quantity || 0)} {c.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">انبار مبدأ</label>
                <select
                  value={inputWarehouseId}
                  onChange={(e) => setInputWarehouseId(e.target.value)}
                  className="w-full h-9 bg-white border border-slate-300 rounded-xl px-2 font-medium"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">وزن / مقدار ورودی</label>
                <input
                  type="number"
                  step="any"
                  value={inputQuantity}
                  onChange={(e) => setInputQuantity(e.target.value)}
                  placeholder="مثال: ۱۰۰۰"
                  className={`w-full h-9 bg-white border rounded-xl px-3 font-mono font-bold text-slate-900 transition-colors ${
                    isInputExceedsStock ? 'border-rose-500 bg-rose-50 text-rose-900 ring-1 ring-rose-500' : 'border-slate-300'
                  }`}
                  required
                />
              </div>
            </div>

            {isInputExceedsStock && (
              <div className="flex items-center gap-2 p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  مقدار ورودی بیشتر از سقف مجاز است! حداکثر موجودی:{' '}
                  <strong className="font-mono text-rose-950">{toPersianDigits(maxAvailableStock)}</strong> {selectedInputCommodity?.unit}
                </span>
              </div>
            )}
          </div>

          {/* بخش اختیاری محاسبه بهای تمام‌شده و هزینه‌ها */}
          <div className="rounded-xl border border-amber-300 bg-amber-50/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCostSection(!showCostSection)}
              className="w-full p-3.5 bg-amber-100/50 hover:bg-amber-100 text-amber-950 font-bold text-xs flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-700" />
                <span>محاسبه اختیاری بهای تمام‌شده (فاکتور خرید، دستمزد، کرایه حمل و قیمت نهایی هر کیلو)</span>
              </div>
              {showCostSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showCostSection && (
              <div className="p-4 space-y-3 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">فاکتور خرید مرتبط (اختیاری)</label>
                    <select
                      value={purchaseInvoiceId}
                      onChange={(e) => handleSelectPurchaseInvoice(e.target.value)}
                      className="w-full h-9 bg-white border border-slate-300 rounded-xl px-2 font-medium"
                    >
                      <option value="">فاقد فاکتور / خرید آزاد</option>
                      {availablePurchaseInvoices.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          فاکتور #{toPersianDigits(inv.invoice_number)} ({toPersianDigits(inv.date_shamsi)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">قیمت خرید هر کیلو ماده اولیه</label>
                    <input
                      type="number"
                      step="any"
                      value={inputUnitPrice}
                      onChange={(e) => setInputUnitPrice(e.target.value)}
                      placeholder="ریال"
                      className="w-full h-9 bg-white border border-slate-300 rounded-xl px-2.5 font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">دستمزد کوره و تولید</label>
                    <input
                      type="number"
                      step="any"
                      value={wageCost}
                      onChange={(e) => setWageCost(e.target.value)}
                      placeholder="ریال"
                      className="w-full h-9 bg-white border border-slate-300 rounded-xl px-2.5 font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">کرایه حمل و باربری</label>
                    <input
                      type="number"
                      step="any"
                      value={transportCost}
                      onChange={(e) => setTransportCost(e.target.value)}
                      placeholder="ریال"
                      className="w-full h-9 bg-white border border-slate-300 rounded-xl px-2.5 font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">هزینه‌های جانبی / سوخت</label>
                    <input
                      type="number"
                      step="any"
                      value={overheadCost}
                      onChange={(e) => setOverheadCost(e.target.value)}
                      placeholder="ریال"
                      className="w-full h-9 bg-white border border-slate-300 rounded-xl px-2.5 font-mono text-slate-900"
                    />
                  </div>
                </div>

                {/* کارت نمایش بهای تمام‌شده هر کیلوگرم */}
                {costPerUnit > 0 && (
                  <div className="flex flex-wrap items-center justify-between p-3 bg-white rounded-xl border border-amber-300 text-xs shadow-2xs">
                    <div className="space-y-0.5">
                      <span className="text-slate-500">جمع کل بهای هزینه شده بچ: </span>
                      <strong className="font-mono text-slate-900 font-bold">
                        {separateThousands(String(Math.round(totalProductionCost)))} ریال
                      </strong>
                    </div>

                    <div className="bg-amber-100 text-amber-950 px-4 py-2 rounded-xl border border-amber-300 shadow-2xs flex items-center gap-2">
                      <span className="font-bold">قیمت تمام‌شده هر کیلوگرم محصول:</span>
                      <strong className="font-mono font-extrabold text-sm text-amber-900">
                        {separateThousands(String(Math.round(costPerUnit)))} ریال
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* محصولات خروجی */}
          <div className="p-4 rounded-xl border border-slate-300 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                محصولات و خروجی‌های حاصل‌شده
              </h3>
              <button
                type="button"
                onClick={handleAddOutputRow}
                className="flex items-center gap-1 text-xs text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3 py-1.5 rounded-lg font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن سطر خروجی</span>
              </button>
            </div>

            <div className="space-y-2">
              {outputRows.map((row, idx) => {
                const rowQty = parseFloat(row.quantity) || 0;
                const rowPct = numInputQty > 0 ? (rowQty / numInputQty) * 100 : 0;

                return (
                  <div key={idx} className="flex flex-wrap items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs">
                    <span className="w-5 text-center font-mono font-bold text-slate-400">{toPersianDigits(idx + 1)}</span>

                    <div className="flex-1 min-w-[170px]">
                      <select
                        value={row.commodity_id}
                        onChange={(e) => handleOutputChange(idx, 'commodity_id', e.target.value)}
                        className="w-full h-8.5 bg-white border border-slate-300 rounded-lg px-2 font-medium"
                        required
                      >
                        <option value="">انتخاب محصول خروجی...</option>
                        {commodities.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="w-36">
                      <select
                        value={row.warehouse_id}
                        onChange={(e) => handleOutputChange(idx, 'warehouse_id', e.target.value)}
                        className="w-full h-8.5 bg-white border border-slate-300 rounded-lg px-2 font-medium"
                      >
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="w-32">
                      <input
                        type="number"
                        step="any"
                        value={row.quantity}
                        onChange={(e) => handleOutputChange(idx, 'quantity', e.target.value)}
                        placeholder="وزن / مقدار"
                        className="w-full h-8.5 bg-white border border-slate-300 rounded-lg px-2.5 font-mono font-bold text-slate-900"
                        required
                      />
                    </div>

                    <div className="w-24 text-center font-mono font-bold text-slate-700 bg-white border border-slate-200 py-1.5 rounded-lg">
                      {rowPct > 0 ? `${toPersianDigits(rowPct.toFixed(1))}٪` : '۰٪'}
                    </div>

                    <div className="flex-1 min-w-[130px]">
                      <input
                        type="text"
                        value={row.note}
                        onChange={(e) => handleOutputChange(idx, 'note', e.target.value)}
                        placeholder="توضیح یا نوع محصول"
                        className="w-full h-8.5 bg-white border border-slate-300 rounded-lg px-2 text-slate-700"
                      />
                    </div>

                    {outputRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOutputRow(idx)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {isOutputExceedsInput && (
              <div className="flex items-center gap-2 p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  مجموع وزن خروجی‌ها ({toPersianDigits(totalOutputQty)}) از وزن ورودی ({toPersianDigits(numInputQty)}) بیشتر است!
                </span>
              </div>
            )}
          </div>

          {/* کارت‌های شاخص زنده موازنه کوره */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            <div className="bg-white p-3 rounded-xl border border-slate-300">
              <span className="text-[11px] text-slate-500 block mb-1">کل ورودی کوره</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {toPersianDigits(numInputQty)}
              </span>
            </div>

            <div className={`p-3 rounded-xl border ${isOutputExceedsInput ? 'bg-rose-50 border-rose-300' : 'bg-emerald-50/60 border-emerald-300'}`}>
              <span className={`text-[11px] font-bold block mb-1 ${isOutputExceedsInput ? 'text-rose-700' : 'text-emerald-800'}`}>جمع محصولات حاصله</span>
              <span className={`font-mono font-bold text-sm ${isOutputExceedsInput ? 'text-rose-900' : 'text-emerald-900'}`}>
                {toPersianDigits(totalOutputQty)}
              </span>
            </div>

            <div className={`p-3 rounded-xl border ${isOutputExceedsInput ? 'bg-rose-100 border-rose-400' : 'bg-rose-50/60 border-rose-300'}`}>
              <span className="text-[11px] text-rose-800 font-bold block mb-1">پرت و افت نامرئی کوره</span>
              <span className="font-mono font-bold text-rose-900 text-sm">
                {isOutputExceedsInput ? 'نامعتبر (منفی)' : `${toPersianDigits(lossQuantity.toFixed(1))} (${toPersianDigits(lossPercentage.toFixed(1))}٪)`}
              </span>
            </div>

            <div className="bg-sky-50/80 p-3 rounded-xl border border-sky-300">
              <span className="text-[11px] text-sky-800 font-extrabold block mb-1">راندمان نهایی بازدهی</span>
              <span className="font-mono font-extrabold text-sky-950 text-sm">
                {toPersianDigits(yieldPercentage.toFixed(1))}٪
              </span>
            </div>
          </div>

          <div>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="توضیحات تکمیلی (شیفت کاری، متصدی کوره و...)..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
            />
          </div>

          {/* دکمه‌ها */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isInputExceedsStock || isOutputExceedsInput}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'در حال ثبت...' : orderToEdit ? 'ذخیره تغییرات' : 'تأیید و ثبت در انبار'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};