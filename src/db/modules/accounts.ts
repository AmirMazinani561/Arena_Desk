import type { Account, AccountType, Category, JournalEntry, JournalItem, Invoice } from '../types';
import { getDb, isWebFallback, cleanNum, memoryStore, saveFallbackToStorage } from '../core/connection';
import { getCurrentShamsi } from '../../utils/dateUtils';
import { getNextEntryNumber } from './transactions';
import { getAllInvoices, ensureInvoiceAccounts } from './invoices';
import { ensureCheckAccounts } from './cheques';

export async function recalculateAccountBalance(accountId: string): Promise<number> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const accRows: Account[] = await db.select('SELECT * FROM accounts WHERE id = $1', [accountId]);
    const acc = accRows[0];
    if (!acc) return 0;

    const initBal = Number(acc.initial_balance) || 0;
    const sumRows: any[] = await db.select(
      `SELECT 
        COALESCE(SUM(ji.debit), 0) as total_debit,
        COALESCE(SUM(ji.credit), 0) as total_credit
       FROM journal_items ji
       JOIN journal_entries je ON je.id = ji.entry_id
       WHERE ji.account_id = $1 AND je.status != 'draft' AND je.source_type != 'opening' AND je.description NOT LIKE '%سند افتتاحیه%'`,
      [accountId]
    );

    const totalDebit = Number(sumRows[0]?.total_debit) || 0;
    const totalCredit = Number(sumRows[0]?.total_credit) || 0;

    let newBal = initBal;
    if (acc.type === 'asset' || acc.type === 'person') {
      newBal = initBal + (totalDebit - totalCredit);
    } else if (acc.type === 'liability') {
      newBal = initBal + (totalCredit - totalDebit);
    } else if (acc.type === 'expense') {
      newBal = totalDebit - totalCredit;
    } else if (acc.type === 'revenue') {
      newBal = totalCredit - totalDebit;
    }

    await db.execute('UPDATE accounts SET balance = $1 WHERE id = $2', [newBal, accountId]);
    return newBal;
  } else {
    const acc = memoryStore.accounts.find(a => a.id === accountId);
    if (!acc) return 0;
    const initBal = Number(acc.initial_balance) || 0;
    let totalDebit = 0;
    let totalCredit = 0;

    for (const it of memoryStore.items) {
      if (it.account_id === accountId) {
        const je = memoryStore.entries.find(e => e.id === it.entry_id);
        if (je && je.status !== 'draft' && je.source_type !== 'opening' && !je.description?.includes('سند افتتاحیه')) {
          totalDebit += Number(it.debit) || 0;
          totalCredit += Number(it.credit) || 0;
        }
      }
    }

    let newBal = initBal;
    if (acc.type === 'asset' || acc.type === 'person') {
      newBal = initBal + (totalDebit - totalCredit);
    } else if (acc.type === 'liability') {
      newBal = initBal + (totalCredit - totalDebit);
    } else if (acc.type === 'expense') {
      newBal = totalDebit - totalCredit;
    } else if (acc.type === 'revenue') {
      newBal = totalCredit - totalDebit;
    }

    acc.balance = newBal;
    saveFallbackToStorage();
    return newBal;
  }
}

export async function importConvertedDataset(store: {
  accounts: Account[];
  entries: JournalEntry[];
  items: JournalItem[];
}): Promise<void> {
  const db = await getDb();
  if (db && !isWebFallback) {
    await db.execute('DELETE FROM journal_items;');
    await db.execute('DELETE FROM journal_entries;');
    await db.execute('DELETE FROM accounts;');

    for (const acc of store.accounts) {
      await db.execute(
        `INSERT INTO accounts (id, code, name, type, bank_name, account_number, card_number, color, icon, balance, initial_balance, parent_id, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, $13)`,
        [acc.id, acc.code, acc.name, acc.type, acc.bank_name, acc.account_number, acc.card_number, acc.color, acc.icon, acc.balance, acc.initial_balance || 0, acc.parent_id, acc.created_at]
      );
    }

    let seqNum = 1;
    for (const e of store.entries) {
      await db.execute(
        `INSERT INTO journal_entries (id, entry_number, entry_date, entry_date_shamsi, description, source_type, from_account_id, to_account_id, fee, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [e.id, seqNum++, e.entry_date, e.entry_date_shamsi, e.description, e.source_type, e.from_account_id, e.to_account_id, e.fee, e.status, e.created_at]
      );
    }

    for (const it of store.items) {
      await db.execute(
        `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [it.id, it.entry_id, it.account_id, it.debit, it.credit, it.note]
      );
    }
  }

  memoryStore.accounts = store.accounts;
  memoryStore.categories = [];
  memoryStore.entries = store.entries.map((e, idx) => ({ ...e, entry_number: idx + 1 }));
  memoryStore.items = store.items;
  saveFallbackToStorage();
}

export async function getNextAccountCode(type: AccountType): Promise<string> {
  const db = await getDb();
  let baseCode = 1;
  let maxAllowed = 99;

  if (type === 'asset') {
    baseCode = 1;
    maxAllowed = 99;
  } else if (type === 'person') {
    baseCode = 101;
    maxAllowed = 199;
  } else if (type === 'liability') {
    baseCode = 201;
    maxAllowed = 299;
  } else if (type === 'expense') {
    baseCode = 1001;
    maxAllowed = 2999;
  } else if (type === 'revenue') {
    baseCode = 3001;
    maxAllowed = 4999;
  }

  let maxCode = 0;

  if (db && !isWebFallback) {
    const rows: { code: string }[] = await db.select(
      `SELECT code FROM accounts WHERE type = $1 AND is_active = 1`,
      [type]
    );
    for (const r of rows) {
      const num = parseInt(r.code, 10);
      if (!isNaN(num) && num >= baseCode && num <= maxAllowed && num > maxCode) {
        maxCode = num;
      }
    }
  } else {
    for (const a of memoryStore.accounts) {
      if (a.type === type && a.is_active) {
        const num = parseInt(a.code, 10);
        if (!isNaN(num) && num >= baseCode && num <= maxAllowed && num > maxCode) {
          maxCode = num;
        }
      }
    }
  }

  return String(maxCode > 0 ? maxCode + 1 : baseCode);
}

