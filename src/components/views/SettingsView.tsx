import React, { useState } from 'react';
import {
  Settings,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Key,
  Lock,
  Store,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { ConnectionStatus } from '../../types';
import { api } from '../../lib/api';

interface Props {
  connectionStatus: ConnectionStatus | null;
  onRefreshConnection: () => void;
}

export const SettingsView: React.FC<Props> = ({ connectionStatus, onRefreshConnection }) => {
  const [alias, setAlias] = useState(connectionStatus?.configuredAlias || '');
  const [token, setToken] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionStatus | null>(connectionStatus);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alias.trim()) {
      setErrorMsg('O Alias da loja é obrigatório.');
      return;
    }
    if (!token.trim()) {
      setErrorMsg('O User-Token é obrigatório.');
      return;
    }
    if (!secretKey.trim()) {
      setErrorMsg('A User-Secret-Key é obrigatória.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await api.updateCredentials({
        alias: alias.trim(),
        token: token.trim(),
        secretKey: secretKey.trim(),
      });

      setTestResult(res);

      if (res.connected) {
        setSuccessMsg(
          `Conexão com a Yampi estabelecida com sucesso! Loja conectada: "${res.alias || alias}".`
        );
        onRefreshConnection();
      } else {
        setErrorMsg(res.message || 'Não foi possível autenticar na Yampi.');
      }
    } catch (err: any) {
      setErrorMsg(err?.friendlyMessage || 'Falha ao salvar credenciais.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="bg-zinc-900/80 p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            Configuração da Integração Yampi
          </h2>
          <p className="text-xs text-zinc-400">
            Conecte seu painel administrativo diretamente à API oficial da sua loja na Yampi.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Proteção Total: Chaves salvas no Backend</span>
        </div>
      </div>

      {/* Connection Status Box */}
      <div
        className={`p-5 rounded-2xl border transition-all ${
          testResult?.connected
            ? 'bg-emerald-950/30 border-emerald-500/40'
            : 'bg-red-950/20 border-red-500/30'
        }`}
      >
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                testResult?.connected
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
            >
              {testResult?.connected ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <XCircle className="w-6 h-6" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">
                {testResult?.connected ? '🟢 Yampi Conectada e Operando' : '🔴 Desconectado da Yampi'}
              </h3>
              <p className="text-xs text-zinc-300">
                {testResult?.connected
                  ? `Sua loja (${testResult.alias || alias}) está sincronizada e pronta para cadastros e consultas.`
                  : testResult?.message || 'Insira suas credenciais da API Yampi abaixo para sincronizar.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Messages */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs sm:text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Credentials Form */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="border-b border-zinc-800 pb-3">
          <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2 text-emerald-400">
            <Key className="w-4 h-4" /> Credenciais de Acesso à API Yampi
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Esses dados nunca são expostos no navegador. Toda a comunicação é feita através do servidor Node.js.
          </p>
        </div>

        <form onSubmit={handleSaveAndTest} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              Alias da Loja Yampi <span className="text-red-400">*</span>
            </label>
            <input
              id="settings-alias-input"
              type="text"
              required
              placeholder="Ex: minha-loja (subdomínio da sua loja na Yampi)"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden font-mono"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              O alias é o identificador único da sua loja (ex: na URL api.dooki.com.br/v2/<strong>alias</strong>).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              User Token <span className="text-red-400">*</span>
            </label>
            <input
              id="settings-token-input"
              type="password"
              required
              placeholder="••••••••••••••••••••••••••••••••"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              User Secret Key <span className="text-red-400">*</span>
            </label>
            <input
              id="settings-secret-input"
              type="password"
              required
              placeholder="••••••••••••••••••••••••••••••••"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden font-mono"
            />
          </div>

          <div className="pt-4 border-t border-zinc-800 flex justify-end">
            <button
              id="settings-save-test-btn"
              type="submit"
              disabled={isSaving}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>Testando Conexão com a Yampi...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-zinc-950" />
                  <span>TESTAR & SALVAR CONEXÃO</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Step by step tutorial for non-technical users */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-emerald-400" />
          Como obter suas credenciais na Yampi (Passo a Passo)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-zinc-300">
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5">
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px]">
              1
            </span>
            <h4 className="font-bold text-white">Acesse o Painel</h4>
            <p className="text-zinc-400">
              Faça login na sua loja Yampi em <strong>app.yampi.com.br</strong>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5">
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px]">
              2
            </span>
            <h4 className="font-bold text-white">Menu Desenvolvedores</h4>
            <p className="text-zinc-400">
              No menu lateral, vá em <strong>Configurações &gt; Desenvolvedores &gt; Chaves de API</strong>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5">
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px]">
              3
            </span>
            <h4 className="font-bold text-white">Copie e Cole</h4>
            <p className="text-zinc-400">
              Copie o <strong>Alias da Loja</strong>, <strong>User-Token</strong> e <strong>User-Secret-Key</strong> e cole acima.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
