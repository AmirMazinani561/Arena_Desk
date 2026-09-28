import type { Account, Invoice, JournalEntry, JournalItem, TransactionInput } from '../types';
import { getDb, isWebFallback, memoryStore, saveFallbackToStorage } from '../core/connection';
import { recalculateAccountBalance } from './accounts';
import { shamsiToGregorian } from '../../utils/dateUtils';

export async function getNextEntryNumber(): Promise<number> {
  const db = await getDb();
  if (db && !isWebFallback) {
    try {
      const res: { maxNum: number | null }[] = await db.select('SELECT MAX(entry_number) as maxNum FROM journal_entries');
      const max = res[0]?.maxNum;
      return typeof max === 'number' && max > 0 ? max + 1 : 1;
    } catch {
      return 1;
    }
  } else {
    if (memoryStore.entries.length === 0) return 1;
    const max = memoryStore.entries.reduce((m, e) => Math.max(m, Number(e.entry_number) || 0), 0);
    return max + 1;
  }
}


export async function getRecentEntries(limit = 0): Promise<(JournalEntry & { items: JournalItem[] })[]> {
  const db = await getDb();
  if (!db || isWebFallback) {
    const sorted = [...memoryStore.entries].sort((a, b) => {
      const dDiff = new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime();
      if (dDiff !== 0) return dDiff;
      return Number(b.entry_number || 0) - Number(a.entry_number || 0);
    });
    const selected = limit > 0 ? sorted.slice(0, limit) : sorted;
    return selected.map(e => ({
      ...e,
      items: memoryStore.items.filter(i => i.entry_id === e.id),
    }));
  }

  const query = limit > 0
    ? `SELECT * FROM journal_entries ORDER BY entry_date DESC, entry_number DESC LIMIT ${limit}`
    : `SELECT * FROM journal_entries ORDER BY entry_date DESC, entry_number DESC`;

  const entries: JournalEntry[] = await db.select(query);

  const results: (JournalEntry & { items: JournalItem[] })[] = [];
  for (const entry of entries) {
    const items: JournalItem[] = await db.select(
      `SELECT ji.*, a.name as account_name, a.type as account_type 
       FROM journal_items ji 
       JOIN accounts a ON a.id = ji.account_id 
       WHERE ji.entry_id = $1`,
      [entry.id]
    );
    results.push({ ...entry, items });
  }

  return results;
}

