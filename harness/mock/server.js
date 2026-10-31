/**
 * Mock da API Carteira (examples/api-carteira.md) em HTTP puro.
 *
 * Reproduz o comportamento do Apps Script que importa para o app:
 * - rota escolhida por `acao`, token na query (GET) ou no corpo (POST)
 * - sempre HTTP 200 com { ok, dados | erro }; 404 HTML para implantação inexistente
 * - POST responde 302 → /echo/<id> (como o redirect para googleusercontent)
 * - cotação null na `carteira` logo após uma escrita
 *
 * Tickers especiais na rota `cotacao`:
 *   VAZIO3 → { ok: true } sem `dados`   ·   LENTO3 → demora 10 s   ·   desconhecido → "não encontrada"
 */
const http = require('node:http');
const crypto = require('node:crypto');
const { createState } = require('./fixtures');

const DEPLOYMENT_ID = 'AKfycbHarnessDeployment0001';
const TOKEN = 'harness-token';

const LATENCIES = {
  fast: { get: 60, cotacao: 500, acompanhar: 400, post: 120 },
  real: { get: 1500, cotacao: 4000, acompanhar: 3000, post: 2000 },
};

const norm = (t) => {
  const v = String(t ?? '').trim().toUpperCase();
  return v.includes(':') ? v : `BVMF:${v}`;
};

class ApiErro extends Error {}

/* ------------------------------------------------------------- regras */
function calcularCarteira(state) {
  const map = new Map();
  const ordenados = [...state.lancamentos].sort((a, b) => a.data.localeCompare(b.data));
  for (const l of ordenados) {
    const p = map.get(l.ticker) || { ticker: l.ticker, quantidade: 0, precoMedio: 0, lucroRealizado: 0 };
    if (l.tipo === 'C') {
      p.precoMedio = (p.quantidade * p.precoMedio + l.quantidade * l.preco + l.taxas) / (p.quantidade + l.quantidade);
      p.quantidade += l.quantidade;
    } else {
      if (l.quantidade > p.quantidade) throw new ApiErro(`venda maior que a quantidade em carteira de ${l.ticker}`);
      p.lucroRealizado += l.quantidade * l.preco - l.taxas - l.quantidade * p.precoMedio;
      p.quantidade -= l.quantidade;
      if (p.quantidade === 0) p.precoMedio = 0;
    }
    map.set(l.ticker, p);
  }
  return [...map.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
}

function carteira(state) {
  return calcularCarteira(state).map((p) => {
    const pendente = state.cotacaoPendente.has(p.ticker);
    const [precoAtual, variacaoDia] = pendente ? [null, null] : state.precos[p.ticker] || [null, null];
    const totalInvestido = p.quantidade * p.precoMedio;
    const valorAtual = precoAtual == null ? null : p.quantidade * precoAtual;
    return {
      ...p,
      totalInvestido,
      precoAtual,
      valorAtual,
      variacaoDia,
      rentabilidade: valorAtual == null ? null : valorAtual - totalInvestido,
      rentabilidadePct: valorAtual == null || !totalInvestido ? null : valorAtual / totalInvestido - 1,
    };
  });
}

function evolucao(dias) {
  const out = [];
  const hoje = new Date();
  hoje.setUTCHours(12, 0, 0, 0);
  for (let i = dias; i >= 1; i--) {
    const d = new Date(hoje.getTime() - i * 864e5);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const n = out.length;
    out.push({
      data: d.toISOString().slice(0, 10),
      patrimonio: 6400 + n * 14 + Math.sin(n / 3) * 90 + Math.sin(n / 7) * 140,
      valorInvestido: n < 30 ? 9000 : 10009.13,
      lucroRealizado: 419.2,
    });
  }
  return out;
}

function serie(base, seed) {
  const pts = [];
  for (let m = 0, k = 0; m <= 120; m += 5, k++) {
    const h = 10 + Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, '0');
    const preco = base * (1 + Math.sin((k + seed) / 2.5) * 0.006 + (k - 12) * 0.0004);
    pts.push({ momento: `2026-10-30T${h}:${mm}:00-03:00`, preco: Number(preco.toFixed(2)) });
  }
  return pts;
}

