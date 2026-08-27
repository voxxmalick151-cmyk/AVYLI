import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  Plus,
  Search,
  Sparkles,
  Folder,
  CornerDownRight,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Trash2,
  Check,
  CheckSquare,
  Square,
  Sliders,
  ArrowRight,
  Info,
  Terminal,
} from 'lucide-react';
import { YampiCategory } from '../../types';
import { api } from '../../lib/api';
import { TechnicalErrorModal } from '../TechnicalErrorModal';

interface Props {
  categories: YampiCategory[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectTab: (tab: any) => void;
}

interface AiPreviewSubcategory {
  id: string;
  name: string;
  selected: boolean;
}

interface AiPreviewCategory {
  id: string;
  name: string;
  selected: boolean;
  subcategories: AiPreviewSubcategory[];
}

export const CategoriesView: React.FC<Props> = ({
  categories,
  isLoading,
  onRefresh,
  onSelectTab,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<YampiCategory | null>(null);

  // Manual Create/Edit Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    parent_id: '' as string | number,
    active: true,
    featured: false,
    seo_title: '',
    seo_keywords: '',
    seo_description: '',
    order: 0,
  });

  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualFeedback, setManualFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // AI Generation State
  const [aiPrompt, setAiPrompt] = useState('Minha loja vende roupas masculinas e femininas, produtos para casa, eletrônicos e acessórios.');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<{ friendly: string; technical?: any } | null>(null);
  const [aiPreviewCategories, setAiPreviewCategories] = useState<AiPreviewCategory[]>([]);
  const [isCreatingInYampi, setIsCreatingInYampi] = useState(false);
  const [aiSuccessSummary, setAiSuccessSummary] = useState<string | null>(null);

