
"use strict";

// =====================================================
// CONFIGURAÇÃO DO SUPABASE
// =====================================================

const SUPABASE_URL = "https://hyovvejtvzptzskxbkrr.supabase.co";
const SUPABASE_KEY = "sb_publishable_a0xRmApdgaH-KzxS2gh4KQ_wl1obK0z";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

const $ = id => document.getElementById(id);

let products = [];
let profile = null;

const pageNames = {
  overview: ["Visão geral", "VISÃO GERAL"],
  products: ["Produtos", "CATÁLOGO"],
  users: ["Perfis e usuários", "ACESSOS"],
  orders: ["Pedidos", "OPERAÇÃO"],
  activity: ["Auditoria", "AUDITORIA"],
  diagnostics: ["Diagnóstico", "SISTEMA"],
  appearance: ["Aparência", "PERSONALIZAÇÃO"]
};

const defaults = {
  theme: "dark",
  accent: "violet",
  customHex: "#8b5cf6",
  density: "comfortable"
};

const preferenceKey = "vitrine.superadmin.appearance.v1";

// =====================================================
// PREFERÊNCIAS VISUAIS
// =====================================================

function readPrefs() {
  try {
    return {
      ...defaults,
      ...JSON.parse(localStorage.getItem(preferenceKey) || "{}")
    };
  } catch {
    return { ...defaults };
  }
}

let prefs = readPrefs();

function applyPrefs() {
  const effective = prefs.theme === "system"
    ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : prefs.theme;

  document.documentElement.dataset.theme = effective;
  document.documentElement.dataset.accent = prefs.accent;
  document.documentElement.dataset.density = prefs.density;

  if (prefs.accent === "custom") {
    const color = prefs.customHex || defaults.customHex;

    document.documentElement.style.setProperty("--accent", color);
    document.documentElement.style.setProperty("--accent-strong", color);
    document.documentElement.style.setProperty("--accent-soft", color + "22");
  } else {
    document.documentElement.style.removeProperty("--accent");
    document.documentElement.style.removeProperty("--accent-strong");
    document.documentElement.style.removeProperty("--accent-soft");
  }

  if ($("themeSelect")) $("themeSelect").value = prefs.theme;
  if ($("densitySelect")) $("densitySelect").value = prefs.density;

  document.querySelectorAll("#swatches [data-accent]").forEach(button => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.accent === prefs.accent)
    );
  });
}

function savePrefs() {
  try {
    localStorage.setItem(preferenceKey, JSON.stringify(prefs));
    applyPrefs();

    if ($("appearanceMessage")) {
      $("appearanceMessage").textContent =
        "Preferências salvas neste dispositivo.";
    }
  } catch {
    message("Não foi possível salvar as preferências neste navegador.", "error");
  }
}

// =====================================================
// UTILITÁRIOS
// =====================================================

function message(text, kind = "info") {
  const el = $("notice");
  if (!el) return;

  el.textContent = text;
  el.className = "notice" + (kind === "error" ? " error" : "");
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function price(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function date(value) {
  if (!value) return "—";

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR");
}

function status(value) {
  return ({
    available: "Disponível",
    made_to_order: "Sob encomenda",
    sold_out: "Esgotado"
  })[value] || value || "—";
}

function tableEmpty(colspan, text) {
  return `<tr><td colspan="${colspan}" class="muted">${esc(text)}</td></tr>`;
}

function checkRow(label, value, kind = "ok") {
  return `
    <div class="check-row">
      <span>${esc(label)}</span>
      <b class="pill ${kind}">${esc(value)}</b>
    </div>
  `;
}

// =====================================================
// NAVEGAÇÃO
// =====================================================

function showPage(page) {
  if (!pageNames[page]) return;

  document.querySelectorAll(".page").forEach(el => {
    el.classList.add("hidden");
  });

  const target = $("page-" + page);
  if (target) target.classList.remove("hidden");

  document.querySelectorAll(".nav-item[data-page]").forEach(el => {
    el.classList.toggle("active", el.dataset.page === page);
  });

  $("pageTitle").textContent = pageNames[page][0];
  $("breadcrumb").textContent = pageNames[page][1];
  $("sidebar").classList.remove("open");

  location.hash = page;
}

function bindNavigation() {
  document.querySelectorAll("[data-page]").forEach(el => {
    el.addEventListener("click", () => showPage(el.dataset.page));
  });

  document.querySelectorAll("[data-goto]").forEach(el => {
    el.addEventListener("click", () => showPage(el.dataset.goto));
  });

  $("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
  });
}

// =====================================================
// AUTENTICAÇÃO E AUTORIZAÇÃO
// =====================================================

async function verifySuperadmin() {
  const { data: sessionData, error: sessionError } =
    await db.auth.getSession();

  if (sessionError) throw sessionError;

  const session = sessionData.session;

  if (!session) {
    $("loginScreen").classList.remove("hidden");
    $("app").classList.add("hidden");
    return false;
  }

  const { data: userProfile, error } = await db
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !userProfile || userProfile.role !== "superadmin") {
    await db.auth.signOut();

    $("loginScreen").classList.remove("hidden");
    $("app").classList.add("hidden");

    throw new Error(
      "Acesso exclusivo para uma conta com perfil superadmin. " +
      "A sessão foi encerrada."
    );
  }

  profile = userProfile;

  $("profileName").textContent =
    userProfile.display_name || "Superadmin";

  $("profileEmail").textContent =
    session.user.email || "Sessão autenticada";

  $("loginScreen").classList.add("hidden");
  $("app").classList.remove("hidden");

  await refreshAll();

  return true;
}

