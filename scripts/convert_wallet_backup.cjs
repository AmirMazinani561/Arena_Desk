const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '..', 'arena_backup', 'wallet_backup_2026-09-23.json');
const rawData = fs.readFileSync(backupPath, 'utf8');
const backup = JSON.parse(rawData);

function convertWalletBackup(data) {
  const convertedAccounts = [];
  const convertedEntries = [];
  const convertedItems = [];

  let nextAssetCode = 1;
  let nextPersonCode = 101;
  let nextExpCode = 1001;
  let nextRevCode = 3001;

  // 1. Separate accounts by category
  const banksAndCash = data.accounts.filter(a => a.type === 'bank' || a.type === 'cash');
  const persons = data.accounts.filter(a => a.type === 'person');
  const expenses = data.accounts.filter(a => a.type === 'expense');
  const revenues = data.accounts.filter(a => a.type === 'income');

  // Check if bank fee account exists in expenses, if not add one
  const hasFeeAccount = expenses.some(e => e.name.includes('کارمزد'));
  let feeAccountId = hasFeeAccount ? expenses.find(e => e.name.includes('کارمزد')).id : 'acc_exp_bank_fee';
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

  // Assign codes & create accounts
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

  // Sort expenses so parents come before children
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

  // 2. Opening Balance Journal Entries
  let entryNumber = 1;
  for (const acc of convertedAccounts) {
    if (acc.initial_balance && acc.initial_balance !== 0) {
      const entryId = 'je_init_' + acc.id;
      const now = new Date().toISOString();
      const initBal = acc.initial_balance;
      let debit = 0;
      let credit = 0;

      if (acc.type === 'asset') {
        if (initBal >= 0) debit = initBal;
        else credit = Math.abs(initBal);
      } else if (acc.type === 'person') {
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
        from_account_id: null,
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

  // 3. Transactions Mapping
  // Sort transactions by date ascending
  const sortedTx = [...data.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

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

    // Main transaction items:
    // Debit toAccountId (e.g. expense or destination bank)
    convertedItems.push({
      id: entryId + '_debit',
      entry_id: entryId,
      account_id: tx.toAccountId,
      debit: tx.amount,
      credit: 0,
      note: desc
    });

    // Credit fromAccountId (e.g. source bank)
    convertedItems.push({
      id: entryId + '_credit',
      entry_id: entryId,
      account_id: tx.fromAccountId,
      debit: 0,
      credit: tx.amount,
      note: desc
    });

    // Fee items
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

  // 4. Recalculate balances for all accounts
  const accMap = new Map(convertedAccounts.map(a => [a.id, a]));
  for (const item of convertedItems) {
    const acc = accMap.get(item.account_id);
    if (!acc) continue;
    // Don't modify by initial manual entry since initial_balance is already the base
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

const result = convertWalletBackup(backup);
console.log('--- Conversion Successful ---');
console.log('Total Accounts:', result.accounts.length);
console.log('Total Journal Entries:', result.entries.length);
console.log('Total Journal Items:', result.items.length);

const outPath = path.join(__dirname, '..', 'arena_backup', 'converted_arena_desk_store.json');
fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
console.log('Saved converted dataset to:', outPath);
