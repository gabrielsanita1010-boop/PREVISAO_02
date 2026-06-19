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
function jsonp(url) {
  return new Promise((res, rej) => {
    const cb = "__pf_" + (++_cbCount);
    const timer = setTimeout(() => {
      delete window[cb];
      document.getElementById(cb+"_s")?.remove();
      rej(new Error("Timeout na requisição"));
    }, 18000);

    window[cb] = (data) => {
      clearTimeout(timer);
      delete window[cb];
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
      delete window[cb]; sc.remove();
      rej(new Error("Falha ao carregar. Verifique a conexão."));
    };
    document.head.appendChild(sc);
  });
}
