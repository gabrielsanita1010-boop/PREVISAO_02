// ════════════════════════════════════════════════
// ALTURA DO HEADER → variável CSS --header-h
// ════════════════════════════════════════════════
function atualizarHeaderH() {
  const h = document.querySelector(".app-header");
  if (h) document.documentElement.style.setProperty("--header-h", h.offsetHeight + "px");
}
window.addEventListener("resize", atualizarHeaderH);
document.addEventListener("DOMContentLoaded", () => setTimeout(atualizarHeaderH, 100));

// ════════════════════════════════════════════════
// CONFIGURAÇÃO DA API
// ════════════════════════════════════════════════

// ════════════════════════════════════════════════
// ESTADO GLOBAL
// ════════════════════════════════════════════════
let estado = {
  vendedor:    null,   // { nome, codigo, nomeReduzido } — virá do sistema de login futuro
  mes:         null,
  ano:         null,
  clientes:    [],     // lista filtrada pelo vendedor
  clienteIdx:  0,      // índice do cliente atual
  itensCliente:[],     // itens do cliente em memória
  editandoId:  null,   // id do item sendo editado
  sessao:      {},     // { [codCliente]: { status:'ok'|'sem-venda', itens:[], totalKg:0 } }
  produtos:    [],     // todos os produtos
};

// Conversão de unidades
const KG_POR_UNIDADE = { Saco: 25, Granel: 1, Bag: 750 };

// Nomes dos meses
const MESES = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho",
               "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ════════════════════════════════════════════════
// INICIALIZAÇÃO — carrega dados ao abrir
// ════════════════════════════════════════════════
window.onload = async () => {
  mostrarLoading("Conectando...");
  try {
    const data = await jsonp(`${API_URL}?action=getData`);
    estado.produtos         = data.produtos   || [];
    estado._todosClientes   = data.clientes   || [];
    estado._todosVendedores = data.vendedores || [];
    esconderLoading();

    // Tenta restaurar sessão salva
    const sessaoSalva = localStorage.getItem("pf_sessao");
    if (sessaoSalva) {
      try {
        const v = JSON.parse(sessaoSalva);
        // Valida que o vendedor ainda existe na lista
        const existe = estado._todosVendedores.find(vv =>
          String(vv.email || vv.EMAIL || "").toLowerCase() === String(v.email || "").toLowerCase()
        );
        if (existe) {
          estado.vendedor = v;
          if (v.perfil === "ADMIN") {
            await entrarAdmin();
          } else {
            await entrar();
          }
          return;
        }
      } catch(e2) {}
      localStorage.removeItem("pf_sessao");
    }

    // Mostra tela de login
    document.getElementById("tela-login").classList.add("visivel");
    setTimeout(() => document.getElementById("login-email").focus(), 100);

  } catch(e) {
    esconderLoading();
    toast("❌ Erro ao conectar: " + e.message, "error");
  }
};

// ════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════
async function fazerLogin() {
  const email = (document.getElementById("login-email").value || "").trim().toLowerCase();
  const senha = (document.getElementById("login-senha").value || "").trim();
  const erroEl = document.getElementById("login-erro");
  const btnEl  = document.getElementById("btn-login");

  erroEl.classList.remove("visivel");
  document.getElementById("login-email").classList.remove("erro");
  document.getElementById("login-senha").classList.remove("erro");

  if (!email) {
    document.getElementById("login-email").classList.add("erro");
    erroEl.textContent = "❌ Informe seu e-mail.";
    erroEl.classList.add("visivel");
    return;
  }
  if (!senha) {
    document.getElementById("login-senha").classList.add("erro");
    erroEl.textContent = "❌ Informe sua senha.";
    erroEl.classList.add("visivel");
    return;
  }

  btnEl.disabled = true;
  btnEl.textContent = "Verificando...";
  mostrarLoading("Autenticando...");

  try {
    // Busca vendedor pelo email
    const vendedor = estado._todosVendedores.find(v =>
      String(v.email || v.EMAIL || "").toLowerCase() === email
    );

    if (!vendedor) {
      throw new Error("E-mail não encontrado.");
    }

    // Verifica a senha via Apps Script
    const senhaCorreta = String(vendedor.senha || vendedor.SENHA || "").trim();
    if (!senhaCorreta || senhaCorreta !== senha) {
      throw new Error("Senha incorreta.");
    }

    // Login OK — monta objeto do vendedor
    const objVendedor = {
      codigo:      String(vendedor.codigo || vendedor.CODIGO || vendedor.COD_VENDEDOR || ""),
      nome:        String(vendedor.nome   || vendedor.NOME   || vendedor.VENDEDOR     || ""),
      nomeReduzido:String(vendedor.nomeReduzido || vendedor.NOME_REDUZIDO || vendedor.nome || vendedor.NOME || ""),
      email:       email,
      perfil:      String(vendedor.perfil || vendedor.PERFIL || "VENDEDOR").toUpperCase(),
    };

    // Verifica 1° acesso — campo primeiroAcesso (boolean ou string "true")
    const isPrimeiroAcesso =
      vendedor.primeiroAcesso === true ||
      String(vendedor.primeiroAcesso || vendedor.PRIMEIRO_ACESSO || "").toLowerCase() === "true";

    if (isPrimeiroAcesso) {
      // Bloqueia e exige troca de senha antes de entrar
      esconderLoading();
      btnEl.disabled  = false;
      btnEl.textContent = "Entrar";
      estado.vendedor = objVendedor;
      abrirTrocaSenha(objVendedor);
      return;
    }

    estado.vendedor = objVendedor;

    // Persiste sessão
    localStorage.setItem("pf_sessao", JSON.stringify(estado.vendedor));

    // Fecha tela de login e redireciona pelo perfil
    document.getElementById("tela-login").classList.remove("visivel");
    esconderLoading();
    if (estado.vendedor.perfil === "ADMIN") {
      await entrarAdmin();
    } else {
      await entrar();
    }

  } catch(e) {
    esconderLoading();
    btnEl.disabled = false;
    btnEl.textContent = "Entrar";
    erroEl.textContent = "❌ " + e.message;
    erroEl.classList.add("visivel");
    document.getElementById("login-senha").classList.add("erro");
    document.getElementById("login-senha").value = "";
    document.getElementById("login-senha").focus();
  }
}

function toggleSenha() {
  const inp = document.getElementById("login-senha");
  inp.type = inp.type === "password" ? "text" : "password";
}

function toggleSenhaEsq(id) {
  const inp = document.getElementById(id);
  if (inp) inp.type = inp.type === "password" ? "text" : "password";
}

// ════════════════════════════════════════════════
// ESQUECEU SUA SENHA
// ════════════════════════════════════════════════




// ════════════════════════════════════════════════
// TROCA DE SENHA OBRIGATÓRIA — 1° ACESSO
// ════════════════════════════════════════════════
// Vendedor temporário salvo durante o fluxo de troca
let _vendedorPendente = null;

function abrirTrocaSenha(vendedorObj) {
  _vendedorPendente = vendedorObj;
  document.getElementById("troca-nova").value    = "";
  document.getElementById("troca-confirma").value= "";
  document.getElementById("troca-erro").classList.remove("visivel");
  document.getElementById("tela-login").classList.remove("visivel");
  document.getElementById("tela-trocar-senha").classList.add("visivel");
  setTimeout(() => document.getElementById("troca-nova").focus(), 100);
}

async function salvarTrocaSenha() {
  const erroEl   = document.getElementById("troca-erro");
  erroEl.classList.remove("visivel");

  const nova     = (document.getElementById("troca-nova").value    || "").trim();
  const confirma = (document.getElementById("troca-confirma").value|| "").trim();

  if (nova.length < 6) {
    erroEl.textContent = "❌ A senha deve ter no mínimo 6 caracteres.";
    erroEl.classList.add("visivel"); return;
  }
  if (nova !== confirma) {
    erroEl.textContent = "❌ As senhas não coincidem.";
    erroEl.classList.add("visivel"); return;
  }

  // Atualiza a senha e marca primeiroAcesso = false na memória
  const vendedor = (estado._todosVendedores || []).find(v =>
    String(v.email || v.EMAIL || "").toLowerCase() === (_vendedorPendente?.email || "")
  );
  if (vendedor) {
    vendedor.senha        = nova;
    if (vendedor.SENHA !== undefined) vendedor.SENHA = nova;
    vendedor.primeiroAcesso = false;
  }

  // Salva no servidor
  fetch(API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action:         "alterarSenha",
      email:          _vendedorPendente?.email,
      novaSenha:      nova,
      primeiroAcesso: false,
    }),
  }).catch(() => {});

  // Persiste sessão e entra conforme perfil
  localStorage.setItem("pf_sessao", JSON.stringify(_vendedorPendente));
  document.getElementById("tela-trocar-senha").classList.remove("visivel");
  esconderLoading();
  toast("✅ Senha criada com sucesso! Bem-vindo(a).");
  if (_vendedorPendente?.perfil === "ADMIN") {
    await entrarAdmin();
  } else {
    await entrar();
  }
}

