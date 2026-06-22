// ════════════════════════════════════════════════
// PREVFISH — PAINEL ADMINISTRATIVO
// admin.js — lógica exclusiva do perfil ADMIN
// ════════════════════════════════════════════════

let _adminTabAtiva    = "dashboard";
let _adminLancamentos = [];
let _adminMesSel      = "";
let _adminAnoSel      = "";
let _chartFase        = null;
let _chartLinha       = null;
let _chartUnid        = null;

// ════════════════════════════════════════════════
// ENTRADA NO PAINEL ADMIN
// ════════════════════════════════════════════════
async function entrarAdmin() {
  const nome = estado.vendedor?.nome || estado.vendedor?.nomeReduzido || "Admin";
  document.getElementById("admin-hdr-nome").textContent = nome;

  const agora   = new Date();
  _adminMesSel  = String(agora.getMonth() + 1);
  _adminAnoSel  = String(agora.getFullYear());
  estado.mes    = _adminMesSel;
  estado.ano    = _adminAnoSel;

  document.getElementById("app").style.display       = "none";
  document.getElementById("app-admin").style.display = "block";

  await _adminCarregarMes(_adminMesSel, _adminAnoSel);
  adminTab("dashboard");
}

// ════════════════════════════════════════════════
// CARREGAR LANÇAMENTOS DO MÊS SELECIONADO
// ════════════════════════════════════════════════
async function _adminCarregarMes(mes, ano) {
  mostrarLoading("Carregando dados...");
  try {
    const r = await jsonp(`${API_URL}?action=getLancamentos&mes=${mes}&ano=${ano}&codVendedor=`);
    _adminLancamentos = r.lancamentos || [];
  } catch(e) {
    console.error("Admin: erro ao carregar:", e);
    _adminLancamentos = [];
  }
  esconderLoading();
}

// ════════════════════════════════════════════════
// FILTRO DE MÊS
// ════════════════════════════════════════════════
async function adminSelecionarMes(mes) {
  _adminMesSel = mes;
  document.querySelectorAll(".admin-mes-btn").forEach(b => {
    b.classList.toggle("ativo", b.dataset.mes === mes);
  });
  await _adminCarregarMes(mes, _adminAnoSel);
  if (_adminTabAtiva === "dashboard") renderDashboard();
}