export async function createDoubleEntryTransaction(tx: TransactionInput): Promise<JournalEntry> {
  const db = await getDb();
  const entryId = 'je_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();
  const gregorianDate = shamsiToGregorian(tx.dateShamsi).toISOString();

  const nextNumber = await getNextEntryNumber();

  const fromAccountList: Account[] = (db && !isWebFallback)
    ? await db.select('SELECT * FROM accounts WHERE id = $1', [tx.fromAccountId])
    : memoryStore.accounts.filter(a => a.id === tx.fromAccountId);
  const toAccountList: Account[] = (db && !isWebFallback)
    ? await db.select('SELECT * FROM accounts WHERE id = $1', [tx.toAccountId])
    : memoryStore.accounts.filter(a => a.id === tx.toAccountId);

  const fromAcc = fromAccountList[0];
  const toAcc = toAccountList[0];

  let sourceType: 'expense' | 'income' | 'transfer' = 'transfer';
  if (toAcc?.type === 'expense') {
    sourceType = 'expense';
  } else if (fromAcc?.type === 'revenue') {
    sourceType = 'income';
  } else {
    sourceType = 'transfer';
  }

  const cleanDesc = tx.description ? tx.description.trim() : '';

  const entry: JournalEntry = {
    id: entryId,
    entry_number: nextNumber,
    entry_date: gregorianDate,
    entry_date_shamsi: tx.dateShamsi,
    description: cleanDesc,
    source_type: sourceType,
    from_account_id: tx.fromAccountId,
    to_account_id: tx.toAccountId,
    fee: tx.fee || 0,
    status: 'final',
    remote_id: tx.remote_id,
    created_at: now,
  };

  const items: JournalItem[] = [];

  items.push({
    id: 'ji_' + Date.now() + '_1',
    entry_id: entryId,
    account_id: tx.toAccountId,
    debit: tx.amount,
    credit: 0,
    note: cleanDesc,
  });

  items.push({
    id: 'ji_' + Date.now() + '_2',
    entry_id: entryId,
    account_id: tx.fromAccountId,
    debit: 0,
    credit: tx.amount,
    note: cleanDesc,
  });

  const feeAmount = tx.fee || 0;
  if (feeAmount > 0) {
    let bankFeeAccId = 'acc_exp_bank_fee';
    if (db && !isWebFallback) {
      const feeAccCheck: Account[] = await db.select("SELECT * FROM accounts WHERE id = 'acc_exp_bank_fee' OR (type = 'expense' AND name LIKE '%کارمزد%') LIMIT 1");
      if (feeAccCheck.length === 0) {
        await db.execute(
          `INSERT INTO accounts (id, code, name, type, color, balance, is_active, created_at)
           VALUES ('acc_exp_bank_fee', '1099', 'کارمزد خدمات بانکی', 'expense', '#f59e0b', 0, 1, $1)`,
          [now]
        );
      } else {
        bankFeeAccId = feeAccCheck[0].id;
      }
    }

    items.push({
      id: 'ji_' + Date.now() + '_fee_debit',
      entry_id: entryId,
      account_id: bankFeeAccId,
      debit: feeAmount,
      credit: 0,
      note: cleanDesc ? `کارمزد: ${cleanDesc}` : 'کارمزد بانکی',
    });

    items.push({
      id: 'ji_' + Date.now() + '_fee_credit',
      entry_id: entryId,
      account_id: tx.fromAccountId,
      debit: 0,
      credit: feeAmount,
      note: cleanDesc ? `کارمزد: ${cleanDesc}` : 'کارمزد بانکی',
    });
  }

  if (db && !isWebFallback) {
    await db.execute(
      `INSERT INTO journal_entries (id, entry_number, entry_date, entry_date_shamsi, description, source_type, from_account_id, to_account_id, fee, status, remote_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [entry.id, entry.entry_number, entry.entry_date, entry.entry_date_shamsi, entry.description, entry.source_type, entry.from_account_id, entry.to_account_id, entry.fee, entry.status, entry.remote_id || null, entry.created_at]
    );

    for (const item of items) {
      await db.execute(
        `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [item.id, item.entry_id, item.account_id, item.debit, item.credit, item.note]
      );
    }

    const affectedAccountIds = Array.from(new Set(items.map(i => i.account_id)));
    for (const accId of affectedAccountIds) {
      await recalculateAccountBalance(accId);
    }
  } else {
    memoryStore.entries.unshift(entry);
    memoryStore.items.push(...items);
    const affectedAccountIds = Array.from(new Set(items.map(i => i.account_id)));
    for (const accId of affectedAccountIds) {
      await recalculateAccountBalance(accId);
    }
    saveFallbackToStorage();
  }

  entry.items = items;
  return entry;
}

