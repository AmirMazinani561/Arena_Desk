import type { Account, JournalEntry, JournalItem, EquityPartner, PayrollEmployee } from '../db/types';
import { 
  syncAccountFromWallet, 
  getAllAccounts,
  getRecentEntries,
  saveDraftEntry,
  getAllEquityPartners, 
  getAllEquityTransactions, 
  createEquityTransaction,
  getAllPayrollEmployees,
  getAllPayrollPayments,
  getOrCreatePayrollMonthlyRecord,
  createPayrollPayment
} from '../db/sqlite';

export interface WalletSyncConfig {
  url: string;
  username?: string;
  password?: string;
  autoSync?: boolean;
  lastSync?: string;
}

const STORAGE_KEY = 'arena_wallet_sync_config_v1';
const SYNCED_IDS_KEY = 'arena_synced_wallet_tx_ids_v1';

export function getSyncConfig(): WalletSyncConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load sync config:', e);
  }
  return {
    url: 'https://arena-wallet-pi.vercel.app',
    username: '',
    password: '',
    autoSync: true,
  };
}

export function saveSyncConfig(config: WalletSyncConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save sync config:', e);
  }
}

// تاریخچه دائمی شناسه‌هایی که تا به حال از کیف پول دریافت شده‌اند
export function getPersistentSyncedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SYNCED_IDS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

export function markWalletIdsAsSynced(ids: string[]): void {
  try {
    const set = getPersistentSyncedIds();
    ids.forEach((id) => set.add(String(id)));
    localStorage.setItem(SYNCED_IDS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function normalizeFa(s?: string | null): string {
  return String(s || '')
    .replace(/\u200c/g, ' ')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const STOPWORDS = [
  'سرمایه', 'سرمایه گذاری', 'حساب', 'شراکت', 'سهم', 'شریک',
  'اقای', 'آقای', 'خانم', 'جناب', 'مهندس', 'دکتر', 'حاج',
];

export function coreName(s?: string | null): string {
  let t = normalizeFa(s);
  for (const w of STOPWORDS) {
    t = t.replace(new RegExp(`(^|\\s)${normalizeFa(w)}(\\s|$)`, 'g'), ' ');
  }
  return t.replace(/\s+/g, ' ').trim();
}

export function matchStrictEquityPartner(
  accountName: string | undefined | null,
  partners: EquityPartner[]
): EquityPartner | null {
  if (!accountName || !partners.length) return null;
  const acc = normalizeFa(accountName).trim();

  // فیلتر قطعی و صریح کاربر: فقط تراکنش‌هایی که یک طرفشان دقیقاً یکی از این دو اسم باشد:
  // ۱) «سرمایه سلطانی»
  // ۲) «سرمایه مزینانی»
  let targetPartnerKey: 'سلطانی' | 'مزینانی' | null = null;
  if (
    acc === 'سرمایه سلطانی' || 
    acc === 'سرمایه اقای سلطانی' || 
    acc === 'سرمایه آقای سلطانی'
  ) {
    targetPartnerKey = 'سلطانی';
  } else if (
    acc === 'سرمایه مزینانی' || 
    acc === 'سرمایه اقای مزینانی' || 
    acc === 'سرمایه آقای مزینانی'
  ) {
    targetPartnerKey = 'مزینانی';
  }

  if (!targetPartnerKey) return null;

  return partners.find((p) => normalizeFa(p.name).includes(targetPartnerKey!)) || null;
}

export const matchPartner = matchStrictEquityPartner;

export function matchEmployee(
  accountName: string | undefined | null,
  employees: PayrollEmployee[]
): PayrollEmployee | null {
  if (!accountName || !employees.length) return null;
  const acc = normalizeFa(accountName);
  const accCore = coreName(accountName);
  if (!acc && !accCore) return null;

  // ۱) تطابق کامل نام
  let hits = employees.filter(e => normalizeFa(e.name) === acc);
  if (hits.length === 1) return hits[0];

  // ۲) تطابق هسته نام
  if (accCore) {
    hits = employees.filter(e => coreName(e.name) === accCore);
    if (hits.length === 1) return hits[0];
  }

  // ۳) دربرگیری نام
  hits = employees.filter(e => {
    const eNorm = normalizeFa(e.name);
    const eCore = coreName(e.name);
    if (eNorm.length < 3) return false;
    return acc.includes(eNorm) || (accCore && eCore && accCore.includes(eCore));
  });
  if (hits.length === 1) return hits[0];

  return null;
}

export async function fetchFromWallet(
  cleanUrl: string,
  username: string,
  password: string,
  endpoint: string = '/api/transactions?limit=250'
): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const resJsonStr = await invoke<string>('sync_wallet_online', {
        url: cleanUrl,
        username: username || null,
        password: password || null,
        endpoint: endpoint || null,
      });
      return JSON.parse(resJsonStr);
    } catch (tauriErr: any) {
      console.warn('Tauri native sync failed, checking fallback:', tauriErr);
      const errMsg = typeof tauriErr === 'string' ? tauriErr : tauriErr?.message;
      if (errMsg && !errMsg.includes('Command') && !errMsg.includes('not found')) {
        throw new Error(errMsg);
      }
    }
  }

  try {
    const localRes = await fetch('/api-sync-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: cleanUrl, username, password, endpoint }),
    });

    if (localRes.ok) {
      return await localRes.json();
    } else {
      const errData = await localRes.json().catch(() => ({}));
      throw new Error(errData.error || `خطا در ارتباط با سرور کیف پول (${localRes.status})`);
    }
  } catch (proxyErr: any) {
    if (proxyErr.message && !proxyErr.message.includes('Failed to fetch') && !proxyErr.message.includes('404')) {
      throw proxyErr;
    }
  }

  const fallbackUrl = `/api-wallet${endpoint}`;
  const res = await fetch(fallbackUrl, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'عدم دسترسی به سرور کیف پول آنلاین.');
  }

  return await res.json();
}

