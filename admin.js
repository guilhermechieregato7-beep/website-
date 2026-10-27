
"use strict";

// =====================================================
// CONFIGURAÇÃO
// =====================================================

const SUPABASE_URL = "https://hyovvejtvzptzskxbkrr.supabase.co";
const SUPABASE_KEY = "sb_publishable_a0xRmApdgaH-KzxS2gh4KQ_wl1obK0z";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

const $ = id => document.getElementById(id);

const STATUS_LABELS = {
  available: "Disponível",
  made_to_order: "Sob encomenda",
  sold_out: "Esgotado"
};

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

let products = [];
let currentRole = null;
let busy = false;
let loadingProducts = false;
let searchTerm = "";
let statusFilter = "all";

// =====================================================
// INTERFACE E MENSAGENS
// =====================================================

function message(text, type = "info") {
  const element = $("message");
  if (!element) return;

  element.textContent = text;
  element.dataset.type = type;
}

function showDashboard(show) {
  $("loginPanel")?.classList.toggle("hidden", show);
  $("dashboard")?.classList.toggle("hidden", !show);
}

function setButtonLoading(button, loading, loadingText = "Aguarde...") {
  if (!button) return;

  if (loading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }

    button.disabled = true;
    button.textContent = loadingText;
    button.setAttribute("aria-busy", "true");
  } else {
    button.disabled = false;

    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }

    button.removeAttribute("aria-busy");
  }
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatPrice(price) {
  return Number(price).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatStatus(status) {
  return STATUS_LABELS[status] || "Status desconhecido";
}

function formatError(error) {
  const code = error?.code;

  if (code === "23505") {
    return "Já existe um registro com esses dados.";
  }

  if (code === "42501" || code === "PGRST301") {
    return "Acesso negado. Confira sua sessão e as permissões do Supabase.";
  }

  if (code === "23503") {
    return "Não foi possível concluir a operação devido a uma referência no banco.";
  }

  if (error?.message?.toLowerCase().includes("fetch")) {
    return "Falha de conexão. Verifique a internet e tente novamente.";
  }

  return error?.message || "Ocorreu um erro inesperado.";
}

// =====================================================
// FERRAMENTAS DA LISTA
// =====================================================

function ensureProductTools() {
  const container = $("products");
  if (!container) return;

  let tools = $("productTools");

  if (!tools) {
    tools = document.createElement("div");
    tools.id = "productTools";
    tools.style.cssText =
      "display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-bottom:14px;";

    const search = document.createElement("input");
    search.id = "productSearch";
    search.type = "search";
    search.placeholder = "Buscar produtos...";
    search.setAttribute("aria-label", "Buscar produtos");

    const filter = document.createElement("select");
    filter.id = "statusFilter";
    filter.setAttribute("aria-label", "Filtrar por disponibilidade");

    filter.innerHTML = `
      <option value="all">Todos</option>
      <option value="available">Disponíveis</option>
      <option value="made_to_order">Sob encomenda</option>
      <option value="sold_out">Esgotados</option>
    `;

    tools.append(search, filter);
    container.parentElement.insertBefore(tools, container);
  }

  let count = $("productCount");

  if (!count) {
    count = document.createElement("p");
    count.id = "productCount";
    count.style.cssText =
      "margin:0 0 10px;color:#777080;font-size:13px;";
    tools.insertAdjacentElement("afterend", count);
  }

  $("productSearch")?.addEventListener("input", event => {
    searchTerm = event.target.value.trim().toLocaleLowerCase("pt-BR");
    renderProducts();
  });

  $("statusFilter")?.addEventListener("change", event => {
    statusFilter = event.target.value;
    renderProducts();
  });
}

// =====================================================
// AUTENTICAÇÃO E PERFIL
// =====================================================

async function verifyAdmin() {
  const { data, error } = await db.auth.getSession();

  if (error) throw error;

  const session = data.session;

  if (!session) {
    currentRole = null;
    showDashboard(false);
    return false;
  }

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("display_name, role")
    .eq("id", session.user.id)
    .single();

  if (profileError || !profile ||
      !["admin", "superadmin"].includes(profile.role)) {
    await db.auth.signOut();
    currentRole = null;
    showDashboard(false);

    throw new Error(
      "Esta conta não tem perfil de administrador autorizado."
    );
  }

  currentRole = profile.role;

  const welcome = $("welcome");

  if (welcome) {
    welcome.textContent =
      `${profile.display_name || session.user.email} · ` +
      (currentRole === "superadmin"
        ? "Superadministrador"
        : "Administrador");
  }

  showDashboard(true);
  await loadProducts();

  return true;
}

// =====================================================
// CARREGAMENTO E EXIBIÇÃO DOS PRODUTOS
// =====================================================

async function loadProducts() {
  if (loadingProducts) return;

  loadingProducts = true;
  message("Carregando produtos...");

  try {
    const { data, error } = await db
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    products = data || [];
    renderProducts();

    message(
      `${products.length} produto(s) carregado(s).`,
      "success"
    );
  } catch (error) {
    message("Erro ao carregar produtos: " + formatError(error), "error");
  } finally {
    loadingProducts = false;
  }
}

function renderProducts() {
  const container = $("products");
  if (!container) return;

  const filtered = products.filter(product => {
    const searchable = [
      product.name,
      product.category,
      product.description
    ].join(" ").toLocaleLowerCase("pt-BR");

    const matchesSearch = searchable.includes(searchTerm);
    const matchesStatus =
      statusFilter === "all" || product.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const count = $("productCount");

  if (count) {
    count.textContent =
      `${filtered.length} de ${products.length} produto(s)`;
  }

  container.replaceChildren();

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "notice";
    empty.textContent = products.length
      ? "Nenhum produto corresponde à busca."
      : "Nenhum produto cadastrado ainda.";

    container.appendChild(empty);
    return;
  }

  for (const product of filtered) {
    const card = document.createElement("article");
    card.className = "product";

    const image = product.image_url
      ? `<img src="${escapeHTML(product.image_url)}"
          alt="${escapeHTML(product.name)}"
          loading="lazy">`
      : `<div aria-label="Sem foto"
          style="width:100%;min-height:100px;display:grid;place-items:center;background:#f7f5fa;border-radius:12px;color:#777080;font-size:12px;">
          Sem foto
        </div>`;

    card.innerHTML = `
      ${image}
      <div class="product-info">
        <h3>${escapeHTML(product.name)}</h3>
        <p>${escapeHTML(product.category || "Sem categoria")}</p>
        <p>${escapeHTML(formatPrice(product.price))}</p>
        <p>${escapeHTML(product.description || "")}</p>
        <span class="status-label">${escapeHTML(formatStatus(product.status))}</span>
        <div class="product-actions">
          <button type="button"
            class="button secondary small"
            data-edit="${escapeHTML(product.id)}">
            Editar
          </button>
          <button type="button"
            class="button danger small"
            data-delete="${escapeHTML(product.id)}">
            Excluir
          </button>
        </div>
      </div>
    `;

    const img = card.querySelector("img");

    if (img) {
      img.addEventListener("error", () => {
        img.alt = "Não foi possível carregar a foto";
        img.style.display = "none";
      }, { once: true });
    }

    container.appendChild(card);
  }
}

// =====================================================
// FORMULÁRIO
// =====================================================

function resetForm() {
  $("productForm")?.reset();

  if ($("productId")) $("productId").value = "";

  if ($("formTitle")) {
    $("formTitle").textContent = "Novo produto";
  }

  $("cancelEdit")?.classList.add("hidden");

  if ($("saveProduct")) {
    $("saveProduct").textContent = "Salvar produto";
  }
}

function startEditing(product) {
  $("productId").value = product.id;
  $("name").value = product.name || "";
  $("category").value = product.category || "";
  $("price").value = product.price ?? 0;
  $("description").value = product.description || "";
  $("status").value = product.status || "available";
  $("photo").value = "";

  $("formTitle").textContent = "Editar produto";
  $("cancelEdit").classList.remove("hidden");
  $("saveProduct").textContent = "Salvar alterações";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function uploadImage(file) {
  if (!file) return null;

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Use uma imagem JPG, PNG ou WebP.");
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("A imagem deve ter no máximo 5 MB.");
  }

  if (!crypto.randomUUID) {
    throw new Error(
      "Seu navegador não oferece o recurso necessário para enviar a imagem. Atualize o navegador e tente novamente."
    );
  }

  const extension = ({
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  })[file.type];

  const path = `${crypto.randomUUID()}.${extension}`;

  const { error } = await db.storage
    .from("product-images")
    .upload(path, file, {
      contentType: file.type,
      upsert: false
    });

  if (error) throw error;

  const { data } = db.storage
    .from("product-images")
    .getPublicUrl(path);

  return {
    url: data.publicUrl,
    path
  };
}

async function saveProduct(event) {
  event.preventDefault();

  if (busy) return;

  const button = $("saveProduct");
  busy = true;
  setButtonLoading(button, true, "Salvando...");
  message("Salvando produto...");

  let uploadedPath = null;

  try {
    const id = $("productId").value.trim();
    const file = $("photo").files[0];

    const name = $("name").value.trim();
    const category = $("category").value.trim();
    const rawPrice = $("price").value;
    const price = Number(rawPrice);
    const description = $("description").value.trim();
    const status = $("status").value;

    if (!name || !category || rawPrice === "") {
      throw new Error("Preencha o nome, a categoria e o preço.");
    }

    if (!Number.isFinite(price) || price < 0) {
      throw new Error("Informe um preço válido, igual ou maior que zero.");
    }

    if (!Object.hasOwn(STATUS_LABELS, status)) {
      throw new Error("Selecione uma disponibilidade válida.");
    }

    const product = {
      name,
      category,
      price,
      description,
      status
    };

    if (file) {
      const uploaded = await uploadImage(file);
      uploadedPath = uploaded.path;
      product.image_url = uploaded.url;
    }

    let query;

    if (id) {
      query = db
        .from("products")
        .update(product)
        .eq("id", id)
        .select("id");
    } else {
      query = db
        .from("products")
        .insert(product)
        .select("id");
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error(
        "Nenhum produto foi alterado. Confira as permissões da sua conta."
      );
    }

    resetForm();

    message(
      id ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!",
      "success"
    );

    await loadProducts();
  } catch (error) {
    // Se o envio da foto deu certo, mas o cadastro falhou,
    // tentamos remover o arquivo que ficou sem uso.
    if (uploadedPath) {
      const { error: cleanupError } = await db.storage
        .from("product-images")
        .remove([uploadedPath]);

      if (cleanupError) {
        console.warn("Não foi possível limpar a foto enviada:", cleanupError.message);
      }
    }

    message("Não foi possível salvar: " + formatError(error), "error");
  } finally {
    busy = false;
    setButtonLoading(button, false);
  }
}

// =====================================================
// EVENTOS
// =====================================================

$("loginForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const button = event.submitter ||
    $("loginForm").querySelector('button[type="submit"]');

  setButtonLoading(button, true, "Entrando...");
  message("Verificando sua conta...");

  try {
    const { error } = await db.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });

    if (error) {
      throw new Error("Login não realizado. Confira o e-mail e a senha.");
    }

    await verifyAdmin();
    message("Login realizado com sucesso!", "success");
  } catch (error) {
    message(formatError(error), "error");
  } finally {
    setButtonLoading(button, false);
  }
});

