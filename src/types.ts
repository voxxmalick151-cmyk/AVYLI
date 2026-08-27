export interface YampiCategory {
  id: number;
  name: string;
  slug: string;
  active: boolean;
  parent_id: number | null;
  featured?: boolean;
  seo_title?: string | null;
  seo_keywords?: string | null;
  seo_description?: string | null;
  order?: number;
  sort_by?: string;
  subcategories?: YampiCategory[];
  created_at?: string;
  updated_at?: string;
}

export interface YampiSku {
  id?: number;
  product_id?: number;
  sku: string;
  title?: string;
  price_cost?: number;
  price_sale: number;
  price_discount?: number;
  weight?: number; // em kg ou gramas
  height?: number; // em cm
  width?: number; // em cm
  length?: number; // em cm
  quantity_managed?: boolean;
  availability?: boolean;
  availability_soldout?: boolean;
  blocked_sale?: boolean;
  barcode?: string;
  images?: Array<{ url: string; active?: boolean }>;
}

export interface YampiProduct {
  id: number;
  name: string;
  slug: string;
  active: boolean;
  searchable?: boolean;
  is_digital?: boolean;
  description?: string;
  specifications?: string;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  search_terms?: string;
  category_id?: number;
  categories_ids?: number[];
  category?: YampiCategory;
  categories?: YampiCategory[];
  brand_id?: number | null;
  ncm?: string;
  skus?: YampiSku[];
  images?: Array<{ id?: number; url: string; active?: boolean }>;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardStats {
  totalProducts: number;
  totalCategories: number;
  activeProducts: number;
  productsWithoutCategory: number;
  productsWithoutDescription: number;
  productsWithoutImage: number;
  productsWithoutSeo: number;
}

export interface ConnectionStatus {
  connected: boolean;
  alias?: string;
  merchantName?: string;
  message: string;
  technicalError?: string;
  hasEnvKeys: boolean;
  configuredAlias?: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  timeFormatted: string;
  type: 'success' | 'warning' | 'error' | 'info';
  action: string;
  friendlyMessage: string;
  targetName?: string;
  technicalDetails?: {
    endpoint?: string;
    method?: string;
    statusCode?: number;
    payload?: any;
    rawError?: any;
    [key: string]: any;
  };
}

export interface UploadedImage {
  id: string;
  url: string;
  dataUrl: string;
  filename: string;
  size: number;
  isMain?: boolean;
}

export interface QuickProductPayload {
  name: string;
  categoryName: string;
  subcategoryName?: string;
  priceSale: number;
  priceDiscount?: number;
  priceCost?: number;
  stock: number;
  sku: string;
  description?: string;
  imageUrl?: string;
  images?: Array<{ url: string; active?: boolean; name?: string }>;
  weight?: number;
  height?: number;
  width?: number;
  length?: number;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  searchTerms?: string;
}

export interface MassImportItem {
  id: string;
  name: string;
  categoryName: string;
  subcategoryName?: string;
  priceSale: number;
  priceDiscount?: number;
  priceCost?: number;
  stock: number;
  sku: string;
  imageUrl?: string;
  description?: string;
  weight?: number;
  height?: number;
  width?: number;
  length?: number;
  status: 'ready' | 'warning' | 'error';
  warnings: string[];
  errors: string[];
  // execution state
  executionState?: 'pending' | 'processing' | 'success' | 'failed';
  executionMessage?: string;
  technicalError?: string;
  createdProductId?: number;
}

export interface AiCategorySuggestion {
  category: string;
  subcategories: string[];
}

export interface AiProductCategorization {
  productId: number;
  productName: string;
  currentCategory: string;
  suggestedCategory: string;
  suggestedSubcategory?: string;
  confidence: 'Alta' | 'Média' | 'Baixa';
  reason: string;
  selected?: boolean;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchedBy: 'name' | 'slug' | 'sku' | 'none';
  existingProduct?: YampiProduct;
  message?: string;
}
