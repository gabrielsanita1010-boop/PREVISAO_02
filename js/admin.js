// ════════════════════════════════════════════════
// PREVFISH — PAINEL ADMINISTRATIVO
// admin.js — lógica exclusiva do perfil ADMIN
// ════════════════════════════════════════════════

// ── ABA ATIVA ──
let _adminTabAtiva = "dashboard";

// ── Cache de lançamentos de todos os vendedores ──
let _adminLancamentos = [];

// ════════════════════════════════════════════════
// ENTRADA NO PAINEL ADMIN
// ════════════════════════════════════════════════
async function entrarAdmin() {
  // Preenche nome no header
  const nome = estado.vendedor?.nome || estado.vendedor?.nomeReduzido || "Admin";
  document.getElementById("admin-hdr-nome").textContent = nome;

  // Define período atual
  const agora = new Date();
  const mes   = String(agora.getMonth() + 1);
  const ano   = String(agora.getFullYear());
  estado.mes  = mes;
  estado.ano  = ano;

  const nomeMes = MESES[+mes] || mes;
  document.getElementById("admin-periodo").textContent = `${nomeMes}/${ano}`;

  // Exibe o painel admin
  document.getElementById("app").style.display       = "none";
  document.getElementById("app-admin").style.display = "block";

  // Carrega lançamentos de todos os vendedores
  mostrarLoading("Carregando dados do painel...");
  try {
    const r = await jsonp(`${API_URL}?action=getLancamentos&mes=${mes}&ano=${ano}&codVendedor=`);
    _adminLancamentos = r.lancamentos || [];
  } catch(e) {
    console.error("Admin: erro ao carregar lançamentos:", e);
    _adminLancamentos = [];
  }
  esconderLoading();

  // Renderiza a aba inicial
  adminTab("dashboard");
}

// ════════════════════════════════════════════════
// NAVEGAÇÃO ENTRE ABAS
// ════════════════════════════════════════════════
function adminTab(tab) {
  _adminTabAtiva = tab;

  // Atualiza botões
  document.querySelectorAll(".admin-tab").forEach(b => b.classList.remove("ativo"));
  const btnAtivo = document.getElementById("tab-" + tab);
  if (btnAtivo) btnAtivo.classList.add("ativo");

  // Esconde todos os conteúdos
  document.querySelectorAll(".admin-content").forEach(c => c.style.display = "none");
  const conteudo = document.getElementById("admin-" + tab);
  if (conteudo) conteudo.style.display = "block";

  // Renderiza a aba selecionada
  const renders = {
    dashboard: renderDashboard,
    usuarios:  renderUsuarios,
    clientes:  renderClientes,
    produtos:  renderProdutos,
  };
  if (renders[tab]) renders[tab]();
}

