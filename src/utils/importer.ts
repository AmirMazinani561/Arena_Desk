import type { Account, JournalEntry, JournalItem } from '../db/types';

export interface WalletRawBackup {
  version?: string;
  accounts: Array<{
    id: string;
    type: 'bank' | 'cash' | 'person' | 'income' | 'expense';
    name: string;
    initialBalance?: number;
    isParent?: boolean;
    parentId?: string | null;
    detailInfo?: string | null;
    icon?: string;
    color?: string;
  }>;
  transactions: Array<{
    id: string;
    type: 'expense' | 'income' | 'transfer';
    amount: number;
    fee?: number;
    fromAccountId: string;
    toAccountId: string;
    date: string;
    shamsiDate?: string;
    description?: string | null;
  }>;
}

export interface ConvertedWalletStore {
  accounts: Account[];
  categories: any[];
  entries: JournalEntry[];
  items: JournalItem[];
}

export function convertWalletBackup(data: WalletRawBackup): ConvertedWalletStore {
  const convertedAccounts: Account[] = [];
  const convertedEntries: JournalEntry[] = [];
  const convertedItems: JournalItem[] = [];

  let nextAssetCode = 1;
  let nextPersonCode = 101;
  let nextExpCode = 1001;
  let nextRevCode = 3001;

  const banksAndCash = data.accounts.filter(a => a.type === 'bank' || a.type === 'cash');
  const persons = data.accounts.filter(a => a.type === 'person');
  const expenses = data.accounts.filter(a => a.type === 'expense');
  const revenues = data.accounts.filter(a => a.type === 'income');

  // بررسی وجود سرفصل کارمزد در هزینه‌ها
  const hasFeeAccount = expenses.some(e => e.name.includes('کارمزد'));
  const feeAccountId = hasFeeAccount ? expenses.find(e => e.name.includes('کارمزد'))!.id : 'acc_exp_bank_fee';
  if (!hasFeeAccount) {
    expenses.push({
      id: 'acc_exp_bank_fee',
      type: 'expense',
      name: 'کارمزد خدمات بانکی',
      initialBalance: 0,
      parentId: null,
      color: '#ef4444',
      icon: 'percent'
    });
  }

  // ۱. حساب‌های بانک و نقد
  for (const a of banksAndCash) {
    convertedAccounts.push({
      id: a.id,
      code: String(nextAssetCode++),
      name: a.name,
      type: 'asset',
      bank_name: a.type === 'bank' ? a.name : 'نقد',
      account_number: a.detailInfo || '',
      card_number: (a.detailInfo && a.detailInfo.length === 16) ? a.detailInfo : '',
      color: a.color || (a.type === 'bank' ? '#0284c7' : '#d97706'),
      icon: a.icon || (a.type === 'bank' ? 'credit-card' : 'wallet'),
      balance: a.initialBalance || 0,
      initial_balance: a.initialBalance || 0,
      parent_id: null,
      is_active: 1,
      created_at: new Date().toISOString()
    });
  }

  // ۲. اشخاص و طرف‌حساب‌ها
  for (const a of persons) {
    convertedAccounts.push({
      id: a.id,
      code: String(nextPersonCode++),
      name: a.name,
      type: 'person',
      bank_name: '',
      account_number: '',
      card_number: '',
      color: a.color || '#7c3aed',
      icon: a.icon || 'users',
      balance: a.initialBalance || 0,
      initial_balance: a.initialBalance || 0,
      parent_id: null,
      is_active: 1,
      created_at: new Date().toISOString()
    });
  }

  // ۳. سرفصل‌های هزینه
  expenses.sort((a, b) => {
    if (!a.parentId && b.parentId) return -1;
    if (a.parentId && !b.parentId) return 1;
    return 0;
  });

  for (const a of expenses) {
    convertedAccounts.push({
      id: a.id,
      code: String(nextExpCode++),
      name: a.name,
      type: 'expense',
      bank_name: '',
      account_number: '',
      card_number: '',
      color: a.color || '#ef4444',
      icon: a.icon || 'tag',
      balance: 0,
      initial_balance: 0,
      parent_id: a.parentId || null,
      is_active: 1,
      created_at: new Date().toISOString()
    });
  }

  // ۴. سرفصل‌های درآمد
  for (const a of revenues) {
    convertedAccounts.push({
      id: a.id,
      code: String(nextRevCode++),
      name: a.name,
      type: 'revenue',
      bank_name: '',
      account_number: '',
      card_number: '',
      color: a.color || '#16a34a',
      icon: a.icon || 'trending-up',
      balance: 0,
      initial_balance: 0,
      parent_id: a.parentId || null,
      is_active: 1,
      created_at: new Date().toISOString()
    });
  }

  // ۵. اسناد افتتاحیه برای مانده اولیه
  let entryNumber = 1;
  for (const acc of convertedAccounts) {
    if (acc.initial_balance && acc.initial_balance !== 0) {
      const entryId = 'je_init_' + acc.id;
      const now = new Date().toISOString();
      const initBal = acc.initial_balance;
      let debit = 0;
      let credit = 0;

      if (acc.type === 'asset' || acc.type === 'person') {
        if (initBal >= 0) debit = initBal;
        else credit = Math.abs(initBal);
      }

      convertedEntries.push({
        id: entryId,
        entry_number: entryNumber++,
        entry_date: '2026-09-01T00:00:00.000Z',
        entry_date_shamsi: '1405/06/10',
        description: 'سند افتتاحیه - مانده اولیه',
        source_type: 'manual',
        from_account_id: undefined,
        to_account_id: acc.id,
        fee: 0,
        status: 'final',
        created_at: now
      });

      convertedItems.push({
        id: 'ji_init_' + acc.id,
        entry_id: entryId,
        account_id: acc.id,
        debit,
        credit,
        note: 'مانده اولیه'
      });
    }
  }

  // ۶. تبدیل تراکنش‌ها به اسناد دوبل
  const sortedTx = [...data.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const tx of sortedTx) {
    const entryId = tx.id;
    const dateIso = tx.date ? new Date(tx.date).toISOString() : new Date().toISOString();
    const shamsi = tx.shamsiDate || '';
    const desc = tx.description || '';
    const fee = tx.fee || 0;

    convertedEntries.push({
      id: entryId,
      entry_number: entryNumber++,
      entry_date: dateIso,
      entry_date_shamsi: shamsi,
      description: desc,
      source_type: tx.type,
      from_account_id: tx.fromAccountId,
      to_account_id: tx.toAccountId,
      fee,
      status: 'final',
      created_at: dateIso
    });

    convertedItems.push({
      id: entryId + '_debit',
      entry_id: entryId,
      account_id: tx.toAccountId,
      debit: tx.amount,
      credit: 0,
      note: desc
    });

    convertedItems.push({
      id: entryId + '_credit',
      entry_id: entryId,
      account_id: tx.fromAccountId,
      debit: 0,
      credit: tx.amount,
      note: desc
    });

    if (fee > 0) {
      convertedItems.push({
        id: entryId + '_fee_debit',
        entry_id: entryId,
        account_id: feeAccountId,
        debit: fee,
        credit: 0,
        note: 'کارمزد بانکی'
      });

      convertedItems.push({
        id: entryId + '_fee_credit',
        entry_id: entryId,
        account_id: tx.fromAccountId,
        debit: 0,
        credit: fee,
        note: 'کارمزد بانکی'
      });
    }
  }

  // ۷. محاسبه مانده پایانی حساب‌ها
  const accMap = new Map(convertedAccounts.map(a => [a.id, a]));
  for (const item of convertedItems) {
    const acc = accMap.get(item.account_id);
    if (!acc) continue;
    const entry = convertedEntries.find(e => e.id === item.entry_id);
    if (entry && entry.source_type === 'manual') continue;

    if (acc.type === 'asset' || acc.type === 'person') {
      acc.balance += (item.debit - item.credit);
    } else if (acc.type === 'liability') {
      acc.balance += (item.credit - item.debit);
    } else if (acc.type === 'expense') {
      acc.balance += (item.debit - item.credit);
    } else if (acc.type === 'revenue') {
      acc.balance += (item.credit - item.debit);
    }
  }

  return {
    accounts: convertedAccounts,
    categories: [],
    entries: convertedEntries,
    items: convertedItems
  };
}
