import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown,
  Layers,
  CreditCard,
  FileText,
  Wallet,
  Building2,
  Info,
  Edit3
} from 'lucide-react';
import type { 
  Invoice, 
  InvoiceType, 
  PaymentMethod, 
  InvoicePaymentItem,
  Account, 
  Commodity, 
  Warehouse,
  Cheque,
  Checkbook,
  CommodityGroup
} from '../db/types';
import { 
  getNextInvoiceNumber, 
  createInvoice,
  updateInvoice,
  getAvailableReceivedCheques,
  getAllCheckbooks,
  getAvailableCheckbookLeaves,
  getCommodityStockAtDate,
  getAllCommodities,
  getAllCommodityGroups
} from '../db/sqlite';
import { 
  getCurrentShamsi, 
  toPersianDigits, 
  toEnglishDigits,
  separateThousands, 
  parseAmount,
  getDiagnosis 
} from '../utils/dateUtils';
import { ShamsiDateInput } from './ShamsiDateInput';
import { SearchablePersonSelect } from './SearchablePersonSelect';
import { SearchableCommoditySelect } from './SearchableCommoditySelect';
import { SearchableAccountSelect } from './SearchableAccountSelect';
import { CommodityModal } from './CommodityModal';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (invoice: Invoice) => void;
  initialType?: InvoiceType;
  invoiceToEdit?: Invoice | null;
  allAccounts: Account[];
  allCommodities: Commodity[];
  allWarehouses: Warehouse[];
  onCommodityAdded?: () => void;
}

interface CommodityRowState {
  id: string;
  commodity_id: string;
  commodity_name: string;
  commodity_code: number | string;
  unit: string;
  quantity: number | string;
  unit_price: number;
  discount: number;
  total_price: number;
  description?: string;
}

interface ServiceRowState {
  id: string;
  account_id: string;
  account_name: string;
  title: string;
  quantity: number | string;
  unit_price: number;
  total_price: number;
  settlement_type: 'invoice' | 'direct';
  paid_from_account_id?: string;
}

interface ExtendedPaymentItem extends InvoicePaymentItem {
  branch?: string;
  account_number?: string;
  sheba?: string;
  row_number?: string;
}

