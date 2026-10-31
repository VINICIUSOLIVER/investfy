const { fetch, Agent } = require('undici');
const { app } = require('electron');

/**
 * Cliente da API Carteira (Google Apps Script).
 * - URL base fixa: https://script.google.com/macros/s/{deploymentId}/exec
 * - Sem timeout: a API pode demorar (cotações 2–8 s ou mais) e esperamos até o fim.
 * - O Apps Script sempre responde 200; o sucesso vem em `ok`.
 * - Responde com 302 → script.googleusercontent.com; fetch segue o redirect.
 */
const dispatcher = new Agent({
  headersTimeout: 0,
  bodyTimeout: 0,
  connect: { timeout: 30_000 }, // só a abertura de conexão (DNS/TLS) tem limite
});

class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const DEPLOYMENT_RE = /^[A-Za-z0-9_-]{10,200}$/;

/**
 * Aceita o código puro ou a URL completa colada pelo usuário
 * (inclusive o formato de Workspace: /a/macros/<domínio>/s/<código>/exec).
 */
function parseDeploymentId(input) {
  const raw = typeof input === 'string' ? input.trim() : '';
  const fromUrl = raw.match(/\/macros\/(?:[^/]+\/)*s\/([A-Za-z0-9_-]+)/);
  const id = fromUrl ? fromUrl[1] : raw;
  if (!DEPLOYMENT_RE.test(id)) {
    throw new ApiError('DEPLOYMENT', 'Código de implantação inválido.');
  }
  return id;
}

function baseUrl(deploymentId) {
  return new URL(`https://script.google.com/macros/s/${encodeURIComponent(deploymentId)}/exec`);
}

async function parse(res) {
  if (res.status === 404) {
    throw new ApiError('DEPLOYMENT', 'Implantação não encontrada. Confira o código de implantação.');
  }
  let json;
  try {
    json = await res.json();
  } catch {
    // Apps Script devolve HTML quando a implantação não existe ou não é pública
    throw new ApiError(
      'DEPLOYMENT',
      'A API não respondeu como esperado. Confira o código de implantação e se ela está publicada com acesso para "Qualquer pessoa".',
    );
  }
  if (!json || json.ok !== true) {
    const erro = (json && typeof json.erro === 'string' && json.erro) || 'Erro desconhecido na API.';
    throw new ApiError(erro === 'não autorizado' ? 'UNAUTHORIZED' : 'API', erro);
  }
  return json.dados;
}

// Log de diagnóstico no terminal (só fora do app empacotado). Nunca inclui o token.
const DEBUG = !app.isPackaged || process.env.INVESTFY_DEBUG === '1';
function debug(label, started, outcome) {
  if (!DEBUG) return;
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[api] ${label} → ${outcome} (${secs}s)`);
}

async function request(label, url, init) {
  const started = Date.now();
  if (DEBUG) console.log(`[api] ${label} …`);
  let res;
  try {
    res = await fetch(url, { ...init, dispatcher, redirect: 'follow' });
  } catch (err) {
    debug(label, started, `falha de rede: ${err?.cause?.code || err?.message}`);
    throw new ApiError('NETWORK', 'Falha de conexão com a API. Verifique sua internet e tente novamente.');
  }
  try {
    const dados = await parse(res);
    const resumo = Array.isArray(dados)
      ? `${dados.length} itens`
      : dados && typeof dados === 'object'
        ? `campos: ${Object.keys(dados).join(', ')}`
        : typeof dados;
    debug(label, started, `HTTP ${res.status} ok · ${resumo}`);
    return dados;
  } catch (err) {
    debug(label, started, `HTTP ${res.status} ${err.code}: ${err.message}`);
    throw err;
  }
}

/** session = { deploymentId, token } */
function get(session, acao, params = {}) {
  const url = baseUrl(session.deploymentId);
  url.searchParams.set('token', session.token);
  url.searchParams.set('acao', acao);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const extra = Object.values(params).join(' ');
  return request(`GET ${acao}${extra ? ` ${extra}` : ''}`, url);
}

function post(session, acao, body) {
  return request(`POST ${acao}`, baseUrl(session.deploymentId), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, token: session.token, acao }),
  });
}

module.exports = { get, post, parseDeploymentId, ApiError };
