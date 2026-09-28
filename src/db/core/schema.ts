import Database from '@tauri-apps/plugin-sql';

export const ALLOWED_TABLE_COLUMNS: Record<string, Set<string>> = {
  accounts: new Set([
    'id', 'code', 'name', 'type', 'bank_name', 'account_number', 'card_number',
    'color', 'icon', 'balance', 'initial_balance', 'parent_id', 'is_active', 'created_at'
  ]),
  categories: new Set([
    'id', 'name', 'type', 'color', 'icon', 'created_at'
  ]),
  journal_entries: new Set([
    'id', 'entry_number', 'entry_date', 'entry_date_shamsi', 'description',
    'source_type', 'from_account_id', 'to_account_id', 'fee', 'status',
    'is_system_generated', 'related_cheque_id', 'remote_id', 'created_at'
  ]),
  journal_items: new Set([
    'id', 'entry_id', 'account_id', 'debit', 'credit', 'note',
    'is_system_generated', 'source_type'
  ]),
  warehouses: new Set([
    'id', 'code', 'name', 'description', 'address', 'is_active', 'created_at'
  ]),
  commodity_groups: new Set([
    'id', 'name', 'color', 'icon', 'parent_id', 'created_at'
  ]),
  commodities: new Set([
    'id', 'code', 'name', 'barcode', 'unit', 'warehouse_id', 'group_id',
    'initial_quantity', 'current_quantity', 'purchase_price', 'sales_price',
    'is_active', 'created_at'
  ]),
  commodity_transactions: new Set([
    'id', 'commodity_id', 'warehouse_id', 'type', 'quantity', 'balance_after',
    'date', 'date_shamsi', 'reference', 'description', 'invoice_id', 'created_at'
  ]),
  checkbooks: new Set([
    'id', 'bank_id', 'bank_name', 'serial', 'receive_date_shamsi',
    'from_number', 'to_number', 'leaf_count', 'description', 'is_active', 'created_at'
  ]),
  cheques: new Set([
    'id', 'type', 'check_number', 'sayad_id', 'amount', 'due_date_shamsi',
    'issue_date_shamsi', 'bank_name', 'branch', 'account_number', 'sheba',
    'row_number', 'location', 'status', 'status_description', 'person_id',
    'person_name', 'checkbook_id', 'checkbook_leaf_number', 'clearing_bank_id',
    'assigned_to_person_id', 'entry_id', 'description', 'last_operation_entry_id', 'created_at'
  ]),
  invoices: new Set([
    'id', 'invoice_number', 'type', 'date', 'date_shamsi', 'person_id',
    'person_name', 'warehouse_id', 'warehouse_name', 'total_commodities_amount',
    'total_services_amount', 'discount_total', 'tax_amount', 'final_amount',
    'payment_method', 'payment_settled_amount', 'payment_remaining_amount',
    'settlement_status', 'cash_account_id', 'bank_account_id', 'bank_fee',
    'cheque_details', 'checkbook_id', 'checkbook_leaf_number', 'entry_id',
    'description', 'created_at'
  ]),
  invoice_items: new Set([
    'id', 'invoice_id', 'commodity_id', 'commodity_name', 'commodity_code',
    'unit', 'quantity', 'unit_price', 'discount', 'total_price', 'description'
  ]),
  invoice_service_items: new Set([
    'id', 'invoice_id', 'account_id', 'account_name', 'title',
    'quantity', 'unit_price', 'total_price'
  ]),
  invoice_payments: new Set([
    'id', 'invoice_id', 'method', 'amount', 'account_id', 'account_name',
    'bank_fee', 'reference_number', 'cheque_mode', 'endorsed_cheque_id',
    'checkbook_id', 'checkbook_leaf_number', 'cheque_number', 'cheque_bank',
    'cheque_sayad', 'cheque_due_date', 'description', 'created_at'
  ]),
  production_orders: new Set([
    'id', 'order_number', 'date_shamsi', 'input_commodity_id', 'input_warehouse_id',
    'input_quantity', 'total_output_quantity', 'loss_quantity', 'yield_percentage',
    'note', 'purchase_invoice_id', 'purchase_invoice_number', 'input_unit_price',
    'wage_cost', 'transport_cost', 'overhead_cost', 'total_production_cost',
    'cost_per_unit', 'created_at'
  ]),
  production_outputs: new Set([
    'id', 'production_order_id', 'commodity_id', 'warehouse_id',
    'quantity', 'percentage', 'note'
  ]),
  equity_partners: new Set([
    'id', 'name', 'color', 'note', 'created_at'
  ]),
  equity_transactions: new Set([
    'id', 'partner_id', 'kind', 'amount_rial', 'price_rial_per_kg', 'weight_kg',
    'jdate', 'description', 'status', 'source', 'source_id', 'created_at'
  ]),
  equity_settings: new Set([
    'key', 'value'
  ]),
  payroll_employees: new Set([
    'id', 'name', 'code', 'phone', 'bank_card', 'created_at'
  ]),
  payroll_records: new Set([
    'id', 'employee_id', 'year', 'month', 'base_salary_rial', 'overtime_days', 'created_at'
  ]),
  payroll_payments: new Set([
    'id', 'record_id', 'payment_date', 'amount_rial', 'payment_type', 'description', 'source', 'source_id', 'created_at'
  ]),
};

