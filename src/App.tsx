import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, TabId } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/views/DashboardView';
import { ProductsView } from './components/views/ProductsView';
import { CategoriesView } from './components/views/CategoriesView';
import { MassImportView } from './components/views/MassImportView';
import { AiToolsView } from './components/views/AiToolsView';
import { ActivityView } from './components/views/ActivityView';
import { SettingsView } from './components/views/SettingsView';
import { TechnicalErrorModal } from './components/TechnicalErrorModal';
import { ConnectionStatus, DashboardStats, YampiProduct, YampiCategory, ActivityLog } from './types';
import { api } from './lib/api';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabId>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Core Data States
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [products, setProducts] = useState<YampiProduct[]>([]);
  const [categories, setCategories] = useState<YampiCategory[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  // Loading States
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Modal States
  const [inspectLog, setInspectLog] = useState<ActivityLog | null>(null);
  const [initialShowQuickCreate, setInitialShowQuickCreate] = useState(false);

  // Fetch connection status
  const checkConnection = useCallback(async () => {
    try {
      setIsTestingConnection(true);
      const status = await api.testConnection();
      setConnectionStatus(status);
      return status;
    } catch {
      setConnectionStatus({ connected: false, message: 'Servidor indisponível' });
      return null;
    } finally {
      setIsTestingConnection(false);
    }
  }, []);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    try {
      const data = await api.getLogs();
      setLogs(data);
    } catch (e) {
      console.error('Failed to load activity logs', e);
    }
  }, []);

  // Fetch all catalog data
  const loadCatalogData = useCallback(async () => {
    try {
      setIsSyncing(true);

      const [prods, cats, dashStats, activityLogs] = await Promise.all([
        api.getProducts().catch(() => [] as YampiProduct[]),
        api.getCategories().catch(() => [] as YampiCategory[]),
        api.getStats().catch(() => null),
        api.getLogs().catch(() => [] as ActivityLog[]),
      ]);

      setProducts(prods);
      setCategories(cats);
      setStats(dashStats);
      setLogs(activityLogs);
    } catch (err) {
      console.error('Failed to sync catalog', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoadingInitial(true);
      const status = await checkConnection();
      if (status?.connected) {
        await loadCatalogData();
      } else {
        await fetchLogs();
      }
      setIsLoadingInitial(false);
    };

    init();
  }, [checkConnection, loadCatalogData, fetchLogs]);

  // Handle Quick Create button click from Dashboard
  const handleOpenQuickCreate = () => {
    setInitialShowQuickCreate(true);
    setCurrentTab('products');
  };

  // Handle New Category button click from Dashboard
  const handleOpenNewCategory = () => {
    setCurrentTab('categories');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E0E0E0] font-sans flex flex-col antialiased selection:bg-emerald-500 selection:text-black">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab !== 'products') setInitialShowQuickCreate(false);
          setCurrentTab(tab);
        }}
        connectionStatus={connectionStatus}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onTestConnection={checkConnection}
        isTestingConnection={isTestingConnection}
      />

      {/* Main Content Area */}
      <div className="md:pl-64 flex flex-col min-h-screen bg-[#0A0A0A]">
        <Header
          currentTab={currentTab}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          connectionStatus={connectionStatus}
          onSync={loadCatalogData}
          isSyncing={isSyncing}
          onSelectTab={setCurrentTab}
        />

        {/* Tab View Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              isLoading={isLoadingInitial || isSyncing}
              connectionStatus={connectionStatus}
              logs={logs}
              onSelectTab={(tab) => {
                if (tab !== 'products') setInitialShowQuickCreate(false);
                setCurrentTab(tab);
              }}
              onOpenQuickCreate={handleOpenQuickCreate}
              onOpenNewCategory={handleOpenNewCategory}
              onSync={loadCatalogData}
              isSyncing={isSyncing}
              onInspectLog={setInspectLog}
            />
          )}

          {currentTab === 'products' && (
            <ProductsView
              products={products}
              categories={categories}
              isLoading={isLoadingInitial || isSyncing}
              onRefresh={loadCatalogData}
              onSelectTab={setCurrentTab}
              initialShowQuickCreate={initialShowQuickCreate}
            />
          )}

          {currentTab === 'categories' && (
            <CategoriesView
              categories={categories}
              isLoading={isLoadingInitial || isSyncing}
              onRefresh={loadCatalogData}
              onSelectTab={setCurrentTab}
            />
          )}

          {currentTab === 'import' && (
            <MassImportView
              categories={categories}
              products={products}
              onRefreshCatalog={loadCatalogData}
            />
          )}

          {currentTab === 'ai' && (
            <AiToolsView
              categories={categories}
              products={products}
              onRefreshCatalog={loadCatalogData}
            />
          )}

          {currentTab === 'activity' && (
            <ActivityView
              logs={logs}
              onClearLogs={async () => {
                await api.clearLogs();
                setLogs([]);
              }}
              onInspectLog={setInspectLog}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              connectionStatus={connectionStatus}
              onRefreshConnection={async () => {
                await checkConnection();
                await loadCatalogData();
              }}
            />
          )}
        </main>

        {/* Sleek Footer */}
        <footer className="h-10 bg-[#111111] border-t border-[#222222] px-6 sm:px-8 flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest mt-auto">
          <span>© 2026 King Yampi Manager — Versão 1.0.4</span>
          <span className="hidden sm:inline">API Yampi REST v2 Segura</span>
        </footer>
      </div>

      {/* Technical Error & Diagnostic Modal */}
      {inspectLog && (
        <TechnicalErrorModal
          isOpen={Boolean(inspectLog)}
          onClose={() => setInspectLog(null)}
          title={`Diagnóstico: ${inspectLog.action}`}
          friendlyMessage={inspectLog.friendlyMessage}
          technicalError={inspectLog.technicalDetails}
          timestamp={inspectLog.timeFormatted}
        />
      )}
    </div>
  );
}