// ════════════════════════════════════════════════
// ABA — DASHBOARD
// ════════════════════════════════════════════════
function renderDashboard() {
  const vendedores  = (estado._todosVendedores || []).filter(v =>
    String(v.perfil || v.PERFIL || "VENDEDOR").toUpperCase() === "VENDEDOR"
  );
  const lancamentos = _adminLancamentos;

  // Agrupa lançamentos por vendedor
  const porVendedor = {};
  lancamentos.forEach(l => {
    const codV = String(l.COD_VENDEDOR ?? l.cod_vendedor ?? "").trim();
    if (!porVendedor[codV]) porVendedor[codV] = { kg: 0, clientes: new Set(), produtos: 0 };
    const qtd  = parseFloat(l.QUANTIDADE) || 0;
    const peso = parseFloat(l.PESO_LIQUIDO) || 25;
    porVendedor[codV].kg += qtd * peso;
    porVendedor[codV].clientes.add(String(l.COD_CLIENTE ?? "").trim());
    porVendedor[codV].produtos++;
  });

  // Totais gerais
  const totalKg     = Object.values(porVendedor).reduce((s, v) => s + v.kg, 0);
  const concluidos  = vendedores.filter(v => porVendedor[String(v.codigo || v.CODIGO || "").trim()]);
  const pendentes   = vendedores.length - concluidos.length;
  const totalCli    = Object.values(porVendedor).reduce((s, v) => s + v.clientes.size, 0);

  // Cards de resumo
  document.getElementById("admin-dash-cards").innerHTML = `
    <div class="admin-card">
      <div class="admin-card-val">${nf(totalKg)} kg</div>
      <div class="admin-card-lbl">Total kg previsto</div>
    </div>
    <div class="admin-card">
      <div class="admin-card-val">${vendedores.length}</div>
      <div class="admin-card-lbl">Vendedores</div>
    </div>
    <div class="admin-card ok">
      <div class="admin-card-val">${concluidos.length}</div>
      <div class="admin-card-lbl">Concluídos</div>
    </div>
    <div class="admin-card warn">
      <div class="admin-card-val">${pendentes}</div>
      <div class="admin-card-lbl">Pendentes</div>
    </div>
    <div class="admin-card">
      <div class="admin-card-val">${totalCli}</div>
      <div class="admin-card-lbl">Clientes atendidos</div>
    </div>
  `;

  // Tabela por vendedor
  const linhas = vendedores.map(v => {
    const cod   = String(v.codigo || v.CODIGO || v.COD_VENDEDOR || "").trim();
    const nome  = String(v.nome || v.NOME || v.VENDEDOR || "—");
    const dados = porVendedor[cod];
    const kg    = dados ? nf(dados.kg) + " kg" : "—";
    const cli   = dados ? dados.clientes.size : 0;
    const status = dados
      ? `<span class="admin-badge ok">✅ Concluído</span>`
      : `<span class="admin-badge warn">⏳ Pendente</span>`;
    return `
      <tr>
        <td><strong>${nome}</strong></td>
        <td style="font-family:var(--mono);font-size:11px;color:var(--muted2)">#${cod}</td>
        <td>${status}</td>
        <td style="font-family:var(--mono);text-align:right">${cli}</td>
        <td style="font-family:var(--mono);font-weight:700;text-align:right;color:var(--accent)">${kg}</td>
      </tr>`;
  }).join("");

  document.getElementById("admin-dash-tabela").innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Vendedor</th>
            <th>Código</th>
            <th>Status</th>
            <th style="text-align:right">Clientes</th>
            <th style="text-align:right">Total kg</th>
          </tr>
        </thead>
        <tbody>${linhas || '<tr><td colspan="5" style="text-align:center;color:var(--muted2);padding:24px">Nenhum lançamento encontrado.</td></tr>'}</tbody>
      </table>
    </div>`;
}

// ════════════════════════════════════════════════
// ABA — USUÁRIOS
// ════════════════════════════════════════════════
function renderUsuarios() {
  const usuarios = estado._todosVendedores || [];

  const linhas = usuarios.map(u => {
    const nome    = String(u.nome || u.NOME || u.VENDEDOR || "—");
    const email   = String(u.email || u.EMAIL || "—");
    const cod     = String(u.codigo || u.CODIGO || "—");
    const perfil  = String(u.perfil || u.PERFIL || "VENDEDOR").toUpperCase();
    const pAcesso = String(u.primeiroAcesso || u.PRIMEIRO_ACESSO || "false").toLowerCase() === "true";
    const badgePerfil = perfil === "ADMIN"
      ? `<span class="admin-badge admin">⚙️ Admin</span>`
      : `<span class="admin-badge vendedor">👤 Vendedor</span>`;
    const badgeAcesso = pAcesso
      ? `<span class="admin-badge warn">🔑 Aguardando 1° acesso</span>`
      : `<span class="admin-badge ok">✅ Ativo</span>`;

    return `
      <tr>
        <td><strong>${nome}</strong><br><span style="font-size:10px;color:var(--muted2);font-family:var(--mono)">${email}</span></td>
        <td style="font-family:var(--mono);font-size:11px;color:var(--muted2)">#${cod}</td>
        <td>${badgePerfil}</td>
        <td>${badgeAcesso}</td>
        <td>
          <button class="admin-btn-sm" onclick="resetarSenha('${email}', '${nome}')">🔑 Resetar senha</button>
        </td>
      </tr>`;
  }).join("");

  document.getElementById("admin-usuarios-tabela").innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Nome / E-mail</th>
            <th>Código</th>
            <th>Perfil</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>${linhas || '<tr><td colspan="5" style="text-align:center;color:var(--muted2);padding:24px">Nenhum usuário encontrado.</td></tr>'}</tbody>
      </table>
    </div>`;
}

// ════════════════════════════════════════════════
// ABA — CLIENTES
// ════════════════════════════════════════════════
let _clientesAdminFiltro = "";

function renderClientes() {
  filtrarClientesAdmin();
}

