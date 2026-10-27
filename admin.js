
const SUPABASE_URL = "https://hyovvejtvzptzskxbkrr.supabase.co";
const SUPABASE_KEY = "sb_publishable_a0xRmApdgaH-KzxS2gh4KQ_wl1obK0z";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const $ = id => document.getElementById(id);

function message(text) {
  $("message").textContent = text;
}

function showDashboard(show) {
  $("loginPanel").classList.toggle("hidden", show);
  $("dashboard").classList.toggle("hidden", !show);
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

async function verifyAdmin() {
  const { data: { session }, error } = await db.auth.getSession();

  if (error) throw error;

  if (!session) {
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
    showDashboard(false);
    throw new Error("Esta conta não tem permissão de administrador.");
  }

  $("welcome").textContent =
    "Conectado como " +
    (profile.display_name || session.user.email) +
    " (" + profile.role + ")";

  showDashboard(true);
  await loadProducts();
  return true;
}

async function loadProducts() {
  message("Carregando produtos...");

  const { data, error } = await db
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    message("Erro ao carregar produtos: " + error.message);
    return;
  }

  const container = $("products");
  container.replaceChildren();

  if (!data.length) {
    container.textContent = "Nenhum produto cadastrado ainda.";
  }

  for (const product of data) {
    const card = document.createElement("article");
    card.className = "product";

    const image = product.image_url
      ? `<img src="${escapeHTML(product.image_url)}"
          alt="${escapeHTML(product.name)}" loading="lazy">`
      : "";

    card.innerHTML = `
      ${image}
      <h3>${escapeHTML(product.name)}</h3>
      <p>${escapeHTML(product.category || "")}</p>
      <p>${Number(product.price).toLocaleString("pt-BR", {
        style: "currency", currency: "BRL"
      })}</p>
      <p>${escapeHTML(product.description || "")}</p>
      <p>Status: ${escapeHTML(product.status)}</p>
      <button type="button" data-edit="${escapeHTML(product.id)}">
        Editar
      </button>
      <button type="button" class="danger"
        data-delete="${escapeHTML(product.id)}">
        Excluir
      </button>
    `;

    container.appendChild(card);
  }

  message("Lista atualizada.");
}

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  message("Entrando...");

  const { error } = await db.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value
  });

  if (error) {
    message("Não foi possível entrar. Confira os dados da conta.");
    return;
  }

  try {
    await verifyAdmin();
    message("Login realizado.");
  } catch (error) {
    message(error.message || "Erro ao verificar a conta.");
  }
});

$("logout").addEventListener("click", async () => {
  await db.auth.signOut();
  showDashboard(false);
  message("Você saiu da conta.");
});

$("refresh").addEventListener("click", loadProducts);

function resetForm() {
  $("productForm").reset();
  $("productId").value = "";
  $("formTitle").textContent = "Cadastrar produto";
  $("cancelEdit").classList.add("hidden");
}

$("cancelEdit").addEventListener("click", resetForm);

$("products").addEventListener("click", async event => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;

  if (editId) {
    const { data, error } = await db
      .from("products")
      .select("*")
      .eq("id", editId)
      .single();

    if (error) {
      message("Erro ao abrir produto: " + error.message);
      return;
    }

    $("productId").value = data.id;
    $("name").value = data.name || "";
    $("category").value = data.category || "";
    $("price").value = data.price ?? 0;
    $("description").value = data.description || "";
    $("status").value = data.status || "available";
    $("photo").value = "";
    $("formTitle").textContent = "Editar produto";
    $("cancelEdit").classList.remove("hidden");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (deleteId) {
    if (!confirm("Tem certeza que deseja excluir este produto?")) {
      return;
    }

    const { error } = await db
      .from("products")
      .delete()
      .eq("id", deleteId);

    if (error) {
      message("Erro ao excluir: " + error.message);
      return;
    }

    message("Produto excluído.");
    await loadProducts();
  }
});

$("productForm").addEventListener("submit", async event => {
  event.preventDefault();
  message("Salvando produto...");

  try {
    const id = $("productId").value;
    const file = $("photo").files[0];
    let imageUrl = null;

    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("A imagem deve ter no máximo 5 MB.");
      }

      const allowedTypes = [
        "image/jpeg", "image/png", "image/webp"
      ];

      if (!allowedTypes.includes(file.type)) {
        throw new Error("Use uma imagem JPG, PNG ou WebP.");
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await db.storage
        .from("product-images")
        .upload(path, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = db.storage
        .from("product-images")
        .getPublicUrl(path);

      imageUrl = publicData.publicUrl;
    }

    const product = {
      name: $("name").value.trim(),
      category: $("category").value.trim(),
      price: Number($("price").value),
      description: $("description").value.trim(),
      status: $("status").value
    };

    if (!product.name || !product.category ||
        !Number.isFinite(product.price) || product.price < 0) {
      throw new Error("Confira o nome, a categoria e o preço.");
    }

    if (imageUrl) product.image_url = imageUrl;

    const result = id
      ? await db.from("products").update(product).eq("id", id)
      : await db.from("products").insert(product);

    if (result.error) throw result.error;

    resetForm();
    message("Produto salvo com sucesso!");
    await loadProducts();
  } catch (error) {
    message("Não foi possível salvar: " + error.message);
  }
});

db.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) {
    showDashboard(false);
  }
});

verifyAdmin().catch(error => message(error.message));