// =====================================================
// CATÁLOGO DE PRODUTOS
// =====================================================

function renderProducts() {
  const filtered = getFilteredProducts();

  $("productsTable").innerHTML = filtered.map(product => `
    <tr>
      <td>${esc(product.name)}</td>
      <td>${esc(product.category)}</td>
      <td>${price(product.price)}</td>
      <td>${esc(status(product.status))}</td>
      <td>${date(product.created_at)}</td>
    </tr>
  `).join("") || tableEmpty(5, "Nenhum produto corresponde ao filtro.");
}

function getFilteredProducts() {
  const query = ($("productSearch")?.value || "")
    .trim()
    .toLocaleLowerCase("pt-BR");

  const selectedStatus = $("productStatus")?.value || "all";

  return products.filter(product => {
    const searchable = [
      product.name || "",
      product.category || "",
      product.description || ""
    ].join(" ").toLocaleLowerCase("pt-BR");

    const matchesQuery = !query || searchable.includes(query);
    const matchesStatus =
      selectedStatus === "all" || product.status === selectedStatus;

    return matchesQuery && matchesStatus;
  });
}

async function loadProducts() {
  const { data, error } = await db
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  products = data || [];

  $("statProducts").textContent = products.length;

  $("statAvailable").textContent = products.filter(
    product => product.status === "available"
  ).length;

  $("recentProducts").innerHTML = products.slice(0, 5).map(product => `
    <tr>
      <td>${esc(product.name)}</td>
      <td>${esc(product.category)}</td>
      <td>${price(product.price)}</td>
      <td>${esc(status(product.status))}</td>
    </tr>
  `).join("") || tableEmpty(4, "Nenhum produto cadastrado.");

  renderProducts();
}

// =====================================================
// PERFIS
// =====================================================

async function loadProfiles() {
  const { data, error } = await db
    .from("profiles")
    .select("id, display_name, role")
    .order("display_name");

  if (error) throw error;

  $("statProfiles").textContent = (data || []).length;

  $("profilesTable").innerHTML = (data || []).map(item => `
    <tr>
      <td>${esc(item.display_name || "Sem nome")}</td>
      <td>${esc(item.role)}</td>
      <td><code>${esc(item.id)}</code></td>
    </tr>
  `).join("") || tableEmpty(3, "Nenhum perfil visível para esta conta.");
}

// =====================================================
// PEDIDOS
// =====================================================

async function loadOrders() {
  const { data, error } = await db
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const orders = data || [];

  $("statOrders").textContent = orders.length;

  $("ordersTable").innerHTML = orders.map(order => `
    <tr>
      <td>${esc(order.id)}</td>
      <td>${esc(order.status || "—")}</td>
      <td>${date(order.created_at)}</td>
    </tr>
  `).join("") || tableEmpty(3, "Nenhum pedido registrado.");
}

// =====================================================
// AUDITORIA
// =====================================================

