import React from 'react';
import { Menu, RefreshCw, Sparkles, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { TabId } from './Sidebar';
import { ConnectionStatus } from '../types';

interface HeaderProps {
  currentTab: TabId;
  onOpenMobileSidebar: () => void;
  connectionStatus: ConnectionStatus | null;
  onSync: () => void;
  isSyncing: boolean;
  onSelectTab: (tab: TabId) => void;
}

const titles: Record<TabId, { title: string; desc: string }> = {
  dashboard: {
    title: 'Visão Geral do Catálogo',
    desc: 'Métricas, integridade do catálogo e atalhos rápidos de automação.',
  },
  products: {
    title: 'Gestão de Produtos & SKU',
    desc: 'Catálogo oficial Yampi, cadastro rápido e proteção contra duplicados.',
  },
  categories: {
    title: 'Categorias & Subcategorias',
    desc: 'Estrutura hierárquica oficial em até 2 níveis para sua loja.',
  },
  import: {
    title: 'Importação em Massa Inteligente',
    desc: 'Importe produtos via CSV, Planilha ou Tabela com fila segura e diagnósticos.',
  },
  ai: {
    title: 'Automação & IA Gemini',
    desc: 'Criação de taxonomia, categorização automática e gerador de copy/SEO.',
  },
  activity: {
    title: 'Histórico de Atividades & Auditoria',
    desc: 'Registro transparente de todas as operações e diagnósticos compreensíveis.',
  },
  settings: {
    title: 'Configurações & Integração Yampi',
    desc: 'Credenciais de API seguras, teste de conexão e status do sistema.',
  },
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobileSidebar,
  connectionStatus,
  onSync,
  isSyncing,
  onSelectTab,
}) => {
  const info = titles[currentTab] || { title: 'KING Yampi Manager', desc: 'Painel Administrativo' };

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#0A0A0A] border-b border-[#262626] px-4 sm:px-8 flex items-center justify-between">
      {/* Left side: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          id="mobile-sidebar-toggle-btn"
          onClick={onOpenMobileSidebar}
          className="p-2 -ml-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg md:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
            {info.title}
          </h1>
          <p className="text-[11px] text-gray-400 hidden sm:block font-medium">{info.desc}</p>
        </div>
      </div>

      {/* Right side: Connection Pill & Action Buttons */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Status Indicator */}
        <button
          id="header-status-pill-btn"
          onClick={() => onSelectTab('settings')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-[#262626]"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              connectionStatus?.connected
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
            }`}
          />
          <span
            className={`text-xs font-semibold ${
              connectionStatus?.connected ? 'text-emerald-500' : 'text-red-400'
            }`}
          >
            {connectionStatus?.connected ? 'Yampi: Conectado' : 'Yampi: Desconectado'}
          </span>
        </button>

        {/* Sync Button */}
        <button
          id="header-sync-btn"
          onClick={onSync}
          disabled={isSyncing}
          className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-3.5 sm:px-4 py-1.5 rounded-md text-xs uppercase tracking-wider transition-colors flex items-center gap-2 disabled:opacity-50 shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">SINCRONIZAR AGORA</span>
          <span className="sm:hidden">SINCRONIZAR</span>
        </button>

        {/* User / Org Avatar */}
        <div
          title="KING Yampi Manager"
          className="w-8 h-8 rounded-full bg-[#161616] border border-[#333333] flex items-center justify-center text-xs font-bold text-gray-300 select-none flex-shrink-0"
        >
          KY
        </div>
      </div>
    </header>
  );
};
