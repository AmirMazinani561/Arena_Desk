import type { Account, Cheque, ChequeType, Checkbook, Invoice, JournalEntry, JournalItem } from '../types';
import { getDb, isWebFallback, memoryStore, saveFallbackToStorage } from '../core/connection';
import { recalculateAccountBalance, getAllAccounts } from './accounts';
import { deleteTransaction, getNextEntryNumber } from './transactions';
import { getCurrentShamsi, shamsiToGregorian } from '../../utils/dateUtils';

export async function ensureCheckAccounts(): Promise<{ notesReceivableId: string; notesPayableId: string }> {
  const db = await getDb();
  let recId = '';
  let payId = '';

  if (db && !isWebFallback) {
    const recs: Account[] = await db.select(
      "SELECT * FROM accounts WHERE id = 'acc_notes_receivable_default' OR (type = 'asset' AND name LIKE '%اسناد دریافتنی%') LIMIT 1"
    );
    if (recs.length > 0) {
      recId = recs[0].id;
    } else {
      recId = 'acc_notes_receivable_default';
      await db.execute(
        `INSERT INTO accounts (id, code, name, type, color, icon, balance, initial_balance, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [recId, '91', 'اسناد دریافتنی (نزد صندوق)', 'asset', '#0284c7', 'file-text', 0, 0, 1, new Date().toISOString()]
      );
    }

    const pays: Account[] = await db.select(
      "SELECT * FROM accounts WHERE id = 'acc_notes_payable_default' OR (type = 'liability' AND name LIKE '%اسناد پرداختنی%') LIMIT 1"
    );
    if (pays.length > 0) {
      payId = pays[0].id;
    } else {
      payId = 'acc_notes_payable_default';
      await db.execute(
        `INSERT INTO accounts (id, code, name, type, color, icon, balance, initial_balance, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [payId, '291', 'اسناد پرداختنی (چک‌های صادرشده)', 'liability', '#7c3aed', 'file-text', 0, 0, 1, new Date().toISOString()]
      );
    }
  } else {
    let rec = memoryStore.accounts.find((a) => a.id === 'acc_notes_receivable_default' || (a.type === 'asset' && a.name.includes('اسناد دریافتنی')));
    if (!rec) {
      rec = {
        id: 'acc_notes_receivable_default',
        code: '91',
        name: 'اسناد دریافتنی (نزد صندوق)',
        type: 'asset',
        color: '#0284c7',
        icon: 'file-text',
        balance: 0,
        initial_balance: 0,
        is_active: 1,
        created_at: new Date().toISOString(),
      };
      memoryStore.accounts.push(rec);
      saveFallbackToStorage();
    }
    recId = rec.id;

    let pay = memoryStore.accounts.find((a) => a.id === 'acc_notes_payable_default' || (a.type === 'liability' && a.name.includes('اسناد پرداختنی')));
    if (!pay) {
      pay = {
        id: 'acc_notes_payable_default',
        code: '291',
        name: 'اسناد پرداختنی (چک‌های صادرشده)',
        type: 'liability',
        color: '#7c3aed',
        icon: 'file-text',
        balance: 0,
        initial_balance: 0,
        is_active: 1,
        created_at: new Date().toISOString(),
      };
      memoryStore.accounts.push(pay);
      saveFallbackToStorage();
    }
    payId = pay.id;
  }

  return { notesReceivableId: recId, notesPayableId: payId };
}

export async function getNextChequeRowNumber(type: ChequeType): Promise<number> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const res: { maxRow: number | null }[] = await db.select(
      'SELECT MAX(row_number) as maxRow FROM cheques WHERE type = $1',
      [type]
    );
    const max = res[0]?.maxRow;
    return typeof max === 'number' && max > 0 ? max + 1 : 1;
  } else {
    const list = memoryStore.cheques.filter((c) => c.type === type);
    if (list.length === 0) return 1;
    return Math.max(...list.map((c) => c.row_number || 0)) + 1;
  }
}

export async function getAllCheques(type?: ChequeType): Promise<Cheque[]> {
  const db = await getDb();
  if (db && !isWebFallback) {
    let query = 'SELECT * FROM cheques';
    const params: any[] = [];
    if (type) {
      query += ' WHERE type = $1';
      params.push(type);
    }
    query += ' ORDER BY due_date_shamsi ASC, row_number ASC';
    const rows: Cheque[] = await db.select(query, params);
    return rows;
  } else {
    let list = [...memoryStore.cheques];
    if (type) {
      list = list.filter((c) => c.type === type);
    }
    return list.sort((a, b) => a.due_date_shamsi.localeCompare(b.due_date_shamsi));
  }
}

export async function getAvailableReceivedCheques(): Promise<Cheque[]> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const rows: Cheque[] = await db.select(
      "SELECT * FROM cheques WHERE type = 'received' AND status = 'in_safe' ORDER BY due_date_shamsi ASC, row_number ASC"
    );
    return rows;
  } else {
    return memoryStore.cheques
      .filter((c) => c.type === 'received' && c.status === 'in_safe')
      .sort((a, b) => a.due_date_shamsi.localeCompare(b.due_date_shamsi));
  }
}

