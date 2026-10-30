
// Igual ao app.js da loja real, mas apontando para o projeto Supabase
// de TESTE (cópia), usado só para validar a correção dos avisos de
// segurança antes de aplicá-la na produção.

const WHATSAPP_NUMBER = "5516999957070";

const SUPABASE_URL = "https://wtupkfloinoagugzwufj.supabase.co";
const SUPABASE_KEY = "sb_publishable_0Us-wP2_D33QRBaWsyaq3Q_n5utpou5";

const demoProducts = [
  {
    id: "demo-1",
    name: "Bolsa Aurora",
    category: "Bolsas",
    price: 89.90,
    status: "available",
    description: "Bolsa artesanal com acabamento cuidadoso, ideal para acompanhar a rotina.",
    image_url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80"
  }
];

const productsContainer = document.querySelector("#products");
const categoriesContainer = document.querySelector("#categories");
const searchInput = document.querySelector("#search");
const emptyMessage = document.querySelector("#empty");
const dialog = document.querySelector("#product-dialog");
const dialogContent = document.querySelector("#dialog-content");
const fallbackNotice = document.querySelector("#fallback-notice");

let products = [...demoProducts];
let selectedCategory = "Todos";

const statusLabels = {
  available: "Disponível",
  made_to_order: "Sob encomenda",
  sold_out: "Esgotado"
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function money(value) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function whatsappLink(message) {
  const number = WHATSAPP_NUMBER.replace(/\D/g, "");

  if (!number) return "#contato";

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

async function loadProducts() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id,name,category,description,price,image_url,status&order=created_at.desc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase respondeu HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.length > 0) {
      products = data;
    } else {
      products = [...demoProducts];
    }

    if (fallbackNotice) fallbackNotice.classList.remove("show");
  } catch (error) {
    products = [...demoProducts];
    console.error("Não foi possível carregar os produtos do Supabase de teste:", error);

    // Diferente do app.js da loja real: aqui mostramos o aviso também
    // na tela, porque esta página existe justamente para testar a conexão.
    if (fallbackNotice) fallbackNotice.classList.add("show");
  }

  renderCategories();
  renderProducts();
}

function renderCategories() {
  const categories = [
    "Todos",
    ...new Set(products.map(product => product.category).filter(Boolean))
  ];

  if (!categories.includes(selectedCategory)) {
    selectedCategory = "Todos";
  }

  categoriesContainer.innerHTML = categories.map(category => `
    <button
      class="category-button ${selectedCategory === category ? "active" : ""}"
      data-category="${escapeHTML(category)}"
      type="button"
    >${escapeHTML(category)}</button>
  `).join("");
}

function renderProducts() {
  const term = searchInput.value.trim().toLocaleLowerCase("pt-BR");

  const filtered = products.filter(product => {
    const matchesCategory =
      selectedCategory === "Todos" ||
      product.category === selectedCategory;

    const searchableText =
      `${product.name} ${product.category} ${product.description}`
        .toLocaleLowerCase("pt-BR");

    return matchesCategory && searchableText.includes(term);
  });

  productsContainer.innerHTML = filtered.map(product => `
    <article class="product-card" data-id="${escapeHTML(product.id)}"
      tabindex="0" role="button"
      aria-label="Ver detalhes de ${escapeHTML(product.name)}">
      <div class="product-image">
        <img
          src="${escapeHTML(product.image_url || "")}"
          alt="${escapeHTML(product.name)}"
          loading="lazy"
        >
        <span class="product-status">
          ${escapeHTML(statusLabels[product.status] || "Consulte")}
        </span>
      </div>
      <div class="product-info">
        <p>${escapeHTML(product.category)}</p>
        <h3>${escapeHTML(product.name)}</h3>
        <span class="product-price">${money(product.price)}</span>
      </div>
    </article>
  `).join("");

  emptyMessage.hidden = filtered.length > 0;
}

function openProduct(id) {
  const product = products.find(item => String(item.id) === String(id));
  if (!product) return;

  const message =
    `Olá! Tenho interesse no produto ${product.name}. Gostaria de saber mais informações.`;

  const link = whatsappLink(message);
  const status = statusLabels[product.status] || "Consulte";

  dialogContent.innerHTML = `
    <img class="dialog-image"
      src="${escapeHTML(product.image_url || "")}"
      alt="${escapeHTML(product.name)}">

    <p class="eyebrow">${escapeHTML(product.category)}</p>
    <h2>${escapeHTML(product.name)}</h2>
    <p class="dialog-description">${escapeHTML(product.description)}</p>
    <p><strong>${money(product.price)}</strong></p>
    <p>${escapeHTML(status)}</p>

    ${
      product.status === "sold_out"
        ? "<p>Esta peça está indisponível no momento.</p>"
        : `<a class="button" href="${link}" target="_blank"
             rel="noopener noreferrer">Consultar pelo WhatsApp ↗</a>`
    }
  `;

  dialog.showModal();
}

categoriesContainer.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;

  selectedCategory = button.dataset.category;
  renderCategories();
  renderProducts();
});

searchInput.addEventListener("input", renderProducts);

productsContainer.addEventListener("click", event => {
  const card = event.target.closest("[data-id]");
  if (card) openProduct(card.dataset.id);
});

productsContainer.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;

  const card = event.target.closest("[data-id]");
  if (!card) return;

  event.preventDefault();
  openProduct(card.dataset.id);
});

document.querySelector("#close-dialog").addEventListener("click", () => {
  dialog.close();
});

dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});

document.querySelector("#contact-link").href = whatsappLink(
  "Olá! Gostaria de conhecer os produtos artesanais."
);

loadProducts();

(() => {
  const root = document.documentElement;
  const button = document.getElementById("publicThemeToggle");
  const storageKey = "vitrine.preview.theme.v1";

  if (!button) return;

  let theme = "light";

  try {
    theme = localStorage.getItem(storageKey) || "light";
  } catch {
    theme = "light";
  }

  if (!["light", "dark"].includes(theme)) {
    theme = "light";
  }

  function applyTheme() {
    root.dataset.publicTheme = theme;
    button.textContent = theme === "dark" ? "☀️" : "🌙";
    button.setAttribute(
      "aria-label",
      theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"
    );
  }

  button.addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    applyTheme();

    try {
      localStorage.setItem(storageKey, theme);
    } catch {}
  });

  applyTheme();
})();
