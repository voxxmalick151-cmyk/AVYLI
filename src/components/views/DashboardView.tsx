import React from 'react';
import {
  Package,
  FolderTree,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Search,
  PlusCircle,
  UploadCloud,
  Sparkles,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { DashboardStats, ConnectionStatus, ActivityLog } from '../../types';
import { TabId } from '../Sidebar';

interface Props {
  stats: DashboardStats | null;
  isLoading: boolean;
  connectionStatus: ConnectionStatus | null;
  logs: ActivityLog[];
  onSelectTab: (tab: TabId) => void;
  onOpenQuickCreate: () => void;
  onOpenNewCategory: () => void;
  onSync: () => void;
  isSyncing: boolean;
  onInspectLog: (log: ActivityLog) => void;
}

export const DashboardView: React.FC<Props> = ({
  stats,
  isLoading,
  connectionStatus,
  logs,
  onSelectTab,
  onOpenQuickCreate,
  onOpenNewCategory,
  onSync,
  isSyncing,
  onInspectLog,
}) => {
  const isConnected = Boolean(connectionStatus?.connected);

  // Health metric calculation
  const total = stats?.totalProducts || 0;
  const completeProducts = total > 0
    ? Math.max(0, total - (stats?.productsWithoutCategory || 0) - (stats?.productsWithoutDescription || 0) - (stats?.productsWithoutImage || 0))
    : 0;
  const healthPercent = total > 0 ? Math.round((completeProducts / total) * 100) : 100;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Banner if disconnected */}
      {!isConnected && (
        <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-red-200 text-sm">Integração Yampi Desconectada</h3>
              <p className="text-xs text-gray-400">
                Configure seu Alias e chaves da API para carregar seu catálogo em tempo real.
              </p>
            </div>
          </div>
          <button
            id="dashboard-connect-btn"
            onClick={() => onSelectTab('settings')}
            className="px-4 py-2 text-xs font-bold rounded-md bg-red-500 hover:bg-red-600 text-white transition-all flex items-center justify-center gap-1.5 whitespace-nowrap uppercase tracking-wider"
          >
            Configurar Credenciais
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main 4-Column Sleek Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 1. Total Produtos */}
        <div className="bg-[#161616] border border-[#262626] p-5 rounded-xl">
          <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Total Produtos</div>
          <div className="text-3xl font-bold text-white">
            {isLoading ? '...' : (stats?.totalProducts ?? 0).toLocaleString('pt-BR')}
          </div>
          <div className="mt-2 text-emerald-500 text-xs font-medium flex items-center gap-1">
            <Package className="w-3 h-3" />
            <span>Sincronizado na Yampi</span>
          </div>
        </div>

        {/* 2. Categorias */}
        <div className="bg-[#161616] border border-[#262626] p-5 rounded-xl">
          <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Categorias</div>
          <div className="text-3xl font-bold text-white">
            {isLoading ? '...' : (stats?.totalCategories ?? 0)}
          </div>
          <div className="mt-2 text-gray-400 text-xs flex items-center gap-1">
            <FolderTree className="w-3 h-3" />
            <span>Até 2 níveis hierárquicos</span>
          </div>
        </div>

        {/* 3. Produtos Ativos */}
        <div className="bg-[#161616] border border-[#262626] p-5 rounded-xl">
          <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Produtos Ativos</div>
          <div className="text-3xl font-bold text-emerald-500">
            {isLoading ? '...' : (stats?.activeProducts ?? 0).toLocaleString('pt-BR')}
          </div>
          <div className="mt-2 text-gray-400 text-xs flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>{total > 0 ? `${Math.round(((stats?.activeProducts || 0) / total) * 100)}% do catálogo` : 'Pronto para venda'}</span>
          </div>
        </div>

        {/* 4. Ações Pendentes */}
        <div className={`bg-[#161616] border p-5 rounded-xl ${((stats?.productsWithoutCategory || 0) + (stats?.productsWithoutDescription || 0) + (stats?.productsWithoutImage || 0)) > 0 ? 'border-red-500/30' : 'border-[#262626]'}`}>
          <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Ações Pendentes</div>
          <div className={`text-3xl font-bold ${((stats?.productsWithoutCategory || 0) + (stats?.productsWithoutDescription || 0) + (stats?.productsWithoutImage || 0)) > 0 ? 'text-red-500' : 'text-emerald-400'}`}>
            {isLoading ? '...' : ((stats?.productsWithoutCategory || 0) + (stats?.productsWithoutDescription || 0) + (stats?.productsWithoutImage || 0))}
          </div>
          <div className="mt-2 text-gray-400 text-xs flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Itens sem SEO, Categoria ou Foto</span>
          </div>
        </div>
      </div>

      {/* 2-Column Main Bento: Left Actions & Table, Right AI & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Shortcuts */}
          <div className="bg-[#161616] border border-[#262626] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#262626] flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                Atalhos Rápidos
              </h3>
              <button
                id="dashboard-sync-top-btn"
                onClick={onSync}
                disabled={isSyncing}
                className="text-xs text-gray-400 hover:text-emerald-400 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sincronizar Catálogo</span>
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <button
                id="dashboard-quick-new-product-btn"
                onClick={onOpenQuickCreate}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-[#222] hover:bg-[#282828] border border-[#333] transition-all group cursor-pointer"
              >
                <div className="text-2xl group-hover:scale-110 transition-transform">➕</div>
                <span className="text-xs font-medium uppercase tracking-tight text-[#E0E0E0] group-hover:text-emerald-400">
                  Novo Produto
                </span>
              </button>

              <button
                id="dashboard-quick-new-cat-btn"
                onClick={onOpenNewCategory}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-[#222] hover:bg-[#282828] border border-[#333] transition-all group cursor-pointer"
              >
                <div className="text-2xl group-hover:scale-110 transition-transform">📂</div>
                <span className="text-xs font-medium uppercase tracking-tight text-[#E0E0E0] group-hover:text-emerald-400">
                  Nova Categoria
                </span>
              </button>

              <button
                id="dashboard-quick-import-btn"
                onClick={() => onSelectTab('import')}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-[#222] hover:bg-[#282828] border border-[#333] transition-all group cursor-pointer"
              >
                <div className="text-2xl group-hover:scale-110 transition-transform">📤</div>
                <span className="text-xs font-medium uppercase tracking-tight text-[#E0E0E0] group-hover:text-blue-400">
                  Importar CSV
                </span>
              </button>

              <button
                id="dashboard-quick-ai-btn"
                onClick={() => onSelectTab('ai')}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-[#222] hover:bg-[#282828] border border-[#333] transition-all group cursor-pointer"
              >
                <div className="text-2xl group-hover:scale-110 transition-transform">🤖</div>
                <span className="text-xs font-medium uppercase tracking-tight text-[#E0E0E0] group-hover:text-emerald-400">
                  IA Automação
                </span>
              </button>
            </div>
          </div>

          {/* Recent Activity Table */}
          <div className="bg-[#161616] border border-[#262626] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#262626] bg-[#1a1a1a] flex justify-between items-center">
              <h3 className="font-bold text-sm text-white">Atividade Recente</h3>
              <button
                id="dashboard-view-all-logs-btn"
                onClick={() => onSelectTab('activity')}
                className="text-xs text-gray-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
              >
                Ver tudo
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#0A0A0A] text-gray-500 text-[10px] uppercase tracking-widest border-b border-[#262626]">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Horário</th>
                    <th className="px-6 py-3 font-semibold">Evento</th>
                    <th className="px-6 py-3 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262626]">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-xs text-gray-500">
                        Nenhuma atividade registrada ainda nesta sessão.
                      </td>
                    </tr>
                  ) : (
                    logs.slice(0, 5).map((log) => (
                      <tr
                        key={log.id}
                        onClick={() => onInspectLog(log)}
                        className="hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-3 text-gray-400 font-mono text-xs whitespace-nowrap">
                          {log.timeFormatted}
                        </td>
                        <td className="px-6 py-3">
                          <span className="text-white font-medium">{log.action}: </span>
                          <span className="text-gray-300 text-xs">{log.friendlyMessage}</span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold tracking-wider ${
                              log.type === 'success'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : log.type === 'error'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : log.type === 'warning'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}
                          >
                            {log.type === 'success' ? 'SUCESSO' : log.type === 'error' ? 'ERRO' : log.type === 'warning' ? 'ALERTA' : 'INFO'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (Span 1) */}
        <div className="space-y-6">
          {/* AI Suggestion Card */}
          <div className="bg-emerald-600 rounded-xl p-6 text-black flex flex-col gap-4 shadow-[0_10px_30px_rgba(16,185,129,0.2)]">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              <h3 className="font-bold uppercase tracking-tight text-sm text-black">Sugestão da IA Gemini</h3>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed font-medium text-black/90">
              {stats?.productsWithoutCategory && stats.productsWithoutCategory > 0
                ? `Detectamos ${stats.productsWithoutCategory} produtos sem categoria associada. Utilize a IA para classificar e organizar seu catálogo automaticamente.`
                : 'Seu catálogo está bem estruturado. Você pode gerar títulos de alta conversão e descrições com SEO otimizado a qualquer momento.'}
            </p>
            <button
              id="dashboard-ai-banner-btn"
              onClick={() => onSelectTab('ai')}
              className="w-full bg-black text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-widest hover:bg-gray-900 transition-colors shadow-sm"
            >
              Abrir Automação IA
            </button>
          </div>

          {/* Store Diagnostics / Health Status Card */}
          <div className="bg-[#161616] border border-[#262626] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Status do Catálogo</h3>
              <span className="text-xs font-bold text-emerald-400 font-mono">{healthPercent}% Saúde</span>
            </div>

            <div className="space-y-3.5">
              {/* Sem Descrição */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-400">Sem descrição</span>
                  <span className="bg-[#262626] text-white px-2 py-0.5 rounded text-[10px] font-mono">
                    {stats?.productsWithoutDescription ?? 0}
                  </span>
                </div>
                <div className="w-full bg-[#262626] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${total > 0 ? Math.max(5, 100 - Math.round(((stats?.productsWithoutDescription || 0) / total) * 100)) : 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Sem SEO */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-400">Sem tags de SEO</span>
                  <span className="bg-[#262626] text-white px-2 py-0.5 rounded text-[10px] font-mono">
                    {stats?.productsWithoutSeo ?? 0}
                  </span>
                </div>
                <div className="w-full bg-[#262626] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${total > 0 ? Math.max(5, 100 - Math.round(((stats?.productsWithoutSeo || 0) / total) * 100)) : 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Sem Imagem */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-400">Sem imagem</span>
                  <span className="bg-[#262626] text-white px-2 py-0.5 rounded text-[10px] font-mono">
                    {stats?.productsWithoutImage ?? 0}
                  </span>
                </div>
                <div className="w-full bg-[#262626] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${total > 0 ? Math.max(5, 100 - Math.round(((stats?.productsWithoutImage || 0) / total) * 100)) : 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