export async function getChequeById(id: string): Promise<Cheque | null> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const rows: Cheque[] = await db.select('SELECT * FROM cheques WHERE id = $1 LIMIT 1', [id]);
    return rows[0] || null;
  } else {
    return memoryStore.cheques.find((c) => c.id === id) || null;
  }
}

export async function createCheque(data: Omit<Cheque, 'id' | 'created_at'>): Promise<Cheque> {
  const db = await getDb();

  if (data.type === 'issued') {
    const chkNum = data.check_number?.trim();
    const sayad = data.sayad_id?.trim();
    if (chkNum) {
      if (db && !isWebFallback) {
        let q = "SELECT id FROM cheques WHERE type = 'issued' AND status != 'voided' AND check_number = $1";
        const p: any[] = [chkNum];
        if (data.checkbook_id) {
          q += ' AND checkbook_id = $2';
          p.push(data.checkbook_id);
        } else if (data.bank_name) {
          q += ' AND bank_name = $2';
          p.push(data.bank_name);
        }
        const existing: any[] = await db.select(q, p);
        if (existing.length > 0) {
          throw new Error(`چک صادره با شماره «${chkNum}» قبلاً در سیستم ثبت شده است.`);
        }
        if (sayad) {
          const existingSayad: any[] = await db.select(
            "SELECT id FROM cheques WHERE type = 'issued' AND status != 'voided' AND sayad_id = $1",
            [sayad]
          );
          if (existingSayad.length > 0) {
            throw new Error(`چک صادره با شناسه صیادی «${sayad}» قبلاً در سیستم ثبت شده است.`);
          }
        }
      } else {
        const dup = memoryStore.cheques.find(
          (c) =>
            c.type === 'issued' &&
            c.status !== 'voided' &&
            ((chkNum && c.check_number === chkNum && (data.checkbook_id ? c.checkbook_id === data.checkbook_id : c.bank_name === data.bank_name)) ||
             (sayad && c.sayad_id === sayad))
        );
        if (dup) {
          throw new Error(`چک صادره با شماره «${chkNum || sayad}» قبلاً در سیستم ثبت شده است.`);
        }
      }
    }
  }

  const id = 'chk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();
  const { notesReceivableId, notesPayableId } = await ensureCheckAccounts();

  const nextEntryNumber = await getNextEntryNumber();
  const entryId = 'ent_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const amount = Number(data.amount) || 0;
  const txShamsiDate = data.issue_date_shamsi || data.due_date_shamsi || getCurrentShamsi().formatted;
  const gregorianDate = shamsiToGregorian(txShamsiDate).toISOString();

  let entryDesc = '';
  let debitAccId = '';
  let creditAccId = '';

  if (data.type === 'received') {
    debitAccId = notesReceivableId;
    creditAccId = data.person_id;
    entryDesc = `دریافت چک شماره ${data.check_number || ''} صیاد ${data.sayad_id || '-'} سررسید ${data.due_date_shamsi} از ${data.person_name || 'طرف حساب'}`;
  } else {
    debitAccId = data.person_id;
    creditAccId = notesPayableId;
    entryDesc = `صدور چک شماره ${data.check_number || ''} عهده بانک ${data.bank_name || ''} سررسید ${data.due_date_shamsi} در وجه ${data.person_name || 'طرف حساب'}`;
  }

  const entry: JournalEntry = {
    id: entryId,
    entry_number: nextEntryNumber,
    entry_date: gregorianDate,
    entry_date_shamsi: txShamsiDate,
    description: entryDesc,
    source_type: 'cheque',
    status: 'final',
    created_at: now,
  };

  const item1: JournalItem = {
    id: 'itm_' + Date.now() + '_1',
    entry_id: entryId,
    account_id: debitAccId,
    debit: amount,
    credit: 0,
    note: entryDesc,
  };

  const item2: JournalItem = {
    id: 'itm_' + Date.now() + '_2',
    entry_id: entryId,
    account_id: creditAccId,
    debit: 0,
    credit: amount,
    note: entryDesc,
  };

  const newCheque: Cheque = {
    ...data,
    id,
    entry_id: entryId,
    created_at: now,
  };

  if (db && !isWebFallback) {
    await db.execute(
      `INSERT INTO cheques (
        id, type, check_number, sayad_id, amount, due_date_shamsi, issue_date_shamsi,
        bank_name, branch, account_number, sheba, row_number, location, status,
        status_description, person_id, person_name, checkbook_id, checkbook_leaf_number,
        clearing_bank_id, assigned_to_person_id, entry_id, description, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
      [
        newCheque.id, newCheque.type, newCheque.check_number, newCheque.sayad_id, newCheque.amount,
        newCheque.due_date_shamsi, newCheque.issue_date_shamsi, newCheque.bank_name, newCheque.branch,
        newCheque.account_number, newCheque.sheba, newCheque.row_number, newCheque.location,
        newCheque.status, newCheque.status_description, newCheque.person_id, newCheque.person_name,
        newCheque.checkbook_id, newCheque.checkbook_leaf_number, newCheque.clearing_bank_id,
        newCheque.assigned_to_person_id, newCheque.entry_id, newCheque.description, newCheque.created_at
      ]
    );

    await db.execute(
      `INSERT INTO journal_entries (id, entry_number, entry_date, entry_date_shamsi, description, source_type, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [entry.id, entry.entry_number, entry.entry_date, entry.entry_date_shamsi, entry.description, entry.source_type, entry.status, entry.created_at]
    );
    await db.execute(
      `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note) VALUES ($1, $2, $3, $4, $5, $6)`,
      [item1.id, item1.entry_id, item1.account_id, item1.debit, item1.credit, item1.note]
    );
    await db.execute(
      `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note) VALUES ($1, $2, $3, $4, $5, $6)`,
      [item2.id, item2.entry_id, item2.account_id, item2.debit, item2.credit, item2.note]
    );

    await recalculateAccountBalance(debitAccId);
    await recalculateAccountBalance(creditAccId);
  } else {
    memoryStore.cheques.push(newCheque);
    memoryStore.entries.unshift(entry);
    memoryStore.items.push(item1, item2);
    await recalculateAccountBalance(debitAccId);
    await recalculateAccountBalance(creditAccId);
    saveFallbackToStorage();
  }

  return newCheque;
}

export async function updateCheque(id: string, data: Partial<Cheque>): Promise<void> {
  const db = await getDb();
  const existingCheque = await getChequeById(id);
  const targetEntryId = data.entry_id || existingCheque?.entry_id;

  if (db && !isWebFallback) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (key === 'id' || key === 'created_at') continue;
      fields.push(`${key} = $${idx++}`);
      values.push(value);
    }

    if (fields.length > 0) {
      values.push(id);
      await db.execute(`UPDATE cheques SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    }

    if (targetEntryId && data.issue_date_shamsi) {
      const newGregorianDate = shamsiToGregorian(data.issue_date_shamsi).toISOString();
      await db.execute(
        `UPDATE journal_entries SET entry_date = $1, entry_date_shamsi = $2 WHERE id = $3`,
        [newGregorianDate, data.issue_date_shamsi, targetEntryId]
      );
    }
  } else {
    const chk = memoryStore.cheques.find((c) => c.id === id);
    if (chk) {
      Object.assign(chk, data);
      saveFallbackToStorage();
    }
    if (targetEntryId && data.issue_date_shamsi) {
      const newGregorianDate = shamsiToGregorian(data.issue_date_shamsi).toISOString();
      const entry = memoryStore.entries.find((e) => e.id === targetEntryId);
      if (entry) {
        entry.entry_date = newGregorianDate;
        entry.entry_date_shamsi = data.issue_date_shamsi;
        saveFallbackToStorage();
      }
    }
  }
}

export async function deleteCheque(id: string): Promise<void> {
  const chk = await getChequeById(id);
  if (!chk) return;

  const db = await getDb();
  let linkedInvoice: Invoice | null = null;

  if (chk.entry_id) {
    if (db && !isWebFallback) {
      const invRows: Invoice[] = await db.select('SELECT * FROM invoices WHERE entry_id = $1 LIMIT 1', [chk.entry_id]);
      if (invRows.length > 0) linkedInvoice = invRows[0];
    } else {
      linkedInvoice = memoryStore.invoices.find((i) => i.entry_id === chk.entry_id) || null;
    }
  }

  if (!linkedInvoice) {
    const combinedText = `${chk.description || ''} ${chk.status_description || ''}`;
    const match = combinedText.match(/فاکتور\s+(?:فروش|خرید)\s+شماره\s+(\d+)/);
    if (match) {
      const invNum = Number(match[1]);
      if (db && !isWebFallback) {
        const invRows: Invoice[] = await db.select('SELECT * FROM invoices WHERE invoice_number = $1 LIMIT 1', [invNum]);
        if (invRows.length > 0) linkedInvoice = invRows[0];
      } else {
        linkedInvoice = memoryStore.invoices.find((i) => i.invoice_number === invNum) || null;
      }
    }
  }

  if (!linkedInvoice && chk.entry_id) {
    if (db && !isWebFallback) {
      const entryRows: any[] = await db.select('SELECT id, source_type, description FROM journal_entries WHERE id = $1 LIMIT 1', [chk.entry_id]);
      if (entryRows.length > 0 && entryRows[0].source_type === 'invoice') {
        const match = entryRows[0].description?.match(/شماره\s+(\d+)/);
        const invNum = match ? match[1] : '';
        throw new Error(`این چک مربوط به فاکتور شماره ${invNum} است. برای ویرایش یا حذف پرداخت، باید از طریق ویرایش همان فاکتور اقدام کنید.`);
      }
    } else {
      const entry = memoryStore.entries.find((e) => e.id === chk.entry_id);
      if (entry && entry.source_type === 'invoice') {
        const match = entry.description?.match(/شماره\s+(\d+)/);
        const invNum = match ? match[1] : '';
        throw new Error(`این چک مربوط به فاکتور شماره ${invNum} است. برای ویرایش یا حذف پرداخت، باید از طریق ویرایش همان فاکتور اقدام کنید.`);
      }
    }
  }

  if (linkedInvoice) {
    throw new Error(`این چک مربوط به فاکتور شماره ${linkedInvoice.invoice_number} است. برای ویرایش یا حذف پرداخت، باید از طریق ویرایش همان فاکتور اقدام کنید.`);
  }

  if (chk.entry_id) {
    if (db && !isWebFallback) {
      const entryRows: any[] = await db.select('SELECT source_type FROM journal_entries WHERE id = $1 LIMIT 1', [chk.entry_id]);
      if (entryRows.length > 0 && entryRows[0].source_type !== 'invoice') {
        await deleteTransaction(chk.entry_id);
      }
    } else {
      const entry = memoryStore.entries.find((e) => e.id === chk.entry_id);
      if (entry && entry.source_type !== 'invoice') {
        await deleteTransaction(chk.entry_id);
      }
    }
  }

  if (db && !isWebFallback) {
    await db.execute('DELETE FROM cheques WHERE id = $1', [id]);
  } else {
    memoryStore.cheques = memoryStore.cheques.filter((c) => c.id !== id);
    saveFallbackToStorage();
  }
}

export async function clearReceivedCheque(id: string, bankAccountId: string, clearDateShamsi: string): Promise<void> {
  const chk = await getChequeById(id);
  if (!chk) throw new Error('چک مورد نظر یافت نشد.');

  const { notesReceivableId } = await ensureCheckAccounts();
  const bankAccount = (await getAllAccounts()).find((a) => a.id === bankAccountId);
  const bankName = bankAccount?.name || 'حساب بانکی';

  const nextEntryNumber = await getNextEntryNumber();
  const entryId = 'ent_clear_' + Date.now();
  const now = new Date().toISOString();
  const desc = `وصول چک شماره ${chk.check_number} صیاد ${chk.sayad_id || '-'} به حساب ${bankName}`;

  const entry: JournalEntry = {
    id: entryId,
    entry_number: nextEntryNumber,
    entry_date: shamsiToGregorian(clearDateShamsi).toISOString(),
    entry_date_shamsi: clearDateShamsi,
    description: desc,
    source_type: 'cheque',
    is_system_generated: true,
    related_cheque_id: id,
    status: 'final',
    created_at: now,
  };

  const item1: JournalItem = {
    id: 'itm_' + Date.now() + '_1',
    entry_id: entryId,
    account_id: bankAccountId,
    debit: chk.amount,
    credit: 0,
    note: desc,
  };

  const item2: JournalItem = {
    id: 'itm_' + Date.now() + '_2',
    entry_id: entryId,
    account_id: notesReceivableId,
    debit: 0,
    credit: chk.amount,
    note: desc,
  };

  const db = await getDb();
  if (db && !isWebFallback) {
    await db.execute('UPDATE cheques SET status = $1, clearing_bank_id = $2, location = $3, last_operation_entry_id = $4 WHERE id = $5', [
      'cleared',
      bankAccountId,
      bankName,
      entryId,
      id,
    ]);
    await db.execute(
      `INSERT INTO journal_entries (id, entry_number, entry_date, entry_date_shamsi, description, source_type, is_system_generated, related_cheque_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [entry.id, entry.entry_number, entry.entry_date, entry.entry_date_shamsi, entry.description, entry.source_type, 1, id, entry.status, entry.created_at]
    );
    await db.execute(
      `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note) VALUES ($1, $2, $3, $4, $5, $6)`,
      [item1.id, item1.entry_id, item1.account_id, item1.debit, item1.credit, item1.note]
    );
    await db.execute(
      `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note) VALUES ($1, $2, $3, $4, $5, $6)`,
      [item2.id, item2.entry_id, item2.account_id, item2.debit, item2.credit, item2.note]
    );
    await recalculateAccountBalance(bankAccountId);
    await recalculateAccountBalance(notesReceivableId);
  } else {
    chk.status = 'cleared';
    chk.clearing_bank_id = bankAccountId;
    chk.location = bankName;
    chk.last_operation_entry_id = entryId;
    memoryStore.entries.unshift(entry);
    memoryStore.items.push(item1, item2);
    await recalculateAccountBalance(bankAccountId);
    await recalculateAccountBalance(notesReceivableId);
    saveFallbackToStorage();
  }
}

export async function assignReceivedCheque(id: string, toPersonId: string, assignDateShamsi: string): Promise<void> {
  const chk = await getChequeById(id);
  if (!chk) throw new Error('چک مورد نظر یافت نشد.');

  const { notesReceivableId } = await ensureCheckAccounts();
  const toPerson = (await getAllAccounts()).find((a) => a.id === toPersonId);
  const toPersonName = toPerson?.name || 'شخص تحویل‌گیرنده';

  const nextEntryNumber = await getNextEntryNumber();
  const entryId = 'ent_assign_' + Date.now();
  const now = new Date().toISOString();
  const desc = `واگذاری و خرج چک شماره ${chk.check_number} به ${toPersonName}`;

  const entry: JournalEntry = {
    id: entryId,
    entry_number: nextEntryNumber,
    entry_date: shamsiToGregorian(assignDateShamsi).toISOString(),
    entry_date_shamsi: assignDateShamsi,
    description: desc,
    source_type: 'cheque',
    is_system_generated: true,
    related_cheque_id: id,
    status: 'final',
    created_at: now,
  };

  const item1: JournalItem = {
    id: 'itm_' + Date.now() + '_1',
    entry_id: entryId,
    account_id: toPersonId,
    debit: chk.amount,
    credit: 0,
    note: desc,
  };

  const item2: JournalItem = {
    id: 'itm_' + Date.now() + '_2',
    entry_id: entryId,
    account_id: notesReceivableId,
    debit: 0,
    credit: chk.amount,
    note: desc,
  };

  const db = await getDb();
  if (db && !isWebFallback) {
    await db.execute('UPDATE cheques SET status = $1, assigned_to_person_id = $2, location = $3, last_operation_entry_id = $4 WHERE id = $5', [
      'assigned',
      toPersonId,
      `واگذار شده به ${toPersonName}`,
      entryId,
      id,
    ]);
    await db.execute(
      `INSERT INTO journal_entries (id, entry_number, entry_date, entry_date_shamsi, description, source_type, is_system_generated, related_cheque_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [entry.id, entry.entry_number, entry.entry_date, entry.entry_date_shamsi, entry.description, entry.source_type, 1, id, entry.status, entry.created_at]
    );
    await db.execute(
      `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note) VALUES ($1, $2, $3, $4, $5, $6)`,
      [item1.id, item1.entry_id, item1.account_id, item1.debit, item1.credit, item1.note]
    );
    await db.execute(
      `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note) VALUES ($1, $2, $3, $4, $5, $6)`,
      [item2.id, item2.entry_id, item2.account_id, item2.debit, item2.credit, item2.note]
    );
    await recalculateAccountBalance(toPersonId);
    await recalculateAccountBalance(notesReceivableId);
  } else {
    chk.status = 'assigned';
    chk.assigned_to_person_id = toPersonId;
    chk.location = `واگذار شده به ${toPersonName}`;
    chk.last_operation_entry_id = entryId;
    memoryStore.entries.unshift(entry);
    memoryStore.items.push(item1, item2);
    await recalculateAccountBalance(toPersonId);
    await recalculateAccountBalance(notesReceivableId);
    saveFallbackToStorage();
  }
}

export async function bounceReceivedCheque(id: string, bounceDateShamsi: string, reason?: string): Promise<void> {
  const chk = await getChequeById(id);
  if (!chk) throw new Error('چک مورد نظر یافت نشد.');

  const { notesReceivableId } = await ensureCheckAccounts();
  const nextEntryNumber = await getNextEntryNumber();
  const entryId = 'ent_bounce_' + Date.now();
  const now = new Date().toISOString();
  const desc = `برگشت چک دریافتی شماره ${chk.check_number}: ${reason || 'عدم موجودی'}`;

  const entry: JournalEntry = {
    id: entryId,
    entry_number: nextEntryNumber,
    entry_date: shamsiToGregorian(bounceDateShamsi).toISOString(),
    entry_date_shamsi: bounceDateShamsi,
    description: desc,
    source_type: 'cheque',
    is_system_generated: true,
    related_cheque_id: id,
    status: 'final',
    created_at: now,
  };

  const item1: JournalItem = {
    id: 'itm_' + Date.now() + '_1',
    entry_id: entryId,
    account_id: chk.person_id,
    debit: chk.amount,
    credit: 0,
    note: desc,
  };

  const item2: JournalItem = {
    id: 'itm_' + Date.now() + '_2',
    entry_id: entryId,
    account_id: notesReceivableId,
    debit: 0,
    credit: chk.amount,
    note: desc,
  };

  const db = await getDb();
  if (db && !isWebFallback) {
    await db.execute('UPDATE cheques SET status = $1, status_description = $2, last_operation_entry_id = $3 WHERE id = $4', [
      'bounced',
      reason || 'برگشت خورده',
      entryId,
      id,
    ]);
    await db.execute(
      `INSERT INTO journal_entries (id, entry_number, entry_date, entry_date_shamsi, description, source_type, is_system_generated, related_cheque_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [entry.id, entry.entry_number, entry.entry_date, entry.entry_date_shamsi, entry.description, entry.source_type, 1, id, entry.status, entry.created_at]
    );
    await db.execute(
      `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note) VALUES ($1, $2, $3, $4, $5, $6)`,
      [item1.id, item1.entry_id, item1.account_id, item1.debit, item1.credit, item1.note]
    );
    await db.execute(
      `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note) VALUES ($1, $2, $3, $4, $5, $6)`,
      [item2.id, item2.entry_id, item2.account_id, item2.debit, item2.credit, item2.note]
    );
    await recalculateAccountBalance(chk.person_id);
    await recalculateAccountBalance(notesReceivableId);
  } else {
    chk.status = 'bounced';
    chk.status_description = reason || 'برگشت خورده';
    chk.last_operation_entry_id = entryId;
    memoryStore.entries.unshift(entry);
    memoryStore.items.push(item1, item2);
    await recalculateAccountBalance(chk.person_id);
    await recalculateAccountBalance(notesReceivableId);
    saveFallbackToStorage();
  }
}

