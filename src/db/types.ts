export type AccountType = 'asset' | 'liability' | 'expense' | 'revenue' | 'person';

export interface ProductionOrder {
  id: string;
  order_number: number;
  date_shamsi: string;
  input_commodity_id: string;
  input_commodity_name?: string;
  input_warehouse_id: string;
  input_warehouse_name?: string;
  input_quantity: number;
  total_output_quantity: number;
  loss_quantity: number;
  yield_percentage: number;
  note?: string;
  created_at?: string;
  outputs?: ProductionOutputItem[];
}

export interface ProductionOutputItem {
  id?: string;
  production_order_id?: string;
  commodity_id: string;
  commodity_name?: string;
  warehouse_id: string;
  warehouse_name?: string;
  quantity: number;
  percentage: number;
  note?: string;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  bank_name?: string;
  account_number?: string;
  card_number?: string;
  color?: string;
  icon?: string;
  balance: number;
  initial_balance?: number;
  parent_id?: string | null;
  is_active: number;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  entry_number: number;
  entry_date: string;
  entry_date_shamsi: string;
  description: string;
  source_type: 'expense' | 'income' | 'transfer' | 'manual' | 'opening' | 'invoice' | 'cheque';
  from_account_id?: string;
  to_account_id?: string;
  fee?: number;
  status: 'final' | 'draft';
  is_system_generated?: boolean;
  related_cheque_id?: string;
  remote_id?: string;
  created_at: string;
  items?: JournalItem[];
}

export interface JournalItem {
  id: string;
  entry_id: string;
  account_id: string;
  account_name?: string;
  account_type?: AccountType;
  debit: number;
  credit: number;
  note?: string;
  is_system_generated?: boolean;
  source_type?: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'expense' | 'income';
  icon: string;
  account_id: string;
}

export interface TransactionInput {
  id?: string;
  remote_id?: string;
  amount: number;
  fee?: number;
  fromAccountId: string;
  toAccountId: string;
  description?: string;
  dateShamsi: string;
}

export interface Warehouse {
  id: string;
  code: number;
  name: string;
  description?: string;
  address?: string;
  is_active: number;
  created_at: string;
}

export interface CommodityGroup {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  parent_id?: string | null;
  created_at: string;
}

export interface Commodity {
  id: string;
  code: number;
  name: string;
  barcode?: string;
  unit: string;
  warehouse_id: string;
  group_id?: string | null;
  initial_quantity?: number;
  current_quantity: number;
  purchase_price?: number;
  sales_price?: number;
  is_active: number;
  created_at: string;
}

export interface CommodityTransaction {
  id: string;
  commodity_id: string;
  warehouse_id: string;
  type: 'initial' | 'in' | 'out' | 'transfer';
  quantity: number;
  balance_after: number;
  date: string;
  date_shamsi: string;
  reference?: string;
  description?: string;
  invoice_id?: string;
  created_at: string;
}

export interface WarehouseReportItem {
  id: string;
  date: string;
  date_shamsi: string;
  commodity_name: string;
  commodity_code: number | string;
  type: 'in' | 'out' | 'transfer';
  quantity: number;
  unit: string;
  reference: string;
  description?: string;
}

export type ChequeType = 'received' | 'issued';

export type ChequeStatus = 
  | 'in_safe'     // نزد صندوق / گاوصندوق
  | 'cleared'     // وصول‌شده
  | 'assigned'    // واگذارشده به دیگری (خرج شده)
  | 'bounced'     // برگشتی
  | 'returned'    // عودت‌داده‌شده به پرداخت‌کننده
  | 'issued'      // صادرشده (برای پرداختی)
  | 'voided';     // باطله

export interface Checkbook {
  id: string;
  bank_id: string;
  bank_name: string;
  serial: string;
  receive_date_shamsi: string;
  from_number: number;
  to_number: number;
  leaf_count: number;
  description?: string;
  is_active: number;
  created_at: string;
}

export interface Cheque {
  id: string;
  type: ChequeType;
  check_number: string;
  sayad_id: string; // شناسه صیاد ۱۶ رقمی
  amount: number;
  due_date_shamsi: string;
  issue_date_shamsi?: string;
  bank_name: string;
  branch?: string;
  account_number?: string;
  sheba?: string;
  row_number?: number;
  location?: string; // گاو صندوق، نزد صندوق، بانک...
  status: ChequeStatus;
  status_description?: string;
  person_id: string; // پرداخت‌کننده یا گیرنده
  person_name?: string;
  checkbook_id?: string;
  checkbook_leaf_number?: number;
  clearing_bank_id?: string;
  assigned_to_person_id?: string;
  entry_id?: string;
  last_operation_entry_id?: string;
  description?: string;
  created_at: string;
}

export type InvoiceType = 'sale' | 'purchase';