// ════════════════════════════════════════════════
// NAVEGAÇÃO ENTRE ABAS
// ════════════════════════════════════════════════
function adminTab(tab) {
  _adminTabAtiva = tab;
  document.querySelectorAll(".admin-tab").forEach(b => b.classList.remove("ativo"));
  const btnAtivo = document.getElementById("tab-" + tab);
  if (btnAtivo) btnAtivo.classList.add("ativo");
  document.querySelectorAll(".admin-content").forEach(c => c.style.display = "none");
  const conteudo = document.getElementById("admin-" + tab);
  if (conteudo) conteudo.style.display = "block";
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
  const nomeMes   = MESES[+_adminMesSel] || _adminMesSel;
  document.getElementById("admin-periodo").textContent = `${nomeMes}/${_adminAnoSel}`;

  // Atualiza botões de mês
  document.querySelectorAll(".admin-mes-btn").forEach(b => {
    b.classList.toggle("ativo", b.dataset.mes === _adminMesSel);
  });

  const vendedores  = (estado._todosVendedores || []).filter(v =>
    String(v.perfil || v.PERFIL || "VENDEDOR").toUpperCase() === "VENDEDOR"
  );
  const lancamentos = _adminLancamentos;

  // ── Agrupa por vendedor ──
  const porVendedor = {};
  lancamentos.forEach(l => {
    const codV = String(l.COD_VENDEDOR ?? "").trim();
    if (!porVendedor[codV]) porVendedor[codV] = { kg: 0, clientes: new Set() };
    const qtd  = parseFloat(l.QUANTIDADE)   || 0;
    const peso = parseFloat(l.PESO_LIQUIDO) || 25;
    porVendedor[codV].kg += qtd * peso;
    porVendedor[codV].clientes.add(String(l.COD_CLIENTE ?? "").trim());
  });

  // ── Totais ──
  const totalKg    = Object.values(porVendedor).reduce((s, v) => s + v.kg, 0);
  const concluidos = vendedores.filter(v => porVendedor[String(v.codigo || "").trim()]);
  const pendentes  = vendedores.length - concluidos.length;
  const totalCli   = Object.values(porVendedor).reduce((s, v) => s + v.clientes.size, 0);
  const pct        = vendedores.length ? Math.round(concluidos.length / vendedores.length * 100) : 0;
  const pctPend    = 100 - pct;

  // ── Cards ──
  document.getElementById("admin-dash-cards").innerHTML = `
    <div class="admin-card admin-card-accent">
      <div class="admin-card-val">${nfT(totalKg)}</div>
      <div class="admin-card-lbl">Total kg previsto</div>
    </div>
    <div class="admin-card">
      <div class="admin-card-val">${vendedores.length}</div>
      <div class="admin-card-lbl">Vendedores</div>
    </div>
    <div class="admin-card admin-card-ok">
      <div class="admin-card-val">${concluidos.length}</div>
      <div class="admin-card-lbl">Concluídos</div>
      <div class="admin-card-delta ok">${pct}% do total</div>
    </div>
    <div class="admin-card admin-card-warn">
      <div class="admin-card-val warn">${pendentes}</div>
      <div class="admin-card-lbl">Pendentes</div>
      <div class="admin-card-delta warn">${pctPend}% ainda abertos</div>
    </div>
    <div class="admin-card">
      <div class="admin-card-val">${totalCli}</div>
      <div class="admin-card-lbl">Clientes atendidos</div>
      <div class="admin-card-delta">${vendedores.length ? (totalCli / vendedores.length).toFixed(1) : 0} por vendedor</div>
    </div>`;

  // ── Top 10 clientes ──
  const porCliente = {};
  lancamentos.forEach(l => {
    const k    = String(l.COD_CLIENTE ?? "").trim();
    const nome = String(l.CLIENTE ?? "—");
    if (!porCliente[k]) porCliente[k] = { nome, kg: 0 };
    const qtd  = parseFloat(l.QUANTIDADE)   || 0;
    const peso = parseFloat(l.PESO_LIQUIDO) || 25;
    porCliente[k].kg += qtd * peso;
  });
  const topCli = Object.values(porCliente).sort((a,b) => b.kg - a.kg).slice(0, 10);
  const maxCli = topCli[0]?.kg || 1;
  const linhasCli = topCli.map((c, i) => `
    <div class="admin-rank-row">
      <span class="admin-rank-n">${i+1}</span>
      <span class="admin-rank-name">${c.nome}</span>
      <div class="admin-rank-bar-wrap"><div class="admin-rank-bar" style="width:${Math.round(c.kg/maxCli*100)}%"></div></div>
      <span class="admin-rank-val">${nfT(c.kg)}</span>
    </div>`).join("") || '<p style="color:var(--muted2);font-size:12px;padding:8px 0">Sem dados</p>';

  // ── Top 10 vendedores ──
  const topVend = vendedores
    .map(v => ({ nome: v.nome || v.NOME || "—", kg: porVendedor[String(v.codigo||"").trim()]?.kg || 0 }))
    .sort((a,b) => b.kg - a.kg).slice(0, 10);
  const maxVend = topVend[0]?.kg || 1;
  const linhasVend = topVend.map((v, i) => `
    <div class="admin-rank-row">
      <span class="admin-rank-n">${i+1}</span>
      <span class="admin-rank-name">${v.nome}</span>
      <div class="admin-rank-bar-wrap"><div class="admin-rank-bar" style="width:${Math.round(v.kg/maxVend*100)}%"></div></div>
      <span class="admin-rank-val">${nfT(v.kg)}</span>
    </div>`).join("") || '<p style="color:var(--muted2);font-size:12px;padding:8px 0">Sem dados</p>';

  document.getElementById("admin-dash-rankings").innerHTML = `
    <div class="admin-rank-box">
      <div class="admin-rank-titulo">🏆 Top 10 clientes por kg</div>
      ${linhasCli}
    </div>
    <div class="admin-rank-box">
      <div class="admin-rank-titulo">🥇 Top 10 vendedores por kg</div>
      ${linhasVend}
    </div>`;

  // ── Gráficos — Fase, Linha, Unidade ──
  const porFase  = {};
  const porLinha = {};
  const porUnid  = {};

  lancamentos.forEach(l => {
    const qtd  = parseFloat(l.QUANTIDADE)   || 0;
    const peso = parseFloat(l.PESO_LIQUIDO) || 25;
    const kg   = qtd * peso;

    // Fase vem do lançamento (campo FASE copiado do produto)
    const fase  = String(l.FASE  || l["dProduto.FASE"]  || "Outros").trim();
    const linha = String(l.SUB_GRUPO || l["dProduto.SUB_GRUPO"] || "Outros").trim();
    const unid  = String(l.UNIDADE  || "—").trim();

    porFase[fase]   = (porFase[fase]   || 0) + kg;
    porLinha[linha] = (porLinha[linha] || 0) + kg;
    porUnid[unid]   = (porUnid[unid]   || 0) + kg;
  });

  const sortDesc = obj => Object.entries(obj).sort((a,b) => b[1]-a[1]);

  const faseEntries  = sortDesc(porFase);
  const linhaEntries = sortDesc(porLinha);
  const unidEntries  = sortDesc(porUnid);

  const coresFase  = ["#0F6E56","#1D9E75","#5DCAA5","#9FE1CB","#E1F5EE"];
  const coresLinha = ["#185FA5","#378ADD","#85B7EB","#B5D4F4","#E6F1FB"];
  const coresUnid  = ["#0F6E56","#1D9E75","#5DCAA5","#9FE1CB","#E1F5EE"];

  _renderGrafico("chartFase",  faseEntries,  coresFase,  "_chartFase");
  _renderGrafico("chartLinha", linhaEntries, coresLinha, "_chartLinha");
  _renderGrafico("chartUnid",  unidEntries,  coresUnid,  "_chartUnid", true);

  // ── Tabela status por vendedor ──
  const linhasTabela = vendedores.map(v => {
    const cod   = String(v.codigo || "").trim();
    const nome  = String(v.nome   || "—");
    const dados = porVendedor[cod];
    const kg    = dados ? nfT(dados.kg) : "—";
    const cli   = dados ? dados.clientes.size : 0;
    const status = dados
      ? `<span class="admin-badge ok">✅ Concluído</span>`
      : `<span class="admin-badge warn">⏳ Pendente</span>`;
    return `<tr>
      <td><strong>${nome}</strong></td>
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
            <th>Status</th>
            <th style="text-align:right">Clientes</th>
            <th style="text-align:right">Total kg</th>
          </tr>
        </thead>
        <tbody>${linhasTabela || '<tr><td colspan="4" style="text-align:center;color:var(--muted2);padding:24px">Nenhum lançamento encontrado.</td></tr>'}</tbody>
      </table>
    </div>`;
}

// ── Render de gráfico horizontal reutilizável ──
function _renderGrafico(canvasId, entries, cores, varName, mini) {
  if (window[varName]) { window[varName].destroy(); window[varName] = null; }
  const el = document.getElementById(canvasId);
  if (!el || !entries.length) return;
  const labels = entries.map(e => e[0]);
  const data   = entries.map(e => e[1]);
  window[varName] = new Chart(el, {
    type: "bar",
    data: { labels, datasets: [{ data, backgroundColor: cores.slice(0, labels.length), borderRadius: 4, borderSkipped: false }] },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => " " + nfT(c.raw) } } },
      scales: {
        x: { ticks: { font: { size: mini ? 9 : 10 }, callback: v => nfT(v) }, grid: { color: "rgba(128,128,128,0.08)" } },
        y: { ticks: { font: { size: mini ? 10 : 11 } }, grid: { display: false } }
      }
    }
  });
}

