import { YampiCategory, YampiProduct, YampiSku } from '../src/types.js';
import { activityStore } from './activityStore.js';

interface YampiCredentials {
  alias: string;
  userToken: string;
  userSecretKey: string;
}

// In-memory credentials override if user configures via UI in addition to process.env
let runtimeCredentials: Partial<YampiCredentials> = {};

export function setRuntimeCredentials(creds: Partial<YampiCredentials>) {
  runtimeCredentials = { ...runtimeCredentials, ...creds };
}

export function getActiveCredentials(): YampiCredentials {
  const alias = (runtimeCredentials.alias || process.env.YAMPI_ALIAS || '').trim();
  const userToken = (runtimeCredentials.userToken || process.env.YAMPI_USER_TOKEN || '').trim();
  const userSecretKey = (runtimeCredentials.userSecretKey || process.env.YAMPI_USER_SECRET_KEY || '').trim();

  return { alias, userToken, userSecretKey };
}

export function hasConfiguredCredentials(): boolean {
  const { alias, userToken, userSecretKey } = getActiveCredentials();
  return Boolean(alias && userToken && userSecretKey);
}

function translateErrorMessage(status: number, rawMessage: string, details?: any): string {
  if (status === 401 || status === 403) {
    return 'Não foi possível autenticar na Yampi. Verifique se o Alias, User-Token e User-Secret-Key estão corretos nas Configurações.';
  }
  if (status === 404) {
    return 'Recurso não encontrado na Yampi (verifique se o Alias da loja está correto).';
  }
  if (status === 422) {
    if (typeof details === 'object' && details !== null) {
      const messages: string[] = [];
      for (const [key, val] of Object.entries(details)) {
        const fieldName = translateFieldName(key);
        if (Array.isArray(val)) {
          messages.push(`${fieldName}: ${val.join(', ')}`);
        } else if (typeof val === 'string') {
          messages.push(`${fieldName}: ${val}`);
        }
      }
      if (messages.length > 0) {
        return `A Yampi rejeitou os dados enviados: ${messages.join('; ')}.`;
      }
    }
    return `Dados inválidos para a Yampi: ${rawMessage || 'Verifique se todos os campos obrigatórios foram preenchidos corretamente'}.`;
  }
  if (status === 429) {
    return 'Limite de requisições por minuto atingido na Yampi. Aguardando alguns instantes...';
  }
  if (status >= 500) {
    return 'Os servidores da Yampi estão temporariamente instáveis. Tente novamente em alguns instantes.';
  }
  if (!status || status === 0) {
    return 'Falha de conexão com os servidores da Yampi. Verifique sua conexão com a internet.';
  }
  return rawMessage || 'Ocorreu um erro ao comunicar com a Yampi.';
}

function translateFieldName(field: string): string {
  const map: Record<string, string> = {
    name: 'Nome',
    slug: 'Slug / URL',
    price_sale: 'Preço de Venda',
    price_cost: 'Preço de Custo',
    price_discount: 'Preço Promocional',
    sku: 'Código SKU',
    categories_ids: 'Categorias',
    parent_id: 'Categoria Pai',
    weight: 'Peso',
    height: 'Altura',
    width: 'Largura',
    length: 'Comprimento',
    description: 'Descrição',
  };
  return map[field] || field;
}

export class YampiClient {
  private static getHeaders(creds: YampiCredentials) {
    return {
      'Content-Type': 'application/json',
      'User-Token': creds.userToken,
      'User-Secret-Key': creds.userSecretKey,
      'User-Agent': 'KING-Yampi-Manager/1.0',
    };
  }

