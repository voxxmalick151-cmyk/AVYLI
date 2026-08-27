import { GoogleGenAI, Type } from '@google/genai';
import { AiCategorySuggestion, AiProductCategorization } from '../src/types.js';

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export class GeminiService {
  public static async generateCategoryStructure(prompt: string): Promise<AiCategorySuggestion[]> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('IA ainda não configurada. A variável de ambiente GEMINI_API_KEY não foi encontrada. Configure-a para habilitar a geração de categorias com IA.');
    }

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: `Você é um especialista sênior em e-commerce brasileiro e taxonomia de catálogo da plataforma Yampi.
A Yampi suporta ESTRITAMENTE 2 níveis de categorias: Nível 1 (Categoria Principal) e Nível 2 (Subcategoria).

Com base na seguinte descrição da loja ou segmento:
"${prompt}"

Crie uma estrutura inteligente, profissional, intuitiva e comercial de Categorias e Subcategorias para a loja.
Não ultrapasse 2 níveis de profundidade.

Responda exclusivamente no formato JSON especificado.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            categories: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: {
                    type: Type.STRING,
                    description: 'Nome da Categoria Principal (Nível 1), ex: Moda Masculina, Calçados, Eletrônicos',
                  },
                  subcategories: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.STRING,
                    },
                    description: 'Lista de Subcategorias (Nível 2), ex: Camisetas, Calças, Bermudas',
                  },
                },
                required: ['category', 'subcategories'],
              },
            },
          },
          required: ['categories'],
        },
      },
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    return parsed.categories || [];
  }

  public static async categorizeProducts(
    products: Array<{ id: number; name: string; currentCategory?: string; description?: string }>,
    availableCategories: Array<{ id: number; name: string; subcategories?: string[] }>
  ): Promise<AiProductCategorization[]> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Chave de API do Gemini não configurada no servidor.');
    }

    const ai = getGeminiClient();

    const prompt = `Você é um especialista em catálogo de e-commerce na Yampi.
Temos os seguintes produtos que precisam ser organizados ou alocados nas categorias corretas:

PRODUTOS:
${JSON.stringify(products.slice(0, 30), null, 2)}

CATEGORIAS DISPONÍVEIS NA LOJA:
${JSON.stringify(availableCategories, null, 2)}

Para cada produto, analise seu nome e contexto e sugira a Categoria Principal e Subcategoria (se aplicável) mais adequadas entre as categorias disponíveis (ou sugira uma nova se nenhuma for aplicável). Defina o nível de confiança (Alta, Média, Baixa) e uma breve justificativa em português.

Responda em formato JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  productId: { type: Type.INTEGER },
                  productName: { type: Type.STRING },
                  currentCategory: { type: Type.STRING },
                  suggestedCategory: { type: Type.STRING },
                  suggestedSubcategory: { type: Type.STRING },
                  confidence: {
                    type: Type.STRING,
                    description: 'Alta, Média ou Baixa',
                  },
                  reason: { type: Type.STRING },
                },
                required: ['productId', 'productName', 'suggestedCategory', 'confidence', 'reason'],
              },
            },
          },
          required: ['suggestions'],
        },
      },
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    return (parsed.suggestions || []).map((s: any) => ({
      ...s,
      currentCategory: s.currentCategory || 'Sem Categoria',
      selected: true,
    }));
  }

  public static async generateProductCopy(productData: {
    name: string;
    category?: string;
    brand?: string;
    price?: number;
    knownDetails?: string;
  }): Promise<{
    description: string;
    seoTitle: string;
    seoDescription: string;
    seoKeywords: string;
    searchTerms: string;
  }> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Chave de API do Gemini não configurada no servidor.');
    }

    const ai = getGeminiClient();

    const prompt = `Você é um copywriter sênior especializado em e-commerce e SEO no Brasil.
Gere uma descrição persuasiva, profissional e bem estruturada para o produto abaixo, juntamente com todas as tags de SEO recomendadas para a Yampi.

DADOS CONHECIDOS DO PRODUTO:
- Nome: "${productData.name}"
- Categoria: "${productData.category || 'Geral'}"
- Marca: "${productData.brand || 'Não informada'}"
- Preço: "${productData.price ? 'R$ ' + productData.price : 'Não informado'}"
- Detalhes/Notas adicionais: "${productData.knownDetails || 'Nenhum detalhe extra fornecido'}"

DIRETRIZ CRÍTICA:
- NÃO INVENTE especificações técnicas falsas (como voltagem, milímetros exatos, composições químicas ou materiais específicos não mencionados).
- Se alguma informação específica estiver ausente, escreva o texto enfatizando os benefícios reais conhecidos, qualidade, praticidade e valor para o cliente sem inventar dados técnicos fantasiosos.
- Estruture a descrição em HTML limpo ou parágrafos com títulos e bullet points elegantes.
- SEO Title: máximo 60 caracteres, otimizado para o Google.
- SEO Description: máximo 155 caracteres, persuasivo com chamada para ação.
- SEO Keywords: 5 a 10 palavras-chave relevantes separadas por vírgula.
- Search Terms: termos de busca e variações que o cliente digitaria no campo de busca da loja.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            seoTitle: { type: Type.STRING },
            seoDescription: { type: Type.STRING },
            seoKeywords: { type: Type.STRING },
            searchTerms: { type: Type.STRING },
          },
          required: ['description', 'seoTitle', 'seoDescription', 'seoKeywords', 'searchTerms'],
        },
      },
    });

    const text = response.text || '{}';
    return JSON.parse(text);
  }
}
