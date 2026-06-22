// ════════════════════════════════════════════════
// PREVFISH — PAINEL ADMINISTRATIVO
// admin.js — filtros cruzados + gráficos interativos
// ════════════════════════════════════════════════

// ── ESTADO ──
let _adminTabAtiva    = "dashboard";
let _adminLancamentos = [];
let _adminMesSel      = "";
let _adminAnoSel      = "";
let _charts           = {};

let _adminFiltros = {
  fase: null, linha: null, unidade: null, vendedor: null, cliente: null
};

const _FILTRO_NOME = {
  fase: "Fase", linha: "Linha", unidade: "Unidade",
  vendedor: "Vendedor", cliente: "Cliente"
};

// Cores base por dimensão
const CORES_FASE  = ["#0F6E56","#1D9E75","#5DCAA5","#9FE1CB","#C8EFE3","#E1F5EE"];
const CORES_LINHA = ["#185FA5","#378ADD","#85B7EB","#B5D4F4","#D0E8FA","#E6F1FB"];
const CORES_UNID  = ["#854F0B","#BA7517","#EF9F27","#FAC775","#FAE0A8","#FAEEDA"];

function _hexFade(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ════════════════════════════════════════════════
// ENTRADA NO PAINEL ADMIN
// ════════════════════════════════════════════════
async function entrarAdmin() {
  const nome = estado.vendedor?.nome || estado.vendedor?.nomeReduzido || "Admin";
  document.getElementById("admin-hdr-nome").textContent = nome;

  const agora  = new Date();
  _adminMesSel = String(agora.getMonth() + 1);
  _adminAnoSel = String(agora.getFullYear());
  estado.mes   = _adminMesSel;
  estado.ano   = _adminAnoSel;

  document.getElementById("app").style.display       = "none";
  document.getElementById("app-admin").style.display = "block";

  await _adminCarregarMes(_adminMesSel, _adminAnoSel);
  adminTab("dashboard");
}

// ════════════════════════════════════════════════
// CARREGAR LANÇAMENTOS
// ════════════════════════════════════════════════
async function _adminCarregarMes(mes, ano) {
  mostrarLoading("Carregando dados...");
  try {
    const r = await jsonp(`${API_URL}?action=getLancamentos&mes=${mes}&ano=${ano}&codVendedor=`);
    _adminLancamentos = r.lancamentos || [];
  } catch(e) {
    console.error("Admin:", e);
    _adminLancamentos = [];
  }
  esconderLoading();
}

// ════════════════════════════════════════════════
// FILTRO DE MÊS
// ════════════════════════════════════════════════
async function adminSelecionarMes(mes) {
  _adminMesSel = mes;
  _adminFiltros = { fase: null, linha: null, unidade: null, vendedor: null, cliente: null };
  document.querySelectorAll(".admin-mes-btn").forEach(b =>
    b.classList.toggle("ativo", b.dataset.mes === mes)
  );
  await _adminCarregarMes(mes, _adminAnoSel);
  if (_adminTabAtiva === "dashboard") renderDashboard();
}

// ════════════════════════════════════════════════
// FILTROS CRUZADOS
// ════════════════════════════════════════════════
function _adminDadosFiltrados() {
  return _adminLancamentos.filter(l => {
    const fase  = String(l.FASE    || "").trim();
    const linha = String(l.SUB_GRUPO || l["dProduto.SUB_GRUPO"] || "").trim();
    const unid  = String(l.UNIDADE || "").trim();
    const vend  = String(l.COD_VENDEDOR || "").trim();
    const cli   = String(l.COD_CLIENTE  || "").trim();
    if (_adminFiltros.fase     && fase  !== _adminFiltros.fase)     return false;
    if (_adminFiltros.linha    && linha !== _adminFiltros.linha)    return false;
    if (_adminFiltros.unidade  && unid  !== _adminFiltros.unidade)  return false;
    if (_adminFiltros.vendedor && vend  !== _adminFiltros.vendedor) return false;
    if (_adminFiltros.cliente  && cli   !== _adminFiltros.cliente)  return false;
    return true;
  });
}

function _aplicarFiltro(key, value) {
  _adminFiltros[key] = (_adminFiltros[key] === value) ? null : value;
  renderDashboard();
}

function adminLimparFiltros() {
  _adminFiltros = { fase: null, linha: null, unidade: null, vendedor: null, cliente: null };
  renderDashboard();
}

// ════════════════════════════════════════════════
// NAVEGAÇÃO ENTRE ABAS
// ════════════════════════════════════════════════
function adminTab(tab) {
  _adminTabAtiva = tab;
  document.querySelectorAll(".admin-tab").forEach(b => b.classList.remove("ativo"));
  const btn = document.getElementById("tab-" + tab);
  if (btn) btn.classList.add("ativo");
  document.querySelectorAll(".admin-content").forEach(c => c.style.display = "none");
  const conteudo = document.getElementById("admin-" + tab);
  if (conteudo) conteudo.style.display = "block";
  const renders = { dashboard: renderDashboard, usuarios: renderUsuarios, clientes: renderClientes, produtos: renderProdutos };
  if (renders[tab]) renders[tab]();
}

// ════════════════════════════════════════════════
// ABA — DASHBOARD
// ════════════════════════════════════════════════
function renderDashboard() {
  // ── Período ──
  const nomeMes = MESES[+_adminMesSel] || _adminMesSel;
  document.getElementById("admin-periodo").textContent = `${nomeMes}/${_adminAnoSel}`;

  // ── Botões de mês ──
  document.querySelectorAll(".admin-mes-btn").forEach(b =>
    b.classList.toggle("ativo", b.dataset.mes === _adminMesSel)
  );

  // ── Chips de filtros ativos ──
  _renderChips();

  // ── Dados filtrados ──
  const dados = _adminDadosFiltrados();

  // ── Vendedores (apenas perfil VENDEDOR) ──
  const vendedores = (estado._todosVendedores || []).filter(v =>
    String(v.perfil || "VENDEDOR").toUpperCase() === "VENDEDOR"
  );

  // ── Agrega por vendedor ──
  const porVendedor = {};
  dados.forEach(l => {
    const codV = String(l.COD_VENDEDOR || "").trim();
    if (!porVendedor[codV]) porVendedor[codV] = { kg: 0, clientes: new Set() };
    const qtd  = parseFloat(l.QUANTIDADE)   || 0;
    const peso = parseFloat(l.PESO_LIQUIDO) || 25;
    porVendedor[codV].kg += qtd * peso;
    porVendedor[codV].clientes.add(String(l.COD_CLIENTE || "").trim());
  });

  // ── Totais ──
  const totalKg    = Object.values(porVendedor).reduce((s,v) => s + v.kg, 0);
  const concluidos = vendedores.filter(v => porVendedor[String(v.codigo||"").trim()]);
  const pendentes  = vendedores.length - concluidos.length;
  const totalCli   = Object.values(porVendedor).reduce((s,v) => s + v.clientes.size, 0);
  const pct        = vendedores.length ? Math.round(concluidos.length / vendedores.length * 100) : 0;

  // ── CARDS ──
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
      <div class="admin-card-delta warn">${100-pct}% ainda abertos</div>
    </div>
    <div class="admin-card">
      <div class="admin-card-val">${totalCli}</div>
      <div class="admin-card-lbl">Clientes atendidos</div>
      <div class="admin-card-delta">${vendedores.length ? (totalCli/vendedores.length).toFixed(1) : 0} por vendedor</div>
    </div>`;

  // ── RANKINGS ──
  const porCliente = {};
  dados.forEach(l => {
    const k    = String(l.COD_CLIENTE || "").trim();
    const nome = String(l.CLIENTE     || "—");
    if (!porCliente[k]) porCliente[k] = { nome, kg: 0, cod: k };
    const qtd  = parseFloat(l.QUANTIDADE)   || 0;
    const peso = parseFloat(l.PESO_LIQUIDO) || 25;
    porCliente[k].kg += qtd * peso;
  });
  const topCli  = Object.values(porCliente).sort((a,b) => b.kg - a.kg).slice(0,10);
  const maxCli  = topCli[0]?.kg || 1;

  const topVend = vendedores
    .map(v => ({ nome: v.nome||"—", kg: porVendedor[String(v.codigo||"").trim()]?.kg||0, cod: String(v.codigo||"").trim() }))
    .sort((a,b) => b.kg - a.kg).slice(0,10);
  const maxVend = topVend[0]?.kg || 1;

  const mkRankCli = (c, i) => {
    const ativo = _adminFiltros.cliente === c.cod;
    return `<div class="admin-rank-row${ativo?" ativo":""}" onclick="_aplicarFiltro('cliente','${c.cod}')" title="Filtrar por ${c.nome}">
      <span class="admin-rank-n">${i+1}</span>
      <span class="admin-rank-name">${c.nome}</span>
      <div class="admin-rank-bar-wrap"><div class="admin-rank-bar" style="width:${Math.round(c.kg/maxCli*100)}%"></div></div>
      <span class="admin-rank-val">${nfT(c.kg)}</span>
    </div>`;
  };
  const mkRankVend = (v, i) => {
    const ativo = _adminFiltros.vendedor === v.cod;
    return `<div class="admin-rank-row${ativo?" ativo":""}" onclick="_aplicarFiltro('vendedor','${v.cod}')" title="Filtrar por ${v.nome}">
      <span class="admin-rank-n">${i+1}</span>
      <span class="admin-rank-name">${v.nome}</span>
      <div class="admin-rank-bar-wrap"><div class="admin-rank-bar" style="width:${Math.round(v.kg/maxVend*100)}%"></div></div>
      <span class="admin-rank-val">${nfT(v.kg)}</span>
    </div>`;
  };

  document.getElementById("admin-dash-rankings").innerHTML = `
    <div class="admin-rank-box">
      <div class="admin-rank-titulo">🏆 Top 10 clientes por kg</div>
      ${topCli.map(mkRankCli).join("") || '<p class="admin-vazio">Sem dados</p>'}
    </div>
    <div class="admin-rank-box">
      <div class="admin-rank-titulo">🥇 Top 10 vendedores por kg</div>
      ${topVend.map(mkRankVend).join("") || '<p class="admin-vazio">Sem dados</p>'}
    </div>`;

  // ── AGREGA FASE, LINHA, UNIDADE ──
  const porFase  = {};
  const porLinha = {};
  const porUnid  = {};

  dados.forEach(l => {
    const qtd  = parseFloat(l.QUANTIDADE)   || 0;
    const peso = parseFloat(l.PESO_LIQUIDO) || 25;
    const kg   = qtd * peso;
    const fase  = String(l.FASE    || "Outros").trim();
    const linha = String(l.SUB_GRUPO || l["dProduto.SUB_GRUPO"] || "Outros").trim();
    const unid  = String(l.UNIDADE || "—").trim();
    porFase[fase]   = (porFase[fase]   || 0) + kg;
    porLinha[linha] = (porLinha[linha] || 0) + kg;
    porUnid[unid]   = (porUnid[unid]   || 0) + kg;
  });

  const sortDesc = obj => Object.entries(obj).sort((a,b) => b[1]-a[1]);

  _renderGrafico("chartFase",  "fase",    sortDesc(porFase),  CORES_FASE);
  _renderGrafico("chartLinha", "linha",   sortDesc(porLinha), CORES_LINHA);
  _renderGrafico("chartUnid",  "unidade", sortDesc(porUnid),  CORES_UNID);

  // ── TABELA VENDEDORES ──
  const linhasTabela = vendedores.map(v => {
    const cod   = String(v.codigo || "").trim();
    const nome  = String(v.nome   || "—");
    const dados = porVendedor[cod];
    const kg    = dados ? nfT(dados.kg) : "—";
    const cli   = dados ? dados.clientes.size : 0;
    const ativo = _adminFiltros.vendedor === cod;
    const status = dados
      ? `<span class="admin-badge ok">✅ Concluído</span>`
      : `<span class="admin-badge warn">⏳ Pendente</span>`;
    return `<tr class="admin-tr-click${ativo?" ativo":""}" onclick="_aplicarFiltro('vendedor','${cod}')" title="Filtrar por ${nome}">
      <td><strong>${nome}</strong></td>
      <td>${status}</td>
      <td style="font-family:var(--mono);text-align:right">${cli}</td>
      <td style="font-family:var(--mono);font-weight:700;text-align:right;color:var(--accent)">${kg}</td>
    </tr>`;
  }).join("");

  document.getElementById("admin-dash-tabela").innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr>
          <th>Vendedor</th><th>Status</th>
          <th style="text-align:right">Clientes</th>
          <th style="text-align:right">Total kg</th>
        </tr></thead>
        <tbody>${linhasTabela || '<tr><td colspan="4" style="text-align:center;color:var(--muted2);padding:24px">Nenhum lançamento.</td></tr>'}</tbody>
      </table>
    </div>`;
}

// ── Chips de filtros ativos ──
function _renderChips() {
  const ativos = Object.entries(_adminFiltros).filter(([,v]) => v !== null);
  const el = document.getElementById("admin-chips-filtros");
  if (!el) return;
  if (!ativos.length) { el.innerHTML = ""; return; }

  const chips = ativos.map(([k, v]) =>
    `<span class="admin-chip">
      ${_FILTRO_NOME[k]}: <strong>${v}</strong>
      <button onclick="_aplicarFiltro('${k}','${v}')" title="Remover filtro">✕</button>
    </span>`
  ).join("");

  el.innerHTML = `
    <div class="admin-chips-bar">
      ${chips}
      <button class="admin-chip-limpar" onclick="adminLimparFiltros()">🗑️ Limpar filtros</button>
    </div>`;
}

// ── Gráfico interativo reutilizável ──
function _renderGrafico(canvasId, filterKey, entries, cores) {
  if (_charts[canvasId]) { _charts[canvasId].destroy(); _charts[canvasId] = null; }
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (!entries.length) return;

  const filtroAtivo = _adminFiltros[filterKey];
  const labels = entries.map(e => e[0]);
  const values = entries.map(e => e[1]);
  const total  = values.reduce((s,v) => s+v, 0) || 1;

  const bgColors = labels.map((l, i) => {
    const base = cores[i % cores.length];
    if (!filtroAtivo) return base;
    return l === filtroAtivo ? base : _hexFade(base, 0.2);
  });

  _charts[canvasId] = new Chart(el, {
    type: "bar",
    plugins: [ChartDataLabels],
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: bgColors,
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 72 } },
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const label = labels[elements[0].index];
        _aplicarFiltro(filterKey, label);
      },
      onHover: (evt, elements) => {
        el.style.cursor = elements.length ? "pointer" : "default";
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: c => ` ${nfT(c.raw)}  (${Math.round(c.raw/total*100)}%)`
          }
        },
        datalabels: {
          anchor: "end",
          align: "right",
          clip: false,
          formatter: (v) => nfT(v),
          font: { size: 10, weight: "bold" },
          color: (ctx) => {
            const label = labels[ctx.dataIndex];
            return filtroAtivo && label !== filtroAtivo ? "#aaa" : "#0F6E56";
          },
        }
      },
      scales: {
        x: {
          ticks: { font: { size: 10 }, callback: v => nfT(v) },
          grid:  { color: "rgba(128,128,128,0.08)" }
        },
        y: {
          ticks: { font: { size: 11 } },
          grid:  { display: false }
        }
      }
    }
  });
}

