import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Search,
  Trash2,
  Copy,
  ExternalLink,
  Code2,
  Check,
} from 'lucide-react';
import { ActivityLog } from '../../types';
import { api } from '../../lib/api';

interface Props {
  logs: ActivityLog[];
  onClearLogs: () => void;
  onInspectLog: (log: ActivityLog) => void;
}

export const ActivityView: React.FC<Props> = ({ logs, onClearLogs, onInspectLog }) => {
  const [filter, setFilter] = useState<'all' | 'success' | 'warning' | 'error'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredLogs = logs.filter((log) => {
    if (filter !== 'all' && log.type !== filter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      log.friendlyMessage.toLowerCase().includes(term) ||
      (log.targetName && log.targetName.toLowerCase().includes(term))
    );
  });

  const handleCopyDiagnostic = (log: ActivityLog) => {
    const text = `KING YAMPI DIAGNÓSTICO:
Ação: ${log.action}
Status: ${log.type}
Data/Hora: ${log.timeFormatted}
Mensagem: ${log.friendlyMessage}
Detalhes Técnicos: ${log.technicalDetails || 'Nenhum erro de rede reportado.'}`;

    navigator.clipboard.writeText(text);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header & Controls */}
      <div className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Histórico de Atividades & Auditoria ({logs.length})
          </h2>
          <p className="text-xs text-zinc-400">
            Registro transparente e compreensível de todas as chamadas e atualizações realizadas na Yampi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <button
              id="clear-activity-logs-btn"
              onClick={onClearLogs}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpar Registro
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="logs-search-input"
            type="text"
            placeholder="Buscar por ação ou mensagem..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          <button
            id="filter-logs-all-btn"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Todos ({logs.length})
          </button>

          <button
            id="filter-logs-success-btn"
            onClick={() => setFilter('success')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'success'
                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Sucessos
          </button>

          <button
            id="filter-logs-warning-btn"
            onClick={() => setFilter('warning')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'warning'
                ? 'bg-amber-950/60 text-amber-400 border border-amber-500/40'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Avisos
          </button>

          <button
            id="filter-logs-error-btn"
            onClick={() => setFilter('error')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'error'
                ? 'bg-red-950/60 text-red-400 border border-red-500/40'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Erros
          </button>
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-zinc-400 space-y-2">
            <Activity className="w-10 h-10 text-zinc-600 mx-auto" />
            <h3 className="font-bold text-white text-sm">Nenhum registro encontrado</h3>
            <p className="text-xs text-zinc-500">As operações realizadas na loja aparecerão aqui.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {filteredLogs.map((log) => {
              const Icon =
                log.type === 'success'
                  ? CheckCircle2
                  : log.type === 'error'
                  ? XCircle
                  : log.type === 'warning'
                  ? AlertTriangle
                  : Info;

              const colorClass =
                log.type === 'success'
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : log.type === 'error'
                  ? 'text-red-400 bg-red-500/10 border-red-500/20'
                  : log.type === 'warning'
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  : 'text-blue-400 bg-blue-500/10 border-blue-500/20';

              return (
                <div
                  key={log.id}
                  className="p-4 hover:bg-zinc-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2 rounded-xl border ${colorClass} flex-shrink-0 mt-0.5`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-white">{log.action}</span>
                        {log.targetName && (
                          <span className="text-[11px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded font-mono truncate max-w-xs">
                            {log.targetName}
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-500 font-mono">{log.timeFormatted}</span>
                      </div>

                      <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{log.friendlyMessage}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                    <button
                      id={`copy-log-${log.id}`}
                      onClick={() => handleCopyDiagnostic(log)}
                      title="Copiar Diagnóstico"
                      className="p-1.5 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-xs flex items-center gap-1"
                    >
                      {copiedId === log.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 text-[11px]">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[11px] hidden sm:inline">Copiar</span>
                        </>
                      )}
                    </button>

                    {log.technicalDetails && (
                      <button
                        id={`inspect-log-${log.id}`}
                        onClick={() => onInspectLog(log)}
                        className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Ver Detalhes Técnicos</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
