const fs = require('fs');
const path = require('path');

const seed = require('../src/db/walletSeed.json');

let sql = `-- Arena Desk SQLite Seed from Wallet Backup\n`;
sql += `DELETE FROM journal_items;\n`;
sql += `DELETE FROM journal_entries;\n`;
sql += `DELETE FROM accounts;\n\n`;

for (const a of seed.accounts) {
  const pId = a.parent_id ? `'${a.parent_id}'` : 'NULL';
  const name = a.name.replace(/'/g, "''");
  const bankName = (a.bank_name || '').replace(/'/g, "''");
  sql += `INSERT INTO accounts (id, code, name, type, bank_name, account_number, card_number, color, icon, balance, initial_balance, parent_id, is_active, created_at) VALUES ('${a.id}', '${a.code}', '${name}', '${a.type}', '${bankName}', '${a.account_number || ''}', '${a.card_number || ''}', '${a.color || ''}', '${a.icon || ''}', ${a.balance || 0}, ${a.initial_balance || 0}, ${pId}, 1, '${a.created_at}');\n`;
}

sql += `\n`;

for (const e of seed.entries) {
  const desc = (e.description || '').replace(/'/g, "''");
  const fromAcc = e.from_account_id ? `'${e.from_account_id}'` : 'NULL';
  const toAcc = e.to_account_id ? `'${e.to_account_id}'` : 'NULL';
  sql += `INSERT INTO journal_entries (id, entry_number, entry_date, entry_date_shamsi, description, source_type, from_account_id, to_account_id, fee, status, created_at) VALUES ('${e.id}', ${e.entry_number}, '${e.entry_date}', '${e.entry_date_shamsi}', '${desc}', '${e.source_type}', ${fromAcc}, ${toAcc}, ${e.fee || 0}, 'final', '${e.created_at}');\n`;
}

sql += `\n`;

for (const it of seed.items) {
  const note = (it.note || '').replace(/'/g, "''");
  sql += `INSERT INTO journal_items (id, entry_id, account_id, debit, credit, note) VALUES ('${it.id}', '${it.entry_id}', '${it.account_id}', ${it.debit || 0}, ${it.credit || 0}, '${note}');\n`;
}

const outPath = path.join(__dirname, '..', 'arena_backup', 'arena_desk_migrated.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log('Successfully generated SQL migration script at:', outPath);