// ── Formata kg → toneladas se >= 1000 ──
function nfT(kg) {
  if (typeof kg !== "number" || isNaN(kg)) return "—";
  if (kg >= 1000) return (kg / 1000).toFixed(1).replace(".", ",") + " t";
  return nf(kg) + " kg";
}

// ════════════════════════════════════════════════
// ABA — USUÁRIOS
// ════════════════════════════════════════════════
function renderUsuarios() {
  const usuarios = estado._todosVendedores || [];
  const linhas = usuarios.map(u => {
    const nome   = String(u.nome  || "—");
    const email  = String(u.email || "—");
    const perfil = String(u.perfil || "VENDEDOR").toUpperCase();
    const pAcesso= String(u.primeiroAcesso || "false").toLowerCase() === "true";
    const badgeP = perfil === "ADMIN"
      ? `<span class="admin-badge admin">⚙️ Admin</span>`
      : `<span class="admin-badge vendedor">👤 Vendedor</span>`;
    const badgeA = pAcesso
      ? `<span class="admin-badge warn">🔑 Aguardando 1° acesso</span>`
      : `<span class="admin-badge ok">✅ Ativo</span>`;
    return `<tr>
      <td><strong>${nome}</strong><br>
        <span style="font-size:10px;color:var(--muted2);font-family:var(--mono)">${email}</span></td>
      <td>${badgeP}</td>
      <td>${badgeA}</td>
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
  const busca = (document.getElementById("admin-busca-cliente")?.value || "").toLowerCase();
  const clientes = (estado._todosClientes || []).filter(c => {
    const nome = String(c.nomeCliente || "").toLowerCase();
    const cod  = String(c.codCliente  || "").toLowerCase();
    const vend = (estado._todosVendedores||[]).find(v => String(v.codigo||"").trim() === String(c.codVendedor||"").trim());
    const nomeV= String(vend?.nome || "").toLowerCase();
    return !busca || nome.includes(busca) || cod.includes(busca) || nomeV.includes(busca);
  });
  const linhas = clientes.map(c => {
    const nomeC = String(c.nomeCliente || "—");
    const codC  = String(c.codCliente  || "—");
    const codV  = String(c.codVendedor || "—");
    const vend  = (estado._todosVendedores||[]).find(v => String(v.codigo||"").trim() === codV.trim());
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
        <tbody>${linhas || '<tr><td colspan="3" style="text-align:center;color:var(--muted2);padding:24px">Nenhum cliente.</td></tr>'}</tbody>
      </table>
    </div>`;
}

// ════════════════════════════════════════════════
// ABA — PRODUTOS
// ════════════════════════════════════════════════
function renderProdutos() { filtrarProdutosAdmin(); }

function filtrarProdutosAdmin() {
  const busca = (document.getElementById("admin-busca-produto")?.value || "").toLowerCase();
  const produtos = (estado.produtos || []).filter(p => {
    const nome  = String(p["dProduto.DESCR"] ?? p["DESCRICAO"] ?? p["PRODUTO"] ?? "").toLowerCase();
    const fase  = String(p["dProduto.FASE"]      ?? p["FASE"]      ?? "").toLowerCase();
    const linha = String(p["dProduto.SUB_GRUPO"]  ?? p["SUB_GRUPO"] ?? "").toLowerCase();
    return !busca || nome.includes(busca) || fase.includes(busca) || linha.includes(busca);
  });
  const linhas = produtos.map(p => {
    const cod   = String(p["Codigo"]   ?? p["COD_PRODUTO"] ?? "—");
    const nome  = String(p["dProduto.DESCR"] ?? p["DESCRICAO"] ?? p["PRODUTO"] ?? "—");
    const fase  = String(p["dProduto.FASE"]      ?? p["FASE"]      ?? "—");
    const linha = String(p["dProduto.SUB_GRUPO"]  ?? p["SUB_GRUPO"] ?? "—");
    const unid  = String(p["Unidade"] ?? p["UNIDADE"] ?? "—");
    const peso  = parseFloat(p["Peso_Liquido"] ?? p["PESO_LIQUIDO"] ?? 0);
    return `<tr>
      <td style="font-family:var(--mono);font-size:11px;color:var(--muted2)">${cod}</td>
      <td><strong>${nome}</strong></td>
      <td><span class="admin-badge vendedor">${fase}</span></td>
      <td style="font-size:12px;color:var(--muted2)">${linha}</td>
      <td style="font-family:var(--mono);font-size:11px">${unid}</td>
      <td style="font-family:var(--mono);font-size:11px;text-align:right">${peso>0?peso+" kg":"—"}</td>
    </tr>`;
  }).join("");
  const el = document.getElementById("admin-produtos-tabela");
  if (!el) return;
  el.innerHTML = `
    <div style="margin-bottom:10px;font-family:var(--mono);font-size:11px;color:var(--muted2)">${produtos.length} produto(s)</div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>Código</th><th>Produto</th><th>Fase</th><th>Linha</th><th>Unidade</th><th style="text-align:right">Peso liq.</th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="6" style="text-align:center;color:var(--muted2);padding:24px">Nenhum produto.</td></tr>'}</tbody>
      </table>
    </div>`;
}

// ════════════════════════════════════════════════
// AÇÕES — RESETAR SENHA
// ════════════════════════════════════════════════
function resetarSenha(email, nome) {
  abrirModal("Resetar senha",
    `Resetar a senha de <strong>${nome}</strong>? Voltará para <strong>12345</strong> e o usuário deverá criar uma nova.`,
    async () => {
      mostrarLoading("Resetando senha...");
      try {
        await fetch(API_URL, {
          method: "POST", mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "alterarSenha", email, novaSenha: "12345", primeiroAcesso: true }),
        });
        const v = (estado._todosVendedores||[]).find(vv => String(vv.email||"").toLowerCase() === email.toLowerCase());
        if (v) { v.senha = "12345"; v.primeiroAcesso = true; }
        esconderLoading();
        toast(`✅ Senha de ${nome} resetada para 12345.`);
        renderUsuarios();
      } catch(e) {
        esconderLoading();
        toast("❌ Erro: " + e.message, "error");
      }
    }
  );
}

