import { getDb, isWebFallback, memoryStore, saveFallbackToStorage } from '../core/connection';
import { ALLOWED_TABLE_COLUMNS, initSchema } from '../core/schema';

export interface BackupRestoreReport {
  tablesRestored: number;
  totalRecordsRestored: number;
  details: Record<string, number>;
}

export async function exportDatabaseBackup(): Promise<Uint8Array> {
  const db = await getDb();

  if (db && !isWebFallback) {
    await initSchema(db);

    // ۱. استخراج پویا و خودکار تمام جداول فیزیکی موجود در دیتابیس SQLite بدون احتمال از قلم افتادن حتی یک جدول
    const masterTables: any[] = await db.select(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );

    const fullData: Record<string, any[]> = {};
    for (const tbl of masterTables) {
      const tableName = tbl.name;
      try {
        const rows = await db.select<any[]>(`SELECT * FROM ${tableName}`);
        fullData[tableName] = rows;
      } catch (err) {
        console.warn(`Could not export table ${tableName}:`, err);
        fullData[tableName] = [];
      }
    }

    // نگاشت نام‌های مستعار (camelCase) برای سازگاری دوطرفه با تمام کلاینت‌ها و نسخه‌های قبلی
    const aliasMap: Record<string, string> = {
      journal_entries: 'entries',
      journal_items: 'items',
      commodity_groups: 'commodityGroups',
      commodity_transactions: 'commodityTransactions',
      invoice_items: 'invoiceItems',
      invoice_service_items: 'invoiceServices',
      invoice_payments: 'invoicePayments',
      production_orders: 'productionOrders',
      production_outputs: 'productionOutputs',
      equity_partners: 'equityPartners',
      equity_transactions: 'equityTransactions',
      equity_settings: 'equitySettings',
      payroll_employees: 'payrollEmployees',
      payroll_records: 'payrollRecords',
      payroll_payments: 'payrollPayments',
    };

    for (const [tblName, alias] of Object.entries(aliasMap)) {
      if (fullData[tblName]) {
        fullData[alias] = fullData[tblName];
      }
    }

    const backupPayload = {
      _type: 'ARENA_FULL_BACKUP',
      timestamp: Date.now(),
      tablesCount: masterTables.length,
      data: fullData
    };

    return new TextEncoder().encode(JSON.stringify(backupPayload));
  }

  const webPayload = {
    _type: 'ARENA_FULL_BACKUP',
    timestamp: Date.now(),
    tablesCount: 22,
    data: {
      accounts: memoryStore.accounts || [],
      categories: memoryStore.categories || [],
      entries: memoryStore.entries || [],
      journal_entries: memoryStore.entries || [],
      items: memoryStore.items || [],
      journal_items: memoryStore.items || [],
      warehouses: memoryStore.warehouses || [],
      commodities: memoryStore.commodities || [],
      commodityGroups: memoryStore.commodityGroups || [],
      commodity_groups: memoryStore.commodityGroups || [],
      commodityTransactions: memoryStore.commodityTransactions || [],
      commodity_transactions: memoryStore.commodityTransactions || [],
      checkbooks: memoryStore.checkbooks || [],
      cheques: memoryStore.cheques || [],
      invoices: memoryStore.invoices || [],
      invoiceItems: memoryStore.invoiceItems || [],
      invoice_items: memoryStore.invoiceItems || [],
      invoiceServices: memoryStore.invoiceServices || [],
      invoice_service_items: memoryStore.invoiceServices || [],
      invoicePayments: memoryStore.invoicePayments || [],
      invoice_payments: memoryStore.invoicePayments || [],
      productionOrders: memoryStore.productionOrders || [],
      production_orders: memoryStore.productionOrders || [],
      productionOutputs: memoryStore.productionOutputs || [],
      production_outputs: memoryStore.productionOutputs || [],
      equityPartners: memoryStore.equityPartners || [],
      equity_partners: memoryStore.equityPartners || [],
      equityTransactions: memoryStore.equityTransactions || [],
      equity_transactions: memoryStore.equityTransactions || [],
      equityPrice: memoryStore.equityPrice || 0,
      equitySettings: [{ key: 'last_price_per_kg', value: String(memoryStore.equityPrice || 0) }],
      equity_settings: [{ key: 'last_price_per_kg', value: String(memoryStore.equityPrice || 0) }],
      payrollEmployees: memoryStore.payrollEmployees || [],
      payroll_employees: memoryStore.payrollEmployees || [],
      payrollRecords: memoryStore.payrollRecords || [],
      payroll_records: memoryStore.payrollRecords || [],
      payrollPayments: memoryStore.payrollPayments || [],
      payroll_payments: memoryStore.payrollPayments || [],
    }
  };

  return new TextEncoder().encode(JSON.stringify(webPayload));
}