export async function insertAccount(data: {
  name: string;
  code: string;
  type: AccountType;
  bank_name?: string;
  account_number?: string;
  card_number?: string;
  color?: string;
  balance?: number;
  initial_balance?: number;
  parent_id?: string | null;
}): Promise<Account> {
  const db = await getDb();
  const id = 'acc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();
  const initialBal = Number(data.initial_balance ?? data.balance ?? 0);
  const parentId = data.parent_id && data.parent_id.trim() !== '' ? data.parent_id.trim() : null;

  const newAccount: Account = {
    id,
    code: data.code,
    name: data.name,
    type: data.type,
    bank_name: data.bank_name || (data.type === 'asset' ? data.name : ''),
    account_number: data.account_number || '',
    card_number: data.card_number || '',
    color: data.color || (data.type === 'asset' ? '#0284c7' : (data.type === 'person' || data.type === 'liability') ? '#7c3aed' : data.type === 'expense' ? '#ef4444' : '#16a34a'),
    balance: initialBal,
    initial_balance: initialBal,
    parent_id: parentId,
    is_active: 1,
    created_at: now,
  };

  try {
    if (db && !isWebFallback) {
      await db.execute(
        `INSERT INTO accounts (id, code, name, type, bank_name, account_number, card_number, color, balance, initial_balance, parent_id, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, $12)`,
        [newAccount.id, newAccount.code, newAccount.name, newAccount.type, newAccount.bank_name, newAccount.account_number, newAccount.card_number, newAccount.color, newAccount.balance, newAccount.initial_balance, newAccount.parent_id, now]
      );

      if (initialBal !== 0 && (data.type === 'asset' || data.type === 'person' || data.type === 'liability')) {
        const entryId = 'je_init_' + Date.now();
        const shamsi = getCurrentShamsi().formatted;
        const nextNum = await getNextEntryNumber();

        let debit = 0;
        let credit = 0;
        if (data.type === 'asset') {
          if (initialBal >= 0) debit = initialBal;
          else credit = Math.abs(initialBal);
        } else {
          if (initialBal < 0) credit = Math.abs(initialBal);
          else debit = initialBal;
        }

        await db.execute(
          `INSERT INTO journal_entries (id, entry_number, entry_date, entry_date_shamsi, description, source_type, status, created_at)
           VALUES ($1, $2, $3, $4, 'سند افتتاحیه - مانده اولیه', 'opening', 'final', $5)`,
          [entryId, nextNum, now, shamsi, now]
        );

        await db.execute(
          `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note)
           VALUES ($1, $2, $3, $4, $5, 'مانده اولیه')`,
          ['ji_init_' + Date.now(), entryId, newAccount.id, debit, credit]
        );
      }
    } else {
      memoryStore.accounts.push(newAccount);

      if (initialBal !== 0 && (data.type === 'asset' || data.type === 'person' || data.type === 'liability')) {
        const entryId = 'je_init_' + Date.now();
        const shamsi = getCurrentShamsi().formatted;
        let debit = 0;
        let credit = 0;
        if (data.type === 'asset') {
          if (initialBal >= 0) debit = initialBal;
          else credit = Math.abs(initialBal);
        } else {
          if (initialBal < 0) credit = Math.abs(initialBal);
          else debit = initialBal;
        }

        const entry: JournalEntry = {
          id: entryId,
          entry_number: await getNextEntryNumber(),
          entry_date: now,
          entry_date_shamsi: shamsi,
          description: 'سند افتتاحیه - مانده اولیه',
          source_type: 'opening',
          status: 'final',
          created_at: now,
        };
        const item: JournalItem = {
          id: 'ji_init_' + Date.now(),
          entry_id: entryId,
          account_id: newAccount.id,
          account_name: newAccount.name,
          account_type: newAccount.type,
          debit,
          credit,
          note: 'مانده اولیه',
        };
        memoryStore.entries.unshift(entry);
        memoryStore.items.push(item);
      }
      saveFallbackToStorage();
    }
  } catch (err) {
    console.error('Failed to insert account into SQLite database:', err);
    throw err;
  }

  return newAccount;
}

export async function syncAccountFromWallet(wAcc: {
  id: string;
  name: string;
  type: string;
  initialBalance?: number;
  parentId?: string | null;
  detailInfo?: string | null;
  icon?: string;
  color?: string;
}): Promise<Account> {
  const db = await getDb();
  const deskType: AccountType =
    wAcc.type === 'bank' || wAcc.type === 'cash'
      ? 'asset'
      : wAcc.type === 'income'
      ? 'revenue'
      : wAcc.type === 'person'
      ? 'person'
      : (wAcc.type as AccountType) || 'expense';

  const code = String(await getNextAccountCode(deskType));
  const now = new Date().toISOString();
  const initBal = Number(wAcc.initialBalance) || 0;

  const newAcc: Account = {
    id: wAcc.id,
    code,
    name: wAcc.name.trim(),
    type: deskType,
    bank_name: wAcc.type === 'bank' ? wAcc.name.trim() : (deskType === 'asset' ? 'نقد' : ''),
    account_number: wAcc.detailInfo || '',
    card_number: (wAcc.detailInfo && wAcc.detailInfo.length === 16) ? wAcc.detailInfo : '',
    color: wAcc.color || (deskType === 'asset' ? '#0284c7' : deskType === 'person' ? '#7c3aed' : deskType === 'expense' ? '#ef4444' : '#16a34a'),
    icon: wAcc.icon || (deskType === 'asset' ? 'credit-card' : deskType === 'person' ? 'users' : 'tag'),
    balance: initBal,
    initial_balance: initBal,
    parent_id: wAcc.parentId || null,
    is_active: 1,
    created_at: now,
  };

  if (db && !isWebFallback) {
    await db.execute(
      `INSERT INTO accounts (id, code, name, type, bank_name, account_number, card_number, color, icon, balance, initial_balance, parent_id, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, $13)`,
      [newAcc.id, newAcc.code, newAcc.name, newAcc.type, newAcc.bank_name, newAcc.account_number, newAcc.card_number, newAcc.color, newAcc.icon, newAcc.balance, newAcc.initial_balance, newAcc.parent_id, now]
    );
  } else {
    memoryStore.accounts.push(newAcc);
    saveFallbackToStorage();
  }

  return newAcc;
}

