# Feito à Mão · Vitrine Artesanal

Vitrine digital para uma artesã de costura divulgar e vender suas peças (bolsas, nécessaires, carteiras, acessórios). Os clientes navegam pelo catálogo e fazem o pedido pelo **WhatsApp**. Não há carrinho nem pagamento online.

A artesã administra tudo sozinha, inclusive pelo celular: cadastra produtos, troca fotos, muda preços e marca o que está disponível, sob encomenda ou esgotado. Sem escrever uma linha de código.

## O que tem no projeto

O projeto tem três áreas, cada uma com sua própria página (ou conjunto de páginas).

| Área | Arquivo | Quem usa |
|---|---|---|
| **Vitrine pública** | `index.html` + `pages/*.html` | Clientes |
| **Painel da loja** | `admin.html` | A artesã (função `admin`) |
| **Central do superadmin** | `superadmin.html` | O desenvolvedor (função `superadmin`) |

### Vitrine pública
A vitrine é multipágina: `index.html` (início) e as páginas em `pages/` — `colecao.html`, `historia.html` e `contato.html` —, todas compartilhando o mesmo cabeçalho, rodapé e gaveta lateral de navegação.

- Catálogo (em `pages/colecao.html`) com busca por texto e filtro por categoria. As categorias aparecem sozinhas a partir dos produtos cadastrados.
- Janela de detalhes de cada produto, com galeria (várias fotos, se o produto tiver mais de uma) e o botão **Consultar pelo WhatsApp**, que já abre a conversa com uma mensagem pronta citando o produto.
- Produtos esgotados mostram o aviso de indisponível, sem botão de WhatsApp.
- Gaveta lateral (menu ☰) com um link para a área administrativa — ela não esconde nem protege o `admin.html`, só facilita o acesso; quem protege é o login.
- Scroll Reveal (elementos aparecem ao rolar a página), revelação de títulos e transições suaves entre páginas (View Transitions API, com navegação normal como alternativa em navegadores sem suporte). Tudo respeita a preferência `prefers-reduced-motion`.
- Alternância entre tema claro e escuro, lembrada no navegador.
- Tags Open Graph e Twitter Card para o link aparecer com prévia no WhatsApp e no Telegram.
- Se o banco ainda não tiver produtos (ou se a conexão falhar), a vitrine mostra **produtos de demonstração**. Eles somem assim que o primeiro produto real é cadastrado.

### Painel da loja (`admin.html`)
- Login com e-mail e senha. Só entram contas com função `admin` ou `superadmin` na tabela `profiles`.
- Cadastro, edição e exclusão de produtos, com busca e filtro por disponibilidade.
- Envio de foto (JPG, PNG ou WebP, até 5 MB). A imagem é **redimensionada e comprimida no navegador** antes do envio (maior lado de 1600 px).
- Limpeza automática: ao trocar ou excluir um produto, a foto antiga é removida do armazenamento, desde que nenhum outro produto a use.
- Tema claro/escuro e cor de destaque à escolha, salvos no aparelho.

### Central do superadmin (`superadmin.html`)
- Acesso exclusivo para contas com função `superadmin`.
- Páginas: visão geral com contadores, produtos, perfis, pedidos, auditoria (`activity_logs`), diagnóstico de conexão e aparência.
- Nesta versão ela é **somente leitura**. Ainda não promove contas nem edita funções.
- O diagnóstico testa, a partir do navegador, a sessão e a leitura de cada tabela.

## Tecnologias