export async function returnReceivedCheque(id: string, returnDateShamsi: string, reason?: string): Promise<void> {
  const chk = await getChequeById(id);
  if (!chk) throw new Error('چک مورد نظر یافت نشد.');

  const { notesReceivableId } = await ensureCheckAccounts();
  const nextEntryNumber = await getNextEntryNumber();
  const entryId = 'ent_ret_' + Date.now();
  const now = new Date().toISOString();
  const desc = `عودت و استرداد چک شماره ${chk.check_number} به ${chk.person_name || 'پرداخت‌کننده'}`;

  const entry: JournalEntry = {
    id: entryId,
    entry_number: nextEntryNumber,
    entry_date: shamsiToGregorian(returnDateShamsi).toISOString(),
    entry_date_shamsi: returnDateShamsi,
    description: desc,
    source_type: 'cheque',
    is_system_generated: true,
    related_cheque_id: id,
    status: 'final',
    created_at: now,
  };

  const item1: JournalItem = {
    id: 'itm_' + Date.now() + '_1',
    entry_id: entryId,
    account_id: chk.person_id,
    debit: chk.amount,
    credit: 0,
    note: desc,
  };

  const item2: JournalItem = {
    id: 'itm_' + Date.now() + '_2',
    entry_id: entryId,
    account_id: notesReceivableId,
    debit: 0,
    credit: chk.amount,
    note: desc,
  };

  const db = await getDb();
  if (db && !isWebFallback) {
    await db.execute('UPDATE cheques SET status = $1, status_description = $2, last_operation_entry_id = $3 WHERE id = $4', [
      'returned',
      reason || 'عودت داده شد به مشتری',
      entryId,
      id,
    ]);
    await db.execute(
      `INSERT INTO journal_entries (id, entry_number, entry_date, entry_date_shamsi, description, source_type, is_system_generated, related_cheque_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [entry.id, entry.entry_number, entry.entry_date, entry.entry_date_shamsi, entry.description, entry.source_type, 1, id, entry.status, entry.created_at]
    );
    await db.execute(
      `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note) VALUES ($1, $2, $3, $4, $5, $6)`,
      [item1.id, item1.entry_id, item1.account_id, item1.debit, item1.credit, item1.note]
    );
    await db.execute(
      `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note) VALUES ($1, $2, $3, $4, $5, $6)`,
      [item2.id, item2.entry_id, item2.account_id, item2.debit, item2.credit, item2.note]
    );
    await recalculateAccountBalance(chk.person_id);
    await recalculateAccountBalance(notesReceivableId);
  } else {
    chk.status = 'returned';
    chk.status_description = reason || 'عودت داده شد به مشتری';
    chk.last_operation_entry_id = entryId;
    memoryStore.entries.unshift(entry);
    memoryStore.items.push(item1, item2);
    await recalculateAccountBalance(chk.person_id);
    await recalculateAccountBalance(notesReceivableId);
    saveFallbackToStorage();
  }
}

export async function clearIssuedCheque(id: string, bankAccountId: string, clearDateShamsi: string): Promise<void> {
  const chk = await getChequeById(id);
  if (!chk) throw new Error('چک مورد نظر یافت نشد.');

  const { notesPayableId } = await ensureCheckAccounts();
  const bankAccount = (await getAllAccounts()).find((a: Account) => a.id === bankAccountId);
  const bankName = bankAccount?.name || 'حساب بانکی';

  const nextEntryNumber = await getNextEntryNumber();
  const entryId = 'ent_clear_iss_' + Date.now();
  const now = new Date().toISOString();
  const desc = `پاس شدن چک صادره شماره ${chk.check_number} از حساب ${bankName}`;

  const entry: JournalEntry = {
    id: entryId,
    entry_number: nextEntryNumber,
    entry_date: shamsiToGregorian(clearDateShamsi).toISOString(),
    entry_date_shamsi: clearDateShamsi,
    description: desc,
    source_type: 'cheque',
    is_system_generated: true,
    related_cheque_id: id,
    status: 'final',
    created_at: now,
  };

  const item1: JournalItem = {
    id: 'itm_' + Date.now() + '_1',
    entry_id: entryId,
    account_id: notesPayableId,
    debit: chk.amount,
    credit: 0,
    note: desc,
  };

  const item2: JournalItem = {
    id: 'itm_' + Date.now() + '_2',
    entry_id: entryId,
    account_id: bankAccountId,
    debit: 0,
    credit: chk.amount,
    note: desc,
  };

  const db = await getDb();
  if (db && !isWebFallback) {
    await db.execute('UPDATE cheques SET status = $1, clearing_bank_id = $2, last_operation_entry_id = $3 WHERE id = $4', [
      'cleared',
      bankAccountId,
      entryId,
      id,
    ]);
    await db.execute(
      `INSERT INTO journal_entries (id, entry_number, entry_date, entry_date_shamsi, description, source_type, is_system_generated, related_cheque_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [entry.id, entry.entry_number, entry.entry_date, entry.entry_date_shamsi, entry.description, entry.source_type, 1, id, entry.status, entry.created_at]
    );
    await db.execute(
      `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note) VALUES ($1, $2, $3, $4, $5, $6)`,
      [item1.id, item1.entry_id, item1.account_id, item1.debit, item1.credit, item1.note]
    );
    await db.execute(
      `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note) VALUES ($1, $2, $3, $4, $5, $6)`,
      [item2.id, item2.entry_id, item2.account_id, item2.debit, item2.credit, item2.note]
    );
    await recalculateAccountBalance(bankAccountId);
    await recalculateAccountBalance(notesPayableId);
  } else {
    chk.status = 'cleared';
    chk.clearing_bank_id = bankAccountId;
    chk.last_operation_entry_id = entryId;
    memoryStore.entries.unshift(entry);
    memoryStore.items.push(item1, item2);
    await recalculateAccountBalance(bankAccountId);
    await recalculateAccountBalance(notesPayableId);
    saveFallbackToStorage();
  }
}