function filtrarClientesAdmin() {
  const busca    = (document.getElementById("admin-busca-cliente")?.value || "").toLowerCase();
  const clientes = (estado._todosClientes || []).filter(c => {
    const nome = String(c.nomeCliente || c.NOME_CLIENTE || "").toLowerCase();
    const cod  = String(c.codCliente  || c.COD_CLIENTE  || "").toLowerCase();
    const codV = String(c.codVendedor || c.COD_VENDEDOR || "").toLowerCase();
    // Busca nome do vendedor
    const vend = (estado._todosVendedores || []).find(v =>
      String(v.codigo || v.CODIGO || "").trim() === String(c.codVendedor || c.COD_VENDEDOR || "").trim()
    );
    const nomeV = String(vend?.nome || vend?.NOME || "").toLowerCase();
    return !busca || nome.includes(busca) || cod.includes(busca) || nomeV.includes(busca) || codV.includes(busca);
  });

  const linhas = clientes.map(c => {
    const nomeC = String(c.nomeCliente || c.NOME_CLIENTE || "—");
    const codC  = String(c.codCliente  || c.COD_CLIENTE  || "—");
    const codV  = String(c.codVendedor || c.COD_VENDEDOR || "—");
    const vend  = (estado._todosVendedores || []).find(v =>
      String(v.codigo || v.CODIGO || "").trim() === codV.trim()
    );
    const nomeV = String(vend?.nome || vend?.NOME || "—");
    return `
      <tr>
        <td style="font-family:var(--mono);font-size:11px;color:var(--muted2)">#${codC}</td>
        <td><strong>${nomeC}</strong></td>
        <td>${nomeV}</td>
        <td style="font-family:var(--mono);font-size:11px;color:var(--muted2)">#${codV}</td>
      </tr>`;
  }).join("");

  const el = document.getElementById("admin-clientes-tabela");
  if (!el) return;
  el.innerHTML = `
    <div style="margin-bottom:10px;font-family:var(--mono);font-size:11px;color:var(--muted2)">
      ${clientes.length} cliente(s) encontrado(s)
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Cliente</th>
            <th>Vendedor</th>
            <th>Cód. Vendedor</th>
          </tr>
        </thead>
        <tbody>${linhas || '<tr><td colspan="4" style="text-align:center;color:var(--muted2);padding:24px">Nenhum cliente encontrado.</td></tr>'}</tbody>
      </table>
    </div>`;
}

// ════════════════════════════════════════════════
// ABA — PRODUTOS
// ════════════════════════════════════════════════
function renderProdutos() {
  filtrarProdutosAdmin();
}

function filtrarProdutosAdmin() {
  const busca    = (document.getElementById("admin-busca-produto")?.value || "").toLowerCase();
  const produtos = (estado.produtos || []).filter(p => {
    const nome = String(
      p["dProduto.DESCR"] ?? p["dProduto.DESCRICAO"] ?? p["DESCRICAO"] ?? p["PRODUTO"] ?? p["Nome"] ?? ""
    ).toLowerCase();
    const cod  = String(p["Codigo"] ?? p["COD_PRODUTO"] ?? p["COD"] ?? "").toLowerCase();
    const fase = String(p["Fase"] ?? p["FASE"] ?? p["fase"] ?? "").toLowerCase();
    return !busca || nome.includes(busca) || cod.includes(busca) || fase.includes(busca);
  });

  const linhas = produtos.map(p => {
    const cod   = String(p["Codigo"] ?? p["COD_PRODUTO"] ?? p["COD"] ?? "—");
    const nome  = String(p["dProduto.DESCR"] ?? p["dProduto.DESCRICAO"] ?? p["DESCRICAO"] ?? p["PRODUTO"] ?? p["Nome"] ?? "—");
    const fase  = String(p["Fase"] ?? p["FASE"] ?? p["fase"] ?? "—");
    const linha = String(p["SubGrupo"] ?? p["SUBGRUPO"] ?? p["Linha"] ?? p["LINHA"] ?? "—");
    const unid  = String(p["Unidade"] ?? p["UNIDADE"] ?? p["unidade"] ?? "—");
    const peso  = parseFloat(p["Peso_Liquido"] ?? p["PESO_LIQUIDO"] ?? p["PesoLiquido"] ?? 0);
    return `
      <tr>
        <td style="font-family:var(--mono);font-size:11px;color:var(--muted2)">${cod}</td>
        <td><strong>${nome}</strong></td>
        <td><span class="admin-badge vendedor">${fase}</span></td>
        <td style="font-size:12px;color:var(--muted2)">${linha}</td>
        <td style="font-family:var(--mono);font-size:11px">${unid}</td>
        <td style="font-family:var(--mono);font-size:11px;text-align:right">${peso > 0 ? peso + " kg" : "—"}</td>
      </tr>`;
  }).join("");

  const el = document.getElementById("admin-produtos-tabela");
  if (!el) return;
  el.innerHTML = `
    <div style="margin-bottom:10px;font-family:var(--mono);font-size:11px;color:var(--muted2)">
      ${produtos.length} produto(s) encontrado(s)
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Produto</th>
            <th>Fase</th>
            <th>Linha</th>
            <th>Unidade</th>
            <th style="text-align:right">Peso liq.</th>
          </tr>
        </thead>
        <tbody>${linhas || '<tr><td colspan="6" style="text-align:center;color:var(--muted2);padding:24px">Nenhum produto encontrado.</td></tr>'}</tbody>
      </table>
    </div>`;
}