$("logout")?.addEventListener("click", async () => {
  try {
    const { error } = await db.auth.signOut();
    if (error) throw error;

    currentRole = null;
    showDashboard(false);
    message("Você saiu da conta.", "success");
  } catch (error) {
    message("Não foi possível sair: " + formatError(error), "error");
  }
});

$("refresh")?.addEventListener("click", loadProducts);

$("cancelEdit")?.addEventListener("click", () => {
  resetForm();
  message("Edição cancelada.");
});

$("productForm")?.addEventListener("submit", saveProduct);

$("products")?.addEventListener("click", async event => {
  const button = event.target.closest("button");
  if (!button || busy) return;

  const editId = button.dataset.edit;
  const deleteId = button.dataset.delete;

  if (editId) {
    const product = products.find(item => item.id === editId);

    if (!product) {
      message("Produto não encontrado. Atualize a lista.", "error");
      return;
    }

    startEditing(product);
    return;
  }

  if (deleteId) {
    const product = products.find(item => item.id === deleteId);

    if (!product) {
      message("Produto não encontrado. Atualize a lista.", "error");
      return;
    }

    const confirmed = confirm(
      `Excluir "${product.name}"?\n\nEsta ação não pode ser desfeita.`
    );

    if (!confirmed) return;

    busy = true;
    setButtonLoading(button, true, "Excluindo...");

    try {
      const { data, error } = await db
        .from("products")
        .delete()
        .eq("id", deleteId)
        .select("id");

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error(
          "O produto não foi excluído. Confira as permissões da sua conta."
        );
      }

      if ($("productId").value === deleteId) {
        resetForm();
      }

      message("Produto excluído com sucesso!", "success");
      await loadProducts();
    } catch (error) {
      message("Erro ao excluir: " + formatError(error), "error");
    } finally {
      busy = false;
      setButtonLoading(button, false);
    }
  }
});

// Mantém a interface coerente se a sessão terminar.
db.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) {
    currentRole = null;
    showDashboard(false);
  }
});

// =====================================================
// INICIALIZAÇÃO
// =====================================================

ensureProductTools();

verifyAdmin().catch(error => {
  console.error("Falha ao inicializar o painel:", error);
  message(formatError(error), "error");
});
