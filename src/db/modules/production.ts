import { getDb, isWebFallback, memoryStore, saveFallbackToStorage, cleanNum } from '../core/connection';
import { initSchema } from '../core/schema';
import type { ProductionOrder, ProductionOutputItem, Commodity, CommodityTransaction } from '../types';
import { getCurrentShamsi, shamsiToGregorian } from '../../utils/dateUtils';

export async function initProductionTables(): Promise<void> {
  const db = await getDb();
  if (db && !isWebFallback) {
    await initSchema(db);
  }
}

async function getCommodityCurrentQty(db: any, commodityId: string): Promise<number> {
  try {
    const rows: any[] = await db.select('SELECT current_quantity FROM commodities WHERE id = $1', [commodityId]);
    return Number(rows[0]?.current_quantity) || 0;
  } catch (e) {
    return 0;
  }
}

export async function getAllProductionOrders(): Promise<ProductionOrder[]> {
  const db = await getDb();
  await initProductionTables();

  if (db && !isWebFallback) {
    const orders: any[] = await db.select(`
      SELECT 
        po.*,
        c.name as input_commodity_name,
        w.name as input_warehouse_name
      FROM production_orders po
      LEFT JOIN commodities c ON po.input_commodity_id = c.id
      LEFT JOIN warehouses w ON po.input_warehouse_id = w.id
      ORDER BY po.order_number DESC
    `);

    for (const order of orders) {
      const outputs: any[] = await db.select(`
        SELECT 
          po.*,
          c.name as commodity_name,
          w.name as warehouse_name
        FROM production_outputs po
        LEFT JOIN commodities c ON po.commodity_id = c.id
        LEFT JOIN warehouses w ON po.warehouse_id = w.id
        WHERE po.production_order_id = $1
      `, [order.id]);
      order.outputs = outputs;
    }
    return orders;
  } else {
    return [...memoryStore.productionOrders].sort((a, b) => b.order_number - a.order_number);
  }
}

