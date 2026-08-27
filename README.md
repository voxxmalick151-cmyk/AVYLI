# 👑 KING Yampi Manager — Painel Inteligente & Automação de Catálogo Yampi

> Aplicação full-stack profissional desenvolvida para conectar, automatizar e organizar o catálogo de produtos e categorias de lojas da plataforma **Yampi**, com integração nativa ao **Google Gemini AI**.

---

## 🎯 Principais Funcionalidades

1. **Dashboard & Diagnóstico em Tempo Real**:
   - Métricas de saúde do catálogo (produtos sem categoria, sem imagem, sem descrição ou sem tags de SEO).
   - Teste de conexão visual com a API da Yampi.
   - Resumo das atividades e histórico recente de sincronizações.

2. **Cadastro Rápido de Produtos & SKUs**:
   - Criação simplificada de produto e SKU em um único clique.
   - Preços (venda, promocional e custo), estoque, peso e dimensões para cálculo de frete.
   - Detecção automática de produtos duplicados para proteger o catálogo.
   - Botão **"Gerar com IA"** para criar descrições comerciais persuasivas e meta tags de SEO.

3. **Gestão de Categorias em Até 2 Níveis**:
   - Suporte oficial à hierarquia da Yampi (Categorias Principais no Nível 1 e Subcategorias no Nível 2).
   - Criação e edição com URLs amigáveis (slugs) e otimização para o Google.
   - Prevenção contra categorias duplicadas.

4. **Importação em Massa com Fila Segura (Anti-Rate Limit)**:
   - Aceita arquivos **.CSV**, **.XLSX (Excel)** e colagem direta de planilhas.
   - Diagnóstico prévio (identifica dados inválidos, produtos sem categoria ou URLs com erro).
   - Fila sequencial de requisições com barra de progresso em tempo real, impedindo bloqueios de API.

5. **Inteligência Artificial Gemini**:
   - **Auto-Categorização**: analisa os produtos não categorizados e distribui de forma inteligente na árvore de categorias.
   - **Gerador de Taxonomia**: cria toda a árvore de categorias e subcategorias a partir do nicho da loja.
   - **Copywriting para E-commerce**: gera descrições detalhadas com benefícios e termos de busca para SEO.

6. **Auditoria & Diagnósticos Transparentes**:
   - Mensagens 100% em português amigável sem códigos HTTP assustadores.
   - Modal com detalhes técnicos e botão de cópia de diagnóstico para suporte.

---

## 🔒 Segurança de Credenciais

- **Nenhum token ou chave secreta é exposto no navegador.**
- Toda a comunicação com a API da Yampi (`https://api.dooki.com.br/v2/{alias}`) e com a API do Gemini é realizada exclusivamente no backend (servidor Node.js).
- Os cabeçalhos `User-Token` e `User-Secret-Key` residem de forma segura no servidor.

---

## 🚀 Como Executar Localmente

### 1. Pré-requisitos
- Node.js 18+ instalado.

### 2. Instalação e Inicialização
```bash
# Instalar dependências
npm install

# Iniciar em modo de desenvolvimento (Porta 3000)
npm run dev
```

Abra seu navegador em: `http://localhost:3000`

---

## ⚙️ Configuração de Variáveis de Ambiente (.env)

Crie um arquivo `.env` na raiz do projeto com suas credenciais:

```env
# Alias da sua loja na Yampi (exemplo: minha-loja)
YAMPI_ALIAS=minha-loja

# Chaves de API obtidas no painel da Yampi (Configurações > Desenvolvedores)
YAMPI_USER_TOKEN=seu_user_token_aqui
YAMPI_USER_SECRET_KEY=sua_user_secret_key_aqui

# Chave da API do Google Gemini (para automações e inteligência artificial)
GEMINI_API_KEY=sua_chave_gemini_aqui
```

*Nota: Você também pode inserir ou alterar suas credenciais da Yampi diretamente pela aba **Configurações** na interface web.*

---

## 📦 Como Obter as Credenciais na Yampi

1. Acesse o painel da sua loja em **app.yampi.com.br**;
2. No menu lateral, clique em **Configurações** > **Desenvolvedores / API**;
3. Copie o **Alias da Loja**, o **User-Token** e a **User-Secret-Key**;
4. Insira na tela de **Configurações** do KING Yampi Manager e clique em **"Testar & Salvar Conexão"**.

---

## ☁️ Deploy no GitHub & Vercel / Cloud Run

O projeto está estruturado com scripts universais:
- `npm run build`: compila o frontend React (Vite) e o backend Node.js (`dist/server.cjs`).
- `npm run start`: inicia o servidor de produção em Node.js.

### No Vercel / Cloud Run / Railway:
1. Conecte seu repositório GitHub;
2. Adicione as variáveis de ambiente (`YAMPI_ALIAS`, `YAMPI_USER_TOKEN`, `YAMPI_USER_SECRET_KEY`, `GEMINI_API_KEY`);
3. O build e deploy serão concluídos automaticamente.
