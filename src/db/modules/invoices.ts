import type { 
  Account, 
  Invoice, 
  InvoiceType, 
  InvoiceItem, 
  InvoiceServiceItem, 
  InvoicePaymentItem, 
  PaymentMethod, 
  Commodity, 
  Cheque, 
  ChequeType, 
  ChequeStatus, 
  JournalEntry, 
  JournalItem
} from '../types';
import { getDb, isWebFallback, cleanNum, memoryStore, saveFallbackToStorage } from '../core/connection';
import { recalculateAccountBalance, getAllAccounts } from './accounts';
import { getNextEntryNumber } from './transactions';
import { getCommodityStockAtDate } from './inventory';
import { ensureCheckAccounts, getNextChequeRowNumber } from './cheques';
import { getCurrentShamsi, shamsiToGregorian } from '../../utils/dateUtils';

export async function ensureInvoiceAccounts(): Promise<{ salesRevenueId: string; purchaseInventoryId: string }> {
  const db = await getDb();
  let salesRevId = '';
  let purchInvId = '';

  if (db && !isWebFallback) {
    const revs: Account[] = await db.select(
      "SELECT * FROM accounts WHERE id = 'acc_sales_revenue_default' OR (type = 'revenue' AND (name LIKE '%فروش کالا%' OR name LIKE '%درآمد حاصل از فروش%')) LIMIT 1"
    );
    if (revs.length > 0) {
      salesRevId = revs[0].id;
    } else {
      salesRevId = 'acc_sales_revenue_default';
      await db.execute(
        `INSERT INTO accounts (id, code, name, type, color, icon, balance, initial_balance, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [salesRevId, '4001', 'درآمد حاصل از فروش کالا', 'revenue', '#10b981', 'shopping-bag', 0, 0, 1, new Date().toISOString()]
      );
    }

    const invs: Account[] = await db.select(
      "SELECT * FROM accounts WHERE id = 'acc_purchase_cost_default' OR id = 'acc_inventory_default' OR name LIKE '%خرید کالا%' OR (name LIKE '%موجودی کالا%' OR name LIKE '%موجودی انبار%') LIMIT 1"
    );
    if (invs.length > 0) {
      purchInvId = invs[0].id;
      if (invs[0].type !== 'expense' || invs[0].name.includes('موجودی')) {
        await db.execute(
          "UPDATE accounts SET name = 'خرید کالا', type = 'expense', code = '5001', color = '#ef4444', icon = 'shopping-bag' WHERE id = $1",
          [invs[0].id]
        );
      }
    } else {
      purchInvId = 'acc_purchase_cost_default';
      await db.execute(
        `INSERT INTO accounts (id, code, name, type, color, icon, balance, initial_balance, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [purchInvId, '5001', 'خرید کالا', 'expense', '#ef4444', 'shopping-bag', 0, 0, 1, new Date().toISOString()]
      );
    }
  } else {
    let rev = memoryStore.accounts.find((a) => a.id === 'acc_sales_revenue_default' || (a.type === 'revenue' && (a.name.includes('فروش کالا') || a.name.includes('درآمد حاصل از فروش'))));
    if (!rev) {
      rev = {
        id: 'acc_sales_revenue_default',
        code: '4001',
        name: 'درآمد حاصل از فروش کالا',
        type: 'revenue',
        color: '#10b981',
        icon: 'shopping-bag',
        balance: 0,
        initial_balance: 0,
        is_active: 1,
        created_at: new Date().toISOString(),
      };
      memoryStore.accounts.push(rev);
      saveFallbackToStorage();
    }
    salesRevId = rev.id;

    let inv = memoryStore.accounts.find((a) => a.id === 'acc_purchase_cost_default' || a.id === 'acc_inventory_default' || a.name.includes('خرید کالا') || a.name.includes('موجودی کالا') || a.name.includes('موجودی انبار'));
    if (!inv) {
      inv = {
        id: 'acc_purchase_cost_default',
        code: '5001',
        name: 'خرید کالا',
        type: 'expense',
        color: '#ef4444',
        icon: 'shopping-bag',
        balance: 0,
        initial_balance: 0,
        is_active: 1,
        created_at: new Date().toISOString(),
      };
      memoryStore.accounts.push(inv);
      saveFallbackToStorage();
    } else if (inv.type !== 'expense' || inv.name.includes('موجودی')) {
      inv.name = 'خرید کالا';
      inv.type = 'expense';
      inv.code = '5001';
      inv.color = '#ef4444';
      inv.icon = 'shopping-bag';
      saveFallbackToStorage();
    }
    purchInvId = inv.id;
  }

  return { salesRevenueId: salesRevId, purchaseInventoryId: purchInvId };
}

export async function getNextInvoiceNumber(type: InvoiceType): Promise<number> {
  const db = await getDb();
  if (db && !isWebFallback) {
    try {
      const res: { maxNum: number | null }[] = await db.select(
        'SELECT MAX(invoice_number) as maxNum FROM invoices WHERE type = $1',
        [type]
      );
      const max = res[0]?.maxNum;
      return typeof max === 'number' && max > 0 ? max + 1 : 1;
    } catch {
      return 1;
    }
  } else {
    const list = memoryStore.invoices.filter((inv) => inv.type === type);
    if (list.length === 0) return 1;
    const max = list.reduce((m, inv) => Math.max(m, inv.invoice_number || 0), 0);
    return max + 1;
  }
}

export async function getAllInvoices(filter?: {
  type?: InvoiceType;
  personId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Invoice[]> {
  const db = await getDb();
  let invoices: Invoice[] = [];

  if (db && !isWebFallback) {
    try {
      let q = 'SELECT * FROM invoices WHERE 1=1';
      const params: any[] = [];
      if (filter?.type) {
        q += ` AND type = $${params.length + 1}`;
        params.push(filter.type);
      }
      if (filter?.personId) {
        q += ` AND person_id = $${params.length + 1}`;
        params.push(filter.personId);
      }
      if (filter?.startDate) {
        q += ` AND date_shamsi >= $${params.length + 1}`;
        params.push(filter.startDate);
      }
      if (filter?.endDate) {
        q += ` AND date_shamsi <= $${params.length + 1}`;
        params.push(filter.endDate);
      }
      q += ' ORDER BY date DESC, invoice_number DESC';
      const rows: Invoice[] = await db.select(q, params);

      for (const inv of rows) {
        const items: InvoiceItem[] = await db.select('SELECT * FROM invoice_items WHERE invoice_id = $1', [inv.id]);
        const services: InvoiceServiceItem[] = await db.select('SELECT * FROM invoice_service_items WHERE invoice_id = $1', [inv.id]);
        const payments: InvoicePaymentItem[] = await db.select('SELECT * FROM invoice_payments WHERE invoice_id = $1', [inv.id]);
        inv.items = items || [];
        inv.services = services || [];
        inv.payments = payments || [];
      }
      invoices = rows;
    } catch (e) {
      console.error('Failed to load invoices:', e);
      invoices = [];
    }
  } else {
    let list = [...memoryStore.invoices];
    if (filter?.type) list = list.filter((i) => i.type === filter.type);
    if (filter?.personId) list = list.filter((i) => i.person_id === filter.personId);
    if (filter?.startDate) list = list.filter((i) => i.date_shamsi >= filter.startDate!);
    if (filter?.endDate) list = list.filter((i) => i.date_shamsi <= filter.endDate!);

    invoices = list.map((inv) => {
      const items = memoryStore.invoiceItems.filter((it) => it.invoice_id === inv.id);
      const services = memoryStore.invoiceServices.filter((srv) => srv.invoice_id === inv.id);
      const payments = (memoryStore.invoicePayments || []).filter((p) => p.invoice_id === inv.id);
      return {
        ...inv,
        items,
        services,
        payments,
      };
    });
    invoices.sort((a, b) => b.date.localeCompare(a.date));
  }

  return invoices;
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const rows: Invoice[] = await db.select('SELECT * FROM invoices WHERE id = $1 LIMIT 1', [id]);
    const inv = rows[0];
    if (!inv) return null;

    const items: InvoiceItem[] = await db.select('SELECT * FROM invoice_items WHERE invoice_id = $1', [inv.id]);
    const services: InvoiceServiceItem[] = await db.select('SELECT * FROM invoice_service_items WHERE invoice_id = $1', [inv.id]);
    const payments: InvoicePaymentItem[] = await db.select('SELECT * FROM invoice_payments WHERE invoice_id = $1', [inv.id]);
    inv.items = items || [];
    inv.services = services || [];
    inv.payments = payments || [];
    return inv;
  } else {
    const inv = memoryStore.invoices.find((i) => i.id === id);
    if (!inv) return null;
    const items = memoryStore.invoiceItems.filter((it) => it.invoice_id === inv.id);
    const services = memoryStore.invoiceServices.filter((srv) => srv.invoice_id === inv.id);
    const payments = (memoryStore.invoicePayments || []).filter((p) => p.invoice_id === inv.id);
    return {
      ...inv,
      items,
      services,
      payments,
    };
  }
}

export async function createInvoice(data: {
  type: InvoiceType;
  invoice_number?: number;
  date_shamsi: string;
  person_id: string;
  person_name: string;
  warehouse_id?: string;
  warehouse_name?: string;
  items: Omit<InvoiceItem, 'id' | 'invoice_id'>[];
  services?: Omit<InvoiceServiceItem, 'id' | 'invoice_id'>[];
  discount_total?: number;
  tax_amount?: number;
  payment_method: PaymentMethod;
  payments?: Omit<InvoicePaymentItem, 'id' | 'invoice_id'>[];
  cash_amount?: number;
  cash_account_id?: string;
  bank_amount?: number;
  bank_account_id?: string;
  bank_fee?: number;
  cheque_amount?: number;
  cheque_details?: string;
  cheque_number?: string;
  cheque_bank?: string;
  cheque_sayad?: string;
  cheque_due_date?: string;
  endorsed_cheque_id?: string;
  checkbook_id?: string;
  checkbook_leaf_number?: number;
  credit_amount?: number;
  description?: string;
}): Promise<Invoice> {
  const db = await getDb();
  const id = 'inv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();
  const invNumber = data.invoice_number || (await getNextInvoiceNumber(data.type));
  const gregorianDate = shamsiToGregorian(data.date_shamsi || getCurrentShamsi().formatted).toISOString();

  const totalCommodities = data.items.reduce((sum, it) => sum + (it.total_price || 0), 0);
  const servicesList = data.services || [];
  const totalServices = servicesList.reduce((sum, s) => sum + (s.total_price || 0), 0);
  const discountTotal = Number(data.discount_total) || 0;
  const taxAmount = Number(data.tax_amount) || 0;
  const finalAmount = Math.max(0, Math.round(totalCommodities + totalServices - discountTotal + taxAmount));

  const allAccounts = await getAllAccounts();
  const defaultCash =
    data.cash_account_id ||
    allAccounts.find(
      (a) =>
        a.type === 'asset' &&
        !a.name.includes('بانک') &&
        (a.name.includes('صندوق') || a.name.includes('تنخواه') || a.name.includes('نقد'))
    )?.id ||
    allAccounts.find((a) => a.type === 'asset' && !a.name.includes('بانک'))?.id ||
    '';

  const defaultBank =
    data.bank_account_id ||
    allAccounts.find(
      (a) =>
        a.type === 'asset' &&
        !a.name.includes('صندوق') &&
        !a.name.includes('تنخواه') &&
        (a.name.includes('بانک') || Boolean(a.bank_name))
    )?.id ||
    allAccounts.find((a) => a.type === 'asset')?.id ||
    '';

  let rawPayments: Omit<InvoicePaymentItem, 'id' | 'invoice_id'>[] = [];
  if (data.payments && data.payments.length > 0) {
    rawPayments = data.payments.filter((p) => Number(p.amount) > 0);
  } else if (data.payment_method === 'credit') {
    rawPayments = [];
  } else {
    if (data.payment_method === 'cash' || Number(data.cash_amount) > 0) {
      const cAmt = Number(data.cash_amount) > 0 ? Number(data.cash_amount) : finalAmount;
      const accId = data.cash_account_id || defaultCash;
      rawPayments.push({
        method: 'cash',
        amount: cAmt,
        account_id: accId,
        account_name: allAccounts.find((a) => a.id === accId)?.name || 'صندوق',
      });
    }
    if (data.payment_method === 'bank' || Number(data.bank_amount) > 0) {
      const bAmt = Number(data.bank_amount) > 0 ? Number(data.bank_amount) : finalAmount;
      const accId = data.bank_account_id || defaultBank;
      rawPayments.push({
        method: 'bank',
        amount: bAmt,
        account_id: accId,
        account_name: allAccounts.find((a) => a.id === accId)?.name || 'بانک',
        bank_fee: Number(data.bank_fee) || 0,
      });
    }
    if (data.payment_method === 'cheque' || Number(data.cheque_amount) > 0) {
      const chkAmt = Number(data.cheque_amount) > 0 ? Number(data.cheque_amount) : finalAmount;
      rawPayments.push({
        method: 'cheque',
        amount: chkAmt,
        cheque_mode: data.endorsed_cheque_id ? 'endorsed' : 'new',
        endorsed_cheque_id: data.endorsed_cheque_id,
        checkbook_id: data.checkbook_id,
        checkbook_leaf_number: data.checkbook_leaf_number,
        cheque_number: data.cheque_number,
        cheque_bank: data.cheque_bank,
        cheque_sayad: data.cheque_sayad,
        cheque_due_date: data.cheque_due_date || data.date_shamsi,
      });
    }
  }

  const settledAmount = rawPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remainingAmount = Math.max(0, finalAmount - settledAmount);
  let settlementStatus: 'settled' | 'partial' | 'unsettled' = 'settled';
  if (remainingAmount >= finalAmount && finalAmount > 0) {
    settlementStatus = 'unsettled';
  } else if (remainingAmount > 0) {
    settlementStatus = 'partial';
  }

  const finalPaymentMethod: PaymentMethod =
    rawPayments.length > 1 ? 'multi' : rawPayments[0]?.method || data.payment_method || 'credit';

  if (data.type === 'sale') {
    const itemQtyMap = new Map<string, number>();
    for (const it of data.items) {
      if (!it.commodity_id) continue;
      itemQtyMap.set(it.commodity_id, (itemQtyMap.get(it.commodity_id) || 0) + (Number(it.quantity) || 0));
    }
    for (const [commId, reqQty] of itemQtyMap.entries()) {
      const check = await getCommodityStockAtDate(commId, data.date_shamsi);
      if (reqQty > check.maxAllowedExit) {
        throw new Error(
          `موجودی کالا در تاریخ انتخابی کافی نمی‌باشد. موجودی در دسترس در تاریخ ${data.date_shamsi}: ${check.maxAllowedExit} ${check.unit}.`
        );
      }
    }
  }

  const { salesRevenueId, purchaseInventoryId } = await ensureInvoiceAccounts();
  const { notesReceivableId, notesPayableId } = await ensureCheckAccounts();
  const entryId = 'ent_inv_' + Date.now();
  const nextEntryNumber = await getNextEntryNumber();
  const titlePrefix = data.type === 'sale' ? 'فاکتور فروش' : 'فاکتور خرید';
  const entryDesc = `${titlePrefix} شماره ${invNumber} - ${data.person_name}`;

  const journalEntry: JournalEntry = {
    id: entryId,
    entry_number: nextEntryNumber,
    entry_date: gregorianDate,
    entry_date_shamsi: data.date_shamsi,
    description: entryDesc,
    source_type: 'invoice',
    status: 'final',
    created_at: now,
  };

  const journalItems: JournalItem[] = [];

  if (data.type === 'sale') {
    if (finalAmount > 0) {
      journalItems.push({
        id: 'ji_inv_' + Date.now() + '_cust_deb',
        entry_id: entryId,
        account_id: data.person_id,
        debit: finalAmount,
        credit: 0,
        note: `فاکتور فروش شماره ${invNumber}`,
      });
    }

    const netGoods = Math.max(0, totalCommodities - discountTotal);
    if (netGoods > 0) {
      journalItems.push({
        id: 'ji_inv_' + Date.now() + '_rev',
        entry_id: entryId,
        account_id: salesRevenueId,
        debit: 0,
        credit: netGoods,
        note: `درآمد حاصل از فروش کالاهای فاکتور ${invNumber}`,
      });
    }

    servicesList.forEach((srv, sIdx) => {
      journalItems.push({
        id: 'ji_inv_' + Date.now() + '_srv_' + sIdx,
        entry_id: entryId,
        account_id: srv.account_id,
        debit: 0,
        credit: srv.total_price,
        note: `${srv.title} در فاکتور ${invNumber}`,
      });
    });

    rawPayments.forEach((p, pIdx) => {
      const pAmt = Number(p.amount) || 0;
      if (pAmt <= 0) return;

      if (p.method === 'cash') {
        const cId = p.account_id || defaultCash;
        const cName = allAccounts.find((a) => a.id === cId)?.name || 'صندوق';
        journalItems.push({
          id: 'ji_inv_' + Date.now() + '_csh_' + pIdx,
          entry_id: entryId,
          account_id: cId,
          debit: pAmt,
          credit: 0,
          note: `دریافت نقدی بابت فاکتور فروش شماره ${invNumber} (${cName})`,
        });
        journalItems.push({
          id: 'ji_inv_' + Date.now() + '_csh_cust_' + pIdx,
          entry_id: entryId,
          account_id: data.person_id,
          debit: 0,
          credit: pAmt,
          note: `تسویه فاکتور ${invNumber} - دریافت نقدی (${cName})`,
        });
      } else if (p.method === 'bank') {
        const bId = p.account_id || defaultBank;
        const bName = allAccounts.find((a) => a.id === bId)?.name || 'بانک';
        const refNote = p.reference_number ? ` (پیگیری: ${p.reference_number})` : '';
        journalItems.push({
          id: 'ji_inv_' + Date.now() + '_bnk_' + pIdx,
          entry_id: entryId,
          account_id: bId,
          debit: pAmt,
          credit: 0,
          note: `واریز بانکی بابت فاکتور فروش شماره ${invNumber} به ${bName}${refNote}`,
        });
        journalItems.push({
          id: 'ji_inv_' + Date.now() + '_bnk_cust_' + pIdx,
          entry_id: entryId,
          account_id: data.person_id,
          debit: 0,
          credit: pAmt,
          note: `تسویه فاکتور ${invNumber} - واریز به ${bName}${refNote}`,
        });
      } else if (p.method === 'cheque') {
        const chkNum = p.cheque_number ? ` شماره ${p.cheque_number}` : '';
        journalItems.push({
          id: 'ji_inv_' + Date.now() + '_chk_' + pIdx,
          entry_id: entryId,
          account_id: notesReceivableId,
          debit: pAmt,
          credit: 0,
          note: `چک دریافتی بابت فاکتور فروش شماره ${invNumber}${chkNum}`,
        });
        journalItems.push({
          id: 'ji_inv_' + Date.now() + '_chk_cust_' + pIdx,
          entry_id: entryId,
          account_id: data.person_id,
          debit: 0,
          credit: pAmt,
          note: `تسویه فاکتور ${invNumber} - دریافت چک صیادی${chkNum}`,
        });
      }
    });
  } else {
    const netGoods = Math.max(0, totalCommodities - discountTotal);
    if (netGoods > 0) {
      journalItems.push({
        id: 'ji_inv_' + Date.now() + '_inv',
        entry_id: entryId,
        account_id: purchaseInventoryId,
        debit: netGoods,
        credit: 0,
        note: `افزایش موجودی کالا بابت فاکتور خرید ${invNumber}`,
      });
    }

    servicesList.forEach((srv, sIdx) => {
      journalItems.push({
        id: 'ji_inv_' + Date.now() + '_exp_' + sIdx,
        entry_id: entryId,
        account_id: srv.account_id,
        debit: srv.total_price,
        credit: 0,
        note: `${srv.title} در فاکتور خرید ${invNumber}`,
      });
    });

    if (finalAmount > 0) {
      journalItems.push({
        id: 'ji_inv_' + Date.now() + '_vend_crd',
        entry_id: entryId,
        account_id: data.person_id,
        debit: 0,
        credit: finalAmount,
        note: `فاکتور خرید شماره ${invNumber}`,
      });
    }

    rawPayments.forEach((p, pIdx) => {
      const pAmt = Number(p.amount) || 0;
      if (pAmt <= 0) return;

      if (p.method === 'cash') {
        const cId = p.account_id || defaultCash;
        const cName = allAccounts.find((a) => a.id === cId)?.name || 'صندوق';
        journalItems.push({
          id: 'ji_inv_' + Date.now() + '_csh_vend_' + pIdx,
          entry_id: entryId,
          account_id: data.person_id,
          debit: pAmt,
          credit: 0,
          note: `تسویه فاکتور ${invNumber} - پرداخت نقدی (${cName})`,
        });
        journalItems.push({
          id: 'ji_inv_' + Date.now() + '_csh_out_' + pIdx,
          entry_id: entryId,
          account_id: cId,
          debit: 0,
          credit: pAmt,
          note: `پرداخت نقدی بابت فاکتور خرید شماره ${invNumber} (${cName})`,
        });
      } else if (p.method === 'bank') {
        const bId = p.account_id || defaultBank;
        const bName = allAccounts.find((a) => a.id === bId)?.name || 'بانک';
        const refNote = p.reference_number ? ` (پیگیری: ${p.reference_number})` : '';
        journalItems.push({
          id: 'ji_inv_' + Date.now() + '_bnk_vend_' + pIdx,
          entry_id: entryId,
          account_id: data.person_id,
          debit: pAmt,
          credit: 0,
          note: `تسویه فاکتور ${invNumber} - پرداخت بانکی از ${bName}${refNote}`,
        });
        journalItems.push({
          id: 'ji_inv_' + Date.now() + '_bnk_out_' + pIdx,
          entry_id: entryId,
          account_id: bId,
          debit: 0,
          credit: pAmt,
          note: `پرداخت بانکی بابت فاکتور خرید شماره ${invNumber} از ${bName}${refNote}`,
        });
      } else if (p.method === 'cheque') {
        const isEndorsed = Boolean(p.endorsed_cheque_id || p.cheque_mode === 'endorsed');
        const chkNum = p.cheque_number ? ` شماره ${p.cheque_number}` : '';
        journalItems.push({
          id: 'ji_inv_' + Date.now() + '_chk_vend_' + pIdx,
          entry_id: entryId,
          account_id: data.person_id,
          debit: pAmt,
          credit: 0,
          note: `تسویه فاکتور ${invNumber} - ${isEndorsed ? 'واگذاری چک دریافتی' : 'صدور چک'}${chkNum}`,
        });
        journalItems.push({
          id: 'ji_inv_' + Date.now() + '_chk_out_' + pIdx,
          entry_id: entryId,
          account_id: isEndorsed ? notesReceivableId : notesPayableId,
          debit: 0,
          credit: pAmt,
          note: (isEndorsed ? 'واگذاری چک دریافتی' : 'صدور چک') + ` بابت فاکتور خرید شماره ${invNumber}${chkNum}`,
        });
      }
    });
  }

  for (let pIdx = 0; pIdx < rawPayments.length; pIdx++) {
    const p = rawPayments[pIdx];
    const bFee = Number(p.bank_fee) || 0;
    if (p.method === 'bank' && bFee > 0) {
      const bId = p.account_id || defaultBank;
      let bankFeeAccId = 'acc_exp_bank_fee';
      if (db && !isWebFallback) {
        const feeAccCheck: Account[] = await db.select(
          "SELECT * FROM accounts WHERE id = 'acc_exp_bank_fee' OR (type = 'expense' AND name LIKE '%کارمزد%') LIMIT 1"
        );
        if (feeAccCheck.length === 0) {
          await db.execute(
            `INSERT INTO accounts (id, code, name, type, color, balance, is_active, created_at)
             VALUES ('acc_exp_bank_fee', '1099', 'کارمزد خدمات بانکی', 'expense', '#f59e0b', 0, 1, $1)`,
            [now]
          );
        } else {
          bankFeeAccId = feeAccCheck[0].id;
        }
      } else {
        let feeAcc = memoryStore.accounts.find((a) => a.id === 'acc_exp_bank_fee' || (a.type === 'expense' && a.name.includes('کارمزد')));
        if (!feeAcc) {
          feeAcc = {
            id: 'acc_exp_bank_fee',
            code: '1099',
            name: 'کارمزد خدمات بانکی',
            type: 'expense',
            color: '#f59e0b',
            balance: 0,
            is_active: 1,
            created_at: now,
          };
          memoryStore.accounts.push(feeAcc);
        }
        bankFeeAccId = feeAcc.id;
      }

      journalItems.push({
        id: 'ji_inv_' + Date.now() + '_fee_deb_' + pIdx,
        entry_id: entryId,
        account_id: bankFeeAccId,
        debit: bFee,
        credit: 0,
        note: `کارمزد خدمات بانکی فاکتور شماره ${invNumber}`,
      });

      journalItems.push({
        id: 'ji_inv_' + Date.now() + '_fee_crd_' + pIdx,
        entry_id: entryId,
        account_id: bId,
        debit: 0,
        credit: bFee,
        note: `کسر کارمزد بانکی فاکتور شماره ${invNumber}`,
      });
    }
  }

  const invoicePaymentsList: InvoicePaymentItem[] = rawPayments.map((p, idx) => ({
    id: 'ivpay_' + Date.now() + '_' + idx,
    invoice_id: id,
    method: p.method,
    amount: Number(p.amount) || 0,
    account_id: p.account_id || (p.method === 'cash' ? defaultCash : defaultBank),
    account_name: p.account_name || allAccounts.find((a) => a.id === p.account_id)?.name || '',
    bank_fee: Number(p.bank_fee) || 0,
    reference_number: p.reference_number || '',
    cheque_mode: p.cheque_mode || (p.endorsed_cheque_id ? 'endorsed' : 'new'),
    endorsed_cheque_id: p.endorsed_cheque_id || undefined,
    checkbook_id: p.checkbook_id || undefined,
    checkbook_leaf_number: p.checkbook_leaf_number || undefined,
    cheque_number: p.cheque_number || '',
    cheque_bank: p.cheque_bank || '',
    cheque_sayad: p.cheque_sayad || '',
    cheque_due_date: p.cheque_due_date || data.date_shamsi,
    description: p.description || '',
  }));

  const invoiceRecord: Invoice = {
    id,
    invoice_number: invNumber,
    type: data.type,
    date: gregorianDate,
    date_shamsi: data.date_shamsi,
    person_id: data.person_id,
    person_name: data.person_name,
    warehouse_id: data.warehouse_id,
    warehouse_name: data.warehouse_name,
    total_commodities_amount: totalCommodities,
    total_services_amount: totalServices,
    discount_total: discountTotal,
    tax_amount: taxAmount,
    final_amount: finalAmount,
    payment_method: finalPaymentMethod,
    payment_settled_amount: settledAmount,
    payment_remaining_amount: remainingAmount,
    settlement_status: settlementStatus,
    cash_account_id: defaultCash,
    bank_account_id: defaultBank,
    bank_fee: rawPayments.reduce((s, p) => s + (p.bank_fee || 0), 0),
    cheque_details: data.cheque_details || '',
    checkbook_id: data.checkbook_id,
    checkbook_leaf_number: data.checkbook_leaf_number,
    entry_id: entryId,
    description: data.description || '',
    items: [],
    services: [],
    payments: invoicePaymentsList,
    created_at: now,
  };

  const invoiceItemsList: InvoiceItem[] = data.items.map((it, idx) => ({
    id: 'ivit_' + Date.now() + '_' + idx,
    invoice_id: id,
    commodity_id: it.commodity_id,
    commodity_name: it.commodity_name,
    commodity_code: it.commodity_code,
    unit: it.unit || 'عدد',
    quantity: cleanNum(Number(it.quantity) || 1),
    unit_price: Number(it.unit_price) || 0,
    discount: Number(it.discount) || 0,
    total_price: Number(it.total_price) || 0,
    description: it.description || '',
  }));

  const invoiceServicesList: InvoiceServiceItem[] = servicesList.map((srv, idx) => ({
    id: 'ivsrv_' + Date.now() + '_' + idx,
    invoice_id: id,
    account_id: srv.account_id,
    account_name: srv.account_name,
    title: srv.title,
    quantity: cleanNum(Number(srv.quantity) || 1),
    unit_price: Number(srv.unit_price) || 0,
    total_price: Number(srv.total_price) || 0,
  }));

  invoiceRecord.items = invoiceItemsList;
  invoiceRecord.services = invoiceServicesList;

  if (db && !isWebFallback) {
    await db.execute(
      `INSERT INTO invoices (
        id, invoice_number, type, date, date_shamsi, person_id, person_name,
        warehouse_id, warehouse_name, total_commodities_amount, total_services_amount,
        discount_total, tax_amount, final_amount, payment_method, payment_settled_amount,
        payment_remaining_amount, settlement_status, cash_account_id, bank_account_id,
        cheque_details, entry_id, description, checkbook_id, checkbook_leaf_number, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)`,
      [
        invoiceRecord.id, invoiceRecord.invoice_number, invoiceRecord.type, invoiceRecord.date, invoiceRecord.date_shamsi,
        invoiceRecord.person_id, invoiceRecord.person_name, invoiceRecord.warehouse_id || null, invoiceRecord.warehouse_name || null,
        invoiceRecord.total_commodities_amount, invoiceRecord.total_services_amount, invoiceRecord.discount_total,
        invoiceRecord.tax_amount, invoiceRecord.final_amount, invoiceRecord.payment_method, invoiceRecord.payment_settled_amount,
        invoiceRecord.payment_remaining_amount, invoiceRecord.settlement_status, invoiceRecord.cash_account_id || null,
        invoiceRecord.bank_account_id || null, invoiceRecord.cheque_details || '', invoiceRecord.entry_id,
        invoiceRecord.description || '', invoiceRecord.checkbook_id || null, invoiceRecord.checkbook_leaf_number || null, invoiceRecord.created_at,
      ]
    );

    for (const it of invoiceItemsList) {
      await db.execute(
        `INSERT INTO invoice_items (id, invoice_id, commodity_id, commodity_name, commodity_code, unit, quantity, unit_price, discount, total_price, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [it.id, it.invoice_id, it.commodity_id, it.commodity_name, it.commodity_code, it.unit, it.quantity, it.unit_price, it.discount, it.total_price, it.description || '']
      );
    }

    for (const srv of invoiceServicesList) {
      await db.execute(
        `INSERT INTO invoice_service_items (id, invoice_id, account_id, account_name, title, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [srv.id, srv.invoice_id, srv.account_id, srv.account_name, srv.title, srv.quantity, srv.unit_price, srv.total_price]
      );
    }

    for (const p of invoicePaymentsList) {
      await db.execute(
        `INSERT INTO invoice_payments (
          id, invoice_id, method, amount, account_id, account_name, bank_fee, reference_number,
          cheque_mode, endorsed_cheque_id, checkbook_id, checkbook_leaf_number,
          cheque_number, cheque_bank, cheque_sayad, cheque_due_date, description, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          p.id, p.invoice_id, p.method, p.amount, p.account_id || null, p.account_name || null,
          p.bank_fee || 0, p.reference_number || null, p.cheque_mode || null, p.endorsed_cheque_id || null,
          p.checkbook_id || null, p.checkbook_leaf_number || null, p.cheque_number || null,
          p.cheque_bank || null, p.cheque_sayad || null, p.cheque_due_date || null,
          p.description || null, now
        ]
      );
    }

    for (const it of invoiceItemsList) {
      const commRows: Commodity[] = await db.select('SELECT * FROM commodities WHERE id = $1', [it.commodity_id]);
      const comm = commRows[0];
      if (comm) {
        const delta = data.type === 'purchase' ? it.quantity : -it.quantity;
        const newQty = cleanNum((comm.current_quantity || 0) + delta);
        await db.execute('UPDATE commodities SET current_quantity = $1 WHERE id = $2', [newQty, it.commodity_id]);

        const transId = 'ct_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        await db.execute(
          `INSERT INTO commodity_transactions (id, commodity_id, warehouse_id, type, quantity, balance_after, date, date_shamsi, reference, description, invoice_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            transId,
            it.commodity_id,
            data.warehouse_id || comm.warehouse_id,
            data.type === 'purchase' ? 'in' : 'out',
            cleanNum(it.quantity),
            newQty,
            gregorianDate,
            data.date_shamsi,
            `${titlePrefix} شماره ${invNumber}`,
            `طرف حساب: ${data.person_name}`,
            id,
            now,
          ]
        );
      }
    }

    if (journalItems.length > 0) {
      await db.execute(
        `INSERT INTO journal_entries (id, entry_number, entry_date, entry_date_shamsi, description, source_type, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [journalEntry.id, journalEntry.entry_number, journalEntry.entry_date, journalEntry.entry_date_shamsi, journalEntry.description, journalEntry.source_type, journalEntry.status, journalEntry.created_at]
      );

      for (const ji of journalItems) {
        await db.execute(
          `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note) VALUES ($1, $2, $3, $4, $5, $6)`,
          [ji.id, ji.entry_id, ji.account_id, ji.debit, ji.credit, ji.note]
        );
      }

      const affected = Array.from(new Set(journalItems.map(i => i.account_id)));
      for (const accId of affected) {
        await recalculateAccountBalance(accId);
      }
    }

    const chequePayments = rawPayments.filter((p) => p.method === 'cheque' && Number(p.amount) > 0);
    for (let cIdx = 0; cIdx < chequePayments.length; cIdx++) {
      const cp = chequePayments[cIdx];
      const cpAmt = Number(cp.amount);
      if (data.type === 'purchase' && (cp.endorsed_cheque_id || cp.cheque_mode === 'endorsed')) {
        const endorseDesc = `واگذار شده بابت فاکتور خرید شماره ${invNumber} به ${data.person_name}`;
        await db.execute(
          `UPDATE cheques SET status = 'assigned', assigned_to_person_id = $1, location = $2, status_description = $3 WHERE id = $4`,
          [data.person_id, `واگذار شده به ${data.person_name}`, endorseDesc, cp.endorsed_cheque_id]
        );
      } else {
        const chkType: ChequeType = data.type === 'sale' ? 'received' : 'issued';
        const chkStatus: ChequeStatus = data.type === 'sale' ? 'in_safe' : 'issued';
        const chkRow = await getNextChequeRowNumber(chkType);
        const chkId = 'chk_inv_' + Date.now() + '_' + cIdx;
        const chkNumber = cp.cheque_number?.trim() || (data.cheque_details ? data.cheque_details.slice(0, 30) : `چک فاکتور ${invNumber}`);
        const chkBank = cp.cheque_bank?.trim() || 'بانک';
        const chkSayad = cp.cheque_sayad?.trim() || '';
        const chkDueDate = cp.cheque_due_date?.trim() || data.date_shamsi;

        if (chkType === 'issued' && chkNumber) {
          const existingChk: any[] = await db.select(
            "SELECT id FROM cheques WHERE type = 'issued' AND status != 'voided' AND check_number = $1",
            [chkNumber]
          );
          if (existingChk.length > 0) {
            throw new Error(`چک صادره با شماره «${chkNumber}» قبلاً در سیستم ثبت شده است.`);
          }
          if (chkSayad) {
            const existingSayad: any[] = await db.select(
              "SELECT id FROM cheques WHERE type = 'issued' AND status != 'voided' AND sayad_id = $1",
              [chkSayad]
            );
            if (existingSayad.length > 0) {
              throw new Error(`چک صادره با شناسه صیادی «${chkSayad}» قبلاً در سیستم ثبت شده است.`);
            }
          }
        }

        await db.execute(
          `INSERT INTO cheques (
            id, type, check_number, sayad_id, amount, due_date_shamsi, issue_date_shamsi,
            bank_name, branch, account_number, sheba, row_number, location, status,
            status_description, person_id, person_name, checkbook_id, checkbook_leaf_number,
            clearing_bank_id, assigned_to_person_id, entry_id, description, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
          [
            chkId, chkType, chkNumber, chkSayad || null, cpAmt,
            chkDueDate, data.date_shamsi, chkBank, null,
            null, null, chkRow, data.type === 'sale' ? 'نزد صندوق' : 'صادرشده', chkStatus,
            `ثبت خودکار از ${titlePrefix} شماره ${invNumber}`, data.person_id, data.person_name, cp.checkbook_id || null, cp.checkbook_leaf_number || null,
            null, null, entryId, `بابت ${titlePrefix} شماره ${invNumber} - ${data.person_name}`, now
          ]
        );
      }
    }
  } else {
    memoryStore.invoices.unshift(invoiceRecord);
    memoryStore.invoiceItems.push(...invoiceItemsList);
    memoryStore.invoiceServices.push(...invoiceServicesList);
    memoryStore.invoicePayments = memoryStore.invoicePayments || [];
    memoryStore.invoicePayments.push(...invoicePaymentsList);

    for (const it of invoiceItemsList) {
      const comm = memoryStore.commodities.find((c) => c.id === it.commodity_id);
      if (comm) {
        const delta = data.type === 'purchase' ? it.quantity : -it.quantity;
        comm.current_quantity = cleanNum((comm.current_quantity || 0) + delta);

        memoryStore.commodityTransactions.push({
          id: 'ct_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          commodity_id: it.commodity_id,
          warehouse_id: data.warehouse_id || comm.warehouse_id,
          type: data.type === 'purchase' ? 'in' : 'out',
          quantity: cleanNum(it.quantity),
          balance_after: comm.current_quantity,
          date: gregorianDate,
          date_shamsi: data.date_shamsi,
          reference: `${titlePrefix} شماره ${invNumber}`,
          description: `طرف حساب: ${data.person_name}`,
          invoice_id: id,
          created_at: now,
        });
      }
    }

    if (journalItems.length > 0) {
      memoryStore.entries.unshift(journalEntry);
      memoryStore.items.push(...journalItems);
      const affected = Array.from(new Set(journalItems.map(i => i.account_id)));
      for (const accId of affected) {
        await recalculateAccountBalance(accId);
      }
    }

    const chequePayments = rawPayments.filter((p) => p.method === 'cheque' && Number(p.amount) > 0);
    for (let cIdx = 0; cIdx < chequePayments.length; cIdx++) {
      const cp = chequePayments[cIdx];
      const cpAmt = Number(cp.amount);
      if (data.type === 'purchase' && (cp.endorsed_cheque_id || cp.cheque_mode === 'endorsed')) {
        const chk = memoryStore.cheques.find((c) => c.id === cp.endorsed_cheque_id);
        if (chk) {
          chk.status = 'assigned';
          chk.assigned_to_person_id = data.person_id;
          chk.location = `واگذار شده به ${data.person_name}`;
          chk.status_description = `واگذار شده بابت فاکتور خرید شماره ${invNumber} به ${data.person_name}`;
        }
      } else {
        const chkType: ChequeType = data.type === 'sale' ? 'received' : 'issued';
        const chkStatus: ChequeStatus = data.type === 'sale' ? 'in_safe' : 'issued';
        const chkRow = await getNextChequeRowNumber(chkType);
        const chkId = 'chk_inv_' + Date.now() + '_' + cIdx;
        const chkNumber = cp.cheque_number?.trim() || (data.cheque_details ? data.cheque_details.slice(0, 30) : `چک فاکتور ${invNumber}`);
        const chkBank = cp.cheque_bank?.trim() || 'بانک';
        const chkSayad = cp.cheque_sayad?.trim() || '';
        const chkDueDate = cp.cheque_due_date?.trim() || data.date_shamsi;

        if (chkType === 'issued' && chkNumber) {
          const dup = memoryStore.cheques.find(
            (c) =>
              c.type === 'issued' &&
              c.status !== 'voided' &&
              ((chkNumber && c.check_number === chkNumber) || (chkSayad && c.sayad_id === chkSayad))
          );
          if (dup) {
            throw new Error(`چک صادره با شماره «${chkNumber || chkSayad}» قبلاً در سیستم ثبت شده است.`);
          }
        }

        memoryStore.cheques.push({
          id: chkId,
          type: chkType,
          check_number: chkNumber,
          sayad_id: chkSayad,
          amount: cpAmt,
          due_date_shamsi: chkDueDate,
          issue_date_shamsi: data.date_shamsi,
          bank_name: chkBank,
          row_number: chkRow,
          location: data.type === 'sale' ? 'نزد صندوق' : 'صادرشده',
          status: chkStatus,
          status_description: `ثبت خودکار از ${titlePrefix} شماره ${invNumber}`,
          person_id: data.person_id,
          person_name: data.person_name,
          checkbook_id: cp.checkbook_id,
          checkbook_leaf_number: cp.checkbook_leaf_number,
          entry_id: entryId,
          description: `بابت ${titlePrefix} شماره ${invNumber} - ${data.person_name}`,
          created_at: now,
        });
      }
    }

    saveFallbackToStorage();
  }

  return invoiceRecord;
}

export async function deleteInvoice(id: string): Promise<void> {
  const inv = await getInvoiceById(id);
  if (!inv) return;

  const db = await getDb();
  const titlePrefix = inv.type === 'sale' ? 'فاکتور فروش' : 'فاکتور خرید';
  const refStr = `${titlePrefix} شماره ${inv.invoice_number}`;
  const endorseRef = `بابت فاکتور خرید شماره ${inv.invoice_number}`;

  if (db && !isWebFallback) {
    let attachedCheques: Cheque[] = [];
    if (inv.entry_id) {
      attachedCheques = await db.select('SELECT * FROM cheques WHERE entry_id = $1', [inv.entry_id]);
    }
    if (attachedCheques.length === 0 && inv.invoice_number) {
      attachedCheques = await db.select(
        'SELECT * FROM cheques WHERE description LIKE $1 OR status_description LIKE $1',
        [`%${refStr}%`]
      );
    }

    for (const chk of attachedCheques) {
      if (chk.type === 'received' && chk.status !== 'in_safe') {
        throw new Error('امکان حذف فاکتور وجود ندارد؛ ابتدا وضعیت چک‌های وابسته را به حالت اولیه بازگردانید.');
      }
      if (chk.type === 'issued' && chk.status !== 'issued') {
        throw new Error('امکان حذف فاکتور وجود ندارد؛ ابتدا وضعیت چک‌های وابسته را به حالت اولیه بازگردانید.');
      }
    }

    if (inv.type === 'purchase') {
      const endorsedCheques: Cheque[] = await db.select(
        "SELECT * FROM cheques WHERE type = 'received' AND (status_description LIKE $1 OR description LIKE $1)",
        [`%${endorseRef}%`]
      );
      for (const echk of endorsedCheques) {
        if (echk.status !== 'assigned') {
          throw new Error('امکان حذف فاکتور وجود ندارد؛ ابتدا وضعیت چک‌های وابسته را به حالت اولیه بازگردانید.');
        }
      }
    }

    for (const it of inv.items) {
      const commRows: Commodity[] = await db.select('SELECT * FROM commodities WHERE id = $1', [it.commodity_id]);
      const comm = commRows[0];
      if (comm) {
        const reverseDelta = inv.type === 'purchase' ? -it.quantity : it.quantity;
        const restoredQty = cleanNum((comm.current_quantity || 0) + reverseDelta);
        await db.execute('UPDATE commodities SET current_quantity = $1 WHERE id = $2', [restoredQty, it.commodity_id]);
      }
    }

    await db.execute('DELETE FROM commodity_transactions WHERE invoice_id = $1 OR reference LIKE $2', [id, `%${refStr}%`]);

    await db.execute(
      `UPDATE cheques SET status = 'in_safe', assigned_to_person_id = NULL, location = 'نزد صندوق', status_description = 'موجود نزد صندوق'
       WHERE type = 'received' AND status = 'assigned' AND (status_description LIKE $1 OR description LIKE $1)`,
      [`%${endorseRef}%`]
    );

    if (inv.entry_id) {
      await db.execute("DELETE FROM cheques WHERE entry_id = $1 AND status != 'assigned'", [inv.entry_id]);
    }
    if (attachedCheques.length > 0) {
      for (const chk of attachedCheques) {
        if (chk.status === 'in_safe' || chk.status === 'issued') {
          await db.execute('DELETE FROM cheques WHERE id = $1', [chk.id]);
        }
      }
    }

    let affectedAccounts: string[] = [];
    if (inv.entry_id) {
      const items: JournalItem[] = await db.select('SELECT account_id FROM journal_items WHERE entry_id = $1', [inv.entry_id]);
      affectedAccounts = items.map(i => i.account_id);
      await db.execute('DELETE FROM journal_items WHERE entry_id = $1', [inv.entry_id]);
      await db.execute('DELETE FROM journal_entries WHERE id = $1', [inv.entry_id]);
    } else {
      const matchEntries: any[] = await db.select(
        "SELECT id FROM journal_entries WHERE source_type = 'invoice' AND (description LIKE $1 OR description LIKE $2)",
        [`%${refStr}%`, `%${titlePrefix} شماره ${inv.invoice_number}%`]
      );
      for (const me of matchEntries) {
        const items: JournalItem[] = await db.select('SELECT account_id FROM journal_items WHERE entry_id = $1', [me.id]);
        affectedAccounts.push(...items.map(i => i.account_id));
        await db.execute('DELETE FROM journal_items WHERE entry_id = $1', [me.id]);
        await db.execute('DELETE FROM journal_entries WHERE id = $1', [me.id]);
      }
    }

    await db.execute('DELETE FROM invoice_payments WHERE invoice_id = $1', [id]);
    await db.execute('DELETE FROM invoice_items WHERE invoice_id = $1', [id]);
    await db.execute('DELETE FROM invoice_service_items WHERE invoice_id = $1', [id]);
    await db.execute('DELETE FROM invoices WHERE id = $1', [id]);

    for (const accId of Array.from(new Set(affectedAccounts))) {
      await recalculateAccountBalance(accId);
    }
  } else {
    const attachedCheques = memoryStore.cheques.filter(
      (c) =>
        (inv.entry_id && c.entry_id === inv.entry_id) ||
        (c.description && c.description.includes(refStr)) ||
        (c.status_description && c.status_description.includes(refStr))
    );

    for (const chk of attachedCheques) {
      if (chk.type === 'received' && chk.status !== 'in_safe') {
        throw new Error('امکان حذف فاکتور وجود ندارد؛ ابتدا وضعیت چک‌های وابسته را به حالت اولیه بازگردانید.');
      }
      if (chk.type === 'issued' && chk.status !== 'issued') {
        throw new Error('امکان حذف فاکتور وجود ندارد؛ ابتدا وضعیت چک‌های وابسته را به حالت اولیه بازگردانید.');
      }
    }

    if (inv.type === 'purchase') {
      const endorsedCheques = memoryStore.cheques.filter(
        (c) =>
          c.type === 'received' &&
          ((c.status_description && c.status_description.includes(endorseRef)) ||
            (c.description && c.description.includes(endorseRef)))
      );
      for (const echk of endorsedCheques) {
        if (echk.status !== 'assigned') {
          throw new Error('امکان حذف فاکتور وجود ندارد؛ ابتدا وضعیت چک‌های وابسته را به حالت اولیه بازگردانید.');
        }
      }
    }

    for (const it of inv.items) {
      const comm = memoryStore.commodities.find((c) => c.id === it.commodity_id);
      if (comm) {
        const reverseDelta = inv.type === 'purchase' ? -it.quantity : it.quantity;
        comm.current_quantity = cleanNum((comm.current_quantity || 0) + reverseDelta);
      }
    }

    memoryStore.commodityTransactions = memoryStore.commodityTransactions.filter(
      (ct) => (ct as any).invoice_id !== id && (!ct.reference || !ct.reference.includes(refStr))
    );

    for (const c of memoryStore.cheques) {
      if (
        c.type === 'received' &&
        c.status === 'assigned' &&
        ((c.status_description && c.status_description.includes(endorseRef)) ||
          (c.description && c.description.includes(endorseRef)))
      ) {
        c.status = 'in_safe';
        c.assigned_to_person_id = undefined;
        c.location = 'نزد صندوق';
        c.status_description = 'موجود نزد صندوق';
      }
    }

    const chkIdsToDelete = new Set(attachedCheques.map((c) => c.id));
    memoryStore.cheques = memoryStore.cheques.filter(
      (c) => !chkIdsToDelete.has(c.id) && (inv.entry_id ? c.entry_id !== inv.entry_id : true)
    );

    let affectedAccounts: string[] = [];
    if (inv.entry_id) {
      const items = memoryStore.items.filter((ji) => ji.entry_id === inv.entry_id);
      affectedAccounts = items.map(i => i.account_id);
      memoryStore.items = memoryStore.items.filter((ji) => ji.entry_id !== inv.entry_id);
      memoryStore.entries = memoryStore.entries.filter((je) => je.id !== inv.entry_id);
    } else {
      const orphanEntries = memoryStore.entries.filter(
        (je) => je.source_type === 'invoice' && je.description && je.description.includes(refStr)
      );
      const orphanEntryIds = new Set(orphanEntries.map((e) => e.id));
      const items = memoryStore.items.filter((ji) => orphanEntryIds.has(ji.entry_id));
      affectedAccounts = items.map(i => i.account_id);
      memoryStore.items = memoryStore.items.filter((ji) => !orphanEntryIds.has(ji.entry_id));
      memoryStore.entries = memoryStore.entries.filter((je) => !orphanEntryIds.has(je.id));
    }

    memoryStore.invoicePayments = (memoryStore.invoicePayments || []).filter((p) => p.invoice_id !== id);
    memoryStore.invoiceItems = memoryStore.invoiceItems.filter((it) => it.invoice_id !== id);
    memoryStore.invoiceServices = memoryStore.invoiceServices.filter((srv) => srv.invoice_id !== id);
    memoryStore.invoices = memoryStore.invoices.filter((i) => i.id !== id);

    for (const accId of Array.from(new Set(affectedAccounts))) {
      await recalculateAccountBalance(accId);
    }
    saveFallbackToStorage();
  }
}

export async function updateInvoice(
  id: string,
  data: {
    type: InvoiceType;
    invoice_number?: number;
    date_shamsi: string;
    person_id: string;
    person_name: string;
    warehouse_id?: string;
    warehouse_name?: string;
    items: Omit<InvoiceItem, 'id' | 'invoice_id'>[];
    services?: Omit<InvoiceServiceItem, 'id' | 'invoice_id'>[];
    discount_total?: number;
    tax_amount?: number;
    payment_method: PaymentMethod;
    payments?: Omit<InvoicePaymentItem, 'id' | 'invoice_id'>[];
    cash_amount?: number;
    cash_account_id?: string;
    bank_amount?: number;
    bank_account_id?: string;
    bank_fee?: number;
    cheque_amount?: number;
    cheque_details?: string;
    cheque_number?: string;
    cheque_bank?: string;
    cheque_sayad?: string;
    cheque_due_date?: string;
    endorsed_cheque_id?: string;
    checkbook_id?: string;
    checkbook_leaf_number?: number;
    credit_amount?: number;
    description?: string;
  }
): Promise<Invoice> {
  const oldInv = await getInvoiceById(id);
  if (!oldInv) {
    throw new Error('فاکتور مورد نظر جهت ویرایش یافت نشد.');
  }

  if (data.type === 'sale') {
    const itemQtyMap = new Map<string, number>();
    for (const it of data.items) {
      if (!it.commodity_id) continue;
      itemQtyMap.set(it.commodity_id, (itemQtyMap.get(it.commodity_id) || 0) + (Number(it.quantity) || 0));
    }
    for (const [commId, reqQty] of itemQtyMap.entries()) {
      const check = await getCommodityStockAtDate(commId, data.date_shamsi, id);
      if (reqQty > check.maxAllowedExit) {
        throw new Error(
          `موجودی کالا در تاریخ انتخابی کافی نمی‌باشد. موجودی در دسترس در تاریخ ${data.date_shamsi}: ${check.maxAllowedExit} ${check.unit}.`
        );
      }
    }
  }

  await deleteInvoice(id);

  return await createInvoice({
    ...data,
    invoice_number: oldInv.invoice_number,
  });
}
