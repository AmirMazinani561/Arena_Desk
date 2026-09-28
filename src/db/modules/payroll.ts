import { getDb, isWebFallback, memoryStore, saveFallbackToStorage } from '../core/connection';
import type { PayrollEmployee, PayrollRecord, PayrollPayment } from '../types';

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'pr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
}

// ============================================================================
// EMPLOYEES
// ============================================================================

export async function getAllPayrollEmployees(): Promise<PayrollEmployee[]> {
  const db = await getDb();
  if (db && !isWebFallback) {
    try {
      const rows: any[] = await db.select('SELECT * FROM payroll_employees ORDER BY code ASC, name ASC');
      return rows;
    } catch (e) {
      console.error('Error fetching payroll employees:', e);
      return [];
    }
  } else {
    return [...(memoryStore.payrollEmployees || [])].sort((a, b) => (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name));
  }
}

export async function createPayrollEmployee(data: { name: string; code?: string; phone?: string; bank_card?: string; is_active?: number }): Promise<PayrollEmployee> {
  const db = await getDb();
  const id = generateId();
  const now = new Date().toISOString();
  const employee: PayrollEmployee = {
    id,
    name: data.name,
    code: data.code || '',
    phone: data.phone || '',
    bank_card: data.bank_card || '',
    is_active: data.is_active ?? 1,
    created_at: now
  };

  if (db && !isWebFallback) {
    await db.execute(
      `INSERT INTO payroll_employees (id, name, code, phone, bank_card, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [employee.id, employee.name, employee.code, employee.phone, employee.bank_card, employee.created_at]
    );
  } else {
    if (!memoryStore.payrollEmployees) memoryStore.payrollEmployees = [];
    memoryStore.payrollEmployees.push(employee);
    saveFallbackToStorage();
  }

  return employee;
}

export async function updatePayrollEmployee(id: string, data: Partial<PayrollEmployee>): Promise<PayrollEmployee> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const existing: any[] = await db.select('SELECT * FROM payroll_employees WHERE id = $1', [id]);
    if (existing.length === 0) throw new Error('Employee not found');
    const updated: PayrollEmployee = {
      ...existing[0],
      ...data
    };
    await db.execute(
      `UPDATE payroll_employees SET name = $1, code = $2, phone = $3, bank_card = $4 WHERE id = $5`,
      [updated.name, updated.code || '', updated.phone || '', updated.bank_card || '', id]
    );
    return updated;
  } else {
    const idx = (memoryStore.payrollEmployees || []).findIndex(e => e.id === id);
    if (idx === -1) throw new Error('Employee not found');
    const updated = { ...memoryStore.payrollEmployees[idx], ...data };
    memoryStore.payrollEmployees[idx] = updated;
    saveFallbackToStorage();
    return updated;
  }
}

export async function deletePayrollEmployee(id: string): Promise<void> {
  const db = await getDb();
  if (db && !isWebFallback) {
    // Delete payments belonging to employee's records
    await db.execute(`
      DELETE FROM payroll_payments WHERE record_id IN (
        SELECT id FROM payroll_records WHERE employee_id = $1
      )
    `, [id]);
    await db.execute('DELETE FROM payroll_records WHERE employee_id = $1', [id]);
    await db.execute('DELETE FROM payroll_employees WHERE id = $1', [id]);
  } else {
    const empRecords = (memoryStore.payrollRecords || []).filter(r => r.employee_id === id);
    const recIds = new Set(empRecords.map(r => r.id));
    memoryStore.payrollPayments = (memoryStore.payrollPayments || []).filter(p => !recIds.has(p.record_id));
    memoryStore.payrollRecords = (memoryStore.payrollRecords || []).filter(r => r.employee_id !== id);
    memoryStore.payrollEmployees = (memoryStore.payrollEmployees || []).filter(e => e.id !== id);
    saveFallbackToStorage();
  }
}

// ============================================================================
// MONTHLY RECORDS & PAYMENTS
// ============================================================================

export const roundUp50k = (val: number): number => {
  if (val <= 0) return 0;
  const rem = val % 50000;
  if (rem === 0) return val;
  return val + (50000 - rem);
};

export async function getPayrollMonthlyRecord(
  employeeId: string,
  year: number,
  month: number
): Promise<{
  currentRecord: PayrollRecord | null;
  prevRecord: PayrollRecord | null;
  prevPaymentsTotal: number;
  accumulatedPrevBalance: number;
}> {
  const db = await getDb();
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;

  if (db && !isWebFallback) {
    try {
      const curRows: any[] = await db.select(
        'SELECT * FROM payroll_records WHERE employee_id = $1 AND year = $2 AND month = $3 LIMIT 1',
        [employeeId, year, month]
      );
      const currentRecord: PayrollRecord | null = curRows.length > 0 ? curRows[0] : null;

      const prevRows: any[] = await db.select(
        'SELECT * FROM payroll_records WHERE employee_id = $1 AND year = $2 AND month = $3 LIMIT 1',
        [employeeId, prevYear, prevMonth]
      );
      const prevRecord: PayrollRecord | null = prevRows.length > 0 ? prevRows[0] : null;

      let prevPaymentsTotal = 0;
      if (prevRecord) {
        const paySumRows: any[] = await db.select(
          'SELECT SUM(amount_rial) as total FROM payroll_payments WHERE record_id = $1',
          [prevRecord.id]
        );
        prevPaymentsTotal = Number(paySumRows[0]?.total) || 0;
      }

      // محاسبه دقیق مانده انباشته منتقل‌شده از تمامی ماه‌ها و سال‌های قبل از (year, month)
      const priorRecords: any[] = await db.select(
        `SELECT r.id, r.year, r.month, r.base_salary_rial, r.overtime_days,
                COALESCE((SELECT SUM(amount_rial) FROM payroll_payments WHERE record_id = r.id), 0) as total_pays
         FROM payroll_records r
         WHERE r.employee_id = $1
           AND (r.year < $2 OR (r.year = $2 AND r.month < $3))
         ORDER BY r.year ASC, r.month ASC`,
        [employeeId, year, month]
      );

      let accumulatedPrevBalance = 0;
      for (const r of priorRecords) {
        const sal = Number(r.base_salary_rial) || 0;
        const ot = Math.round(Number(r.overtime_days) || 0);
        const otAmt = sal > 0 ? roundUp50k((sal / 30) * ot) : 0;
        const pays = Number(r.total_pays) || 0;
        accumulatedPrevBalance += (sal + otAmt) - pays;
      }

      return { currentRecord, prevRecord, prevPaymentsTotal, accumulatedPrevBalance };
    } catch (e) {
      console.error('Error fetching monthly payroll record:', e);
      return { currentRecord: null, prevRecord: null, prevPaymentsTotal: 0, accumulatedPrevBalance: 0 };
    }
  } else {
    const cur = (memoryStore.payrollRecords || []).find(r => r.employee_id === employeeId && r.year === year && r.month === month) || null;
    const prv = (memoryStore.payrollRecords || []).find(r => r.employee_id === employeeId && r.year === prevYear && r.month === prevMonth) || null;
    let prvPays = 0;
    if (prv) {
      prvPays = (memoryStore.payrollPayments || [])
        .filter(p => p.record_id === prv.id)
        .reduce((sum, p) => sum + p.amount_rial, 0);
    }

    const priorRecords = (memoryStore.payrollRecords || [])
      .filter(r => r.employee_id === employeeId && (r.year < year || (r.year === year && r.month < month)))
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

    let accumulatedPrevBalance = 0;
    for (const r of priorRecords) {
      const sal = Number(r.base_salary_rial) || 0;
      const ot = Math.round(Number(r.overtime_days) || 0);
      const otAmt = sal > 0 ? roundUp50k((sal / 30) * ot) : 0;
      const pays = (memoryStore.payrollPayments || [])
        .filter(p => p.record_id === r.id)
        .reduce((sum, p) => sum + p.amount_rial, 0);
      accumulatedPrevBalance += (sal + otAmt) - pays;
    }

    return { currentRecord: cur, prevRecord: prv, prevPaymentsTotal: prvPays, accumulatedPrevBalance };
  }
}

export async function savePayrollMonthlyRecord(data: {
  employee_id: string;
  year: number;
  month: number;
  base_salary_rial: number;
  overtime_days: number;
}): Promise<PayrollRecord> {
  const db = await getDb();
  const now = new Date().toISOString();

  if (db && !isWebFallback) {
    const existing: any[] = await db.select(
      'SELECT * FROM payroll_records WHERE employee_id = $1 AND year = $2 AND month = $3 LIMIT 1',
      [data.employee_id, data.year, data.month]
    );

    if (existing.length > 0) {
      const record: PayrollRecord = {
        ...existing[0],
        base_salary_rial: Number(data.base_salary_rial) || 0,
        overtime_days: Number(data.overtime_days) || 0
      };
      await db.execute(
        `UPDATE payroll_records SET base_salary_rial = $1, overtime_days = $2 WHERE id = $3`,
        [record.base_salary_rial, record.overtime_days, record.id]
      );
      return record;
    } else {
      const id = generateId();
      const record: PayrollRecord = {
        id,
        employee_id: data.employee_id,
        year: data.year,
        month: data.month,
        base_salary_rial: Number(data.base_salary_rial) || 0,
        overtime_days: Number(data.overtime_days) || 0,
        created_at: now
      };
      await db.execute(
        `INSERT INTO payroll_records (id, employee_id, year, month, base_salary_rial, overtime_days, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [record.id, record.employee_id, record.year, record.month, record.base_salary_rial, record.overtime_days, record.created_at]
      );
      return record;
    }
  } else {
    if (!memoryStore.payrollRecords) memoryStore.payrollRecords = [];
    const idx = memoryStore.payrollRecords.findIndex(r => r.employee_id === data.employee_id && r.year === data.year && r.month === data.month);
    if (idx !== -1) {
      const record: PayrollRecord = {
        ...memoryStore.payrollRecords[idx],
        base_salary_rial: Number(data.base_salary_rial) || 0,
        overtime_days: Number(data.overtime_days) || 0
      };
      memoryStore.payrollRecords[idx] = record;
      saveFallbackToStorage();
      return record;
    } else {
      const id = generateId();
      const record: PayrollRecord = {
        id,
        employee_id: data.employee_id,
        year: data.year,
        month: data.month,
        base_salary_rial: Number(data.base_salary_rial) || 0,
        overtime_days: Number(data.overtime_days) || 0,
        created_at: now
      };
      memoryStore.payrollRecords.push(record);
      saveFallbackToStorage();
      return record;
    }
  }
}