let lastHealTime = 0;

export async function healCorruptedAccountAssignments(): Promise<void> {
  const nowTime = Date.now();
  if (nowTime - lastHealTime < 1000) return;
  lastHealTime = nowTime;

  try {
    const db = await getDb();
    const { purchaseInventoryId } = await ensureInvoiceAccounts();
    const { notesReceivableId, notesPayableId } = await ensureCheckAccounts();
    const affectedAccounts = new Set<string>();

    if (db && !isWebFallback) {
      // 1. Audit all cheques directly from `cheques` table
      const allCheques: any[] = await db.select('SELECT * FROM cheques');
      for (const chk of allCheques) {
        if (chk.type === 'received') {
          // A) Cheque creation entry: non-person item MUST be notesReceivableId
          if (chk.entry_id) {
            const items: any[] = await db.select('SELECT id, account_id, debit, credit FROM journal_items WHERE entry_id = $1', [chk.entry_id]);
            for (const it of items) {
              if (it.account_id !== chk.person_id && it.account_id !== notesReceivableId) {
                affectedAccounts.add(it.account_id);
                await db.execute('UPDATE journal_items SET account_id = $1 WHERE id = $2', [notesReceivableId, it.id]);
              }
            }
          }
          // B) Cheque operations (cleared, assigned, bounced, returned)
          const opEntries: any[] = await db.select(
            'SELECT id FROM journal_entries WHERE related_cheque_id = $1 OR id = $2',
            [chk.id, chk.last_operation_entry_id || '']
          );
          for (const ope of opEntries) {
            if (ope.id === chk.entry_id) continue;
            const items: any[] = await db.select('SELECT id, account_id, debit, credit FROM journal_items WHERE entry_id = $1', [ope.id]);
            for (const it of items) {
              if (Number(it.credit) > 0 && it.account_id !== notesReceivableId) {
                const accInfo: any[] = await db.select('SELECT type FROM accounts WHERE id = $1', [it.account_id]);
                if (accInfo[0]?.type === 'person') {
                  affectedAccounts.add(it.account_id);
                  await db.execute('UPDATE journal_items SET account_id = $1 WHERE id = $2', [notesReceivableId, it.id]);
                }
              }
            }
          }
        } else if (chk.type === 'issued') {
          if (chk.entry_id) {
            const items: any[] = await db.select('SELECT id, account_id, debit, credit FROM journal_items WHERE entry_id = $1', [chk.entry_id]);
            for (const it of items) {
              if (it.account_id !== chk.person_id && it.account_id !== notesPayableId) {
                affectedAccounts.add(it.account_id);
                await db.execute('UPDATE journal_items SET account_id = $1 WHERE id = $2', [notesPayableId, it.id]);
              }
            }
          }
        }
      }

      // 2. Direct audit for Person 105 (اسماعیل موسوی) and any person carrying cheque items
      const p105Res: any[] = await db.select("SELECT id FROM accounts WHERE code = '105' OR id = 'acc_1789103723672_d28830'");
      const p105Id = p105Res[0]?.id;
      if (p105Id) {
        const p105Items: any[] = await db.select(
          `SELECT ji.id, ji.debit, ji.credit, ji.entry_id, ji.note, je.description, je.source_type, je.related_cheque_id
           FROM journal_items ji
           JOIN journal_entries je ON je.id = ji.entry_id
           WHERE ji.account_id = $1`,
          [p105Id]
        );
        for (const it of p105Items) {
          const text = (it.note || '') + ' ' + (it.description || '');
          const isChequeEntry = it.source_type === 'cheque' || Boolean(it.related_cheque_id) || text.includes('چک');
          if (isChequeEntry) {
            let isLegitParty = false;
            if (it.related_cheque_id) {
              const chks: any[] = await db.select('SELECT person_id FROM cheques WHERE id = $1', [it.related_cheque_id]);
              if (chks[0]?.person_id === p105Id) isLegitParty = true;
            }
            const chkByEntry: any[] = await db.select('SELECT person_id FROM cheques WHERE entry_id = $1', [it.entry_id]);
            if (chkByEntry[0]?.person_id === p105Id && Number(it.credit) > 0) isLegitParty = true;

            if (!isLegitParty) {
              affectedAccounts.add(p105Id);
              await db.execute('UPDATE journal_items SET account_id = $1 WHERE id = $2', [notesReceivableId, it.id]);
            }
          }
        }
      }

      // 3. Purchase invoices audit: ensure inventory account is expense (خرید کالا) and not an asset
      await db.execute(
        "UPDATE accounts SET name = 'خرید کالا', type = 'expense', code = '5001', color = '#ef4444', icon = 'shopping-bag' WHERE id = 'acc_inventory_default' OR (name LIKE '%موجودی کالا%' AND type = 'asset')"
      );

      const wrongInvItems: any[] = await db.select(
        `SELECT ji.id, ji.account_id 
         FROM journal_items ji
         JOIN accounts a ON a.id = ji.account_id
         WHERE a.type = 'person' 
           AND (ji.note LIKE '%خرید کالا%' OR ji.note LIKE '%افزایش موجودی کالا%')`
      );
      for (const item of wrongInvItems) {
        affectedAccounts.add(item.account_id);
        await db.execute('UPDATE journal_items SET account_id = $1 WHERE id = $2', [purchaseInventoryId, item.id]);
      }

      affectedAccounts.add(purchaseInventoryId);
      affectedAccounts.add(notesReceivableId);
      affectedAccounts.add(notesPayableId);

      for (const accId of affectedAccounts) {
        await recalculateAccountBalance(accId);
      }
    } else {
      const corruptInv = memoryStore.accounts.find(a => a.id === 'acc_inventory_default' || (a.name.includes('موجودی کالا') && a.type === 'asset'));
      if (corruptInv) {
        corruptInv.name = 'خرید کالا';
        corruptInv.type = 'expense';
        corruptInv.code = '5001';
        corruptInv.color = '#ef4444';
        corruptInv.icon = 'shopping-bag';
      }
      // In-memory fallback healing
      const personsMap = new Map(memoryStore.accounts.filter(a => a.type === 'person').map(a => [a.id, a]));
      const p105 = memoryStore.accounts.find(a => a.code === '105' || a.id === 'acc_1789103723672_d28830');
      const p105Id = p105?.id;

      // A) Cheques table audit
      for (const chk of memoryStore.cheques) {
        if (chk.type === 'received') {
          if (chk.entry_id) {
            for (const it of memoryStore.items) {
              if (it.entry_id === chk.entry_id && it.account_id !== chk.person_id && it.account_id !== notesReceivableId) {
                affectedAccounts.add(it.account_id);
                it.account_id = notesReceivableId;
              }
            }
          }
          const opEntryIds = new Set<string>();
          if (chk.last_operation_entry_id) opEntryIds.add(chk.last_operation_entry_id);
          for (const e of memoryStore.entries) {
            if (e.related_cheque_id === chk.id && e.id !== chk.entry_id) opEntryIds.add(e.id);
          }
          for (const it of memoryStore.items) {
            if (opEntryIds.has(it.entry_id) && Number(it.credit) > 0 && it.account_id !== notesReceivableId) {
              if (personsMap.has(it.account_id)) {
                affectedAccounts.add(it.account_id);
                it.account_id = notesReceivableId;
              }
            }
          }
        } else if (chk.type === 'issued') {
          if (chk.entry_id) {
            for (const it of memoryStore.items) {
              if (it.entry_id === chk.entry_id && it.account_id !== chk.person_id && it.account_id !== notesPayableId) {
                affectedAccounts.add(it.account_id);
                it.account_id = notesPayableId;
              }
            }
          }
        }
      }

      // B) Person 105 audit
      if (p105Id) {
        for (const it of memoryStore.items) {
          if (it.account_id === p105Id) {
            const entry = memoryStore.entries.find(e => e.id === it.entry_id);
            const text = (it.note || '') + ' ' + (entry?.description || '');
            const isCheque = entry?.source_type === 'cheque' || Boolean(entry?.related_cheque_id) || text.includes('چک');
            if (isCheque) {
              let isLegitParty = false;
              if (entry?.related_cheque_id) {
                const chk = memoryStore.cheques.find(c => c.id === entry.related_cheque_id);
                if (chk?.person_id === p105Id) isLegitParty = true;
              }
              const chkByEntry = memoryStore.cheques.find(c => c.entry_id === it.entry_id);
              if (chkByEntry?.person_id === p105Id && Number(it.credit) > 0) isLegitParty = true;

              if (!isLegitParty) {
                affectedAccounts.add(p105Id);
                it.account_id = notesReceivableId;
              }
            }
          }
        }
      }

      // C) Purchase inventory audit
      for (const item of memoryStore.items) {
        if (personsMap.has(item.account_id)) {
          const note = item.note || '';
          if (note.includes('خرید کالا') || note.includes('افزایش موجودی کالا')) {
            affectedAccounts.add(item.account_id);
            item.account_id = purchaseInventoryId;
          }
        }
      }

      affectedAccounts.add(purchaseInventoryId);
      affectedAccounts.add(notesReceivableId);
      affectedAccounts.add(notesPayableId);

      for (const accId of affectedAccounts) {
        await recalculateAccountBalance(accId);
      }
      saveFallbackToStorage();
    }
  } catch (err) {
    console.warn('Healing routine warning:', err);
  }
}