export async function importDatabaseBackup(fileData: ArrayBuffer): Promise<BackupRestoreReport> {
  const jsonText = new TextDecoder().decode(fileData);
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error('فایل انتخاب‌شده ساختار معتبر پشتیبان نرم‌افزار را ندارد.');
  }

  const backupData = parsed.data || parsed;
  if (!backupData || (!backupData.accounts && !backupData.journal_entries && !backupData.entries)) {
    throw new Error('فایل پشتیبان خالی یا ناسازگار است.');
  }

  // استخراج و نرمال‌سازی داده‌ها با پشتیبانی از هر دو نگارش snake_case و camelCase
  const getData = (snake: string, camel?: string, alt?: string): any[] => {
    if (Array.isArray(backupData[snake])) return backupData[snake];
    if (camel && Array.isArray(backupData[camel])) return backupData[camel];
    if (alt && Array.isArray(backupData[alt])) return backupData[alt];
    return [];
  };

  const accountsData = getData('accounts');
  const categoriesData = getData('categories');
  const warehousesData = getData('warehouses');
  const commodityGroupsData = getData('commodity_groups', 'commodityGroups');
  const commoditiesData = getData('commodities');
  const commodityTransactionsData = getData('commodity_transactions', 'commodityTransactions');
  const checkbooksData = getData('checkbooks');
  const entriesData = getData('journal_entries', 'entries', 'journalEntries');
  const itemsData = getData('journal_items', 'items', 'journalItems');
  const chequesData = getData('cheques');
  const invoicesData = getData('invoices');

  // استخراج اقلام، خدمات و پرداختی‌های فاکتور (حتی در صورت ذخیره تودرتو)
  let invoiceItemsData = getData('invoice_items', 'invoiceItems');
  let invoiceServicesData = getData('invoice_service_items', 'invoiceServices', 'invoiceServiceItems');
  let invoicePaymentsData = getData('invoice_payments', 'invoicePayments');

  if (invoiceItemsData.length === 0 && invoicesData.length > 0) {
    for (const inv of invoicesData) {
      if (Array.isArray(inv.items)) {
        for (const it of inv.items) invoiceItemsData.push({ ...it, invoice_id: it.invoice_id || inv.id });
      }
    }
  }
  if (invoiceServicesData.length === 0 && invoicesData.length > 0) {
    for (const inv of invoicesData) {
      const sItems = inv.services || inv.service_items;
      if (Array.isArray(sItems)) {
        for (const it of sItems) invoiceServicesData.push({ ...it, invoice_id: it.invoice_id || inv.id });
      }
    }
  }
  if (invoicePaymentsData.length === 0 && invoicesData.length > 0) {
    for (const inv of invoicesData) {
      if (Array.isArray(inv.payments)) {
        for (const it of inv.payments) invoicePaymentsData.push({ ...it, invoice_id: it.invoice_id || inv.id });
      }
    }
  }

  // استخراج سفارشات و خروجی‌های تولید (تضمین ۱۰۰٪ عدم ناپدید شدن فاکتور تولید و محصولات)
  const productionOrdersData = getData('production_orders', 'productionOrders');
  let productionOutputsData = getData('production_outputs', 'productionOutputs', 'productionOutputItems');

  if (productionOutputsData.length === 0 && productionOrdersData.length > 0) {
    for (const ord of productionOrdersData) {
      if (Array.isArray(ord.outputs)) {
        for (const out of ord.outputs) {
          productionOutputsData.push({ ...out, production_order_id: out.production_order_id || ord.id });
        }
      }
    }
  }

  const equityPartnersData = getData('equity_partners', 'equityPartners');
  const equitySettingsData = getData('equity_settings', 'equitySettings');
  const equityTransactionsData = getData('equity_transactions', 'equityTransactions');

  const payrollEmployeesData = getData('payroll_employees', 'payrollEmployees');
  const payrollRecordsData = getData('payroll_records', 'payrollRecords');
  let payrollPaymentsData = getData('payroll_payments', 'payrollPayments');

  if (payrollPaymentsData.length === 0 && payrollRecordsData.length > 0) {
    for (const rec of payrollRecordsData) {
      if (Array.isArray(rec.payments)) {
        for (const pay of rec.payments) {
          payrollPaymentsData.push({ ...pay, record_id: pay.record_id || rec.id });
        }
      }
    }
  }

  const db = await getDb();
  const report: BackupRestoreReport = {
    tablesRestored: 0,
    totalRecordsRestored: 0,
    details: {}
  };

  if (db && !isWebFallback) {
    // ۱. اطمینان از وجود کلیه جداول و ستون‌های پایگاه داده
    await initSchema(db);

    try {
      await db.execute("PRAGMA foreign_keys = OFF;");
      await db.execute("PRAGMA synchronous = OFF;");
    } catch {}

    // ۲. استخراج پویا و خودکار تمام جداول فیزیکی دیتابیس
    const masterTables: any[] = await db.select(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    const existingTableNames = new Set(masterTables.map((t: any) => t.name));

    // ۳. ترتیب پاکسازی امن (فرزندان قبل از والدین)
    const deletionOrder = [
      'production_outputs',
      'production_orders',
      'invoice_payments',
      'invoice_service_items',
      'invoice_items',
      'commodity_transactions',
      'invoices',
      'cheques',
      'checkbooks',
      'commodity_groups',
      'commodities',
      'warehouses',
      'journal_items',
      'journal_entries',
      'categories',
      'accounts',
      'payroll_payments',
      'payroll_records',
      'payroll_employees',
      'equity_transactions',
      'equity_settings',
      'equity_partners',
    ];

    for (const tbl of masterTables) {
      if (!deletionOrder.includes(tbl.name)) {
        deletionOrder.unshift(tbl.name);
      }
    }

    for (const tbl of deletionOrder) {
      if (existingTableNames.has(tbl)) {
        try {
          await db.execute(`DELETE FROM ${tbl};`);
        } catch (err) {
          console.warn(`Could not clear table ${tbl}:`, err);
        }
      }
    }

    // ۴. تابع درج هوشمند با استخراج ستون‌های واقعی از PRAGMA table_info موتور دیتابیس
    const insertBatch = async (table: string, rows: any[]): Promise<number> => {
      if (!rows || rows.length === 0) return 0;
      if (!existingTableNames.has(table)) return 0;

      let validCols: Set<string> = ALLOWED_TABLE_COLUMNS[table] || new Set();
      try {
        const colInfo: any[] = await db.select(`PRAGMA table_info(${table})`);
        if (colInfo && colInfo.length > 0) {
          validCols = new Set(colInfo.map((c: any) => c.name));
        }
      } catch {}

      let insertedCount = 0;
      for (const row of rows) {
        const keys = Object.keys(row).filter((k) =>
          validCols.has(k) &&
          row[k] !== undefined &&
          (typeof row[k] !== 'object' || row[k] === null)
        );
        if (keys.length === 0) continue;

        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const values = keys.map((k) => {
          const val = row[k];
          if (typeof val === 'boolean') return val ? 1 : 0;
          return val;
        });

        try {
          await db.execute(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders});`, values);
          insertedCount++;
        } catch (err) {
          console.error(`Error inserting into ${table}:`, err, row);
        }
      }
      return insertedCount;
    };

    // ۵. درج به ترتیب سلسله‌مراتب پایگاه‌داده (والدین قبل از فرزندان)
    const tablesToInsert: { name: string; data: any[] }[] = [
      { name: 'accounts', data: accountsData },
      { name: 'categories', data: categoriesData },
      { name: 'warehouses', data: warehousesData },
      { name: 'commodity_groups', data: commodityGroupsData },
      { name: 'commodities', data: commoditiesData },
      { name: 'commodity_transactions', data: commodityTransactionsData },
      { name: 'checkbooks', data: checkbooksData },
      { name: 'journal_entries', data: entriesData },
      { name: 'journal_items', data: itemsData },
      { name: 'cheques', data: chequesData },
      { name: 'invoices', data: invoicesData },
      { name: 'invoice_items', data: invoiceItemsData },
      { name: 'invoice_service_items', data: invoiceServicesData },
      { name: 'invoice_payments', data: invoicePaymentsData },
      { name: 'production_orders', data: productionOrdersData },
      { name: 'production_outputs', data: productionOutputsData },
      { name: 'equity_partners', data: equityPartnersData },
      { name: 'equity_settings', data: equitySettingsData },
      { name: 'equity_transactions', data: equityTransactionsData },
      { name: 'payroll_employees', data: payrollEmployeesData },
      { name: 'payroll_records', data: payrollRecordsData },
      { name: 'payroll_payments', data: payrollPaymentsData },
    ];

    const insertedTablesSet = new Set(tablesToInsert.map(t => t.name));

    // درج هر جدول ناشناخته یا ماژول اضافه‌شده در آینده
    for (const tbl of masterTables) {
      if (!insertedTablesSet.has(tbl.name)) {
        tablesToInsert.push({ name: tbl.name, data: getData(tbl.name) });
      }
    }

    for (const item of tablesToInsert) {
      const count = await insertBatch(item.name, item.data);
      if (item.data.length > 0) {
        report.tablesRestored++;
        report.totalRecordsRestored += count;
        report.details[item.name] = count;
      }
    }

    try {
      await db.execute("PRAGMA foreign_keys = ON;");
      await db.execute("PRAGMA synchronous = NORMAL;");
    } catch {}

    return report;
  } else {
    // بازگردانی کامل و دقیق در محیط مرورگر / Web Fallback
    memoryStore.accounts = accountsData;
    memoryStore.categories = categoriesData;
    memoryStore.entries = entriesData;
    memoryStore.items = itemsData;
    memoryStore.warehouses = warehousesData;
    memoryStore.commodities = commoditiesData;
    memoryStore.commodityGroups = commodityGroupsData;
    memoryStore.commodityTransactions = commodityTransactionsData;
    memoryStore.checkbooks = checkbooksData;
    memoryStore.cheques = chequesData;
    memoryStore.invoices = invoicesData;
    memoryStore.invoiceItems = invoiceItemsData;
    memoryStore.invoiceServices = invoiceServicesData;
    memoryStore.invoicePayments = invoicePaymentsData;
    memoryStore.productionOrders = productionOrdersData;
    memoryStore.productionOutputs = productionOutputsData;
    memoryStore.equityPartners = equityPartnersData;
    memoryStore.equityTransactions = equityTransactionsData;
    const priceSetting = equitySettingsData.find((s: any) => s.key === 'last_price_per_kg' || s.key === 'current_price');
    memoryStore.equityPrice = priceSetting ? Number(priceSetting.value) || 0 : (backupData.equityPrice || 0);
    memoryStore.payrollEmployees = payrollEmployeesData;
    memoryStore.payrollRecords = payrollRecordsData;
    memoryStore.payrollPayments = payrollPaymentsData;

    saveFallbackToStorage();

    const fallbackTables = [
      { name: 'accounts', data: accountsData },
      { name: 'categories', data: categoriesData },
      { name: 'journal_entries', data: entriesData },
      { name: 'journal_items', data: itemsData },
      { name: 'warehouses', data: warehousesData },
      { name: 'commodities', data: commoditiesData },
      { name: 'commodity_groups', data: commodityGroupsData },
      { name: 'commodity_transactions', data: commodityTransactionsData },
      { name: 'checkbooks', data: checkbooksData },
      { name: 'cheques', data: chequesData },
      { name: 'invoices', data: invoicesData },
      { name: 'invoice_items', data: invoiceItemsData },
      { name: 'invoice_service_items', data: invoiceServicesData },
      { name: 'invoice_payments', data: invoicePaymentsData },
      { name: 'production_orders', data: productionOrdersData },
      { name: 'production_outputs', data: productionOutputsData },
      { name: 'equity_partners', data: equityPartnersData },
      { name: 'equity_transactions', data: equityTransactionsData },
      { name: 'payroll_employees', data: payrollEmployeesData },
      { name: 'payroll_records', data: payrollRecordsData },
      { name: 'payroll_payments', data: payrollPaymentsData },
    ];

    for (const t of fallbackTables) {
      if (t.data.length > 0) {
        report.tablesRestored++;
        report.totalRecordsRestored += t.data.length;
        report.details[t.name] = t.data.length;
      }
    }

    return report;
  }
}
