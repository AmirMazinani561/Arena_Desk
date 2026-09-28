import type { Warehouse, CommodityGroup, Commodity, CommodityTransaction, WarehouseReportItem } from '../types';
import { getDb, isWebFallback, cleanNum, memoryStore, saveFallbackToStorage } from '../core/connection';
import { getCurrentShamsi, toEnglishDigits } from '../../utils/dateUtils';
import { getInvoiceById } from './invoices';

export async function getAllWarehouses(): Promise<Warehouse[]> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const rows: Warehouse[] = await db.select('SELECT * FROM warehouses ORDER BY code ASC');
    return rows;
  } else {
    return [...memoryStore.warehouses].sort((a, b) => a.code - b.code);
  }
}

export async function getNextWarehouseCode(): Promise<number> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const res: { maxCode: number | null }[] = await db.select('SELECT MAX(code) as maxCode FROM warehouses');
    const max = res[0]?.maxCode;
    return (typeof max === 'number' && max > 0) ? max + 1 : 1;
  } else {
    if (memoryStore.warehouses.length === 0) return 1;
    const max = memoryStore.warehouses.reduce((m, w) => Math.max(m, w.code || 0), 0);
    return max + 1;
  }
}

export async function createWarehouse(
  name: string,
  description?: string,
  address?: string
): Promise<Warehouse> {
  const db = await getDb();
  const nextCode = await getNextWarehouseCode();
  const newWarehouse: Warehouse = {
    id: 'wh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    code: nextCode,
    name: name.trim(),
    description: description?.trim() || '',
    address: address?.trim() || '',
    is_active: 1,
    created_at: new Date().toISOString(),
  };

  if (db && !isWebFallback) {
    await db.execute(
      `INSERT INTO warehouses (id, code, name, description, address, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        newWarehouse.id,
        newWarehouse.code,
        newWarehouse.name,
        newWarehouse.description,
        newWarehouse.address,
        newWarehouse.is_active,
        newWarehouse.created_at,
      ]
    );
  } else {
    memoryStore.warehouses.push(newWarehouse);
    saveFallbackToStorage();
  }

  return newWarehouse;
}

export async function updateWarehouse(
  id: string,
  name: string,
  description?: string,
  address?: string
): Promise<void> {
  const db = await getDb();
  const trimmedName = name.trim();
  const trimmedDesc = description?.trim() || '';
  const trimmedAddr = address?.trim() || '';

  if (db && !isWebFallback) {
    await db.execute(
      `UPDATE warehouses SET name = $1, description = $2, address = $3 WHERE id = $4`,
      [trimmedName, trimmedDesc, trimmedAddr, id]
    );
  } else {
    const wh = memoryStore.warehouses.find((w) => w.id === id);
    if (wh) {
      wh.name = trimmedName;
      wh.description = trimmedDesc;
      wh.address = trimmedAddr;
      saveFallbackToStorage();
    }
  }
}

export async function getWarehouseCommoditiesCount(warehouseId: string): Promise<number> {
  const db = await getDb();
  if (db && !isWebFallback) {
    try {
      const res: { count: number }[] = await db.select(
        'SELECT COUNT(*) as count FROM commodities WHERE warehouse_id = $1',
        [warehouseId]
      );
      return res[0]?.count || 0;
    } catch {
      return 0;
    }
  } else {
    return memoryStore.commodities.filter((c) => c.warehouse_id === warehouseId).length;
  }
}

export async function canDeleteWarehouse(
  warehouseId: string
): Promise<{ canDelete: boolean; count: number; reason?: string }> {
  const count = await getWarehouseCommoditiesCount(warehouseId);
  if (count > 0) {
    return {
      canDelete: false,
      count,
      reason: `این انبار دارای ${count} قلم کالا می‌باشد و امکان حذف آن وجود ندارد. ابتدا کالاها را انتقال یا حذف فرمایید.`,
    };
  }
  return { canDelete: true, count: 0 };
}

export async function deleteWarehouse(id: string): Promise<void> {
  const check = await canDeleteWarehouse(id);
  if (!check.canDelete) {
    throw new Error(check.reason || 'امکان حذف این انبار وجود ندارد.');
  }

  const db = await getDb();
  if (db && !isWebFallback) {
    await db.execute('DELETE FROM warehouses WHERE id = $1', [id]);
  } else {
    memoryStore.warehouses = memoryStore.warehouses.filter((w) => w.id !== id);
    saveFallbackToStorage();
  }
}

export async function getWarehouseCommodities(warehouseId: string): Promise<Commodity[]> {
  const db = await getDb();
  if (db && !isWebFallback) {
    try {
      const rows: Commodity[] = await db.select(
        'SELECT * FROM commodities WHERE warehouse_id = $1 ORDER BY code ASC',
        [warehouseId]
      );
      return rows;
    } catch {
      return [];
    }
  } else {
    return memoryStore.commodities.filter((c) => c.warehouse_id === warehouseId);
  }
}

export async function getWarehouseReport(
  warehouseId: string,
  filter?: { startDate?: string; endDate?: string; commodityId?: string }
): Promise<WarehouseReportItem[]> {
  const commodities = await getWarehouseCommodities(warehouseId);
  const items: WarehouseReportItem[] = [];

  for (const c of commodities) {
    if (filter?.commodityId && c.id !== filter.commodityId) continue;

    items.push({
      id: 'rep_' + c.id,
      date: c.created_at || new Date().toISOString(),
      date_shamsi: getCurrentShamsi().formatted,
      commodity_name: c.name,
      commodity_code: c.code,
      type: 'in',
      quantity: c.current_quantity || c.initial_quantity || 0,
      unit: c.unit || 'عدد',
      reference: 'موجودی انبار',
      description: 'ثبت در انبار',
    });
  }

  return items;
}

export async function getAllCommodityGroups(): Promise<CommodityGroup[]> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const rows: CommodityGroup[] = await db.select('SELECT * FROM commodity_groups ORDER BY name ASC');
    return rows;
  } else {
    return [...memoryStore.commodityGroups].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  }
}

export async function createCommodityGroup(
  name: string,
  color?: string,
  icon?: string,
  parentId?: string | null
): Promise<CommodityGroup> {
  const db = await getDb();
  const newGroup: CommodityGroup = {
    id: 'cgrp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    name: name.trim(),
    color: color || '#0284c7',
    icon: icon || 'tag',
    parent_id: parentId || null,
    created_at: new Date().toISOString(),
  };

  if (db && !isWebFallback) {
    await db.execute(
      `INSERT INTO commodity_groups (id, name, color, icon, parent_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [newGroup.id, newGroup.name, newGroup.color, newGroup.icon, newGroup.parent_id, newGroup.created_at]
    );
  } else {
    memoryStore.commodityGroups.push(newGroup);
    saveFallbackToStorage();
  }

  return newGroup;
}

export async function updateCommodityGroup(
  id: string,
  name: string,
  color?: string,
  icon?: string
): Promise<void> {
  const db = await getDb();
  const trimmedName = name.trim();
  const c = color || '#0284c7';
  const ic = icon || 'tag';

  if (db && !isWebFallback) {
    await db.execute(
      `UPDATE commodity_groups SET name = $1, color = $2, icon = $3 WHERE id = $4`,
      [trimmedName, c, ic, id]
    );
  } else {
    const grp = memoryStore.commodityGroups.find((g) => g.id === id);
    if (grp) {
      grp.name = trimmedName;
      grp.color = c;
      grp.icon = ic;
      saveFallbackToStorage();
    }
  }
}

export async function deleteCommodityGroup(id: string): Promise<void> {
  const db = await getDb();
  if (db && !isWebFallback) {
    await db.execute(`UPDATE commodities SET group_id = NULL WHERE group_id = $1`, [id]);
    await db.execute(`DELETE FROM commodity_groups WHERE id = $1`, [id]);
  } else {
    for (const c of memoryStore.commodities) {
      if (c.group_id === id) c.group_id = null;
    }
    memoryStore.commodityGroups = memoryStore.commodityGroups.filter((g) => g.id !== id);
    saveFallbackToStorage();
  }
}

export async function getNextCommodityCode(): Promise<number> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const res: { maxCode: number | null }[] = await db.select('SELECT MAX(code) as maxCode FROM commodities');
    const max = res[0]?.maxCode;
    return typeof max === 'number' && max > 0 ? max + 1 : 1;
  } else {
    if (memoryStore.commodities.length === 0) return 1;
    const max = memoryStore.commodities.reduce((m, c) => Math.max(m, c.code || 0), 0);
    return max + 1;
  }
}

