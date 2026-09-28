import Database from '@tauri-apps/plugin-sql';
import type {
  Account,
  Category,
  JournalEntry,
  JournalItem,
  Warehouse,
  Commodity,
  CommodityGroup,
  CommodityTransaction,
  Checkbook,
  Cheque,
  Invoice,
  InvoiceItem,
  InvoiceServiceItem,
  InvoicePaymentItem,
  ProductionOrder,
  ProductionOutputItem,
  EquityPartner,
  EquityTransaction,
  PayrollEmployee,
  PayrollRecord,
  PayrollPayment
} from '../types';
import walletSeed from '../walletSeed.json';
import equitySeed from '../equitySeed.json';
import { initSchema } from './schema';

let dbInstance: Database | null = null;
let isWebFallback = false;

export function cleanNum(val: number): number {
  return Math.round((val + Number.EPSILON) * 1000) / 1000;
}

export const memoryStore = {
  accounts: [] as Account[],
  categories: [] as Category[],
  entries: [] as JournalEntry[],
  items: [] as JournalItem[],
  warehouses: [] as Warehouse[],
  commodities: [] as Commodity[],
  commodityGroups: [] as CommodityGroup[],
  commodityTransactions: [] as CommodityTransaction[],
  checkbooks: [] as Checkbook[],
  cheques: [] as Cheque[],
  invoices: [] as Invoice[],
  invoiceItems: [] as InvoiceItem[],
  invoiceServices: [] as InvoiceServiceItem[],
  invoicePayments: [] as InvoicePaymentItem[],
  productionOrders: [] as ProductionOrder[],
  productionOutputs: [] as ProductionOutputItem[],
  equityPartners: [] as EquityPartner[],
  equityTransactions: [] as EquityTransaction[],
  equityPrice: 0 as number,
  payrollEmployees: [] as PayrollEmployee[],
  payrollRecords: [] as PayrollRecord[],
  payrollPayments: [] as PayrollPayment[],
};

export async function getDb(): Promise<Database | null> {
  if (dbInstance) return dbInstance;
  try {
    let dbConnStr = 'sqlite:arena.db';
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const paths: any = await invoke('get_app_paths');
      if (paths && paths.db_path) {
        dbConnStr = `sqlite:${paths.db_path}`;
      }
    } catch {}

    dbInstance = await Database.load(dbConnStr);
    await initSchema(dbInstance, seedDefaultData);
    return dbInstance;
  } catch (err) {
    console.warn('Tauri SQL plugin not available, using in-memory local fallback:', err);
    isWebFallback = true;
    initFallbackData();
    return null;
  }
}

export function getIsWebFallback(): boolean {
  return isWebFallback;
}

export { isWebFallback };

export async function seedDefaultData(db: Database) {
  try {
    for (const acc of walletSeed.accounts) {
      await db.execute(
        `INSERT INTO accounts (id, code, name, type, bank_name, account_number, card_number, color, icon, balance, initial_balance, parent_id, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, $13)`,
        [acc.id, acc.code, acc.name, acc.type, acc.bank_name, acc.account_number, acc.card_number, acc.color, acc.icon, acc.balance, acc.initial_balance || 0, acc.parent_id, acc.created_at]
      );
    }

    for (const e of walletSeed.entries) {
      await db.execute(
        `INSERT INTO journal_entries (id, entry_number, entry_date, entry_date_shamsi, description, source_type, from_account_id, to_account_id, fee, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [e.id, e.entry_number, e.entry_date, e.entry_date_shamsi, e.description, e.source_type, e.from_account_id, e.to_account_id, e.fee, e.status, e.created_at]
      );
    }

    for (const it of walletSeed.items) {
      await db.execute(
        `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [it.id, it.entry_id, it.account_id, it.debit, it.credit, it.note]
      );
    }

    try {
      const ep: any[] = await db.select('SELECT id FROM equity_partners LIMIT 1');
      if (ep.length === 0 && equitySeed && equitySeed.partners) {
        for (const p of equitySeed.partners) {
          await db.execute(
            `INSERT INTO equity_partners (id, name, color, note, created_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [p.id, p.name, p.color || '#4ade80', p.note || '', new Date().toISOString()]
          );
        }
        for (const t of (equitySeed.txs || [])) {
          const a = Number(t.a) || 0;
          const pr = Number(t.pr) || 0;
          const w = pr > 0 ? (a / pr) : 0;
          await db.execute(
            `INSERT INTO equity_transactions (id, partner_id, kind, amount_rial, price_rial_per_kg, weight_kg, jdate, description, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [t.id, t.p, t.k || 'IN', a, pr, w, t.d || '', t.t || '', t.s || 'confirmed', new Date().toISOString()]
          );
        }
        if (equitySeed.curPrice) {
          await db.execute(`INSERT OR REPLACE INTO equity_settings (key, value) VALUES ('current_price', $1)`, [String(equitySeed.curPrice)]);
        }
      }
    } catch (err) {
      console.error('Failed to seed default equity data into SQLite:', err);
    }
  } catch (err) {
    console.error('Failed to seed default wallet data into SQLite:', err);
  }
}

export function saveFallbackToStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('arena_desk_persistent_store_v1', JSON.stringify(memoryStore));
    }
  } catch (e) {
    console.error('Failed to save store to localStorage:', e);
  }
}