export type PaymentMethod = 'cash' | 'bank' | 'cheque' | 'credit' | 'multi';

export interface InvoicePaymentItem {
  id: string;
  invoice_id?: string;
  method: 'cash' | 'bank' | 'cheque';
  amount: number;
  account_id?: string; // سرفصل حساب صندوق یا بانک
  account_name?: string;
  bank_fee?: number;
  tracking_number?: string;
  reference_number?: string;
  // مشخصات چک در صورت پرداخت با چک
  cheque_mode?: 'new' | 'endorsed';
  cheque_id?: string;
  endorsed_cheque_id?: string;
  checkbook_id?: string;
  checkbook_leaf_number?: number;
  cheque_number?: string;
  cheque_bank?: string;
  cheque_sayad?: string;
  cheque_due_date?: string;
  description?: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  commodity_id: string;
  commodity_name: string;
  commodity_code: number | string;
  unit: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total_price: number;
  description?: string;
}

export interface InvoiceServiceItem {
  id: string;
  invoice_id: string;
  account_id: string; // سرفصل درآمد یا هزینه
  account_name: string;
  title: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Invoice {
  id: string;
  invoice_number: number;
  type: InvoiceType;
  date: string;
  date_shamsi: string;
  person_id: string;
  person_name: string;
  warehouse_id?: string;
  warehouse_name?: string;
  total_commodities_amount: number;
  total_services_amount: number;
  discount_total: number;
  tax_amount: number;
  final_amount: number;
  payment_method: PaymentMethod;
  payment_settled_amount: number;
  payment_remaining_amount: number;
  settlement_status: 'settled' | 'partial' | 'unsettled';
  cash_amount?: number;
  cash_account_id?: string;
  bank_amount?: number;
  bank_account_id?: string;
  bank_fee?: number;
  cheque_amount?: number;
  cheque_details?: string;
  cheque_number?: string;
  cheque_bank?: string;
  cheque_due_date?: string;
  cheque_sayad?: string;
  endorsed_cheque_id?: string;
  checkbook_id?: string;
  checkbook_leaf_number?: number;
  entry_id?: string;
  description?: string;
  items: InvoiceItem[];
  services: InvoiceServiceItem[];
  payments?: InvoicePaymentItem[];
  created_at: string;
}

export interface ProductionOutputItem {
  id?: string;
  production_order_id?: string;
  commodity_id: string;
  commodity_name?: string;
  warehouse_id: string;
  warehouse_name?: string;
  quantity: number;
  percentage: number;
  note?: string;
}

export interface ProductionOrder {
  id: string;
  order_number: number;
  date_shamsi: string;
  input_commodity_id: string;
  input_commodity_name?: string;
  input_warehouse_id: string;
  input_warehouse_name?: string;
  input_quantity: number;
  total_output_quantity: number;
  loss_quantity: number;
  yield_percentage: number;
  note?: string;
  created_at?: string;
  outputs?: ProductionOutputItem[];
  // فیلدهای اختیاری بهای تمام‌شده و فاکتور خرید
  purchase_invoice_id?: string;
  purchase_invoice_number?: number;
  input_unit_price?: number;
  wage_cost?: number;
  transport_cost?: number;
  overhead_cost?: number;
  total_production_cost?: number;
  cost_per_unit?: number;
}

// -------------------------------------------------------------
// ماژول سرمایه‌گذاران و سهم وزنی شمش آلومینیوم (Equity)
// -------------------------------------------------------------
export interface EquityPartner {
  id: string;
  name: string;
  color?: string;
  note?: string;
  created_at?: string;
}

export type EquityTxKind = 'IN' | 'OUT';
export type EquityTxStatus = 'confirmed' | 'pending';

export interface EquityTransaction {
  id: string;
  partner_id: string;
  partner_name?: string;
  kind: EquityTxKind;
  amount_rial: number;
  price_rial_per_kg: number;
  weight_kg: number;
  jdate: string;
  description?: string;
  status: EquityTxStatus;
  source?: string;
  source_id?: string;
  created_at?: string;
}

// -------------------------------------------------------------
// ماژول حقوق و دستمزد پرسنل (Payroll)
// -------------------------------------------------------------
export interface PayrollEmployee {
  id: string;
  name: string;
  code?: string;
  phone?: string;
  bank_card?: string;
  is_active?: number;
  created_at?: string;
}

export interface PayrollRecord {
  id: string;
  employee_id: string;
  year: number;
  month: number;
  base_salary_rial: number;
  overtime_days: number;
  created_at?: string;
}

export interface PayrollPayment {
  id: string;
  record_id: string;
  payment_date: string;
  amount_rial: number;
  payment_type: string;
  description?: string;
  source?: string;
  source_id?: string;
  created_at?: string;
}