const COMMON_IRANIAN_BANKS = [
  'بانک ملی ایران',
  'بانک ملت',
  'بانک صادرات ایران',
  'بانک تجارت',
  'بانک سپه',
  'بانک کشاورزی',
  'بانک مسکن',
  'بانک رفاه کارگران',
  'بانک سامان',
  'بانک پارسیان',
  'بانک پاسارگاد',
  'بانک آینده',
  'بانک اقتصاد نوین',
  'بانک شهر',
  'بانک سینا',
  'بانک دی',
  'بانک کارآفرین',
  'بانک مهر ایران',
  'بانک رسالت',
];

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialType = 'sale',
  invoiceToEdit,
  allAccounts,
  allCommodities: propCommodities,
  allWarehouses,
  onCommodityAdded,
}) => {
  const [invoiceType, setInvoiceType] = useState<InvoiceType>(initialType);
  const [invoiceNumber, setInvoiceNumber] = useState<number>(1);
  const [dateShamsi, setDateShamsi] = useState('');
  const [personId, setPersonId] = useState('');
  const [personName, setPersonName] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [description, setDescription] = useState('');

  const [commoditiesList, setCommoditiesList] = useState<Commodity[]>(propCommodities);
  const [commodityGroups, setCommodityGroups] = useState<CommodityGroup[]>([]);

  // استیت‌های مودال ایجاد سریع کالا
  const [isQuickCommodityOpen, setIsQuickCommodityOpen] = useState(false);
  const [quickCommodityRowId, setQuickCommodityRowId] = useState<string | null>(null);
  const [quickCommodityInitialName, setQuickCommodityInitialName] = useState('');

  useEffect(() => {
    setCommoditiesList(propCommodities);
  }, [propCommodities]);

  const [commodityRows, setCommodityRows] = useState<CommodityRowState[]>([]);
  const [serviceRows, setServiceRows] = useState<ServiceRowState[]>([]);

  const [discountTotal, setDiscountTotal] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);

  const [payments, setPayments] = useState<ExtendedPaymentItem[]>([]);
  const [cashAccountId, setCashAccountId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [, setBankFee] = useState<number>(0);

  const [, setAvailableReceivedCheques] = useState<Cheque[]>([]);
  const [, setAllCheckbooks] = useState<Checkbook[]>([]);
  const [, setAvailableLeaves] = useState<{
    checkbook_id: string;
    checkbook_name: string;
    bank_id: string;
    bank_name: string;
    leaf_number: number;
    check_number: string;
    serial: string;
  }[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isEditMode = Boolean(invoiceToEdit);

  useEffect(() => {
    if (isOpen) {
      getAvailableReceivedCheques()
        .then((list) => setAvailableReceivedCheques(list))
        .catch(console.error);
      getAllCheckbooks()
        .then((cbs) => setAllCheckbooks(cbs))
        .catch(console.error);
      getAvailableCheckbookLeaves()
        .then((leaves) => setAvailableLeaves(leaves))
        .catch(console.error);
      getAllCommodityGroups()
        .then((groups) => setCommodityGroups(groups))
        .catch(console.error);
    }
  }, [isOpen]);

  const persons = useMemo(() => {
    return allAccounts.filter((a) => a.type === 'person');
  }, [allAccounts]);

  const selectedPerson = useMemo(() => {
    return persons.find((p) => p.id === personId) || null;
  }, [persons, personId]);

  const cashAccounts = useMemo(() => {
    return allAccounts.filter(
      (a) =>
        a.type === 'asset' &&
        !a.bank_name &&
        !a.name.includes('بانک') &&
        (a.name.includes('صندوق') || a.name.includes('تنخواه') || a.name.includes('نقد') || a.code === '101' || (a.code && a.code.startsWith('101')))
    );
  }, [allAccounts]);

  const bankAccounts = useMemo(() => {
    return allAccounts.filter(
      (a) =>
        a.type === 'asset' &&
        !a.name.includes('صندوق') &&
        !a.name.includes('تنخواه') &&
        !a.name.includes('نقد') &&
        (Boolean(a.bank_name) || a.name.includes('بانک') || (a.code && a.code.startsWith('102')) || Boolean(a.account_number) || Boolean(a.card_number))
    );
  }, [allAccounts]);

  const allCashAndBankAccounts = useMemo(() => {
    return [...cashAccounts, ...bankAccounts];
  }, [cashAccounts, bankAccounts]);

  const revenueAccounts = useMemo(() => {
    return allAccounts.filter((a) => a.type === 'revenue');
  }, [allAccounts]);

  const expenseAccounts = useMemo(() => {
    return allAccounts.filter((a) => a.type === 'expense');
  }, [allAccounts]);

  const allServiceEligibleAccounts = useMemo(() => {
    return allAccounts.filter((a) => a.type === 'revenue' || a.type === 'expense');
  }, [allAccounts]);

  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg('');
    const todayShamsi = getCurrentShamsi().formatted;

    if (invoiceToEdit) {
      setInvoiceType(invoiceToEdit.type);
      setInvoiceNumber(invoiceToEdit.invoice_number);
      setDateShamsi(invoiceToEdit.date_shamsi);
      setPersonId(invoiceToEdit.person_id);
      setPersonName(invoiceToEdit.person_name);
      setWarehouseId(invoiceToEdit.warehouse_id || (allWarehouses[0]?.id || ''));
      setDescription(invoiceToEdit.description || '');

      if (invoiceToEdit.items && invoiceToEdit.items.length > 0) {
        setCommodityRows(
          invoiceToEdit.items.map((it) => ({
            id: it.id || 'row_' + Math.random().toString(36).substring(2, 6),
            commodity_id: it.commodity_id,
            commodity_name: it.commodity_name,
            commodity_code: it.commodity_code,
            unit: it.unit || 'عدد',
            quantity: it.quantity ?? 1,
            unit_price: it.unit_price || 0,
            discount: it.discount || 0,
            total_price: it.total_price || 0,
            description: it.description,
          }))
        );
      } else {
        setCommodityRows([]);
      }

      if (invoiceToEdit.services && invoiceToEdit.services.length > 0) {
        setServiceRows(
          invoiceToEdit.services.map((srv: any) => ({
            id: srv.id || 'srv_' + Math.random().toString(36).substring(2, 6),
            account_id: srv.account_id,
            account_name: srv.account_name,
            title: srv.title,
            quantity: srv.quantity ?? 1,
            unit_price: srv.unit_price || 0,
            total_price: srv.total_price || 0,
            settlement_type: srv.settlement_type || 'invoice',
            paid_from_account_id: srv.paid_from_account_id || '',
          }))
        );
      } else {
        setServiceRows([]);
      }

      setDiscountTotal(invoiceToEdit.discount_total || 0);
      setTaxAmount(invoiceToEdit.tax_amount || 0);
      setCashAccountId(invoiceToEdit.cash_account_id || (cashAccounts[0]?.id || ''));
      setBankAccountId(invoiceToEdit.bank_account_id || (bankAccounts[0]?.id || ''));
      setBankFee(invoiceToEdit.bank_fee || 0);

      const initialPayments: ExtendedPaymentItem[] = [];
      if (invoiceToEdit.payments && invoiceToEdit.payments.length > 0) {
        initialPayments.push(...invoiceToEdit.payments);
      }
      setPayments(initialPayments);
    } else {
      setInvoiceType(initialType);
      setDateShamsi(todayShamsi);
      setDescription('');

      getNextInvoiceNumber(initialType).then((num) => setInvoiceNumber(num));

      if (persons.length > 0) {
        setPersonId(persons[0].id);
        setPersonName(persons[0].name);
      } else {
        setPersonId('');
        setPersonName('');
      }

      if (allWarehouses.length > 0) {
        setWarehouseId(allWarehouses[0].id);
      } else {
        setWarehouseId('');
      }

      setCashAccountId(cashAccounts[0]?.id || allAccounts[0]?.id || '');
      setBankAccountId(bankAccounts[0]?.id || allAccounts[0]?.id || '');

      if (commoditiesList.length > 0) {
        const firstComm = commoditiesList[0];
        const defaultPrice = initialType === 'sale' ? firstComm.sales_price || 0 : firstComm.purchase_price || 0;
        setCommodityRows([
          {
            id: 'row_' + Date.now(),
            commodity_id: firstComm.id,
            commodity_name: firstComm.name,
            commodity_code: firstComm.code,
            unit: firstComm.unit || 'عدد',
            quantity: 1,
            unit_price: defaultPrice,
            discount: 0,
            total_price: defaultPrice,
          },
        ]);
      } else {
        setCommodityRows([]);
      }

      setServiceRows([]);
      setDiscountTotal(0);
      setTaxAmount(0);
      setPayments([]);
    }
  }, [isOpen, invoiceToEdit, initialType, persons, allWarehouses, commoditiesList, cashAccounts, bankAccounts, allAccounts]);

  const totalCommodities = useMemo(() => {
    return commodityRows.reduce((sum, r) => sum + (r.total_price || 0), 0);
  }, [commodityRows]);

  const invoiceIncludedServicesTotal = useMemo(() => {
    return serviceRows
      .filter((s) => s.settlement_type === 'invoice')
      .reduce((sum, s) => sum + (s.total_price || 0), 0);
  }, [serviceRows]);

  const directServicesTotal = useMemo(() => {
    return serviceRows
      .filter((s) => s.settlement_type === 'direct')
      .reduce((sum, s) => sum + (s.total_price || 0), 0);
  }, [serviceRows]);

  const finalAmount = useMemo(() => {
    return Math.max(0, totalCommodities + invoiceIncludedServicesTotal - discountTotal + taxAmount);
  }, [totalCommodities, invoiceIncludedServicesTotal, discountTotal, taxAmount]);

  const totalSettledAmount = useMemo(() => {
    return payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [payments]);

  const remainingCreditAmount = useMemo(() => {
    return Math.max(0, finalAmount - totalSettledAmount);
  }, [finalAmount, totalSettledAmount]);

  const totalBankFee = useMemo(() => {
    return payments.filter((p) => p.method === 'bank').reduce((sum, p) => sum + (p.bank_fee || 0), 0);
  }, [payments]);

  const partyBalanceInfo = useMemo(() => {
    const prevBalance = selectedPerson?.balance || 0;
    const prevDiag = getDiagnosis(prevBalance);

    let newBalance = prevBalance;
    if (invoiceType === 'sale') {
      newBalance = prevBalance + remainingCreditAmount;
    } else {
      newBalance = prevBalance - remainingCreditAmount;
    }
    const newDiag = getDiagnosis(newBalance);

    return {
      prevBalance,
      prevDiag,
      newBalance,
      newDiag,
    };
  }, [selectedPerson, invoiceType, remainingCreditAmount]);

  const handleAddPayment = (method: 'cash' | 'bank' | 'cheque') => {
    const newId = 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const defaultAmt = remainingCreditAmount > 0 ? remainingCreditAmount : 0;

    if (method === 'cash') {
      const defaultCash = cashAccounts[0] || allAccounts[0];
      setPayments((prev) => [
        ...prev,
        {
          id: newId,
          invoice_id: '',
          method: 'cash',
          account_id: defaultCash?.id || '',
          account_name: defaultCash?.name || 'صندوق',
          amount: defaultAmt,
        },
      ]);
    } else if (method === 'bank') {
      const defaultBank = bankAccounts[0] || allAccounts[0];
      setPayments((prev) => [
        ...prev,
        {
          id: newId,
          invoice_id: '',
          method: 'bank',
          account_id: defaultBank?.id || '',
          account_name: defaultBank?.name || 'بانک',
          amount: defaultAmt,
          bank_fee: 0,
          tracking_number: '',
        },
      ]);
    } else if (method === 'cheque') {
      setPayments((prev) => [
        ...prev,
        {
          id: newId,
          invoice_id: '',
          method: 'cheque',
          amount: defaultAmt,
          cheque_mode: 'new',
          cheque_number: '',
          cheque_bank: 'بانک ملی ایران',
          branch: '',
          account_number: '',
          sheba: '',
          row_number: '1',
          cheque_sayad: '',
          cheque_due_date: getCurrentShamsi().formatted,
          description: '',
          checkbook_id: '',
          checkbook_leaf_number: undefined,
        },
      ]);
    }
  };

  const handleRemovePayment = (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdatePayment = (id: string, updates: Partial<ExtendedPaymentItem>) => {
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        return { ...p, ...updates };
      })
    );
  };

  const handleTypeChange = async (newType: InvoiceType) => {
    if (isEditMode) return;
    setInvoiceType(newType);
    const num = await getNextInvoiceNumber(newType);
    setInvoiceNumber(num);

    setCommodityRows((prev) =>
      prev.map((row) => {
        const comm = commoditiesList.find((c) => c.id === row.commodity_id);
        if (!comm) return row;
        const newPrice = newType === 'sale' ? comm.sales_price || 0 : comm.purchase_price || 0;
        const q = parseFloat(String(row.quantity)) || 0;
        const newTot = Math.max(0, q * newPrice - row.discount);
        return { ...row, unit_price: newPrice, total_price: newTot };
      })
    );
    setServiceRows([]);
  };

  const handleAddCommodityRow = () => {
    if (commoditiesList.length === 0) {
      handleOpenQuickCommodity(null, '');
      return;
    }
    const defaultComm = commoditiesList[0];
    const defaultPrice = invoiceType === 'sale' ? defaultComm.sales_price || 0 : defaultComm.purchase_price || 0;
    setCommodityRows((prev) => [
      ...prev,
      {
        id: 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        commodity_id: defaultComm.id,
        commodity_name: defaultComm.name,
        commodity_code: defaultComm.code,
        unit: defaultComm.unit || 'عدد',
        quantity: 1,
        unit_price: defaultPrice,
        discount: 0,
        total_price: defaultPrice,
      },
    ]);
  };

  const handleRemoveCommodityRow = (id: string) => {
    if (commodityRows.length <= 1) {
      alert('حداقل یک ردیف کالا باید در فاکتور وجود داشته باشد.');
      return;
    }
    setCommodityRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleCommoditySelectInRow = (rowId: string, commodity: Commodity) => {
    const defaultPrice = invoiceType === 'sale' ? commodity.sales_price || 0 : commodity.purchase_price || 0;
    setCommodityRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const q = parseFloat(String(r.quantity)) || 0;
        const tot = Math.max(0, q * defaultPrice - r.discount);
        return {
          ...r,
          commodity_id: commodity.id,
          commodity_name: commodity.name,
          commodity_code: commodity.code,
          unit: commodity.unit || 'عدد',
          unit_price: defaultPrice,
          total_price: tot,
        };
      })
    );
  };

  const handleCommodityFieldChange = (
    rowId: string,
    field: 'quantity' | 'unit_price' | 'discount',
    value: number | string
  ) => {
    setCommodityRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const updated = { ...r, [field]: value };
        const q = parseFloat(String(updated.quantity)) || 0;
        const p = Number(updated.unit_price) || 0;
        const d = Number(updated.discount) || 0;
        const tot = Math.max(0, q * p - d);
        return { ...updated, total_price: tot };
      })
    );
  };

  const handleOpenQuickCommodity = (rowId: string | null, initialName: string) => {
    setQuickCommodityRowId(rowId);
    setQuickCommodityInitialName(initialName);
    setIsQuickCommodityOpen(true);
  };

  const handleQuickCommoditySaved = async () => {
    const updatedList = await getAllCommodities();
    setCommoditiesList(updatedList);
    if (onCommodityAdded) onCommodityAdded();

    if (updatedList.length > 0) {
      const newComm = updatedList[updatedList.length - 1];
      const defaultPrice = invoiceType === 'sale' ? newComm.sales_price || 0 : newComm.purchase_price || 0;

      if (quickCommodityRowId) {
        setCommodityRows((prev) =>
          prev.map((r) => {
            if (r.id !== quickCommodityRowId) return r;
            const q = parseFloat(String(r.quantity)) || 1;
            const tot = Math.max(0, q * defaultPrice - r.discount);
            return {
              ...r,
              commodity_id: newComm.id,
              commodity_name: newComm.name,
              commodity_code: newComm.code,
              unit: newComm.unit || 'عدد',
              unit_price: defaultPrice,
              total_price: tot,
            };
          })
        );
      } else {
        setCommodityRows((prev) => [
          ...prev,
          {
            id: 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
            commodity_id: newComm.id,
            commodity_name: newComm.name,
            commodity_code: newComm.code,
            unit: newComm.unit || 'عدد',
            quantity: 1,
            unit_price: defaultPrice,
            discount: 0,
            total_price: defaultPrice,
          },
        ]);
      }
    }

    setIsQuickCommodityOpen(false);
    setQuickCommodityRowId(null);
  };

  const handleAddServiceRow = () => {
    const defaultList = invoiceType === 'sale' ? revenueAccounts : expenseAccounts;
    const def = defaultList[0] || allServiceEligibleAccounts[0];
    const defaultBankAcc = allCashAndBankAccounts[0];
    setServiceRows((prev) => [
      ...prev,
      {
        id: 'srv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        account_id: def?.id || '',
        account_name: def?.name || 'سرفصل هزینه / درآمد',
        title: def?.name || '',
        quantity: 1,
        unit_price: 0,
        total_price: 0,
        settlement_type: 'invoice',
        paid_from_account_id: defaultBankAcc?.id || '',
      },
    ]);
  };

  const handleRemoveServiceRow = (id: string) => {
    setServiceRows((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!personId) {
      setErrorMsg('لطفاً طرف حساب فاکتور را انتخاب کنید.');
      return;
    }
    if (commodityRows.length === 0) {
      setErrorMsg('حداقل یک قلم کالا در فاکتور الزامی است.');
      return;
    }
    if (finalAmount <= 0) {
      setErrorMsg('مبلغ نهایی فاکتور باید بزرگتر از صفر باشد.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      if (isSale) {
        const itemQtyMap = new Map<string, number>();
        for (const row of commodityRows) {
          if (!row.commodity_id) continue;
          const qVal = parseFloat(String(row.quantity)) || 0;
          itemQtyMap.set(row.commodity_id, (itemQtyMap.get(row.commodity_id) || 0) + qVal);
        }
        for (const [commId, reqQty] of itemQtyMap.entries()) {
          const check = await getCommodityStockAtDate(
            commId,
            dateShamsi || getCurrentShamsi().formatted,
            isEditMode && invoiceToEdit ? invoiceToEdit.id : undefined,
            warehouseId || undefined
          );
          if (reqQty > check.maxAllowedExit) {
            setErrorMsg(
              `موجودی کالا در تاریخ انتخابی کافی نمی‌باشد. موجودی در دسترس در تاریخ ${toPersianDigits(dateShamsi || getCurrentShamsi().formatted)}: ${toPersianDigits(check.maxAllowedExit)} ${check.unit}.`
            );
            setIsSubmitting(false);
            return;
          }
        }
      }

      const targetWarehouse = allWarehouses.find((w) => w.id === warehouseId);
      const totalCash = payments.filter((p) => p.method === 'cash').reduce((s, p) => s + (p.amount || 0), 0);
      const totalBank = payments.filter((p) => p.method === 'bank').reduce((s, p) => s + (p.amount || 0), 0);
      const totalCheque = payments.filter((p) => p.method === 'cheque').reduce((s, p) => s + (p.amount || 0), 0);
      const firstCash = payments.find((p) => p.method === 'cash');
      const firstBank = payments.find((p) => p.method === 'bank');
      const firstCheque = payments.find((p) => p.method === 'cheque');

      let computedMethod: PaymentMethod = 'credit';
      if (payments.length === 0) {
        computedMethod = 'credit';
      } else if (payments.every((p) => p.method === 'cash')) {
        computedMethod = 'cash';
      } else if (payments.every((p) => p.method === 'bank')) {
        computedMethod = 'bank';
      } else if (payments.every((p) => p.method === 'cheque')) {
        computedMethod = 'cheque';
      } else {
        computedMethod = 'multi';
      }

      let formattedChequeDetails = '';
      if (firstCheque) {
        const parts = [];
        if (firstCheque.cheque_number) parts.push(`شماره: ${firstCheque.cheque_number}`);
        if (firstCheque.cheque_bank) parts.push(`بانک: ${firstCheque.cheque_bank}`);
        if (firstCheque.branch) parts.push(`شعبه: ${firstCheque.branch}`);
        if (firstCheque.account_number) parts.push(`حساب: ${firstCheque.account_number}`);
        if (firstCheque.sheba) parts.push(`شبا: ${firstCheque.sheba}`);
        if (firstCheque.cheque_sayad) parts.push(`صیاد: ${firstCheque.cheque_sayad}`);
        if (firstCheque.cheque_due_date) parts.push(`سررسید: ${firstCheque.cheque_due_date}`);
        formattedChequeDetails = parts.join(' | ');
      }

      const payload = {
        type: invoiceType,
        invoice_number: invoiceNumber,
        date_shamsi: dateShamsi || getCurrentShamsi().formatted,
        person_id: personId,
        person_name: personName,
        warehouse_id: warehouseId || undefined,
        warehouse_name: targetWarehouse?.name || undefined,
        items: commodityRows.map((r) => ({
          commodity_id: r.commodity_id,
          commodity_name: r.commodity_name,
          commodity_code: r.commodity_code,
          unit: r.unit,
          quantity: parseFloat(String(r.quantity)) || 0,
          unit_price: r.unit_price,
          discount: r.discount,
          total_price: r.total_price,
          description: r.description,
        })),
        services: serviceRows.map((s) => ({
          account_id: s.account_id,
          account_name: s.account_name,
          title: s.title,
          quantity: parseFloat(String(s.quantity)) || 0,
          unit_price: s.unit_price,
          total_price: s.total_price,
          settlement_type: s.settlement_type,
          paid_from_account_id: s.paid_from_account_id,
        })),
        discount_total: discountTotal,
        tax_amount: taxAmount,
        payment_method: computedMethod,
        cash_amount: totalCash,
        cash_account_id: firstCash?.account_id || cashAccountId,
        bank_amount: totalBank,
        bank_account_id: firstBank?.account_id || bankAccountId,
        bank_fee: totalBankFee,
        cheque_amount: totalCheque,
        cheque_details: formattedChequeDetails,
        cheque_number: firstCheque?.cheque_number || '',
        cheque_bank: firstCheque?.cheque_bank || '',
        cheque_sayad: firstCheque?.cheque_sayad || '',
        cheque_due_date: firstCheque?.cheque_due_date || '',
        credit_amount: remainingCreditAmount,
        description: description.trim(),
        payments: payments.map((p) => ({
          method: p.method,
          account_id: p.account_id,
          account_name: p.account_name,
          amount: p.amount,
          bank_fee: p.bank_fee || 0,
          tracking_number: p.tracking_number || '',
          cheque_id: p.cheque_id,
          cheque_number: p.cheque_number,
          cheque_bank: p.cheque_bank,
          cheque_due_date: p.cheque_due_date,
          cheque_sayad: p.cheque_sayad,
          cheque_mode: p.cheque_mode,
          checkbook_id: p.checkbook_id,
          checkbook_leaf_number: p.checkbook_leaf_number,
          description: p.description || (p.sheba ? `شبا: ${p.sheba} - شعبه: ${p.branch || ''}` : ''),
        })),
      };

      let result: Invoice;
      if (isEditMode && invoiceToEdit) {
        result = await updateInvoice(invoiceToEdit.id, payload);
      } else {
        result = await createInvoice(payload);
      }

      onSaved(result);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ثبت فاکتور');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSale = invoiceType === 'sale';

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in" dir="rtl">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-[98vw] xl:max-w-[96vw] 2xl:max-w-[1550px] h-[96vh] overflow-hidden flex flex-col">
          
          {/* ۱. نوار سربرگ */}
          <div className={`px-6 py-3.5 flex items-center justify-between text-white shrink-0 border-b ${
            isSale ? 'bg-gradient-to-r from-sky-700 to-sky-800' : 'bg-gradient-to-r from-slate-700 to-slate-800'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
                {isEditMode ? <Edit3 size={22} className="text-amber-300" /> : isSale ? <TrendingUp size={22} className="text-sky-200" /> : <TrendingDown size={22} className="text-slate-200" />}
              </div>
              <div>
                <h2 className="text-base font-extrabold flex items-center gap-2">
                  <span>
                    {isEditMode ? 'ویرایش فاکتور ' + (isSale ? 'فروش' : 'خرید') : isSale ? 'صدور فاکتور فروش کالا و خدمات' : 'ثبت فاکتور خرید کالا و خدمات'}
                  </span>
                  <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">
                    شماره {toPersianDigits(String(invoiceNumber))}
                  </span>
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!isEditMode && (
                <div className="bg-black/20 p-1 rounded-xl flex items-center gap-1 border border-white/10 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('sale')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      isSale ? 'bg-white text-sky-800 shadow-xs' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    فاکتور فروش
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('purchase')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      !isSale ? 'bg-white text-slate-800 shadow-xs' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    فاکتور خرید
                  </button>
                </div>
              )}

              <button
                onClick={onClose}
                className="text-white/70 hover:text-white p-1.5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* بدنه فرم فاکتور */}
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 flex-1 text-slate-800 text-xs">
            
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 font-bold flex items-center gap-2 shadow-xs">
                <AlertCircle size={18} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* ۲. مشخصات هدر فرم */}
            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">شماره فاکتور</label>
                  <input
                    type="text"
                    disabled
                    value={`شماره ${toPersianDigits(String(invoiceNumber))}`}
                    className="w-full h-10 bg-slate-200/60 text-slate-700 font-mono font-bold text-center px-3 py-2 rounded-xl border border-slate-300 cursor-not-allowed select-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    تاریخ فاکتور <span className="text-rose-500">*</span>
                  </label>
                  <ShamsiDateInput value={dateShamsi} onChange={setDateShamsi} />
                </div>

                <div>
                  <SearchablePersonSelect
                    label={isSale ? 'خریدار (مشتری)' : 'فروشنده (تأمین‌کننده)'}
                    required
                    persons={persons}
                    selectedPersonId={personId}
                    onSelect={(p) => {
                      setPersonId(p.id);
                      setPersonName(p.name);
                    }}
                    placeholder={isSale ? 'جستجو و انتخاب مشتری...' : 'جستجو و انتخاب تأمین‌کننده...'}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    انبار مربوطه <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                  >
                    {allWarehouses.length === 0 ? (
                      <option value="">انباری تعریف نشده است</option>
                    ) : (
                      allWarehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* ۳. جدول اقلام کالا */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Layers size={16} className={isSale ? 'text-sky-600' : 'text-slate-600'} />
                  <span>ردیف‌های اقلام کالا</span>
                </span>

                <button
                  type="button"
                  onClick={handleAddCommodityRow}
                  className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>افزودن ردیف کالا</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-center text-xs divide-y divide-slate-200 table-fixed">
                    <colgroup>
                      <col style={{ width: '48px' }} />
                      <col style={{ width: '32%' }} />
                      <col style={{ width: '100px' }} />
                      <col style={{ width: '80px' }} />
                      <col style={{ width: '150px' }} />
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '150px' }} />
                      <col style={{ width: '50px' }} />
                    </colgroup>
                    <thead className="bg-slate-100/90 font-bold text-slate-700 select-none">
                      <tr>
                        <th className="py-2.5 px-2 border-l border-slate-200">ردیف</th>
                        <th className="py-2.5 px-3 border-l border-slate-200 text-right">انتخاب و جستجوی کالا</th>
                        <th className="py-2.5 px-2 border-l border-slate-200">تعداد / وزن</th>
                        <th className="py-2.5 px-2 border-l border-slate-200">واحد</th>
                        <th className="py-2.5 px-3 border-l border-slate-200">قیمت واحد (ریال)</th>
                        <th className="py-2.5 px-3 border-l border-slate-200">تخفیف (ریال)</th>
                        <th className="py-2.5 px-3 border-l border-slate-200">مبلغ کل (ریال)</th>
                        <th className="py-2.5 px-2">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {commodityRows.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2 px-2 font-mono border-l border-slate-100">{toPersianDigits(String(idx + 1))}</td>
                          <td className="py-2 px-3 border-l border-slate-100 text-right">
                            <SearchableCommoditySelect
                              commodities={commoditiesList}
                              selectedId={row.commodity_id}
                              allowAll={false}
                              onSelect={(cId) => {
                                const found = commoditiesList.find((c) => c.id === cId);
                                if (found) handleCommoditySelectInRow(row.id, found);
                              }}
                              onAddNew={(searchedName) => handleOpenQuickCommodity(row.id, searchedName)}
                              placeholder="جستجو یا تعریف کالا..."
                            />
                          </td>
                          <td className="py-2 px-2 border-l border-slate-100">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={row.quantity ?? ''}
                              placeholder="۱"
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                let val = toEnglishDigits(e.target.value).replace(/[/،]/g, '.');
                                const parts = val.split('.');
                                if (parts.length > 2) {
                                  val = parts[0] + '.' + parts.slice(1).join('');
                                }
                                if (/^[0-9.]*$/.test(val)) {
                                  handleCommodityFieldChange(row.id, 'quantity', val);
                                }
                              }}
                              className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-2 text-center font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </td>
                          <td className="py-2 px-2 border-l border-slate-100 text-slate-500 font-semibold">{row.unit}</td>
                          <td className="py-2 px-3 border-l border-slate-100">
                            <input
                              type="text"
                              value={row.unit_price > 0 ? separateThousands(String(row.unit_price)) : ''}
                              placeholder="۰"
                              onFocus={(e) => e.target.select()}
                              onChange={(e) =>
                                handleCommodityFieldChange(row.id, 'unit_price', parseAmount(e.target.value))
                              }
                              className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-2 text-center font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </td>
                          <td className="py-2 px-3 border-l border-slate-100">
                            <input
                              type="text"
                              value={row.discount > 0 ? separateThousands(String(row.discount)) : ''}
                              placeholder="۰"
                              onFocus={(e) => e.target.select()}
                              onChange={(e) =>
                                handleCommodityFieldChange(row.id, 'discount', parseAmount(e.target.value))
                              }
                              className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-2 text-center font-mono text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900 border-l border-slate-100">
                            {separateThousands(String(Math.round(row.total_price)))}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveCommodityRow(row.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title="حذف ردیف"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ۴. بخش پیشرفته سرفصل‌های درآمد و هزینه */}
            <div className="space-y-2.5 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    {isSale
                      ? 'سرفصل‌های درآمد و هزینه‌های جانبی فروش (خدمات، کرایه، بسته‌بندی و...)'
                      : 'هزینه‌ها و خدمات جانبی خرید (کرایه راننده، باربری، باسکول، تخلیه و...)'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    امکان انتخاب نحوه تسویه (منظور در صورت‌حساب طرف‌حساب یا پرداخت/دریافت مستقیم از بانک و صندوق)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddServiceRow}
                  className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 transition-colors cursor-pointer shadow-2xs"
                >
                  <Plus size={14} className="text-sky-600" />
                  <span>افزودن سرفصل هزینه / درآمد</span>
                </button>
              </div>

              {serviceRows.length > 0 && (
                <div className="space-y-3 pt-2">
                  {serviceRows.map((sRow) => (
                    <div key={sRow.id} className="p-3.5 bg-white rounded-2xl border border-slate-300 shadow-xs space-y-2.5">
                      
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        <div className="sm:col-span-4">
                          <label className="block text-[10.5px] font-bold text-slate-600 mb-1">سرفصل حسابداری:</label>
                          <SearchableAccountSelect
                            accounts={allServiceEligibleAccounts}
                            selectedAccountId={sRow.account_id}
                            onSelect={(acc) => {
                              setServiceRows((prev) =>
                                prev.map((s) => s.id === sRow.id ? { ...s, account_id: acc.id, account_name: acc.name, title: acc.name } : s)
                              );
                            }}
                            placeholder="انتخاب سرفصل هزینه/درآمد..."
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[10.5px] font-bold text-slate-600 mb-1">شرح عنوان / بابت:</label>
                          <input
                            type="text"
                            value={sRow.title}
                            placeholder="مثلاً: کرایه راننده آقای فلانی، هزینه باسکول..."
                            onChange={(e) => setServiceRows((prev) => prev.map((s) => s.id === sRow.id ? { ...s, title: e.target.value } : s))}
                            className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 font-medium text-slate-800 text-xs focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[10.5px] font-bold text-slate-700 mb-1">نحوه تسویه این ردیف:</label>
                          <select
                            value={sRow.settlement_type}
                            onChange={(e) => {
                              const val = e.target.value as 'invoice' | 'direct';
                              setServiceRows((prev) =>
                                prev.map((s) => s.id === sRow.id ? { ...s, settlement_type: val } : s)
                              );
                            }}
                            className={`w-full h-10 border rounded-xl px-2.5 text-xs font-bold focus:outline-none ${
                              sRow.settlement_type === 'direct'
                                ? 'bg-amber-50 border-amber-300 text-amber-900'
                                : 'bg-sky-50 border-sky-300 text-sky-900'
                            }`}
                          >
                            <option value="invoice">
                              {isSale ? 'منظور به حساب مشتری (افزایش فاکتور)' : 'منظور به حساب فروشنده (افزایش فاکتور)'}
                            </option>
                            <option value="direct">
                              {isSale ? 'دریافت مستقیم (بدون تغییر مانده مشتری)' : 'پرداخت مستقیم به راننده/شخص ثالث (از بانک/صندوق)'}
                            </option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center pt-2 border-t border-slate-100">
                        
                        {sRow.settlement_type === 'direct' && (
                          <div className="sm:col-span-4">
                            <label className="block text-[10px] font-bold text-amber-800 mb-1">
                              {isSale ? 'واریز به حساب بانک / صندوق:' : 'پرداخت از حساب بانک / صندوق:'}
                            </label>
                            <select
                              value={sRow.paid_from_account_id || ''}
                              onChange={(e) => {
                                const bId = e.target.value;
                                setServiceRows((prev) =>
                                  prev.map((s) => s.id === sRow.id ? { ...s, paid_from_account_id: bId } : s)
                                );
                              }}
                              className="w-full h-9 bg-white border border-amber-300 rounded-xl px-2 text-xs font-bold text-slate-800"
                            >
                              {allCashAndBankAccounts.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name} {b.account_number ? `(${toPersianDigits(b.account_number)})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className={sRow.settlement_type === 'direct' ? 'sm:col-span-2' : 'sm:col-span-3'}>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">تعداد / دفعات:</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={sRow.quantity ?? ''}
                            placeholder="۱"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              let val = toEnglishDigits(e.target.value).replace(/[/،]/g, '.');
                              const parts = val.split('.');
                              if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                              if (/^[0-9.]*$/.test(val)) {
                                const q = parseFloat(val) || 0;
                                setServiceRows((prev) =>
                                  prev.map((s) => s.id === sRow.id ? { ...s, quantity: val, total_price: q * s.unit_price } : s));
                              }
                            }}
                            className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-2 font-mono font-bold text-center text-slate-800 text-xs focus:outline-none"
                          />
                        </div>

                        <div className={sRow.settlement_type === 'direct' ? 'sm:col-span-3' : 'sm:col-span-4'}>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">مبلغ واحد (ریال):</label>
                          <input
                            type="text"
                            value={sRow.unit_price > 0 ? separateThousands(String(sRow.unit_price)) : ''}
                            placeholder="۰"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const p = parseAmount(e.target.value);
                              const q = parseFloat(String(sRow.quantity)) || 0;
                              setServiceRows((prev) =>
                                prev.map((s) =>
                                  s.id === sRow.id ? { ...s, unit_price: p, total_price: q * p } : s));
                            }}
                            className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-2 font-mono font-bold text-center text-slate-800 text-xs focus:outline-none"
                          />
                        </div>

                        <div className={sRow.settlement_type === 'direct' ? 'sm:col-span-2' : 'sm:col-span-4'}>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">جمع کل (ریال):</label>
                          <div className="h-9 flex items-center justify-center font-mono font-black text-slate-900 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                            {separateThousands(String(Math.round(sRow.total_price)))}
                          </div>
                        </div>

                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveServiceRow(sRow.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
                            title="حذف ردیف"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ۵. جمع‌بندی مالی و ماژول تسویه */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                  <div>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <CreditCard size={15} className="text-sky-600" />
                      <span>{isSale ? 'روش‌های دریافت وجه و تسویه فاکتور' : 'روش‌های پرداخت وجه و تسویه فاکتور'}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddPayment('cash')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                    >
                      <Plus size={13} className="text-sky-600" />
                      <Wallet size={13} className="text-slate-600" />
                      <span>+ نقد</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddPayment('bank')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                    >
                      <Plus size={13} className="text-sky-600" />
                      <Building2 size={13} className="text-slate-600" />
                      <span>+ بانک / پوز</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddPayment('cheque')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                    >
                      <Plus size={13} className="text-sky-600" />
                      <FileText size={13} className="text-slate-600" />
                      <span>+ چک صیادی</span>
                    </button>
                  </div>
                </div>

                {payments.length === 0 ? (
                  <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-slate-800">
                      <Info size={14} className="text-sky-600 shrink-0" />
                      <span>فاکتور به صورت تمام نسیه ثبت می‌شود</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
                    {payments.map((p, idx) => (
                      <div key={p.id} className="p-3.5 rounded-2xl border bg-white border-slate-300 shadow-xs">
                        
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center font-mono">
                              {toPersianDigits(idx + 1)}
                            </span>
                            <span>{p.method === 'cash' ? 'پرداخت نقدی' : p.method === 'bank' ? 'واریز بانکی' : isSale ? 'چک صیادی دریافتی' : 'چک صیادی پرداختی'}</span>
                          </span>

                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                              {separateThousands(String(p.amount || 0))} ریال
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemovePayment(p.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {p.method === 'cash' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-1">صندوق:</label>
                              <select
                                value={p.account_id || ''}
                                onChange={(e) => {
                                  const acc = cashAccounts.find((a) => a.id === e.target.value);
                                  handleUpdatePayment(p.id, { account_id: e.target.value, account_name: acc?.name || 'صندوق' });
                                }}
                                className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-2.5 text-xs font-bold text-slate-800"
                              >
                                {cashAccounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-1">مبلغ (ریال):</label>
                              <input
                                type="text"
                                value={p.amount > 0 ? separateThousands(String(p.amount)) : ''}
                                placeholder="۰"
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleUpdatePayment(p.id, { amount: parseAmount(e.target.value) })}
                                className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-2.5 font-mono font-bold text-slate-900 text-xs"
                              />
                            </div>
                          </div>
                        )}

                        {p.method === 'bank' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-1">حساب بانک:</label>
                              <select
                                value={p.account_id || ''}
                                onChange={(e) => {
                                  const acc = bankAccounts.find((b) => b.id === e.target.value);
                                  handleUpdatePayment(p.id, { account_id: e.target.value, account_name: acc?.name || 'بانک' });
                                }}
                                className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-2.5 text-xs font-bold text-slate-800"
                              >
                                {bankAccounts.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-1">مبلغ واریزی (ریال):</label>
                              <input
                                type="text"
                                value={p.amount > 0 ? separateThousands(String(p.amount)) : ''}
                                placeholder="۰"
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleUpdatePayment(p.id, { amount: parseAmount(e.target.value) })}
                                className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-2.5 font-mono font-bold text-slate-900 text-xs"
                              />
                            </div>
                          </div>
                        )}

                        {p.method === 'cheque' && (
                          <div className="space-y-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                            <div>
                              <label className="block text-[10.5px] font-bold text-slate-700 mb-1">نام بانک صادرکننده:</label>
                              <select
                                value={p.cheque_bank || ''}
                                onChange={(e) => handleUpdatePayment(p.id, { cheque_bank: e.target.value })}
                                className="w-full h-9 bg-white border border-slate-300 rounded-xl px-2.5 text-xs font-bold text-slate-800 focus:outline-none"
                              >
                                <option value="">-- انتخاب بانک صادرکننده --</option>
                                {COMMON_IRANIAN_BANKS.map((bank) => (
                                  <option key={bank} value={bank}>{bank}</option>
                                ))}
                              </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10.5px] font-bold text-slate-700 mb-1">شعبه:</label>
                                <input
                                  type="text"
                                  value={p.branch || ''}
                                  placeholder="مثال: مرکزی، آزادی..."
                                  onChange={(e) => handleUpdatePayment(p.id, { branch: e.target.value })}
                                  className="w-full h-9 bg-white border border-slate-300 rounded-xl px-2.5 text-xs text-slate-800 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10.5px] font-bold text-slate-700 mb-1">شماره حساب صاحب چک:</label>
                                <input
                                  type="text"
                                  value={toPersianDigits(p.account_number || '')}
                                  placeholder="شماره حساب..."
                                  onChange={(e) => handleUpdatePayment(p.id, { account_number: toEnglishDigits(e.target.value) })}
                                  className="w-full h-9 bg-white border border-slate-300 rounded-xl px-2.5 font-mono text-xs text-slate-800 focus:outline-none text-left"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10.5px] font-bold text-slate-700 mb-1">شماره شبا (IBAN):</label>
                              <input
                                type="text"
                                maxLength={26}
                                value={p.sheba || ''}
                                placeholder="IR000000000000000000000000"
                                onChange={(e) => handleUpdatePayment(p.id, { sheba: e.target.value.toUpperCase() })}
                                className="w-full h-9 bg-white border border-slate-300 rounded-xl px-3 font-mono text-xs font-bold text-slate-800 text-left tracking-wider uppercase focus:outline-none"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              <div>
                                <label className="block text-[10.5px] font-bold text-slate-700 mb-1">تاریخ سررسید:</label>
                                <ShamsiDateInput
                                  value={p.cheque_due_date || getCurrentShamsi().formatted}
                                  onChange={(val) => handleUpdatePayment(p.id, { cheque_due_date: val })}
                                />
                              </div>
                              <div>
                                <label className="block text-[10.5px] font-bold text-slate-700 mb-1">شماره چک:</label>
                                <input
                                  type="text"
                                  value={toPersianDigits(p.cheque_number || '')}
                                  placeholder="مثال: ۱۲۳۴۵۶"
                                  onChange={(e) => handleUpdatePayment(p.id, { cheque_number: toEnglishDigits(e.target.value) })}
                                  className="w-full h-9 bg-white border border-slate-300 rounded-xl px-2.5 font-mono font-bold text-xs text-slate-800 text-center focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10.5px] font-bold text-slate-700 mb-1">ردیف چک:</label>
                                <input
                                  type="text"
                                  value={toPersianDigits(p.row_number || '1')}
                                  onChange={(e) => handleUpdatePayment(p.id, { row_number: toEnglishDigits(e.target.value) })}
                                  className="w-full h-9 bg-white border border-slate-300 rounded-xl px-2.5 font-mono text-xs text-slate-800 text-center focus:outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10.5px] font-bold text-slate-700 mb-1">شناسه صیادی (۱۶ رقم):</label>
                              <input
                                type="text"
                                maxLength={16}
                                value={toPersianDigits(p.cheque_sayad || '')}
                                placeholder="شناسه ۱۶ رقمی صیاد"
                                onChange={(e) => handleUpdatePayment(p.id, { cheque_sayad: toEnglishDigits(e.target.value) })}
                                className="w-full h-9 bg-white border border-slate-300 rounded-xl px-3 font-mono font-bold text-xs text-slate-800 text-center tracking-widest focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10.5px] font-bold text-slate-700 mb-1">مبلغ چک (ریال):</label>
                              <input
                                type="text"
                                value={p.amount > 0 ? separateThousands(String(p.amount)) : ''}
                                placeholder="مبلغ چک به ریال..."
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleUpdatePayment(p.id, { amount: parseAmount(e.target.value) })}
                                className="w-full h-9 bg-white border border-slate-300 rounded-xl px-3 font-mono font-black text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10.5px] font-bold text-slate-700 mb-1">توضیحات و بابت چک:</label>
                              <input
                                type="text"
                                value={p.description || ''}
                                placeholder="بابت فاکتور، قرارداد یا..."
                                onChange={(e) => handleUpdatePayment(p.id, { description: e.target.value })}
                                className="w-full h-9 bg-white border border-slate-300 rounded-xl px-3 text-xs text-slate-800 focus:outline-none"
                              />
                            </div>
                          </div>
                        )}

                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">توضیحات کلی فاکتور</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="یادداشت، توضیحات..."
                    className="w-full h-9 bg-white border border-slate-300 rounded-xl px-3 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              {/* کارت جمع‌بندی نهایی ۳ سطری */}
              <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-xs space-y-3">
                <span className="text-xs font-black text-slate-900 block pb-2 border-b border-slate-200">
                  خلاصه وضعیت مالی فاکتور و حساب طرف‌حساب
                </span>

                {/* سطر ۱: جمع کل صورت حساب */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-700">جمع کل صورت‌حساب:</span>
                  
                  <div className="flex items-center justify-end gap-2 shrink-0">
                    <span className="font-mono font-black text-sky-800 text-sm text-left w-36 shrink-0">
                      {separateThousands(String(Math.round(finalAmount)))}
                    </span>
                    <span className="text-[10.5px] font-sans font-normal text-slate-400 w-8 text-center shrink-0">
                      ریال
                    </span>
                    <div className="w-16 shrink-0" />
                  </div>
                </div>

                {/* سطر ۲: مانده قبلی طرف حساب */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-700">مانده قبلی طرف‌حساب:</span>
                  
                  <div className="flex items-center justify-end gap-2 shrink-0">
                    <span className="font-mono font-bold text-slate-800 text-sm text-left w-36 shrink-0">
                      {separateThousands(String(Math.round(Math.abs(partyBalanceInfo.prevBalance))))}
                    </span>
                    <span className="text-[10.5px] font-sans font-normal text-slate-400 w-8 text-center shrink-0">
                      ریال
                    </span>
                    <div className="w-16 flex justify-center shrink-0">
                      <span className={`${partyBalanceInfo.prevDiag.textClass} px-2 py-0.5 rounded font-bold text-center block w-full text-[11px]`}>
                        {partyBalanceInfo.prevDiag.label === 'بد' ? 'بدهکار' : partyBalanceInfo.prevDiag.label === 'بس' ? 'بستانکار' : 'بی‌حساب'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* سطر ۳: مانده نهایی پس از ثبت فاکتور */}
                <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-black text-slate-900">مانده نهایی پس از ثبت:</span>
                  
                  <div className="flex items-center justify-end gap-2 shrink-0">
                    <span className="font-mono font-black text-slate-950 text-base text-left w-36 shrink-0">
                      {separateThousands(String(Math.round(Math.abs(partyBalanceInfo.newBalance))))}
                    </span>
                    <span className="text-[10.5px] font-sans font-normal text-slate-400 w-8 text-center shrink-0">
                      ریال
                    </span>
                    <div className="w-16 flex justify-center shrink-0">
                      <span className={`${partyBalanceInfo.newDiag.textClass} px-2 py-0.5 rounded font-bold text-center block w-full text-[11px]`}>
                        {partyBalanceInfo.newDiag.label === 'بد' ? 'بدهکار' : partyBalanceInfo.newDiag.label === 'بس' ? 'بستانکار' : 'بی‌حساب'}
                      </span>
                    </div>
                  </div>
                </div>

                {directServicesTotal > 0 && (
                  <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between px-3">
                    <span>هزینه‌های جانبی پرداخت مستقیم (خارج از حساب فروشنده):</span>
                    <span className="font-mono font-bold text-amber-800">
                      {separateThousands(String(Math.round(directServicesTotal)))} ریال
                    </span>
                  </div>
                )}
              </div>

            </div>

            {/* دکمه‌های اقدام زیرین */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                انصراف
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex items-center gap-2 px-7 py-2 rounded-xl font-bold text-xs text-white shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                  isSale ? 'bg-sky-600 hover:bg-sky-700' : 'bg-slate-700 hover:bg-slate-800'
                }`}
              >
                <Save size={16} />
                <span>{isSubmitting ? 'در حال ثبت...' : isEditMode ? 'ذخیره تغییرات فاکتور' : isSale ? 'ثبت فاکتور فروش' : 'ثبت فاکتور خرید'}</span>
              </button>
            </div>

          </form>

        </div>
      </div>

      {/* مودال ایجاد سریع کالا بر روی مودال فاکتور */}
      {isQuickCommodityOpen && (
        <CommodityModal
          isOpen={isQuickCommodityOpen}
          onClose={() => {
            setIsQuickCommodityOpen(false);
            setQuickCommodityRowId(null);
          }}
          onSuccess={handleQuickCommoditySaved}
          commodityToEdit={null}
          groups={commodityGroups}
          warehouses={allWarehouses}
          defaultWarehouseId={warehouseId}
          initialName={quickCommodityInitialName}
        />
      )}
    </>
  );
};