- **HTML, CSS e JavaScript puros**, sem framework e sem etapa de build.
- **[Supabase](https://supabase.com)** para banco de dados (Postgres), autenticação e armazenamento de imagens.
- `@supabase/supabase-js` v2, carregado por CDN nos painéis.
- Fontes do Google Fonts (DM Sans e Playfair Display) na vitrine.

## Estrutura de arquivos

```
.
├── index.html          # Vitrine pública — início
├── pages/
│   ├── colecao.html     # Catálogo, busca, filtros e galeria
│   ├── historia.html    # Página institucional
│   └── contato.html     # Contato (WhatsApp)
├── site.css             # Navegação, gaveta lateral, temas e animações da vitrine
├── site.js              # Menu, tema, Scroll Reveal e catálogo público
├── styles.css           # Tokens visuais e componentes de base, usados por toda a vitrine
├── admin.html           # Painel da loja (estilos embutidos)
├── admin.js             # Login, CRUD de produtos, upload e compressão de imagens
├── superadmin.html      # Central do superadmin (produção)
├── superadmin.js        # Consultas, diagnóstico e preferências de aparência
├── superadmin.css       # Estilos da central
└── app.js                # Não usado por nenhuma página atualmente (ficou órfão
                           # depois que o index.html passou a usar site.js)
```

Também existem, só para o **ambiente de testes** (ver seção própria abaixo): `superadmin-teste.html`, `superadmin-teste.js`, `superadmin-users.js`, `preview.html`/`preview.js` e a pasta `supabase/migrations`.

## Como funciona

```
Cliente ──► index.html / pages/*.html ──► Supabase (lê products, público)
   │
   └──► WhatsApp (pedido feito por conversa)

Artesã ──► admin.html ──► Supabase Auth ──► products + Storage (escreve)
Superadmin ──► superadmin.html ──► Supabase (lê products, profiles, orders, activity_logs)
```

A vitrine lê os produtos pela API REST do Supabase, ordenados do mais novo para o mais antigo. Os painéis usam o `supabase-js` e mantêm a sessão no navegador.

## Banco de dados (Supabase)

Todas as tabelas ficam no schema `public`, com **RLS (Row Level Security) ligado**.

| Tabela | Para que serve |
|---|---|
| `products` | Catálogo: nome, categoria, descrição, preço, `image_url` e `status` (`available`, `made_to_order` ou `sold_out`) |
| `profiles` | Uma linha por conta de login, com `display_name` e `role` (`admin` ou `superadmin`), ligada a `auth.users` |
| `orders` | Estrutura para registrar pedidos (cliente, telefone, observações, status). **A vitrine ainda não grava aqui**, porque os pedidos saem pelo WhatsApp |
| `activity_logs` | Estrutura para auditoria (quem fez o quê). **Ainda não há registro automático de eventos** |

Imagens ficam no bucket público **`product-images`**, que aceita só JPG, PNG e WebP, com limite de 5 MB por arquivo.

### Quem pode fazer o quê

| Recurso | Visitante (sem login) | `admin` | `superadmin` |
|---|---|---|---|
| Ver produtos e imagens | Sim | Sim | Sim |
| Criar, editar e excluir produtos | Não | Sim | Sim |
| Enviar, trocar e apagar imagens | Não | Sim | Sim |
| Gerenciar pedidos (`orders`) | Não | Sim | Sim |
| Ver o próprio perfil | Não | Sim | Sim |
| Gerenciar todos os perfis | Não | Não | Sim |
| Ver auditoria (`activity_logs`) | Não | Não | Sim |

Essas regras são aplicadas **no banco**, pelas políticas de RLS. Esconder um botão na tela não é o que protege os dados.

## Como rodar localmente

Não precisa instalar nada além de um servidor de arquivos estáticos.

```bash
git clone https://github.com/guilhermechieregato7-beep/website-.git
cd website-

# qualquer servidor estático serve, por exemplo:
python3 -m http.server 8000
```

Depois abra:

- Vitrine: <http://localhost:8000/index.html>
- Catálogo: <http://localhost:8000/pages/colecao.html>
- Painel da loja: <http://localhost:8000/admin.html>
- Superadmin: <http://localhost:8000/superadmin.html>

Se preferir, use a extensão **Live Server** do VS Code.

## Configuração

**WhatsApp.** O número que recebe os pedidos fica na constante `WHATSAPP_NUMBER` no início do `site.js` (vitrine) e também em `pages/contato.html`, só com dígitos e com código do país e DDD (por exemplo, `55` + DDD + número).

**Supabase.** `SUPABASE_URL` e `SUPABASE_KEY` aparecem no começo de `site.js`, `admin.js` e `superadmin.js`. Se trocar de projeto, atualize os três arquivos.

**Imagem de prévia do link.** As tags `og:image` e `twitter:image` do `index.html` apontam para um `og-image.jpg` que **ainda não existe** no repositório. Adicione uma foto de capa de **1200×630 px** (de preferência até ~300 KB) na raiz com esse nome.

**Endereço do site.** As tags `og:url` apontam para o GitHub Pages deste repositório. Se o site for publicado em outro endereço, atualize essas URLs no `index.html`.

## Segurança

- A chave usada no navegador é a **publishable key** do Supabase, feita para ser pública. Quem protege os dados são as políticas de RLS.
- **Nunca** coloque a chave `service_role` ou qualquer outro segredo do Supabase neste repositório, que é público.
- `admin.html` e `superadmin.html` têm `noindex, nofollow` para não aparecerem em buscadores.
- Os textos vindos do banco (nome, descrição, categoria etc.) passam por escape de HTML antes de serem exibidos.

## Ambiente de testes

Além do ambiente de produção descrito acima, o repositório também guarda um **ambiente de testes**, usado para desenvolver e validar mudanças antes de aplicá-las na produção. Ele roda num **projeto Supabase separado** e não deve ser confundido com os arquivos de produção:

| Arquivo/pasta | Finalidade |
|---|---|
| `superadmin-teste.html` / `superadmin-teste.js` | Versão de testes da central do superadmin, com gerenciamento de usuários (promover, suspender, excluir) via Edge Function |
| `superadmin-users.js` | Lógica de gerenciamento de usuários da central de testes |
| `preview.html` / `preview.js` | Vitrine pública conectada ao projeto Supabase de teste |
| `supabase/migrations/` | Histórico de migrations SQL aplicadas no projeto de teste |

O projeto de teste tem uma Edge Function (`superadmin-control`) que centraliza as operações privilegiadas (criar perfil, trocar cargo, suspender e excluir conta) no servidor, validando sessão e cargo antes de qualquer alteração — a chave `service_role` fica só no ambiente da função, nunca no navegador. As trocas de cargo passam por uma função SQL (`superadmin_set_role`) que impede autoalteração de cargo e impede remover o último superadmin.

`admin.html` e `superadmin.html` (produção) nunca são alterados a partir desse ambiente.

## Pendências e próximos passos

- [ ] Substituir a imagem externa de prévia social por uma capa própria (1200×630 px).
- [ ] Cadastrar os produtos reais no painel Admin; sem produtos cadastrados, a vitrine informa que a coleção está vazia.
- [ ] Gravar os eventos em `activity_logs` para a auditoria ter conteúdo (já implementado no ambiente de testes, ainda não promovido à produção).
- [ ] Liberar no superadmin de produção a gestão de perfis e funções (já implementado no ambiente de testes, ainda não promovido à produção).
- [ ] Ativar a proteção contra senha vazada no painel do Supabase (Authentication → Settings → Password Security) — não dá pra fazer isso por SQL.
- [ ] Adicionar paginação e limite de chamadas (rate limiting) na Edge Function de testes antes de promover para produção.
- [ ] Mais de uma foto por produto (já implementado em `pages/colecao.html`, via campos `images`/`image_urls`).
- [ ] Remover `app.js`, que não é mais usado por nenhuma página.

## Fora do escopo

Carrinho de compras, pagamento online, checkout e cadastro de clientes. Os pedidos continuam sendo conversas pelo WhatsApp.