export async function insertProductionOrder(
  data: Omit<ProductionOrder, 'id' | 'order_number'>,
  outputs: Omit<ProductionOutputItem, 'id' | 'production_order_id'>[]
): Promise<string> {
  const db = await getDb();
  await initProductionTables();
  
  const id = 'pro_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();
  const gregorianDate = shamsiToGregorian(data.date_shamsi || getCurrentShamsi().formatted).toISOString();

  if (db && !isWebFallback) {
    const maxRes: any[] = await db.select('SELECT MAX(order_number) as maxNum FROM production_orders');
    const max = maxRes[0]?.maxNum;
    const orderNumber = typeof max === 'number' && max > 0 ? max + 1 : 1;

    await db.execute(
      `INSERT INTO production_orders (
        id, order_number, date_shamsi, input_commodity_id, input_warehouse_id,
        input_quantity, total_output_quantity, loss_quantity, yield_percentage, note,
        purchase_invoice_id, purchase_invoice_number, input_unit_price, wage_cost,
        transport_cost, overhead_cost, total_production_cost, cost_per_unit, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        id, orderNumber, data.date_shamsi, data.input_commodity_id, data.input_warehouse_id,
        data.input_quantity, data.total_output_quantity, data.loss_quantity, data.yield_percentage, data.note || '',
        data.purchase_invoice_id || null, data.purchase_invoice_number || null,
        Number(data.input_unit_price) || 0, Number(data.wage_cost) || 0,
        Number(data.transport_cost) || 0, Number(data.overhead_cost) || 0,
        Number(data.total_production_cost) || 0, Number(data.cost_per_unit) || 0,
        now
      ]
    );

    const currentInputBal = await getCommodityCurrentQty(db, data.input_commodity_id);
    const newInputBal = cleanNum(currentInputBal - data.input_quantity);
    await db.execute('UPDATE commodities SET current_quantity = $1 WHERE id = $2', [newInputBal, data.input_commodity_id]);

    await db.execute(
      `INSERT INTO commodity_transactions (id, commodity_id, warehouse_id, type, quantity, balance_after, date, date_shamsi, reference, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      ['ctx_' + Date.now() + '_out', data.input_commodity_id, data.input_warehouse_id, 'out', cleanNum(data.input_quantity), newInputBal, gregorianDate, data.date_shamsi, `تولید #${orderNumber}`, `مصرف در خط تولید بچ #${orderNumber}`, now]
    );

    for (let i = 0; i < outputs.length; i++) {
      const out = outputs[i];
      const outId = 'pout_' + Date.now() + '_' + i;
      
      await db.execute(
        `INSERT INTO production_outputs (id, production_order_id, commodity_id, warehouse_id, quantity, percentage, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [outId, id, out.commodity_id, out.warehouse_id, cleanNum(out.quantity), out.percentage, out.note || '']
      );

      const currentOutBal = await getCommodityCurrentQty(db, out.commodity_id);
      const newOutBal = cleanNum(currentOutBal + out.quantity);
      await db.execute('UPDATE commodities SET current_quantity = $1 WHERE id = $2', [newOutBal, out.commodity_id]);

      await db.execute(
        `INSERT INTO commodity_transactions (id, commodity_id, warehouse_id, type, quantity, balance_after, date, date_shamsi, reference, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        ['ctx_' + Date.now() + '_in_' + i, out.commodity_id, out.warehouse_id, 'in', cleanNum(out.quantity), newOutBal, gregorianDate, data.date_shamsi, `تولید #${orderNumber}`, `حاصل از تولید بچ #${orderNumber}`, now]
      );
    }
  } else {
    const orderNumber = memoryStore.productionOrders.length > 0 
      ? Math.max(...memoryStore.productionOrders.map((o) => o.order_number)) + 1 
      : 1;

    const commInput = memoryStore.commodities.find((c) => c.id === data.input_commodity_id);
    const whInput = memoryStore.warehouses.find((w) => w.id === data.input_warehouse_id);

    const newOutputs = outputs.map((out, i) => {
      const commOut = memoryStore.commodities.find((c) => c.id === out.commodity_id);
      const whOut = memoryStore.warehouses.find((w) => w.id === out.warehouse_id);
      return {
        ...out,
        id: 'pout_' + Date.now() + '_' + i,
        production_order_id: id,
        commodity_name: commOut?.name || '',
        warehouse_name: whOut?.name || '',
      };
    });

    memoryStore.productionOrders.unshift({
      ...data,
      id,
      order_number: orderNumber,
      input_commodity_name: commInput?.name || '',
      input_warehouse_name: whInput?.name || '',
      created_at: now,
      outputs: newOutputs
    });

    if (commInput) {
      commInput.current_quantity = cleanNum((commInput.current_quantity || 0) - data.input_quantity);
      memoryStore.commodityTransactions.push({
        id: 'ctx_' + Date.now() + '_out',
        commodity_id: data.input_commodity_id,
        warehouse_id: data.input_warehouse_id,
        type: 'out',
        quantity: cleanNum(data.input_quantity),
        balance_after: commInput.current_quantity,
        date: gregorianDate,
        date_shamsi: data.date_shamsi,
        reference: `تولید #${orderNumber}`,
        description: `مصرف در خط تولید بچ #${orderNumber}`,
        created_at: now
      });
    }

    newOutputs.forEach((out) => {
      const commOut = memoryStore.commodities.find((c) => c.id === out.commodity_id);
      if (commOut) {
        commOut.current_quantity = cleanNum((commOut.current_quantity || 0) + out.quantity);
        memoryStore.commodityTransactions.push({
          id: 'ctx_' + Date.now() + '_in_' + Math.random().toString(36).substring(2, 6),
          commodity_id: out.commodity_id,
          warehouse_id: out.warehouse_id,
          type: 'in',
          quantity: cleanNum(out.quantity),
          balance_after: commOut.current_quantity,
          date: gregorianDate,
          date_shamsi: data.date_shamsi,
          reference: `تولید #${orderNumber}`,
          description: `حاصل از تولید بچ #${orderNumber}`,
          created_at: now
        });
      }
    });

    saveFallbackToStorage();
  }
  return id;
}

export async function updateProductionOrder(
  orderId: string,
  data: Omit<ProductionOrder, 'id' | 'order_number'>,
  outputs: Omit<ProductionOutputItem, 'id' | 'production_order_id'>[]
): Promise<void> {
  const db = await getDb();
  const gregorianDate = shamsiToGregorian(data.date_shamsi || getCurrentShamsi().formatted).toISOString();
  const now = new Date().toISOString();

  if (db && !isWebFallback) {
    const orders: any[] = await db.select('SELECT * FROM production_orders WHERE id = $1', [orderId]);
    if (orders.length === 0) return;
    const oldOrder = orders[0];

    const oldOutputs: any[] = await db.select('SELECT * FROM production_outputs WHERE production_order_id = $1', [orderId]);

    const prevInputBal = await getCommodityCurrentQty(db, oldOrder.input_commodity_id);
    await db.execute('UPDATE commodities SET current_quantity = $1 WHERE id = $2', [cleanNum(prevInputBal + Number(oldOrder.input_quantity)), oldOrder.input_commodity_id]);

    for (const out of oldOutputs) {
      const prevOutBal = await getCommodityCurrentQty(db, out.commodity_id);
      await db.execute('UPDATE commodities SET current_quantity = $1 WHERE id = $2', [cleanNum(prevOutBal - Number(out.quantity)), out.commodity_id]);
    }

    await db.execute('DELETE FROM commodity_transactions WHERE reference = $1', [`تولید #${oldOrder.order_number}`]);
    await db.execute('DELETE FROM production_outputs WHERE production_order_id = $1', [orderId]);

    await db.execute(
      `UPDATE production_orders SET 
        date_shamsi = $1, input_commodity_id = $2, input_warehouse_id = $3,
        input_quantity = $4, total_output_quantity = $5, loss_quantity = $6,
        yield_percentage = $7, note = $8, purchase_invoice_id = $9,
        purchase_invoice_number = $10, input_unit_price = $11, wage_cost = $12,
        transport_cost = $13, overhead_cost = $14, total_production_cost = $15, cost_per_unit = $16
      WHERE id = $17`,
      [
        data.date_shamsi, data.input_commodity_id, data.input_warehouse_id,
        data.input_quantity, data.total_output_quantity, data.loss_quantity,
        data.yield_percentage, data.note || '', data.purchase_invoice_id || null,
        data.purchase_invoice_number || null, Number(data.input_unit_price) || 0,
        Number(data.wage_cost) || 0, Number(data.transport_cost) || 0,
        Number(data.overhead_cost) || 0, Number(data.total_production_cost) || 0,
        Number(data.cost_per_unit) || 0, orderId
      ]
    );

    const currentInputBal = await getCommodityCurrentQty(db, data.input_commodity_id);
    const newInputBal = cleanNum(currentInputBal - data.input_quantity);
    await db.execute('UPDATE commodities SET current_quantity = $1 WHERE id = $2', [newInputBal, data.input_commodity_id]);

    await db.execute(
      `INSERT INTO commodity_transactions (id, commodity_id, warehouse_id, type, quantity, balance_after, date, date_shamsi, reference, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      ['ctx_' + Date.now() + '_upd1', data.input_commodity_id, data.input_warehouse_id, 'out', cleanNum(data.input_quantity), newInputBal, gregorianDate, data.date_shamsi, `تولید #${oldOrder.order_number}`, `مصرف در خط تولید بچ #${oldOrder.order_number}`, now]
    );

    for (let i = 0; i < outputs.length; i++) {
      const out = outputs[i];
      const outId = 'pout_' + Date.now() + '_' + i;
      
      await db.execute(
        `INSERT INTO production_outputs (id, production_order_id, commodity_id, warehouse_id, quantity, percentage, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [outId, orderId, out.commodity_id, out.warehouse_id, cleanNum(out.quantity), out.percentage, out.note || '']
      );

      const currentOutBal = await getCommodityCurrentQty(db, out.commodity_id);
      const newOutBal = cleanNum(currentOutBal + out.quantity);
      await db.execute('UPDATE commodities SET current_quantity = $1 WHERE id = $2', [newOutBal, out.commodity_id]);

      await db.execute(
        `INSERT INTO commodity_transactions (id, commodity_id, warehouse_id, type, quantity, balance_after, date, date_shamsi, reference, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        ['ctx_' + Date.now() + '_upd2_' + i, out.commodity_id, out.warehouse_id, 'in', cleanNum(out.quantity), newOutBal, gregorianDate, data.date_shamsi, `تولید #${oldOrder.order_number}`, `حاصل از تولید بچ #${oldOrder.order_number}`, now]
      );
    }
  } else {
    const oldOrderIndex = memoryStore.productionOrders.findIndex((o) => o.id === orderId);
    if (oldOrderIndex === -1) return;
    const oldOrder = memoryStore.productionOrders[oldOrderIndex];

    const prevInputComm = memoryStore.commodities.find((c) => c.id === oldOrder.input_commodity_id);
    if (prevInputComm) prevInputComm.current_quantity = cleanNum((prevInputComm.current_quantity || 0) + Number(oldOrder.input_quantity));

    oldOrder.outputs?.forEach((out) => {
      const prevOutComm = memoryStore.commodities.find((c) => c.id === out.commodity_id);
      if (prevOutComm) prevOutComm.current_quantity = cleanNum((prevOutComm.current_quantity || 0) - Number(out.quantity));
    });

    memoryStore.commodityTransactions = memoryStore.commodityTransactions.filter((ct) => ct.reference !== `تولید #${oldOrder.order_number}`);

    const commInput = memoryStore.commodities.find((c) => c.id === data.input_commodity_id);
    if (commInput) {
      commInput.current_quantity = cleanNum((commInput.current_quantity || 0) - data.input_quantity);
      memoryStore.commodityTransactions.push({
        id: 'ctx_' + Date.now() + '_out',
        commodity_id: data.input_commodity_id,
        warehouse_id: data.input_warehouse_id,
        type: 'out',
        quantity: cleanNum(data.input_quantity),
        balance_after: commInput.current_quantity,
        date: gregorianDate,
        date_shamsi: data.date_shamsi,
        reference: `تولید #${oldOrder.order_number}`,
        description: `مصرف در خط تولید بچ #${oldOrder.order_number}`,
        created_at: now
      });
    }

    const newOutputs = outputs.map((out, i) => {
      const commOut = memoryStore.commodities.find((c) => c.id === out.commodity_id);
      const whOut = memoryStore.warehouses.find((w) => w.id === out.warehouse_id);
      if (commOut) {
        commOut.current_quantity = cleanNum((commOut.current_quantity || 0) + out.quantity);
        memoryStore.commodityTransactions.push({
          id: 'ctx_' + Date.now() + '_in_' + i,
          commodity_id: out.commodity_id,
          warehouse_id: out.warehouse_id,
          type: 'in',
          quantity: cleanNum(out.quantity),
          balance_after: commOut.current_quantity,
          date: gregorianDate,
          date_shamsi: data.date_shamsi,
          reference: `تولید #${oldOrder.order_number}`,
          description: `حاصل از تولید بچ #${oldOrder.order_number}`,
          created_at: now
        });
      }
      return {
        ...out,
        id: 'pout_' + Date.now() + '_' + i,
        production_order_id: orderId,
        commodity_name: commOut?.name || '',
        warehouse_name: whOut?.name || '',
      };
    });

    memoryStore.productionOrders[oldOrderIndex] = {
      ...oldOrder,
      ...data,
      input_commodity_name: commInput?.name || '',
      outputs: newOutputs
    };

    saveFallbackToStorage();
  }
}

export async function deleteProductionOrder(orderId: string): Promise<void> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const orders: any[] = await db.select('SELECT * FROM production_orders WHERE id = $1', [orderId]);
    if (orders.length === 0) return;
    const order = orders[0];

    const outputs: any[] = await db.select('SELECT * FROM production_outputs WHERE production_order_id = $1', [orderId]);

    const prevInputBal = await getCommodityCurrentQty(db, order.input_commodity_id);
    await db.execute('UPDATE commodities SET current_quantity = $1 WHERE id = $2', [cleanNum(prevInputBal + Number(order.input_quantity)), order.input_commodity_id]);

    for (const out of outputs) {
      const prevOutBal = await getCommodityCurrentQty(db, out.commodity_id);
      await db.execute('UPDATE commodities SET current_quantity = $1 WHERE id = $2', [cleanNum(prevOutBal - Number(out.quantity)), out.commodity_id]);
    }

    await db.execute('DELETE FROM commodity_transactions WHERE reference = $1', [`تولید #${order.order_number}`]);
    await db.execute('DELETE FROM production_outputs WHERE production_order_id = $1', [orderId]);
    await db.execute('DELETE FROM production_orders WHERE id = $1', [orderId]);
  } else {
    const oldOrder = memoryStore.productionOrders.find((o) => o.id === orderId);
    if (!oldOrder) return;

    const prevInputComm = memoryStore.commodities.find((c) => c.id === oldOrder.input_commodity_id);
    if (prevInputComm) prevInputComm.current_quantity = cleanNum((prevInputComm.current_quantity || 0) + Number(oldOrder.input_quantity));

    oldOrder.outputs?.forEach((out) => {
      const prevOutComm = memoryStore.commodities.find((c) => c.id === out.commodity_id);
      if (prevOutComm) prevOutComm.current_quantity = cleanNum((prevOutComm.current_quantity || 0) - Number(out.quantity));
    });

    memoryStore.commodityTransactions = memoryStore.commodityTransactions.filter((ct) => ct.reference !== `تولید #${oldOrder.order_number}`);
    memoryStore.productionOrders = memoryStore.productionOrders.filter((o) => o.id !== orderId);

    saveFallbackToStorage();
  }
}

export async function recalculateAllCommoditiesStock(): Promise<void> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const comms: Commodity[] = await db.select('SELECT * FROM commodities');
    for (const c of comms) {
      const txs: CommodityTransaction[] = await db.select('SELECT * FROM commodity_transactions WHERE commodity_id = $1', [c.id]);
      let stock = Number(c.initial_quantity) || 0;
      for (const t of txs) {
        if (t.type === 'in' || t.type === 'initial') stock += Number(t.quantity) || 0;
        else if (t.type === 'out') stock -= Number(t.quantity) || 0;
      }
      stock = cleanNum(stock);
      await db.execute('UPDATE commodities SET current_quantity = $1 WHERE id = $2', [stock, c.id]);
    }
  } else {
    for (const c of memoryStore.commodities) {
      const txs = memoryStore.commodityTransactions.filter((t) => t.commodity_id === c.id);
      let stock = Number(c.initial_quantity) || 0;
      for (const t of txs) {
        if (t.type === 'in' || t.type === 'initial') stock += Number(t.quantity) || 0;
        else if (t.type === 'out') stock -= Number(t.quantity) || 0;
      }
      c.current_quantity = cleanNum(stock);
    }
    saveFallbackToStorage();
  }
}