export async function getAllAccounts(): Promise<Account[]> {
  await healCorruptedAccountAssignments();
  const db = await getDb();
  if (!db || isWebFallback) {
    return memoryStore.accounts.map((a) => {
      const initBal = a.initial_balance !== undefined && a.initial_balance !== null ? Number(a.initial_balance) : Number(a.balance);
      let periodDebit = 0;
      let periodCredit = 0;
      for (const item of memoryStore.items) {
        if (item.account_id === a.id) {
          const entry = memoryStore.entries.find((e) => e.id === item.entry_id);
          if (entry && entry.status !== 'draft' && entry.source_type !== 'opening' && !entry.description?.includes('سند افتتاحیه')) {
            periodDebit += Number(item.debit) || 0;
            periodCredit += Number(item.credit) || 0;
          }
        }
      }
      let currentBal = initBal;
      if (a.type === 'asset' || a.type === 'person') {
        currentBal = initBal + (periodDebit - periodCredit);
      } else if (a.type === 'liability') {
        currentBal = initBal + (periodCredit - periodDebit);
      } else if (a.type === 'expense') {
        currentBal = periodDebit - periodCredit;
      } else if (a.type === 'revenue') {
        currentBal = periodCredit - periodDebit;
      }
      return {
        ...a,
        balance: currentBal,
        initial_balance: initBal,
      };
    });
  }

  const rows: any[] = await db.select(`
    SELECT a.*,
           COALESCE(SUM(CASE WHEN je.status != 'draft' AND je.source_type != 'opening' AND je.description NOT LIKE '%سند افتتاحیه%' THEN ji.debit ELSE 0 END), 0) as period_debit,
           COALESCE(SUM(CASE WHEN je.status != 'draft' AND je.source_type != 'opening' AND je.description NOT LIKE '%سند افتتاحیه%' THEN ji.credit ELSE 0 END), 0) as period_credit
    FROM accounts a
    LEFT JOIN journal_items ji ON ji.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = ji.entry_id
    WHERE a.is_active = 1
    GROUP BY a.id
    ORDER BY CAST(a.code AS INTEGER) ASC, a.code ASC
  `);

  return rows.map((r) => {
    const initBal = r.initial_balance !== undefined && r.initial_balance !== null ? Number(r.initial_balance) : Number(r.balance);
    const pDebit = Number(r.period_debit) || 0;
    const pCredit = Number(r.period_credit) || 0;

    let currentBal = initBal;
    if (r.type === 'asset' || r.type === 'person') {
      currentBal = initBal + (pDebit - pCredit);
    } else if (r.type === 'liability') {
      currentBal = initBal + (pCredit - pDebit);
    } else if (r.type === 'expense') {
      currentBal = pDebit - pCredit;
    } else if (r.type === 'revenue') {
      currentBal = pCredit - pDebit;
    }

    return {
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
      bank_name: r.bank_name,
      account_number: r.account_number,
      card_number: r.card_number,
      color: r.color,
      icon: r.icon,
      balance: currentBal,
      initial_balance: initBal,
      parent_id: r.parent_id,
      is_active: r.is_active,
      created_at: r.created_at,
    };
  });
}