export async function getAllCommodities(): Promise<Commodity[]> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const rows: Commodity[] = await db.select('SELECT * FROM commodities ORDER BY code ASC');
    return rows;
  } else {
    return [...memoryStore.commodities].sort((a, b) => a.code - b.code);
  }
}

export async function getCommodityById(id: string): Promise<Commodity | null> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const rows: Commodity[] = await db.select('SELECT * FROM commodities WHERE id = $1 LIMIT 1', [id]);
    return rows[0] || null;
  } else {
    return memoryStore.commodities.find((c) => c.id === id) || null;
  }
}

export async function createCommodity(data: {
  name: string;
  barcode?: string;
  unit: string;
  warehouse_id: string;
  group_id?: string | null;
  initial_quantity?: number;
  purchase_price?: number;
  sales_price?: number;
}): Promise<Commodity> {
  const db = await getDb();
  const nextCode = await getNextCommodityCode();
  const initQty = cleanNum(Number(data.initial_quantity) || 0);
  const now = new Date().toISOString();
  const shamsiNow = getCurrentShamsi().formatted;

  const newCommodity: Commodity = {
    id: 'cmd_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    code: nextCode,
    name: data.name.trim(),
    barcode: data.barcode?.trim() || '',
    unit: data.unit.trim() || 'عدد',
    warehouse_id: data.warehouse_id,
    group_id: data.group_id || null,
    initial_quantity: initQty,
    current_quantity: initQty,
    purchase_price: Number(data.purchase_price) || 0,
    sales_price: Number(data.sales_price) || 0,
    is_active: 1,
    created_at: now,
  };

  if (db && !isWebFallback) {
    await db.execute(
      `INSERT INTO commodities (id, code, name, barcode, unit, warehouse_id, group_id, initial_quantity, current_quantity, purchase_price, sales_price, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        newCommodity.id,
        newCommodity.code,
        newCommodity.name,
        newCommodity.barcode,
        newCommodity.unit,
        newCommodity.warehouse_id,
        newCommodity.group_id,
        newCommodity.initial_quantity,
        newCommodity.current_quantity,
        newCommodity.purchase_price,
        newCommodity.sales_price,
        newCommodity.is_active,
        newCommodity.created_at,
      ]
    );

    if (initQty > 0) {
      await db.execute(
        `INSERT INTO commodity_transactions (id, commodity_id, warehouse_id, type, quantity, balance_after, date, date_shamsi, reference, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          'ctx_init_' + newCommodity.id,
          newCommodity.id,
          newCommodity.warehouse_id,
          'initial',
          initQty,
          initQty,
          now,
          shamsiNow,
          'موجودی اولیه',
          'ثبت موجودی اولیه هنگام تعریف کالا',
          now,
        ]
      );
    }
  } else {
    memoryStore.commodities.push(newCommodity);
    if (initQty > 0) {
      memoryStore.commodityTransactions.push({
        id: 'ctx_init_' + newCommodity.id,
        commodity_id: newCommodity.id,
        warehouse_id: newCommodity.warehouse_id,
        type: 'initial',
        quantity: initQty,
        balance_after: initQty,
        date: now,
        date_shamsi: shamsiNow,
        reference: 'موجودی اولیه',
        description: 'ثبت موجودی اولیه هنگام تعریف کالا',
        created_at: now,
      });
    }
    saveFallbackToStorage();
  }

  return newCommodity;
}

