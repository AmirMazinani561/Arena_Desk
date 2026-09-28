import { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import { DesktopSidebar } from './components/DesktopSidebar';
import { TopBar } from './components/TopBar';
import { HomeTab } from './components/HomeTab';
import { PendingTransactionsTab } from './components/PendingTransactionsTab';
import { AccountsTab } from './components/AccountsTab';
import { LedgerView } from './components/LedgerView';
import { ReportsTab } from './components/ReportsTab';
import { WarehousesTab } from './components/WarehousesTab';
import { ChequesTab } from './components/ChequesTab';
import { InvoicesTab } from './components/InvoicesTab';
import { ProductionTab } from './components/ProductionTab';
import { ReceivedChequeModal } from './components/ReceivedChequeModal';
import { IssuedChequeModal } from './components/IssuedChequeModal';
import { TransactionModal } from './components/TransactionModal';
import { AccountModal } from './components/AccountModal';
import { WalletSyncModal } from './components/WalletSyncModal';
import { BackupModal } from './components/BackupModal';
import { EquityTab } from './components/EquityTab';
import { PayrollTab } from './components/PayrollTab';
import { 
  getAllAccounts, 
  getRecentEntries, 
  getAllWarehouses,
  getAllCommodities,
  createDoubleEntryTransaction,
  deleteTransaction,
  updateTransaction,
  updateAccount,
  insertAccount,
  finalizeDraftTransaction
} from './db/sqlite';
import type { Account, JournalEntry, JournalItem, TransactionInput, Commodity, Warehouse } from './db/types';
import type { TabType } from './components/BottomTabBar';

function parseHash(): { tab: TabType; accountId: string | null } {
  const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#\/?/, '') : '';
  const validTabs: TabType[] = ['home', 'pending', 'accounts', 'ledger', 'reports', 'warehouses', 'cheques', 'invoices', 'production', 'equity', 'payroll'];
  if (!hash) {
    const saved = typeof window !== 'undefined' ? (localStorage.getItem('arena_desk_active_tab') as TabType) : null;
    const tab = saved && validTabs.includes(saved) ? saved : 'home';
    return { tab, accountId: null };
  }
  const [tabPart, queryPart] = hash.split('?');
  const tab: TabType = validTabs.includes(tabPart as TabType) ? (tabPart as TabType) : 'home';
  let accountId: string | null = null;
  if (queryPart) {
    const params = new URLSearchParams(queryPart);
    accountId = params.get('account') || null;
  }
  return { tab, accountId };
}

export function App() {
  const initialRoute = parseHash();
  const [activeTab, setActiveTab] = useState<TabType>(initialRoute.tab);
  const [selectedAccountForLedger, setSelectedAccountForLedger] = useState<string | null>(initialRoute.accountId);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentEntries, setRecentEntries] = useState<(JournalEntry & { items: JournalItem[] })[]>([]);
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<(JournalEntry & { items: JournalItem[] }) | null>(null);

  const [isReceivedChequeModalOpen, setIsReceivedChequeModalOpen] = useState(false);
  const [isIssuedChequeModalOpen, setIsIssuedChequeModalOpen] = useState(false);

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [warehousesCount, setWarehousesCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [searchHighlight, setSearchHighlight] = useState('');

  const navigate = useCallback((tab: TabType, accountId: string | null = null, pushState = true) => {
    setActiveTab(tab);
    setSelectedAccountForLedger(accountId);
    localStorage.setItem('arena_desk_active_tab', tab);

    let newHash = `#/${tab}`;
    if (tab === 'ledger' && accountId) {
      newHash += `?account=${encodeURIComponent(accountId)}`;
    }

    if (pushState) {
      if (window.location.hash !== newHash) {
        window.history.pushState({ tab, accountId }, '', newHash);
      }
    } else {
      window.history.replaceState({ tab, accountId }, '', newHash);
    }
  }, []);

  useEffect(() => {
    const handlePopState = (e?: Event) => {
      const popEvent = e as PopStateEvent | undefined;
      if (popEvent?.state && popEvent.state.tab) {
        setActiveTab(popEvent.state.tab);
        setSelectedAccountForLedger(popEvent.state.accountId || null);
        localStorage.setItem('arena_desk_active_tab', popEvent.state.tab);
      } else {
        const current = parseHash();
        setActiveTab(current.tab);
        setSelectedAccountForLedger(current.accountId);
        localStorage.setItem('arena_desk_active_tab', current.tab);
      }
    };

    window.addEventListener('popstate', handlePopState as EventListener);
    window.addEventListener('hashchange', handlePopState as EventListener);

    const current = parseHash();
    navigate(current.tab, current.accountId, false);

    return () => {
      window.removeEventListener('popstate', handlePopState as EventListener);
      window.removeEventListener('hashchange', handlePopState as EventListener);
    };
  }, [navigate]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [accs, entries, whs, comms] = await Promise.all([
        getAllAccounts(),
        getRecentEntries(),
        getAllWarehouses(),
        getAllCommodities(),
      ]);
      setAccounts(accs);
      setRecentEntries(entries);
      setWarehouses(whs);
      setWarehousesCount(whs.length);
      setCommodities(comms);
    } catch (err) {
      console.error('Failed to load local data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTransactionSubmit = async (tx: TransactionInput) => {
    if (tx.id) {
      await updateTransaction(tx.id, tx);
    } else {
      await createDoubleEntryTransaction(tx);
    }
    setTransactionToEdit(null);
    await loadData();
  };

  const handleOpenNewTransaction = () => {
    setTransactionToEdit(null);
    setIsTransactionModalOpen(true);
  };

  const handleEditTransaction = (entry: JournalEntry & { items: JournalItem[] }) => {
    setTransactionToEdit(entry);
    setIsTransactionModalOpen(true);
  };

  const handleDeleteTransaction = async (entryId: string) => {
    if (window.confirm('آیا از حذف این تراکنش اطمینان دارید؟ تمام مانده‌های حساب‌ها اصلاح خواهند شد.')) {
      await deleteTransaction(entryId);
      await loadData();
    }
  };

  const handleFinalizeDraftTransaction = async (entryId: string) => {
    await finalizeDraftTransaction(entryId);
    await loadData();
  };

  const [previousTab, setPreviousTab] = useState<TabType | null>(null);

  const handleSaveAccountFromModal = async (data: any) => {
    if (data.id) {
      await updateAccount(data.id, data);
    } else {
      await insertAccount(data);
    }
    await loadData();
  };

  const handleViewAccountLedger = (accountId: string) => {
    setPreviousTab(activeTab);
    navigate('ledger', accountId);
  };

  const handleClearAccountFilter = () => {
    if (previousTab === 'accounts') {
      const targetTab = previousTab;
      setPreviousTab(null);
      if (typeof window !== 'undefined' && window.history && window.history.length > 1 && window.history.state?.tab === 'ledger') {
        window.history.back();
      } else {
        navigate(targetTab, null);
      }
    } else if (previousTab) {
      const targetTab = previousTab;
      setPreviousTab(null);
      navigate(targetTab, null);
    } else {
      setSelectedAccountForLedger(null);
      navigate('ledger', null);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setPreviousTab(null);
    navigate(tab, null);
  };

  const draftEntriesCount = useMemo(() => recentEntries.filter(e => e.status === 'draft').length, [recentEntries]);

  const isSystemAccount = (a: Account) => (
    a.id === 'acc_inventory_default' ||
    a.id === 'acc_purchase_cost_default' ||
    a.id === 'acc_notes_receivable_default' ||
    a.id === 'acc_notes_payable_default' ||
    a.id === 'acc_sales_revenue_default' ||
    a.name.includes('موجودی کالا') ||
    a.name.includes('موجودی انبار') ||
    a.name.includes('اسناد دریافتنی') ||
    a.name.includes('اسناد پرداختنی') ||
    a.name.includes('انبار')
  );

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-100 text-slate-800 font-sans select-none dir-rtl">
      {/* سایدبار دسکتاپ */}
      <DesktopSidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        accountsCount={accounts.filter((a) => (a.type === 'asset' || a.type === 'person') && !isSystemAccount(a)).length}
        entriesCount={recentEntries.length}
        warehousesCount={warehousesCount}
        draftEntriesCount={draftEntriesCount}
      />

      {/* ناحیه محتوای اصلی دسکتاپ */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f8fafc]">
        <TopBar
          onRefresh={loadData}
          isLoading={isLoading}
          onNewTransaction={handleOpenNewTransaction}
          accounts={accounts}
          entries={recentEntries}
          onSelectAccount={handleViewAccountLedger}
          onSelectEntry={handleEditTransaction}
          onSearchChange={setSearchHighlight}
          onOpenSyncModal={() => setIsSyncModalOpen(true)}
          onOpenBackupModal={() => setIsBackupModalOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'home' && (
              <HomeTab
                accounts={accounts}
                recentEntries={recentEntries}
                onOpenNewTransaction={handleOpenNewTransaction}
                onGoToAccounts={() => handleTabChange('accounts')}
                onGoToLedger={() => {
                  setSelectedAccountForLedger(null);
                  handleTabChange('ledger');
                }}
                onViewAccountLedger={handleViewAccountLedger}
                onEditAccount={(acc) => {
                  setAccountToEdit(acc);
                  setIsAccountModalOpen(true);
                }}
                onEditTransaction={handleEditTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onFinalizeTransaction={handleFinalizeDraftTransaction}
                searchHighlight={searchHighlight}
              />
            )}

            {activeTab === 'pending' && (
              <PendingTransactionsTab
                entries={recentEntries}
                accounts={accounts}
                onRefresh={loadData}
                onEditTransaction={handleEditTransaction}
                onFinalizeTransaction={handleFinalizeDraftTransaction}
                onDeleteTransaction={handleDeleteTransaction}
              />
            )}

            {activeTab === 'accounts' && (
              <AccountsTab
                accounts={accounts}
                onRefresh={loadData}
                onViewAccountLedger={handleViewAccountLedger}
              />
            )}

            {activeTab === 'ledger' && (
              <LedgerView
                entries={recentEntries}
                selectedAccountId={selectedAccountForLedger}
                accounts={accounts}
                onClearAccountFilter={handleClearAccountFilter}
                onEditTransaction={handleEditTransaction}
                onRefresh={loadData}
                onFinalizeTransaction={handleFinalizeDraftTransaction}
              />
            )}

            {activeTab === 'warehouses' && (
              <WarehousesTab />
            )}

            {activeTab === 'production' && (
              <ProductionTab
                commodities={commodities}
                warehouses={warehouses}
                onRefreshCommodities={loadData}
              />
            )}

            {activeTab === 'cheques' && (
              <ChequesTab allAccounts={accounts} />
            )}

            {activeTab === 'invoices' && (
              <InvoicesTab
                allAccounts={accounts}
                allCommodities={commodities}
                allWarehouses={warehouses}
              />
            )}

            {activeTab === 'equity' && (
              <EquityTab />
            )}

            {activeTab === 'payroll' && (
              <PayrollTab />
            )}

            {activeTab === 'reports' && (
              <ReportsTab entries={recentEntries} />
            )}
          </div>
        </main>
      </div>

      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => {
          setIsTransactionModalOpen(false);
          setTransactionToEdit(null);
        }}
        allAccounts={accounts}
        transactionToEdit={transactionToEdit}
        onSubmit={handleTransactionSubmit}
        onOpenReceivedCheque={() => setIsReceivedChequeModalOpen(true)}
        onOpenIssuedCheque={() => setIsIssuedChequeModalOpen(true)}
      />

      <ReceivedChequeModal
        isOpen={isReceivedChequeModalOpen}
        onClose={() => setIsReceivedChequeModalOpen(false)}
        onSaved={loadData}
        allPersons={accounts.filter((a) => a.type === 'person')}
      />

      <IssuedChequeModal
        isOpen={isIssuedChequeModalOpen}
        onClose={() => setIsIssuedChequeModalOpen(false)}
        onSaved={loadData}
        allPersons={accounts.filter((a) => a.type === 'person')}
      />

      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => {
          setIsAccountModalOpen(false);
          setAccountToEdit(null);
        }}
        accountToEdit={accountToEdit}
        allAccounts={accounts}
        onSave={handleSaveAccountFromModal}
      />

      <WalletSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        accounts={accounts}
        entries={recentEntries}
        onRefreshData={loadData}
      />

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />
    </div>
  );
}

export default App;