// ════════════════════════════════════════════════
// ENTRAR — configura período e abre o app
// ════════════════════════════════════════════════
async function entrar() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1);
  const ano = String(agora.getFullYear());

  // Vendedor definido pelo login
  const codV = estado.vendedor ? estado.vendedor.codigo : null;

  estado.mes = mes;
  estado.ano = ano;

  // Filtra clientes do vendedor (ou todos, se ainda sem login)
  estado.clientes = (estado._todosClientes || []).filter(c =>
    !codV || String(c.codVendedor) === String(codV)
  );

  if (estado.clientes.length === 0) {
    toast("Nenhum cliente encontrado.", "warn"); return;
  }

  // Inicia sessão vazia para cada cliente
  estado.sessao = {};
  estado.clientes.forEach(c => {
    estado.sessao[c.codCliente] = { status: "pendente", itens: [], totalKg: 0 };
  });

  // Popula produtos no formulário
  preencherSelectProdutos();

  // Popula select de clientes na navegação
  preencherSelectClientes();

  // Tenta carregar lançamentos existentes do servidor
  mostrarLoading("Carregando lançamentos anteriores...");
  try {
    const urlComVendedor = `${API_URL}?action=getLancamentos&mes=${mes}&ano=${ano}&codVendedor=${safeEncode(codV||"")}`;
    console.log("PREVFISH getLancamentos URL:", urlComVendedor);
    const r = await jsonp(urlComVendedor);
    console.log("PREVFISH getLancamentos resposta completa:", JSON.stringify(r).slice(0,800));
    console.log("PREVFISH parametros enviados — mes:", mes, "| ano:", ano, "| codVendedor:", codV);

    if (r.lancamentos && r.lancamentos.length) {
      console.log("PREVFISH: primeiro lancamento:", JSON.stringify(r.lancamentos[0]));
      console.log("PREVFISH: chaves sessao:", Object.keys(estado.sessao).slice(0,5));
      r.lancamentos.forEach(l => {
        const codRaw = l.COD_CLIENTE ?? l.cod_cliente ?? "";
        const cod    = String(codRaw).trim();
        // Match robusto: direto, sem zeros à esquerda, ou por parseInt
        let sessKey = Object.keys(estado.sessao).find(k =>
          k === cod ||
          k.replace(/^0+/,"") === cod.replace(/^0+/,"") ||
          String(parseInt(k,10)) === String(parseInt(cod,10))
        ) || null;
        if (!sessKey) {
          console.warn("PREVFISH: COD_CLIENTE nao mapeado:", cod, "| sessao:", Object.keys(estado.sessao).slice(0,5));
          return;
        }
        estado.sessao[sessKey].status     = "ok";
        estado.sessao[sessKey]._jaEnviado = true;
        const qtd   = parseFloat(l.QUANTIDADE) || 0;
        const tipo  = unidadeParaTipo(l.UNIDADE);
        const pesoU = parseFloat(l.PESO_LIQUIDO) || KG_POR_UNIDADE[tipo] || 1;
        if (!estado.sessao[sessKey].itensServidor) estado.sessao[sessKey].itensServidor = [];
        estado.sessao[sessKey].itensServidor.push({
          id:          gerarId(),
          codProduto:  String(l.COD_PRODUTO ?? ""),
          nomeProduto: l.PRODUTO || "",
          tipo,
          unidade:     l.UNIDADE || "",
          quantidade:  qtd,
          pesoLiquido: pesoU,
          totalKg:     qtd * pesoU,
          observacao:  l.OBSERVACAO || "",
          _doServidor: true,
        });
        estado.sessao[sessKey].itens   = [];
        estado.sessao[sessKey].totalKg = estado.sessao[sessKey].itensServidor.reduce((s,i)=>s+i.totalKg,0);
      });
      const carregados = Object.values(estado.sessao).filter(s => s._jaEnviado).length;
      console.log("PREVFISH: clientes com historico carregado:", carregados);
    } else {
      console.warn("PREVFISH: getLancamentos vazio. Testando sem filtro de vendedor...");
      // Diagnóstico: tenta sem codVendedor para ver se os dados existem na planilha
      try {
        const rSemFiltro = await jsonp(`${API_URL}?action=getLancamentos&mes=${mes}&ano=${ano}&codVendedor=`);
        console.log("PREVFISH sem filtro vendedor:", JSON.stringify(rSemFiltro).slice(0,600));
        if (rSemFiltro.lancamentos && rSemFiltro.lancamentos.length) {
          console.warn("PREVFISH DIAGNOSTICO: dados existem na planilha mas o filtro por codVendedor esta descartando. codVendedor enviado:", codV, "| COD_VENDEDOR na planilha:", rSemFiltro.lancamentos[0]?.COD_VENDEDOR);
          toast(`⚠️ Histórico encontrado mas filtro de vendedor não bateu. Ver console para detalhes.`, "warn");
        } else {
          console.warn("PREVFISH DIAGNOSTICO: nenhum dado encontrado mesmo sem filtro. Mes/Ano enviados:", mes, ano);
          toast(`⚠️ Nenhum lançamento encontrado para ${mes}/${ano} nesta planilha.`, "warn");
        }
      } catch(e2) {
        console.error("PREVFISH diagnóstico falhou:", e2);
      }
    }
  } catch(e) {
    console.error("PREVFISH erro getLancamentos:", e);
    toast("Aviso: nao foi possivel carregar lancamentos anteriores: " + e.message, "warn");
  }

  // Restaura confirmações locais ainda não enviadas à nuvem
  const sessaoLocal = carregarSessaoLocal();
  if (sessaoLocal) {
    Object.entries(sessaoLocal).forEach(([cod, sess]) => {
      // Só restaura itens NOVOS (não enviados) se o servidor não já trouxe esse cliente como enviado
      if (estado.sessao[cod] && !estado.sessao[cod]._jaEnviado) {
        estado.sessao[cod] = { ...sess, _jaEnviado: false };
      } else if (estado.sessao[cod] && estado.sessao[cod]._jaEnviado && sess.itens && sess.itens.length > 0) {
        // Servidor tem histórico + há itens novos salvos localmente: restaura só os novos
        estado.sessao[cod].itens = sess.itens.filter(i => !i._doServidor);
        estado.sessao[cod].status = "ok";
      }
    });
  }

  // Exibe o app
  estado.clienteIdx = 0;
  atualizarClienteAtual();
  atualizarHeader();
  atualizarResumo();
  atualizarSalvarFinal();
  setTimeout(atualizarHeaderH, 50);
  esconderLoading();
}

// ──────────────────────────────────────────────
// Converte UNIDADE da planilha → tipo local
// ──────────────────────────────────────────────
function unidadeParaTipo(unidade) {
  if (!unidade) return "Saco";
  const u = String(unidade).toUpperCase().trim();
  if (u === "BG"  || u.includes("BAG"))    return "Bag";
  if (u === "KG"  || u.includes("GRANEL")) return "Granel";
  if (u === "SC"  || u.includes("SACO"))   return "Saco";
  return "Saco";
}

// ════════════════════════════════════════════════
// SELETOR DE PRODUTO AVANÇADO
// ════════════════════════════════════════════════

// Cache dos produtos processados e estado do seletor
let _prodCache    = [];   // [{cod, nome, fase, subGrupo, pellet, pesoLiq, unidade}]
let _filtros      = { fase: "", linha: "", unidade: "" }; // filtros ativos
let _dropFocusIdx = -1;   // índice do item focado no dropdown (teclado)
let _prodSel      = null; // produto atualmente selecionado

// ── Processa e indexa os produtos da planilha ──
function preencherSelectProdutos() {
  _prodCache = [];

  if (!estado.produtos || estado.produtos.length === 0) {
    console.warn("PREVFISH: nenhum produto carregado.");
    return;
  }
  console.log("PREVFISH: campos do produto[0]:", Object.keys(estado.produtos[0]));

  estado.produtos.forEach(p => {
    const cod  = String(
      p["Codigo"] ?? p["codigo"] ?? p["COD_PRODUTO"] ?? p["cod_produto"] ?? p["COD"] ?? ""
    ).trim();
    const nome = String(
      p["dProduto.DESCR"]    ??
      p["dProduto.DESCRICAO"]??
      p["dProduto.DESCR."]   ??
      p["DESCRICAO"]         ??
      p["PRODUTO"]           ??
      p["Nome"]              ??
      p["nome"]              ??
      Object.entries(p).find(([k]) => k.startsWith("dProduto.DESC"))?.[1] ??
      ""
    ).trim();

    if (!nome) return;

    _prodCache.push({
      cod:      cod || nome,
      nome,
      fase:     String(p["dProduto.FASE"] ?? p["FASE"] ?? p["fase"] ?? "").trim(),
      subGrupo: String(p["dProduto.SUB_G"] ?? p["dProduto.SUB_GRUPO"] ?? p["SUB_GRUPO"] ?? "").trim(),
      pellet:   String(p["dProduto.PELLE"] ?? p["dProduto.PELLET"] ?? p["PELLET"] ?? "").trim(),
      pesoLiq:  parseFloat(p["Peso Liquido"] ?? p["Peso_Liquido"] ?? 0) || 0,
      unidade:  String(p["Unidade"] ?? p["unidade"] ?? "").trim(),
    });
  });

  console.log(`PREVFISH: ${_prodCache.length} produtos indexados.`);

  // Monta os selects dos 3 filtros
  montarFiltrosSelects();
  // Atualiza dropdown (sem filtro)
  filtrarProdutos();
}