export async function updateCommodity(
  id: string,
  data: {
    name: string;
    barcode?: string;
    unit: string;
    warehouse_id: string;
    group_id?: string | null;
    purchase_price?: number;
    sales_price?: number;
  }
): Promise<Commodity> {
  const db = await getDb();
  const trimmedName = data.name.trim();
  const barcode = data.barcode?.trim() || '';
  const unit = data.unit.trim() || 'عدد';
  const whId = data.warehouse_id;
  const grpId = data.group_id || null;
  const pPrice = Number(data.purchase_price) || 0;
  const sPrice = Number(data.sales_price) || 0;

  if (db && !isWebFallback) {
    await db.execute(
      `UPDATE commodities
       SET name = $1, barcode = $2, unit = $3, warehouse_id = $4, group_id = $5, purchase_price = $6, sales_price = $7
       WHERE id = $8`,
      [trimmedName, barcode, unit, whId, grpId, pPrice, sPrice, id]
    );
    const updated = await getCommodityById(id);
    if (!updated) throw new Error('کالای ویرایش شده یافت نشد.');
    return updated;
  } else {
    const c = memoryStore.commodities.find((item) => item.id === id);
    if (!c) throw new Error('کالا یافت نشد.');
    c.name = trimmedName;
    c.barcode = barcode;
    c.unit = unit;
    c.warehouse_id = whId;
    c.group_id = grpId;
    c.purchase_price = pPrice;
    c.sales_price = sPrice;
    saveFallbackToStorage();
    return c;
  }
}