export async function revertChequeStatus(id: string): Promise<void> {
  const chk = await getChequeById(id);
  if (!chk) throw new Error('چک مورد نظر یافت نشد.');

  if (chk.type === 'received' && chk.status === 'in_safe') {
    throw new Error('این چک در وضعیت اولیه (نزد صندوق) قرار دارد و عملیاتی برای لغو وجود ندارد.');
  }
  if (chk.type === 'issued' && chk.status === 'issued') {
    throw new Error('این چک در وضعیت اولیه (صادرشده) قرار دارد و عملیاتی برای لغو وجود ندارد.');
  }

  const db = await getDb();
  let opEntryId = chk.last_operation_entry_id;

  if (!opEntryId) {
    if (db && !isWebFallback) {
      const found: any[] = await db.select(
        `SELECT id FROM journal_entries 
         WHERE (related_cheque_id = $1 OR description LIKE $2) 
           AND (source_type = 'cheque' OR description LIKE '%وصول%' OR description LIKE '%پاس%' OR description LIKE '%واگذاری%' OR description LIKE '%برگشت%' OR description LIKE '%عودت%')
         ORDER BY created_at DESC LIMIT 1`,
        [id, `%${chk.check_number}%`]
      );
      if (found.length > 0) {
        opEntryId = found[0].id;
      }
    } else {
      const found = memoryStore.entries.find(
        (e) => (e.related_cheque_id === id || (e.description && e.description.includes(chk.check_number))) &&
               (e.source_type === 'cheque' || (e.description && (e.description.includes('وصول') || e.description.includes('پاس') || e.description.includes('واگذاری') || e.description.includes('برگشت') || e.description.includes('عودت'))))
      );
      if (found) {
        opEntryId = found.id;
      }
    }
  }

  if (opEntryId) {
    await deleteTransaction(opEntryId, true);
  }

  if (chk.type === 'issued') {
    if (db && !isWebFallback) {
      await db.execute(
        `UPDATE cheques SET status = 'issued', clearing_bank_id = NULL, location = 'صادرشده', status_description = 'صادرشده (در جریان)', last_operation_entry_id = NULL WHERE id = $1`,
        [id]
      );
    } else {
      chk.status = 'issued';
      chk.clearing_bank_id = undefined;
      chk.location = 'صادرشده';
      chk.status_description = 'صادرشده (در جریان)';
      chk.last_operation_entry_id = undefined;
      saveFallbackToStorage();
    }
  } else {
    if (db && !isWebFallback) {
      await db.execute(
        `UPDATE cheques SET status = 'in_safe', clearing_bank_id = NULL, assigned_to_person_id = NULL, location = 'نزد صندوق', status_description = 'موجود نزد صندوق', last_operation_entry_id = NULL WHERE id = $1`,
        [id]
      );
    } else {
      chk.status = 'in_safe';
      chk.clearing_bank_id = undefined;
      chk.assigned_to_person_id = undefined;
      chk.location = 'نزد صندوق';
      chk.status_description = 'موجود نزد صندوق';
      chk.last_operation_entry_id = undefined;
      saveFallbackToStorage();
    }
  }
}