  private static getBaseUrl(alias: string) {
    return `https://api.dooki.com.br/v2/${alias}`;
  }

  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; meta?: any; status: number }> {
    const creds = getActiveCredentials();

    if (!creds.alias || !creds.userToken || !creds.userSecretKey) {
      throw {
        status: 400,
        friendlyMessage: 'Credenciais da Yampi não configuradas. Acesse "Configurações" e preencha seu Alias, User-Token e User-Secret-Key.',
        technicalError: 'Missing YAMPI_ALIAS, YAMPI_USER_TOKEN or YAMPI_USER_SECRET_KEY',
      };
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.getBaseUrl(creds.alias)}${cleanEndpoint}`;

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(creds),
          ...(options.headers || {}),
        },
      });
    } catch (networkErr: any) {
      throw {
        status: 0,
        friendlyMessage: 'Falha de conexão com a API da Yampi. Verifique a internet e tente novamente.',
        technicalError: networkErr?.message || 'Network fetch failed',
      };
    }

    let json: any = {};
    try {
      json = await response.json();
    } catch {
      json = {};
    }

    if (!response.ok) {
      const errorMsg = json?.message || json?.error || response.statusText;
      const errorDetails = json?.errors || json?.data?.errors;
      const friendlyMessage = translateErrorMessage(response.status, errorMsg, errorDetails);

      throw {
        status: response.status,
        friendlyMessage,
        technicalError: {
          endpoint: cleanEndpoint,
          status: response.status,
          statusText: response.statusText,
          responseBody: json,
        },
      };
    }

    return {
      data: (json?.data !== undefined ? json.data : json) as T,
      meta: json?.meta,
      status: response.status,
    };
  }

  // 1. Test Connection
  public static async testConnection(): Promise<{ connected: boolean; message: string; merchant?: any; technicalError?: any }> {
    const creds = getActiveCredentials();
    if (!creds.alias || !creds.userToken || !creds.userSecretKey) {
      return {
        connected: false,
        message: 'Credenciais não configuradas. Insira seu Alias, User-Token e User-Secret-Key.',
        technicalError: 'Missing credentials in environment or settings',
      };
    }

    try {
      // Test category endpoint with limit 1
      const res = await this.request<any>('/catalog/categories?limit=1', { method: 'GET' });
      activityStore.add({
        type: 'success',
        action: 'Teste de Conexão Yampi',
        friendlyMessage: `Conexão estabelecida com sucesso com a loja "${creds.alias}".`,
        technicalDetails: {
          endpoint: '/catalog/categories?limit=1',
          method: 'GET',
          statusCode: res.status,
        },
      });
      return {
        connected: true,
        message: `Conectado com sucesso à loja "${creds.alias}"!`,
        merchant: { alias: creds.alias },
      };
    } catch (err: any) {
      activityStore.add({
        type: 'error',
        action: 'Falha no Teste de Conexão',
        friendlyMessage: err?.friendlyMessage || 'Não foi possível conectar à API da Yampi.',
        technicalDetails: {
          rawError: err?.technicalError || err,
          statusCode: err?.status || 500,
        },
      });
      return {
        connected: false,
        message: err?.friendlyMessage || 'Erro ao conectar à Yampi.',
        technicalError: err?.technicalError || err,
      };
    }
  }

  // 2. Categories with full pagination and structure normalization
  public static async getCategories(params?: { search?: string; limit?: number; page?: number; parent_id?: number | null; include?: string }): Promise<YampiCategory[]> {
    const creds = getActiveCredentials();
    if (!creds.alias || !creds.userToken || !creds.userSecretKey) {
      return [];
    }

    const perPage = params?.limit || 100;
    const requestedPage = params?.page;

    // Helper to extract and normalize list of categories from Yampi response data
    const normalizeCategoryList = (rawList: any[]): YampiCategory[] => {
      const list: YampiCategory[] = [];

      for (const item of rawList) {
        if (!item || typeof item !== 'object') continue;

        let parentId: number | null = null;
        if (item.parent_id !== undefined && item.parent_id !== null && item.parent_id !== 0 && item.parent_id !== '0') {
          parentId = Number(item.parent_id) || null;
        } else if (item.parent?.data?.id) {
          parentId = Number(item.parent.data.id) || null;
        }

        const normalizedCat: YampiCategory = {
          id: Number(item.id),
          name: String(item.name || '').trim(),
          slug: item.slug || slugify(item.name || ''),
          parent_id: parentId,
          active: item.active !== undefined ? Boolean(item.active) : true,
          featured: Boolean(item.featured),
          seo_title: item.seo_title || undefined,
          seo_keywords: item.seo_keywords || undefined,
          seo_description: item.seo_description || undefined,
          order: Number(item.order) || 0,
        };

        list.push(normalizedCat);

        // Also check if Yampi returned nested children/subcategories inside the category object
        const nestedSubs = item.subcategories?.data || item.children?.data;
        if (Array.isArray(nestedSubs)) {
          for (const sub of nestedSubs) {
            if (sub && sub.id) {
              list.push({
                id: Number(sub.id),
                name: String(sub.name || '').trim(),
                slug: sub.slug || slugify(sub.name || ''),
                parent_id: normalizedCat.id,
                active: sub.active !== undefined ? Boolean(sub.active) : true,
                featured: Boolean(sub.featured),
                order: Number(sub.order) || 0,
              });
            }
          }
        }
      }

      return list;
    };

    // If a specific page was requested, fetch just that page
    if (requestedPage !== undefined) {
      const query = new URLSearchParams();
      query.set('limit', String(perPage));
      query.set('page', String(requestedPage));
      if (params?.search) query.set('q', params.search);
      if (params?.include) query.set('include', params.include);

      const endpoint = `/catalog/categories?${query.toString()}`;
      const result = await this.request<any>(endpoint, { method: 'GET' });
      const rawData = Array.isArray(result.data) ? result.data : (Array.isArray(result.data?.data) ? result.data.data : []);
      return normalizeCategoryList(rawData);
    }

    // Default: Fetch ALL pages to ensure full catalog synchronization
    const allCategoriesMap = new Map<number, YampiCategory>();
    let currentPage = 1;
    let totalPages = 1;
    const maxPagesToFetch = 30; // Safety guard for large stores (up to 3,000 categories)

    while (currentPage <= totalPages && currentPage <= maxPagesToFetch) {
      const query = new URLSearchParams();
      query.set('limit', String(perPage));
      query.set('page', String(currentPage));
      if (params?.search) query.set('q', params.search);
      if (params?.include) query.set('include', params.include);

      const endpoint = `/catalog/categories?${query.toString()}`;
      const result = await this.request<any>(endpoint, { method: 'GET' });

      const rawData = Array.isArray(result.data) ? result.data : (Array.isArray(result.data?.data) ? result.data.data : []);
      const pageList = normalizeCategoryList(rawData);

      for (const cat of pageList) {
        allCategoriesMap.set(cat.id, cat);
      }

      // Check pagination metadata from Yampi
      const pagination = result.meta?.pagination;
      if (pagination && typeof pagination.total_pages === 'number') {
        totalPages = pagination.total_pages;
      } else if (rawData.length === perPage) {
        // If no metadata but page was full, try next page
        totalPages = currentPage + 1;
      } else {
        break;
      }

      currentPage++;
    }

    const allCategories = Array.from(allCategoriesMap.values());
    return allCategories;
  }

  public static async createCategory(data: {
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
  }): Promise<YampiCategory> {
    const payload: any = {
      name: data.name.trim(),
      active: data.active ?? true,
      slug: data.slug?.trim() || slugify(data.name),
    };

    if (data.parent_id !== undefined && data.parent_id !== null) {
      payload.parent_id = Number(data.parent_id);
    }
    if (data.featured !== undefined) payload.featured = Boolean(data.featured);
    if (data.seo_title) payload.seo_title = data.seo_title.trim();
    if (data.seo_keywords) payload.seo_keywords = data.seo_keywords.trim();
    if (data.seo_description) payload.seo_description = data.seo_description.trim();
    if (data.order !== undefined) payload.order = Number(data.order);
    if (data.sort_by) payload.sort_by = data.sort_by;

    const res = await this.request<YampiCategory>('/catalog/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    activityStore.add({
      type: 'success',
      action: 'Categoria Criada',
      friendlyMessage: `Categoria "${data.name}" criada com sucesso na Yampi.`,
      technicalDetails: {
        endpoint: '/catalog/categories',
        method: 'POST',
        payload,
        statusCode: res.status,
      },
    });

    return res.data;
  }

  public static async updateCategory(id: number, data: Partial<YampiCategory>): Promise<YampiCategory> {
    const res = await this.request<YampiCategory>(`/catalog/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    activityStore.add({
      type: 'success',
      action: 'Categoria Atualizada',
      friendlyMessage: `Categoria "${data.name || id}" atualizada com sucesso.`,
      technicalDetails: {
        endpoint: `/catalog/categories/${id}`,
        method: 'PUT',
        payload: data,
        statusCode: res.status,
      },
    });

    return res.data;
  }

  // 3. Products
  public static async getProducts(params?: { search?: string; limit?: number; page?: number; include?: string }): Promise<{ products: YampiProduct[]; total?: number }> {
    const query = new URLSearchParams();
    query.set('limit', String(params?.limit || 100));
    if (params?.page) query.set('page', String(params.page));
    if (params?.search) query.set('q', params.search);
    query.set('include', params?.include || 'category,categories,skus,images');

    const res = await this.request<YampiProduct[]>(`/catalog/products?${query.toString()}`, { method: 'GET' });
    const products = Array.isArray(res.data) ? res.data : [];
    return {
      products,
      total: res.meta?.pagination?.total || products.length,
    };
  }

  public static async getProduct(id: number): Promise<YampiProduct> {
    const res = await this.request<YampiProduct>(`/catalog/products/${id}?include=category,categories,skus,images`, { method: 'GET' });
    return res.data;
  }

  public static async createProduct(data: {
    name: string;
    slug?: string;
    active?: boolean;
    searchable?: boolean;
    is_digital?: boolean;
    description?: string;
    specifications?: string;
    seo_title?: string;
    seo_description?: string;
    seo_keywords?: string;
    search_terms?: string;
    categories_ids?: number[];
    brand_id?: number | null;
    ncm?: string;
  }): Promise<YampiProduct> {
    const payload: any = {
      name: data.name.trim(),
      slug: data.slug?.trim() || slugify(data.name),
      active: data.active ?? true,
      searchable: data.searchable ?? true,
      is_digital: data.is_digital ?? false,
    };

    if (data.description) payload.description = data.description;
    if (data.specifications) payload.specifications = data.specifications;
    if (data.seo_title) payload.seo_title = data.seo_title;
    if (data.seo_description) payload.seo_description = data.seo_description;
    if (data.seo_keywords) payload.seo_keywords = data.seo_keywords;
    if (data.search_terms) payload.search_terms = data.search_terms;
    if (data.categories_ids && data.categories_ids.length > 0) payload.categories_ids = data.categories_ids;
    if (data.brand_id) payload.brand_id = data.brand_id;
    if (data.ncm) payload.ncm = data.ncm;

    const res = await this.request<YampiProduct>('/catalog/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    activityStore.add({
      type: 'success',
      action: 'Produto Criado',
      friendlyMessage: `Produto "${data.name}" criado com sucesso (ID: ${res.data?.id || 'OK'}).`,
      technicalDetails: {
        endpoint: '/catalog/products',
        method: 'POST',
        payload,
        statusCode: res.status,
      },
    });

    return res.data;
  }

  public static async updateProduct(id: number, data: Partial<YampiProduct>): Promise<YampiProduct> {
    const res = await this.request<YampiProduct>(`/catalog/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    activityStore.add({
      type: 'success',
      action: 'Produto Atualizado',
      friendlyMessage: `Produto #${id} atualizado com sucesso.`,
      technicalDetails: {
        endpoint: `/catalog/products/${id}`,
        method: 'PUT',
        payload: data,
        statusCode: res.status,
      },
    });

    return res.data;
  }

  // 4. SKUs
  public static async createSku(data: {
    product_id: number;
    sku: string;
    title?: string;
    price_cost?: number;
    price_sale: number;
    price_discount?: number;
    weight?: number;
    height?: number;
    width?: number;
    length?: number;
    quantity_managed?: boolean;
    availability?: boolean;
    availability_soldout?: boolean;
    blocked_sale?: boolean;
    barcode?: string;
    images?: Array<{ url: string; active?: boolean }>;
  }): Promise<YampiSku> {
    const payload: any = {
      product_id: Number(data.product_id),
      sku: data.sku?.trim() || `SKU-${Date.now()}`,
      title: data.title || 'Padrão',
      price_sale: Number(data.price_sale) || 0,
      availability: data.availability ?? true,
      quantity_managed: data.quantity_managed ?? true,
    };

    if (data.price_cost !== undefined && data.price_cost !== null) payload.price_cost = Number(data.price_cost);
    if (data.price_discount !== undefined && data.price_discount !== null && Number(data.price_discount) > 0) {
      payload.price_discount = Number(data.price_discount);
    }
    if (data.weight !== undefined) payload.weight = Number(data.weight);
    if (data.height !== undefined) payload.height = Number(data.height);
    if (data.width !== undefined) payload.width = Number(data.width);
    if (data.length !== undefined) payload.length = Number(data.length);
    if (data.barcode) payload.barcode = data.barcode;
    if (data.images && data.images.length > 0) payload.images = data.images;

    const res = await this.request<YampiSku>('/catalog/skus', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    activityStore.add({
      type: 'success',
      action: 'SKU Criado',
      friendlyMessage: `SKU "${payload.sku}" vinculado ao produto #${data.product_id} com preço R$ ${payload.price_sale.toFixed(2)}.`,
      technicalDetails: {
        endpoint: '/catalog/skus',
        method: 'POST',
        payload,
        statusCode: res.status,
      },
    });

    return res.data;
  }

  // 5. Product Image Attachment
  public static async attachProductImage(productId: number, imageUrl: string): Promise<any> {
    if (!imageUrl || !imageUrl.startsWith('http')) return null;
    try {
      const payload = { url: imageUrl, active: true };
      const res = await this.request<any>(`/catalog/products/${productId}/images`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
    } catch (err) {
      console.warn(`Aviso: não foi possível anexar imagem direta ao produto #${productId}:`, err);
      return null;
    }
  }
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}
