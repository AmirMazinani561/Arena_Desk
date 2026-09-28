import { getDb, isWebFallback, memoryStore, saveFallbackToStorage } from '../core/connection';
import type { EquityPartner, EquityTransaction } from '../types';

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'eq_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
}

// ============================================================================
// PARTNERS
// ============================================================================

export async function getAllEquityPartners(): Promise<EquityPartner[]> {
  const db = await getDb();
  if (db && !isWebFallback) {
    try {
      const rows: any[] = await db.select('SELECT * FROM equity_partners ORDER BY created_at ASC');
      return rows;
    } catch (e) {
      console.error('Error fetching equity partners:', e);
      return [];
    }
  } else {
    return [...(memoryStore.equityPartners || [])];
  }
}

export async function createEquityPartner(data: { id?: string; name: string; color?: string; note?: string }): Promise<EquityPartner> {
  const db = await getDb();
  const id = data.id || generateId();
  const now = new Date().toISOString();
  const partner: EquityPartner = {
    id,
    name: data.name,
    color: data.color || '#4ade80',
    note: data.note || '',
    created_at: now
  };

  if (db && !isWebFallback) {
    await db.execute(
      `INSERT INTO equity_partners (id, name, color, note, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [partner.id, partner.name, partner.color, partner.note, partner.created_at]
    );
  } else {
    if (!memoryStore.equityPartners) memoryStore.equityPartners = [];
    const exists = memoryStore.equityPartners.some(p => p.id === partner.id);
    if (!exists) {
      memoryStore.equityPartners.push(partner);
      saveFallbackToStorage();
    }
  }

  return partner;
}

export async function clearAllEquityData(): Promise<void> {
  const db = await getDb();
  if (db && !isWebFallback) {
    await db.execute('DELETE FROM equity_transactions');
    await db.execute('DELETE FROM equity_partners');
  } else {
    memoryStore.equityTransactions = [];
    memoryStore.equityPartners = [];
    saveFallbackToStorage();
  }
}

export async function healEquityPartnership(): Promise<void> {
  const db = await getDb();
  if (db && !isWebFallback) {
    try {
      const partners: any[] = await db.select('SELECT id, name FROM equity_partners');
      const soltani = partners.find(p => (p.name || '').includes('سلطانی'));
      const mazinani = partners.find(p => (p.name || '').includes('مزینانی'));

      if (soltani) {
        await db.execute(
          `UPDATE equity_transactions SET partner_id = $1 WHERE partner_id = 'e3b03a01-301f-460d-988a-e50c93b39a74'`,
          [soltani.id]
        );
      }
      if (mazinani) {
        await db.execute(
          `UPDATE equity_transactions SET partner_id = $1 WHERE partner_id = '9cecce75-8d1c-47b2-8b37-aacdfa21472e'`,
          [mazinani.id]
        );
      }
    } catch (e) {
      console.error('Error healing equity partnership in SQLite:', e);
    }
  } else {
    const partners = memoryStore.equityPartners || [];
    const soltani = partners.find(p => (p.name || '').includes('سلطانی'));
    const mazinani = partners.find(p => (p.name || '').includes('مزینانی'));

    if (memoryStore.equityTransactions) {
      let changed = false;
      for (const t of memoryStore.equityTransactions) {
        if (t.partner_id === 'e3b03a01-301f-460d-988a-e50c93b39a74' && soltani) {
          t.partner_id = soltani.id;
          changed = true;
        } else if (t.partner_id === '9cecce75-8d1c-47b2-8b37-aacdfa21472e' && mazinani) {
          t.partner_id = mazinani.id;
          changed = true;
        }
      }
      if (changed) saveFallbackToStorage();
    }
  }
}

export async function updateEquityPartner(id: string, data: Partial<EquityPartner>): Promise<EquityPartner> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const existing: any[] = await db.select('SELECT * FROM equity_partners WHERE id = $1', [id]);
    if (existing.length === 0) throw new Error('Partner not found');
    const updated: EquityPartner = {
      ...existing[0],
      ...data
    };
    await db.execute(
      `UPDATE equity_partners SET name = $1, color = $2, note = $3 WHERE id = $4`,
      [updated.name, updated.color || '#4ade80', updated.note || '', id]
    );
    return updated;
  } else {
    const idx = (memoryStore.equityPartners || []).findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Partner not found');
    const updated = { ...memoryStore.equityPartners[idx], ...data };
    memoryStore.equityPartners[idx] = updated;
    saveFallbackToStorage();
    return updated;
  }
}

export async function deleteEquityPartner(id: string): Promise<void> {
  const db = await getDb();
  if (db && !isWebFallback) {
    await db.execute('DELETE FROM equity_transactions WHERE partner_id = $1', [id]);
    await db.execute('DELETE FROM equity_partners WHERE id = $1', [id]);
  } else {
    memoryStore.equityPartners = (memoryStore.equityPartners || []).filter(p => p.id !== id);
    memoryStore.equityTransactions = (memoryStore.equityTransactions || []).filter(t => t.partner_id !== id);
    saveFallbackToStorage();
  }
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

export async function getAllEquityTransactions(): Promise<EquityTransaction[]> {
  const db = await getDb();
  if (db && !isWebFallback) {
    try {
      const rows: any[] = await db.select(`
        SELECT 
          et.*,
          ep.name as partner_name
        FROM equity_transactions et
        LEFT JOIN equity_partners ep ON et.partner_id = ep.id
        ORDER BY et.jdate DESC, et.created_at DESC
      `);
      return rows;
    } catch (e) {
      console.error('Error fetching equity transactions:', e);
      return [];
    }
  } else {
    const pMap = new Map((memoryStore.equityPartners || []).map(p => [p.id, p.name]));
    return [...(memoryStore.equityTransactions || [])]
      .map(t => ({
        ...t,
        partner_name: pMap.get(t.partner_id) || ''
      }))
      .sort((a, b) => (b.jdate || '').localeCompare(a.jdate || '') || (b.created_at || '').localeCompare(a.created_at || ''));
  }
}

export async function createEquityTransaction(data: Omit<EquityTransaction, 'id' | 'created_at'>): Promise<EquityTransaction> {
  const db = await getDb();
  const id = generateId();
  const now = new Date().toISOString();
  const tx: EquityTransaction = {
    ...data,
    id,
    created_at: now
  };

  if (db && !isWebFallback) {
    await db.execute(
      `INSERT INTO equity_transactions (
        id, partner_id, kind, amount_rial, price_rial_per_kg, weight_kg, jdate, description, status, source, source_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        tx.id,
        tx.partner_id,
        tx.kind,
        Number(tx.amount_rial) || 0,
        Number(tx.price_rial_per_kg) || 0,
        Number(tx.weight_kg) || 0,
        tx.jdate || '',
        tx.description || '',
        tx.status || 'confirmed',
        tx.source || null,
        tx.source_id || null,
        tx.created_at
      ]
    );
  } else {
    if (!memoryStore.equityTransactions) memoryStore.equityTransactions = [];
    memoryStore.equityTransactions.unshift(tx);
    saveFallbackToStorage();
  }

  return tx;
}