export async function getPayrollPayments(recordId: string): Promise<PayrollPayment[]> {
  const db = await getDb();
  if (db && !isWebFallback) {
    try {
      const rows: any[] = await db.select(
        'SELECT * FROM payroll_payments WHERE record_id = $1 ORDER BY payment_date ASC, created_at ASC',
        [recordId]
      );
      return rows;
    } catch (e) {
      console.error('Error fetching payroll payments:', e);
      return [];
    }
  } else {
    return [...(memoryStore.payrollPayments || [])]
      .filter(p => p.record_id === recordId)
      .sort((a, b) => (a.payment_date || '').localeCompare(b.payment_date || '') || (a.created_at || '').localeCompare(b.created_at || ''));
  }
}

export async function getAllPayrollPayments(): Promise<PayrollPayment[]> {
  const db = await getDb();
  if (db && !isWebFallback) {
    try {
      const rows: any[] = await db.select('SELECT * FROM payroll_payments');
      return rows;
    } catch (e) {
      console.error('Error fetching all payroll payments:', e);
      return [];
    }
  } else {
    return [...(memoryStore.payrollPayments || [])];
  }
}

export async function createPayrollPayment(data: Omit<PayrollPayment, 'id' | 'created_at'>): Promise<PayrollPayment> {
  const db = await getDb();
  const id = generateId();
  const now = new Date().toISOString();
  const payment: PayrollPayment = {
    ...data,
    id,
    created_at: now
  };

  if (db && !isWebFallback) {
    await db.execute(
      `INSERT INTO payroll_payments (id, record_id, payment_date, amount_rial, payment_type, description, source, source_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        payment.id,
        payment.record_id,
        payment.payment_date,
        Number(payment.amount_rial) || 0,
        payment.payment_type,
        payment.description || '',
        payment.source || null,
        payment.source_id || null,
        payment.created_at
      ]
    );
  } else {
    if (!memoryStore.payrollPayments) memoryStore.payrollPayments = [];
    memoryStore.payrollPayments.push(payment);
    saveFallbackToStorage();
  }

  return payment;
}

export async function findPayrollPaymentBySource(sourceId: string): Promise<PayrollPayment | null> {
  const db = await getDb();
  if (db && !isWebFallback) {
    try {
      const rows: any[] = await db.select(
        'SELECT * FROM payroll_payments WHERE source_id = $1 LIMIT 1',
        [sourceId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch {
      return null;
    }
  } else {
    return (memoryStore.payrollPayments || []).find(p => p.source_id === sourceId) || null;
  }
}

export async function findSimilarPayrollPayment(recordId: string, paymentDate: string, amountRial: number): Promise<PayrollPayment | null> {
  const db = await getDb();
  const cleanDate = paymentDate.replace(/\D/g, '');
  if (db && !isWebFallback) {
    try {
      const rows: any[] = await db.select(
        `SELECT * FROM payroll_payments 
         WHERE record_id = $1 AND ABS(amount_rial - $2) < 1 AND REPLACE(payment_date, '/', '') = $3
         LIMIT 1`,
        [recordId, amountRial, cleanDate]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch {
      return null;
    }
  } else {
    return (memoryStore.payrollPayments || []).find(p => 
      p.record_id === recordId && 
      Math.abs(p.amount_rial - amountRial) < 1 && 
      p.payment_date.replace(/\D/g, '') === cleanDate
    ) || null;
  }
}

export async function updatePayrollPayment(id: string, data: Partial<PayrollPayment>): Promise<PayrollPayment> {
  const db = await getDb();
  if (db && !isWebFallback) {
    const existing: any[] = await db.select('SELECT * FROM payroll_payments WHERE id = $1', [id]);
    if (existing.length === 0) throw new Error('Payment not found');
    const updated: PayrollPayment = {
      ...existing[0],
      ...data
    };
    await db.execute(
      `UPDATE payroll_payments SET payment_date = $1, amount_rial = $2, payment_type = $3, description = $4 WHERE id = $5`,
      [updated.payment_date, Number(updated.amount_rial) || 0, updated.payment_type, updated.description || '', id]
    );
    return updated;
  } else {
    const idx = (memoryStore.payrollPayments || []).findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Payment not found');
    const updated = { ...memoryStore.payrollPayments[idx], ...data };
    memoryStore.payrollPayments[idx] = updated;
    saveFallbackToStorage();
    return updated;
  }
}

export async function deletePayrollPayment(id: string): Promise<void> {
  const db = await getDb();
  if (db && !isWebFallback) {
    await db.execute('DELETE FROM payroll_payments WHERE id = $1', [id]);
  } else {
    memoryStore.payrollPayments = (memoryStore.payrollPayments || []).filter(p => p.id !== id);
    saveFallbackToStorage();
  }
}

export async function getEmployeeAnnualRecords(employeeId: string, year: number): Promise<{ records: PayrollRecord[]; payments: PayrollPayment[] }> {
  const db = await getDb();
  if (db && !isWebFallback) {
    try {
      const records: any[] = await db.select(
        'SELECT * FROM payroll_records WHERE employee_id = $1 AND year = $2 ORDER BY month ASC',
        [employeeId, year]
      );
      const payments: any[] = await db.select(
        `SELECT p.* FROM payroll_payments p
         JOIN payroll_records r ON p.record_id = r.id
         WHERE r.employee_id = $1 AND r.year = $2
         ORDER BY p.payment_date ASC, p.created_at ASC`,
        [employeeId, year]
      );
      return { records, payments };
    } catch (e) {
      console.error('Error fetching employee annual records:', e);
      return { records: [], payments: [] };
    }
  } else {
    const records = (memoryStore.payrollRecords || [])
      .filter(r => r.employee_id === employeeId && r.year === year)
      .sort((a, b) => a.month - b.month);
    const recIds = new Set(records.map(r => r.id));
    const payments = (memoryStore.payrollPayments || [])
      .filter(p => recIds.has(p.record_id));
    return { records, payments };
  }
}

export async function getAllPayrollYearData(year: number, month?: number): Promise<{ records: PayrollRecord[]; payments: PayrollPayment[] }> {
  const db = await getDb();
  if (db && !isWebFallback) {
    try {
      let sqlRecords = 'SELECT * FROM payroll_records WHERE year = $1';
      const params: any[] = [year];
      if (month && month > 0) {
        sqlRecords += ' AND month = $2';
        params.push(month);
      }
      sqlRecords += ' ORDER BY month ASC';
      const records: any[] = await db.select(sqlRecords, params);

      let sqlPayments = `SELECT p.* FROM payroll_payments p
                         JOIN payroll_records r ON p.record_id = r.id
                         WHERE r.year = $1`;
      if (month && month > 0) {
        sqlPayments += ' AND r.month = $2';
      }
      sqlPayments += ' ORDER BY p.payment_date ASC';
      const payments: any[] = await db.select(sqlPayments, params);

      return { records, payments };
    } catch (e) {
      console.error('Error fetching all payroll year data:', e);
      return { records: [], payments: [] };
    }
  } else {
    const records = (memoryStore.payrollRecords || [])
      .filter(r => r.year === year && (!month || r.month === month))
      .sort((a, b) => a.month - b.month);
    const recIds = new Set(records.map(r => r.id));
    const payments = (memoryStore.payrollPayments || [])
      .filter(p => recIds.has(p.record_id));
    return { records, payments };
  }
}

