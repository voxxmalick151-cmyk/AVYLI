import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  YampiClient,
  getActiveCredentials,
  setRuntimeCredentials,
  hasConfiguredCredentials,
  slugify,
} from './server/yampiClient.js';
import { GeminiService } from './server/geminiService.js';
import { activityStore } from './server/activityStore.js';
import { QuickProductPayload, MassImportItem } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Serve uploaded images statically
  app.use('/uploads', express.static(uploadsDir));

  // ==========================================
  // API ROUTES
  // ==========================================

  // --- Health Check ---
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // --- Image Upload Endpoint (Receives base64/file directly from client) ---
  app.post('/api/upload-image', async (req: Request, res: Response) => {
    try {
      const { data, name, type } = req.body;
      if (!data) {
        return res.status(400).json({ friendlyMessage: 'Nenhum dado de imagem recebido.' });
      }

      // Check if data is a Base64 Data URL (e.g. data:image/png;base64,...)
      let buffer: Buffer;
      let extension = 'png';

      if (data.startsWith('data:')) {
        const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = 'jpg';
          else if (mimeType.includes('webp')) extension = 'webp';
          else if (mimeType.includes('gif')) extension = 'gif';
          else if (mimeType.includes('svg')) extension = 'svg';
          else extension = 'png';
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          buffer = Buffer.from(data, 'base64');
        }
      } else {
        buffer = Buffer.from(data, 'base64');
      }

      // Sanitize filename or generate unique name
      const safeBaseName = name ? slugify(path.parse(name).name).slice(0, 30) : 'foto';
      const uniqueFilename = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${safeBaseName}.${extension}`;
      const filePath = path.join(uploadsDir, uniqueFilename);

      await fs.promises.writeFile(filePath, buffer);

      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const relativeUrl = `/uploads/${uniqueFilename}`;
      const fullUrl = `${protocol}://${host}${relativeUrl}`;

      activityStore.add({
        type: 'info',
        action: 'Upload de Imagem',
        friendlyMessage: `Foto "${name || uniqueFilename}" enviada com sucesso (${Math.round(buffer.length / 1024)} KB).`,
        technicalDetails: {
          filename: uniqueFilename,
          sizeBytes: buffer.length,
          relativeUrl,
          fullUrl,
        },
      });

      res.status(201).json({
        success: true,
        url: relativeUrl,
        fullUrl,
        filename: uniqueFilename,
        size: buffer.length,
      });
    } catch (err: any) {
      console.error('Erro no upload de imagem:', err);
      res.status(500).json({
        friendlyMessage: 'Não foi possível processar o upload da imagem.',
        technicalError: err?.message,
      });
    }
  });

  // --- Attach / Upload Image directly to existing Product ---
  app.post('/api/yampi/products/:id/images', async (req: Request, res: Response) => {
    try {
      const productId = Number(req.params.id);
      const { data, url, name } = req.body;
      let finalImageUrl = url;

      if (data && !finalImageUrl) {
        // Upload base64 first
        let buffer: Buffer;
        let extension = 'png';
        if (data.startsWith('data:')) {
          const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const mimeType = matches[1];
            if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = 'jpg';
            else if (mimeType.includes('webp')) extension = 'webp';
            else if (mimeType.includes('gif')) extension = 'gif';
            else extension = 'png';
            buffer = Buffer.from(matches[2], 'base64');
          } else {
            buffer = Buffer.from(data, 'base64');
          }
        } else {
          buffer = Buffer.from(data, 'base64');
        }

        const safeBaseName = name ? slugify(path.parse(name).name).slice(0, 30) : 'foto';
        const uniqueFilename = `prod_${productId}_${Date.now()}_${safeBaseName}.${extension}`;
        const filePath = path.join(uploadsDir, uniqueFilename);
        await fs.promises.writeFile(filePath, buffer);

        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const host = req.headers['x-forwarded-host'] || req.get('host');
        finalImageUrl = `${protocol}://${host}/uploads/${uniqueFilename}`;
      }

      if (!finalImageUrl) {
        return res.status(400).json({ friendlyMessage: 'Nenhuma imagem ou URL fornecida.' });
      }

      const attachedImage = await YampiClient.attachProductImage(productId, finalImageUrl);

      activityStore.add({
        type: 'success',
        action: 'Foto Anexada ao Produto',
        friendlyMessage: `Foto adicionada ao produto #${productId} com sucesso.`,
        technicalDetails: { productId, imageUrl: finalImageUrl },
      });

      res.json({
        success: true,
        image: attachedImage,
        imageUrl: finalImageUrl,
        message: 'Foto enviada e vinculada ao produto na Yampi!',
      });
    } catch (err: any) {
      res.status(500).json({
        friendlyMessage: 'Erro ao anexar imagem ao produto na Yampi.',
        technicalError: err?.message,
      });
    }
  });

  // --- 1. Connection & Settings ---
  app.get('/api/yampi/status', async (req: Request, res: Response) => {
    const creds = getActiveCredentials();
    const hasEnvKeys = Boolean(process.env.YAMPI_USER_TOKEN && process.env.YAMPI_USER_SECRET_KEY);
    const hasAlias = Boolean(creds.alias);

    res.json({
      hasConfiguredKeys: Boolean(creds.userToken && creds.userSecretKey && creds.alias),
      hasEnvKeys,
      configuredAlias: creds.alias || undefined,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  app.post('/api/yampi/configure', (req: Request, res: Response) => {
    const { alias, userToken, userSecretKey } = req.body;
    if (alias || userToken || userSecretKey) {
      setRuntimeCredentials({
        alias: alias ? alias.trim() : undefined,
        userToken: userToken ? userToken.trim() : undefined,
        userSecretKey: userSecretKey ? userSecretKey.trim() : undefined,
      });
      activityStore.add({
        type: 'info',
        action: 'Credenciais Atualizadas',
        friendlyMessage: 'Credenciais da loja configuradas em memória com sucesso.',
      });
    }
    res.json({ success: true, message: 'Configurações salvas no servidor.' });
  });

  app.post('/api/yampi/test', async (req: Request, res: Response) => {
    try {
      const { alias, userToken, userSecretKey } = req.body || {};
      if (alias || userToken || userSecretKey) {
        setRuntimeCredentials({
          alias: alias ? alias.trim() : undefined,
          userToken: userToken ? userToken.trim() : undefined,
          userSecretKey: userSecretKey ? userSecretKey.trim() : undefined,
        });
      }

      const result = await YampiClient.testConnection();
      res.json(result);
    } catch (err: any) {
      res.status(400).json({
        connected: false,
        message: err?.friendlyMessage || 'Falha ao testar conexão.',
        technicalError: err?.technicalError || err?.message,
      });
    }
  });

  // --- 2. Dashboard Stats ---
  app.get('/api/dashboard/stats', async (req: Request, res: Response) => {
    try {
      if (!hasConfiguredCredentials()) {
        return res.json({
          totalProducts: 0,
          totalCategories: 0,
          activeProducts: 0,
          productsWithoutCategory: 0,
          productsWithoutDescription: 0,
          productsWithoutImage: 0,
          productsWithoutSeo: 0,
        });
      }

      const [categories, productsData] = await Promise.all([
        YampiClient.getCategories().catch(() => []),
        YampiClient.getProducts({ limit: 250 }).catch(() => ({ products: [], total: 0 })),
      ]);

      const products = productsData.products || [];
      const totalProducts = productsData.total || products.length;
      const totalCategories = categories.length;

      let activeProducts = 0;
      let productsWithoutCategory = 0;
      let productsWithoutDescription = 0;
      let productsWithoutImage = 0;
      let productsWithoutSeo = 0;

      for (const p of products) {
        if (p.active) activeProducts++;
        const hasCat = Boolean(p.category || (p.categories_ids && p.categories_ids.length > 0) || (p.categories && p.categories.length > 0));
        if (!hasCat) productsWithoutCategory++;
        if (!p.description || p.description.trim().length === 0) productsWithoutDescription++;
        const hasImg = Boolean(p.images && p.images.length > 0) || (p.skus && p.skus.some(s => s.images && s.images.length > 0));
        if (!hasImg) productsWithoutImage++;
        if (!p.seo_title && !p.seo_description) productsWithoutSeo++;
      }

      res.json({
        totalProducts,
        totalCategories,
        activeProducts,
        productsWithoutCategory,
        productsWithoutDescription,
        productsWithoutImage,
        productsWithoutSeo,
      });
    } catch (err: any) {
      res.status(500).json({
        friendlyMessage: err?.friendlyMessage || 'Erro ao carregar estatísticas do dashboard.',
        technicalError: err?.technicalError || err?.message,
      });
    }
  });

  // --- 3. Categories ---
  app.get('/api/yampi/categories', async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string;
      const categories = await YampiClient.getCategories({ search });
      res.json({ categories });
    } catch (err: any) {
      res.status(err?.status || 500).json({
        friendlyMessage: err?.friendlyMessage || 'Erro ao listar categorias.',
        technicalError: err?.technicalError || err?.message,
      });
    }
  });

  app.post('/api/yampi/categories', async (req: Request, res: Response) => {
    try {
      const { name, active, slug, parent_id, featured, seo_title, seo_keywords, seo_description, order, sort_by } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({
          friendlyMessage: 'O nome da categoria é obrigatório.',
        });
      }

      const targetParentId = parent_id ? Number(parent_id) : null;
      const targetSlug = slug?.trim() || slugify(name);

      // Check for exact duplicate under same parent
      const existing = await YampiClient.getCategories();
      const isDuplicate = existing.some(
        c =>
          (c.name.toLowerCase() === name.trim().toLowerCase() || c.slug.toLowerCase() === targetSlug.toLowerCase()) &&
          (c.parent_id || null) === targetParentId
      );

      if (isDuplicate) {
        return res.status(400).json({
          friendlyMessage: `Já existe uma categoria ou subcategoria com o nome "${name}" neste mesmo nível.`,
          technicalError: 'Duplicate category detected under same parent',
        });
      }

      const created = await YampiClient.createCategory({
        name,
        active,
        slug: targetSlug,
        parent_id: targetParentId,
        featured,
        seo_title,
        seo_keywords,
        seo_description,
        order,
        sort_by,
      });

      res.status(201).json({ category: created });
    } catch (err: any) {
      res.status(err?.status || 500).json({
        friendlyMessage: err?.friendlyMessage || 'Não foi possível criar a categoria.',
        technicalError: err?.technicalError || err?.message,
      });
    }
  });

  // Batch structure creation with duplicate prevention & parent ID reuse
  app.post('/api/yampi/categories/batch-structure', async (req: Request, res: Response) => {
    try {
      const { structure } = req.body;

      if (!Array.isArray(structure) || structure.length === 0) {
        return res.status(400).json({
          friendlyMessage: 'Nenhuma estrutura de categorias enviada para criação.',
        });
      }

      // 1. Fetch current categories from Yampi as source of truth
      const allExisting = await YampiClient.getCategories();

      let createdParents = 0;
      let reusedParents = 0;
      let createdSubs = 0;
      let reusedSubs = 0;

      const createdList: string[] = [];

      for (const item of structure) {
        if (!item || item.selected === false || !item.name?.trim()) continue;

        const mainNameClean = item.name.trim();
        const mainSlugClean = item.slug?.trim() || slugify(mainNameClean);

        // Check if root category already exists in Yampi
        let rootCat = allExisting.find(
          c => !c.parent_id && (c.name.toLowerCase() === mainNameClean.toLowerCase() || c.slug.toLowerCase() === mainSlugClean.toLowerCase())
        );

        let parentId: number;

        if (rootCat) {
          parentId = rootCat.id;
          reusedParents++;
        } else {
          // Create main category
          const newRoot = await YampiClient.createCategory({
            name: mainNameClean,
            slug: mainSlugClean,
            active: true,
          });
          parentId = newRoot.id;
          createdParents++;
          createdList.push(mainNameClean);
          // Add to local cache so subsequent checks see it
          allExisting.push(newRoot);
        }

        // Process subcategories
        if (Array.isArray(item.subcategories) && item.subcategories.length > 0) {
          for (const sub of item.subcategories) {
            if (!sub || sub.selected === false || !sub.name?.trim()) continue;

            const subNameClean = sub.name.trim();
            const subSlugClean = sub.slug?.trim() || slugify(subNameClean);

            // Check if subcategory already exists under this parent_id
            const existingSub = allExisting.find(
              c =>
                c.parent_id === parentId &&
                (c.name.toLowerCase() === subNameClean.toLowerCase() || c.slug.toLowerCase() === subSlugClean.toLowerCase())
            );

            if (existingSub) {
              reusedSubs++;
            } else {
              // Rate-friendly small pause
              await new Promise(r => setTimeout(r, 150));

              const newSub = await YampiClient.createCategory({
                name: subNameClean,
                slug: subSlugClean,
                parent_id: parentId,
                active: true,
              });
              createdSubs++;
              createdList.push(`${mainNameClean} > ${subNameClean}`);
              allExisting.push(newSub);
            }
          }
        }
      }

      const totalCreated = createdParents + createdSubs;

      activityStore.add({
        type: 'success',
        action: 'Estrutura de Categorias Aplicada',
        friendlyMessage: `Estrutura aplicada na Yampi: ${createdParents} categoria(s) principal(is) e ${createdSubs} subcategoria(s) criadas (${reusedParents + reusedSubs} já existentes reaproveitadas).`,
        technicalDetails: {
          createdParents,
          reusedParents,
          createdSubs,
          reusedSubs,
          totalCreated,
        },
      });

      res.status(200).json({
        success: true,
        createdParents,
        reusedParents,
        createdSubs,
        reusedSubs,
        totalCreated,
        message: totalCreated > 0
          ? `${totalCreated} nova(s) categoria(s) cadastrada(s) na Yampi com sucesso!`
          : `Todas as categorias selecionadas já estavam cadastradas na Yampi.`,
      });
    } catch (err: any) {
      res.status(err?.status || 500).json({
        friendlyMessage: err?.friendlyMessage || 'Erro ao criar estrutura de categorias na Yampi.',
        technicalError: err?.technicalError || err?.message,
      });
    }
  });

  app.put('/api/yampi/categories/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const updated = await YampiClient.updateCategory(id, req.body);
      res.json({ category: updated });
    } catch (err: any) {
      res.status(err?.status || 500).json({
        friendlyMessage: err?.friendlyMessage || 'Não foi possível atualizar a categoria.',
        technicalError: err?.technicalError || err?.message,
      });
    }
  });

  // --- 4. Products ---
  app.get('/api/yampi/products', async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string;
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 50;

      const result = await YampiClient.getProducts({ search, page, limit });
      res.json(result);
    } catch (err: any) {
      res.status(err?.status || 500).json({
        friendlyMessage: err?.friendlyMessage || 'Erro ao listar produtos.',
        technicalError: err?.technicalError || err?.message,
      });
    }
  });

  app.get('/api/yampi/products/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const product = await YampiClient.getProduct(id);
      res.json({ product });
    } catch (err: any) {
      res.status(err?.status || 500).json({
        friendlyMessage: err?.friendlyMessage || 'Erro ao carregar detalhes do produto.',
        technicalError: err?.technicalError || err?.message,
      });
    }
  });

  app.post('/api/yampi/products', async (req: Request, res: Response) => {
    try {
      const created = await YampiClient.createProduct(req.body);
      res.status(201).json({ product: created });
    } catch (err: any) {
      res.status(err?.status || 500).json({
        friendlyMessage: err?.friendlyMessage || 'Não foi possível criar o produto.',
        technicalError: err?.technicalError || err?.message,
      });
    }
  });

  app.put('/api/yampi/products/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const updated = await YampiClient.updateProduct(id, req.body);
      res.json({ product: updated });
    } catch (err: any) {
      res.status(err?.status || 500).json({
        friendlyMessage: err?.friendlyMessage || 'Não foi possível atualizar o produto.',
        technicalError: err?.technicalError || err?.message,
      });
    }
  });

  // --- 5. SKUs ---
  app.post('/api/yampi/skus', async (req: Request, res: Response) => {
    try {
      const sku = await YampiClient.createSku(req.body);
      res.status(201).json({ sku });
    } catch (err: any) {
      res.status(err?.status || 500).json({
        friendlyMessage: err?.friendlyMessage || 'Não foi possível cadastrar o SKU.',
        technicalError: err?.technicalError || err?.message,
      });
    }
  });

  // --- 6. Duplicate Check ---
  app.post('/api/yampi/check-duplicate', async (req: Request, res: Response) => {
    try {
      const { name, sku, slug } = req.body;
      const targetSlug = slug || (name ? slugify(name) : '');

      const productsRes = await YampiClient.getProducts({ search: name?.trim(), limit: 20 });
      const products = productsRes.products || [];

      for (const p of products) {
        if (name && p.name.trim().toLowerCase() === name.trim().toLowerCase()) {
          return res.json({
            isDuplicate: true,
            matchedBy: 'name',
            existingProduct: p,
            message: `Já existe um produto com o mesmo nome: "${p.name}".`,
          });
        }
        if (targetSlug && p.slug && p.slug.toLowerCase() === targetSlug.toLowerCase()) {
          return res.json({
            isDuplicate: true,
            matchedBy: 'slug',
            existingProduct: p,
            message: `Já existe um produto com a mesma URL/Slug: "${p.slug}".`,
          });
        }
        if (sku && p.skus && p.skus.some(s => s.sku && s.sku.trim().toLowerCase() === sku.trim().toLowerCase())) {
          return res.json({
            isDuplicate: true,
            matchedBy: 'sku',
            existingProduct: p,
            message: `Já existe um produto com o SKU "${sku}" associado.`,
          });
        }
      }

      res.json({ isDuplicate: false, matchedBy: 'none' });
    } catch (err: any) {
      res.json({ isDuplicate: false, matchedBy: 'none' });
    }
  });

  // --- 7. Quick Create (Cadastro Rápido) ---
  app.post('/api/yampi/quick-create', async (req: Request, res: Response) => {
    const payload: QuickProductPayload = req.body;

    try {
      // 1. Validate
      if (!payload.name || !payload.name.trim()) {
        return res.status(400).json({ friendlyMessage: 'O nome do produto é obrigatório.' });
      }
      if (!payload.priceSale || Number(payload.priceSale) <= 0) {
        return res.status(400).json({ friendlyMessage: 'O preço de venda é obrigatório e deve ser maior que zero.' });
      }

      // 2. Resolve Category & Subcategory
      const allCategories = await YampiClient.getCategories();
      let categoryId: number | undefined;

      if (payload.categoryName && payload.categoryName.trim()) {
        const catNameClean = payload.categoryName.trim().toLowerCase();
        let targetCat = allCategories.find(c => c.name.toLowerCase() === catNameClean && !c.parent_id);

        if (!targetCat) {
          // Auto create parent category
          targetCat = await YampiClient.createCategory({ name: payload.categoryName.trim() });
        }

        if (targetCat) {
          categoryId = targetCat.id;

          // Check subcategory if requested
          if (payload.subcategoryName && payload.subcategoryName.trim()) {
            const subNameClean = payload.subcategoryName.trim().toLowerCase();
            let targetSub = allCategories.find(
              c => c.name.toLowerCase() === subNameClean && c.parent_id === targetCat!.id
            );

            if (!targetSub) {
              targetSub = await YampiClient.createCategory({
                name: payload.subcategoryName.trim(),
                parent_id: targetCat.id,
              });
            }

            if (targetSub) {
              categoryId = targetSub.id;
            }
          }
        }
      }

      // 3. Create Product
      const product = await YampiClient.createProduct({
        name: payload.name.trim(),
        description: payload.description,
        categories_ids: categoryId ? [categoryId] : undefined,
        seo_title: payload.seoTitle,
        seo_description: payload.seoDescription,
        seo_keywords: payload.seoKeywords,
        search_terms: payload.searchTerms,
      });

      // 4. Prepare Images (from images array or single imageUrl)
      const imageList: Array<{ url: string; active?: boolean }> = [];
      if (payload.images && payload.images.length > 0) {
        payload.images.forEach(img => {
          if (img.url) imageList.push({ url: img.url, active: img.active ?? true });
        });
      } else if (payload.imageUrl) {
        imageList.push({ url: payload.imageUrl, active: true });
      }

      // 5. Create SKU with Images
      const generatedSkuCode = payload.sku?.trim() || `SKU-${slugify(payload.name).toUpperCase().slice(0, 10)}-${Date.now().toString().slice(-4)}`;
      const skuImages = imageList.length > 0 ? imageList : undefined;

      const sku = await YampiClient.createSku({
        product_id: product.id,
        sku: generatedSkuCode,
        price_sale: Number(payload.priceSale),
        price_discount: payload.priceDiscount ? Number(payload.priceDiscount) : undefined,
        price_cost: payload.priceCost ? Number(payload.priceCost) : undefined,
        weight: payload.weight ? Number(payload.weight) : undefined,
        height: payload.height ? Number(payload.height) : undefined,
        width: payload.width ? Number(payload.width) : undefined,
        length: payload.length ? Number(payload.length) : undefined,
        images: skuImages,
      });

      // 6. Attach images directly to product in Yampi
      for (const img of imageList) {
        if (img.url) {
          await YampiClient.attachProductImage(product.id, img.url);
        }
      }

      activityStore.add({
        type: 'success',
        action: 'Cadastro Rápido Concluído',
        friendlyMessage: `Produto "${payload.name}" cadastrado com sucesso com SKU "${generatedSkuCode}".`,
        technicalDetails: {
          payload: {
            productId: product.id,
            skuId: sku.id,
            priceSale: payload.priceSale,
          },
        },
      });

      res.status(201).json({
        success: true,
        product,
        sku,
        message: `Produto "${payload.name}" criado com sucesso na Yampi!`,
      });
    } catch (err: any) {
      activityStore.add({
        type: 'error',
        action: 'Falha no Cadastro Rápido',
        friendlyMessage: err?.friendlyMessage || `Falha ao cadastrar o produto "${payload.name}".`,
        technicalDetails: {
          rawError: err?.technicalError || err,
        },
      });

      res.status(err?.status || 500).json({
        friendlyMessage: err?.friendlyMessage || 'Erro ao realizar o cadastro do produto.',
        technicalError: err?.technicalError || err?.message,
      });
    }
  });

  // --- 8. Batch Item Importer (Sequential Worker Endpoint) ---
  app.post('/api/yampi/batch-import-item', async (req: Request, res: Response) => {
    const item: MassImportItem = req.body;

    try {
      if (!item.name || !item.name.trim()) {
        return res.status(400).json({ friendlyMessage: 'Nome do produto ausente.' });
      }
      if (!item.priceSale || Number(item.priceSale) <= 0) {
        return res.status(400).json({ friendlyMessage: 'Preço de venda inválido ou ausente.' });
      }

      // Resolve category
      let categoryId: number | undefined;
      if (item.categoryName && item.categoryName.trim()) {
        const allCategories = await YampiClient.getCategories();
        let cat = allCategories.find(c => c.name.toLowerCase() === item.categoryName.trim().toLowerCase() && !c.parent_id);
        if (!cat) {
          cat = await YampiClient.createCategory({ name: item.categoryName.trim() });
        }

        if (cat) {
          categoryId = cat.id;
          if (item.subcategoryName && item.subcategoryName.trim()) {
            let sub = allCategories.find(
              c => c.name.toLowerCase() === item.subcategoryName.trim().toLowerCase() && c.parent_id === cat!.id
            );
            if (!sub) {
              sub = await YampiClient.createCategory({
                name: item.subcategoryName.trim(),
                parent_id: cat.id,
              });
            }
            if (sub) {
              categoryId = sub.id;
            }
          }
        }
      }

      // Create product
      const product = await YampiClient.createProduct({
        name: item.name.trim(),
        description: item.description,
        categories_ids: categoryId ? [categoryId] : undefined,
      });

      // Create SKU
      const skuCode = item.sku?.trim() || `SKU-${slugify(item.name).toUpperCase().slice(0, 10)}-${Date.now().toString().slice(-4)}`;
      const skuImages = item.imageUrl ? [{ url: item.imageUrl, active: true }] : undefined;

      const sku = await YampiClient.createSku({
        product_id: product.id,
        sku: skuCode,
        price_sale: Number(item.priceSale),
        price_discount: item.priceDiscount ? Number(item.priceDiscount) : undefined,
        price_cost: item.priceCost ? Number(item.priceCost) : undefined,
        weight: item.weight ? Number(item.weight) : undefined,
        height: item.height ? Number(item.height) : undefined,
        width: item.width ? Number(item.width) : undefined,
        length: item.length ? Number(item.length) : undefined,
        images: skuImages,
      });

      if (item.imageUrl) {
        await YampiClient.attachProductImage(product.id, item.imageUrl);
      }

      res.status(201).json({
        success: true,
        productId: product.id,
        skuId: sku.id,
        productName: item.name,
      });
    } catch (err: any) {
      res.status(err?.status || 500).json({
        friendlyMessage: err?.friendlyMessage || `Falha ao importar "${item.name}".`,
        technicalError: err?.technicalError || err?.message,
      });
    }
  });

  // --- 9. AI Services ---
  app.post('/api/ai/category-structure', async (req: Request, res: Response) => {
    try {
      const { prompt } = req.body;
      if (!prompt || !prompt.trim()) {
        return res.status(400).json({ friendlyMessage: 'Por favor, descreva o que sua loja vende.' });
      }

      const suggestions = await GeminiService.generateCategoryStructure(prompt);
      activityStore.add({
        type: 'info',
        action: 'Estrutura de Categorias Gerada com IA',
        friendlyMessage: `A IA gerou uma estrutura com ${suggestions.length} categorias principais.`,
      });

      res.json({ suggestions });
    } catch (err: any) {
      res.status(500).json({
        friendlyMessage: err?.message || 'Não foi possível gerar a estrutura com IA. Verifique se o Gemini está disponível.',
        technicalError: err?.message,
      });
    }
  });

  app.post('/api/ai/categorize-products', async (req: Request, res: Response) => {
    try {
      const { products, categories } = req.body;
      const suggestions = await GeminiService.categorizeProducts(products, categories);

      activityStore.add({
        type: 'info',
        action: 'Organização de Produtos com IA',
        friendlyMessage: `A IA analisou ${suggestions.length} produtos e sugeriu novas categorias.`,
      });

      res.json({ suggestions });
    } catch (err: any) {
      res.status(500).json({
        friendlyMessage: err?.message || 'Erro ao organizar produtos com IA.',
        technicalError: err?.message,
      });
    }
  });

  app.post('/api/ai/generate-copy', async (req: Request, res: Response) => {
    try {
      const { name, category, brand, price, knownDetails } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ friendlyMessage: 'O nome do produto é obrigatório para gerar o conteúdo.' });
      }

      const copyData = await GeminiService.generateProductCopy({
        name,
        category,
        brand,
        price,
        knownDetails,
      });

      activityStore.add({
        type: 'info',
        action: 'Descrição & SEO Gerados com IA',
        friendlyMessage: `Descrição e tags de SEO geradas para o produto "${name}".`,
      });

      res.json(copyData);
    } catch (err: any) {
      res.status(500).json({
        friendlyMessage: err?.message || 'Erro ao gerar descrição com IA.',
        technicalError: err?.message,
      });
    }
  });

  // --- 10. Activity Logs ---
  app.get('/api/logs', (req: Request, res: Response) => {
    res.json({ logs: activityStore.getAll() });
  });

  app.delete('/api/logs', (req: Request, res: Response) => {
    activityStore.clear();
    res.json({ success: true, logs: activityStore.getAll() });
  });

  // ==========================================
  // Vite Integration (Dev) & Static Files (Prod)
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KING Yampi Manager backend running on port ${PORT}`);
  });
}

startServer();