// ── Popula os selects de filtro ──
function montarFiltrosSelects() {
  const fases  = [...new Set(_prodCache.map(p => p.fase).filter(Boolean))].sort();
  const linhas = [...new Set(_prodCache.map(p => p.subGrupo).filter(Boolean))].sort();
  const unids  = [...new Set(_prodCache.map(p => p.unidade).filter(Boolean))].sort();

  const UNID_LABEL = { SC: "SC — Saco 25 kg", KG: "KG — Granel 1 kg", BG: "BG — Bag 750 kg" };

  function popular(selId, valores, labelFn) {
    const sel = document.getElementById(selId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Todos</option>';
    valores.forEach(v => {
      const op = document.createElement("option");
      op.value       = v;
      op.textContent = labelFn ? (labelFn[v] || v) : v;
      sel.appendChild(op);
    });
  }

  popular("sel-fase",  fases,  null);
  popular("sel-linha", linhas, null);
  popular("sel-unid",  unids,  UNID_LABEL);
}

function selecionarFiltro(campo, valor) {
  _filtros[campo] = valor;
  _dropFocusIdx   = -1;
  // Destaque visual no select quando há filtro ativo
  const selMap = { fase: "sel-fase", linha: "sel-linha", unidade: "sel-unid" };
  const sel = document.getElementById(selMap[campo]);
  if (sel) sel.classList.toggle("ativo", valor !== "");
  filtrarProdutos();
  abrirDropdown();
}

// ── Filtra e renderiza o dropdown ──
function filtrarProdutos() {
  const q   = (document.getElementById("prod-search")?.value || "").toLowerCase().trim();
  const clr = document.getElementById("prod-search-clear");
  if (clr) clr.style.display = q ? "block" : "none";

  const lista = _prodCache.filter(p => {
    const faseOk  = !_filtros.fase    || p.fase     === _filtros.fase;
    const linhaOk = !_filtros.linha   || p.subGrupo === _filtros.linha;
    const unidOk  = !_filtros.unidade || p.unidade  === _filtros.unidade;
    const buscaOk = !q ||
      p.nome.toLowerCase().includes(q) ||
      p.cod.toLowerCase().includes(q)  ||
      p.subGrupo.toLowerCase().includes(q);
    return faseOk && linhaOk && unidOk && buscaOk;
  });

  renderizarDropdown(lista);
}

function renderizarDropdown(lista) {
  const dd = document.getElementById("prod-dropdown");
  if (!dd) return;
  dd.innerHTML = "";
  _dropFocusIdx = -1;

  if (lista.length === 0) {
    dd.innerHTML = '<div class="prod-nenhum">Nenhum produto encontrado</div>';
    return;
  }

  const UNID_COR = { SC:"#a78bfa", KG:"#34d399", BG:"#fb923c" };

  lista.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "prod-opt" + (_prodSel?.cod === p.cod ? " selecionado" : "");
    div.dataset.idx = i;
    const unidColor = UNID_COR[p.unidade] || "var(--muted2)";
    const badgeUnid = p.unidade
      ? `<span style="font-family:var(--mono);font-size:10px;padding:1px 6px;border-radius:20px;border:1px solid ${unidColor}40;background:${unidColor}15;color:${unidColor}">${p.unidade}</span>`
      : "";
    div.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="prod-opt-nome">${destacarBusca(p.nome)}</div>
        <div class="prod-opt-meta">${[p.fase, p.subGrupo, p.pellet].filter(Boolean).join(" · ")}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        ${badgeUnid}
        <div class="prod-opt-peso">${p.pesoLiq > 0 ? p.pesoLiq + " kg" : ""}</div>
      </div>
    `;
    // Usa mousedown/touchstart para selecionar antes do blur disparar (iOS Safari)
    const onSelect = (e) => { e.preventDefault(); selecionarProduto(p); };
    div.addEventListener("mousedown", onSelect);
    div.addEventListener("touchstart", onSelect, { passive: false });
    dd.appendChild(div);
  });
}

// Destaca o trecho buscado em amarelo
function destacarBusca(nome) {
  const q = (document.getElementById("prod-search")?.value || "").trim();
  if (!q) return nome;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")})`, "gi");
  return nome.replace(re, '<mark style="background:rgba(245,158,11,.3);color:var(--warn);border-radius:2px">$1</mark>');
}

// ── Seleciona produto ──
function selecionarProduto(p) {
  _prodSel = p;

  // Atualiza input oculto
  document.getElementById("f-produto").value = p.cod;

  // Chip de selecionado
  document.getElementById("prod-chip").classList.add("visivel");
  document.getElementById("prod-chip-nome").textContent = p.nome;
  document.getElementById("prod-chip-meta").textContent =
    [p.fase, p.subGrupo, p.pellet, p.pesoLiq > 0 ? p.pesoLiq + " kg" : ""].filter(Boolean).join(" · ");

  // Limpa busca e fecha dropdown
  document.getElementById("prod-search").value = "";
  document.getElementById("prod-search-clear").style.display = "none";
  fecharDropdown();

  // Recalcula kg
  calcularKg();
}

function limparSelecaoProduto() {
  _prodSel = null;
  _filtros = { fase: "", linha: "", unidade: "" };
  document.getElementById("f-produto").value = "";
  document.getElementById("prod-chip").classList.remove("visivel");
  document.getElementById("prod-search").value = "";
  document.getElementById("prod-search-clear").style.display = "none";
  // Reseta os selects de filtro
  ["sel-fase","sel-linha","sel-unid"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ""; el.classList.remove("ativo"); }
  });
  filtrarProdutos();
  calcularKg();
}

// ── Dropdown abrir/fechar ──
function abrirDropdown() {
  filtrarProdutos();
  document.getElementById("prod-dropdown").classList.add("aberto");
}

function fecharDropdown() {
  document.getElementById("prod-dropdown").classList.remove("aberto");
  _dropFocusIdx = -1;
}

// Fecha ao clicar fora — com pequeno delay para iOS não cortar o toque no item
document.addEventListener("click", e => {
  if (!document.getElementById("prod-selector")?.contains(e.target)) {
    setTimeout(fecharDropdown, 150);
  }
});

// ── Navegação por teclado ──
function navDropdown(e) {
  const dd   = document.getElementById("prod-dropdown");
  const opts = dd.querySelectorAll(".prod-opt");
  if (!opts.length) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    _dropFocusIdx = Math.min(_dropFocusIdx + 1, opts.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    _dropFocusIdx = Math.max(_dropFocusIdx - 1, 0);
  } else if (e.key === "Enter" && _dropFocusIdx >= 0) {
    e.preventDefault();
    opts[_dropFocusIdx].click();
    return;
  } else if (e.key === "Escape") {
    fecharDropdown(); return;
  } else return;

  opts.forEach((o, i) => o.classList.toggle("focus", i === _dropFocusIdx));
  opts[_dropFocusIdx]?.scrollIntoView({ block: "nearest" });
}

// ════════════════════════════════════════════════
// RESUMO DE TOTAIS POR FASE (no carrinho)
// ════════════════════════════════════════════════
function atualizarResumoProdutos() {
  const wrap = document.getElementById("prod-resumo");
  if (!wrap) return;

  const c = estado.clientes[estado.clienteIdx];
  const sess = c ? (estado.sessao[c.codCliente] || {}) : {};
  const todosItens = [...(sess.itensServidor || []), ...estado.itensCliente];

  if (todosItens.length === 0) {
    wrap.style.display = "none"; return;
  }

  // Agrupa kg por fase
  const porFase = {};
  todosItens.forEach(item => {
    const prod = _prodCache.find(p => p.cod === item.codProduto);
    const fase = prod?.fase || item.fase || "Sem fase";
    porFase[fase] = (porFase[fase] || 0) + item.totalKg;
  });

  const totalGeral = Object.values(porFase).reduce((s,v)=>s+v, 0);

  wrap.style.display = "flex";
  wrap.innerHTML = "";

  // Tag total geral
  const tagTotal = document.createElement("div");
  tagTotal.className = "resumo-tag";
  tagTotal.innerHTML = `<span class="resumo-tag-label">Total</span><span class="resumo-tag-total">${nf(totalGeral)} kg</span>`;
  wrap.appendChild(tagTotal);

  // Uma tag por fase
  Object.entries(porFase).sort().forEach(([fase, kg]) => {
    const tag = document.createElement("div");
    tag.className = "resumo-tag";
    tag.innerHTML = `<span class="resumo-tag-label">${fase}</span><span class="resumo-tag-val">${nf(kg)} kg</span>`;
    wrap.appendChild(tag);
  });
}


// ════════════════════════════════════════════════
// PREENCHE SELECT DE CLIENTES (navegação)
// ════════════════════════════════════════════════
function preencherSelectClientes() {
  const sel = document.getElementById("sel-cliente");
  sel.innerHTML = "";
  estado.clientes.forEach((c, i) => {
    const op       = document.createElement("option");
    op.value       = i;
    op.textContent = `${String(i+1).padStart(2,"0")}. ${c.nomeCliente}`;
    sel.appendChild(op);
  });
}

// ════════════════════════════════════════════════
// NAVEGAÇÃO ENTRE CLIENTES
// ════════════════════════════════════════════════
function irCliente(delta) {
  const novo = estado.clienteIdx + delta;
  if (novo < 0 || novo >= estado.clientes.length) return;
  estado.clienteIdx = novo;
  atualizarClienteAtual();
}

function irClienteDireto(idx) {
  estado.clienteIdx = parseInt(idx);
  atualizarClienteAtual();
}


// ════════════════════════════════════════════════
// RASCUNHO LOCAL (sessionStorage)
// Salva itens pendentes por cliente, por vendedor+mes+ano
// ════════════════════════════════════════════════
function _rascunhoKey(codCliente) {
  const v = estado.vendedor?.codigo || "x";
  return `pf_draft_${v}_${estado.mes}_${estado.ano}_${codCliente}`;
}

// Chave para sessões confirmadas localmente (ainda não enviadas à nuvem)
function _sessaoKey() {
  const v = estado.vendedor?.codigo || "x";
  return `pf_sessao_local_${v}_${estado.mes}_${estado.ano}`;
}

function salvarSessaoLocal() {
  try {
    // Salva apenas clientes com itens novos ainda não enviados
    const paraGuardar = {};
    Object.entries(estado.sessao).forEach(([cod, sess]) => {
      if ((sess.status === "ok" || sess.status === "sem-venda") && !sess._jaEnviado) {
        paraGuardar[cod] = sess;
      } else if (sess.status === "ok" && sess._jaEnviado && (sess.itens || []).length > 0) {
        // Tem histórico na nuvem + novos itens pendentes: salva só os novos
        paraGuardar[cod] = {
          status:        sess.status,
          itens:         sess.itens,
          itensServidor: sess.itensServidor || [],
          totalKg:       sess.totalKg,
          _jaEnviado:    true,
        };
      }
    });
    if (Object.keys(paraGuardar).length > 0) {
      localStorage.setItem(_sessaoKey(), JSON.stringify(paraGuardar));
    } else {
      localStorage.removeItem(_sessaoKey());
    }
  } catch(e) {}
}

