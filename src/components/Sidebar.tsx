import React from 'react';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  UploadCloud,
  Sparkles,
  Activity,
  Settings,
  Crown,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import { ConnectionStatus } from '../types';

export type TabId = 'dashboard' | 'products' | 'categories' | 'import' | 'ai' | 'activity' | 'settings';

interface SidebarProps {
  currentTab: TabId;
  onSelectTab: (tab: TabId) => void;
  connectionStatus: ConnectionStatus | null;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onTestConnection: () => void;
  isTestingConnection: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  connectionStatus,
  isOpenMobile,
  onCloseMobile,
  onTestConnection,
  isTestingConnection,
}) => {
  const navItems = [
    { id: 'dashboard' as TabId, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products' as TabId, label: 'Produtos', icon: Package },
    { id: 'categories' as TabId, label: 'Categorias', icon: FolderTree },
    { id: 'import' as TabId, label: 'Importar', icon: UploadCloud },
    { id: 'ai' as TabId, label: 'IA & Automação', icon: Sparkles, badge: 'Smart' },
    { id: 'activity' as TabId, label: 'Atividade', icon: Activity },
    { id: 'settings' as TabId, label: 'Configurações', icon: Settings },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="app-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#141414] border-r border-[#262626] flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#262626]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.35)] text-black font-black text-xs flex-shrink-0">
              KY
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1 leading-none">
                KING <span className="text-emerald-500">Yampi</span>
              </h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mt-1">Catalog & AI</p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1.5 text-gray-400 hover:text-white md:hidden rounded-lg hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-xs'
                    : 'text-[#E0E0E0] hover:bg-white/5 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-emerald-400' : 'text-gray-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] uppercase font-mono font-bold tracking-widest px-1.5 py-0.5 rounded ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-[#262626] text-gray-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Connection Status Card */}
        <div className="p-4 border-t border-[#262626]">
          <div className="p-3 bg-[#1a1a1a] border border-[#262626] rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  {connectionStatus?.connected ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  )}
                </span>
                <span className="text-xs font-semibold text-white">
                  {connectionStatus?.connected ? 'Yampi Conectada' : 'Não Conectado'}
                </span>
              </div>
              <button
                id="sidebar-test-connection-btn"
                onClick={onTestConnection}
                disabled={isTestingConnection}
                title="Testar Conexão com a Yampi"
                className="p-1 text-gray-400 hover:text-emerald-400 hover:bg-[#262626] rounded transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>

            <div className="text-[11px] text-gray-400 truncate">
              {connectionStatus?.connected ? (
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                  Loja: {connectionStatus.alias || connectionStatus.configuredAlias || 'Pronta'}
                </span>
              ) : (
                <span
                  onClick={() => onSelectTab('settings')}
                  className="flex items-center gap-1.5 text-red-400 hover:underline cursor-pointer font-medium"
                >
                  <XCircle className="w-3 h-3 flex-shrink-0" />
                  Configurar Chaves
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