// ════════════════════════════════════════════════
// AÇÕES — RESETAR SENHA
// ════════════════════════════════════════════════
function resetarSenha(email, nome) {
  abrirModal(
    "Resetar senha",
    `Resetar a senha de <strong>${nome}</strong>? Ela voltará para <strong>12345</strong> e o usuário deverá criar uma nova no próximo acesso.`,
    async () => {
      mostrarLoading("Resetando senha...");
      try {
        await fetch(API_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action:         "alterarSenha",
            email:          email,
            novaSenha:      "12345",
            primeiroAcesso: true,
          }),
        });
        // Atualiza memória local
        const v = (estado._todosVendedores || []).find(vv =>
          String(vv.email || vv.EMAIL || "").toLowerCase() === email.toLowerCase()
        );
        if (v) {
          v.senha = "12345";
          if (v.SENHA !== undefined) v.SENHA = "12345";
          v.primeiroAcesso = true;
          if (v.PRIMEIRO_ACESSO !== undefined) v.PRIMEIRO_ACESSO = true;
        }
        esconderLoading();
        toast(`✅ Senha de ${nome} resetada para 12345.`);
        renderUsuarios();
      } catch(e) {
        esconderLoading();
        toast("❌ Erro ao resetar senha: " + e.message, "error");
      }
    }
  );
}

// ════════════════════════════════════════════════
// AÇÕES — NOVO USUÁRIO
// ════════════════════════════════════════════════
function abrirModalNovoUsuario() {
  ["nu-nome","nu-reduzido","nu-email","nu-codigo"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("nu-perfil").value = "VENDEDOR";
  const erroEl = document.getElementById("nu-erro");
  erroEl.style.display = "none";
  erroEl.textContent   = "";
  document.getElementById("modal-novo-usuario").classList.add("aberta");
  setTimeout(() => document.getElementById("nu-nome")?.focus(), 100);
}

function fecharModalNovoUsuario() {
  document.getElementById("modal-novo-usuario").classList.remove("aberta");
}

async function salvarNovoUsuario() {
  const erroEl  = document.getElementById("nu-erro");
  erroEl.style.display = "none";

  const nome     = (document.getElementById("nu-nome").value    || "").trim();
  const reduzido = (document.getElementById("nu-reduzido").value|| "").trim();
  const email    = (document.getElementById("nu-email").value   || "").trim().toLowerCase();
  const codigo   = (document.getElementById("nu-codigo").value  || "").trim();
  const perfil   = document.getElementById("nu-perfil").value;

  if (!nome || !email || !codigo) {
    erroEl.textContent   = "❌ Preencha nome, e-mail e código.";
    erroEl.style.display = "block";
    return;
  }

  const jaExiste = (estado._todosVendedores || []).some(v =>
    String(v.email || v.EMAIL || "").toLowerCase() === email
  );
  if (jaExiste) {
    erroEl.textContent   = "❌ Este e-mail já está cadastrado.";
    erroEl.style.display = "block";
    return;
  }

  mostrarLoading("Cadastrando usuário...");
  fecharModalNovoUsuario();

  try {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action:         "novoUsuario",
        nome,
        nomeReduzido:   reduzido || nome.split(" ")[0].toUpperCase(),
        email,
        codigo,
        perfil,
        senha:          "12345",
        primeiroAcesso: true,
      }),
    });

    // Adiciona na memória local para refletir imediatamente
    estado._todosVendedores.push({
      nome, NOME: nome,
      nomeReduzido: reduzido, NOME_REDUZIDO: reduzido,
      email, EMAIL: email,
      codigo, CODIGO: codigo,
      perfil, PERFIL: perfil,
      senha: "12345", SENHA: "12345",
      primeiroAcesso: true, PRIMEIRO_ACESSO: true,
    });

    esconderLoading();
    toast(`✅ Usuário ${nome} criado com senha padrão 12345.`);
    renderUsuarios();
  } catch(e) {
    esconderLoading();
    toast("❌ Erro ao cadastrar: " + e.message, "error");
  }
}