function carregarSessaoLocal() {
  try {
    const raw = localStorage.getItem(_sessaoKey());
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function limparSessaoLocal() {
  try { localStorage.removeItem(_sessaoKey()); } catch(e) {}
}

function salvarRascunho(codCliente, itens) {
  try {
    if (itens && itens.length > 0) {
      localStorage.setItem(_rascunhoKey(codCliente), JSON.stringify(itens));
    } else {
      localStorage.removeItem(_rascunhoKey(codCliente));
    }
  } catch(e) { /* ignora erro de storage */ }
}

function carregarRascunho(codCliente) {
  try {
    const raw = localStorage.getItem(_rascunhoKey(codCliente));
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function limparRascunho(codCliente) {
  try { localStorage.removeItem(_rascunhoKey(codCliente)); } catch(e) {}
}

// ──────────────────────────────────────────────
// Atualiza a UI para o cliente atual
// ──────────────────────────────────────────────
function atualizarClienteAtual() {
  const idx = estado.clienteIdx;
  const c   = estado.clientes[idx];
  if (!c) return;

  const sess = estado.sessao[c.codCliente] || { status:"pendente", itens:[], totalKg:0 };

  // itensCliente = apenas os itens NOVOS desta sessão (para edição)
  // itensServidor = histórico imutável já salvo no servidor
  if (sess.status === "pendente") {
    const rascunho = carregarRascunho(c.codCliente);
    estado.itensCliente = rascunho ? [...rascunho] : [];
  } else {
    // itens = novos ainda não enviados; itensServidor = histórico do servidor
    estado.itensCliente = [...(sess.itens || [])];
  }
  estado.editandoId = null;

  // Display
  document.getElementById("disp-nome-cliente").textContent = c.nomeCliente;
  document.getElementById("disp-cod-cliente").textContent  = `Cód: ${c.codCliente}  |  Loja: ${c.loja || "—"}`;

  const statusEl = document.getElementById("disp-status-cliente");
  const nServidor = (sess.itensServidor || []).length;
  const nNovos    = (sess.itens || []).length;

  if (sess.status === "ok") {
    statusEl.className = "cliente-status status-ok";
    if (sess._jaEnviado && nNovos === 0) {
      statusEl.textContent = `☁️ ${nServidor} item(s) já na nuvem — adicione mais se necessário`;
    } else if (sess._jaEnviado && nNovos > 0) {
      statusEl.textContent = `☁️ ${nServidor} na nuvem + ${nNovos} novo(s) pendente(s) de envio`;
    } else {
      statusEl.textContent = `✓ Confirmado localmente (${nNovos} item(s)) — pendente de envio`;
    }
  } else if (sess.status === "sem-venda") {
    statusEl.className  = "cliente-status status-sem-venda";
    statusEl.textContent= "— Sem venda";
  } else if (estado.itensCliente.length > 0) {
    statusEl.className  = "cliente-status status-rascunho";
    statusEl.textContent= `✏️ Rascunho (${estado.itensCliente.length} item(s))`;
  } else {
    statusEl.className  = "cliente-status status-pendente";
    statusEl.textContent= "● Pendente";
  }

  // Select de navegação
  document.getElementById("sel-cliente").value  = idx;
  document.getElementById("btn-ant").disabled   = idx === 0;
  document.getElementById("btn-prox").disabled  = idx === estado.clientes.length - 1;

  // Progresso e painel lateral
  atualizarProgresso();
  renderizarPainelClientes();

  // Limpa formulário e renderiza lista
  limparFormulario();
  renderizarLista();
}

// ════════════════════════════════════════════════
// CÁLCULO DE KG
// ════════════════════════════════════════════════
function calcularKg() {
  const qtd      = getQtd();
  const pesoReal = _prodSel?.pesoLiq || 0;
  const pesoUnit = pesoReal > 0 ? pesoReal : 1;
  const kg       = qtd * pesoUnit;
  document.getElementById("kg-valor").textContent = nf(kg);
}

function atualizarProdutoSelecionado() {
  calcularKg();
}

// ════════════════════════════════════════════════
// ADICIONAR / EDITAR ITEM
// ════════════════════════════════════════════════
function adicionarItem() {
  const qtd  = getQtd();

  if (!_prodSel)  { toast("Selecione um produto.", "warn"); return; }
  if (qtd <= 0)   { toast("Informe uma quantidade válida.", "warn"); return; }

  const pesoU   = _prodSel.pesoLiq > 0 ? _prodSel.pesoLiq : 1;
  const totalKg = qtd * pesoU;
  // Deriva tipo a partir da unidade do produto
  const tipo    = unidadeParaTipo(_prodSel.unidade);

  const item = {
    id:          estado.editandoId || gerarId(),
    codProduto:  _prodSel.cod,
    nomeProduto: _prodSel.nome,
    tipo,
    unidade:     _prodSel.unidade || "",
    quantidade:  qtd,
    pesoLiquido: pesoU,
    totalKg,
    fase:        _prodSel.fase     || "",
    subGrupo:    _prodSel.subGrupo || "",
    pellet:      _prodSel.pellet   || "",
  };

  if (estado.editandoId) {
    // Substitui o item existente
    const idx = estado.itensCliente.findIndex(i => i.id === estado.editandoId);
    if (idx !== -1) estado.itensCliente[idx] = item;
    estado.editandoId = null;
    document.getElementById("chip-editar").style.display = "none";
    document.getElementById("btn-add-item").textContent  = "+ Adicionar item";
  } else {
    estado.itensCliente.push(item);
  }

  // Salva rascunho local imediatamente
  const cAtual = estado.clientes[estado.clienteIdx];
  if (cAtual) salvarRascunho(cAtual.codCliente, estado.itensCliente);

  limparFormulario();
  renderizarLista();
  toast("✓ Item adicionado.");
}

// ════════════════════════════════════════════════
// RENDERIZAÇÃO DA LISTA
// ════════════════════════════════════════════════
function renderizarLista() {
  const vazioEl = document.getElementById("lista-vazia");
  const listEl  = document.getElementById("lista-itens");
  const totalEl = document.getElementById("lista-total");

  listEl.innerHTML = "";

  const c = estado.clientes[estado.clienteIdx];
  const sess = c ? (estado.sessao[c.codCliente] || {}) : {};
  const itensServidor = sess.itensServidor || [];
  const itensNovos    = estado.itensCliente; // apenas novos desta sessão

  const temQualquerCoisa = itensServidor.length > 0 || itensNovos.length > 0;

  if (!temQualquerCoisa) {
    vazioEl.style.display = "block";
    totalEl.style.display = "none";
    atualizarResumoProdutos();
    return;
  }

  vazioEl.style.display = "none";
  totalEl.style.display = "flex";

  let totalKg = 0;

  // ── Seção: Histórico do servidor (somente leitura) ──
  if (itensServidor.length > 0) {
    const headerServidor = document.createElement("div");
    headerServidor.style.cssText = `
      display:flex; align-items:center; gap:8px;
      padding:7px 10px; margin-bottom:6px;
      background:rgba(46,125,50,.07);
      border:1px solid rgba(46,125,50,.2);
      border-radius:8px;
      font-family:var(--mono); font-size:11px;
      color:var(--accent);
    `;
    const totalKgServidor = itensServidor.reduce((s,i)=>s+i.totalKg,0);
    headerServidor.innerHTML = `☁️ <strong>Já na nuvem — ${itensServidor.length} item(s) · ${nf(totalKgServidor)} kg</strong> <span style="color:var(--muted2);font-size:10px">(histórico, não será reenviado)</span>`;
    listEl.appendChild(headerServidor);

    itensServidor.forEach(item => {
      totalKg += item.totalKg;
      const badgeClass = { Saco:"badge-saco", Granel:"badge-granel", Bag:"badge-bag" }[item.tipo] || "";
      const card = document.createElement("div");
      card.className = "item-card";
      card.style.opacity = "0.72";
      card.style.borderStyle = "dashed";
      card.innerHTML = `
        <div class="item-card-header">
          <div class="item-nome">${item.nomeProduto}</div>
          <span class="item-badge ${badgeClass}">${item.unidade || item.tipo}</span>
        </div>
        <div class="item-meta">
          <span>Qtd: <strong>${nf(item.quantidade)}</strong></span>
          <span>Peso unit: <strong>${nf(item.pesoLiquido)} kg</strong></span>
          <span class="item-kg">⟹ ${nf(item.totalKg)} kg</span>
        </div>
        <div style="margin-top:6px;font-family:var(--mono);font-size:10px;color:var(--muted2)">☁️ salvo na nuvem</div>
      `;
      listEl.appendChild(card);
    });
  }

  // ── Seção: Itens novos (editáveis) ──
  if (itensNovos.length > 0) {
    if (itensServidor.length > 0) {
      const headerNovos = document.createElement("div");
      headerNovos.style.cssText = `
        display:flex; align-items:center; gap:8px;
        padding:7px 10px; margin:10px 0 6px;
        background:rgba(151,191,63,.1);
        border:1px solid rgba(151,191,63,.35);
        border-radius:8px;
        font-family:var(--mono); font-size:11px;
        color:#5a7a1a;
      `;
      headerNovos.innerHTML = `✏️ <strong>Novos lançamentos — ${itensNovos.length} item(s)</strong> <span style="color:var(--muted2);font-size:10px">(pendente de envio)</span>`;
      listEl.appendChild(headerNovos);
    }

    itensNovos.forEach(item => {
      totalKg += item.totalKg;
      const badgeClass = { Saco:"badge-saco", Granel:"badge-granel", Bag:"badge-bag" }[item.tipo] || "";
      const card = document.createElement("div");
      card.className = "item-card" + (estado.editandoId === item.id ? " editando" : "");
      card.innerHTML = `
        <div class="item-card-header">
          <div class="item-nome">${item.nomeProduto}</div>
          <span class="item-badge ${badgeClass}">${item.unidade || item.tipo}</span>
        </div>
        <div class="item-meta">
          <span>Qtd: <strong>${nf(item.quantidade)}</strong></span>
          <span>Peso unit: <strong>${nf(item.pesoLiquido)} kg</strong></span>
          <span class="item-kg">⟹ ${nf(item.totalKg)} kg</span>
        </div>
        ${item.observacao ? `<div style="margin-top:4px;font-size:12px;color:var(--muted2)">📝 ${item.observacao}</div>` : ""}
        <div class="item-acoes">
          <button class="btn-edit" onclick="editarItem('${item.id}')">✏️ Editar</button>
          <button class="btn-del"  onclick="excluirItem('${item.id}')">🗑</button>
        </div>
      `;
      listEl.appendChild(card);
    });
  }

  document.getElementById("total-kg-display").textContent = nf(totalKg) + " kg";
  atualizarResumoProdutos();
}

// ════════════════════════════════════════════════
// EDITAR ITEM
// ════════════════════════════════════════════════
function editarItem(id) {
  const item = estado.itensCliente.find(i => i.id === id);
  if (!item) return;

  estado.editandoId = id;

  // Restaura o produto selecionado no seletor avançado
  const prod = _prodCache.find(p => p.cod === item.codProduto)
    || { cod: item.codProduto, nome: item.nomeProduto, fase: item.fase,
         subGrupo: item.subGrupo, pellet: item.pellet, pesoLiq: item.pesoLiquido };
  selecionarProduto(prod);

  // Restaura quantidade com formatação de milhares
  const qtdEl = document.getElementById("f-qtd");
  qtdEl.value = item.quantidade > 0 ? item.quantidade.toLocaleString("pt-BR") : "";
  calcularKg();

  // Exibe chip de edição
  document.getElementById("chip-editar").style.display = "inline-flex";
  document.getElementById("btn-add-item").textContent  = "✓ Salvar alteração";

  // Scroll até o formulário
  document.querySelector(".secao:nth-child(3)").scrollIntoView({ behavior:"smooth", block:"start" });
  renderizarLista();
}

// ════════════════════════════════════════════════
// CANCELAR EDIÇÃO
// ════════════════════════════════════════════════
function cancelarEdicao() {
  estado.editandoId = null;
  document.getElementById("chip-editar").style.display = "none";
  document.getElementById("btn-add-item").textContent  = "+ Adicionar item";
  limparFormulario();
  renderizarLista();
}

// ════════════════════════════════════════════════
// EXCLUIR ITEM
// ════════════════════════════════════════════════
function excluirItem(id) {
  estado.itensCliente = estado.itensCliente.filter(i => i.id !== id);
  if (estado.editandoId === id) cancelarEdicao();
  const cAtual = estado.clientes[estado.clienteIdx];
  if (cAtual) salvarRascunho(cAtual.codCliente, estado.itensCliente);
  renderizarLista();
  toast("Item removido.");
}

// ════════════════════════════════════════════════
// LIMPAR FORMULÁRIO
// ════════════════════════════════════════════════
function limparFormulario() {
  limparSelecaoProduto();
  document.getElementById("f-qtd").value  = "";
  document.getElementById("kg-valor").textContent = "0";
}

// ════════════════════════════════════════════════
// REGISTRAR SEM VENDA (salva só localmente)
// ════════════════════════════════════════════════
function registrarSemVenda() {
  const c = estado.clientes[estado.clienteIdx];
  if (!c) return;

  abrirModal(
    "Registrar sem venda?",
    `Confirmar que <strong>${c.nomeCliente}</strong> não realizou compras neste mês?<br><small style="color:var(--muted2)">O registro ficará salvo localmente até você clicar em "Salvar tudo na nuvem".</small>`,
    () => {
      const cod = c.codCliente;
      estado.sessao[cod] = { status: "sem-venda", itens: [], totalKg: 0 };
      limparRascunho(cod);
      estado.itensCliente = [];

      toast("🚫 Sem venda registrado localmente.");
      salvarSessaoLocal();
      atualizarResumo();
      atualizarSalvarFinal();

      setTimeout(() => {
        if (estado.clienteIdx < estado.clientes.length - 1) {
          irCliente(1);
        } else {
          atualizarClienteAtual();
          toast("🎉 Todos os clientes foram confirmados! Clique em 'Salvar tudo na nuvem'.");
        }
      }, 700);
    }
  );
}

// ════════════════════════════════════════════════
// CONFIRMAR CLIENTE (salva só localmente, sem enviar)
// ════════════════════════════════════════════════
function confirmarFinalizar() {
  const c = estado.clientes[estado.clienteIdx];
  if (!c) return;

  if (estado.itensCliente.length === 0) {
    toast("Nenhum item lançado. Use 'Sem venda' para registrar sem compras.", "warn"); return;
  }

  const totalKg = estado.itensCliente.reduce((s,i)=>s+i.totalKg, 0);
  abrirModal(
    "Confirmar cliente?",
    `Confirmar ${estado.itensCliente.length} item(s) para <strong>${c.nomeCliente}</strong>, totalizando ${nf(totalKg)} kg?<br><small style="color:var(--muted2)">Os dados ficam salvos localmente até você clicar em "Salvar tudo na nuvem".</small>`,
    () => {
      // Salva apenas em memória (estado)
      const cod = c.codCliente;
      const sessAnterior = estado.sessao[cod] || {};
      // itens = apenas os NOVOS desta sessão (não duplica os do servidor)
      const novosItens = [...estado.itensCliente];
      const totalKgNovos = novosItens.reduce((s,i)=>s+i.totalKg, 0);
      const totalKgServidor = (sessAnterior.itensServidor || []).reduce((s,i)=>s+i.totalKg, 0);
      estado.sessao[cod] = {
        status:         "ok",
        itens:          novosItens,           // somente os novos → enviados ao salvar
        itensServidor:  sessAnterior.itensServidor || [], // histórico imutável
        totalKg:        totalKgNovos + totalKgServidor,
        _jaEnviado:     sessAnterior._jaEnviado || false,
      };
      limparRascunho(cod);
      estado.itensCliente = [];

      toast("✅ Cliente confirmado! Continue os demais e salve tudo ao final.");
      salvarSessaoLocal();
      atualizarResumo();
      atualizarSalvarFinal();

      // Avança para o próximo cliente automaticamente
      setTimeout(() => {
        if (estado.clienteIdx < estado.clientes.length - 1) {
          irCliente(1);
        } else {
          atualizarClienteAtual();
          toast("🎉 Todos os clientes foram confirmados! Clique em 'Salvar tudo na nuvem'.");
        }
      }, 700);
    }
  );
}

// ════════════════════════════════════════════════
// SALVAR NO SERVIDOR (Google Sheets)
// ════════════════════════════════════════════════

// encodeURIComponent seguro — remove surrogates soltos e caracteres inválidos
function safeEncode(val) {
  try {
    const str = String(val ?? "");
    // Remove surrogates soltos (high sem low e low sem high) e \uFFFD
    const limpo = str
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "") // high surrogate sem low
      .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "") // low surrogate sem high
      .replace(/\uFFFD/g, "");                              // replacement character
    return encodeURIComponent(limpo);
  } catch(e) {
    // Fallback: mantém apenas ASCII imprimível
    return encodeURIComponent(String(val ?? "").replace(/[^\x20-\x7E]/g, ""));
  }
}

// Sanitiza string: remove caracteres de controle e substitutos inválidos
function sanitize(str) {
  return String(str ?? "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .replace(/[\uFFFD\x00-\x1F\x7F]/g, "")
    .trim();
}

async function salvarNoServidor(codCliente, nomeCliente, loja, itens, semVenda) {
  const v = estado.vendedor || { codigo: "sem-login", nome: "Sem login" };
  mostrarLoading("Salvando no servidor...");

  // Data de lançamento no formato DD/MM/AAAA HH:MM:SS
  const agora = new Date();
  const dataLancamento = [
    String(agora.getDate()).padStart(2,"0"),
    String(agora.getMonth()+1).padStart(2,"0"),
    agora.getFullYear()
  ].join("/") + " " + [
    String(agora.getHours()).padStart(2,"0"),
    String(agora.getMinutes()).padStart(2,"0"),
    String(agora.getSeconds()).padStart(2,"0")
  ].join(":");

  try {
    const linhas = semVenda ? [] : itens.map(i => ({
      COD_VENDEDOR:    sanitize(v.codigo),
      VENDEDOR:        sanitize(v.nome),
      COD_CLIENTE:     sanitize(codCliente),
      LOJA:            sanitize(loja),
      CLIENTE:         sanitize(nomeCliente),
      COD_PRODUTO:     sanitize(i.codProduto),
      PRODUTO:         sanitize(i.nomeProduto),
      UNIDADE:         sanitize(i.unidade || i.tipo || ""),
      FASE:            sanitize(i.fase     || ""),
      PELLET:          sanitize(i.pellet   || ""),
      SUB_GRUPO:       sanitize(i.subGrupo || ""),
      PESO_LIQUIDO:    i.pesoLiquido,
      QUANTIDADE:      i.quantidade,
      TOTAL_KG:        i.totalKg,
      MES:             estado.mes,
      ANO:             estado.ano,
      OBSERVACAO:      sanitize(i.observacao || ""),
      DATA_LANCAMENTO: dataLancamento,
    }));

    const payload = {
      action:       "salvarLancamentos",
      codVendedor:  sanitize(v.codigo),
      nomeVendedor: sanitize(v.nome),
      mes:          estado.mes,
      ano:          estado.ano,
      semVenda:     semVenda,
      linhas:       JSON.stringify(linhas),
    };

    // Envia via POST para evitar limitações de URL e erros de URI malformed
    const postPayload = {
      action:       "salvarLancamentos",
      codVendedor:  sanitize(v.codigo),
      nomeVendedor: sanitize(v.nome),
      mes:          estado.mes,
      ano:          estado.ano,
      semVenda:     semVenda,
      linhas:       linhas,
    };

    const resp = await fetch(API_URL, {
      method: "POST",
      mode:   "no-cors",
      headers: { "Content-Type": "application/json" },
      body:   JSON.stringify(postPayload),
    });
    // no-cors não retorna body legível, mas o Apps Script processa normalmente

    // Limpa rascunho local e atualiza estado
    limparRascunho(codCliente);
    const statusFinal = semVenda ? "sem-venda" : "ok";
    const totalKg     = itens.reduce((s,i)=>s+i.totalKg,0);
    estado.sessao[codCliente] = {
      status: statusFinal, itens: [...itens], totalKg
    };
    estado.itensCliente = [];

    esconderLoading();
    toast(semVenda ? "🚫 Sem venda registrado." : "✅ Cliente finalizado com sucesso!");
    atualizarResumo();

    // Avança para o próximo cliente automaticamente
    setTimeout(() => {
      if (estado.clienteIdx < estado.clientes.length - 1) {
        irCliente(1);
      } else {
        atualizarClienteAtual();
        toast("🎉 Todos os clientes foram atendidos!");
      }
    }, 800);

  } catch(e) {
    esconderLoading();
    toast("❌ Erro ao salvar: " + e.message, "error");
  }
}

// ════════════════════════════════════════════════
// ATUALIZAR PROGRESSO E RESUMO
// ════════════════════════════════════════════════
function atualizarProgresso() {
  const total     = estado.clientes.length;
  const atendidos = Object.values(estado.sessao).filter(s => s.status !== "pendente").length;
  const pct       = total > 0 ? Math.round(atendidos / total * 100) : 0;

  document.getElementById("prog-fill").style.width = pct + "%";
  document.getElementById("prog-txt").textContent  = `${atendidos} / ${total}`;
}

function atualizarResumo() {
  const sessoes  = Object.values(estado.sessao);
  const ok       = sessoes.filter(s => s.status === "ok").length;
  const semVenda = sessoes.filter(s => s.status === "sem-venda").length;

  // Agrega kg de todas as sessões finalizadas (servidor + novos)
  const porFase = {};
  sessoes.forEach(sess => {
    const todos = [...(sess.itensServidor || []), ...(sess.itens || [])];
    todos.forEach(item => {
      const fase = item.fase || "—";
      porFase[fase] = (porFase[fase] || 0) + (item.totalKg || 0);
    });
  });
  const totalKg = Object.values(porFase).reduce((s,v)=>s+v, 0);

  document.getElementById("res-atendidos").textContent = ok;
  document.getElementById("res-sem-venda").textContent = semVenda;
  document.getElementById("res-total-kg").textContent  = nf(totalKg) + " kg";

  // Agrega também por unidade (servidor + novos)
  const porUnidade = {};
  sessoes.forEach(sess => {
    const todos = [...(sess.itensServidor || []), ...(sess.itens || [])];
    todos.forEach(item => {
      const unid = item.unidade || item.tipo || "—";
      porUnidade[unid] = (porUnidade[unid] || 0) + (item.quantidade || 0);
    });
  });

  // Totais por fase no header
  const cont = document.getElementById("hdr-fase-stats");
  if (cont) {
    cont.innerHTML = "";
    cont.style.display = "contents";
    Object.entries(porFase).sort().forEach(([fase, kg]) => {
      const d = document.createElement("div");
      d.className = "hstat";
      d.innerHTML = `<div class="hstat-val">${nf(kg)}</div><div class="hstat-lbl">${fase} kg</div>`;
      cont.appendChild(d);
    });
  }

  // Totais por unidade no header
  const contU = document.getElementById("hdr-unid-stats");
  if (contU) {
    contU.innerHTML = "";
    contU.style.display = "contents";
    const UNID_LABEL = { SC:"Sacos", KG:"Granel (kg)", BG:"Bags", Saco:"Sacos", Granel:"Granel (kg)", Bag:"Bags" };
    Object.entries(porUnidade).sort().forEach(([unid, qtd]) => {
      const d = document.createElement("div");
      d.className = "hstat";
      d.innerHTML = `<div class="hstat-val" style="color:var(--accent2)">${nf(qtd)}</div><div class="hstat-lbl">${UNID_LABEL[unid] || unid}</div>`;
      contU.appendChild(d);
    });
  }

  atualizarProgresso();
  renderizarPainelClientes();
}

// ════════════════════════════════════════════════
// PAINEL LATERAL DE CLIENTES
// ════════════════════════════════════════════════
function renderizarPainelClientes() {
  const pendentes = estado.clientes.filter(c =>
    (estado.sessao[c.codCliente]?.status || "pendente") === "pendente"
  ).length;

  // Atualiza badge do botão mobile
  const badge = document.getElementById("btn-pendentes-badge");
  if (badge) badge.textContent = pendentes > 0 ? `${pendentes} pendentes` : "✓ todos atendidos";

  // Atualiza contador do painel desktop
  const painelPend = document.getElementById("painel-pendentes");
  if (painelPend) painelPend.textContent = pendentes > 0 ? `${pendentes} pendentes` : "✓ todos";

  // Renderiza nas duas listas (painel desktop + drawer mobile)
  ["painel-lista","drawer-lista"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = "";
    estado.clientes.forEach((c, i) => {
      const sessStatus = estado.sessao[c.codCliente]?.status || "pendente";
      // Verifica se há rascunho local para este cliente
      const temRascunho = sessStatus === "pendente" && carregarRascunho(c.codCliente)?.length > 0;
      const status = temRascunho ? "rascunho" : sessStatus;
      const ativo  = i === estado.clienteIdx;
      const div    = document.createElement("div");
      div.className= `cliente-item-painel${ativo ? " ativo" : ""}`;
      div.onclick  = () => { irClienteDireto(i); fecharDrawer(); };
      const qtdRascunho = temRascunho ? carregarRascunho(c.codCliente).length : 0;
      const sess = estado.sessao[c.codCliente] || {};
      const totalKgCli = (() => {
        if (sessStatus === "sem-venda") return null;
        const todos = [...(sess.itensServidor || []), ...(sess.itens || [])];
        const kg = todos.reduce((s,i)=>s+i.totalKg,0);
        return kg > 0 ? kg : null;
      })();
      const kgHtml = sessStatus === "sem-venda"
        ? `<div class="cli-kg-painel sem-venda">sem venda</div>`
        : totalKgCli !== null
          ? `<div class="cli-kg-painel">${nf(totalKgCli)} kg</div>`
          : `<div class="cli-kg-painel empty">—</div>`;
      div.innerHTML= `
        <div class="cli-dot ${status}"></div>
        <div class="cli-info">
          <div class="cli-nome ${sessStatus === "pendente" && !temRascunho ? "pendente" : ""}">${c.nomeCliente}</div>
          <div class="cli-num">#${c.codCliente}${temRascunho ? ` · ✏️ ${qtdRascunho} item(s)` : ""}</div>
        </div>
        ${kgHtml}
      `;
      el.appendChild(div);
    });
  });
}

// ── Drawer mobile ──
function abrirDrawer() {
  document.getElementById("drawer-overlay").classList.add("aberto");
  document.getElementById("drawer").classList.add("aberto");
}
function fecharDrawer() {
  document.getElementById("drawer-overlay").classList.remove("aberto");
  document.getElementById("drawer").classList.remove("aberto");
}

// ════════════════════════════════════════════════
// ATUALIZAR HEADER
// ════════════════════════════════════════════════
function atualizarHeader() {
  const v = estado.vendedor;
  const el = document.getElementById("hdr-vendedor");
  if (el) el.textContent = v ? (v.nomeReduzido || v.nome) : "—";
}

// ════════════════════════════════════════════════
// SAIR
// ════════════════════════════════════════════════
function sair() {
  abrirModal(
    "Sair?",
    "Você será desconectado. Tem certeza que deseja sair?",
    () => {
      localStorage.removeItem("pf_sessao");
      limparSessaoLocal();
      location.reload();
    }
  );
}

// ════════════════════════════════════════════════
// MODAL GENÉRICO
// ════════════════════════════════════════════════
function abrirModal(titulo, desc, onConfirm) {
  document.getElementById("modal-titulo").innerHTML   = titulo;
  document.getElementById("modal-desc").innerHTML     = desc;
  document.getElementById("modal-confirmar").onclick  = () => {
    fecharModal();
    onConfirm();
  };
  document.getElementById("modal").classList.add("aberta");
}
function fecharModal() {
  document.getElementById("modal").classList.remove("aberta");
}
// Fecha o modal ao clicar fora
document.getElementById("modal").addEventListener("click", e => {
  if (e.target === document.getElementById("modal")) fecharModal();
});

// ════════════════════════════════════════════════
// SALVAR TUDO NA NUVEM (envio único ao servidor)
// ════════════════════════════════════════════════
function atualizarSalvarFinal() {
  const sessoes  = Object.values(estado.sessao);
  const total    = estado.clientes.length;
  const ok       = sessoes.filter(s => s.status === "ok").length;
  const semVenda = sessoes.filter(s => s.status === "sem-venda").length;
  const pendentes= sessoes.filter(s => s.status === "pendente").length;
  // Apenas clientes que têm novos dados ainda não enviados ao servidor
  const finalizados = sessoes.filter(s =>
    (s.status === "ok" || s.status === "sem-venda") && !s._jaEnviado
  ).length;

  // Atualiza stats visuais
  const infoEl = document.getElementById("salvar-final-info");
  if (infoEl) {
    const jaEnviados = sessoes.filter(s => s._jaEnviado).length;
    infoEl.innerHTML = `
      <div class="sf-stat">
        <div class="sf-stat-val">${ok}</div>
        <div class="sf-stat-lbl">Com venda</div>
      </div>
      <div class="sf-stat">
        <div class="sf-stat-val warn">${semVenda}</div>
        <div class="sf-stat-lbl">Sem venda</div>
      </div>
      <div class="sf-stat">
        <div class="sf-stat-val muted">${pendentes}</div>
        <div class="sf-stat-lbl">Pendentes</div>
      </div>
      ${jaEnviados > 0 ? `<div class="sf-stat">
        <div class="sf-stat-val" style="color:var(--muted2)">☁️ ${jaEnviados}</div>
        <div class="sf-stat-lbl">Já na nuvem</div>
      </div>` : ""}
      <div class="sf-stat">
        <div class="sf-stat-val">${total}</div>
        <div class="sf-stat-lbl">Total</div>
      </div>
    `;
  }

  // Habilita o botão se há pelo menos 1 cliente confirmado
  const btnEl = document.getElementById("btn-salvar-final");
  const secaoEl = document.getElementById("secao-salvar-final");
  if (btnEl) {
    btnEl.disabled = finalizados === 0;
    if (finalizados > 0 && pendentes === 0) {
      btnEl.textContent = `☁️ Concluir previsão de vendas (${finalizados} clientes)`;
      if (secaoEl) secaoEl.classList.add("pronto");
    } else if (finalizados > 0) {
      btnEl.textContent = `☁️ Concluir previsão de vendas (${finalizados} confirmados)`;
      if (secaoEl) secaoEl.classList.remove("pronto");
    } else {
      btnEl.textContent = "☁️ Concluir previsão de vendas";
      if (secaoEl) secaoEl.classList.remove("pronto");
    }
  }
}

async function salvarTudoFinal() {
  const confirmados = estado.clientes.filter(c => {
    const s = estado.sessao[c.codCliente];
    // Só envia clientes que têm status confirmado E ainda não foram enviados ao servidor
    return s && s.status !== "pendente" && !s._jaEnviado;
  });

  if (confirmados.length === 0) {
    toast("Nenhum cliente confirmado ainda.", "warn"); return;
  }

  const pendentes = estado.clientes.filter(c => {
    const s = estado.sessao[c.codCliente];
    return !s || s.status === "pendente";
  });

  const msgPendentes = pendentes.length > 0
    ? `<br><small style="color:var(--warn)">⚠️ ${pendentes.length} cliente(s) ainda pendentes não serão enviados.</small>`
    : "";

  abrirModal(
    "Salvar tudo na nuvem?",
    `Enviar os lançamentos de <strong>${confirmados.length} cliente(s)</strong> para o servidor agora?${msgPendentes}`,
    async () => {
      mostrarLoading("Salvando todos os lançamentos...");
      const v = estado.vendedor || { codigo: "sem-login", nome: "Sem login" };

      const agora = new Date();
      const dataLancamento = [
        String(agora.getDate()).padStart(2,"0"),
        String(agora.getMonth()+1).padStart(2,"0"),
        agora.getFullYear()
      ].join("/") + " " + [
        String(agora.getHours()).padStart(2,"0"),
        String(agora.getMinutes()).padStart(2,"0"),
        String(agora.getSeconds()).padStart(2,"0")
      ].join(":");

      // Monta todas as linhas de uma vez — somente itens NOVOS (sess.itens)
      const todasLinhas = [];
      confirmados.forEach(c => {
        const sess = estado.sessao[c.codCliente];
        if (sess.status === "sem-venda") return;
        // sess.itens = apenas os novos não enviados ainda
        (sess.itens || []).forEach(i => {
          todasLinhas.push({
            COD_VENDEDOR:    sanitize(v.codigo),
            VENDEDOR:        sanitize(v.nome),
            COD_CLIENTE:     sanitize(c.codCliente),
            LOJA:            sanitize(c.loja || ""),
            CLIENTE:         sanitize(c.nomeCliente),
            COD_PRODUTO:     sanitize(i.codProduto),
            PRODUTO:         sanitize(i.nomeProduto),
            UNIDADE:         sanitize(i.unidade || i.tipo || ""),
            FASE:            sanitize(i.fase     || ""),
            PELLET:          sanitize(i.pellet   || ""),
            SUB_GRUPO:       sanitize(i.subGrupo || ""),
            PESO_LIQUIDO:    i.pesoLiquido,
            QUANTIDADE:      i.quantidade,
            TOTAL_KG:        i.totalKg,
            MES:             estado.mes,
            ANO:             estado.ano,
            OBSERVACAO:      sanitize(i.observacao || ""),
            DATA_LANCAMENTO: dataLancamento,
          });
        });
      });

      // Clientes sem venda (lista separada para o backend)
      const semVendaList = confirmados
        .filter(c => estado.sessao[c.codCliente]?.status === "sem-venda")
        .map(c => ({
          COD_VENDEDOR: sanitize(v.codigo),
          COD_CLIENTE:  sanitize(c.codCliente),
          CLIENTE:      sanitize(c.nomeCliente),
          LOJA:         sanitize(c.loja || ""),
          MES:          estado.mes,
          ANO:          estado.ano,
          DATA_LANCAMENTO: dataLancamento,
        }));

      try {
        const postPayload = {
          action:       "salvarLancamentos",
          codVendedor:  sanitize(v.codigo),
          nomeVendedor: sanitize(v.nome),
          mes:          estado.mes,
          ano:          estado.ano,
          semVenda:     false,
          linhas:       todasLinhas,
          semVendaList: semVendaList,
        };

        await fetch(API_URL, {
          method: "POST",
          mode:   "no-cors",
          headers: { "Content-Type": "application/json" },
          body:   JSON.stringify(postPayload),
        });

        // Limpa rascunhos locais dos confirmados
        confirmados.forEach(c => limparRascunho(c.codCliente));
        limparSessaoLocal();

        // Pós-envio: move os itens novos para itensServidor (histórico) e zera itens
        confirmados.forEach(c => {
          const sess = estado.sessao[c.codCliente];
          if (sess) {
            // Acumula no histórico do servidor
            const novosEnviados = (sess.itens || []).map(i => ({ ...i, _doServidor: true }));
            sess.itensServidor = [...(sess.itensServidor || []), ...novosEnviados];
            sess.itens      = [];      // limpa os novos (já foram enviados)
            sess._jaEnviado = true;
          }
        });

        esconderLoading();
        toast(`✅ ${confirmados.length} cliente(s) salvos na nuvem com sucesso!`);
        atualizarResumo();
        atualizarSalvarFinal();
        atualizarClienteAtual();

      } catch(e) {
        esconderLoading();
        toast("❌ Erro ao salvar: " + e.message, "error");
      }
    }
  );
}

// ════════════════════════════════════════════════
// FORMATAÇÃO DE NÚMEROS
// ════════════════════════════════════════════════
// Formata número com separador de milhares pt-BR: 1.000 / 200.000
function nf(n) {
  const v = Math.round(n);
  return v.toLocaleString("pt-BR");
}

// Lê o valor inteiro real do campo f-qtd (sem pontos)
function getQtd() {
  const raw = (document.getElementById("f-qtd")?.value || "").replace(/\./g,"");
  return parseInt(raw, 10) || 0;
}

// Máscara: permite só dígitos e formata com ponto de milhar
function mascaraQtd(el) {
  const digits = el.value.replace(/\D/g,"");
  const num    = parseInt(digits, 10) || 0;
  el.value     = num > 0 ? num.toLocaleString("pt-BR") : "";
  calcularKg();
}

// Bloqueia teclas não numéricas no campo quantidade
function soInteiroKey(e) {
  // iOS virtual keyboard envia keyCode 229 (composição) — deixa passar, a máscara trata
  if (e.keyCode === 229) return true;
  // Permite: setas, backspace, delete, tab, enter, home, end
  if ([8,9,13,35,36,37,38,39,40,46].includes(e.keyCode)) return true;
  // Bloqueia qualquer coisa que não seja dígito (0-9)
  if (e.key < "0" || e.key > "9") { e.preventDefault(); return false; }
  return true;
}


function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,5);
}

