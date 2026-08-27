import React, { useState } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Image as ImageIcon,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Eye,
  Layers,
  ArrowLeft,
  X,
  PlusCircle,
  Tag,
  DollarSign,
  Box,
  Truck,
  UploadCloud,
} from 'lucide-react';
import { YampiProduct, YampiCategory, QuickProductPayload, DuplicateCheckResult, YampiSku, UploadedImage } from '../../types';
import { api } from '../../lib/api';
import { ImageUploadZone } from '../ImageUploadZone';

interface Props {
  products: YampiProduct[];
  categories: YampiCategory[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectTab: (tab: any) => void;
  initialShowQuickCreate?: boolean;
}

export const ProductsView: React.FC<Props> = ({
  products,
  categories,
  isLoading,
  onRefresh,
  onSelectTab,
  initialShowQuickCreate = false,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'quick-create'>(
    initialShowQuickCreate ? 'quick-create' : 'list'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'no-category' | 'no-image' | 'no-description'>('all');
  const [selectedProduct, setSelectedProduct] = useState<YampiProduct | null>(null);

  // Quick Create Form State
  const [quickForm, setQuickForm] = useState<QuickProductPayload>({
    name: '',
    categoryName: '',
    subcategoryName: '',
    priceSale: 0,
    priceDiscount: 0,
    priceCost: 0,
    stock: 10,
    sku: '',
    description: '',
    imageUrl: '',
    images: [],
    weight: 0.3,
    height: 10,
    width: 15,
    length: 20,
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
    searchTerms: '',
  });

  const [quickUploadedImages, setQuickUploadedImages] = useState<UploadedImage[]>([]);

  // Existing Product Photo Upload State
  const [photoUploadProduct, setPhotoUploadProduct] = useState<YampiProduct | null>(null);
  const [photoUploadImages, setPhotoUploadImages] = useState<UploadedImage[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Duplicate Check Modal State
  const [duplicateModal, setDuplicateModal] = useState<{
    isOpen: boolean;
    result: DuplicateCheckResult | null;
  }>({ isOpen: false, result: null });

  // New SKU modal for existing product
  const [newSkuModalProduct, setNewSkuModalProduct] = useState<YampiProduct | null>(null);
  const [newSkuForm, setNewSkuForm] = useState({
    sku: '',
    title: '',
    price_sale: 0,
    price_discount: 0,
    price_cost: 0,
    stock: 10,
  });
  const [isCreatingSku, setIsCreatingSku] = useState(false);

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.skus && p.skus.some((s) => s.sku.toLowerCase().includes(searchTerm.toLowerCase())));

    if (!matchesSearch) return false;

    if (filterType === 'active') return p.active;
    if (filterType === 'no-category') {
      const hasCat = Boolean(p.category || (p.categories_ids && p.categories_ids.length > 0) || (p.categories && p.categories.length > 0));
      return !hasCat;
    }
    if (filterType === 'no-image') {
      const hasImg = Boolean(p.images && p.images.length > 0) || (p.skus && p.skus.some((s) => s.images && s.images.length > 0));
      return !hasImg;
    }
    if (filterType === 'no-description') {
      return !p.description || p.description.trim().length === 0;
    }
    return true;
  });

  // AI Description Generator for Quick Form
  const handleGenerateAiCopy = async () => {
    if (!quickForm.name.trim()) {
      setFeedbackMessage({
        type: 'error',
        text: 'Por favor, preencha ao menos o Nome do Produto antes de gerar com IA.',
      });
      return;
    }

    try {
      setIsGeneratingAi(true);
      setFeedbackMessage(null);
      const res = await api.generateCopyAi({
        name: quickForm.name,
        category: quickForm.categoryName,
        price: quickForm.priceSale || undefined,
        knownDetails: quickForm.description || undefined,
      });

      setQuickForm((prev) => ({
        ...prev,
        description: res.description,
        seoTitle: res.seoTitle,
        seoDescription: res.seoDescription,
        seoKeywords: res.seoKeywords,
        searchTerms: res.searchTerms,
      }));

      setFeedbackMessage({
        type: 'success',
        text: 'Descrição e tags de SEO geradas pela IA com sucesso!',
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.friendlyMessage || 'Não foi possível gerar com IA no momento.',
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Quick Create Submit
  const handleQuickCreateSubmit = async (forceBypassDuplicate = false) => {
    if (!quickForm.name.trim()) {
      setFeedbackMessage({ type: 'error', text: 'O Nome do Produto é obrigatório.' });
      return;
    }
    if (!quickForm.priceSale || quickForm.priceSale <= 0) {
      setFeedbackMessage({ type: 'error', text: 'O Preço de Venda deve ser maior que zero.' });
      return;
    }

    try {
      setIsSubmittingQuick(true);
      setFeedbackMessage(null);

      // Check duplicates first (unless bypassed by user)
      if (!forceBypassDuplicate) {
        const dupCheck = await api.checkDuplicate({
          name: quickForm.name,
          sku: quickForm.sku,
        });

        if (dupCheck.isDuplicate) {
          setIsSubmittingQuick(false);
          setDuplicateModal({ isOpen: true, result: dupCheck });
          return;
        }
      }

      // Sync uploaded images with payload
      const mainUploadedImg = quickUploadedImages.find((img) => img.isMain) || quickUploadedImages[0];
      const payloadWithImages: QuickProductPayload = {
        ...quickForm,
        imageUrl: mainUploadedImg ? mainUploadedImg.url : quickForm.imageUrl,
        images: quickUploadedImages.map((img) => ({
          url: img.url,
          active: true,
          name: img.filename,
        })),
      };

      const res = await api.quickCreateProduct(payloadWithImages);

      setFeedbackMessage({
        type: 'success',
        text: `Produto "${res.product.name}" e SKU cadastrados com sucesso na Yampi!`,
      });

      // Reset form & uploaded images
      setQuickForm({
        name: '',
        categoryName: '',
        subcategoryName: '',
        priceSale: 0,
        priceDiscount: 0,
        priceCost: 0,
        stock: 10,
        sku: '',
        description: '',
        imageUrl: '',
        images: [],
        weight: 0.3,
        height: 10,
        width: 15,
        length: 20,
        seoTitle: '',
        seoDescription: '',
        seoKeywords: '',
        searchTerms: '',
      });
      setQuickUploadedImages([]);

      onRefresh();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.friendlyMessage || 'Erro ao cadastrar produto na Yampi.',
      });
    } finally {
      setIsSubmittingQuick(false);
    }
  };

  // Upload photos directly to existing product in Yampi
  const handleSavePhotosToExistingProduct = async () => {
    if (!photoUploadProduct || photoUploadImages.length === 0) return;
    try {
      setIsUploadingPhotos(true);
      let count = 0;
      for (const img of photoUploadImages) {
        await api.uploadProductImage(photoUploadProduct.id, {
          data: img.dataUrl,
          url: img.url,
          name: img.filename,
        });
        count++;
      }
      setFeedbackMessage({
        type: 'success',
        text: `${count} foto(s) adicionada(s) ao produto "${photoUploadProduct.name}" com sucesso!`,
      });
      setPhotoUploadProduct(null);
      setPhotoUploadImages([]);
      onRefresh();
    } catch (err: any) {
      alert(err?.friendlyMessage || 'Erro ao vincular fotos ao produto.');
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  // Create additional SKU
  const handleCreateSkuSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkuModalProduct) return;
    if (!newSkuForm.sku.trim()) {
      alert('Informe o código SKU.');
      return;
    }
    if (!newSkuForm.price_sale || newSkuForm.price_sale <= 0) {
      alert('Informe um preço de venda válido.');
      return;
    }

    try {
      setIsCreatingSku(true);
      await api.createSku({
        product_id: newSkuModalProduct.id,
        sku: newSkuForm.sku,
        title: newSkuForm.title || undefined,
        price_sale: Number(newSkuForm.price_sale),
        price_discount: newSkuForm.price_discount ? Number(newSkuForm.price_discount) : undefined,
        price_cost: newSkuForm.price_cost ? Number(newSkuForm.price_cost) : undefined,
      });

      alert(`SKU "${newSkuForm.sku}" adicionado com sucesso!`);
      setNewSkuModalProduct(null);
      onRefresh();
    } catch (err: any) {
      alert(err?.friendlyMessage || 'Erro ao cadastrar SKU.');
    } finally {
      setIsCreatingSku(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Sub Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/70 p-4 rounded-2xl border border-zinc-800">
        <div className="flex items-center gap-2">
          <button
            id="products-tab-list-btn"
            onClick={() => {
              setActiveSubTab('list');
              setFeedbackMessage(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
              activeSubTab === 'list'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Package className="w-4 h-4" />
            Catálogo de Produtos ({products.length})
          </button>

          <button
            id="products-tab-quick-btn"
            onClick={() => {
              setActiveSubTab('quick-create');
              setFeedbackMessage(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
              activeSubTab === 'quick-create'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            Cadastro Rápido
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="products-refresh-btn"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar Lista</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: CADASTRO RÁPIDO */}
      {activeSubTab === 'quick-create' && (
        <div className="space-y-6">
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-emerald-400" />
                  Cadastro Rápido de Produto & SKU
                </h2>
                <p className="text-xs text-zinc-400">
                  Preencha os campos essenciais. O sistema valida, cria ou localiza as categorias e cadastra o produto e SKU na Yampi.
                </p>
              </div>

              <button
                id="quick-generate-ai-btn"
                type="button"
                onClick={handleGenerateAiCopy}
                disabled={isGeneratingAi}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                <span>{isGeneratingAi ? 'Gerando com IA...' : 'Gerar com IA'}</span>
              </button>
            </div>

            {/* Feedback Alert */}
            {feedbackMessage && (
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  feedbackMessage.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-red-950/40 border-red-500/40 text-red-200'
                }`}
              >
                {feedbackMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="text-xs sm:text-sm font-medium">{feedbackMessage.text}</div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleQuickCreateSubmit();
              }}
              className="space-y-6"
            >
              {/* Section 1: Informações Básicas */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5" /> 1. Identificação do Produto
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Nome do Produto <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="quick-product-name"
                      type="text"
                      required
                      placeholder="Ex: Tênis Nike Air Max 90 Masculino"
                      value={quickForm.name}
                      onChange={(e) => setQuickForm({ ...quickForm, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Categoria Principal
                    </label>
                    <input
                      id="quick-category-name"
                      type="text"
                      list="categories-datalist"
                      placeholder="Ex: Calçados"
                      value={quickForm.categoryName}
                      onChange={(e) => setQuickForm({ ...quickForm, categoryName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
                    />
                    <datalist id="categories-datalist">
                      {categories
                        .filter((c) => !c.parent_id)
                        .map((c) => (
                          <option key={c.id} value={c.name} />
                        ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Subcategoria (Opcional)
                    </label>
                    <input
                      id="quick-subcategory-name"
                      type="text"
                      placeholder="Ex: Tênis Esportivos"
                      value={quickForm.subcategoryName || ''}
                      onChange={(e) => setQuickForm({ ...quickForm, subcategoryName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Código SKU <span className="text-zinc-500 text-[10px]">(auto se vazio)</span>
                    </label>
                    <input
                      id="quick-sku"
                      type="text"
                      placeholder="Ex: NIK-AIR90-41"
                      value={quickForm.sku}
                      onChange={(e) => setQuickForm({ ...quickForm, sku: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Preços e Estoque */}
              <div className="space-y-4 pt-4 border-t border-zinc-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5" /> 2. Preços & Estoque
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Preço de Venda (R$) <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="quick-price-sale"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={quickForm.priceSale || ''}
                      onChange={(e) => setQuickForm({ ...quickForm, priceSale: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-sm font-semibold text-emerald-400 placeholder-zinc-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Preço Promocional (R$)
                    </label>
                    <input
                      id="quick-price-discount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={quickForm.priceDiscount || ''}
                      onChange={(e) => setQuickForm({ ...quickForm, priceDiscount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Preço de Custo (R$)
                    </label>
                    <input
                      id="quick-price-cost"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={quickForm.priceCost || ''}
                      onChange={(e) => setQuickForm({ ...quickForm, priceCost: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Quantidade em Estoque
                    </label>
                    <input
                      id="quick-stock"
                      type="number"
                      min="0"
                      placeholder="10"
                      value={quickForm.stock}
                      onChange={(e) => setQuickForm({ ...quickForm, stock: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Mídia & Dimensões */}
              <div className="space-y-4 pt-4 border-t border-zinc-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5" /> 3. Fotos do Produto (Upload) & Dimensões de Frete
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="md:col-span-5">
                    <ImageUploadZone
                      id="quick-product-images-uploader"
                      images={quickUploadedImages}
                      onChange={(newImgs) => {
                        setQuickUploadedImages(newImgs);
                        const mainImg = newImgs.find((i) => i.isMain) || newImgs[0];
                        setQuickForm((prev) => ({
                          ...prev,
                          imageUrl: mainImg ? mainImg.url : '',
                          images: newImgs.map((i) => ({
                            url: i.url,
                            active: true,
                            name: i.filename,
                          })),
                        }));
                      }}
                      label="Fotos do Produto (Upload do seu Dispositivo)"
                      sublabel="Arraste e solte fotos do seu computador ou clique para selecionar. As fotos são enviadas diretamente para a Yampi!"
                      multiple={true}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Peso (kg)</label>
                    <input
                      id="quick-weight"
                      type="number"
                      step="0.01"
                      min="0"
                      value={quickForm.weight || ''}
                      onChange={(e) => setQuickForm({ ...quickForm, weight: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Altura (cm)</label>
                    <input
                      id="quick-height"
                      type="number"
                      min="0"
                      value={quickForm.height || ''}
                      onChange={(e) => setQuickForm({ ...quickForm, height: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Largura (cm)</label>
                    <input
                      id="quick-width"
                      type="number"
                      min="0"
                      value={quickForm.width || ''}
                      onChange={(e) => setQuickForm({ ...quickForm, width: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Comprimento (cm)</label>
                    <input
                      id="quick-length"
                      type="number"
                      min="0"
                      value={quickForm.length || ''}
                      onChange={(e) => setQuickForm({ ...quickForm, length: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-100"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Descrição e SEO */}
              <div className="space-y-4 pt-4 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                    <Box className="w-3.5 h-3.5" /> 4. Descrição & Otimização SEO
                  </h3>
                  <button
                    type="button"
                    onClick={handleGenerateAiCopy}
                    disabled={isGeneratingAi}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Gerar Descrição & SEO com IA
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Descrição Completa do Produto
                  </label>
                  <textarea
                    id="quick-description"
                    rows={4}
                    placeholder="Descrição atrativa com detalhes, benefícios e diferenciais do produto..."
                    value={quickForm.description || ''}
                    onChange={(e) => setQuickForm({ ...quickForm, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Título SEO (Meta Title)</label>
                    <input
                      id="quick-seo-title"
                      type="text"
                      placeholder="Título otimizado para o Google..."
                      value={quickForm.seoTitle || ''}
                      onChange={(e) => setQuickForm({ ...quickForm, seoTitle: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Descrição SEO (Meta Description)</label>
                    <input
                      id="quick-seo-desc"
                      type="text"
                      placeholder="Resumo persuasivo para os resultados de busca..."
                      value={quickForm.seoDescription || ''}
                      onChange={(e) => setQuickForm({ ...quickForm, seoDescription: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-100"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-zinc-800 flex justify-end">
                <button
                  id="submit-quick-create-btn"
                  type="submit"
                  disabled={isSubmittingQuick}
                  className="w-full sm:w-auto px-8 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingQuick ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                      <span>Cadastrando Produto & SKU na Yampi...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-zinc-950" />
                      <span>CADASTRAR NA YAMPI</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW 2: LISTA DE PRODUTOS */}
      {activeSubTab === 'list' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="search-products-input"
                type="text"
                placeholder="Buscar por nome, slug ou SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              <button
                id="filter-all-btn"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  filterType === 'all' ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Todos ({products.length})
              </button>

              <button
                id="filter-active-btn"
                onClick={() => setFilterType('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  filterType === 'active'
                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Ativos
              </button>

              <button
                id="filter-no-cat-btn"
                onClick={() => setFilterType('no-category')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  filterType === 'no-category'
                    ? 'bg-amber-950/60 text-amber-400 border border-amber-500/40'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Sem Categoria
              </button>

              <button
                id="filter-no-img-btn"
                onClick={() => setFilterType('no-image')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  filterType === 'no-image'
                    ? 'bg-amber-950/60 text-amber-400 border border-amber-500/40'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Sem Imagem
              </button>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            {isLoading ? (
              <div className="py-16 text-center text-zinc-400 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mx-auto" />
                <p className="text-sm font-medium">Carregando catálogo da Yampi...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-16 text-center text-zinc-400 space-y-3 px-4">
                <Package className="w-12 h-12 text-zinc-600 mx-auto" />
                <h3 className="font-bold text-white text-base">Nenhum produto encontrado</h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  {searchTerm
                    ? 'Nenhum item corresponde à sua pesquisa. Tente buscar por outros termos.'
                    : 'Sua loja ainda não possui produtos cadastrados ou a API não retornou itens.'}
                </p>
                <button
                  onClick={() => setActiveSubTab('quick-create')}
                  className="mt-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar Primeiro Produto
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/70 text-zinc-400 font-semibold uppercase text-[11px] tracking-wider">
                      <th className="py-3.5 px-4">Produto</th>
                      <th className="py-3.5 px-4">Categoria</th>
                      <th className="py-3.5 px-4">SKUs / Variações</th>
                      <th className="py-3.5 px-4">Preço Principal</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredProducts.map((p) => {
                      const firstSku = p.skus && p.skus.length > 0 ? p.skus[0] : null;
                      const image = p.images?.[0]?.url || firstSku?.images?.[0]?.url;
                      const catName = p.category?.name || p.categories?.[0]?.name || 'Sem Categoria';

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-zinc-800/40 transition-colors group"
                        >
                          {/* Image & Name */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden flex-shrink-0 flex items-center justify-center text-zinc-600">
                                {image ? (
                                  <img
                                    src={image}
                                    alt={p.name}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      (e.target as any).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <ImageIcon className="w-5 h-5 text-zinc-600" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-zinc-100 truncate max-w-xs sm:max-w-md">
                                  {p.name}
                                </div>
                                <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-2">
                                  <span>ID: #{p.id}</span>
                                  {p.slug && <span className="truncate">/{p.slug}</span>}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                catName !== 'Sem Categoria'
                                  ? 'bg-zinc-800 text-zinc-200'
                                  : 'bg-amber-950/40 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {catName}
                            </span>
                          </td>

                          {/* SKUs */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {p.skus && p.skus.length > 0 ? (
                                p.skus.slice(0, 2).map((s, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300"
                                  >
                                    {s.sku}
                                  </span>
                                ))
                              ) : (
                                <span className="text-zinc-500 text-xs">Nenhum SKU</span>
                              )}
                              {p.skus && p.skus.length > 2 && (
                                <span className="text-[10px] text-zinc-400">+{p.skus.length - 2}</span>
                              )}
                            </div>
                          </td>

                          {/* Price */}
                          <td className="py-3.5 px-4 font-semibold text-emerald-400">
                            {firstSku?.price_sale
                              ? `R$ ${Number(firstSku.price_sale).toFixed(2)}`
                              : 'R$ -'}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                p.active
                                  ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  p.active ? 'bg-emerald-400' : 'bg-zinc-500'
                                }`}
                              />
                              {p.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                id={`upload-photo-product-${p.id}`}
                                onClick={() => {
                                  setPhotoUploadProduct(p);
                                  setPhotoUploadImages([]);
                                }}
                                title="Fazer Upload de Fotos para este Produto"
                                className="p-1.5 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40 rounded-lg transition-colors flex items-center gap-1"
                              >
                                <UploadCloud className="w-4 h-4" />
                              </button>

                              <button
                                id={`view-product-details-${p.id}`}
                                onClick={() => setSelectedProduct(p)}
                                title="Ver Detalhes"
                                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              <button
                                id={`add-sku-product-${p.id}`}
                                onClick={() => {
                                  setNewSkuModalProduct(p);
                                  setNewSkuForm({
                                    sku: `${p.slug.toUpperCase().slice(0, 8)}-${Date.now().toString().slice(-3)}`,
                                    title: 'Nova Variação',
                                    price_sale: firstSku?.price_sale || 0,
                                    price_discount: firstSku?.price_discount || 0,
                                    price_cost: firstSku?.price_cost || 0,
                                    stock: 10,
                                  });
                                }}
                                title="Adicionar Novo SKU"
                                className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 rounded-lg transition-colors"
                              >
                                <PlusCircle className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: DETALHES DO PRODUTO */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/80">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base leading-tight">{selectedProduct.name}</h3>
                  <p className="text-xs text-zinc-400 font-mono">ID Yampi: #{selectedProduct.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm">
              {/* Product Info */}
              <div className="grid grid-cols-2 gap-4 bg-zinc-950/60 p-4 rounded-xl border border-zinc-800">
                <div>
                  <span className="text-zinc-400 block text-xs">URL / Slug:</span>
                  <span className="font-mono text-zinc-200 font-semibold">{selectedProduct.slug}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-xs">Categoria:</span>
                  <span className="font-semibold text-emerald-400">
                    {selectedProduct.category?.name || 'Sem categoria'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-xs">Visibilidade:</span>
                  <span className="text-zinc-200">{selectedProduct.active ? 'Ativo na Loja' : 'Oculto'}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-xs">SKUs Vinculados:</span>
                  <span className="text-zinc-200">{selectedProduct.skus?.length || 0} variações</span>
                </div>
              </div>

              {/* Product Photos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider">Fotos do Produto:</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoUploadProduct(selectedProduct);
                      setPhotoUploadImages([]);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload de Novas Fotos</span>
                  </button>
                </div>
                {selectedProduct.images && selectedProduct.images.length > 0 ? (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                    {selectedProduct.images.map((img, idx) => (
                      <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900">
                        <img
                          src={img.url}
                          alt={`Foto ${idx + 1}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-center text-zinc-500 text-xs">
                    Nenhuma foto cadastrada ainda. Clique no botão acima para fazer upload.
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-2">Descrição:</h4>
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-300 text-xs leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {selectedProduct.description || 'Nenhuma descrição cadastrada para este produto.'}
                </div>
              </div>

              {/* SKUs List */}
              <div>
                <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-2">SKUs / Preços:</h4>
                {selectedProduct.skus && selectedProduct.skus.length > 0 ? (
                  <div className="space-y-2">
                    {selectedProduct.skus.map((sku, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-mono font-bold text-zinc-100">{sku.sku}</div>
                          <div className="text-[11px] text-zinc-400">{sku.title || 'Variação Padrão'}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-400">R$ {Number(sku.price_sale).toFixed(2)}</div>
                          {sku.price_discount && sku.price_discount > 0 && (
                            <div className="text-[10px] text-zinc-500 line-through">
                              R$ {Number(sku.price_discount).toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-xs">Nenhum SKU detalhado encontrado.</p>
                )}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-950/60 flex justify-end">
              <button
                onClick={() => setSelectedProduct(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-xl text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DUPLICATE DETECTION MODAL */}
      {duplicateModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-zinc-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Possível Produto Duplicado</h3>
                <p className="text-xs text-amber-300/90 font-medium">
                  {duplicateModal.result?.message || 'Detectamos um item similar já existente.'}
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              Para manter seu catálogo organizado e evitar conflito de SKUs ou URLs na Yampi, recomendamos conferir o item antes de prosseguir.
            </p>

            <div className="grid grid-cols-1 gap-2 pt-2">
              <button
                id="duplicate-modal-force-btn"
                type="button"
                onClick={() => {
                  setDuplicateModal({ isOpen: false, result: null });
                  handleQuickCreateSubmit(true);
                }}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl shadow-lg transition-all"
              >
                CADASTRAR MESMO ASSIM
              </button>

              <button
                id="duplicate-modal-cancel-btn"
                type="button"
                onClick={() => setDuplicateModal({ isOpen: false, result: null })}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs rounded-xl transition-colors"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADICIONAR NOVO SKU */}
      {newSkuModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Adicionar Novo SKU / Variação</h3>
                <p className="text-xs text-zinc-400">Produto: {newSkuModalProduct.name}</p>
              </div>
              <button
                onClick={() => setNewSkuModalProduct(null)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSkuSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Código SKU</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: TNS-AZUL-42"
                  value={newSkuForm.sku}
                  onChange={(e) => setNewSkuForm({ ...newSkuForm, sku: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Título da Variação</label>
                <input
                  type="text"
                  placeholder="Ex: Azul / Tamanho 42"
                  value={newSkuForm.title}
                  onChange={(e) => setNewSkuForm({ ...newSkuForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Preço de Venda (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newSkuForm.price_sale || ''}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, price_sale: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs font-semibold text-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Preço Promocional (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newSkuForm.price_discount || ''}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, price_discount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setNewSkuModalProduct(null)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingSku}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isCreatingSku ? 'Cadastrando...' : 'Cadastrar SKU'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: UPLOAD DE FOTOS PARA PRODUTO EXISTENTE */}
      {photoUploadProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Upload de Fotos do Produto</h3>
                  <p className="text-xs text-zinc-400 truncate max-w-sm">
                    {photoUploadProduct.name} <span className="font-mono text-zinc-500">(ID: #{photoUploadProduct.id})</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setPhotoUploadProduct(null);
                  setPhotoUploadImages([]);
                }}
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <ImageUploadZone
                id="existing-product-photo-upload-zone"
                images={photoUploadImages}
                onChange={setPhotoUploadImages}
                label="Selecione ou Arraste Fotos"
                sublabel="Fotos serão vinculadas à galeria deste produto na Yampi"
                multiple={true}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setPhotoUploadProduct(null);
                  setPhotoUploadImages([]);
                }}
                disabled={isUploadingPhotos}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={photoUploadImages.length === 0 || isUploadingPhotos}
                onClick={handleSavePhotosToExistingProduct}
                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isUploadingPhotos ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Enviando fotos...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Enviar {photoUploadImages.length} Foto(s) para a Yampi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
