import React, { useState, useEffect } from 'react';
import { X, Printer, FileText } from 'lucide-react';
import type { Invoice, Account } from '../db/types';
import { getAllAccounts } from '../db/sqlite';
import { toPersianDigits, separateThousands, getDiagnosis } from '../utils/dateUtils';

interface InvoicePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  isOpen,
  onClose,
  invoice,
}) => {
  const [personAccount, setPersonAccount] = useState<Account | null>(null);

  useEffect(() => {
    if (invoice?.person_id) {
      getAllAccounts().then((accounts) => {
        const found = accounts.find((a) => a.id === invoice.person_id);
        setPersonAccount(found || null);
      });
    }
  }, [invoice]);

  if (!isOpen || !invoice) return null;

  const isSale = invoice.type === 'sale';
  const title = isSale ? 'فاکتور فروش کالا و خدمات' : 'فاکتور خرید کالا و خدمات';

  // محاسبه مانده قبلی و مانده نهایی برای نمایش در چاپ
  const currentBalance = personAccount?.balance || 0;
  const remainingCredit = Number(invoice.payment_remaining_amount) || 0;
  
  // اگر فاکتور از قبل ثبت شده باشد، مانده نهایی همان موجودی فعلی است
  const finalBalance = currentBalance;
  const prevBalance = isSale ? (finalBalance - remainingCredit) : (finalBalance + remainingCredit);

  const prevDiag = getDiagnosis(prevBalance);
  const finalDiag = getDiagnosis(finalBalance);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-fade-in" dir="rtl">
      {/* استایل ایزوله‌سازی دقیق چاپ برای کاغذ A4 */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm 8mm 10mm !important;
          }
          html, body {
            background: #fff !important;
            color: #000 !important;
            font-size: 9.5px !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            box-sizing: border-box !important;
            direction: rtl !important;
          }
          *, *:before, *:after {
            box-sizing: border-box !important;
          }
          body * {
            visibility: hidden;
          }
          #printable-invoice, #printable-invoice * {
            visibility: visible;
          }
          #printable-invoice {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            right: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          th, td {
            border: 1px solid #334155 !important;
            padding: 4px 3px !important;
            font-size: 8.5px !important;
            overflow: hidden !important;
            word-break: break-word !important;
            text-align: center !important;
          }
          th {
            background-color: #f8fafc !important;
            color: #0f172a !important;
          }
          .official-border {
            border: 1px solid #334155 !important;
          }
        }
      `}} />

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[96vh]">
        
        {/* نوار ابزار بالا (در چاپ نمایش داده نمی‌شود) */}
        <div className="no-print bg-slate-900 text-white px-5 py-3 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="text-sky-400" size={18} />
            <h3 className="font-bold text-sm">
              پیش‌نمایش چاپ {title} (شماره {toPersianDigits(String(invoice.invoice_number))})
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow transition-all active:scale-95 cursor-pointer"
            >
              <Printer size={15} />
              <span>چاپ فاکتور (A4)</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ناحیه فاکتور رسمی */}
        <div id="printable-invoice" className="p-6 overflow-y-auto flex-1 text-slate-800 space-y-3 print:p-0 print:m-0">
          
          {/* هدر رسمی فاکتور */}
          <div className="border border-slate-400 p-3 rounded-xl flex items-center justify-between official-border">
            <div className="space-y-0.5 text-right w-1/3">
              <h1 className="text-base font-black text-slate-900 tracking-tight">سیستم حسابداری و مالی</h1>
              <p className="text-[10px] text-slate-500 font-medium">برگه رسمی ثبت رویدادهای مالی و انبارداری</p>
            </div>

            <div className="text-center w-1/3">
              <span className="inline-block px-5 py-1.5 rounded-lg text-xs font-black border border-slate-400 bg-slate-100 text-slate-900">
                {title}
              </span>
            </div>

            <div className="text-left text-xs font-medium text-slate-700 space-y-1 w-1/3">
              <div>
                <span className="text-slate-500">شماره فاکتور: </span>
                <strong className="font-mono text-slate-900 text-sm">#{toPersianDigits(String(invoice.invoice_number))}</strong>
              </div>
              <div>
                <span className="text-slate-500">تاریخ: </span>
                <strong className="font-mono text-slate-900">{toPersianDigits(invoice.date_shamsi)}</strong>
              </div>
            </div>
          </div>

          {/* کادر مشخصات طرف حساب و انبار */}
          <div className="border border-slate-300 rounded-xl overflow-hidden official-border text-xs">
            <div className="grid grid-cols-2 divide-x divide-x-reverse divide-slate-300">
              <div className="p-2.5 bg-slate-50 text-right">
                <span className="text-slate-500 block mb-0.5 text-[10px]">
                  {isSale ? 'خریدار (طرف حساب):' : 'فروشنده (تأمین‌کننده):'}
                </span>
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-bold text-slate-900">{invoice.person_name}</strong>
                  {personAccount?.code && (
                    <span className="font-mono text-[10.5px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                      کد: {toPersianDigits(personAccount.code)}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 text-right">
                <span className="text-slate-500 block mb-0.5 text-[10px]">انبار حواله / تحویل:</span>
                <strong className="text-xs font-bold text-slate-900">{invoice.warehouse_name || '-'}</strong>
              </div>
            </div>
          </div>

          {/* جدول ردیف‌های اقلام کالا */}
          {invoice.items && invoice.items.length > 0 && (
            <div className="space-y-1">
              <table className="w-full text-xs border-collapse border border-slate-400 table-fixed">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 text-[10px] font-bold">
                    <th className="border border-slate-400 py-1.5 px-1 text-center" style={{ width: '4%' }}>ردیف</th>
                    <th className="border border-slate-400 py-1.5 px-1 text-center" style={{ width: '8%' }}>کد کالا</th>
                    <th className="border border-slate-400 py-1.5 px-3 text-right" style={{ width: '38%' }}>شرح کالا / خدمات</th>
                    <th className="border border-slate-400 py-1.5 px-1 text-center" style={{ width: '8%' }}>مقدار</th>
                    <th className="border border-slate-400 py-1.5 px-1 text-center" style={{ width: '8%' }}>واحد</th>
                    <th className="border border-slate-400 py-1.5 px-2 text-center" style={{ width: '13%' }}>قیمت واحد (ریال)</th>
                    <th className="border border-slate-400 py-1.5 px-2 text-center" style={{ width: '9%' }}>تخفیف (ریال)</th>
                    <th className="border border-slate-400 py-1.5 px-2 text-center font-bold" style={{ width: '15%' }}>مبلغ کل (ریال)</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td className="border border-slate-300 py-1 px-1 font-mono text-[10px] text-slate-500">{toPersianDigits(String(idx + 1))}</td>
                      <td className="border border-slate-300 py-1 px-1 font-mono text-[10px] text-slate-600">{toPersianDigits(String(it.commodity_code || '-'))}</td>
                      <td className="border border-slate-300 py-1 px-3 text-right font-bold text-slate-900 truncate">{it.commodity_name}</td>
                      <td className="border border-slate-300 py-1 px-1 font-mono font-bold text-slate-800">{toPersianDigits(String(it.quantity))}</td>
                      <td className="border border-slate-300 py-1 px-1 text-slate-600">{it.unit || 'عدد'}</td>
                      <td className="border border-slate-300 py-1 px-2 font-mono text-slate-800">{separateThousands(String(it.unit_price))}</td>
                      <td className="border border-slate-300 py-1 px-2 font-mono text-slate-500">{it.discount > 0 ? separateThousands(String(it.discount)) : '-'}</td>
                      <td className="border border-slate-300 py-1 px-2 font-mono font-bold text-slate-900">{separateThousands(String(it.total_price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* جدول اقلام خدمات و هزینه‌های جانبی */}
          {invoice.services && invoice.services.length > 0 && (
            <div className="space-y-1">
              <table className="w-full text-xs border-collapse border border-slate-400 table-fixed">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 text-[10px] font-bold">
                    <th className="border border-slate-400 py-1.5 px-1 text-center" style={{ width: '4%' }}>ردیف</th>
                    <th className="border border-slate-400 py-1.5 px-3 text-right" style={{ width: '54%' }}>عنوان خدمات / سرفصل جانبی</th>
                    <th className="border border-slate-400 py-1.5 px-1 text-center" style={{ width: '8%' }}>تعداد</th>
                    <th className="border border-slate-400 py-1.5 px-2 text-center" style={{ width: '17%' }}>مبلغ واحد (ریال)</th>
                    <th className="border border-slate-400 py-1.5 px-2 text-center font-bold" style={{ width: '17%' }}>مبلغ کل (ریال)</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.services.map((srv, idx) => (
                    <tr key={srv.id || idx}>
                      <td className="border border-slate-300 py-1 px-1 font-mono text-[10px] text-slate-500">{toPersianDigits(String(idx + 1))}</td>
                      <td className="border border-slate-300 py-1 px-3 text-right font-medium text-slate-900 truncate">{srv.title} ({srv.account_name})</td>
                      <td className="border border-slate-300 py-1 px-1 font-mono font-bold text-slate-800">{toPersianDigits(String(srv.quantity))}</td>
                      <td className="border border-slate-300 py-1 px-2 font-mono text-slate-800">{separateThousands(String(srv.unit_price))}</td>
                      <td className="border border-slate-300 py-1 px-2 font-mono font-bold text-slate-900">{separateThousands(String(srv.total_price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* بخش دو ستونه: جزئیات تسویه (راست) و خلاصه محاسبات فاکتور + مانده قبلی و نهایی (چپ) */}
          <div className="grid grid-cols-2 gap-3 items-start pt-1">
            
            {/* سمت راست: جزئیات پرداخت و تسویه */}
            <div className="border border-slate-300 rounded-xl p-3 bg-slate-50 space-y-1.5 text-xs official-border">
              <span className="font-bold text-slate-800 block mb-1 border-b border-slate-200 pb-1">
                اطلاعات دریافت و تسویه:
              </span>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">روش تسویه:</span>
                <strong className="text-slate-800">
                  {invoice.payment_method === 'cash' ? 'نقدی (صندوق)' :
                   invoice.payment_method === 'bank' ? 'بانکی / کارتخوان' :
                   invoice.payment_method === 'cheque' ? 'چک صیادی' :
                   invoice.payment_method === 'credit' ? 'نسیه (دفتری)' : 'ترکیبی'}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">مبلغ تسویه‌شده (نقد/بانک/چک):</span>
                <strong className="text-slate-900 font-mono font-bold">
                  {separateThousands(String(invoice.payment_settled_amount))} ریال
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">مانده نسیه این فاکتور:</span>
                <strong className="text-slate-900 font-mono font-bold">
                  {separateThousands(String(invoice.payment_remaining_amount))} ریال
                </strong>
              </div>
              {invoice.cheque_details && (
                <div className="text-[10px] text-slate-600 pt-1.5 border-t border-slate-200 leading-relaxed">
                  مشخصات چک: {toPersianDigits(invoice.cheque_details)}
                </div>
              )}
              {invoice.description && (
                <div className="text-[10px] text-slate-600 pt-1 border-t border-slate-200">
                  توضیحات: {invoice.description}
                </div>
              )}
            </div>

            {/* سمت چپ: جمع فاکتور، مانده قبلی و مانده نهایی طرف‌حساب (دقیق و تراز) */}
            <div className="border border-slate-400 rounded-xl p-3 bg-white space-y-2 text-xs official-border">
              <span className="font-bold text-slate-800 block border-b border-slate-200 pb-1">
                خلاصه وضعیت مالی و حساب:
              </span>

              {/* سطر ۱: جمع کل این صورت‌حساب */}
              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-bold">جمع کل صورت‌حساب:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-slate-900 text-sm">
                    {separateThousands(String(invoice.final_amount))}
                  </span>
                  <span className="text-[10px] text-slate-400">ریال</span>
                </div>
              </div>

              {/* سطر ۲: مانده قبلی طرف حساب */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <span className="text-slate-700 font-bold">مانده قبلی طرف‌حساب:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-slate-800">
                    {separateThousands(String(Math.abs(prevBalance)))}
                  </span>
                  <span className="text-[10px] text-slate-400">ریال</span>
                  <span className={`${prevDiag.textClass} px-1.5 py-0.2 rounded text-[10px] font-bold`}>
                    {prevDiag.label === 'بد' ? 'بدهکار' : prevDiag.label === 'بس' ? 'بستانکار' : 'بی‌حساب'}
                  </span>
                </div>
              </div>

              {/* سطر ۳: مانده نهایی پس از ثبت فاکتور */}
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-300 bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-900 font-black">مانده نهایی پس از ثبت:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-slate-950 text-sm">
                    {separateThousands(String(Math.abs(finalBalance)))}
                  </span>
                  <span className="text-[10px] text-slate-400">ریال</span>
                  <span className={`${finalDiag.textClass} px-1.5 py-0.2 rounded text-[10px] font-bold`}>
                    {finalDiag.label === 'بد' ? 'بدهکار' : finalDiag.label === 'بس' ? 'بستانکار' : 'بی‌حساب'}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* امضاها در انتهای برگه فاکتور */}
          <div className="pt-6 flex justify-between text-xs text-slate-600 px-8">
            <div className="text-center w-44">
              <span className="font-bold text-[11px]">امضای صادرکننده فاکتور</span>
              <div className="h-12 border-b border-dashed border-slate-400 mt-1" />
            </div>

            <div className="text-center w-44">
              <span className="font-bold text-[11px]">امضا و تایید دریافت‌کننده</span>
              <div className="h-12 border-b border-dashed border-slate-400 mt-1" />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};