let _tt;
function toast(msg, tipo) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className   = "toast show" + (tipo ? " "+tipo : "");
  clearTimeout(_tt);
  _tt = setTimeout(() => { el.className = "toast"; }, 4200);
}

function mostrarLoading(msg) {
  document.getElementById("loadingMsg").textContent = msg || "Aguarde...";
  document.getElementById("loading").style.display  = "flex";
}
function esconderLoading() {
  document.getElementById("loading").style.display = "none";
}

// ════════════════════════════════════════════════
// DASHBOARD RESUMO
// ════════════════════════════════════════════════
function abrirResumo() {
  const overlay = document.getElementById("resumo-overlay");
  const body    = document.getElementById("resumo-body");
  if (!overlay || !body) return;

  const sessoes  = Object.values(estado.sessao);
  const total    = estado.clientes.length;
  const ok       = sessoes.filter(s => s.status === "ok").length;
  const semVenda = sessoes.filter(s => s.status === "sem-venda").length;
  const pendentes= sessoes.filter(s => s.status === "pendente").length;
  const nauvem   = sessoes.filter(s => s._jaEnviado).length;
  const pct      = total > 0 ? Math.round((ok + semVenda) / total * 100) : 0;

  // Totais por fase
  const porFase = {};
  sessoes.forEach(sess => {
    [...(sess.itensServidor||[]),...(sess.itens||[])].forEach(item => {
      const fase = item.fase || "—";
      porFase[fase] = (porFase[fase]||0) + (item.totalKg||0);
    });
  });
  const totalKgGeral = Object.values(porFase).reduce((s,v)=>s+v,0);
  const maxFaseKg    = Math.max(...Object.values(porFase), 1);

  // Totais por unidade
  const porUnidade = {};
  sessoes.forEach(sess => {
    [...(sess.itensServidor||[]),...(sess.itens||[])].forEach(item => {
      const unid = item.unidade || item.tipo || "—";
      porUnidade[unid] = (porUnidade[unid]||0) + (item.quantidade||0);
    });
  });
  const UNID_LABEL = { SC:"SC — Sacos", KG:"KG — Granel", BG:"BG — Bags", Saco:"Sacos", Granel:"Granel (kg)", Bag:"Bags" };

  // Por cliente — ordenado por kg desc
  const porCliente = estado.clientes.map(c => {
    const sess = estado.sessao[c.codCliente] || {};
    const status = sess.status || "pendente";
    const todos  = [...(sess.itensServidor||[]),...(sess.itens||[])];
    const kg     = todos.reduce((s,i)=>s+i.totalKg,0);
    return { nome: c.nomeCliente, cod: c.codCliente, status, kg };
  }).sort((a,b) => b.kg - a.kg);

  // ── Monta HTML ──
  const fasesHTML = Object.entries(porFase).sort((a,b)=>b[1]-a[1]).map(([fase, kg]) => {
    const w = Math.round(kg / maxFaseKg * 100);
    return `
      <div class="resumo-bar-row">
        <div class="resumo-bar-label">${fase}</div>
        <div class="resumo-bar-track">
          <div class="resumo-bar-fill" style="width:${w}%">
            <span>${nf(kg)}</span>
          </div>
        </div>
      </div>`;
  }).join("") || `<div style="padding:10px 12px;font-size:11px;color:var(--muted2)">Nenhum dado ainda.</div>`;

  const unidsHTML = Object.entries(porUnidade).sort().map(([unid, qtd]) => `
    <div class="resumo-unid-row">
      <div class="resumo-unid-lbl">${UNID_LABEL[unid]||unid}</div>
      <div class="resumo-unid-val">${nf(qtd)}</div>
    </div>`).join("") || `<div style="padding:10px 12px;font-size:11px;color:var(--muted2)">Nenhum dado ainda.</div>`;

  const clientesHTML = porCliente.map(c => {
    const dotClass = c.status==="ok" ? "ok" : c.status==="sem-venda" ? "sem-venda" : "pendente";
    const kgHtml   = c.status==="sem-venda"
      ? `<div class="resumo-cli-kg sem-venda">sem venda</div>`
      : c.kg > 0
        ? `<div class="resumo-cli-kg">${nf(c.kg)}</div>`
        : `<div class="resumo-cli-kg empty">—</div>`;
    const pctHtml  = (c.kg > 0 && totalKgGeral > 0)
      ? `<div class="resumo-cli-pct">${(c.kg/totalKgGeral*100).toFixed(1)}%</div>`
      : `<div class="resumo-cli-pct">—</div>`;
    const rowCls   = c.status==="pendente" ? " pendente" : "";
    return `
      <div class="resumo-cli-row${rowCls}">
        <div class="resumo-cli-dot ${dotClass}"></div>
        <div>
          <div class="resumo-cli-nome">${c.nome}</div>
          <div class="resumo-cli-cod">#${c.cod}</div>
        </div>
        ${kgHtml}
        ${pctHtml}
      </div>`;
  }).join("");

  body.innerHTML = `
    <div class="resumo-total-card">
      <div>
        <div class="resumo-total-lbl">Total kg previsto</div>
        <div class="resumo-total-val">${nf(totalKgGeral)} kg</div>
      </div>
      <div class="resumo-total-icon">🐟</div>
    </div>

    <div class="resumo-cards">
      <div class="resumo-card">
        <div class="resumo-card-val">${ok}</div>
        <div class="resumo-card-lbl">Atendidos</div>
      </div>
      <div class="resumo-card">
        <div class="resumo-card-val warn">${pendentes}</div>
        <div class="resumo-card-lbl">Pendentes</div>
      </div>
      <div class="resumo-card">
        <div class="resumo-card-val muted">${semVenda}</div>
        <div class="resumo-card-lbl">Sem venda</div>
      </div>
      <div class="resumo-card">
        <div class="resumo-card-val">☁️ ${nauvem}</div>
        <div class="resumo-card-lbl">Na nuvem</div>
      </div>
    </div>

    <div>
      <div class="resumo-prog-label">
        <span>Progresso geral</span><span>${pct}%</span>
      </div>
      <div class="resumo-prog-bar">
        <div class="resumo-prog-fill" style="width:${pct}%"></div>
      </div>
    </div>

    <div class="resumo-sub">
      <div class="resumo-sub-title">Total por fase (kg)</div>
      ${fasesHTML}
    </div>

    <div class="resumo-sub">
      <div class="resumo-sub-title">Total por unidade</div>
      ${unidsHTML}
    </div>

    <div class="resumo-sub">
      <div class="resumo-sub-title">Total por cliente</div>
      <div class="resumo-cli-header">
        <div></div>
        <div class="resumo-cli-hcol">Cliente</div>
        <div class="resumo-cli-hcol right">Total kg</div>
        <div class="resumo-cli-hcol right">%</div>
      </div>
      ${clientesHTML}
      <div class="resumo-cli-total">
        <div></div>
        <div class="resumo-cli-total-lbl">Total geral</div>
        <div class="resumo-cli-total-val">${nf(totalKgGeral)}</div>
        <div class="resumo-cli-total-pct">100%</div>
      </div>
    </div>
  `;

  overlay.classList.add("aberta");
  document.body.style.overflow = "hidden";
}