// ── Formata kg em toneladas se >= 1000 ──
function nfT(kg) {
  if (kg >= 1000) return (kg / 1000).toFixed(1).replace(".", ",") + " t";
  return nf(kg) + " kg";
}

// ════════════════════════════════════════════════
// ABA — USUÁRIOS
// ════════════════════════════════════════════════
function renderUsuarios() {
  const usuarios = estado._todosVendedores || [];
  const linhas = usuarios.map(u => {
    const nome    = String(u.nome || "—");
    const email   = String(u.email || "—");
    const perfil  = String(u.perfil || "VENDEDOR").toUpperCase();
    const pAcesso = String(u.primeiroAcesso || "false").toLowerCase() === "true";
    const badgePerfil = perfil === "ADMIN"
      ? `<span class="admin-badge admin">⚙️ Admin</span>`
      : `<span class="admin-badge vendedor">👤 Vendedor</span>`;
    const badgeAcesso = pAcesso
      ? `<span class="admin-badge warn">🔑 Aguardando 1° acesso</span>`
      : `<span class="admin-badge ok">✅ Ativo</span>`;
    return `<tr>
      <td><strong>${nome}</strong><br><span style="font-size:10px;color:var(--muted2);font-family:var(--mono)">${email}</span></td>
      <td>${badgePerfil}</td>
      <td>${badgeAcesso}</td>
      <td><button class="admin-btn-sm" onclick="resetarSenha('${email}','${nome}')">🔑 Resetar senha</button></td>
    </tr>`;
  }).join("");

  document.getElementById("admin-usuarios-tabela").innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>Nome / E-mail</th><th>Perfil</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="4" style="text-align:center;color:var(--muted2);padding:24px">Nenhum usuário.</td></tr>'}</tbody>
      </table>
    </div>`;
}

// ════════════════════════════════════════════════
// ABA — CLIENTES
// ════════════════════════════════════════════════
function renderClientes() { filtrarClientesAdmin(); }

function filtrarClientesAdmin() {
  const busca    = (document.getElementById("admin-busca-cliente")?.value || "").toLowerCase();
  const clientes = (estado._todosClientes || []).filter(c => {
    const nome = String(c.nomeCliente || "").toLowerCase();
    const cod  = String(c.codCliente  || "").toLowerCase();
    const vend = (estado._todosVendedores || []).find(v => String(v.codigo||"").trim() === String(c.codVendedor||"").trim());
    const nomeV = String(vend?.nome || "").toLowerCase();
    return !busca || nome.includes(busca) || cod.includes(busca) || nomeV.includes(busca);
  });
  const linhas = clientes.map(c => {
    const nomeC = String(c.nomeCliente || "—");
    const codC  = String(c.codCliente  || "—");
    const codV  = String(c.codVendedor || "—");
    const vend  = (estado._todosVendedores || []).find(v => String(v.codigo||"").trim() === codV.trim());
    const nomeV = String(vend?.nome || "—");
    return `<tr>
      <td style="font-family:var(--mono);font-size:11px;color:var(--muted2)">#${codC}</td>
      <td><strong>${nomeC}</strong></td>
      <td>${nomeV}</td>
    </tr>`;
  }).join("");
  const el = document.getElementById("admin-clientes-tabela");
  if (!el) return;
  el.innerHTML = `
    <div style="margin-bottom:10px;font-family:var(--mono);font-size:11px;color:var(--muted2)">${clientes.length} cliente(s)</div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>Código</th><th>Cliente</th><th>Vendedor</th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="3" style="text-align:center;color:var(--muted2);padding:24px">Nenhum cliente encontrado.</td></tr>'}</tbody>
      </table>
    </div>`;
}

// ════════════════════════════════════════════════
// ABA — PRODUTOS
// ════════════════════════════════════════════════
function renderProdutos() { filtrarProdutosAdmin(); }

function filtrarProdutosAdmin() {
  const busca    = (document.getElementById("admin-busca-produto")?.value || "").toLowerCase();
  const produtos = (estado.produtos || []).filter(p => {
    const nome = String(p["dProduto.DESCR"] ?? p["DESCRICAO"] ?? p["PRODUTO"] ?? "").toLowerCase();
    const fase = String(p["dProduto.FASE"]  ?? p["FASE"] ?? "").toLowerCase();
    const linha= String(p["dProduto.SUB_GRUPO"] ?? p["SUB_GRUPO"] ?? "").toLowerCase();
    return !busca || nome.includes(busca) || fase.includes(busca) || linha.includes(busca);
  });
  const linhas = produtos.map(p => {
    const cod   = String(p["Codigo"]   ?? p["COD_PRODUTO"] ?? "—");
    const nome  = String(p["dProduto.DESCR"] ?? p["DESCRICAO"] ?? p["PRODUTO"] ?? "—");
    const fase  = String(p["dProduto.FASE"]  ?? p["FASE"]  ?? "—");
    const linha = String(p["dProduto.SUB_GRUPO"] ?? p["SUB_GRUPO"] ?? "—");
    const unid  = String(p["Unidade"]  ?? p["UNIDADE"] ?? "—");
    const peso  = parseFloat(p["Peso_Liquido"] ?? p["PESO_LIQUIDO"] ?? 0);
    return `<tr>
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
    <div style="margin-bottom:10px;font-family:var(--mono);font-size:11px;color:var(--muted2)">${produtos.length} produto(s)</div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>Código</th><th>Produto</th><th>Fase</th><th>Linha</th><th>Unidade</th><th style="text-align:right">Peso liq.</th></tr></thead>
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
          method: "POST", mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "alterarSenha", email, novaSenha: "12345", primeiroAcesso: true }),
        });
        const v = (estado._todosVendedores || []).find(vv => String(vv.email||"").toLowerCase() === email.toLowerCase());
        if (v) { v.senha = "12345"; v.primeiroAcesso = true; }
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
  ["nu-nome","nu-reduzido","nu-email","nu-codigo"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  document.getElementById("nu-perfil").value = "VENDEDOR";
  const erroEl = document.getElementById("nu-erro");
  erroEl.style.display = "none"; erroEl.textContent = "";
  document.getElementById("modal-novo-usuario").classList.add("aberta");
  setTimeout(() => document.getElementById("nu-nome")?.focus(), 100);
}