export interface WalletSyncResult {
  success: boolean;
  newDraftsCount: number;
  newAccountsCount: number;
  newEquityCount: number;
  newPayrollCount: number;
  message: string;
}

export async function syncWalletTransactions(
  existingEntries?: JournalEntry[],
  accounts?: Account[],
  onSaveNewDraftEntry?: (entry: JournalEntry, items: JournalItem[]) => Promise<void>
): Promise<WalletSyncResult> {
  const config = getSyncConfig();
  if (!config.url) {
    return { success: false, newDraftsCount: 0, newAccountsCount: 0, newEquityCount: 0, newPayrollCount: 0, message: 'آدرس سرور کیف پول تنظیم نشده است.' };
  }

  const username = (config.username || '').trim();
  const password = config.password || '';

  if (!username || !password) {
    return {
      success: false,
      newDraftsCount: 0,
      newAccountsCount: 0,
      newEquityCount: 0,
      newPayrollCount: 0,
      message: 'لطفاً ابتدا نام کاربری و رمز عبور کیف پول خود را وارد نمایید.',
    };
  }

  const cleanUrl = config.url.replace(/\/+$/, '');
  const activeAccounts = accounts || await getAllAccounts();
  const activeEntries = existingEntries || await getRecentEntries();
  const saveDraft = onSaveNewDraftEntry || (async (entry: any, items: any) => {
    await saveDraftEntry(entry, items);
  });

  try {
    // ۱. همگام‌سازی حساب‌ها
    let newAccountsCount = 0;
    const accountIdMap = new Map<string, string>();
    const currentAccounts = [...activeAccounts];

    try {
      const accData = await fetchFromWallet(cleanUrl, username, password, '/api/accounts');
      const walletAccounts = Array.isArray(accData) ? accData : (accData?.accounts || accData?.items || []);

      for (const wAcc of walletAccounts) {
        if (!wAcc || !wAcc.id) continue;
        const existingAcc = currentAccounts.find(
          (a) => a.id === wAcc.id || (a.name.trim().toLowerCase() === wAcc.name.trim().toLowerCase())
        );

        if (existingAcc) {
          accountIdMap.set(wAcc.id, existingAcc.id);
        } else {
          try {
            const created = await syncAccountFromWallet(wAcc);
            currentAccounts.push(created);
            accountIdMap.set(wAcc.id, created.id);
            newAccountsCount++;
          } catch (createErr) {
            console.error('Failed to create synced account:', wAcc, createErr);
            accountIdMap.set(wAcc.id, wAcc.id);
          }
        }
      }
    } catch (accErr) {
      console.warn('Accounts sync skipped:', accErr);
    }

    // ۲. بارگذاری داده‌های شرکای سرمایه و پرسنل حقوق برای تطابق همزمان
    const [equityPartners, existingEquityTxs, payrollEmployees, existingPayrollPayments] = await Promise.all([
      getAllEquityPartners(),
      getAllEquityTransactions(),
      getAllPayrollEmployees(),
      getAllPayrollPayments()
    ]);

    // ۳. دریافت تراکنش‌ها از سرور کیف پول
    const txData = await fetchFromWallet(cleanUrl, username, password, '/api/transactions?limit=250');
    const rawItems = Array.isArray(txData) ? txData : (txData?.transactions || txData?.items || []);

    if (!rawItems || rawItems.length === 0) {
      return {
        success: true,
        newDraftsCount: 0,
        newAccountsCount,
        newEquityCount: 0,
        newPayrollCount: 0,
        message: 'هیچ تراکنشی در سرور کیف پول یافت نشد.',
      };
    }

    // تجمیع حافظه پایدار و رکوردهای موجود برای مسدودسازی تکراری‌ها در دفتر روزنامه
    const persistentSynced = getPersistentSyncedIds();
    const existingRemoteIds = new Set<string>(persistentSynced);

    for (const e of activeEntries) {
      if (e.id) existingRemoteIds.add(String(e.id));
      if (e.remote_id) existingRemoteIds.add(String(e.remote_id));
    }

    const feeAccount =
      currentAccounts.find((a) => a.type === 'expense' && a.name.includes('کارمزد')) ||
      currentAccounts.find((a) => a.type === 'expense');

    let newDraftsCount = 0;
    let newEquityCount = 0;
    let newPayrollCount = 0;
    let maxEntryNumber = activeEntries.reduce((max, e) => Math.max(max, e.entry_number || 0), 0);
    const newlySyncedIds: string[] = [];

    for (const tx of rawItems) {
      const rawId = String(tx.id || tx._id || '');
      if (!rawId) continue;

      const dateIso = tx.date ? new Date(tx.date).toISOString() : new Date().toISOString();
      const shamsi = tx.shamsiDate || tx.shamsi_date || '';
      const cleanJdate = shamsi.replace(/\D/g, '');
      const desc = tx.description ? `${tx.description}`.trim() : 'تراکنش جدید کیف پول';
      const fee = Number(tx.fee) || 0;
      const amount = Number(tx.amount) || 0;

      const fromWalletId = tx.fromAccountId || tx.from_account_id;
      const toWalletId = tx.toAccountId || tx.to_account_id;
      const fromDeskId = fromWalletId ? (accountIdMap.get(fromWalletId) || fromWalletId) : undefined;
      const toDeskId = toWalletId ? (accountIdMap.get(toWalletId) || toWalletId) : undefined;

      const fromAcc = currentAccounts.find(a => a.id === fromDeskId || a.id === fromWalletId);
      const toAcc = currentAccounts.find(a => a.id === toDeskId || a.id === toWalletId);
      const fromName = tx.fromAccountName || fromAcc?.name || '';
      const toName = tx.toAccountName || toAcc?.name || '';

      // -------------------------------------------------------------
      // الف) همگام‌سازی پیش‌نویس دفتر روزنامه (حسابداری دوبل)
      // -------------------------------------------------------------
      if (!existingRemoteIds.has(rawId)) {
        maxEntryNumber++;
        const entryId = 'draft_' + rawId;

        const draftEntry: JournalEntry = {
          id: entryId,
          remote_id: rawId,
          entry_number: maxEntryNumber,
          entry_date: dateIso,
          entry_date_shamsi: shamsi,
          description: desc,
          source_type: tx.type || 'expense',
          from_account_id: fromDeskId,
          to_account_id: toDeskId,
          fee,
          status: 'draft',
          created_at: new Date().toISOString(),
        };

        const items: JournalItem[] = [
          {
            id: entryId + '_debit',
            entry_id: entryId,
            account_id: draftEntry.to_account_id || '',
            debit: amount,
            credit: 0,
            note: desc,
          },
          {
            id: entryId + '_credit',
            entry_id: entryId,
            account_id: draftEntry.from_account_id || '',
            debit: 0,
            credit: amount,
            note: desc,
          },
        ];

        if (fee > 0 && feeAccount && draftEntry.from_account_id) {
          items.push({
            id: entryId + '_fee_debit',
            entry_id: entryId,
            account_id: feeAccount.id,
            debit: fee,
            credit: 0,
            note: 'کارمزد بانکی',
          });
          items.push({
            id: entryId + '_fee_credit',
            entry_id: entryId,
            account_id: draftEntry.from_account_id,
            debit: 0,
            credit: fee,
            note: 'کارمزد بانکی',
          });
        }

        await saveDraft(draftEntry, items);
        newlySyncedIds.push(rawId);
        existingRemoteIds.add(rawId);
        existingRemoteIds.add(entryId);
        newDraftsCount++;
      }

      // -------------------------------------------------------------
      // ب) بررسی و همگام‌سازی ماژول سرمایه شرکا (سلطانی / مزینانی)
      // -------------------------------------------------------------
      const fromPartner = matchPartner(fromName, equityPartners);
      const toPartner = matchPartner(toName, equityPartners);

      if (fromPartner && toPartner) {
        // انتقال داخلی بین دو شریک (بدون تغییر در سرمایه کل)
      } else if (fromPartner || toPartner) {
        const matchedPartner = (toPartner || fromPartner)!;
        let kind: 'IN' | 'OUT' = toPartner ? 'OUT' : 'IN';
        if (tx.kind === 'IN' || tx.kind === 'OUT') kind = tx.kind;

        const isDupEquity = existingEquityTxs.some(t => 
          (t.source_id && String(t.source_id) === rawId) ||
          (t.partner_id === matchedPartner.id &&
           t.kind === kind &&
           Math.abs(t.amount_rial - amount) < 1 &&
           t.jdate.replace(/\D/g, '') === cleanJdate)
        );

        if (!isDupEquity && amount > 0 && cleanJdate) {
          const newEqTx = await createEquityTransaction({
            partner_id: matchedPartner.id,
            kind,
            amount_rial: amount,
            price_rial_per_kg: 0, // در انتظار ثبت نرخ روز شمش
            weight_kg: 0,
            jdate: cleanJdate,
            description: desc || 'تراکنش دریافتی از کیف پول',
            status: 'pending', // در انتظار
            source: 'wallet',
            source_id: rawId,
          });
          existingEquityTxs.push(newEqTx);
          newEquityCount++;
        }
      }

      // -------------------------------------------------------------
      // ج) بررسی و همگام‌سازی ماژول حقوق و دستمزد پرسنل (Payroll)
      // -------------------------------------------------------------
      const matchedEmp = matchEmployee(toName, payrollEmployees) || matchEmployee(fromName, payrollEmployees);

      if (matchedEmp && amount > 0 && cleanJdate.length >= 6) {
        const year = parseInt(cleanJdate.slice(0, 4), 10);
        const month = parseInt(cleanJdate.slice(4, 6), 10);

        const isDupPayroll = existingPayrollPayments.some(p =>
          (p.source_id && String(p.source_id) === rawId) ||
          (p.payment_date.replace(/\D/g, '') === cleanJdate && Math.abs(p.amount_rial - amount) < 1)
        );

        if (!isDupPayroll) {
          const record = await getOrCreatePayrollMonthlyRecord(
            matchedEmp.id,
            year,
            month
          );

          const newPay = await createPayrollPayment({
            record_id: record.id,
            payment_date: cleanJdate,
            amount_rial: amount,
            payment_type: 'در انتظار', // ثبت در حالت در انتظار
            description: desc || 'پرداخت از کیف پول',
            source: 'wallet',
            source_id: rawId,
          });
          existingPayrollPayments.push(newPay);
          newPayrollCount++;
        }
      }
    }

    if (newlySyncedIds.length > 0) {
      markWalletIdsAsSynced(newlySyncedIds);
    }

    config.lastSync = new Date().toISOString();
    saveSyncConfig(config);

    const parts: string[] = [];
    if (newDraftsCount > 0) parts.push(`${newDraftsCount} پیش‌نویس دفتر روزنامه`);
    if (newEquityCount > 0) parts.push(`${newEquityCount} تراکنش سرمایه (در انتظار قیمت)`);
    if (newPayrollCount > 0) parts.push(`${newPayrollCount} پرداختی حقوق (در انتظار)`);

    let message = '';
    if (parts.length > 0) {
      message = `همگام‌سازی با موفقیت انجام شد: ${parts.join(' و ')} ثبت گردید.`;
    } else {
      message = 'همه تراکنش‌های کیف پول قبلاً همگام شده‌اند و مورد جدیدی یافت نشد.';
    }

    return { success: true, newDraftsCount, newAccountsCount, newEquityCount, newPayrollCount, message };
  } catch (err: any) {
    console.error('Wallet sync error:', err);
    return {
      success: false,
      newDraftsCount: 0,
      newAccountsCount: 0,
      newEquityCount: 0,
      newPayrollCount: 0,
      message: err?.message || 'خطا در ارتباط با سرور کیف پول.',
    };
  }
}