export const getAccounts = getAllAccounts;

export async function getAssetAccounts(): Promise<Account[]> {
  const db = await getDb();
  if (!db || isWebFallback) return memoryStore.accounts.filter(a => a.type === 'asset');
  return await db.select("SELECT * FROM accounts WHERE type = 'asset' AND is_active = 1 ORDER BY code ASC");
}

export async function getCategories(): Promise<Category[]> {
  const db = await getDb();
  if (!db || isWebFallback) return memoryStore.categories;
  return await db.select('SELECT * FROM categories ORDER BY name ASC');
}


export async function updateAccount(
  id: string,
  data: Partial<Pick<Account, 'name' | 'code' | 'bank_name' | 'account_number' | 'card_number' | 'color' | 'balance' | 'initial_balance' | 'type' | 'parent_id'>>
): Promise<void> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.code !== undefined) { fields.push(`code = $${idx++}`); values.push(data.code); }
    if (data.bank_name !== undefined) { fields.push(`bank_name = $${idx++}`); values.push(data.bank_name); }
    if (data.account_number !== undefined) { fields.push(`account_number = $${idx++}`); values.push(data.account_number); }
    if (data.card_number !== undefined) { fields.push(`card_number = $${idx++}`); values.push(data.card_number); }
    if (data.color !== undefined) { fields.push(`color = $${idx++}`); values.push(data.color); }
    if (data.balance !== undefined) { fields.push(`balance = $${idx++}`); values.push(data.balance); }
    if (data.initial_balance !== undefined) { fields.push(`initial_balance = $${idx++}`); values.push(data.initial_balance); }
    if (data.type !== undefined) { fields.push(`type = $${idx++}`); values.push(data.type); }
    if (data.parent_id !== undefined) { fields.push(`parent_id = $${idx++}`); values.push(data.parent_id); }

    if (fields.length > 0) {
      values.push(id);
      await db.execute(`UPDATE accounts SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    }

    if (data.initial_balance !== undefined) {
      const initBal = Number(data.initial_balance) || 0;
      let debit = 0;
      let credit = 0;
      
      const accRows: Account[] = await db.select('SELECT type FROM accounts WHERE id = $1', [id]);
      const accType = accRows[0]?.type || 'person';

      if (accType === 'asset') {
        if (initBal >= 0) debit = initBal;
        else credit = Math.abs(initBal);
      } else {
        if (initBal < 0) credit = Math.abs(initBal);
        else debit = initBal;
      }

      const initItems: any[] = await db.select(
        `SELECT ji.id, ji.entry_id FROM journal_items ji
         JOIN journal_entries je ON je.id = ji.entry_id
         WHERE ji.account_id = $1 AND (je.source_type = 'opening' OR je.description LIKE '%سند افتتاحیه%') LIMIT 1`,
        [id]
      );

      if (initItems.length > 0) {
        await db.execute('UPDATE journal_items SET debit = $1, credit = $2 WHERE id = $3', [
          debit,
          credit,
          initItems[0].id,
        ]);
      } else if (initBal !== 0) {
        const entryId = 'je_init_' + Date.now();
        const now = new Date().toISOString();
        const shamsi = getCurrentShamsi().formatted;
        const nextNum = await getNextEntryNumber();

        await db.execute(
          `INSERT INTO journal_entries (id, entry_number, entry_date, entry_date_shamsi, description, source_type, status, created_at)
           VALUES ($1, $2, $3, $4, 'سند افتتاحیه - مانده اولیه', 'opening', 'final', $5)`,
          [entryId, nextNum, now, shamsi, now]
        );

        await db.execute(
          `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note)
           VALUES ($1, $2, $3, $4, $5, 'مانده اولیه')`,
          ['ji_init_' + Date.now(), entryId, id, debit, credit]
        );
      }

      await recalculateAccountBalance(id);
    }
  } else {
    const acc = memoryStore.accounts.find((a) => a.id === id);
    if (acc) {
      Object.assign(acc, data);
      if (data.initial_balance !== undefined) {
        acc.initial_balance = Number(data.initial_balance) || 0;
        await recalculateAccountBalance(id);
      }
      saveFallbackToStorage();
    }
  }
}

export async function hasAccountTransactions(id: string): Promise<boolean> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const res: { count: number }[] = await db.select(
      `SELECT COUNT(*) as count FROM journal_items ji
       JOIN journal_entries je ON je.id = ji.entry_id
       WHERE ji.account_id = $1 AND je.source_type != 'manual'`,
      [id]
    );
    return (res[0]?.count || 0) > 0;
  } else {
    return memoryStore.items.some(it => {
      if (it.account_id !== id) return false;
      const entry = memoryStore.entries.find(e => e.id === it.entry_id);
      return entry && entry.source_type !== 'manual';
    });
  }
}

export async function deleteAccount(id: string): Promise<void> {
  const hasTx = await hasAccountTransactions(id);
  if (hasTx) {
    throw new Error('این حساب دارای گردش و تراکنش مالی است و امکان حذف آن وجود ندارد.');
  }

  const db = await getDb();
  if (db && !isWebFallback) {
    await db.execute(`UPDATE accounts SET is_active = 0 WHERE id = $1`, [id]);
  } else {
    memoryStore.accounts = memoryStore.accounts.filter(a => a.id !== id);
    saveFallbackToStorage();
  }
}

// تابع گردش حساب عمومی با قرارگیری قطعی مانده افتتاحیه در سطر ۰ با تاریخ '-' و مرتب‌سازی صعودی سایر تراکنش‌ها
export async function getAccountLedger(accountId: string): Promise<{
  account: Account | null;
  items: (JournalItem & { entry: JournalEntry; running_balance: number })[];
  totalDebit: number;
  totalCredit: number;
}> {
  await healCorruptedAccountAssignments();
  const db = await getDb();
  let account: Account | null = null;
  let rawRows: any[] = [];

  if (db && !isWebFallback) {
    const accRes: Account[] = await db.select('SELECT * FROM accounts WHERE id = $1', [accountId]);
    account = accRes[0] || null;

    rawRows = await db.select(
      `SELECT 
        ji.id, ji.entry_id, ji.account_id, ji.debit, ji.credit, ji.note, ji.is_system_generated as item_system, ji.source_type as item_source,
        je.entry_number, je.entry_date, je.entry_date_shamsi, je.description, je.source_type, je.is_system_generated, je.related_cheque_id, je.status, je.created_at
       FROM journal_items ji
       JOIN journal_entries je ON je.id = ji.entry_id
       WHERE ji.account_id = $1 AND je.status != 'draft'`,
      [accountId]
    );
  } else {
    account = memoryStore.accounts.find((a) => a.id === accountId) || null;
    const filteredItems = memoryStore.items.filter((i) => i.account_id === accountId);
    
    rawRows = filteredItems.map((item) => {
      const entry = memoryStore.entries.find((e) => e.id === item.entry_id);
      return {
        id: item.id,
        entry_id: item.entry_id,
        account_id: item.account_id,
        debit: item.debit,
        credit: item.credit,
        note: item.note,
        item_system: item.is_system_generated,
        item_source: item.source_type,
        entry_number: entry?.entry_number || 1,
        entry_date: entry?.entry_date || '',
        entry_date_shamsi: entry?.entry_date_shamsi || '',
        description: entry?.description || '',
        source_type: entry?.source_type || '',
        status: entry?.status || 'final',
        is_system_generated: entry?.is_system_generated || false,
        related_cheque_id: entry?.related_cheque_id,
        created_at: entry?.created_at || '',
      };
    }).filter((r) => r.status !== 'draft');
  }

  // تفکیک سطر سند افتتاحیه از سایر تراکنش‌ها
  const openingRow = rawRows.find(
    (r: any) => r.source_type === 'opening' || r.description?.includes('سند افتتاحیه') || r.note?.includes('سند افتتاحیه') || r.note?.includes('مانده اولیه')
  );
  const otherRows = rawRows.filter((r: any) => r !== openingRow);

  // مرتب‌سازی صعودی تراکنش‌های بعدی صرفاً بر اساس تاریخ واقعی آنها (از قدیم به جدید)
  otherRows.sort((a: any, b: any) => {
    const dDiff = (a.entry_date || '').localeCompare(b.entry_date || '');
    if (dDiff !== 0) return dDiff;
    const sDiff = (a.entry_date_shamsi || '').localeCompare(b.entry_date_shamsi || '');
    if (sDiff !== 0) return sDiff;
    return (a.entry_number || 0) - (b.entry_number || 0);
  });

  let initialDebit = 0;
  let initialCredit = 0;
  let initBal = 0;
  let hasOpening = false;

  if (openingRow) {
    hasOpening = true;
    initialDebit = Number(openingRow.debit) || 0;
    initialCredit = Number(openingRow.credit) || 0;
    initBal = (account?.type === 'liability')
      ? (initialCredit - initialDebit)
      : (initialDebit - initialCredit);
  } else if (account?.initial_balance && Number(account.initial_balance) !== 0) {
    hasOpening = true;
    initBal = Number(account.initial_balance);
    const isCredit = initBal < 0;
    const val = Math.abs(initBal);
    if (account?.type === 'asset') {
      initialDebit = initBal >= 0 ? initBal : 0;
      initialCredit = initBal < 0 ? val : 0;
    } else {
      initialDebit = isCredit ? 0 : val;
      initialCredit = isCredit ? val : 0;
    }
  }

  let running = cleanNum(initBal);
  const itemsWithEntry: (JournalItem & { entry: JournalEntry; running_balance: number })[] = [];

  // ۱. ردیف مانده اولیه همیشه در صدر جدول و به عنوان سطر شماره ۰ با تاریخ مقدم و علامت '-'
  if (hasOpening) {
    itemsWithEntry.push({
      id: openingRow ? openingRow.id : ('virtual_init_' + accountId),
      entry_id: openingRow ? openingRow.entry_id : 'virtual_ent_init',
      account_id: accountId,
      debit: initialDebit,
      credit: initialCredit,
      note: openingRow?.note || 'مانده اولیه حساب (سند افتتاحیه)',
      is_system_generated: true,
      source_type: 'opening',
      running_balance: running,
      entry: {
        id: openingRow ? openingRow.entry_id : 'virtual_ent_init',
        entry_number: 0,
        entry_date: '0000-00-00', // مقدم بر تمامی تاریخ‌ها
        entry_date_shamsi: '-',
        description: openingRow?.description || 'مانده اولیه حساب (سند افتتاحیه)',
        source_type: 'opening',
        is_system_generated: true,
        status: 'final',
        created_at: '0000-00-00',
      },
    });
  }

  // ۲. افزودن تراکنش‌های بعدی به ترتیب تاریخ واقعی با اعمال در مانده تجمعی
  for (const r of otherRows) {
    const debit = Number(r.debit) || 0;
    const credit = Number(r.credit) || 0;

    if (account?.type === 'liability') {
      running = cleanNum(running + (credit - debit));
    } else {
      running = cleanNum(running + (debit - credit));
    }

    itemsWithEntry.push({
      id: r.id,
      entry_id: r.entry_id,
      account_id: r.account_id,
      debit,
      credit,
      note: r.note,
      is_system_generated: Boolean(r.item_system || r.is_system_generated),
      source_type: r.item_source || r.source_type,
      running_balance: running,
      entry: {
        id: r.entry_id,
        entry_number: r.entry_number,
        entry_date: r.entry_date,
        entry_date_shamsi: r.entry_date_shamsi,
        description: r.description,
        source_type: r.source_type,
        is_system_generated: Boolean(r.is_system_generated),
        related_cheque_id: r.related_cheque_id,
        status: r.status,
        created_at: r.created_at,
      },
    });
  }

  const totalDebit = itemsWithEntry.reduce((s, i) => s + (i.debit || 0), 0);
  const totalCredit = itemsWithEntry.reduce((s, i) => s + (i.credit || 0), 0);

  return { account, items: itemsWithEntry, totalDebit, totalCredit };
}

// تابع گردش تفصیلی حساب شخص: اقلام فاکتورها و تراکنش‌ها از قدیمی به جدید با ثبت قطعی افتتاحیه در سطر ۰
export async function getAccountDetailedLedger(accountId: string): Promise<{
  account: Account | null;
  items: {
    id: string;
    entry_id: string;
    entry_number: number;
    date_shamsi: string;
    description: string;
    unit?: string;
    quantity?: number;
    unit_price?: number;
    debit: number;
    credit: number;
    running_balance: number;
    is_invoice?: boolean;
    is_system?: boolean;
  }[];
  totalDebit: number;
  totalCredit: number;
}> {
  await healCorruptedAccountAssignments();
  const db = await getDb();
  let account: Account | null = null;
  const detailedRows: any[] = [];

  if (db && !isWebFallback) {
    const accRes: Account[] = await db.select('SELECT * FROM accounts WHERE id = $1', [accountId]);
    account = accRes[0] || null;
  } else {
    account = memoryStore.accounts.find(a => a.id === accountId) || null;
  }

  const allInvoices = await getAllInvoices({ personId: accountId });
  const invoiceByEntryId = new Map<string, Invoice>();
  for (const inv of allInvoices) {
    if (inv.entry_id) invoiceByEntryId.set(inv.entry_id, inv);
  }

  let rawRows: any[] = [];
  if (db && !isWebFallback) {
    rawRows = await db.select(
      `SELECT 
        ji.id, ji.entry_id, ji.account_id, ji.debit, ji.credit, ji.note,
        je.entry_number, je.entry_date, je.entry_date_shamsi, je.description, je.source_type, je.is_system_generated
       FROM journal_items ji
       JOIN journal_entries je ON je.id = ji.entry_id
       WHERE ji.account_id = $1 AND je.status != 'draft'`,
      [accountId]
    );
  } else {
    rawRows = memoryStore.items
      .filter(i => i.account_id === accountId)
      .map(i => {
        const je = memoryStore.entries.find(e => e.id === i.entry_id);
        return {
          ...i,
          entry_number: je?.entry_number || 1,
          entry_date: je?.entry_date || '',
          entry_date_shamsi: je?.entry_date_shamsi || '',
          description: je?.description || '',
          source_type: je?.source_type || '',
          status: je?.status || 'final',
          is_system_generated: je?.is_system_generated || false,
        };
      })
      .filter(r => r.status !== 'draft');
  }

  // تفکیک سطر سند افتتاحیه از سایر تراکنش‌ها
  const openingRow = rawRows.find(
    (r: any) => r.source_type === 'opening' || r.description?.includes('سند افتتاحیه') || r.note?.includes('سند افتتاحیه') || r.note?.includes('مانده اولیه')
  );
  const otherRows = rawRows.filter((r: any) => r !== openingRow);

  // مرتب‌سازی صعودی تراکنش‌های بعدی بر اساس تاریخ واقعی
  otherRows.sort((a: any, b: any) => {
    const dDiff = (a.entry_date || '').localeCompare(b.entry_date || '');
    if (dDiff !== 0) return dDiff;
    const sDiff = (a.entry_date_shamsi || '').localeCompare(b.entry_date_shamsi || '');
    if (sDiff !== 0) return sDiff;
    return (a.entry_number || 0) - (b.entry_number || 0);
  });

  let initialDebit = 0;
  let initialCredit = 0;
  let initBal = 0;
  let hasOpening = false;

  if (openingRow) {
    hasOpening = true;
    initialDebit = Number(openingRow.debit) || 0;
    initialCredit = Number(openingRow.credit) || 0;
    initBal = (account?.type === 'liability')
      ? (initialCredit - initialDebit)
      : (initialDebit - initialCredit);
  } else if (account?.initial_balance && Number(account.initial_balance) !== 0) {
    hasOpening = true;
    initBal = Number(account.initial_balance);
    const isCredit = initBal < 0;
    const val = Math.abs(initBal);
    if (account?.type === 'asset') {
      initialDebit = initBal >= 0 ? initBal : 0;
      initialCredit = initBal < 0 ? val : 0;
    } else {
      initialDebit = isCredit ? 0 : val;
      initialCredit = isCredit ? val : 0;
    }
  }

  let running = cleanNum(initBal);

  // ۱. اضافه کردن مانده افتتاحیه به ردیف شماره ۰ در بالای لیست با تاریخ '-'
  if (hasOpening) {
    detailedRows.push({
      id: openingRow ? openingRow.id : ('init_row_' + accountId),
      entry_id: openingRow ? openingRow.entry_id : 'virtual_init',
      entry_number: 0,
      date_shamsi: '-',
      description: openingRow?.note || openingRow?.description || 'مانده اولیه حساب (سند افتتاحیه)',
      unit: '-',
      quantity: undefined,
      unit_price: undefined,
      debit: initialDebit,
      credit: initialCredit,
      running_balance: running,
      is_invoice: false,
      is_system: true,
    });
  }

  // ۲. پردازش اقلام فاکتورها و تراکنش‌های بعدی به ترتیب تاریخ واقعی
  for (const r of otherRows) {
    const inv = invoiceByEntryId.get(r.entry_id);
    const debit = Number(r.debit) || 0;
    const credit = Number(r.credit) || 0;

    const isMainInvoiceRow = inv && (
      (inv.type === 'sale' && debit > 0) || 
      (inv.type === 'purchase' && credit > 0)
    );

    if (isMainInvoiceRow && inv.items && inv.items.length > 0) {
      inv.items.forEach((it: any, idx: number) => {
        const itDebit = inv.type === 'sale' ? it.total_price : 0;
        const itCredit = inv.type === 'purchase' ? it.total_price : 0;

        if (account?.type === 'liability') {
          running = cleanNum(running + (itCredit - itDebit));
        } else {
          running = cleanNum(running + (itDebit - itCredit));
        }

        detailedRows.push({
          id: `${r.id}_it_${idx}`,
          entry_id: r.entry_id,
          entry_number: r.entry_number,
          date_shamsi: r.entry_date_shamsi,
          description: `${it.commodity_name} (فاکتور ${inv.type === 'sale' ? 'فروش' : 'خرید'} ${inv.invoice_number})`,
          unit: it.unit || 'عدد',
          quantity: it.quantity,
          unit_price: it.unit_price,
          debit: itDebit,
          credit: itCredit,
          running_balance: running,
          is_invoice: true,
        });
      });

      if (inv.services && inv.services.length > 0) {
        inv.services.forEach((srv: any, sIdx: number) => {
          const sDebit = inv.type === 'sale' ? srv.total_price : 0;
          const sCredit = inv.type === 'purchase' ? srv.total_price : 0;

          if (account?.type === 'liability') {
            running = cleanNum(running + (sCredit - sDebit));
          } else {
            running = cleanNum(running + (sDebit - sCredit));
          }

          detailedRows.push({
            id: `${r.id}_srv_${sIdx}`,
            entry_id: r.entry_id,
            entry_number: r.entry_number,
            date_shamsi: r.entry_date_shamsi,
            description: `${srv.title} (فاکتور شماره ${inv.invoice_number})`,
            unit: 'مورد',
            quantity: srv.quantity,
            unit_price: srv.unit_price,
            debit: sDebit,
            credit: sCredit,
            running_balance: running,
            is_invoice: true,
          });
        });
      }

      if (inv.discount_total && inv.discount_total > 0) {
        const discDebit = inv.type === 'purchase' ? inv.discount_total : 0;
        const discCredit = inv.type === 'sale' ? inv.discount_total : 0;

        if (account?.type === 'liability') {
          running = cleanNum(running + (discCredit - discDebit));
        } else {
          running = cleanNum(running + (discDebit - discCredit));
        }

        detailedRows.push({
          id: `${r.id}_disc`,
          entry_id: r.entry_id,
          entry_number: r.entry_number,
          date_shamsi: r.entry_date_shamsi,
          description: `تخفیف فاکتور شماره ${inv.invoice_number}`,
          unit: '-',
          quantity: undefined,
          unit_price: undefined,
          debit: discDebit,
          credit: discCredit,
          running_balance: running,
          is_invoice: true,
        });
      }
    } else {
      if (account?.type === 'liability') {
        running = cleanNum(running + (credit - debit));
      } else {
        running = cleanNum(running + (debit - credit));
      }

      detailedRows.push({
        id: r.id,
        entry_id: r.entry_id,
        entry_number: r.entry_number,
        date_shamsi: r.entry_date_shamsi,
        description: r.note || r.description || '-',
        unit: '-',
        quantity: undefined,
        unit_price: undefined,
        debit,
        credit,
        running_balance: running,
        is_invoice: false,
        is_system: Boolean(r.is_system_generated),
      });
    }
  }

  const totalDebit = detailedRows.reduce((s, i) => s + (i.debit || 0), 0);
  const totalCredit = detailedRows.reduce((s, i) => s + (i.credit || 0), 0);

  return { account, items: detailedRows, totalDebit, totalCredit };
}