export async function findEquityTransactionBySource(source: string, sourceId: string): Promise<EquityTransaction | null> {
  const db = await getDb();
  if (db && !isWebFallback) {
    try {
      const rows: any[] = await db.select(
        'SELECT * FROM equity_transactions WHERE source = $1 AND source_id = $2 LIMIT 1',
        [source, sourceId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch {
      return null;
    }
  } else {
    return (memoryStore.equityTransactions || []).find(t => t.source === source && t.source_id === sourceId) || null;
  }
}

export async function findSimilarEquityTransaction(partnerId: string, kind: string, amountRial: number, jdate: string): Promise<EquityTransaction | null> {
  const db = await getDb();
  const cleanDate = jdate.replace(/\D/g, '');
  if (db && !isWebFallback) {
    try {
      const rows: any[] = await db.select(
        `SELECT * FROM equity_transactions 
         WHERE partner_id = $1 AND kind = $2 AND ABS(amount_rial - $3) < 1 AND REPLACE(jdate, '/', '') = $4
         LIMIT 1`,
        [partnerId, kind, amountRial, cleanDate]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch {
      return null;
    }
  } else {
    return (memoryStore.equityTransactions || []).find(t => 
      t.partner_id === partnerId && 
      t.kind === kind && 
      Math.abs(t.amount_rial - amountRial) < 1 && 
      t.jdate.replace(/\D/g, '') === cleanDate
    ) || null;
  }
}

export async function updateEquityTransaction(id: string, data: Partial<EquityTransaction>): Promise<EquityTransaction> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const existing: any[] = await db.select('SELECT * FROM equity_transactions WHERE id = $1', [id]);
    if (existing.length === 0) throw new Error('Transaction not found');
    const updated: EquityTransaction = {
      ...existing[0],
      ...data
    };
    await db.execute(
      `UPDATE equity_transactions SET 
        partner_id = $1, kind = $2, amount_rial = $3, price_rial_per_kg = $4,
        weight_kg = $5, jdate = $6, description = $7, status = $8
       WHERE id = $9`,
      [
        updated.partner_id,
        updated.kind,
        Number(updated.amount_rial) || 0,
        Number(updated.price_rial_per_kg) || 0,
        Number(updated.weight_kg) || 0,
        updated.jdate || '',
        updated.description || '',
        updated.status || 'confirmed',
        id
      ]
    );
    return updated;
  } else {
    const idx = (memoryStore.equityTransactions || []).findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Transaction not found');
    const updated = { ...memoryStore.equityTransactions[idx], ...data };
    memoryStore.equityTransactions[idx] = updated;
    saveFallbackToStorage();
    return updated;
  }
}

export async function deleteEquityTransaction(id: string): Promise<void> {
  const db = await getDb();
  if (db && !isWebFallback) {
    await db.execute('DELETE FROM equity_transactions WHERE id = $1', [id]);
  } else {
    memoryStore.equityTransactions = (memoryStore.equityTransactions || []).filter(t => t.id !== id);
    saveFallbackToStorage();
  }
}

// ============================================================================
// SETTINGS / PRICE
// ============================================================================

export async function getEquityCurrentPrice(): Promise<number> {
  const db = await getDb();
  if (db && !isWebFallback) {
    try {
      const rows: any[] = await db.select("SELECT value FROM equity_settings WHERE key = 'current_price'");
      if (rows.length > 0) {
        return Number(rows[0].value) || 0;
      }
    } catch (e) {
      console.error('Error fetching equity price:', e);
    }
    return 0;
  } else {
    return memoryStore.equityPrice || 0;
  }
}

export async function setEquityCurrentPrice(price: number): Promise<void> {
  const db = await getDb();
  if (db && !isWebFallback) {
    await db.execute(
      `INSERT INTO equity_settings (key, value) VALUES ('current_price', $1)
       ON CONFLICT(key) DO UPDATE SET value = $1`,
      [String(price)]
    );
  } else {
    memoryStore.equityPrice = price;
    saveFallbackToStorage();
  }
}