export async function initSchema(db: Database, seedDefaultDataFn?: (db: Database) => Promise<void>) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      bank_name TEXT,
      account_number TEXT,
      card_number TEXT,
      color TEXT,
      icon TEXT,
      balance REAL DEFAULT 0,
      parent_id TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );
  `);

  try { await db.execute(`ALTER TABLE accounts ADD COLUMN account_number TEXT;`); } catch {}
  try { await db.execute(`ALTER TABLE accounts ADD COLUMN parent_id TEXT;`); } catch {}
  try { await db.execute(`ALTER TABLE accounts ADD COLUMN initial_balance REAL DEFAULT 0;`); } catch {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      entry_number INTEGER NOT NULL,
      entry_date TEXT NOT NULL,
      entry_date_shamsi TEXT NOT NULL,
      description TEXT NOT NULL,
      source_type TEXT NOT NULL,
      from_account_id TEXT,
      to_account_id TEXT,
      fee REAL DEFAULT 0,
      is_system_generated INTEGER DEFAULT 0,
      related_cheque_id TEXT,
      status TEXT DEFAULT 'final',
      created_at TEXT NOT NULL
    );
  `);

  try { await db.execute(`ALTER TABLE journal_entries ADD COLUMN from_account_id TEXT;`); } catch {}
  try { await db.execute(`ALTER TABLE journal_entries ADD COLUMN to_account_id TEXT;`); } catch {}
  try { await db.execute(`ALTER TABLE journal_entries ADD COLUMN fee REAL DEFAULT 0;`); } catch {}
  try { await db.execute(`ALTER TABLE journal_entries ADD COLUMN is_system_generated INTEGER DEFAULT 0;`); } catch {}
  try { await db.execute(`ALTER TABLE journal_entries ADD COLUMN related_cheque_id TEXT;`); } catch {}
  try { await db.execute(`ALTER TABLE journal_entries ADD COLUMN remote_id TEXT;`); } catch {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS journal_items (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      note TEXT,
      is_system_generated INTEGER DEFAULT 0,
      source_type TEXT,
      FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );
  `);

  try { await db.execute(`ALTER TABLE journal_items ADD COLUMN is_system_generated INTEGER DEFAULT 0;`); } catch {}
  try { await db.execute(`ALTER TABLE journal_items ADD COLUMN source_type TEXT;`); } catch {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      icon TEXT NOT NULL,
      account_id TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id TEXT PRIMARY KEY,
      code INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      address TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS commodity_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      icon TEXT,
      parent_id TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS commodities (
      id TEXT PRIMARY KEY,
      code INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      barcode TEXT,
      unit TEXT NOT NULL DEFAULT 'عدد',
      warehouse_id TEXT NOT NULL,
      group_id TEXT,
      initial_quantity REAL DEFAULT 0,
      current_quantity REAL DEFAULT 0,
      purchase_price REAL DEFAULT 0,
      sales_price REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
      FOREIGN KEY (group_id) REFERENCES commodity_groups(id)
    );
  `);
  try { await db.execute(`ALTER TABLE commodities ADD COLUMN barcode TEXT;`); } catch {}
  try { await db.execute(`ALTER TABLE commodities ADD COLUMN group_id TEXT;`); } catch {}
  try { await db.execute(`ALTER TABLE commodities ADD COLUMN initial_quantity REAL DEFAULT 0;`); } catch {}
  try { await db.execute(`ALTER TABLE commodities ADD COLUMN current_quantity REAL DEFAULT 0;`); } catch {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS commodity_transactions (
      id TEXT PRIMARY KEY,
      commodity_id TEXT NOT NULL,
      warehouse_id TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      balance_after REAL NOT NULL,
      date TEXT NOT NULL,
      date_shamsi TEXT NOT NULL,
      reference TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (commodity_id) REFERENCES commodities(id) ON DELETE CASCADE,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    );
  `);
  try { await db.execute(`ALTER TABLE commodity_transactions ADD COLUMN invoice_id TEXT;`); } catch {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS checkbooks (
      id TEXT PRIMARY KEY,
      bank_id TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      serial TEXT NOT NULL,
      receive_date_shamsi TEXT NOT NULL,
      from_number INTEGER NOT NULL,
      to_number INTEGER NOT NULL,
      leaf_count INTEGER NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (bank_id) REFERENCES accounts(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS cheques (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      check_number TEXT NOT NULL,
      sayad_id TEXT,
      amount REAL NOT NULL,
      due_date_shamsi TEXT NOT NULL,
      issue_date_shamsi TEXT,
      bank_name TEXT NOT NULL,
      branch TEXT,
      account_number TEXT,
      sheba TEXT,
      row_number INTEGER NOT NULL,
      location TEXT,
      status TEXT NOT NULL,
      status_description TEXT,
      person_id TEXT NOT NULL,
      person_name TEXT,
      checkbook_id TEXT,
      checkbook_leaf_number INTEGER,
      clearing_bank_id TEXT,
      assigned_to_person_id TEXT,
      entry_id TEXT,
      description TEXT,
      created_at TEXT NOT NULL
    );
  `);
  try { await db.execute('ALTER TABLE cheques ADD COLUMN last_operation_entry_id TEXT'); } catch {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number INTEGER NOT NULL,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      date_shamsi TEXT NOT NULL,
      person_id TEXT NOT NULL,
      person_name TEXT NOT NULL,
      warehouse_id TEXT,
      warehouse_name TEXT,
      total_commodities_amount REAL NOT NULL DEFAULT 0,
      total_services_amount REAL NOT NULL DEFAULT 0,
      discount_total REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      final_amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL,
      payment_settled_amount REAL NOT NULL DEFAULT 0,
      payment_remaining_amount REAL NOT NULL DEFAULT 0,
      settlement_status TEXT NOT NULL DEFAULT 'settled',
      cash_account_id TEXT,
      bank_account_id TEXT,
      cheque_details TEXT,
      checkbook_id TEXT,
      checkbook_leaf_number INTEGER,
      entry_id TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (person_id) REFERENCES accounts(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    );
  `);

  try { await db.execute('ALTER TABLE invoices ADD COLUMN checkbook_id TEXT'); } catch {}
  try { await db.execute('ALTER TABLE invoices ADD COLUMN checkbook_leaf_number INTEGER'); } catch {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      commodity_id TEXT NOT NULL,
      commodity_name TEXT NOT NULL,
      commodity_code INTEGER,
      unit TEXT NOT NULL DEFAULT 'عدد',
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      total_price REAL NOT NULL,
      description TEXT,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (commodity_id) REFERENCES commodities(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS invoice_service_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      account_name TEXT NOT NULL,
      title TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      method TEXT NOT NULL,
      amount REAL NOT NULL,
      account_id TEXT,
      account_name TEXT,
      bank_fee REAL DEFAULT 0,
      reference_number TEXT,
      cheque_mode TEXT,
      endorsed_cheque_id TEXT,
      checkbook_id TEXT,
      checkbook_leaf_number INTEGER,
      cheque_number TEXT,
      cheque_bank TEXT,
      cheque_sayad TEXT,
      cheque_due_date TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );
  `);

  // جداول ماژول تولید (تضمین ساخت همیشگی در بوت دیتابیس)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS production_orders (
      id TEXT PRIMARY KEY,
      order_number INTEGER NOT NULL,
      date_shamsi TEXT NOT NULL,
      input_commodity_id TEXT NOT NULL,
      input_warehouse_id TEXT NOT NULL,
      input_quantity REAL NOT NULL,
      total_output_quantity REAL NOT NULL,
      loss_quantity REAL NOT NULL,
      yield_percentage REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS production_outputs (
      id TEXT PRIMARY KEY,
      production_order_id TEXT NOT NULL,
      commodity_id TEXT NOT NULL,
      warehouse_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      percentage REAL NOT NULL,
      note TEXT,
      FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE CASCADE
    );
  `);

  try { await db.execute(`ALTER TABLE production_orders ADD COLUMN purchase_invoice_id TEXT;`); } catch {}
  try { await db.execute(`ALTER TABLE production_orders ADD COLUMN purchase_invoice_number INTEGER;`); } catch {}
  try { await db.execute(`ALTER TABLE production_orders ADD COLUMN input_unit_price REAL DEFAULT 0;`); } catch {}
  try { await db.execute(`ALTER TABLE production_orders ADD COLUMN wage_cost REAL DEFAULT 0;`); } catch {}
  try { await db.execute(`ALTER TABLE production_orders ADD COLUMN transport_cost REAL DEFAULT 0;`); } catch {}
  try { await db.execute(`ALTER TABLE production_orders ADD COLUMN overhead_cost REAL DEFAULT 0;`); } catch {}
  try { await db.execute(`ALTER TABLE production_orders ADD COLUMN total_production_cost REAL DEFAULT 0;`); } catch {}
  try { await db.execute(`ALTER TABLE production_orders ADD COLUMN cost_per_unit REAL DEFAULT 0;`); } catch {}

  // جداول ماژول سرمایه‌گذاران و سهم وزنی شمش
  await db.execute(`
    CREATE TABLE IF NOT EXISTS equity_partners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      note TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS equity_transactions (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      amount_rial REAL NOT NULL,
      price_rial_per_kg REAL NOT NULL,
      weight_kg REAL NOT NULL,
      jdate TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'confirmed',
      source TEXT,
      source_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (partner_id) REFERENCES equity_partners(id) ON DELETE CASCADE
    );
  `);

  try { await db.execute('ALTER TABLE equity_transactions ADD COLUMN source TEXT;'); } catch {}
  try { await db.execute('ALTER TABLE equity_transactions ADD COLUMN source_id TEXT;'); } catch {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS equity_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // جداول ماژول حقوق و دستمزد پرسنل
  await db.execute(`
    CREATE TABLE IF NOT EXISTS payroll_employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      phone TEXT,
      bank_card TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS payroll_records (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      base_salary_rial REAL NOT NULL,
      overtime_days REAL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (employee_id) REFERENCES payroll_employees(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS payroll_payments (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      amount_rial REAL NOT NULL,
      payment_type TEXT NOT NULL,
      description TEXT,
      source TEXT,
      source_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (record_id) REFERENCES payroll_records(id) ON DELETE CASCADE
    );
  `);

  try { await db.execute('ALTER TABLE payroll_payments ADD COLUMN source TEXT;'); } catch {}
  try { await db.execute('ALTER TABLE payroll_payments ADD COLUMN source_id TEXT;'); } catch {}

  const accounts: any[] = await db.select('SELECT * FROM accounts LIMIT 1');
  if (accounts.length === 0 && seedDefaultDataFn) {
    await seedDefaultDataFn(db);
  }
}