export async function canDeleteCommodity(
  id: string
): Promise<{ canDelete: boolean; movementsCount: number; reason?: string }> {
  const db = await getDb();
  if (db && !isWebFallback) {
    try {
      const res: { c: number }[] = await db.select(
        `SELECT COUNT(*) as c FROM commodity_transactions WHERE commodity_id = $1 AND type != 'initial'`,
        [id]
      );
      const count = res[0]?.c || 0;
      if (count > 0) {
        return {
          canDelete: false,
          movementsCount: count,
          reason: `این کالا دارای ${count} گردش کاردکس (ورودی/خروجی/انتقال) می‌باشد و طبق اصول انبارداری امکان حذف آن وجود ندارد.`,
        };
      }
      return { canDelete: true, movementsCount: 0 };
    } catch {
      return { canDelete: true, movementsCount: 0 };
    }
  } else {
    const count = memoryStore.commodityTransactions.filter(
      (t) => t.commodity_id === id && t.type !== 'initial'
    ).length;
    if (count > 0) {
      return {
        canDelete: false,
        movementsCount: count,
        reason: `این کالا دارای ${count} گردش کاردکس می‌باشد و امکان حذف آن وجود ندارد.`,
      };
    }
    return { canDelete: true, movementsCount: 0 };
  }
}

export async function deleteCommodity(id: string): Promise<void> {
  const check = await canDeleteCommodity(id);
  if (!check.canDelete) {
    throw new Error(check.reason || 'امکان حذف این کالا وجود ندارد.');
  }

  const db = await getDb();
  if (db && !isWebFallback) {
    await db.execute('DELETE FROM commodity_transactions WHERE commodity_id = $1', [id]);
    await db.execute('DELETE FROM commodities WHERE id = $1', [id]);
  } else {
    memoryStore.commodityTransactions = memoryStore.commodityTransactions.filter(
      (t) => t.commodity_id !== id
    );
    memoryStore.commodities = memoryStore.commodities.filter((c) => c.id !== id);
    saveFallbackToStorage();
  }
}

