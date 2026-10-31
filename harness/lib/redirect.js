/**
 * Redireciona a URL fixa do Apps Script para o mock, sem tocar no código do app.
 *
 * electron/api-client.js faz `const { fetch } = require('undici')` no momento em que
 * é carregado; por isso este patch PRECISA rodar antes de `require('electron/main.js')`.
 * O mesmo arquivo de undici é resolvido nos dois lados (node_modules do projeto),
 * então ambos enxergam o mesmo objeto de módulo.
 */
const path = require('node:path');

const undici = require(path.join(__dirname, '..', '..', 'node_modules', 'undici'));
const GOOGLE = /^https:\/\/script\.google\.com(\/macros\/s\/[^/]+\/exec)/;

/** @param {string | (() => string | null)} mockUrl  URL do mock, ou getter (resolvido a cada chamada) */
function redirectApiTo(mockUrl) {
  const resolve = typeof mockUrl === 'function' ? mockUrl : () => mockUrl;
  const realFetch = undici.fetch;
  undici.fetch = (input, init) => {
    const href = String(input instanceof URL ? input.href : input);
    const m = href.match(GOOGLE);
    if (!m) return realFetch(input, init);
    const base = resolve();
    if (!base) return Promise.reject(new Error('[harness] mock ainda não está pronto'));
    const target = new URL(m[1] + href.slice(m[0].length), base);
    // O dispatcher do app desliga timeouts; serve igual para HTTP local
    return realFetch(target, init);
  };
}

module.exports = { redirectApiTo };