function fecharResumo(e) {
  if (e && e.target !== document.getElementById("resumo-overlay")) return;
  document.getElementById("resumo-overlay").classList.remove("aberta");
  document.body.style.overflow = "";
}

// ════════════════════════════════════════════════
// EXPORTAR PDF — RESUMO DE LANÇAMENTOS
// ════════════════════════════════════════════════
function exportarPDF() {
  const v   = estado.vendedor || { nome: "—", codigo: "" };
  const mes = MESES[+estado.mes] || estado.mes;
  const ano = estado.ano;

  // Monta tabela resumida por cliente
  const sessoes = estado.sessao;
  const linhasPDF = [];

  estado.clientes.forEach(c => {
    const sess = sessoes[c.codCliente];
    if (!sess || sess.status === "pendente") return;
    if (sess.status === "sem-venda") {
      linhasPDF.push({ cliente: c.nomeCliente, cod: c.codCliente, produto: "— Sem venda —", qtd: "—", unid: "—", kg: 0 });
      return;
    }
    const todosItens = [...(sess.itensServidor || []), ...(sess.itens || [])];
    todosItens.forEach(item => {
      linhasPDF.push({
        cliente: c.nomeCliente,
        cod:     c.codCliente,
        produto: item.nomeProduto,
        qtd:     nf(item.quantidade),
        unid:    item.unidade || item.tipo || "",
        kg:      item.totalKg || 0,
      });
    });
  });

  // Calcula totais gerais
  const totalKg  = linhasPDF.reduce((s, l) => s + l.kg, 0);
  const porUnid  = {};
  linhasPDF.forEach(l => {
    if (l.unid && l.unid !== "—") porUnid[l.unid] = (porUnid[l.unid] || 0) + (parseFloat(l.qtd?.replace?.(/\./g, "") || 0));
  });

  // Monta HTML para impressão
  const linhasHTML = linhasPDF.map(l => `
    <tr>
      <td>${l.cod}</td>
      <td>${l.cliente}</td>
      <td>${l.produto}</td>
      <td style="text-align:right">${l.qtd}</td>
      <td>${l.unid}</td>
      <td style="text-align:right">${l.kg > 0 ? nf(l.kg) + ' kg' : '—'}</td>
    </tr>`).join("");

  const unidsHTML = Object.entries(porUnid).map(([u, q]) =>
    `<span style="margin-right:16px"><strong>${nf(q)}</strong> ${u}</span>`).join(" ");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head>
  <meta charset="UTF-8"/>
  <title>Previsão de Vendas — ${mes}/${ano}</title>
  <style>
    body { font-family: 'Roboto', Arial, sans-serif; font-size: 11px; color: #111; margin: 20px; }
    h1 { font-size: 16px; color: #08592B; margin-bottom: 2px; }
    .sub { color: #555; font-size: 11px; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #08592B; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
    td { padding: 5px 8px; border-bottom: 1px solid #e0e0e0; }
    tr:nth-child(even) td { background: #f7f7f7; }
    .total-row td { font-weight: 700; background: #BFD989; color: #104025; border-top: 2px solid #97BF3F; }
    .resumo { margin-top: 14px; padding: 10px 12px; background: #F2F2F2; border-left: 4px solid #97BF3F; border-radius: 4px; }
    .resumo strong { color: #08592B; }
    @media print { body { margin: 10px; } }
  </style>
  </head><body>
  <h1>Previsão de Vendas</h1>
  <div class="sub">Vendedor: <strong>${v.nome}</strong> &nbsp;|&nbsp; Período: <strong>${mes}/${ano}</strong> &nbsp;|&nbsp; Emitido em: <strong>${new Date().toLocaleDateString('pt-BR')}</strong></div>
  <table>
    <thead><tr><th>Cód.</th><th>Cliente</th><th>Produto</th><th style="text-align:right">Qtd</th><th>Unid.</th><th style="text-align:right">Total kg</th></tr></thead>
    <tbody>${linhasHTML}</tbody>
    <tfoot><tr class="total-row"><td colspan="5">TOTAL GERAL</td><td style="text-align:right">${nf(totalKg)} kg</td></tr></tfoot>
  </table>
  <div class="resumo"><strong>Totais por unidade:</strong> ${unidsHTML || '—'} &nbsp;|&nbsp; <strong>Total kg:</strong> ${nf(totalKg)} kg</div>
  </body></html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 400);
}