export async function getCommodityTransactions(
  commodityId: string,
  filter?: { startDate?: string; endDate?: string }
): Promise<CommodityTransaction[]> {
  const db = await getDb();
  let list: CommodityTransaction[] = [];

  if (db && !isWebFallback) {
    try {
      let queryStr = `SELECT * FROM commodity_transactions WHERE commodity_id = $1`;
      const params: any[] = [commodityId];
      if (filter?.startDate) {
        queryStr += ` AND date_shamsi >= $2`;
        params.push(filter.startDate);
      }
      if (filter?.endDate) {
        queryStr += ` AND date_shamsi <= $${params.length + 1}`;
        params.push(filter.endDate);
      }
      queryStr += ` ORDER BY date ASC, created_at ASC`;
      list = await db.select(queryStr, params);
    } catch {
      list = [];
    }
  } else {
    list = memoryStore.commodityTransactions.filter((t) => t.commodity_id === commodityId);
    if (filter?.startDate) {
      list = list.filter((t) => t.date_shamsi >= filter.startDate!);
    }
    if (filter?.endDate) {
      list = list.filter((t) => t.date_shamsi <= filter.endDate!);
    }
    list.sort((a, b) => a.date.localeCompare(b.date));
  }

  return list;
}

export function normalizeShamsiDate(d: string): string {
  if (!d) return '0000/00/00';
  const clean = toEnglishDigits(d);
  const parts = clean.split('/').map((p: string) => parseInt(p.trim(), 10));
  if (parts.length === 3 && !parts.some(isNaN)) {
    return `${parts[0]}/${String(parts[1]).padStart(2, '0')}/${String(parts[2]).padStart(2, '0')}`;
  }
  return clean.trim();
}

export async function getCommodityStockAtDate(
  commodityId: string,
  dateShamsi: string,
  excludeInvoiceId?: string,
  _warehouseId?: string
): Promise<{
  availableAtDate: number;
  maxAllowedExit: number;
  unit: string;
  commodityName: string;
}> {
  const db = await getDb();
  const comm = await getCommodityById(commodityId);
  const unit = comm?.unit || 'واحد';
  const commodityName = comm?.name || '';

  if (!comm) {
    return { availableAtDate: 0, maxAllowedExit: 0, unit, commodityName };
  }

  let excludeInvoiceNumber: number | null = null;
  let excludeInvoiceType: string | null = null;
  if (excludeInvoiceId) {
    const inv = await getInvoiceById(excludeInvoiceId);
    if (inv) {
      excludeInvoiceNumber = inv.invoice_number;
      excludeInvoiceType = inv.type;
    }
  }

  let rawList: CommodityTransaction[] = [];
  if (db && !isWebFallback) {
    try {
      rawList = await db.select(
        `SELECT * FROM commodity_transactions WHERE commodity_id = $1`,
        [commodityId]
      );
    } catch {
      rawList = [];
    }
  } else {
    rawList = memoryStore.commodityTransactions.filter((t) => t.commodity_id === commodityId);
  }

  const filteredTxs = rawList.filter((tx) => {
    if (excludeInvoiceId && tx.invoice_id === excludeInvoiceId) {
      return false;
    }
    if (excludeInvoiceNumber && tx.reference) {
      const typeStr = excludeInvoiceType === 'sale' ? 'فروش' : 'خرید';
      if (tx.reference.includes(`شماره ${excludeInvoiceNumber}`) && tx.reference.includes(typeStr)) {
        return false;
      }
    }
    return true;
  });

  const hasInitialTx = filteredTxs.some((tx) => tx.type === 'initial');
  const initQty = comm.initial_quantity || 0;
  if (!hasInitialTx && initQty > 0) {
    filteredTxs.push({
      id: 'synth_init_' + comm.id,
      commodity_id: comm.id,
      warehouse_id: comm.warehouse_id,
      type: 'initial',
      quantity: initQty,
      balance_after: initQty,
      date: comm.created_at || '1970-01-01T00:00:00.000Z',
      date_shamsi: '0000/00/00',
      reference: 'موجودی اولیه',
      description: 'ثبت موجودی اولیه کالا',
      created_at: comm.created_at || '1970-01-01T00:00:00.000Z',
    });
  }

  const targetNorm = normalizeShamsiDate(dateShamsi);
  filteredTxs.sort((a, b) => {
    const dateA = normalizeShamsiDate(a.date_shamsi);
    const dateB = normalizeShamsiDate(b.date_shamsi);
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    const isInA = a.type === 'initial' || a.type === 'in';
    const isInB = b.type === 'initial' || b.type === 'in';
    if (isInA !== isInB) {
      return isInA ? -1 : 1;
    }
    return (a.date || '').localeCompare(b.date || '') || (a.created_at || '').localeCompare(b.created_at || '');
  });

  let runningBalance = 0;
  let balanceAtTarget = 0;
  let minFutureBalance = Infinity;
  let hasPassedTarget = false;

  for (const tx of filteredTxs) {
    const txDate = normalizeShamsiDate(tx.date_shamsi);
    const delta = (tx.type === 'initial' || tx.type === 'in') ? (tx.quantity || 0) : -(tx.quantity || 0);

    if (txDate <= targetNorm) {
      runningBalance += delta;
    } else {
      if (!hasPassedTarget) {
        balanceAtTarget = runningBalance;
        hasPassedTarget = true;
      }
      runningBalance += delta;
      if (runningBalance < minFutureBalance) {
        minFutureBalance = runningBalance;
      }
    }
  }

  if (!hasPassedTarget) {
    balanceAtTarget = runningBalance;
    minFutureBalance = balanceAtTarget;
  } else {
    minFutureBalance = Math.min(balanceAtTarget, minFutureBalance);
  }

  const availableAtDate = cleanNum(Math.max(0, balanceAtTarget));
  const maxAllowedExit = cleanNum(Math.max(0, Math.min(balanceAtTarget, minFutureBalance)));

  return {
    availableAtDate,
    maxAllowedExit,
    unit,
    commodityName,
  };
}

