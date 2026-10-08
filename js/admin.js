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
let _adminLancAnterior = null;   // lançamentos do mês anterior (comparação)
let _adminPeriodoAnt   = null;

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

  const prev   = periodoPrevisao();
  _adminMesSel = prev.mes;
  _adminAnoSel = prev.ano;
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
  const m = parseInt(mes), a = parseInt(ano);
  const mAnt = m === 1 ? 12 : m - 1;
  const aAnt = m === 1 ? a - 1 : a;
  const [atual, anterior] = await Promise.allSettled([
    jsonp(`${API_URL}?action=getLancamentos&mes=${mes}&ano=${ano}&codVendedor=`),
    jsonp(`${API_URL}?action=getLancamentos&mes=${mAnt}&ano=${aAnt}&codVendedor=`),
  ]);
  if (atual.status === "fulfilled") {
    _adminLancamentos = atual.value.lancamentos || [];
  } else {
    console.error("Admin:", atual.reason);
    _adminLancamentos = [];
  }
  _adminLancAnterior = anterior.status === "fulfilled" ? (anterior.value.lancamentos || []) : null;
  _adminPeriodoAnt   = { mes: mAnt, ano: aAnt };
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
// Cada loja é um cliente distinto: chave = código do cliente + loja
function _chaveCli(l) {
  return String(l.COD_CLIENTE || "").trim() + "-" + String(l.LOJA ?? "").trim();
}