async function loadActivity() {
  const { data, error } = await db
    .from("activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  $("activityTable").innerHTML = (data || []).map(item => `
    <tr>
      <td>${esc(item.action || item.event_type || item.event || "Evento")}</td>
      <td>${esc(item.details || item.description || item.entity_type || "—")}</td>
      <td>${date(item.created_at)}</td>
    </tr>
  `).join("") || tableEmpty(3, "Nenhum evento disponível.");
}

// =====================================================
// ATUALIZAÇÃO GERAL
// =====================================================

async function refreshAll() {
  message("Atualizando informações…");

  const results = await Promise.allSettled([
    loadProducts(),
    loadProfiles(),
    loadOrders(),
    loadActivity()
  ]);

  const labels = ["Catálogo", "Perfis", "Pedidos", "Auditoria"];

  const rows = results.map((result, index) => {
    const ok = result.status === "fulfilled";

    return checkRow(
      labels[index],
      ok ? "OK" : "Sem acesso / erro",
      ok ? "ok" : "warn"
    );
  });

  $("serviceChecks").innerHTML = rows.join("");

  const failures = results.filter(
    result => result.status === "rejected"
  );

  if (failures.length) {
    message(
      "Algumas consultas não estão disponíveis. " +
      "Confira a seção Diagnóstico. Nenhuma permissão foi ampliada.",
      "error"
    );
  } else {
    message("Dados atualizados.");
  }

  await runDiagnostics(false);
}

// =====================================================
// DIAGNÓSTICO
// =====================================================

async function runDiagnostics(showNotice = true) {
  const tests = [
    [
      "Sessão autenticada",
      async () => {
        const result = await db.auth.getSession();
        if (result.error || !result.data.session) throw Error("Sem sessão");
      }
    ],
    [
      "Leitura do catálogo",
      async () => {
        const result = await db.from("products").select("id").limit(1);
        if (result.error) throw result.error;
      }
    ],
    [
      "Leitura dos perfis permitidos",
      async () => {
        const result = await db.from("profiles").select("id").limit(1);
        if (result.error) throw result.error;
      }
    ],
    [
      "Consulta de pedidos",
      async () => {
        const result = await db.from("orders").select("id").limit(1);
        if (result.error) throw result.error;
      }
    ],
    [
      "Consulta de auditoria",
      async () => {
        const result = await db.from("activity_logs").select("*").limit(1);
        if (result.error) throw result.error;
      }
    ]
  ];

  const results = await Promise.all(tests.map(async ([name, test]) => {
    try {
      await test();
      return checkRow(name, "OK", "ok");
    } catch (error) {
      return checkRow(
        name,
        error.code || "Indisponível",
        "warn"
      );
    }
  }));

  $("diagnosticResults").innerHTML = results.join("");

  if (showNotice) {
    message("Diagnóstico concluído. Consulte os resultados abaixo.");
  }
}

// =====================================================
// EVENTOS DA INTERFACE
// =====================================================

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const button = $("loginButton");

  button.disabled = true;
  button.textContent = "Verificando…";
  $("loginMessage").textContent = "";

  try {
    const { error } = await db.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });

    if (error) throw error;

    await verifySuperadmin();
  } catch (error) {
    $("loginMessage").textContent =
      error.message || "Não foi possível entrar.";
  } finally {
    button.disabled = false;
    button.textContent = "Entrar na central";
  }
});

$("logoutButton").addEventListener("click", async () => {
  await db.auth.signOut();

  $("app").classList.add("hidden");
  $("loginScreen").classList.remove("hidden");
});

$("refreshAll").addEventListener("click", () => {
  refreshAll().catch(error => message(error.message, "error"));
});

$("refreshProducts").addEventListener("click", () => {
  loadProducts().catch(error => message(error.message, "error"));
});

$("refreshProfiles").addEventListener("click", () => {
  loadProfiles().catch(error => message(error.message, "error"));
});

$("refreshOrders").addEventListener("click", () => {
  loadOrders().catch(error => message(error.message, "error"));
});

$("refreshActivity").addEventListener("click", () => {
  loadActivity().catch(error => message(error.message, "error"));
});

$("runDiagnostics").addEventListener("click", () => {
  runDiagnostics(true).catch(error => message(error.message, "error"));
});

$("productSearch").addEventListener("input", renderProducts);

$("productStatus").addEventListener("change", renderProducts);

// =====================================================
// APARÊNCIA
// =====================================================

$("themeSelect").addEventListener("change", event => {
  prefs.theme = event.target.value;
  savePrefs();
});

$("densitySelect").addEventListener("change", event => {
  prefs.density = event.target.value;
  savePrefs();
});

document.querySelectorAll("#swatches [data-accent]").forEach(button => {
  button.addEventListener("click", () => {
    prefs.accent = button.dataset.accent;
    savePrefs();
  });
});

$("applyCustomAccent").addEventListener("click", () => {
  const color = $("customAccent").value;

  prefs.accent = "custom";
  prefs.customHex = color;

  savePrefs();
});

$("resetAppearance").addEventListener("click", () => {
  prefs = { ...defaults };

  try {
    localStorage.removeItem(preferenceKey);
  } catch {}

  applyPrefs();

  $("appearanceMessage").textContent = "Padrão restaurado.";
});

$("quickTheme").addEventListener("click", () => {
  prefs.theme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";

  savePrefs();
});

try {
  matchMedia("(prefers-color-scheme: light)").addEventListener(
    "change",
    () => {
      if (prefs.theme === "system") applyPrefs();
    }
  );
} catch {}

// =====================================================
// INICIALIZAÇÃO
// =====================================================

bindNavigation();
applyPrefs();

db.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) {
    $("app").classList.add("hidden");
    $("loginScreen").classList.remove("hidden");
  }
});

verifySuperadmin().catch(error => {
  console.error(error);
  $("loginMessage").textContent =
    error.message || "Erro ao verificar acesso.";
});