export async function getCommodityGroupTransactions(
  groupId: string,
  filter?: { startDate?: string; endDate?: string }
): Promise<(CommodityTransaction & { commodity_name: string; commodity_code: number; commodity_unit: string })[]> {
  const db = await getDb();
  let list: (CommodityTransaction & { commodity_name: string; commodity_code: number; commodity_unit: string })[] = [];

  if (db && !isWebFallback) {
    try {
      let queryStr = `
        SELECT ct.*, c.name as commodity_name, c.code as commodity_code, c.unit as commodity_unit
        FROM commodity_transactions ct
        JOIN commodities c ON c.id = ct.commodity_id
        WHERE c.group_id = $1
      `;
      const params: any[] = [groupId];
      if (filter?.startDate) {
        queryStr += ` AND ct.date_shamsi >= $2`;
        params.push(filter.startDate);
      }
      if (filter?.endDate) {
        queryStr += ` AND ct.date_shamsi <= $${params.length + 1}`;
        params.push(filter.endDate);
      }
      queryStr += ` ORDER BY ct.date DESC, ct.created_at DESC`;
      list = await db.select(queryStr, params);
    } catch {
      list = [];
    }
  } else {
    const groupCommodityIds = new Set(
      memoryStore.commodities.filter((c) => c.group_id === groupId).map((c) => c.id)
    );
    const commMap = new Map<string, Commodity>();
    for (const c of memoryStore.commodities) commMap.set(c.id, c);

    const filtered = memoryStore.commodityTransactions.filter((t) => groupCommodityIds.has(t.commodity_id));
    let matched = filtered;
    if (filter?.startDate) {
      matched = matched.filter((t) => t.date_shamsi >= filter.startDate!);
    }
    if (filter?.endDate) {
      matched = matched.filter((t) => t.date_shamsi <= filter.endDate!);
    }
    list = matched.map((t) => {
      const c = commMap.get(t.commodity_id);
      return {
        ...t,
        commodity_name: c?.name || '',
        commodity_code: c?.code || 0,
        commodity_unit: c?.unit || '',
      };
    });
    list.sort((a, b) => b.date.localeCompare(a.date));
  }

  return list;
}
