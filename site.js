(() => {
  "use strict";
  const root = document.documentElement;
  const themeButton = document.getElementById("publicThemeToggle");
  const themeKey = "vitrine.public.theme.v1";
  let theme = "light";
  try { theme = localStorage.getItem(themeKey) || "light"; } catch {}
  if (!["light","dark"].includes(theme)) theme = "light";
  function applyTheme() {
    root.dataset.publicTheme = theme;
    if (themeButton) {
      themeButton.textContent = theme === "dark" ? "☀️" : "🌙";
      themeButton.setAttribute("aria-label", theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro");
      themeButton.title = theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro";
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#121117" : "#f7f3eb";
  }
  themeButton?.addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    applyTheme();
    try { localStorage.setItem(themeKey, theme); } catch {}
  });
  applyTheme();

  // Gaveta lateral administrativa
  const toggle = document.getElementById("menuToggle");
  const close = document.getElementById("closeMenu");
  const drawer = document.getElementById("sideDrawer");
  const backdrop = document.getElementById("menuBackdrop");
  if (toggle && close && drawer && backdrop) {
    let open = false;
    const openDrawer = () => {
      if (open) return;
      open = true;
      backdrop.hidden = false;
      requestAnimationFrame(() => { backdrop.classList.add("is-visible"); drawer.classList.add("is-open"); });
      drawer.setAttribute("aria-hidden","false"); drawer.inert = false;
      toggle.setAttribute("aria-expanded","true"); document.body.classList.add("drawer-open");
      close.focus();
    };
    const closeDrawer = () => {
      if (!open) return;
      open = false; drawer.classList.remove("is-open"); backdrop.classList.remove("is-visible");
      drawer.setAttribute("aria-hidden","true"); drawer.inert = true;
      toggle.setAttribute("aria-expanded","false"); document.body.classList.remove("drawer-open");
      window.setTimeout(() => { if (!open) backdrop.hidden = true; }, 340);
      toggle.focus();
    };
    toggle.addEventListener("click",openDrawer);
    close.addEventListener("click",closeDrawer);
    backdrop.addEventListener("click",closeDrawer);
    document.addEventListener("keydown",event => { if (event.key === "Escape" && open) closeDrawer(); });
  }

  // Scroll Reveal — respeita a preferência de movimento reduzido
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealItems = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach(el => el.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });
    revealItems.forEach((el,index) => {
      el.style.transitionDelay = `${Math.min(index % 4,3) * 75}ms`;
      observer.observe(el);
    });
  }

  // As transições entre documentos são habilitadas em site.css com @view-transition.

  // Catálogo: carregamento público e galeria dinâmica dos produtos.
  const grid = document.getElementById("products");
  if (!grid) return;
  const SUPABASE_URL = "https://hyovvejtvzptzskxbkrr.supabase.co";
  const SUPABASE_KEY = "sb_publishable_a0xRmApdgaH-KzxS2gh4KQ_wl1obK0z";
  const WHATSAPP_NUMBER = "5516999957070";
  const demo = [
    {id:"demo-1",name:"Bolsa Aurora",category:"Bolsas",price:89.9,status:"available",description:"Bolsa artesanal com acabamento cuidadoso, ideal para acompanhar a rotina.",image_url:"https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85"},
    {id:"demo-2",name:"Nécessaire Flora",category:"Nécessaires",price:39.9,status:"made_to_order",description:"Nécessaire prática para organizar pequenos objetos e acessórios.",image_url:"https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=85"},
    {id:"demo-3",name:"Bolsa Terra",category:"Bolsas",price:99.9,status:"available",description:"Uma bolsa versátil para quem gosta de peças com personalidade.",image_url:"https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=85"}
  ];
  const search = document.getElementById("search");
  const categories = document.getElementById("categories");
  const empty = document.getElementById("empty");
  const status = document.getElementById("collectionStatus");
  const dialog = document.getElementById("product-dialog");
  const dialogContent = document.getElementById("dialog-content");
  let products = [...demo], selected = "Todos", activeProduct = null, imageIndex = 0;
  const labels = {available:"Disponível",made_to_order:"Sob encomenda",sold_out:"Esgotado"};
  const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = value => Number(value || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  function productImages(product) {
    const list = Array.isArray(product.images) ? product.images : (Array.isArray(product.image_urls) ? product.image_urls : []);
    const urls = list.map(item => typeof item === "string" ? item : item?.url).filter(Boolean);
    if (product.image_url) urls.unshift(product.image_url);
    return [...new Set(urls)];
  }
  function renderCategories() {
    const names = ["Todos",...new Set(products.map(p=>p.category).filter(Boolean))];
    if (!names.includes(selected)) selected = "Todos";
    categories.innerHTML = names.map(name=>`<button class="category-button ${selected===name?"active":""}" type="button" data-category="${esc(name)}">${esc(name)}</button>`).join("");
  }
  function renderProducts() {
    const term = (search?.value || "").trim().toLocaleLowerCase("pt-BR");
    const filtered = products.filter(p => (selected==="Todos" || p.category===selected) && `${p.name||""} ${p.category||""} ${p.description||""}`.toLocaleLowerCase("pt-BR").includes(term));
    grid.innerHTML = filtered.map(p=>`
      <article class="product-card reveal" data-product-id="${esc(p.id)}" tabindex="0" role="button" aria-label="Ver ${esc(p.name)}">
        <div class="product-image"><img src="${esc(productImages(p)[0]||"")}" alt="${esc(p.name)}" loading="lazy"><span class="product-status">${esc(labels[p.status]||"Consulte")}</span></div>
        <div class="product-info"><p>${esc(p.category||"Artesanal")}</p><h3>${esc(p.name)}</h3><span class="product-price">${money(p.price)}</span></div>
      </article>`).join("");
    if (empty) empty.hidden = filtered.length > 0;
    grid.querySelectorAll(".reveal").forEach((el,i)=>{ el.style.transitionDelay=`${(i%3)*60}ms`; requestAnimationFrame(()=>el.classList.add("is-visible")); });
    if (status) status.textContent = `${filtered.length} peça(s) encontrada(s)${products===demo?" · conteúdo demonstrativo":""}`;
  }
  function openProduct(product) {
    activeProduct = product; imageIndex = 0;
    const images = productImages(product);
    const message = `Olá! Tenho interesse no produto ${product.name}. Gostaria de saber mais informações.`;
    const link = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    dialogContent.innerHTML = `
      <div class="gallery-main"><img id="galleryImage" src="${esc(images[0]||"")}" alt="${esc(product.name)}"></div>
      ${images.length>1?`<div class="gallery-controls"><button type="button" id="galleryPrev" aria-label="Foto anterior">‹</button><span class="gallery-count" id="galleryCount">1 / ${images.length}</span><button type="button" id="galleryNext" aria-label="Próxima foto">›</button></div>`:""}
      <p class="eyebrow">${esc(product.category||"Artesanal")}</p><h2>${esc(product.name)}</h2><p class="dialog-description">${esc(product.description||"Peça artesanal feita com cuidado.")}</p><p><strong>${money(product.price)}</strong></p><p>${esc(labels[product.status]||"Consulte disponibilidade")}</p>
      ${product.status==="sold_out"?"<p>Esta peça está indisponível no momento.</p>":`<a class="button" href="${link}" target="_blank" rel="noopener noreferrer">Consultar pelo WhatsApp ↗</a>`}`;
    const change = delta => {
      imageIndex = (imageIndex + delta + images.length) % images.length;
      const img = document.getElementById("galleryImage");
      if (img) { img.style.opacity="0"; window.setTimeout(()=>{img.src=images[imageIndex];img.style.opacity="1";},120); }
      const count = document.getElementById("galleryCount");
      if (count) count.textContent = `${imageIndex+1} / ${images.length}`;
    };
    document.getElementById("galleryPrev")?.addEventListener("click",()=>change(-1));
    document.getElementById("galleryNext")?.addEventListener("click",()=>change(1));
    if (dialog && !dialog.open) dialog.showModal();
  }
  categories?.addEventListener("click",event=>{const b=event.target.closest("[data-category]");if(!b)return;selected=b.dataset.category;renderCategories();renderProducts();});
  search?.addEventListener("input",renderProducts);
  grid.addEventListener("click",event=>{const card=event.target.closest("[data-product-id]");const p=products.find(item=>String(item.id)===card?.dataset.productId);if(p)openProduct(p);});
  grid.addEventListener("keydown",event=>{if(event.key!=="Enter"&&event.key!==" ")return;const card=event.target.closest("[data-product-id]");const p=products.find(item=>String(item.id)===card?.dataset.productId);if(p){event.preventDefault();openProduct(p);}});
  document.getElementById("close-dialog")?.addEventListener("click",()=>dialog?.close());
  dialog?.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
  async function loadProducts() {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&order=created_at.desc`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data) && data.length) products=data;
    } catch(error) { console.warn("Catálogo demonstrativo: não foi possível consultar o Supabase.",error); }
    renderCategories(); renderProducts();
  }
  loadProducts();
})();