import React, { useState } from 'react';
import {
  Sparkles,
  FolderTree,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Layers,
  ArrowRight,
  Zap,
  Check,
  Tag,
  Package,
  Sliders,
  Send,
  Plus,
  X,
} from 'lucide-react';
import { YampiCategory, YampiProduct } from '../../types';
import { api } from '../../lib/api';

interface Props {
  categories: YampiCategory[];
  products: YampiProduct[];
  onRefreshCatalog: () => void;
}

export const AiToolsView: React.FC<Props> = ({ categories, products, onRefreshCatalog }) => {
  const [activeSubTab, setActiveSubTab] = useState<'categorize' | 'structure' | 'copywriter'>('categorize');

  // Tool 1: Organize / Categorize with AI
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [categorizeSuggestions, setCategorizeSuggestions] = useState<
    Array<{
      productId: number;
      productName: string;
      suggestedCategory: string;
      suggestedSubcategory?: string;
      confidence: number;
      reasoning: string;
      applied?: boolean;
    }>
  >([]);
  const [isApplyingCategorization, setIsApplyingCategorization] = useState(false);

  // Tool 2: Create Category Taxonomy / Structure
  const [nicheInput, setNicheInput] = useState('');
  const [isGeneratingTaxonomy, setIsGeneratingTaxonomy] = useState(false);
  const [generatedTaxonomy, setGeneratedTaxonomy] = useState<
    Array<{
      name: string;
      slug: string;
      subcategories: Array<{ name: string; slug: string }>;
      selected: boolean;
      created?: boolean;
    }>
  >([]);
  const [isCreatingTaxonomyInYampi, setIsCreatingTaxonomyInYampi] = useState(false);

  // Tool 3: Copywriter & SEO Generator
  const [copyForm, setCopyForm] = useState({
    name: '',
    category: '',
    price: '',
    features: '',
  });
  const [generatedCopy, setGeneratedCopy] = useState<{
    description: string;
    seoTitle: string;
    seoDescription: string;
    seoKeywords: string;
    searchTerms: string;
  } | null>(null);
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);

  // Run Auto-Categorization with Gemini
  const handleRunAutoCategorization = async () => {
    // Pick products without category, or first 20 products
    const uncat = products.filter(
      (p) => !p.category && (!p.categories_ids || p.categories_ids.length === 0) && (!p.categories || p.categories.length === 0)
    );
    const targetProducts = uncat.length > 0 ? uncat : products.slice(0, 20);

    if (targetProducts.length === 0) {
      alert('Nenhum produto cadastrado na loja para organizar.');
      return;
    }

    try {
      setIsCategorizing(true);
      const res = await api.categorizeBatchAi({
        products: targetProducts.map((p) => ({ id: p.id, name: p.name })),
        existingCategories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          parentId: c.parent_id || undefined,
        })),
      });

      setCategorizeSuggestions(
        res.suggestions.map((s) => ({
          ...s,
          applied: false,
        }))
      );
    } catch (err: any) {
      alert(err?.friendlyMessage || 'Erro ao organizar catálogo com IA.');
    } finally {
      setIsCategorizing(false);
    }
  };

  // Apply Categorization suggestions to Yampi sequentially
  const handleApplyCategorizations = async () => {
    try {
      setIsApplyingCategorization(true);

      for (let i = 0; i < categorizeSuggestions.length; i++) {
        const item = categorizeSuggestions[i];
        if (item.applied) continue;

        // Rate limit safe pause
        await new Promise((r) => setTimeout(r, 300));

        // 1. Find or create category
        let targetCat = categories.find(
          (c) => c.name.toLowerCase() === item.suggestedCategory.toLowerCase() && !c.parent_id
        );

        let catId = targetCat?.id;

        if (!catId) {
          const newCat = await api.createCategory({
            name: item.suggestedCategory,
            active: true,
          });
          catId = newCat.category.id;
        }

        // 2. Subcategory if exists
        let subcatId: number | undefined;
        if (item.suggestedSubcategory && catId) {
          let targetSub = categories.find(
            (c) => c.name.toLowerCase() === item.suggestedSubcategory!.toLowerCase() && c.parent_id === catId
          );
          if (!targetSub) {
            const newSub = await api.createCategory({
              name: item.suggestedSubcategory,
              parent_id: catId,
              active: true,
            });
            subcatId = newSub.category.id;
          } else {
            subcatId = targetSub.id;
          }
        }

        // 3. Update Product
        const finalCatId = subcatId || catId;
        if (finalCatId) {
          await api.updateProduct(item.productId, {
            category_id: finalCatId,
            categories_ids: subcatId ? [catId, subcatId] : [catId],
          });
        }

        // Mark as applied
        setCategorizeSuggestions((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, applied: true } : s))
        );
      }

      alert('Categorias aplicadas aos produtos com sucesso na Yampi!');
      onRefreshCatalog();
    } catch (err: any) {
      alert(err?.friendlyMessage || 'Erro ao aplicar categorias na Yampi.');
    } finally {
      setIsApplyingCategorization(false);
    }
  };

  // Generate Taxonomy Tree with Gemini
  const handleGenerateTaxonomy = async () => {
    if (!nicheInput.trim()) {
      alert('Por favor, digite o nicho da sua loja (ex: Moda Fitness, Decoração, Pet Shop)');
      return;
    }

    try {
      setIsGeneratingTaxonomy(true);
      const res = await api.generateTaxonomyAi({ niche: nicheInput.trim() });

      setGeneratedTaxonomy(
        res.categories.map((c) => ({
          ...c,
          selected: true,
          created: false,
          subcategories: c.subcategories.map((sub) => ({
            ...sub,
            selected: true,
          })),
        }))
      );
    } catch (err: any) {
      alert(err?.friendlyMessage || 'Erro ao gerar estrutura de categorias com IA.');
    } finally {
      setIsGeneratingTaxonomy(false);
    }
  };

  // Create Selected Taxonomy in Yampi using batch structure endpoint with duplicate checks
  const handleCreateTaxonomyInYampi = async () => {
    try {
      setIsCreatingTaxonomyInYampi(true);

      const structureToCreate = generatedTaxonomy
        .filter((c) => c.selected && c.name.trim())
        .map((c) => ({
          name: c.name.trim(),
          slug: c.slug?.trim() || undefined,
          selected: true,
          subcategories: (c.subcategories || [])
            .filter((sub: any) => (sub.selected !== false) && sub.name.trim())
            .map((sub: any) => ({
              name: sub.name.trim(),
              slug: sub.slug?.trim() || undefined,
              selected: true,
            })),
        }));

      if (structureToCreate.length === 0) {
        alert('Selecione ao menos uma categoria para cadastrar na Yampi.');
        return;
      }

      const res = await api.batchCreateCategoryStructure(structureToCreate);

      setGeneratedTaxonomy((prev) =>
        prev.map((t) => ({ ...t, created: t.selected }))
      );

      alert(res.message || 'Categorias sincronizadas com sucesso na Yampi!');
      onRefreshCatalog();
    } catch (err: any) {
      alert(err?.friendlyMessage || 'Erro ao cadastrar taxonomia na Yampi.');
    } finally {
      setIsCreatingTaxonomyInYampi(false);
    }
  };

  // Generate Copy & SEO with Gemini
  const handleGenerateCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copyForm.name.trim()) {
      alert('Informe ao menos o nome do produto.');
      return;
    }

    try {
      setIsGeneratingCopy(true);
      const res = await api.generateCopyAi({
        name: copyForm.name,
        category: copyForm.category || undefined,
        price: parseFloat(copyForm.price) || undefined,
        knownDetails: copyForm.features || undefined,
      });

      setGeneratedCopy(res);
    } catch (err: any) {
      alert(err?.friendlyMessage || 'Erro ao gerar copy com IA.');
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-950 p-6 rounded-2xl border border-emerald-500/30 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
              Automações & Inteligência Artificial Gemini
            </h2>
          </div>
          <p className="text-xs text-zinc-300 mt-1 max-w-2xl">
            Ferramentas inteligentes de auto-categorização de produtos, geração de arquitetura de categorias e redação de copywriting otimizado para e-commerce.
          </p>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 bg-zinc-900/70 p-1.5 rounded-xl border border-zinc-800 w-fit">
        <button
          id="ai-tab-categorize-btn"
          onClick={() => setActiveSubTab('categorize')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
            activeSubTab === 'categorize' ? 'bg-emerald-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          Auto-Categorizar Catálogo
        </button>

        <button
          id="ai-tab-structure-btn"
          onClick={() => setActiveSubTab('structure')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
            activeSubTab === 'structure' ? 'bg-emerald-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          Gerar Estrutura de Categorias
        </button>

        <button
          id="ai-tab-copywriter-btn"
          onClick={() => setActiveSubTab('copywriter')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
            activeSubTab === 'copywriter' ? 'bg-emerald-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          Gerador de Copy & SEO
        </button>
      </div>

      {/* TAB 1: AUTO CATEGORIZE */}
      {activeSubTab === 'categorize' && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                Organizar Produtos com IA
              </h3>
              <p className="text-xs text-zinc-400">
                A IA analisa o nome de cada produto e sugere a categoria e subcategoria ideal na Yampi com justificativa lógica.
              </p>
            </div>

            <button
              id="start-ai-categorization-btn"
              onClick={handleRunAutoCategorization}
              disabled={isCategorizing || products.length === 0}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${isCategorizing ? 'animate-spin' : ''}`} />
              <span>{isCategorizing ? 'Analisando Catálogo...' : 'Analisar Catálogo com IA'}</span>
            </button>
          </div>

          {categorizeSuggestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">
                  {categorizeSuggestions.length} sugestões de categorização geradas:
                </span>

                <button
                  id="apply-ai-categorization-btn"
                  onClick={handleApplyCategorizations}
                  disabled={isApplyingCategorization}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isApplyingCategorization
                      ? 'Aplicando na Yampi...'
                      : 'Aplicar Sugestões na Yampi'}
                  </span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-zinc-950 text-zinc-400 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-800">
                    <tr>
                      <th className="p-3">Produto</th>
                      <th className="p-3">Categoria Sugerida</th>
                      <th className="p-3">Subcategoria</th>
                      <th className="p-3">Confiança</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/40">
                    {categorizeSuggestions.map((s) => (
                      <tr key={s.productId} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="p-3 font-semibold text-zinc-100">{s.productName}</td>
                        <td className="p-3 font-medium text-emerald-400">{s.suggestedCategory}</td>
                        <td className="p-3 text-zinc-300">{s.suggestedSubcategory || '-'}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                            {Math.round(s.confidence * 100)}%
                          </span>
                        </td>
                        <td className="p-3">
                          {s.applied ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Aplicado na Yampi
                            </span>
                          ) : (
                            <span className="text-zinc-500">Pendente de confirmação</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GENERATE TAXONOMY */}
      {activeSubTab === 'structure' && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="space-y-2">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-emerald-400" />
              Gerar Árvore de Categorias por Nicho
            </h3>
            <p className="text-xs text-zinc-400">
              Informe o nicho da sua loja e a IA criará uma estrutura de categorias e subcategorias completa e otimizada para navegação e SEO.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="ai-niche-input"
              type="text"
              placeholder="Ex: Moda Fitness Feminina, Suplementos e Nutrição, Cosméticos Veganos..."
              value={nicheInput}
              onChange={(e) => setNicheInput(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
            />
            <button
              id="generate-taxonomy-btn"
              onClick={handleGenerateTaxonomy}
              disabled={isGeneratingTaxonomy || !nicheInput.trim()}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${isGeneratingTaxonomy ? 'animate-spin' : ''}`} />
              <span>{isGeneratingTaxonomy ? 'Gerando Estrutura...' : 'Gerar Árvore com IA'}</span>
            </button>
          </div>

          {generatedTaxonomy.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">
                  Estrutura gerada para "{nicheInput}":
                </span>

                <button
                  id="create-taxonomy-yampi-btn"
                  onClick={handleCreateTaxonomyInYampi}
                  disabled={isCreatingTaxonomyInYampi}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 text-zinc-950" />
                  <span>
                    {isCreatingTaxonomyInYampi
                      ? 'Cadastrando na Yampi...'
                      : 'Cadastrar Todas na Yampi'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generatedTaxonomy.map((cat, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border transition-all ${
                      cat.created
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : cat.selected
                        ? 'bg-zinc-950/70 border-zinc-800'
                        : 'bg-zinc-950/30 border-zinc-900 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="checkbox"
                          checked={cat.selected}
                          onChange={() => {
                            setGeneratedTaxonomy((prev) =>
                              prev.map((c, i) =>
                                i === idx
                                  ? {
                                      ...c,
                                      selected: !c.selected,
                                      subcategories: c.subcategories.map((sub: any) => ({
                                        ...sub,
                                        selected: !c.selected,
                                      })),
                                    }
                                  : c
                              )
                            );
                          }}
                          className="rounded accent-emerald-500 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={cat.name}
                          onChange={(e) => {
                            const newName = e.target.value;
                            setGeneratedTaxonomy((prev) =>
                              prev.map((c, i) => (i === idx ? { ...c, name: newName } : c))
                            );
                          }}
                          className="font-bold text-sm text-white bg-transparent border-b border-transparent focus:border-emerald-500 focus:outline-hidden"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {cat.created ? (
                          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Criada
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setGeneratedTaxonomy((prev) => prev.filter((_, i) => i !== idx));
                            }}
                            className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                            title="Excluir Categoria"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {cat.subcategories && cat.subcategories.length > 0 && (
                      <div className="pl-3 border-l-2 border-zinc-800 space-y-1.5 mt-2">
                        {cat.subcategories.map((sub: any, sIdx: number) => (
                          <div key={sIdx} className="text-xs text-zinc-300 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-1">
                              <input
                                type="checkbox"
                                checked={sub.selected !== false}
                                onChange={() => {
                                  setGeneratedTaxonomy((prev) =>
                                    prev.map((c, i) =>
                                      i === idx
                                        ? {
                                            ...c,
                                            subcategories: c.subcategories.map((s: any, si: number) =>
                                              si === sIdx ? { ...s, selected: !s.selected } : s
                                            ),
                                          }
                                        : c
                                    )
                                  );
                                }}
                                className="rounded accent-emerald-500 cursor-pointer"
                              />
                              <span>↳</span>
                              <input
                                type="text"
                                value={sub.name}
                                onChange={(e) => {
                                  const newName = e.target.value;
                                  setGeneratedTaxonomy((prev) =>
                                    prev.map((c, i) =>
                                      i === idx
                                        ? {
                                            ...c,
                                            subcategories: c.subcategories.map((s: any, si: number) =>
                                              si === sIdx ? { ...s, name: newName } : s
                                            ),
                                          }
                                        : c
                                    )
                                  );
                                }}
                                className="text-xs text-zinc-200 bg-transparent border-b border-transparent focus:border-emerald-500 focus:outline-hidden"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setGeneratedTaxonomy((prev) =>
                                  prev.map((c, i) =>
                                    i === idx
                                      ? {
                                          ...c,
                                          subcategories: c.subcategories.filter((_: any, si: number) => si !== sIdx),
                                        }
                                      : c
                                  )
                                );
                              }}
                              className="text-zinc-600 hover:text-red-400 p-0.5"
                              title="Remover Subcategoria"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: COPYWRITER & SEO GENERATOR */}
      {activeSubTab === 'copywriter' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              Dados do Produto para a IA
            </h3>

            <form onSubmit={handleGenerateCopy} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Nome do Produto <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Tênis Ortopédico Air Comfort"
                  value={copyForm.name}
                  onChange={(e) => setCopyForm({ ...copyForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Categoria</label>
                  <input
                    type="text"
                    placeholder="Ex: Calçados"
                    value={copyForm.category}
                    onChange={(e) => setCopyForm({ ...copyForm, category: e.target.value })}
                    className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Preço (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="199.90"
                    value={copyForm.price}
                    onChange={(e) => setCopyForm({ ...copyForm, price: e.target.value })}
                    className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Diferenciais / Características (opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: palmilha em gel, alívio de dores nas costas, solado antiderrapante, frete grátis..."
                  value={copyForm.features}
                  onChange={(e) => setCopyForm({ ...copyForm, features: e.target.value })}
                  className="w-full p-3 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-100"
                />
              </div>

              <button
                id="generate-copy-btn"
                type="submit"
                disabled={isGeneratingCopy}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${isGeneratingCopy ? 'animate-spin' : ''}`} />
                <span>{isGeneratingCopy ? 'Redigindo com IA...' : 'GERAR DESCRIÇÃO & SEO'}</span>
              </button>
            </form>
          </div>

          {/* Generated Result Preview */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl flex flex-col">
            <h3 className="font-bold text-white text-base">Resultado Gerado para E-commerce</h3>

            {generatedCopy ? (
              <div className="space-y-4 overflow-y-auto max-h-[500px] pr-1 text-xs">
                <div>
                  <span className="font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                    Descrição do Produto
                  </span>
                  <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-200 whitespace-pre-wrap leading-relaxed">
                    {generatedCopy.description}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <div>
                    <span className="font-semibold text-zinc-400 block">Título SEO (Meta Title):</span>
                    <span className="text-zinc-100 font-medium">{generatedCopy.seoTitle}</span>
                  </div>

                  <div>
                    <span className="font-semibold text-zinc-400 block">Descrição SEO:</span>
                    <span className="text-zinc-300">{generatedCopy.seoDescription}</span>
                  </div>

                  <div>
                    <span className="font-semibold text-zinc-400 block">Palavras-chave SEO:</span>
                    <span className="text-emerald-400 font-mono">{generatedCopy.seoKeywords}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500 space-y-2 border border-dashed border-zinc-800 rounded-xl">
                <Sparkles className="w-8 h-8 text-zinc-700" />
                <p className="text-xs">Preencha os dados do produto ao lado e clique em Gerar com IA.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