export async function getAllCheckbooks(): Promise<Checkbook[]> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const rows: Checkbook[] = await db.select('SELECT * FROM checkbooks ORDER BY receive_date_shamsi DESC, created_at DESC');
    return rows;
  } else {
    return [...memoryStore.checkbooks].sort((a, b) => b.receive_date_shamsi.localeCompare(a.receive_date_shamsi));
  }
}

export async function createCheckbook(data: Omit<Checkbook, 'id' | 'created_at'>): Promise<Checkbook> {
  const db = await getDb();
  const id = 'cbk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();

  const newCheckbook: Checkbook = {
    ...data,
    id,
    created_at: now,
  };

  if (db && !isWebFallback) {
    await db.execute(
      `INSERT INTO checkbooks (id, bank_id, bank_name, serial, receive_date_shamsi, from_number, to_number, leaf_count, description, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        newCheckbook.id,
        newCheckbook.bank_id,
        newCheckbook.bank_name,
        newCheckbook.serial,
        newCheckbook.receive_date_shamsi,
        newCheckbook.from_number,
        newCheckbook.to_number,
        newCheckbook.leaf_count,
        newCheckbook.description || '',
        newCheckbook.is_active,
        newCheckbook.created_at,
      ]
    );
  } else {
    memoryStore.checkbooks.push(newCheckbook);
    saveFallbackToStorage();
  }

  return newCheckbook;
}

export async function updateCheckbook(id: string, data: Partial<Checkbook>): Promise<void> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (key === 'id' || key === 'created_at') continue;
      fields.push(`${key} = $${idx++}`);
      values.push(value);
    }

    if (fields.length > 0) {
      values.push(id);
      await db.execute(`UPDATE checkbooks SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    }
  } else {
    const cb = memoryStore.checkbooks.find((c) => c.id === id);
    if (cb) {
      Object.assign(cb, data);
      saveFallbackToStorage();
    }
  }
}

