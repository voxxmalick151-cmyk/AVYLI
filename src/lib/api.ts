import {
  YampiCategory,
  YampiProduct,
  YampiSku,
  DashboardStats,
  ConnectionStatus,
  ActivityLog,
  QuickProductPayload,
  MassImportItem,
  AiCategorySuggestion,
  AiProductCategorization,
  DuplicateCheckResult,
} from '../types';

export class ApiError extends Error {
  friendlyMessage: string;
  technicalError?: any;
  status?: number;

  constructor(friendlyMessage: string, technicalError?: any, status?: number) {
    super(friendlyMessage);
    this.friendlyMessage = friendlyMessage;
    this.technicalError = technicalError;
    this.status = status;
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });
  } catch (err: any) {
    throw new ApiError(
      'Não foi possível conectar ao servidor local. Verifique se a aplicação está em execução.',
      err?.message || err,
      0
    );
  }

  let data: any = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new ApiError(
      data?.friendlyMessage || data?.message || 'Ocorreu um erro ao processar sua solicitação.',
      data?.technicalError || data,
      response.status
    );
  }

  return data;
}

export const api = {
  // Status & Settings
  getStatus: () => fetchJson<{ hasConfiguredKeys: boolean; hasEnvKeys: boolean; configuredAlias?: string; hasGeminiKey: boolean }>('/api/yampi/status'),
  saveCredentials: (creds: { alias?: string; userToken?: string; userSecretKey?: string }) =>
    fetchJson<{ success: boolean; message: string }>('/api/yampi/configure', {
      method: 'POST',
      body: JSON.stringify(creds),
    }),
  updateCredentials: (creds: { alias?: string; token?: string; secretKey?: string; userToken?: string; userSecretKey?: string }) =>
    fetchJson<ConnectionStatus>('/api/yampi/configure', {
      method: 'POST',
      body: JSON.stringify({
        alias: creds.alias,
        userToken: creds.userToken || creds.token,
        userSecretKey: creds.userSecretKey || creds.secretKey,
      }),
    }),
  testConnection: (creds?: { alias?: string; userToken?: string; userSecretKey?: string }) =>
    fetchJson<ConnectionStatus>('/api/yampi/test', {
      method: 'POST',
      body: JSON.stringify(creds || {}),
    }),

  // Dashboard
  getStats: () => fetchJson<DashboardStats>('/api/dashboard/stats'),

  // Categories
  getCategories: async (search?: string): Promise<YampiCategory[]> => {
    const res = await fetchJson<{ categories?: YampiCategory[]; data?: YampiCategory[] }>(
      `/api/yampi/categories${search ? `?search=${encodeURIComponent(search)}` : ''}`
    );
    return res.categories || res.data || [];
  },
  createCategory: (payload: {
    name: string;
    active?: boolean;
    slug?: string;
    parent_id?: number | null;
    featured?: boolean;
    seo_title?: string;
    seo_keywords?: string;
    seo_description?: string;
    order?: number;
    sort_by?: string;
  }) =>
    fetchJson<{ category: YampiCategory }>('/api/yampi/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCategory: (id: number, payload: Partial<YampiCategory>) =>
    fetchJson<{ category: YampiCategory }>(`/api/yampi/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  batchCreateCategoryStructure: (structure: Array<{
    name: string;
    slug?: string;
    selected?: boolean;
    subcategories?: Array<{ name: string; slug?: string; selected?: boolean }>;
  }>) =>
    fetchJson<{
      success: boolean;
      createdParents: number;
      reusedParents: number;
      createdSubs: number;
      reusedSubs: number;
      totalCreated: number;
      message: string;
    }>('/api/yampi/categories/batch-structure', {
      method: 'POST',
      body: JSON.stringify({ structure }),
    }),

  // Products
  getProducts: async (params?: { search?: string; page?: number; limit?: number }): Promise<YampiProduct[]> => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const res = await fetchJson<{ products?: YampiProduct[]; data?: YampiProduct[] }>(
      `/api/yampi/products?${query.toString()}`
    );
    return res.products || res.data || [];
  },
  getProduct: (id: number) => fetchJson<{ product: YampiProduct }>(`/api/yampi/products/${id}`),
  createProduct: (payload: any) =>
    fetchJson<{ product: YampiProduct }>('/api/yampi/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProduct: (id: number, payload: Partial<YampiProduct>) =>
    fetchJson<{ product: YampiProduct }>(`/api/yampi/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // SKUs
  createSku: (payload: any) =>
    fetchJson<{ sku: YampiSku }>('/api/yampi/skus', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Image Uploads
  uploadImage: (payload: { data: string; name?: string; type?: string }) =>
    fetchJson<{ url: string; fullUrl: string; filename: string; size: number }>('/api/upload-image', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  uploadProductImage: (productId: number, payload: { data?: string; url?: string; name?: string }) =>
    fetchJson<{ success: boolean; image: any; message: string }>(`/api/yampi/products/${productId}/images`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Quick Create
  quickCreateProduct: (payload: QuickProductPayload) =>
    fetchJson<{ success: boolean; product: YampiProduct; sku: YampiSku; message: string }>('/api/yampi/quick-create', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Duplicate Check
  checkDuplicate: (payload: { name?: string; sku?: string; slug?: string }) =>
    fetchJson<DuplicateCheckResult>('/api/yampi/check-duplicate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Batch Item Importer
  importBatchItem: (item: MassImportItem) =>
    fetchJson<{ success: boolean; productId: number; skuId: number; productName: string }>('/api/yampi/batch-import-item', {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  // AI Services
  generateCategoryStructure: (prompt: string) =>
    fetchJson<{ suggestions: AiCategorySuggestion[] }>('/api/ai/category-structure', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),
  generateTaxonomyAi: async (params: { niche: string }) => {
    const res = await fetchJson<{ suggestions: AiCategorySuggestion[] }>('/api/ai/category-structure', {
      method: 'POST',
      body: JSON.stringify({ prompt: params.niche }),
    });
    return {
      categories: (res.suggestions || []).map((s) => ({
        name: s.category,
        slug: s.category.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        subcategories: (s.subcategories || []).map((sub) => ({
          name: sub,
          slug: sub.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        })),
      })),
    };
  },
  categorizeProductsAi: (
    products: Array<{ id: number; name: string; currentCategory?: string; description?: string }>,
    categories: Array<{ id: number; name: string; subcategories?: string[] }>
  ) =>
    fetchJson<{ suggestions: AiProductCategorization[] }>('/api/ai/categorize-products', {
      method: 'POST',
      body: JSON.stringify({ products, categories }),
    }),
  categorizeBatchAi: async (params: {
    products: Array<{ id: number; name: string }>;
    existingCategories: Array<{ id: number; name: string; parentId?: number }>;
  }) => {
    const res = await fetchJson<{ suggestions: AiProductCategorization[] }>('/api/ai/categorize-products', {
      method: 'POST',
      body: JSON.stringify({
        products: params.products,
        categories: params.existingCategories.map((c) => ({
          id: c.id,
          name: c.name,
        })),
      }),
    });

    return {
      suggestions: (res.suggestions || []).map((s) => ({
        productId: s.productId,
        productName: s.productName,
        suggestedCategory: s.suggestedCategory,
        suggestedSubcategory: s.suggestedSubcategory,
        confidence: s.confidence === 'Alta' ? 0.95 : s.confidence === 'Média' ? 0.75 : 0.5,
        reasoning: s.reason,
      })),
    };
  },
  generateCopyAi: (productData: { name: string; category?: string; brand?: string; price?: number; knownDetails?: string }) =>
    fetchJson<{
      description: string;
      seoTitle: string;
      seoDescription: string;
      seoKeywords: string;
      searchTerms: string;
    }>('/api/ai/generate-copy', {
      method: 'POST',
      body: JSON.stringify(productData),
    }),

  // Logs
  getLogs: async (): Promise<ActivityLog[]> => {
    const res = await fetchJson<{ logs?: ActivityLog[]; data?: ActivityLog[] }>('/api/logs');
    return res.logs || res.data || [];
  },
  clearLogs: () => fetchJson<{ success: boolean; logs: ActivityLog[] }>('/api/logs', { method: 'DELETE' }),
};