export function loadFallbackFromStorage(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = localStorage.getItem('arena_desk_persistent_store_v1');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.accounts && Array.isArray(parsed.accounts) && parsed.accounts.length > 0) {
          memoryStore.accounts = parsed.accounts;
          memoryStore.categories = parsed.categories || [];
          memoryStore.entries = parsed.entries || [];
          memoryStore.items = parsed.items || [];
          memoryStore.warehouses = parsed.warehouses || [];
          memoryStore.commodities = parsed.commodities || [];
          memoryStore.commodityGroups = parsed.commodityGroups || [];
          memoryStore.commodityTransactions = parsed.commodityTransactions || [];
          memoryStore.checkbooks = parsed.checkbooks || [];
          memoryStore.cheques = parsed.cheques || [];
          memoryStore.invoices = parsed.invoices || [];
          memoryStore.invoiceItems = parsed.invoiceItems || [];
          memoryStore.invoiceServices = parsed.invoiceServices || [];
          memoryStore.invoicePayments = parsed.invoicePayments || [];
          memoryStore.productionOrders = parsed.productionOrders || [];
          memoryStore.productionOutputs = parsed.productionOutputs || [];
          memoryStore.equityPartners = parsed.equityPartners || [];
          memoryStore.equityTransactions = parsed.equityTransactions || [];
          memoryStore.equityPrice = parsed.equityPrice || 0;
          memoryStore.payrollEmployees = parsed.payrollEmployees || [];
          memoryStore.payrollRecords = parsed.payrollRecords || [];
          memoryStore.payrollPayments = parsed.payrollPayments || [];
          return true;
        }
      }
    }
  } catch (e) {
    console.error('Failed to load store from localStorage:', e);
  }
  return false;
}

export function initFallbackData() {
  if (memoryStore.accounts.length > 0) return;
  const loaded = loadFallbackFromStorage();
  if (loaded && memoryStore.accounts.length > 0) return;

  memoryStore.accounts = walletSeed.accounts as unknown as Account[];
  memoryStore.categories = [];
  memoryStore.entries = walletSeed.entries as unknown as JournalEntry[];
  memoryStore.items = walletSeed.items as unknown as JournalItem[];
  memoryStore.productionOrders = [];
  memoryStore.productionOutputs = [];

  if (memoryStore.equityPartners.length === 0 && equitySeed && equitySeed.partners) {
    memoryStore.equityPartners = equitySeed.partners.map((p: any) => ({
      id: p.id,
      name: p.name,
      color: p.color || '#4ade80',
      note: p.note || '',
      created_at: new Date().toISOString()
    }));
    memoryStore.equityTransactions = (equitySeed.txs || []).map((t: any) => {
      const a = Number(t.a) || 0;
      const pr = Number(t.pr) || 0;
      return {
        id: t.id,
        partner_id: t.p,
        kind: (t.k || 'IN') as any,
        amount_rial: a,
        price_rial_per_kg: pr,
        weight_kg: pr > 0 ? a / pr : 0,
        jdate: t.d || '',
        description: t.t || '',
        status: (t.s || 'confirmed') as any,
        created_at: new Date().toISOString()
      };
    });
    memoryStore.equityPrice = Number(equitySeed.curPrice) || 0;
  }

  saveFallbackToStorage();
}