export async function deleteCheckbook(id: string): Promise<void> {
  const db = await getDb();
  if (db && !isWebFallback) {
    await db.execute('DELETE FROM checkbooks WHERE id = $1', [id]);
  } else {
    memoryStore.checkbooks = memoryStore.checkbooks.filter((c) => c.id !== id);
    saveFallbackToStorage();
  }
}

export async function getCheckbookLeaves(checkbookId: string): Promise<{
  leaf_number: number;
  is_used: boolean;
  cheque?: Cheque;
}[]> {
  const checkbooks = await getAllCheckbooks();
  const cb = checkbooks.find((c) => c.id === checkbookId);
  if (!cb) return [];

  const allCheques = await getAllCheques('issued');
  const issuedForThisBook = allCheques.filter((c) => c.checkbook_id === checkbookId);
  const chequeByNum = new Map<number, Cheque>();
  for (const c of issuedForThisBook) {
    const num = Number(c.check_number);
    if (!isNaN(num)) chequeByNum.set(num, c);
  }

  const result: { leaf_number: number; is_used: boolean; cheque?: Cheque }[] = [];
  for (let num = cb.from_number; num <= cb.to_number; num++) {
    const chk = chequeByNum.get(num);
    result.push({
      leaf_number: num,
      is_used: Boolean(chk),
      cheque: chk,
    });
  }

  return result;
}

