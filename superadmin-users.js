
"use strict";

(() => {
  const root = document.getElementById("userManagement");
  if (!root) return;

  let users = [];
  let loading = false;
  let initialized = false;

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleString("pt-BR");
  };

  const isBanned = (user) =>
    user.banned_until &&
    new Date(user.banned_until).getTime() > Date.now();

  function notify(message, type = "info") {
    const notice = document.getElementById("notice");

    if (notice) {
      notice.textContent = message;
      notice.className = `notice ${type}`;
      notice.hidden = false;
    } else {
      alert(message);
    }
  }

  function styles() {
    if (document.getElementById("testUserManagementStyles")) return;

    const style = document.createElement("style");
    style.id = "testUserManagementStyles";
    style.textContent = `
      .tum-wrap { display:grid; gap:16px; }
      .tum-head {
        display:flex; justify-content:space-between;
        align-items:center; gap:12px; flex-wrap:wrap;
      }
      .tum-muted { opacity:.7; font-size:13px; }
      .tum-warning {
        padding:13px; border:1px solid #d97706;
        border-radius:10px; background:#d9770618;
        color:inherit; font-size:13px;
      }
      .tum-toolbar {
        display:flex; gap:10px; flex-wrap:wrap;
      }
      .tum-toolbar input {
        flex:1; min-width:180px;
      }
      .tum-table-wrap { overflow-x:auto; }
      .tum-table {
        width:100%; border-collapse:collapse;
        min-width:850px; font-size:13px;
      }
      .tum-table th, .tum-table td {
        padding:12px; text-align:left;
        border-bottom:1px solid var(--border-color, #8884);
        vertical-align:middle;
      }
      .tum-table th { opacity:.7; }
      .tum-actions {
        display:flex; flex-wrap:wrap; gap:6px;
      }
      .tum-actions button, .tum-toolbar button {
        cursor:pointer; padding:7px 10px;
        border-radius:7px; border:1px solid var(--border-color, #8885);
        background:var(--card-bg, transparent);
        color:inherit;
      }
      .tum-actions button:disabled { opacity:.4; cursor:not-allowed; }
      .tum-actions .danger { border-color:#dc5555; color:#e36b6b; }
      .tum-role {
        padding:6px; border-radius:7px;
        border:1px solid var(--border-color, #8885);
        background:var(--card-bg, transparent); color:inherit;
      }
      .tum-status {
        display:inline-block; padding:4px 8px;
        border-radius:20px; font-size:11px;
        background:#16a34a20;
      }
      .tum-status.banned { background:#dc262620; }
      .tum-empty { padding:25px; text-align:center; opacity:.7; }
    `;
    document.head.appendChild(style);
  }

  function render() {
    const query = (
      document.getElementById("tumSearch")?.value || ""
    ).trim().toLowerCase();

    const filtered = users.filter(user => [
      user.email,
      user.display_name,
      user.id,
      user.role
    ].join(" ").toLowerCase().includes(query));

    root.innerHTML = `
      <div class="tum-wrap">
        <div class="tum-head">
          <div>
            <h3>Gerenciamento de usuários</h3>
            <div class="tum-muted">
              ${users.length} usuário(s) encontrado(s)
            </div>
          </div>
          <button id="tumRefresh" type="button">
            ↻ Atualizar usuários
          </button>
        </div>

        <div class="tum-warning">
          <strong>Ambiente de testes.</strong>
          Os convites estão desativados até corrigirmos o
          redirecionamento de autenticação. Nenhuma operação
          deste painel deve atingir o banco de produção.
        </div>

        <div class="tum-toolbar">
          <input
            id="tumSearch"
            type="search"
            placeholder="Buscar por e-mail, nome, ID ou cargo..."
            autocomplete="off"
          >
        </div>

        <div class="tum-table-wrap">
          <table class="tum-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Cargo</th>
                <th>Status</th>
                <th>Criado em</th>
                <th>Último acesso</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length ? filtered.map(user => {
                const self =
                  user.id === window.__testSuperadminUserId;
                const banned = isBanned(user);
                const isSuperadmin = user.role === "superadmin";
                const noProfile = user.role === "no_profile";

                return `
                  <tr>
                    <td>
                      <strong>${escapeHTML(user.display_name || "Sem nome")}</strong>
                      <div>${escapeHTML(user.email)}</div>
                      <div class="tum-muted">
                        ${escapeHTML(user.id)}
                      </div>
                      ${self ? '<div class="tum-muted">Sua conta</div>' : ""}
                    </td>

                    <td>
                      <select
                        class="tum-role"
                        data-role="${escapeHTML(user.id)}"
                        ${self || noProfile ? "disabled" : ""}
                      >
                        <option value="admin"
                          ${user.role === "admin" ? "selected" : ""}>
                          Admin
                        </option>
                        <option value="superadmin"
                          ${isSuperadmin ? "selected" : ""}>
                          Superadmin
                        </option>
                      </select>
                      ${noProfile
                        ? '<div class="tum-muted">Sem perfil</div>'
                        : ""}
                    </td>

                    <td>
                      <span class="tum-status ${banned ? "banned" : ""}">
                        ${banned ? "Suspenso" : "Ativo"}
                      </span>
                    </td>

                    <td>${escapeHTML(formatDate(user.created_at))}</td>
                    <td>${escapeHTML(formatDate(user.last_sign_in_at))}</td>

                    <td>
                      <div class="tum-actions">
                        ${noProfile && !self ? `
                          <button
                            data-action="create-profile"
                            data-id="${escapeHTML(user.id)}"
                          >Criar perfil</button>
                        ` : ""}

                        ${!self && !isSuperadmin && !noProfile ? `
                          <button
                            data-action="ban"
                            data-id="${escapeHTML(user.id)}"
                          >${banned ? "Reativar" : "Suspender"}</button>
                        ` : ""}

                        ${!self && !isSuperadmin ? `
                          <button
                            class="danger"
                            data-action="delete"
                            data-id="${escapeHTML(user.id)}"
                          >Excluir</button>
                        ` : ""}
                      </div>
                    </td>
                  </tr>
                `;
              }).join("") : `
                <tr>
                  <td colspan="6" class="tum-empty">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const search = root.querySelector("#tumSearch");
    if (search) {
      search.value = query;
      search.addEventListener("input", render);
    }

    root.querySelector("#tumRefresh")
      ?.addEventListener("click", loadUsers);

    root.querySelectorAll("[data-role]").forEach(select => {
      select.addEventListener("change", async () => {
        const user = users.find(u => u.id === select.dataset.role);
        if (!user) return;

        const newRole = select.value;
        const oldRole = user.role;

        if (!confirm(
          `Alterar o cargo de ${user.email} de ${oldRole} para ${newRole}?`
        )) {
          select.value = oldRole;
          return;
        }

        select.disabled = true;

        const result = await invoke({
          action: "update_role",
          user_id: user.id,
          role: newRole
        });

        if (!result.ok) {
          notify(result.error, "error");
          await loadUsers();
          return;
        }

        notify("Cargo atualizado com sucesso.", "success");
        await loadUsers();
        document.getElementById("refreshProfiles")?.click();
      });
    });

    root.querySelectorAll("[data-action]").forEach(button => {
      button.addEventListener("click", async () => {
        const user = users.find(u => u.id === button.dataset.id);
        if (!user) return;

        const action = button.dataset.action;

        if (action === "create-profile") {
          if (!confirm(`Criar um perfil de administrador para ${user.email}?`)) {
            return;
          }

          const result = await invoke({
            action: "create_profile",
            user_id: user.id,
            role: "admin",
            display_name: user.display_name || user.email
          });

          if (!result.ok) {
            notify(result.error, "error");
            return;
          }

          notify("Perfil criado com sucesso.", "success");
          await loadUsers();
          return;
        }

        if (action === "ban") {
          const banned = !isBanned(user);
          const operation = banned ? "suspender" : "reativar";

          if (!confirm(
            `Deseja ${operation} a conta ${user.email}?`
          )) return;

          const result = await invoke({
            action: "set_ban",
            user_id: user.id,
            banned
          });

          if (!result.ok) {
            notify(result.error, "error");
            return;
          }

          notify(
            banned ? "Conta suspensa." : "Conta reativada.",
            "success"
          );

          await loadUsers();
          return;
        }

        if (action === "delete") {
          const confirmation = prompt(
            `ATENÇÃO: esta operação é irreversível.\n\n` +
            `Para excluir ${user.email}, digite o e-mail completo:`
          );

          if (confirmation === null) return;

          if (confirmation.trim().toLowerCase() !==
              user.email.trim().toLowerCase()) {
            notify("O e-mail digitado não corresponde.", "error");
            return;
          }

          if (!confirm(
            `Confirma definitivamente a exclusão de ${user.email}?`
          )) return;

          const result = await invoke({
            action: "delete_user",
            user_id: user.id,
            confirm_email: confirmation
          });

          if (!result.ok) {
            notify(result.error, "error");
            return;
          }

          notify("Usuário excluído.", "success");
          await loadUsers();
          document.getElementById("refreshProfiles")?.click();
        }
      });
    });
  }

  async function invoke(body) {
    if (window.__testSuperadminAuthorized !== true) {
      return {
        ok: false,
        error: "Sessão superadmin de teste não autorizada."
      };
    }

    if (!window.testSuperadminDb) {
      return {
        ok: false,
        error: "Cliente Supabase de teste não encontrado."
      };
    }

    try {
      const { data, error } =
        await window.testSuperadminDb.functions.invoke(
          "superadmin-control",
          { body }
        );

      if (error) {
        let message = error.message || "Falha na Edge Function.";

        try {
          const response = await error.context?.json();
          if (response?.error) message = response.error;
        } catch {}

        return { ok: false, error: message };
      }

      if (data?.error) {
        return { ok: false, error: data.error };
      }

      return { ok: true, data };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Erro inesperado."
      };
    }
  }

  async function loadUsers() {
    if (loading) return;

    if (window.__testSuperadminAuthorized !== true) {
      root.innerHTML = `
        <p class="tum-empty">
          Aguardando autenticação de superadmin...
        </p>
      `;
      return;
    }

    loading = true;
    root.innerHTML = `
      <p class="tum-empty">Carregando usuários...</p>
    `;

    const result = await invoke({ action: "list_users" });

    loading = false;

    if (!result.ok) {
      root.innerHTML = `
        <p class="tum-empty">
          Não foi possível carregar os usuários.
          <br>${escapeHTML(result.error)}
        </p>
        <button id="tumRetry" type="button">Tentar novamente</button>
      `;

      root.querySelector("#tumRetry")
        ?.addEventListener("click", loadUsers);

      return;
    }

    users = Array.isArray(result.data?.users)
      ? result.data.users
      : [];

    render();
  }

  function initialize() {
    if (initialized) return;
    if (window.__testSuperadminAuthorized !== true) return;

    initialized = true;
    styles();
    loadUsers();
  }

  window.addEventListener("test-superadmin-ready", initialize);

  if (window.__testSuperadminAuthorized === true) {
    initialize();
  }
})();