function fecharModalNovoUsuario() {
  document.getElementById("modal-novo-usuario").classList.remove("aberta");
}

async function salvarNovoUsuario() {
  const erroEl   = document.getElementById("nu-erro");
  erroEl.style.display = "none";
  const nome     = (document.getElementById("nu-nome").value    || "").trim();
  const reduzido = (document.getElementById("nu-reduzido").value|| "").trim();
  const email    = (document.getElementById("nu-email").value   || "").trim().toLowerCase();
  const codigo   = (document.getElementById("nu-codigo").value  || "").trim();
  const perfil   = document.getElementById("nu-perfil").value;
  if (!nome || !email || !codigo) { erroEl.textContent = "❌ Preencha nome, e-mail e código."; erroEl.style.display = "block"; return; }
  const jaExiste = (estado._todosVendedores || []).some(v => String(v.email||"").toLowerCase() === email);
  if (jaExiste) { erroEl.textContent = "❌ E-mail já cadastrado."; erroEl.style.display = "block"; return; }
  mostrarLoading("Cadastrando usuário...");
  fecharModalNovoUsuario();
  try {
    await fetch(API_URL, {
      method: "POST", mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "novoUsuario", nome, nomeReduzido: reduzido || nome.split(" ")[0].toUpperCase(), email, codigo, perfil, senha: "12345", primeiroAcesso: true }),
    });
    estado._todosVendedores.push({ nome, email, codigo, perfil, senha: "12345", primeiroAcesso: true });
    esconderLoading();
    toast(`✅ Usuário ${nome} criado com senha padrão 12345.`);
    renderUsuarios();
  } catch(e) {
    esconderLoading();
    toast("❌ Erro ao cadastrar: " + e.message, "error");
  }
}
