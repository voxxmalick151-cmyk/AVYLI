import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Copy, Check, X, Terminal } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  friendlyMessage: string;
  technicalDetails?: any;
}

export const TechnicalErrorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  title = 'Detalhes da Ocorrência',
  friendlyMessage,
  technicalDetails,
}) => {
  const [showTechnical, setShowTechnical] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const rawString = typeof technicalDetails === 'string'
    ? technicalDetails
    : JSON.stringify(technicalDetails, null, 2);

  const handleCopy = () => {
    if (rawString) {
      navigator.clipboard.writeText(rawString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        id="error-modal-container"
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden text-zinc-100 flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg text-zinc-100">{title}</h3>
          </div>
          <button
            id="close-error-modal-btn"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="bg-red-950/20 border border-red-500/30 rounded-lg p-4">
            <p className="text-sm font-medium text-red-200 leading-relaxed">
              {friendlyMessage}
            </p>
          </div>

          <div className="text-xs text-zinc-400">
            Esta mensagem foi traduzida automaticamente para facilitar o entendimento sem termos técnicos complexos.
          </div>

          {technicalDetails && (
            <div className="pt-2 border-t border-zinc-800">
              <button
                id="toggle-technical-details-btn"
                type="button"
                onClick={() => setShowTechnical(!showTechnical)}
                className="flex items-center justify-between w-full py-2 text-xs font-semibold text-zinc-400 hover:text-emerald-400 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  {showTechnical ? 'Ocultar detalhes técnicos' : 'Ver detalhes técnicos avançados'}
                </span>
                {showTechnical ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showTechnical && (
                <div className="mt-2 space-y-2">
                  <div className="flex justify-between items-center text-xs text-zinc-400">
                    <span>Resposta bruta da API:</span>
                    <button
                      id="copy-technical-details-btn"
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copiado' : 'Copiar JSON'}
                    </button>
                  </div>
                  <pre className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-emerald-400/90 overflow-x-auto max-h-56">
                    {rawString || 'Nenhum detalhe extra registrado.'}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-950/40 flex justify-end">
          <button
            id="error-modal-ok-btn"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
