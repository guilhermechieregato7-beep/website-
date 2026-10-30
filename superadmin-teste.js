
"use strict";

const SUPABASE_URL = "https://wtupkfloinoagugzwufj.supabase.co";
const SUPABASE_KEY = "sb_publishable_0Us-wP2_D33QRBaWsyaq3Q_n5utpou5";

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

window.testSuperadminDb = db;

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

const preferenceKey = "vitrine.superadmin.test.appearance.v1";

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

function productStatus(value) {
  return {
    available: "Disponível",
    made_to_order: "Sob encomenda",
    sold_out: "Esgotado"
  }[value] || value || "—";
}

function checkRow(label, value, kind = "ok") {
  return `
    <div class="check-row">
      <span>${esc(label)}</span>
      <b class="pill ${kind}">${esc(value)}</b>
    </div>
  `;
}

/* APARÊNCIA */

function applyPrefs() {
  const effective = prefs.theme === "system"
    ? (
        matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark"
      )
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
  if ($("customAccent")) $("customAccent").value = prefs.customHex;

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
    message("Não foi possível salvar as preferências.", "error");
  }
}

/* NAVEGAÇÃO */

function showPage(page) {
  if (!pageNames[page]) return;

  document.querySelectorAll(".page").forEach(el => {
    el.classList.add("hidden");
  });

  $("page-" + page)?.classList.remove("hidden");

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

/* AUTENTICAÇÃO */

async function verifySuperadmin() {
  const { data, error } = await db.auth.getSession();

  if (error) throw error;

  const session = data.session;

  if (!session) {
    $("loginScreen").classList.remove("hidden");
    $("app").classList.add("hidden");
    window.__testSuperadminAuthorized = false;
    return false;
  }

  const { data: userProfile, error: profileError } = await db
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profileError || !userProfile || userProfile.role !== "superadmin") {
    window.__testSuperadminAuthorized = false;
    await db.auth.signOut();

    $("loginScreen").classList.remove("hidden");
    $("app").classList.add("hidden");

    throw new Error("Acesso exclusivo para uma conta Superadmin.");
  }

  profile = userProfile;

  window.__testSuperadminAuthorized = true;
  window.__testSuperadminUserId = session.user.id;

  $("profileName").textContent = userProfile.display_name || "Superadmin";
  $("profileEmail").textContent = session.user.email || "Sessão autenticada";

  $("loginScreen").classList.add("hidden");
  $("app").classList.remove("hidden");

  await refreshAll();

  window.dispatchEvent(new Event("test-superadmin-ready"));

  return true;
}

/* PRODUTOS */

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

    return (
      (!query || searchable.includes(query)) &&
      (
        selectedStatus === "all" ||
        product.status === selectedStatus
      )
    );
  });
}

function renderProducts() {
  const filtered = getFilteredProducts();

  $("productsTable").innerHTML = filtered.map(p => `
    <tr>
      <td>${esc(p.name)}</td>
      <td>${esc(p.category)}</td>
      <td>${price(p.price)}</td>
      <td>${esc(productStatus(p.status))}</td>
      <td>${date(p.created_at)}</td>
    </tr>
  `).join("") || `
    <tr><td colspan="5" class="muted">Nenhum produto encontrado.</td></tr>
  `;

  $("recentProducts").innerHTML = products.slice(0, 5).map(p => `
    <tr>
      <td>${esc(p.name)}</td>
      <td>${esc(p.category)}</td>
      <td>${price(p.price)}</td>
      <td>${esc(productStatus(p.status))}</td>
    </tr>
  `).join("") || `
    <tr><td colspan="4" class="muted">Nenhum produto cadastrado.</td></tr>
  `;
}

async function loadProducts() {
  const { data, error } = await db
    .from("products")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  products = data || [];

  $("statProducts").textContent = products.length;
  $("statAvailable").textContent =
    products.filter(p => p.status === "available").length;

  renderProducts();
}

/* PERFIS */

async function loadProfiles() {
  const { data, error } = await db
    .from("profiles")
    .select("id, display_name, role")
    .order("display_name", { ascending: true })
    .limit(500);

  if (error) throw error;

  const profiles = data || [];

  $("statProfiles").textContent = profiles.length;

  $("profilesTable").innerHTML = profiles.map(item => `
    <tr>
      <td>${esc(item.display_name || "Sem nome")}</td>
      <td>${esc(item.role || "—")}</td>
      <td><code>${esc(item.id)}</code></td>
    </tr>
  `).join("") || `
    <tr><td colspan="3" class="muted">Nenhum perfil disponível.</td></tr>
  `;
}

