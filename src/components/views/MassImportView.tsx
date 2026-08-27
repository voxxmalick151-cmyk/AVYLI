import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  Pause,
  RotateCcw,
  Download,
  ClipboardPaste,
  Layers,
  Sparkles,
  Info,
  Check,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { MassImportItem, YampiCategory, YampiProduct } from '../../types';
import { api } from '../../lib/api';

interface Props {
  categories: YampiCategory[];
  products: YampiProduct[];
  onRefreshCatalog: () => void;
}

export const MassImportView: React.FC<Props> = ({ categories, products, onRefreshCatalog }) => {
  const [items, setItems] = useState<MassImportItem[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'preview'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stats calculation
  const totalItems = items.length;
  const readyItems = items.filter((i) => i.status === 'ready').length;
  const warningItems = items.filter((i) => i.status === 'warning').length;
  const errorItems = items.filter((i) => i.status === 'error').length;

  const successCount = items.filter((i) => i.executionState === 'success').length;
  const failedCount = items.filter((i) => i.executionState === 'failed').length;
  const progressPercent = totalItems > 0 ? Math.round((successCount / totalItems) * 100) : 0;

  // Validate single row
  const validateRow = (
    raw: any,
    idx: number,
    existingSkus: Set<string>,
    existingNames: Set<string>
  ): MassImportItem => {
    const name = String(raw.Nome || raw.nome || raw.Name || raw.produto || '').trim();
    const categoryName = String(raw.Categoria || raw.categoria || raw.Category || '').trim();
    const subcategoryName = String(raw.Subcategoria || raw.subcategoria || raw.Subcategory || '').trim();
    const priceSale = parseFloat(String(raw.Preco || raw['Preço'] || raw.preco || raw.price || '0').replace(',', '.')) || 0;
    const priceDiscount = parseFloat(String(raw.PrecoPromo || raw['Preço Promo'] || raw.desconto || '0').replace(',', '.')) || 0;
    const priceCost = parseFloat(String(raw.PrecoCusto || raw['Preço Custo'] || raw.custo || '0').replace(',', '.')) || 0;
    const stock = parseInt(String(raw.Estoque || raw.estoque || raw.stock || '10'), 10) || 10;
    const sku = String(raw.SKU || raw.sku || raw.Codigo || '').trim();
    const imageUrl = String(raw.Imagem || raw.imagem || raw.Image || raw.url_imagem || '').trim();
    const description = String(raw.Descricao || raw['Descrição'] || raw.descricao || '').trim();
    const weight = parseFloat(String(raw.Peso || raw.peso || '0.3').replace(',', '.')) || 0.3;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field checks
    if (!name) {
      errors.push('Nome do produto ausente');
    }
    if (priceSale <= 0) {
      errors.push('Preço de venda inválido ou zero');
    }

    // Warnings
    if (imageUrl && !imageUrl.startsWith('http')) {
      warnings.push('URL da imagem parece inválida (deve começar com http/https)');
    }
    if (!categoryName) {
      warnings.push('Sem categoria (será cadastrado como sem categoria)');
    } else {
      const catExists = categories.some((c) => c.name.toLowerCase() === categoryName.toLowerCase());
      if (!catExists) {
        warnings.push(`Categoria "${categoryName}" não existe na Yampi (será criada automaticamente)`);
      }
    }

    // Duplicate check
    if (sku && existingSkus.has(sku.toLowerCase())) {
      warnings.push(`SKU "${sku}" pode já existir na loja`);
    }
    if (name && existingNames.has(name.toLowerCase())) {
      warnings.push('Possível produto já cadastrado com este nome');
    }

    let status: 'ready' | 'warning' | 'error' = 'ready';
    if (errors.length > 0) status = 'error';
    else if (warnings.length > 0) status = 'warning';

    return {
      id: `item_${idx}_${Date.now()}`,
      name,
      categoryName,
      subcategoryName,
      priceSale,
      priceDiscount: priceDiscount > 0 ? priceDiscount : undefined,
      priceCost: priceCost > 0 ? priceCost : undefined,
      stock,
      sku: sku || `SKU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      imageUrl,
      description,
      weight,
      status,
      warnings,
      errors,
      executionState: 'pending',
    };
  };

  const processRawData = (rows: any[]) => {
    const existingSkus = new Set<string>();
    const existingNames = new Set<string>();

    for (const p of products) {
      existingNames.add(p.name.toLowerCase());
      if (p.skus) {
        for (const s of p.skus) {
          if (s.sku) existingSkus.add(s.sku.toLowerCase());
        }
      }
    }

    const parsed: MassImportItem[] = rows
      .filter((r) => r && Object.values(r).some((v) => v !== '' && v !== null && v !== undefined))
      .map((row, idx) => validateRow(row, idx, existingSkus, existingNames));

    setItems(parsed);
    setActiveTab('preview');
  };

  // Handle CSV/XLSX File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop()?.toLowerCase();

    if (fileExt === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processRawData(results.data);
        },
      });
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        processRawData(data);
      };
      reader.readAsBinaryString(file);
    } else {
      alert('Formato de arquivo não suportado. Por favor, envie um arquivo .csv ou .xlsx');
    }
  };

  // Handle Text Paste parsing
  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;

    // Detect delimiter (Tab or Comma or Semicolon)
    Papa.parse(pasteText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length > 0) {
          processRawData(results.data);
        } else {
          alert('Não foi possível identificar colunas nos dados colados. Use cabeçalhos como: Nome, Categoria, Preco, Estoque, SKU');
        }
      },
    });
  };

  // Download Sample CSV
  const handleDownloadSample = () => {
    const sampleData = [
      {
        Nome: 'Camiseta Dry Fit Masculina',
        Categoria: 'Moda Masculina',
        Subcategoria: 'Camisetas',
        Preco: '79.90',
        PrecoPromo: '59.90',
        PrecoCusto: '25.00',
        Estoque: '50',
        SKU: 'CAM-DRY-01',
        Imagem: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500',
        Descricao: 'Camiseta de alta performance e respirabilidade para treinos.',
      },
      {
        Nome: 'Tênis Running Ultraleve',
        Categoria: 'Calçados',
        Subcategoria: 'Tênis',
        Preco: '249.90',
        PrecoPromo: '199.90',
        PrecoCusto: '90.00',
        Estoque: '20',
        SKU: 'TNS-RUN-01',
        Imagem: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500',
        Descricao: 'Amortecimento responsivo para corrida e caminhada.',
      },
      {
        Nome: 'Relógio Smartwatch Pro',
        Categoria: 'Acessórios',
        Subcategoria: 'Relógios',
        Preco: '189.00',
        PrecoPromo: '149.00',
        PrecoCusto: '60.00',
        Estoque: '15',
        SKU: 'REL-SMT-01',
        Imagem: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
        Descricao: 'Monitoramento cardíaco, notificações e bateria de longa duração.',
      },
    ];

    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_importacao_yampi.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Safe Sequential Queue Runner
  const startQueueProcessing = async (onlyFailed = false) => {
    setIsProcessing(true);
    setIsPaused(false);

    const itemsToProcess = items.filter((item) => {
      if (onlyFailed) return item.executionState === 'failed';
      return item.status !== 'error' && item.executionState !== 'success';
    });

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (onlyFailed && item.executionState !== 'failed') continue;
      if (!onlyFailed && (item.status === 'error' || item.executionState === 'success')) continue;

      setCurrentIndex(i + 1);

      // Update state to processing
      setItems((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, executionState: 'processing' } : it))
      );

      try {
        // Controlled rate-limit safety pause (300ms)
        await new Promise((resolve) => setTimeout(resolve, 300));

        const res = await api.importBatchItem(item);

        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  executionState: 'success',
                  createdProductId: res.productId,
                  executionMessage: `Cadastrado com sucesso (ID: #${res.productId})`,
                }
              : it
          )
        );
      } catch (err: any) {
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  executionState: 'failed',
                  executionMessage: err?.friendlyMessage || 'Falha ao cadastrar na Yampi',
                  technicalError: typeof err?.technicalError === 'object' ? JSON.stringify(err.technicalError) : err?.technicalError,
                }
              : it
          )
        );
      }
    }

    setIsProcessing(false);
    onRefreshCatalog();
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header Card */}
      <div className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-emerald-400" />
            Importação em Massa & Fila Segura
          </h2>
          <p className="text-xs text-zinc-400">
            Cadastre centenas de produtos via CSV, Planilha Excel ou Colagem com validação inteligente e processamento seguro.
          </p>
        </div>

        <button
          id="download-sample-csv-btn"
          onClick={handleDownloadSample}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors whitespace-nowrap"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          Baixar Modelo CSV Exemplo
        </button>
      </div>

      {/* Input Tabs: Upload / Paste / Preview */}
      <div className="flex items-center gap-2 bg-zinc-900/60 p-1.5 rounded-xl border border-zinc-800 w-fit">
        <button
          id="import-tab-file-btn"
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'upload' ? 'bg-emerald-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Arquivo CSV / Excel
        </button>

        <button
          id="import-tab-paste-btn"
          onClick={() => setActiveTab('paste')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'paste' ? 'bg-emerald-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <ClipboardPaste className="w-4 h-4" />
          Colar Dados
        </button>

        {items.length > 0 && (
          <button
            id="import-tab-preview-btn"
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'preview' ? 'bg-emerald-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            Prévia & Fila ({items.length})
          </button>
        )}
      </div>

      {/* TAB 1: FILE UPLOAD */}
      {activeTab === 'upload' && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 text-center space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-700 hover:border-emerald-500 bg-zinc-950/60 hover:bg-emerald-950/10 rounded-2xl p-12 transition-all cursor-pointer space-y-3 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Clique para selecionar seu arquivo CSV ou Excel</h3>
              <p className="text-xs text-zinc-400 mt-1">Suporta arquivos .CSV, .XLSX e .XLS</p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-500/30">
              Colunas automáticas: Nome, Categoria, Preço, Estoque, SKU, Imagem
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PASTE TEXT */}
      {activeTab === 'paste' && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-sm">Cole dados de uma planilha ou texto</h3>
              <p className="text-xs text-zinc-400">Copie linhas do Excel/Google Sheets e cole diretamente abaixo.</p>
            </div>
          </div>

          <textarea
            id="paste-data-textarea"
            rows={8}
            placeholder={`Nome\tCategoria\tSubcategoria\tPreco\tEstoque\tSKU\tImagem
Camiseta Masculina Dry\tModa Masculina\tCamisetas\t79.90\t30\tCAM-01\thttps://exemplo.com/foto.jpg
Tenis Running Esportivo\tCalcados\tTenis\t249.90\t15\tTNS-01\thttps://exemplo.com/tenis.jpg`}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            className="w-full p-4 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-hidden"
          />

          <div className="flex justify-end gap-2">
            <button
              id="parse-paste-data-btn"
              onClick={handlePasteSubmit}
              disabled={!pasteText.trim()}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              Analisar e Pré-visualizar Produtos
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: PREVIEW & PROCESSING QUEUE */}
      {activeTab === 'preview' && items.length > 0 && (
        <div className="space-y-4">
          {/* Diagnostic Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl">
              <span className="text-[11px] text-zinc-400 font-semibold block">Total Encontrado</span>
              <span className="text-2xl font-extrabold text-white">{totalItems} produtos</span>
            </div>

            <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl">
              <span className="text-[11px] text-emerald-400 font-semibold block flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Prontos para Cadastrar
              </span>
              <span className="text-2xl font-extrabold text-emerald-400">{readyItems}</span>
            </div>

            <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-xl">
              <span className="text-[11px] text-amber-400 font-semibold block flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Com Avisos
              </span>
              <span className="text-2xl font-extrabold text-amber-400">{warningItems}</span>
            </div>

            <div className="p-4 bg-red-950/20 border border-red-500/30 rounded-xl">
              <span className="text-[11px] text-red-400 font-semibold block flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> Com Erros
              </span>
              <span className="text-2xl font-extrabold text-red-400">{errorItems}</span>
            </div>
          </div>

          {/* Queue Progress Bar (if processing or completed) */}
          {(isProcessing || successCount > 0 || failedCount > 0) && (
            <div className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-2xl space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  ) : (
                    <Check className="w-4 h-4 text-emerald-400" />
                  )}
                  <span className="font-bold text-sm text-white">
                    {isProcessing ? 'Processando Fila com Segurança na Yampi...' : 'Processamento Concluído'}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {successCount} / {totalItems - errorItems} produtos cadastrados ({progressPercent}%)
                </span>
              </div>

              <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {failedCount > 0 && (
                <div className="flex items-center justify-between text-xs text-red-400 pt-1">
                  <span>{failedCount} itens falharam durante a requisição.</span>
                  <button
                    id="retry-failed-items-btn"
                    onClick={() => startQueueProcessing(true)}
                    disabled={isProcessing}
                    className="font-bold text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Tentar Novamente Somente os que Falharam
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800">
            <div className="text-xs text-zinc-400">
              A fila dispara requisições sequenciais protegendo sua conta Yampi contra limites de requisições.
            </div>

            <div className="flex items-center gap-2">
              <button
                id="clear-queue-btn"
                onClick={() => setItems([])}
                disabled={isProcessing}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                Limpar Lista
              </button>

              <button
                id="start-mass-import-btn"
                onClick={() => startQueueProcessing(false)}
                disabled={isProcessing || readyItems + warningItems === 0}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>Processando ({currentIndex}/{totalItems})...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 text-zinc-950 fill-zinc-950" />
                    <span>IMPORTAR {readyItems + warningItems} PRODUTOS</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Table Preview */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4 text-center">Fila</th>
                    <th className="py-3 px-4">Nome</th>
                    <th className="py-3 px-4">Categoria / Sub</th>
                    <th className="py-3 px-4">Preço</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Diagnóstico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {items.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-zinc-800/40 transition-colors ${
                        item.executionState === 'processing'
                          ? 'bg-emerald-950/20'
                          : item.executionState === 'failed'
                          ? 'bg-red-950/20'
                          : item.executionState === 'success'
                          ? 'bg-emerald-950/10'
                          : ''
                      }`}
                    >
                      {/* State Icon */}
                      <td className="py-3 px-4 text-center">
                        {item.executionState === 'success' && (
                          <span className="inline-flex items-center text-emerald-400 font-bold text-xs gap-1">
                            ✅ OK
                          </span>
                        )}
                        {item.executionState === 'processing' && (
                          <span className="inline-flex items-center text-amber-400 font-bold text-xs gap-1">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> ⏳
                          </span>
                        )}
                        {item.executionState === 'failed' && (
                          <span className="inline-flex items-center text-red-400 font-bold text-xs gap-1">
                            ❌ Falha
                          </span>
                        )}
                        {item.executionState === 'pending' && (
                          <span className="text-zinc-500 font-mono text-[11px]">#{idx + 1}</span>
                        )}
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4 font-semibold text-zinc-200">{item.name || '<Nome Ausente>'}</td>

                      {/* Category */}
                      <td className="py-3 px-4 text-zinc-300">
                        {item.categoryName ? (
                          <span>
                            {item.categoryName} {item.subcategoryName ? `→ ${item.subcategoryName}` : ''}
                          </span>
                        ) : (
                          <span className="text-zinc-500 italic">Sem categoria</span>
                        )}
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4 font-semibold text-emerald-400">
                        {item.priceSale ? `R$ ${item.priceSale.toFixed(2)}` : 'R$ 0.00'}
                      </td>

                      {/* SKU */}
                      <td className="py-3 px-4 font-mono text-zinc-400">{item.sku}</td>

                      {/* Diagnostic / Execution Message */}
                      <td className="py-3 px-4">
                        {item.executionMessage ? (
                          <span
                            className={`text-[11px] font-medium ${
                              item.executionState === 'success' ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {item.executionMessage}
                          </span>
                        ) : item.errors.length > 0 ? (
                          <span className="text-red-400 font-medium">{item.errors.join(', ')}</span>
                        ) : item.warnings.length > 0 ? (
                          <span className="text-amber-400 font-medium">{item.warnings[0]}</span>
                        ) : (
                          <span className="text-emerald-400 font-medium">Pronto para importar</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
