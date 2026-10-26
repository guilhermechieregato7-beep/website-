
const WHATSAPP_NUMBER = "5516999957070"

const products = [
  {
    id: 1,
    name: "Bolsa Aurora",
    category: "Bolsas",
    price: 89.90,
    status: "available",
    description: "Bolsa artesanal com acabamento cuidadoso, ideal para acompanhar a rotina.",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 2,
    name: "Nécessaire Flora",
    category: "Nécessaires",
    price: 39.90,
    status: "made_to_order",
    description: "Nécessaire prática para organizar pequenos objetos e acessórios.",
    image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 3,
    name: "Bolsa Terra",
    category: "Bolsas",
    price: 99.90,
    status: "available",
    description: "Uma bolsa versátil para quem gosta de peças com personalidade.",
    image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 4,
    name: "Carteira Serena",
    category: "Acessórios",
    price: 29.90,
    status: "sold_out",
    description: "Carteira compacta, feita para manter os itens essenciais organizados.",
    image: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 5,
    name: "Bolsa Jardim",
    category: "Bolsas",
    price: 109.90,
    status: "made_to_order",
    description: "Uma peça artesanal para dar um toque especial ao visual cotidiano.",
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 6,
    name: "Estojo Pétala",
    category: "Nécessaires",
    price: 24.90,
    status: "available",
    description: "Estojo versátil para guardar materiais, maquiagem ou objetos pequenos.",
    image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80"
  }
];

const productsContainer = document.querySelector("#products");
const categoriesContainer = document.querySelector("#categories");
const searchInput = document.querySelector("#search");
const emptyMessage = document.querySelector("#empty");
const dialog = document.querySelector("#product-dialog");
const dialogContent = document.querySelector("#dialog-content");

let selectedCategory = "Todos";

const statusLabels = {
  available: "Disponível",
  made_to_order: "Sob encomenda",
  sold_out: "Esgotado"
};

function money(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function whatsappLink(message) {
  const number = WHATSAPP_NUMBER.replace(/\D/g, "");

  if (!number) return "#contato";

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function renderCategories() {
  const categories = ["Todos", ...new Set(products.map(p => p.category))];

  categoriesContainer.innerHTML = categories.map(category => `
    <button
      class="category-button ${selectedCategory === category ? "active" : ""}"
      data-category="${category}"
      type="button"
    >${category}</button>
  `).join("");
}

function renderProducts() {
  const term = searchInput.value.trim().toLocaleLowerCase("pt-BR");

  const filtered = products.filter(product => {
    const matchesCategory =
      selectedCategory === "Todos" || product.category === selectedCategory;

    const matchesSearch =
      `${product.name} ${product.category} ${product.description}`
        .toLocaleLowerCase("pt-BR")
        .includes(term);

    return matchesCategory && matchesSearch;
  });

  productsContainer.innerHTML = filtered.map(product => `
    <article class="product-card" data-id="${product.id}" tabindex="0" role="button"
      aria-label="Ver detalhes de ${product.name}">
      <div class="product-image">
        <img src="${product.image}" alt="${product.name}" loading="lazy">
        <span class="product-status">${statusLabels[product.status]}</span>
      </div>
      <div class="product-info">
        <p>${product.category}</p>
        <h3>${product.name}</h3>
        <span class="product-price">${money(product.price)}</span>
      </div>
    </article>
  `).join("");

  emptyMessage.hidden = filtered.length > 0;
}

function openProduct(id) {
  const product = products.find(item => item.id === Number(id));
  if (!product) return;

  const message = `Olá! Tenho interesse no produto ${product.name}. Gostaria de saber mais informações.`;
  const link = whatsappLink(message);

  dialogContent.innerHTML = `
    <img class="dialog-image" src="${product.image}" alt="${product.name}">
    <p class="eyebrow">${product.category}</p>
    <h2>${product.name}</h2>
    <p class="dialog-description">${product.description}</p>
    <p><strong>${money(product.price)}</strong></p>
    <p>${statusLabels[product.status]}</p>
    ${
      product.status === "sold_out"
        ? "<p>Esta peça está indisponível no momento.</p>"
        : `<a class="button" href="${link}" ${WHATSAPP_NUMBER ? 'target="_blank" rel="noopener noreferrer"' : ""}>Consultar pelo WhatsApp ↗</a>`
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

renderCategories();
renderProducts();