/* PEDIDOS */

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
  `).join("") || `
    <tr><td colspan="3" class="muted">Nenhum pedido registrado.</td></tr>
  `;
}

/* AUDITORIA */

async function loadActivity() {
  const { data, error } = await db
    .from("activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  $("activityTable").innerHTML = (data || []).map(item => `
    <tr>
      <td>${esc(item.action || "Evento")}</td>
      <td><code>${esc(JSON.stringify(item.details))}</code></td>
      <td>${date(item.created_at)}</td>
    </tr>
  `).join("") || `
    <tr><td colspan="3" class="muted">Nenhum evento disponível.</td></tr>
  `;
}

/* ATUALIZAÇÃO GERAL */

async function refreshAll() {
  message("Atualizando informações…");

  const results = await Promise.allSettled([
    loadProducts(),
    loadProfiles(),
    loadOrders(),
    loadActivity()
  ]);

  const labels = ["Catálogo", "Perfis", "Pedidos", "Auditoria"];

  $("serviceChecks").innerHTML = results.map((result, index) => {
    const ok = result.status === "fulfilled";

    return checkRow(
      labels[index],
      ok ? "OK" : "Erro / sem acesso",
      ok ? "ok" : "warn"
    );
  }).join("");

  const failed = results.some(result => result.status === "rejected");

  message(
    failed
      ? "Algumas consultas falharam. Confira Diagnóstico."
      : "Dados de teste atualizados.",
    failed ? "error" : "info"
  );

  await runDiagnostics(false);
}

/* DIAGNÓSTICO */

async function runDiagnostics(showNotice = true) {
  const tests = [
    ["Sessão autenticada", async () => {
      const r = await db.auth.getSession();
      if (r.error || !r.data.session) throw Error("Sem sessão");
    }],
    ["Leitura do catálogo", async () => {
      const r = await db.from("products").select("id").limit(1);
      if (r.error) throw r.error;
    }],
    ["Leitura de perfis", async () => {
      const r = await db.from("profiles").select("id").limit(1);
      if (r.error) throw r.error;
    }],
    ["Consulta de pedidos", async () => {
      const r = await db.from("orders").select("id").limit(1);
      if (r.error) throw r.error;
    }],
    ["Consulta de auditoria", async () => {
      const r = await db.from("activity_logs").select("id").limit(1);
      if (r.error) throw r.error;
    }]
  ];

  const results = await Promise.all(
    tests.map(async ([name, test]) => {
      try {
        await test();
        return checkRow(name, "OK", "ok");
      } catch (error) {
        return checkRow(name, error.code || "Indisponível", "warn");
      }
    })
  );

  $("diagnosticResults").innerHTML = results.join("");

  if (showNotice) message("Diagnóstico concluído.");
}

/* EVENTOS */

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
  window.__testSuperadminAuthorized = false;
  await db.auth.signOut();

  $("app").classList.add("hidden");
  $("loginScreen").classList.remove("hidden");
});

$("refreshAll").addEventListener("click", () => {
  refreshAll().catch(e => message(e.message, "error"));
});

$("refreshProducts").addEventListener("click", () => {
  loadProducts().catch(e => message(e.message, "error"));
});

$("refreshProfiles").addEventListener("click", () => {
  loadProfiles().catch(e => message(e.message, "error"));
});

$("refreshOrders").addEventListener("click", () => {
  loadOrders().catch(e => message(e.message, "error"));
});

$("refreshActivity").addEventListener("click", () => {
  loadActivity().catch(e => message(e.message, "error"));
});

$("runDiagnostics").addEventListener("click", () => {
  runDiagnostics(true).catch(e => message(e.message, "error"));
});

$("productSearch").addEventListener("input", renderProducts);
$("productStatus").addEventListener("change", renderProducts);

/* PERSONALIZAÇÃO */

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
  prefs.accent = "custom";
  prefs.customHex = $("customAccent").value;
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
    document.documentElement.dataset.theme === "dark"
      ? "light"
      : "dark";

  savePrefs();
});

try {
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (prefs.theme === "system") applyPrefs();
  });
} catch {}

/* INICIALIZAÇÃO */

bindNavigation();
applyPrefs();

db.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) {
    window.__testSuperadminAuthorized = false;
    $("app").classList.add("hidden");
    $("loginScreen").classList.remove("hidden");
  }
});

verifySuperadmin().catch(error => {
  console.error(error);
  $("loginMessage").textContent =
    error.message || "Erro ao verificar acesso.";
});