// ════════════════════════════════════════════════
// AÇÕES — NOVO USUÁRIO
// ════════════════════════════════════════════════
function abrirModalNovoUsuario() {
  ["nu-nome","nu-reduzido","nu-email","nu-codigo"].forEach(id => { const el = document.getElementById(id); if(el) el.value=""; });
  document.getElementById("nu-perfil").value = "VENDEDOR";
  const e = document.getElementById("nu-erro"); e.style.display="none"; e.textContent="";
  document.getElementById("modal-novo-usuario").classList.add("aberta");
  setTimeout(() => document.getElementById("nu-nome")?.focus(), 100);
}

function fecharModalNovoUsuario() {
  document.getElementById("modal-novo-usuario").classList.remove("aberta");
}

async function salvarNovoUsuario() {
  const erroEl = document.getElementById("nu-erro");
  erroEl.style.display = "none";
  const nome     = (document.getElementById("nu-nome").value    ||"").trim();
  const reduzido = (document.getElementById("nu-reduzido").value||"").trim();
  const email    = (document.getElementById("nu-email").value   ||"").trim().toLowerCase();
  const codigo   = (document.getElementById("nu-codigo").value  ||"").trim();
  const perfil   = document.getElementById("nu-perfil").value;
  if (!nome||!email||!codigo) { erroEl.textContent="❌ Preencha nome, e-mail e código."; erroEl.style.display="block"; return; }
  if ((estado._todosVendedores||[]).some(v => String(v.email||"").toLowerCase()===email)) {
    erroEl.textContent="❌ E-mail já cadastrado."; erroEl.style.display="block"; return;
  }
  mostrarLoading("Cadastrando...");
  fecharModalNovoUsuario();
  try {
    await fetch(API_URL, {
      method:"POST", mode:"no-cors",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"novoUsuario", nome, nomeReduzido: reduzido||nome.split(" ")[0].toUpperCase(), email, codigo, perfil, senha:"12345", primeiroAcesso:true }),
    });
    estado._todosVendedores.push({ nome, email, codigo, perfil, senha:"12345", primeiroAcesso:true });
    esconderLoading();
    toast(`✅ Usuário ${nome} criado com senha 12345.`);
    renderUsuarios();
  } catch(e) {
    esconderLoading();
    toast("❌ Erro: " + e.message, "error");
  }
}