  // Technical Error Modal State
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    friendlyMessage: string;
    technicalDetails?: any;
  }>({
    isOpen: false,
    title: '',
    friendlyMessage: '',
  });

  // On mount, ensure real categories from Yampi are refreshed
  useEffect(() => {
    onRefresh();
  }, []);

  // Separate Level 1 (Parents) and Level 2 (Subcategories)
  const parentCategories = categories.filter((c) => !c.parent_id);

  // Group subcategories by parent_id
  const subcategoriesByParent: Record<number, YampiCategory[]> = {};
  for (const c of categories) {
    if (c.parent_id) {
      if (!subcategoriesByParent[c.parent_id]) {
        subcategoriesByParent[c.parent_id] = [];
      }
      subcategoriesByParent[c.parent_id].push(c);
    }
  }

  // Filtered categories for UI list
  const filteredParents = parentCategories.filter((p) => {
    const matchesParent =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(p.id).includes(searchTerm);
    const subs = subcategoriesByParent[p.id] || [];
    const matchesSub = subs.some(
      (s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(s.id).includes(searchTerm)
    );
    return matchesParent || matchesSub;
  });

  // ==========================================
  // Manual Category Handlers
  // ==========================================
  const handleOpenCreateModal = (parentId?: number) => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      parent_id: parentId !== undefined ? parentId : '',
      active: true,
      featured: false,
      seo_title: '',
      seo_keywords: '',
      seo_description: '',
      order: 0,
    });
    setManualFeedback(null);
    setIsManualModalOpen(true);
  };

  const handleOpenEditModal = (cat: YampiCategory) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      slug: cat.slug || '',
      parent_id: cat.parent_id !== null && cat.parent_id !== undefined ? cat.parent_id : '',
      active: cat.active ?? true,
      featured: cat.featured ?? false,
      seo_title: cat.seo_title || '',
      seo_keywords: cat.seo_keywords || '',
      seo_description: cat.seo_description || '',
      order: cat.order || 0,
    });
    setManualFeedback(null);
    setIsManualModalOpen(true);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setManualFeedback({ type: 'error', text: 'O nome da categoria é obrigatório.' });
      return;
    }

    try {
      setIsSubmittingManual(true);
      setManualFeedback(null);

      const parentIdNum = formData.parent_id !== '' && formData.parent_id !== undefined ? Number(formData.parent_id) : null;

      if (editingCategory) {
        await api.updateCategory(editingCategory.id, {
          name: formData.name.trim(),
          slug: formData.slug.trim() || undefined,
          parent_id: parentIdNum,
          active: formData.active,
          featured: formData.featured,
          seo_title: formData.seo_title.trim() || undefined,
          seo_keywords: formData.seo_keywords.trim() || undefined,
          seo_description: formData.seo_description.trim() || undefined,
          order: Number(formData.order) || 0,
        });
        setManualFeedback({ type: 'success', text: `Categoria "${formData.name}" atualizada com sucesso!` });
      } else {
        await api.createCategory({
          name: formData.name.trim(),
          slug: formData.slug.trim() || undefined,
          parent_id: parentIdNum,
          active: formData.active,
          featured: formData.featured,
          seo_title: formData.seo_title.trim() || undefined,
          seo_keywords: formData.seo_keywords.trim() || undefined,
          seo_description: formData.seo_description.trim() || undefined,
          order: Number(formData.order) || 0,
        });
        setManualFeedback({ type: 'success', text: `Categoria "${formData.name}" cadastrada com sucesso na Yampi!` });
      }

      // Immediately refresh categories directly from Yampi API
      onRefresh();
      setTimeout(() => {
        setIsManualModalOpen(false);
      }, 1000);
    } catch (err: any) {
      const friendly = err?.friendlyMessage || 'Erro ao salvar categoria na Yampi.';
      setManualFeedback({ type: 'error', text: friendly });
      setErrorModal({
        isOpen: true,
        title: 'Falha no Cadastro de Categoria',
        friendlyMessage: friendly,
        technicalDetails: err?.technicalError || err?.message || err,
      });
    } finally {
      setIsSubmittingManual(false);
    }
  };

  // ==========================================
  // AI Category Structure Handlers
  // ==========================================
  const handleOpenAiModal = () => {
    setAiError(null);
    setAiSuccessSummary(null);
    setIsAiModalOpen(true);
  };

  const handleGenerateAiStructure = async () => {
    if (!aiPrompt.trim()) {
      setAiError({
        friendly: 'Por favor, descreva o nicho ou os tipos de produtos da sua loja.',
      });
      return;
    }

    try {
      setIsGeneratingAi(true);
      setAiError(null);
      setAiSuccessSummary(null);

      const res = await api.generateCategoryStructure(aiPrompt.trim());
      const suggestions = res.suggestions || [];

      if (suggestions.length === 0) {
        setAiError({
          friendly: 'A IA não retornou categorias para essa descrição. Tente detalhar mais os tipos de produtos.',
        });
        return;
      }

      // Transform into editable preview state
      const previewList: AiPreviewCategory[] = suggestions.map((s, idx) => ({
        id: `ai_cat_${Date.now()}_${idx}`,
        name: s.category.trim(),
        selected: true,
        subcategories: (s.subcategories || []).map((sub, sIdx) => ({
          id: `ai_sub_${Date.now()}_${idx}_${sIdx}`,
          name: typeof sub === 'string' ? sub.trim() : (sub as any).name || '',
          selected: true,
        })),
      }));

      setAiPreviewCategories(previewList);
    } catch (err: any) {
      const friendly =
        err?.friendlyMessage ||
        'Não foi possível gerar a estrutura com IA. Verifique se o Gemini está configurado no servidor.';
      setAiError({
        friendly,
        technical: err?.technicalError || err?.message || err,
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Check if a category already exists in Yampi
  const findExistingYampiCategory = (name: string, parentId: number | null) => {
    const clean = name.trim().toLowerCase();
    return categories.find((c) => (c.parent_id || null) === parentId && c.name.trim().toLowerCase() === clean);
  };

  // Preview item actions
  const handleToggleParentSelection = (catId: string) => {
    setAiPreviewCategories((prev) =>
      prev.map((c) => {
        if (c.id === catId) {
          const newSelected = !c.selected;
          return {
            ...c,
            selected: newSelected,
            subcategories: c.subcategories.map((s) => ({ ...s, selected: newSelected })),
          };
        }
        return c;
      })
    );
  };

  const handleToggleSubcategorySelection = (catId: string, subId: string) => {
    setAiPreviewCategories((prev) =>
      prev.map((c) => {
        if (c.id === catId) {
          return {
            ...c,
            subcategories: c.subcategories.map((s) => (s.id === subId ? { ...s, selected: !s.selected } : s)),
          };
        }
        return c;
      })
    );
  };

  const handleUpdateCategoryName = (catId: string, newName: string) => {
    setAiPreviewCategories((prev) =>
      prev.map((c) => (c.id === catId ? { ...c, name: newName } : c))
    );
  };

  const handleUpdateSubcategoryName = (catId: string, subId: string, newName: string) => {
    setAiPreviewCategories((prev) =>
      prev.map((c) => {
        if (c.id === catId) {
          return {
            ...c,
            subcategories: c.subcategories.map((s) => (s.id === subId ? { ...s, name: newName } : s)),
          };
        }
        return c;
      })
    );
  };

  const handleDeleteCategory = (catId: string) => {
    setAiPreviewCategories((prev) => prev.filter((c) => c.id !== catId));
  };

  const handleDeleteSubcategory = (catId: string, subId: string) => {
    setAiPreviewCategories((prev) =>
      prev.map((c) => {
        if (c.id === catId) {
          return {
            ...c,
            subcategories: c.subcategories.filter((s) => s.id !== subId),
          };
        }
        return c;
      })
    );
  };

  const handleAddManualParent = () => {
    const newId = `ai_cat_custom_${Date.now()}`;
    setAiPreviewCategories((prev) => [
      ...prev,
      {
        id: newId,
        name: 'Nova Categoria',
        selected: true,
        subcategories: [],
      },
    ]);
  };

  const handleAddManualSubcategory = (catId: string) => {
    const newSubId = `ai_sub_custom_${Date.now()}`;
    setAiPreviewCategories((prev) =>
      prev.map((c) => {
        if (c.id === catId) {
          return {
            ...c,
            subcategories: [
              ...c.subcategories,
              {
                id: newSubId,
                name: 'Nova Subcategoria',
                selected: true,
              },
            ],
          };
        }
        return c;
      })
    );
  };

  // Confirm and create selected categories in Yampi
  const handleConfirmCreateSelectedInYampi = async () => {
    const selectedStructure = aiPreviewCategories
      .filter((c) => c.selected && c.name.trim())
      .map((c) => ({
        name: c.name.trim(),
        selected: true,
        subcategories: c.subcategories
          .filter((s) => s.selected && s.name.trim())
          .map((s) => ({
            name: s.name.trim(),
            selected: true,
          })),
      }));

    if (selectedStructure.length === 0) {
      alert('Selecione ao menos uma categoria para criar na Yampi.');
      return;
    }

    try {
      setIsCreatingInYampi(true);
      setAiError(null);

      const result = await api.batchCreateCategoryStructure(selectedStructure);

      setAiSuccessSummary(result.message || 'Estrutura cadastrada com sucesso na Yampi!');

      // Force instant refresh of real categories from Yampi API
      onRefresh();

      // Close modal after brief confirmation display
      setTimeout(() => {
        setIsAiModalOpen(false);
        setAiPreviewCategories([]);
      }, 1500);
    } catch (err: any) {
      const friendly = err?.friendlyMessage || 'Erro ao sincronizar categorias na Yampi.';
      setAiError({
        friendly,
        technical: err?.technicalError || err?.message || err,
      });
      setErrorModal({
        isOpen: true,
        title: 'Falha na Criação em Lote',
        friendlyMessage: friendly,
        technicalDetails: err?.technicalError || err?.message || err,
      });
    } finally {
      setIsCreatingInYampi(false);
    }
  };

  // Counts of selected items in preview
  const selectedParentsCount = aiPreviewCategories.filter((c) => c.selected).length;
  const selectedSubsCount = aiPreviewCategories.reduce(
    (acc, c) => acc + (c.selected ? c.subcategories.filter((s) => s.selected).length : 0),
    0
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Banner & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">
              Estrutura de Categorias Yampi ({categories.length})
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Fonte de verdade oficial da Yampi. Suporta até 2 níveis (Categorias Principais e Subcategorias).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Sincronizar Categorias Button */}
          <button
            id="sync-categories-btn"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-all border border-zinc-700/60 disabled:opacity-50"
            title="Forçar nova consulta à API da Yampi"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Sincronizando...' : 'Sincronizar Categorias'}</span>
          </button>

          {/* Criar Estrutura com IA Button */}
          <button
            id="open-ai-structure-modal-btn"
            onClick={handleOpenAiModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all shadow-md"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Criar Estrutura com IA
          </button>

          {/* Nova Categoria Button */}
          <button
            id="open-create-category-btn"
            onClick={() => handleOpenCreateModal()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-4 h-4 text-zinc-950" />
            Nova Categoria
          </button>
        </div>
      </div>

      {/* Search & Statistics Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="categories-search-input"
            type="text"
            placeholder="Buscar por nome, slug ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span>
            <strong className="text-zinc-200">{parentCategories.length}</strong> categorias principais
          </span>
          <span>•</span>
          <span>
            <strong className="text-zinc-200">{categories.length - parentCategories.length}</strong> subcategorias
          </span>
        </div>
      </div>

      {/* Categories Tree List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-16 text-center text-zinc-400 space-y-3 bg-zinc-900/60 rounded-2xl border border-zinc-800">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mx-auto" />
            <p className="text-sm font-medium">Consultando categorias reais na API da Yampi...</p>
          </div>
        ) : filteredParents.length === 0 ? (
          <div className="py-16 text-center text-zinc-400 space-y-3 bg-zinc-900/60 rounded-2xl border border-zinc-800 px-4">
            <FolderTree className="w-12 h-12 text-zinc-600 mx-auto" />
            <h3 className="font-bold text-white text-base">Nenhuma categoria encontrada</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Você pode criar manualmente uma categoria ou gerar toda a estrutura do seu nicho com Inteligência Artificial.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => handleOpenCreateModal()}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs rounded-xl"
              >
                + Criar Categoria
              </button>
              <button
                onClick={handleOpenAiModal}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                Criar Estrutura com IA
              </button>
            </div>
          </div>
        ) : (
          filteredParents.map((parent) => {
            const subs = subcategoriesByParent[parent.id] || [];

            return (
              <div
                key={parent.id}
                id={`cat-card-${parent.id}`}
                className="bg-zinc-900/80 border border-zinc-800/90 rounded-2xl overflow-hidden shadow-lg hover:border-zinc-700 transition-all"
              >
                {/* Parent Row */}
                <div className="p-4 flex items-center justify-between gap-4 bg-zinc-950/40 border-b border-zinc-800/60">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Folder className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{parent.name}</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          Nível 1 (Principal)
                        </span>
                        {parent.featured && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Destaque
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-0.5 flex items-center gap-2">
                        <span>ID: #{parent.id}</span>
                        <span>•</span>
                        <span>/{parent.slug}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      id={`add-sub-cat-btn-${parent.id}`}
                      onClick={() => handleOpenCreateModal(parent.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 rounded-lg hover:bg-emerald-900/40 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Subcategoria</span>
                    </button>

                    <button
                      id={`edit-cat-btn-${parent.id}`}
                      onClick={() => handleOpenEditModal(parent)}
                      className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                      title="Editar Categoria"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Subcategories (Level 2) */}
                {subs.length > 0 ? (
                  <div className="p-3 bg-zinc-950/20 divide-y divide-zinc-800/40">
                    {subs.map((sub) => (
                      <div
                        key={sub.id}
                        id={`subcat-row-${sub.id}`}
                        className="py-2.5 px-4 flex items-center justify-between gap-4 hover:bg-zinc-800/30 rounded-xl transition-colors"
                      >
                        <div className="flex items-center gap-3 pl-4">
                          <CornerDownRight className="w-4 h-4 text-emerald-500/60" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs sm:text-sm text-zinc-200">{sub.name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 bg-zinc-800/80 text-zinc-400 rounded">
                                Subcategoria
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              ID: #{sub.id} • /{sub.slug}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            id={`edit-subcat-btn-${sub.id}`}
                            onClick={() => handleOpenEditModal(sub)}
                            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                            title="Editar Subcategoria"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-6 py-3 text-[11px] text-zinc-500 italic bg-zinc-950/10">
                    Nenhuma subcategoria vinculada. Clique em "+ Subcategoria" para adicionar um sub-nível.
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CRIAR ESTRUTURA COM IA (GEMINI) COM PRÉVIA, EDIÇÃO E VERIFICAÇÃO */}
      {/* ========================================================================= */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div
            id="ai-structure-modal-container"
            className="w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/80">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Criar Estrutura de Categorias com IA</h3>
                  <p className="text-xs text-zinc-400">
                    A IA gera uma prévia interativa para você revisar, editar e aprovar antes de enviar à Yampi.
                  </p>
                </div>
              </div>
              <button
                id="close-ai-modal-btn"
                onClick={() => setIsAiModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Step 1: Prompt Input */}
              <div className="space-y-3 bg-zinc-950/60 p-4 rounded-xl border border-zinc-800">
                <label className="block text-xs font-semibold text-zinc-300">
                  Descreva o que sua loja vende:
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <textarea
                    id="ai-structure-prompt-textarea"
                    rows={2}
                    placeholder="Ex: Minha loja vende roupas masculinas e femininas, produtos para casa, eletrônicos e acessórios."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden resize-none"
                  />
                  <button
                    id="trigger-ai-structure-gen-btn"
                    onClick={handleGenerateAiStructure}
                    disabled={isGeneratingAi || !aiPrompt.trim()}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 sm:self-stretch"
                  >
                    <Sparkles className={`w-4 h-4 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingAi ? 'Analisando...' : 'Analisar com IA'}</span>
                  </button>
                </div>
              </div>

              {/* Error feedback if Gemini fails or is not configured */}
              {aiError && (
                <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 text-xs text-red-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-red-400">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{aiError.friendly}</span>
                  </div>
                  {aiError.technical && (
                    <p className="text-[11px] text-zinc-400">
                      Caso necessite, configure a variável de ambiente <code className="text-emerald-400">GEMINI_API_KEY</code> no painel de configurações.
                    </p>
                  )}
                </div>
              )}

              {/* Success feedback */}
              {aiSuccessSummary && (
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="font-semibold">{aiSuccessSummary}</span>
                </div>
              )}

              {/* Step 2: Interactive Preview */}
              {aiPreviewCategories.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Prévia da Estrutura Sugerida</span>
                        <span className="text-[11px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold">
                          {selectedParentsCount} principais / {selectedSubsCount} subcategorias
                        </span>
                      </h4>
                      <p className="text-xs text-zinc-400">
                        Selecione, edite o nome, adicione ou exclua categorias antes de criar na Yampi.
                      </p>
                    </div>

                    <button
                      id="ai-add-parent-category-btn"
                      onClick={handleAddManualParent}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg border border-zinc-700 flex items-center gap-1.5 w-fit"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>+ Categoria Principal</span>
                    </button>
                  </div>

                  {/* Categories Cards */}
                  <div className="space-y-4">
                    {aiPreviewCategories.map((parentCat) => {
                      const existingInYampi = findExistingYampiCategory(parentCat.name, null);

                      return (
                        <div
                          key={parentCat.id}
                          className={`rounded-xl border transition-all ${
                            parentCat.selected
                              ? 'bg-zinc-950/70 border-zinc-800'
                              : 'bg-zinc-950/30 border-zinc-900 opacity-60'
                          }`}
                        >
                          {/* Parent Header */}
                          <div className="p-3.5 flex items-center justify-between gap-3 bg-zinc-900/60 border-b border-zinc-800/80 rounded-t-xl">
                            <div className="flex items-center gap-2.5 flex-1">
                              <button
                                type="button"
                                onClick={() => handleToggleParentSelection(parentCat.id)}
                                className="text-emerald-400 hover:text-emerald-300"
                              >
                                {parentCat.selected ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Square className="w-4 h-4 text-zinc-600" />
                                )}
                              </button>

                              <input
                                type="text"
                                value={parentCat.name}
                                onChange={(e) => handleUpdateCategoryName(parentCat.id, e.target.value)}
                                className="px-2.5 py-1 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg text-xs font-bold text-white flex-1 max-w-sm"
                                placeholder="Nome da Categoria Principal"
                              />

                              {existingInYampi ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-950/60 text-blue-400 border border-blue-500/30 rounded">
                                  Já existe na Yampi (#{existingInYampi.id}) — ID será reaproveitado
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 rounded">
                                  Nova categoria
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleAddManualSubcategory(parentCat.id)}
                                className="px-2 py-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/30 border border-emerald-500/20 rounded hover:bg-emerald-900/30 transition-colors flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Subcategoria</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(parentCat.id)}
                                className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
                                title="Excluir Categoria"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Subcategories List */}
                          <div className="p-3 space-y-2">
                            {parentCat.subcategories.length > 0 ? (
                              parentCat.subcategories.map((sub) => {
                                const existingSubInYampi = existingInYampi
                                  ? findExistingYampiCategory(sub.name, existingInYampi.id)
                                  : null;

                                return (
                                  <div
                                    key={sub.id}
                                    className="flex items-center justify-between gap-3 pl-6 pr-2 py-1.5 hover:bg-zinc-900/40 rounded-lg"
                                  >
                                    <div className="flex items-center gap-2 flex-1">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleSubcategorySelection(parentCat.id, sub.id)}
                                        className="text-emerald-400 hover:text-emerald-300"
                                      >
                                        {sub.selected ? (
                                          <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                                        ) : (
                                          <Square className="w-3.5 h-3.5 text-zinc-600" />
                                        )}
                                      </button>

                                      <CornerDownRight className="w-3.5 h-3.5 text-zinc-600" />

                                      <input
                                        type="text"
                                        value={sub.name}
                                        onChange={(e) =>
                                          handleUpdateSubcategoryName(parentCat.id, sub.id, e.target.value)
                                        }
                                        className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded text-xs text-zinc-200 flex-1 max-w-xs"
                                        placeholder="Nome da Subcategoria"
                                      />

                                      {existingSubInYampi ? (
                                        <span className="text-[10px] text-zinc-400 font-mono">
                                          (Já cadastrada #{existingSubInYampi.id})
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-emerald-500/80">
                                          (Nova subcategoria)
                                        </span>
                                      )}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSubcategory(parentCat.id, sub.id)}
                                      className="p-1 text-zinc-500 hover:text-red-400 rounded transition-colors"
                                      title="Excluir Subcategoria"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-[11px] text-zinc-500 italic pl-6 py-1">
                                Nenhuma subcategoria cadastrada. Clique em "+ Subcategoria" para adicionar.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl"
              >
                Fechar
              </button>

              {aiPreviewCategories.length > 0 && (
                <button
                  id="confirm-create-selected-categories-btn"
                  onClick={handleConfirmCreateSelectedInYampi}
                  disabled={isCreatingInYampi || selectedParentsCount === 0}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>
                    {isCreatingInYampi
                      ? 'CRIANDO NA YAMPI...'
                      : 'CRIAR CATEGORIAS SELECIONADAS NA YAMPI'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CRIAR / EDITAR CATEGORIA MANUAL */}
      {/* ========================================== */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div
            id="manual-category-modal"
            className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/80">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Folder className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">
                  {editingCategory ? `Editar Categoria: ${editingCategory.name}` : 'Cadastrar Nova Categoria'}
                </h3>
              </div>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="p-6 overflow-y-auto space-y-4">
              {manualFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    manualFeedback.type === 'success'
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                      : 'bg-red-950/40 border-red-500/40 text-red-200'
                  }`}
                >
                  {manualFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                  <span>{manualFeedback.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Nome da Categoria <span className="text-red-400">*</span>
                </label>
                <input
                  id="cat-name-input"
                  type="text"
                  required
                  placeholder="Ex: Roupas Femininas"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Categoria Pai (Hierarquia Yampi)
                </label>
                <select
                  id="cat-parent-select"
                  value={formData.parent_id}
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs sm:text-sm text-zinc-100 focus:outline-hidden"
                >
                  <option value="">Nenhuma (Criar como Categoria Principal - Nível 1)</option>
                  {parentCategories
                    .filter((p) => !editingCategory || p.id !== editingCategory.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Subcategoria - Nível 2)
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Selecione uma categoria acima caso queira cadastrar esta como subcategoria.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Slug / URL Personalizada</label>
                  <input
                    id="cat-slug-input"
                    type="text"
                    placeholder="Deixe em branco para automático"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Ordem de Exibição</label>
                  <input
                    id="cat-order-input"
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-100"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-zinc-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Otimização para Busca (SEO)</h4>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Título SEO</label>
                  <input
                    type="text"
                    placeholder="Título para o Google..."
                    value={formData.seo_title}
                    onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Descrição SEO</label>
                  <input
                    type="text"
                    placeholder="Meta description..."
                    value={formData.seo_description}
                    onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  id="cat-modal-submit-btn"
                  type="submit"
                  disabled={isSubmittingManual}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isSubmittingManual
                    ? 'Salvando na Yampi...'
                    : editingCategory
                    ? 'Atualizar Categoria'
                    : 'Cadastrar Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Technical Error Details Modal */}
      <TechnicalErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal((prev) => ({ ...prev, isOpen: false }))}
        title={errorModal.title}
        friendlyMessage={errorModal.friendlyMessage}
        technicalDetails={errorModal.technicalDetails}
      />
    </div>
  );
};