function _adminDadosFiltrados(lista) {
  return (lista || _adminLancamentos).filter(l => {
    const fase  = String(l.FASE    || "").trim();
    const linha = String(l.SUB_GRUPO || l["dProduto.SUB_GRUPO"] || "").trim();
    const unid  = String(l.UNIDADE || "").trim();
    const vend  = String(l.COD_VENDEDOR || "").trim();
    const cli   = _chaveCli(l);
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

function _adminSelFiltro(key, value) {
  _adminFiltros[key] = value || null;
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


// ── Calcula dias úteis Seg–Sáb do mês ──
function _diasUteis(mes, ano) {
  const m    = parseInt(mes) - 1;
  const y    = parseInt(ano);
  const dias = new Date(y, m + 1, 0).getDate();
  let count  = 0;
  for (let d = 1; d <= dias; d++) {
    if (new Date(y, m, d).getDay() !== 0) count++; // exclui domingo
  }
  return count;
}

// ════════════════════════════════════════════════
// ABA — DASHBOARD
// ════════════════════════════════════════════════
function renderDashboard() {
  // ── Período ──
  const nomeMes = MESES[+_adminMesSel] || _adminMesSel;
  document.getElementById("admin-periodo").textContent = `${nomeMes}/${_adminAnoSel}`;

  document.querySelectorAll(".admin-mes-btn").forEach(b =>
    b.classList.toggle("ativo", b.dataset.mes === _adminMesSel)
  );

  const dados = _adminDadosFiltrados();
  const kgLinha = l => (parseFloat(l.QUANTIDADE) || 0) * (parseFloat(l.PESO_LIQUIDO) || 25);

  // ── Vendedores (apenas perfil VENDEDOR) ──
  const vendedores = (estado._todosVendedores || []).filter(v =>
    String(v.perfil || "VENDEDOR").toUpperCase() === "VENDEDOR"
  );
  const nomeVend = {};
  vendedores.forEach(v => { nomeVend[String(v.codigo || "").trim()] = v.nome || "—"; });

  // ── Agregações ──
  const porVendedor = {};
  const porCliente  = {};
  const porFase = {}, porLinha = {}, porUnid = {};
  dados.forEach(l => {
    const kg   = kgLinha(l);
    const codV = String(l.COD_VENDEDOR || "").trim();
    const k    = _chaveCli(l);
    if (!porVendedor[codV]) porVendedor[codV] = { kg: 0, clientes: new Set() };
    porVendedor[codV].kg += kg;
    porVendedor[codV].clientes.add(k);

    if (!porCliente[k]) porCliente[k] = { cod: k, kg: 0, nome: _adminNomeCliente(l), vend: nomeVend[codV] || l.VENDEDOR || "" };
    porCliente[k].kg += kg;

    const fase  = String(l.FASE || "Outros").trim();
    const linha = String(l.SUB_GRUPO || l["dProduto.SUB_GRUPO"] || "Outros").trim();
    const unid  = String(l.UNIDADE || "—").trim();
    porFase[fase]   = (porFase[fase]   || 0) + kg;
    porLinha[linha] = (porLinha[linha] || 0) + kg;
    porUnid[unid]   = (porUnid[unid]   || 0) + kg;
  });

  // ── Totais ──
  const totalKg    = Object.values(porVendedor).reduce((s,v) => s + v.kg, 0);
  const concluidos = vendedores.filter(v => porVendedor[String(v.codigo||"").trim()]);
  const pendentesL = vendedores.filter(v => !porVendedor[String(v.codigo||"").trim()]);
  const pct        = vendedores.length ? Math.round(concluidos.length / vendedores.length * 100) : 0;
  const totalCli   = Object.keys(porCliente).length;
  const diasUteis  = _diasUteis(_adminMesSel, _adminAnoSel);
  const mediaDia   = diasUteis ? totalKg / diasUteis : 0;
  const codsVend   = new Set(vendedores.map(v => String(v.codigo||"").trim()));
  const totalCliAtivos = (estado._todosClientes || []).filter(c =>
    codsVend.has(String(c.codVendedor||"").trim())
  ).length;
  const pctCli = totalCliAtivos ? Math.round(totalCli / totalCliAtivos * 100) : 0;

  // ── Comparação com mês anterior (mesmos filtros) ──
  let deltaHtml = `<div class="admin-card-delta">Sem dados do mês anterior</div>`;
  if (_adminLancAnterior && _adminPeriodoAnt) {
    const kgAnt = _adminDadosFiltrados(_adminLancAnterior).reduce((s,l) => s + kgLinha(l), 0);
    const rotAnt = `${(MESES[_adminPeriodoAnt.mes] || "").slice(0,3).toLowerCase()}/${String(_adminPeriodoAnt.ano).slice(-2)}`;
    if (kgAnt > 0) {
      const d = Math.round((totalKg - kgAnt) / kgAnt * 100);
      const cls = d > 0 ? "ok" : d < 0 ? "warn" : "";
      const seta = d > 0 ? "▲" : d < 0 ? "▼" : "=";
      deltaHtml = `<div class="admin-card-delta ${cls}">${seta} ${Math.abs(d)}% vs ${rotAnt} (${nfTCard(kgAnt)})</div>`;
    } else {
      deltaHtml = `<div class="admin-card-delta">Sem previsão em ${rotAnt}</div>`;
    }
  }

  // ── Mix por fase ──
  const fases = Object.entries(porFase).sort((a,b) => b[1]-a[1]);
  const pctDe = v => totalKg ? Math.round(v / totalKg * 100) : 0;
  const mixPrincipal = fases[0];
  const mixResto = fases.slice(1, 3).map(([f,v]) => `${_adminTitulo(f)} ${pctDe(v)}%`).join(" · ");

  // ── CARDS ──
  document.getElementById("admin-dash-cards").innerHTML = `
    <div class="admin-card adm-kpi">
      <div class="adm-kpi-lbl">Total previsto</div>
      <div class="adm-kpi-val">${nfTCard(totalKg)}</div>
      <div class="adm-kpi-sub">${nfTCard(mediaDia)}/dia · ${diasUteis} dias úteis (seg–sáb)</div>
      ${deltaHtml}
    </div>
    <div class="admin-card adm-kpi">
      <div class="adm-kpi-lbl">Vendedores que enviaram</div>
      <div class="adm-kpi-val">${concluidos.length}<span class="adm-kpi-de"> de ${vendedores.length}</span></div>
      <div class="admin-card-prog-bar"><div class="admin-card-prog-fill" style="width:${pct}%"></div></div>
      <div class="adm-kpi-sub">${pct}% concluído${pendentesL.length ? ` · <a href="#admin-vend-pendentes" class="adm-link warn">${pendentesL.length} pendente${pendentesL.length>1?"s":""}</a>` : ""}</div>
    </div>
    <div class="admin-card adm-kpi">
      <div class="adm-kpi-lbl">Cobertura da carteira</div>
      <div class="adm-kpi-val">${totalCli}<span class="adm-kpi-de"> de ${totalCliAtivos}</span></div>
      <div class="admin-card-prog-bar"><div class="admin-card-prog-fill" style="width:${pctCli}%"></div></div>
      <div class="adm-kpi-sub">${pctCli}% dos clientes ativos com previsão</div>
    </div>
    <div class="admin-card adm-kpi">
      <div class="adm-kpi-lbl">Mix por fase</div>
      <div class="adm-kpi-val">${mixPrincipal ? pctDe(mixPrincipal[1]) + "%" : "—"}</div>
      <div class="adm-kpi-sub">${mixPrincipal ? _adminTitulo(mixPrincipal[0]) : "Sem dados"}</div>
      <div class="admin-card-delta">${mixResto}</div>
    </div>`;

  // ── RANKING CLIENTES ──
  const topCli = Object.values(porCliente).sort((a,b) => b.kg - a.kg).slice(0,10);
  const maxCli = topCli[0]?.kg || 1;
  const mostraVendNoCli = !_adminFiltros.vendedor;
  document.getElementById("admin-rank-clientes").innerHTML = topCli.map((c, i) => {
    const ativo = _adminFiltros.cliente === c.cod;
    return `<div class="admin-rank-row${ativo?" ativo":""}" onclick="_aplicarFiltro('cliente','${c.cod}')" title="Filtrar por ${_esc(c.nome)}">
      <span class="admin-rank-n">${i+1}</span>
      <span class="admin-rank-name"><span class="adm-rank-nm">${_esc(c.nome)}</span>${mostraVendNoCli && c.vend ? `<small class="adm-rank-meta">${_esc(c.vend)}</small>` : ""}</span>
      <div class="admin-rank-bar-wrap"><div class="admin-rank-bar" style="width:${Math.round(c.kg/maxCli*100)}%"></div></div>
      <span class="admin-rank-val">${nfT(c.kg)}</span>
      <span class="adm-rank-pct">${pctDe(c.kg)}%</span>
    </div>`;
  }).join("") || '<p class="admin-vazio">Sem dados</p>';

  // ── RANKING VENDEDORES (só quem enviou) ──
  const vendKg = concluidos
    .map(v => { const cod = String(v.codigo||"").trim(); return { cod, nome: v.nome || "—", kg: porVendedor[cod].kg, cli: porVendedor[cod].clientes.size }; })
    .sort((a,b) => b.kg - a.kg);
  const maxVend = vendKg[0]?.kg || 1;
  document.getElementById("admin-rank-vendedores").innerHTML = vendKg.map((v, i) => {
    const ativo = _adminFiltros.vendedor === v.cod;
    return `<div class="admin-rank-row${ativo?" ativo":""}" onclick="_aplicarFiltro('vendedor','${v.cod}')" title="Filtrar por ${_esc(v.nome)}">
      <span class="admin-rank-n">${i+1}</span>
      <span class="admin-rank-name"><span class="adm-rank-nm">${_esc(v.nome)}</span><small class="adm-rank-meta">${v.cli} cliente${v.cli!==1?"s":""}</small></span>
      <div class="admin-rank-bar-wrap"><div class="admin-rank-bar" style="width:${Math.round(v.kg/maxVend*100)}%"></div></div>
      <span class="admin-rank-val">${nfT(v.kg)}</span>
      <span class="adm-rank-pct">${pctDe(v.kg)}%</span>
    </div>`;
  }).join("") || '<p class="admin-vazio">Nenhum vendedor enviou ainda.</p>';

  document.getElementById("admin-vend-pendentes").innerHTML = pendentesL.length ? `
    <div class="adm-pend">
      <div class="adm-pend-titulo">Pendentes (${pendentesL.length})</div>
      <div class="adm-pend-lista">${pendentesL
        .map(v => `<span class="adm-pend-chip">${_esc(v.nome || "—")}</span>`).join("")}</div>
    </div>` : "";

  // ── DISTRIBUIÇÃO ──
  const sortDesc = obj => Object.entries(obj).sort((a,b) => b[1]-a[1]);
  _renderDist("adm-dist-fase",  "fase",    sortDesc(porFase),  totalKg, CORES_FASE[0]);
  _renderDist("adm-dist-linha", "linha",   sortDesc(porLinha), totalKg, CORES_LINHA[0]);
  _renderDist("adm-dist-unid",  "unidade", sortDesc(porUnid),  totalKg, CORES_UNID[0], _adminNomeUnid);

  // ── SELECTS DA BARRA DE FILTROS ──
  _adminPreencherSelects(vendedores);
  _renderChips();

  // ── TABELA VENDEDORES ──
  const linhasTabela = vendedores.map(v => {
    const cod   = String(v.codigo || "").trim();
    const nome  = String(v.nome   || "—");
    const d     = porVendedor[cod];
    const ativo = _adminFiltros.vendedor === cod;
    const status = d
      ? `<span class="admin-badge ok">Concluído</span>`
      : `<span class="admin-badge warn">Pendente</span>`;
    return `<tr class="admin-tr-click${ativo?" ativo":""}" onclick="_aplicarFiltro('vendedor','${cod}')" title="Filtrar por ${_esc(nome)}">
      <td><strong>${_esc(nome)}</strong></td>
      <td>${status}</td>
      <td style="font-family:var(--mono);text-align:right">${d ? d.clientes.size : "—"}</td>
      <td style="font-family:var(--mono);font-weight:700;text-align:right;color:var(--accent)">${d ? nfT(d.kg) : "—"}</td>
    </tr>`;
  }).join("");

  document.getElementById("admin-dash-tabela").innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr>
          <th>Vendedor</th><th>Status</th>
          <th style="text-align:right">Clientes</th>
          <th style="text-align:right">Total</th>
        </tr></thead>
        <tbody>${linhasTabela || '<tr><td colspan="4" style="text-align:center;color:var(--muted2);padding:24px">Nenhum lançamento.</td></tr>'}</tbody>
      </table>
    </div>`;
}

// ── Helpers do dashboard ──
function _esc(t) {
  return String(t ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

// "ENGORDA" → "Engorda"; mantém siglas curtas (LTDA, ME, SC...)
function _adminTitulo(t) {
  return String(t || "").toLowerCase().replace(/(^|[\s\-\/(.])([a-zà-ú])/g, (m, p, c) => p + c.toUpperCase())
    .replace(/\b(Ltda|Me|Epp|Sa|S\/a)\b/g, x => x.toUpperCase())
    .replace(/ (De|Da|Do|Dos|Das|E) /g, x => x.toLowerCase());
}

function _adminNomeUnid(u) {
  const x = String(u || "").toUpperCase();
  return x === "KG" ? "Granel" : x === "SC" ? "Sacaria" : x === "BG" ? "Bag" : _adminTitulo(u);
}

// Mostra "— Loja N" apenas quando o cliente tem mais de uma loja (ou loja ≠ 1)
function _adminNomeCliente(l) {
  const cod  = String(l.COD_CLIENTE || "").trim();
  const loja = String(l.LOJA ?? "").trim();
  const nome = String(l.CLIENTE || "—");
  const multi = (estado._todosClientes || []).filter(c => String(c.codCliente ?? c.codigo ?? "").trim() === cod).length > 1
             || _adminLancamentos.some(o => String(o.COD_CLIENTE||"").trim() === cod && String(o.LOJA ?? "").trim() !== loja);
  return (loja && (multi || loja !== "1")) ? `${nome} — Loja ${loja}` : nome;
}

// Lista de barras horizontais clicável (substitui os gráficos Chart.js)
function _renderDist(elId, filterKey, entries, total, cor, rotulo) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!entries.length) { el.innerHTML = '<p class="admin-vazio">Sem dados</p>'; return; }
  const max = entries[0][1] || 1;
  const filtro = _adminFiltros[filterKey];
  el.innerHTML = entries.map(([k, v]) => {
    const nome = rotulo ? rotulo(k) : _adminTitulo(k);
    const pct  = total ? Math.round(v / total * 100) : 0;
    const cls  = filtro ? (filtro === k ? " ativo" : " apagado") : "";
    return `<div class="adm-dist-row${cls}" onclick="_aplicarFiltro('${filterKey}', ${_esc(JSON.stringify(k))})" title="Filtrar por ${_esc(nome)}">
      <span class="adm-dist-nome">${_esc(nome)}</span>
      <span class="adm-dist-val">${nfT(v)} <b>${pct < 1 && v > 0 ? "<1" : pct}%</b></span>
      <div class="adm-dist-bar"><div style="width:${Math.max(2, Math.round(v / max * 100))}%;background:${cor}"></div></div>
    </div>`;
  }).join("");
}

function _adminPreencherSelects(vendedores) {
  const selV = document.getElementById("adm-sel-vendedor");
  const selC = document.getElementById("adm-sel-cliente");
  if (selV) {
    const ops = [...vendedores].sort((a,b) => String(a.nome||"").localeCompare(String(b.nome||"")))
      .map(v => { const c = String(v.codigo||"").trim(); return `<option value="${_esc(c)}"${_adminFiltros.vendedor===c?" selected":""}>${_esc(v.nome||c)}</option>`; });
    selV.innerHTML = `<option value="">Todos</option>` + ops.join("");
  }
  if (selC) {
    // Clientes com lançamento no mês (respeitando o filtro de vendedor)
    const mapa = {};
    _adminLancamentos.forEach(l => {
      if (_adminFiltros.vendedor && String(l.COD_VENDEDOR||"").trim() !== _adminFiltros.vendedor) return;
      mapa[_chaveCli(l)] = _adminNomeCliente(l);
    });
    const ops = Object.entries(mapa).sort((a,b) => a[1].localeCompare(b[1]))
      .map(([k, n]) => `<option value="${_esc(k)}"${_adminFiltros.cliente===k?" selected":""}>${_esc(n)}</option>`);
    selC.innerHTML = `<option value="">Todos</option>` + ops.join("");
  }
}

// ── Chips de filtros ativos ──
function _renderChips() {
  const el = document.getElementById("admin-chips-filtros");
  if (!el) return;
  const ativos = Object.entries(_adminFiltros).filter(([,v]) => v !== null);
  if (!ativos.length) { el.innerHTML = ""; return; }
  const rot = (k, v) => k === "unidade" ? _adminNomeUnid(v) : (k === "fase" || k === "linha") ? _adminTitulo(v) : null;
  const chips = ativos.filter(([k]) => rot(k, "") !== null).map(([k, v]) =>
    `<span class="admin-chip">${_FILTRO_NOME[k]}: <strong>${_esc(rot(k, v))}</strong>
      <button onclick="_aplicarFiltro('${k}', ${_esc(JSON.stringify(v))})" title="Remover filtro">✕</button>
    </span>`
  ).join("");
  el.innerHTML = `${chips}<button class="admin-chip-limpar" onclick="adminLimparFiltros()">Limpar filtros</button>`;
}

// ── Gráfico interativo reutilizável ──
function _renderGrafico(canvasId, filterKey, entries, cores) {
  if (_charts[canvasId]) { _charts[canvasId].destroy(); _charts[canvasId] = null; }
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (!entries.length) return;

  // Altura dinâmica: 34px por barra, mínimo 160px
  const wrapper = el.parentElement;
  if (wrapper) wrapper.style.height = Math.max(160, entries.length * 34) + "px";

  const filtroAtivo = _adminFiltros[filterKey];
  const labels = entries.map(e => e[0]);
  const values = entries.map(e => e[1]);
  const total  = values.reduce((s,v) => s+v, 0) || 1;
  const maxVal = values[0] || 1;

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
      layout: { padding: { right: 85 } },
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
          offset: 4,
          // Oculta rótulo se barra < 2% do maior valor (evita sobreposição)
          display: (ctx) => ctx.dataset.data[ctx.dataIndex] >= maxVal * 0.02,
          formatter: (v) => nfT(v),
          font: { size: 10, weight: "bold" },
          color: (ctx) => {
            const label = labels[ctx.dataIndex];
            return filtroAtivo && label !== filtroAtivo ? "#bbb" : "#0F6E56";
          },
        }
      },
      scales: {
        x: {
          ticks: { font: { size: 10 }, callback: v => nfT(v) },
          grid:  { color: "rgba(128,128,128,0.08)" }
        },
        y: {
          ticks: { font: { size: 10 }, maxRotation: 0 },
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

// Versão para cards — sem casas decimais
function nfTCard(kg) {
  if (typeof kg !== "number" || isNaN(kg)) return "—";
  if (kg >= 1000) return Math.round(kg / 1000).toLocaleString("pt-BR") + " t";
  return Math.round(kg).toLocaleString("pt-BR") + " kg";
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
    const lojaB = String(c.loja ?? "").toLowerCase();
    return !busca || nome.includes(busca) || cod.includes(busca) || nomeV.includes(busca) || ("loja " + lojaB).includes(busca);
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
      <td>${c.loja ?? "—"}</td>
      <td>${nomeV}</td>
    </tr>`;
  }).join("");
  const el = document.getElementById("admin-clientes-tabela");
  if (!el) return;
  el.innerHTML = `
    <div style="margin-bottom:10px;font-family:var(--mono);font-size:11px;color:var(--muted2)">${clientes.length} cliente(s)</div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>Código</th><th>Cliente</th><th>Loja</th><th>Vendedor</th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="4" style="text-align:center;color:var(--muted2);padding:24px">Nenhum cliente.</td></tr>'}</tbody>
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