function cotacao(state, t) {
  const ticker = norm(t);
  if (ticker === 'BVMF:VAZIO3') return undefined;
  const [precoAtual, variacaoPct, moeda] = state.precos[ticker] || [];
  if (precoAtual == null) throw new ApiErro(`ação ${ticker} não encontrada`);
  const anterior = precoAtual / (1 + variacaoPct);
  return {
    ticker,
    nome: state.nomes[ticker] ?? null,
    precoAtual,
    variacao: precoAtual - anterior,
    variacaoPct,
    abertura: anterior * 1.002,
    maxDia: precoAtual * 1.01,
    minDia: precoAtual * 0.98,
    fechamentoAnterior: anterior,
    volume: 32_450_100,
    max52: precoAtual * 1.3,
    min52: precoAtual * 0.8,
    valorMercado: moeda === 'USD' ? 3.4e12 : null,
    pl: moeda === 'USD' ? 34.7 : null,
    lpa: moeda === 'USD' ? 6.56 : null,
    moeda,
    ultimaNegociacao: '2026-10-30T17:55:00-03:00',
    posicao: carteira(state).find((p) => p.ticker === ticker) ?? null,
  };
}

function listaAcompanhamento(state) {
  return state.acompanhamento.map((w, i) => {
    const [precoAtual, variacaoPct] = state.precos[w.ticker] || [null, null];
    return {
      ...w,
      nome: state.nomes[w.ticker] ?? null,
      precoAtual,
      variacao: precoAtual == null ? null : precoAtual - precoAtual / (1 + variacaoPct),
      variacaoPct,
      abertura: null,
      maxDia: null,
      minDia: null,
      max52: null,
      min52: null,
      volume: null,
      distanciaAlvoPct: precoAtual ? w.precoAlvo / precoAtual - 1 : null,
      serie: w.ticker === 'BVMF:BBDC3' || precoAtual == null ? [] : serie(precoAtual, i * 3),
    };
  });
}

/* ---------------------------------------------------------------- rotas */
const GET = {
  carteira: (state) => {
    const dados = carteira(state);
    state.cotacaoPendente.clear(); // só a primeira leitura após a escrita vem sem cotação
    return dados;
  },
  lancamentos: (state) => [...state.lancamentos].sort((a, b) => b.data.localeCompare(a.data)),
  evolucao: (_s, q) => evolucao(Math.min(Math.max(Number(q.get('dias') || 90), 1), 3650)),
  cotacao: (state, q) => cotacao(state, q.get('ticker')),
  acompanhamento: (state) => listaAcompanhamento(state),
};

function escrever(state, mutate) {
  const backup = state.lancamentos;
  state.lancamentos = mutate([...backup]);
  try {
    calcularCarteira(state); // valida a linha do tempo (venda a descoberto)
  } catch (e) {
    state.lancamentos = backup;
    throw e;
  }
}

const POST = {
  adicionar: (state, b) => {
    const l = {
      id: crypto.randomUUID(),
      data: b.data,
      ticker: norm(b.ticker),
      tipo: b.tipo,
      quantidade: b.quantidade,
      preco: b.preco,
      taxas: b.taxas || 0,
    };
    escrever(state, (list) => [...list, l]);
    state.cotacaoPendente.add(l.ticker);
    return { id: l.id };
  },
  excluir: (state, b) => {
    const alvo = state.lancamentos.find((l) => l.id === b.id);
    if (!alvo) throw new ApiErro('lançamento não encontrado');
    escrever(state, (list) => list.filter((l) => l.id !== b.id));
    state.cotacaoPendente.add(alvo.ticker);
    return { id: b.id };
  },
  acompanhar: (state, b) => {
    const t = norm(b.ticker);
    if (!(b.precoAlvo > 0)) throw new ApiErro('preço alvo deve ser maior que zero');
    if (!state.precos[t]) throw new ApiErro(`ação ${t} não encontrada`);
    if (state.acompanhamento.some((w) => w.ticker === t)) throw new ApiErro(`${t} já está em acompanhamento`);
    state.acompanhamento.push({ ticker: t, adicionadoEm: new Date().toISOString().slice(0, 10), precoAlvo: b.precoAlvo });
    return { ticker: t };
  },
  alterarAlvo: (state, b) => {
    const w = state.acompanhamento.find((x) => x.ticker === norm(b.ticker));
    if (!w) throw new ApiErro(`${norm(b.ticker)} não está em acompanhamento`);
    if (!(b.precoAlvo > 0)) throw new ApiErro('preço alvo deve ser maior que zero');
    w.precoAlvo = b.precoAlvo;
    return { ticker: w.ticker };
  },
  desacompanhar: (state, b) => {
    const t = norm(b.ticker);
    if (!state.acompanhamento.some((w) => w.ticker === t)) throw new ApiErro(`${t} não está em acompanhamento`);
    state.acompanhamento = state.acompanhamento.filter((w) => w.ticker !== t);
    return { ticker: t };
  },
};