export async function deleteTransaction(entryId: string, allowSystemChequeDeletion: boolean = false): Promise<void> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const entryRows: JournalEntry[] = await db.select('SELECT * FROM journal_entries WHERE id = $1 LIMIT 1', [entryId]);
    if (entryRows.length > 0) {
      if (entryRows[0].source_type === 'invoice') {
        const invRows: Invoice[] = await db.select('SELECT * FROM invoices WHERE entry_id = $1 LIMIT 1', [entryId]);
        const invNum = invRows.length > 0 ? invRows[0].invoice_number : '';
        throw new Error(`این سند حسابداری متعلق به فاکتور شماره ${invNum} است. برای حذف آن، باید فاکتور مربوطه را از بخش فاکتورها مدیریت کنید.`);
      }
      if (!allowSystemChequeDeletion && (entryRows[0].source_type === 'cheque' || Boolean(entryRows[0].is_system_generated))) {
        throw new Error('این سند سیستمی و مربوط به عملیات چک است و ویرایش مستقیم آن امکانپذیر نیست.');
      }
    }

    const items: JournalItem[] = await db.select('SELECT * FROM journal_items WHERE entry_id = $1', [entryId]);
    const affectedAccountIds = Array.from(new Set(items.map((i) => i.account_id)));

    await db.execute('DELETE FROM journal_items WHERE entry_id = $1', [entryId]);
    await db.execute('DELETE FROM journal_entries WHERE id = $1', [entryId]);

    for (const accId of affectedAccountIds) {
      await recalculateAccountBalance(accId);
    }
  } else {
    const entry = memoryStore.entries.find((e) => e.id === entryId);
    if (entry) {
      if (entry.source_type === 'invoice') {
        const inv = memoryStore.invoices.find((i) => i.entry_id === entryId);
        const invNum = inv ? inv.invoice_number : '';
        throw new Error(`این سند حسابداری متعلق به فاکتور شماره ${invNum} است. برای حذف آن، باید فاکتور مربوطه را از بخش فاکتورها مدیریت کنید.`);
      }
      if (!allowSystemChequeDeletion && (entry.source_type === 'cheque' || Boolean(entry.is_system_generated))) {
        throw new Error('این سند سیستمی و مربوط به عملیات چک است و ویرایش مستقیم آن امکانپذیر نیست.');
      }
    }

    const items = memoryStore.items.filter(i => i.entry_id === entryId);
    const affectedAccountIds = Array.from(new Set(items.map(i => i.account_id)));

    memoryStore.items = memoryStore.items.filter(i => i.entry_id !== entryId);
    memoryStore.entries = memoryStore.entries.filter(e => e.id !== entryId);

    for (const accId of affectedAccountIds) {
      await recalculateAccountBalance(accId);
    }
    saveFallbackToStorage();
  }
}

export async function updateTransaction(entryId: string, tx: TransactionInput): Promise<void> {
  const db = await getDb();
  let remoteId = tx.remote_id;
  if (!remoteId) {
    if (db && !isWebFallback) {
      try {
        const rows: any[] = await db.select('SELECT remote_id FROM journal_entries WHERE id = $1', [entryId]);
        if (rows[0]?.remote_id) {
          remoteId = rows[0].remote_id;
        }
      } catch {}
    } else {
      const existing = memoryStore.entries.find((e) => e.id === entryId);
      if (existing?.remote_id) {
        remoteId = existing.remote_id;
      }
    }
    if (!remoteId && !entryId.startsWith('je_')) {
      remoteId = entryId;
    }
  }

  await deleteTransaction(entryId);
  await createDoubleEntryTransaction({
    ...tx,
    remote_id: remoteId,
  });
}


export async function saveDraftEntry(entry: JournalEntry, items: JournalItem[]): Promise<void> {
  const db = await getDb();
  if (db && !isWebFallback) {
    await db.execute(
      `INSERT INTO journal_entries (id, entry_number, entry_date, entry_date_shamsi, description, source_type, from_account_id, to_account_id, fee, status, remote_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [entry.id, entry.entry_number, entry.entry_date, entry.entry_date_shamsi, entry.description, entry.source_type, entry.from_account_id, entry.to_account_id, entry.fee, 'draft', entry.remote_id || entry.id, entry.created_at]
    );

    for (const item of items) {
      await db.execute(
        `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [item.id, item.entry_id, item.account_id, item.debit, item.credit, item.note]
      );
    }
  } else {
    entry.remote_id = entry.remote_id || entry.id;
    memoryStore.entries.unshift(entry);
    memoryStore.items.push(...items);
    saveFallbackToStorage();
  }
}

export async function finalizeDraftTransaction(entryId: string): Promise<void> {
  const db = await getDb();
  if (db && !isWebFallback) {
    await db.execute(`UPDATE journal_entries SET status = 'final' WHERE id = $1`, [entryId]);
    const items: JournalItem[] = await db.select('SELECT * FROM journal_items WHERE entry_id = $1', [entryId]);
    const affectedAccountIds = Array.from(new Set(items.map(i => i.account_id)));
    for (const accId of affectedAccountIds) {
      await recalculateAccountBalance(accId);
    }
  } else {
    const entry = memoryStore.entries.find(e => e.id === entryId);
    if (entry) {
      entry.status = 'final';
      const items = memoryStore.items.filter(i => i.entry_id === entryId);
      const affectedAccountIds = Array.from(new Set(items.map(i => i.account_id)));
      for (const accId of affectedAccountIds) {
        await recalculateAccountBalance(accId);
      }
      saveFallbackToStorage();
    }
  }
}