export async function getAvailableCheckbookLeaves(bankId?: string): Promise<{
  checkbook_id: string;
  checkbook_name: string;
  bank_id: string;
  bank_name: string;
  leaf_number: number;
  check_number: string;
  serial: string;
}[]> {
  const checkbooks = await getAllCheckbooks();
  const activeCheckbooks = checkbooks.filter((cb) => Boolean(cb.is_active) && (!bankId || cb.bank_id === bankId));
  const allIssuedCheques = await getAllCheques('issued');

  const available: {
    checkbook_id: string;
    checkbook_name: string;
    bank_id: string;
    bank_name: string;
    leaf_number: number;
    check_number: string;
    serial: string;
  }[] = [];

  for (const cb of activeCheckbooks) {
    const usedNumbers = new Set(
      allIssuedCheques
        .filter((c) => c.checkbook_id === cb.id && c.status !== 'voided')
        .map((c) => Number(c.check_number))
    );

    for (let num = cb.from_number; num <= cb.to_number; num++) {
      if (!usedNumbers.has(num)) {
        available.push({
          checkbook_id: cb.id,
          checkbook_name: `دسته‌چک ${cb.bank_name} (سریال: ${cb.serial})`,
          bank_id: cb.bank_id,
          bank_name: cb.bank_name,
          leaf_number: num,
          check_number: String(num),
          serial: cb.serial,
        });
      }
    }
  }

  return available;
}