/* --------------------------------------------------------------- servidor */
/**
 * @param {{ latency?: 'fast'|'real', port?: number }} options
 * @returns {Promise<{ url, deploymentId, token, state, requests, count, close }>}
 */
function createMockServer({ latency = process.env.HARNESS_LATENCY || 'fast', port = 0 } = {}) {
  const delays = LATENCIES[latency] || LATENCIES.fast;
  const state = createState();
  const requests = []; // { method, acao, params, at } — para asserções nos flows
  const pending = new Map();

  const send = (res, status, body, type = 'application/json') => {
    res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8` });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  };
  const run = (fn) => {
    try {
      return { ok: true, dados: fn() };
    } catch (e) {
      if (e instanceof ApiErro) return { ok: false, erro: e.message };
      throw e;
    }
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://mock');

    const echo = url.pathname.match(/^\/echo\/([\w-]+)$/);
    if (echo) {
      const body = pending.get(echo[1]);
      pending.delete(echo[1]);
      return send(res, body ? 200 : 404, body ?? { ok: false, erro: 'expirado' });
    }

    const route = url.pathname.match(/^\/macros\/s\/([^/]+)\/exec$/);
    if (!route || route[1] !== DEPLOYMENT_ID) {
      return send(res, 404, '<html><body>Página não encontrada</body></html>', 'text/html');
    }

    if (req.method === 'GET') {
      const acao = url.searchParams.get('acao');
      const params = Object.fromEntries([...url.searchParams].filter(([k]) => k !== 'token'));
      requests.push({ method: 'GET', acao, params, at: Date.now() });
      if (url.searchParams.get('token') !== TOKEN) return send(res, 200, { ok: false, erro: 'não autorizado' });
      const handler = GET[acao];
      const ticker = norm(url.searchParams.get('ticker'));
      const delay = acao === 'cotacao' ? (ticker === 'BVMF:LENTO3' ? 10_000 : delays.cotacao) : delays.get;
      return setTimeout(
        () => send(res, 200, handler ? run(() => handler(state, url.searchParams)) : { ok: false, erro: 'ação inválida' }),
        delay,
      );
    }

    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      let body = {};
      try {
        body = JSON.parse(raw || '{}');
      } catch {
        /* corpo inválido → trata como vazio */
      }
      const { token, acao, ...params } = body;
      requests.push({ method: 'POST', acao, params, at: Date.now() });
      const handler = POST[acao];
      const result =
        token !== TOKEN
          ? { ok: false, erro: 'não autorizado' }
          : handler
            ? run(() => handler(state, params))
            : { ok: false, erro: 'ação inválida' };
      const key = crypto.randomUUID();
      pending.set(key, result);
      setTimeout(() => {
        res.writeHead(302, { Location: `/echo/${key}` });
        res.end();
      }, acao === 'acompanhar' ? delays.acompanhar : delays.post);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        deploymentId: DEPLOYMENT_ID,
        token: TOKEN,
        state,
        requests,
        /** Quantas requisições `acao` (opcionalmente só depois de `since`, um timestamp). */
        count: (acao, since = 0) => requests.filter((r) => r.acao === acao && r.at >= since).length,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

module.exports = { createMockServer, DEPLOYMENT_ID, TOKEN };

// Execução direta: `node harness/mock/server.js` (útil para inspecionar com curl)
if (require.main === module) {
  createMockServer({ port: Number(process.env.PORT) || 8787 }).then((m) => {
    console.log(`[mock] ${m.url}/macros/s/${m.deploymentId}/exec  token=${m.token}`);
  });
}
