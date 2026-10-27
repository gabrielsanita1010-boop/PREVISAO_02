// ════════════════════════════════════════════════
// PREVFISH — CONFIGURAÇÃO DA API
// Google Apps Script (Web App URL)
// Para alterar a planilha, edite apenas esta URL.
// ════════════════════════════════════════════════
const API_URL = "https://script.google.com/macros/s/AKfycbwn2Al_yyUdsoASGM36sx6DSLbo_cseGBgQeLVJQ3jFGpDIaOdfDsfGP0WC9lj5quJlWQ/exec";

// ════════════════════════════════════════════════
// JSONP — comunicação com Google Apps Script
// Usado porque o Apps Script não suporta CORS direto.
// Todas as chamadas ao servidor passam por aqui.
// ════════════════════════════════════════════════
let _cbCount = 0;
function _jsonpOnce(url, timeoutMs) {
  return new Promise((res, rej) => {
    const cb = "__pf_" + (++_cbCount);

    // Remover a tag <script> não cancela a requisição de rede já em
    // andamento: se ela chegar depois do timeout/erro, o Apps Script
    // ainda vai tentar chamar este callback. Por isso, depois de
    // desistir, deixamos um no-op no lugar (em vez de apagar a chave)
    // para essa resposta tardia não estourar um ReferenceError global.
    const desativar = () => { window[cb] = () => {}; };

    const timer = setTimeout(() => {
      desativar();
      document.getElementById(cb+"_s")?.remove();
      rej(new Error("Timeout na requisição"));
    }, timeoutMs);

    window[cb] = (data) => {
      clearTimeout(timer);
      desativar();
      document.getElementById(cb+"_s")?.remove();
      if (data.error) rej(new Error(data.error));
      else res(data);
    };

    const sep = url.includes("?") ? "&" : "?";
    const sc  = document.createElement("script");
    sc.id     = cb + "_s";
    sc.src    = url + sep + "callback=" + cb;
    sc.onerror = () => {
      clearTimeout(timer);
      desativar(); sc.remove();
      rej(new Error("Falha ao carregar. Verifique a conexão."));
    };
    document.head.appendChild(sc);
  });
}

// Retry automático: o Apps Script costuma falhar só na 1ª tentativa
// quando está "frio" (sem uso recente) — tentar de novo resolve a
// maioria dos casos sem o usuário precisar fazer nada.
const _JSONP_TIMEOUTS = [15000, 22000, 22000];
function jsonp(url, tentativas = 3) {
  const esperar = ms => new Promise(r => setTimeout(r, ms));

  async function tentar(n) {
    try {
      return await _jsonpOnce(url, _JSONP_TIMEOUTS[n] ?? 22000);
    } catch (e) {
      if (n >= tentativas - 1) throw e;
      window.dispatchEvent(new CustomEvent("pf:jsonp-retry", {
        detail: { tentativa: n + 2, tentativas, erro: e.message }
      }));
      await esperar(1500 * (n + 1));
      return tentar(n + 1);
    }
  }
  return tentar(0);
}

// ════════════════════════════════════════════════
// CACHE LOCAL — evita reler a planilha inteira a
// cada abertura do app (produtos/clientes/vendedores
// mudam pouco de um acesso para o outro).
// ════════════════════════════════════════════════
function cacheGet(chave, maxIdadeMs) {
  try {
    const raw = localStorage.getItem("pf_cache_" + chave);
    if (!raw) return null;
    const { ts, dados } = JSON.parse(raw);
    if (Date.now() - ts > maxIdadeMs) return null;
    return dados;
  } catch { return null; }
}
function cacheSet(chave, dados) {
  try {
    localStorage.setItem("pf_cache_" + chave, JSON.stringify({ ts: Date.now(), dados }));
  } catch {}
}

// ════════════════════════════════════════════════
// KG DE UM LANÇAMENTO — fonte única de verdade
// A coluna TOTAL_KG da planilha é o valor oficial (inclusive
// quando ajustada manualmente). Só recalculamos QUANTIDADE ×
// PESO_LIQUIDO quando TOTAL_KG estiver vazio/inválido.
// ════════════════════════════════════════════════
const _KG_PADRAO_UNIDADE = { BG: 750, KG: 1, SC: 25 };
function _numBR(v) {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  // "1.234,5" → 1234.5 ; "0,5" → 0.5 ; "1234.5" → 1234.5
  return parseFloat(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
}
function kgDoLancamento(l) {
  const total = _numBR(l.TOTAL_KG);
  if (!isNaN(total)) return total;
  const qtd  = _numBR(l.QUANTIDADE) || 0;
  const peso = _numBR(l.PESO_LIQUIDO)
    || _KG_PADRAO_UNIDADE[String(l.UNIDADE || "").toUpperCase().trim()]
    || 25;
  return qtd * peso;
}
