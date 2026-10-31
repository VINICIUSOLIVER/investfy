const { ipcMain } = require('electron');
const api = require('./api-client');
const sessionStore = require('./session-store');

/* ---------------------------------------------------------------------------
 * Validação de entrada: tudo que vem do renderer é tratado como não confiável.
 * ------------------------------------------------------------------------- */
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.code = 'VALIDATION';
  }
}

const TICKER_RE = /^[A-Z0-9.:-]{1,24}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[A-Za-z0-9-]{1,64}$/;

function ticker(value) {
  const v = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!v) throw new ValidationError('ticker obrigatório');
  if (!TICKER_RE.test(v)) throw new ValidationError('ticker inválido');
  return v;
}

function positive(value, message) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new ValidationError(message);
  return n;
}

function date(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
    throw new ValidationError('data deve estar no formato AAAA-MM-DD');
  }
  return value;
}

function id(value) {
  if (typeof value !== 'string' || !ID_RE.test(value)) throw new ValidationError('lançamento não encontrado');
  return value;
}

function token(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  // eslint-disable-next-line no-control-regex
  if (!v || v.length > 512 || /[\s\x00-\x1f]/.test(v)) throw new ValidationError('Token inválido.');
  return v;
}

function lancamento(input) {
  const body = input && typeof input === 'object' ? input : {};
  if (body.tipo !== 'C' && body.tipo !== 'V') throw new ValidationError('tipo deve ser C ou V');
  const taxas = body.taxas === undefined || body.taxas === '' ? 0 : Number(body.taxas);
  if (!Number.isFinite(taxas) || taxas < 0) throw new ValidationError('taxas não podem ser negativas');
  return {
    data: date(body.data),
    ticker: ticker(body.ticker),
    tipo: body.tipo,
    quantidade: positive(body.quantidade, 'quantidade deve ser maior que zero'),
    preco: positive(body.preco, 'preço deve ser maior que zero'),
    taxas,
  };
}

function alvo(input) {
  const body = input && typeof input === 'object' ? input : {};
  return {
    ticker: ticker(body.ticker),
    precoAlvo: positive(body.precoAlvo, 'preço alvo deve ser maior que zero'),
  };
}

/* ---------------------------------------------------------------------------
 * Registro dos handlers
 * ------------------------------------------------------------------------- */
async function requireSession() {
  const s = await sessionStore.get();
  if (!s) throw new api.ApiError('UNAUTHORIZED', 'Sessão expirada. Informe o token novamente.');
  return s;
}

/** Só aceita chamadas vindas da página do próprio app. */
function makeSenderCheck(isTrustedUrl) {
  return (event) => {
    const url = event.senderFrame?.url;
    if (!url || !isTrustedUrl(url)) throw new Error('IPC bloqueado: origem não confiável');
  };
}

/**
 * Envelope serializável: erros lançados em ipcMain.handle perdem as
 * propriedades customizadas, então devolvemos { ok, dados | code, erro }.
 */
function handle(channel, assertSender, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    assertSender(event);
    try {
      return { ok: true, dados: await fn(...args) };
    } catch (err) {
      const code = err?.code || 'UNKNOWN';
      // Token revogado/alterado no servidor: descarta o token salvo
      if (code === 'UNAUTHORIZED' && channel !== 'auth:login') await sessionStore.clearToken();
      return { ok: false, code, erro: err?.message || 'Erro inesperado.' };
    }
  });
}

function registerIpc({ isTrustedUrl }) {
  const check = makeSenderCheck(isTrustedUrl);

  // Autenticação
  // O código de implantação volta ao renderer só para pré-preencher o login
  handle('auth:status', check, async () => {
    const s = await sessionStore.read();
    return { authenticated: Boolean(s.deploymentId && s.token), deploymentId: s.deploymentId };
  });
  handle('auth:login', check, async (input) => {
    const session = {
      deploymentId: api.parseDeploymentId(input?.deploymentId),
      token: token(input?.token),
    };
    await api.get(session, 'lancamentos'); // valida código + token na API antes de salvar
    await sessionStore.save(session.deploymentId, session.token);
    return { authenticated: true, deploymentId: session.deploymentId };
  });
  handle('auth:logout', check, async () => {
    await sessionStore.clearToken();
    return { authenticated: false };
  });

  // Leitura
  handle('api:carteira', check, async () => api.get(await requireSession(), 'carteira'));
  handle('api:lancamentos', check, async () => api.get(await requireSession(), 'lancamentos'));
  handle('api:acompanhamento', check, async () => api.get(await requireSession(), 'acompanhamento'));
  handle('api:cotacao', check, async (t) => api.get(await requireSession(), 'cotacao', { ticker: ticker(t) }));
  handle('api:evolucao', check, async (dias) => {
    const d = Number(dias ?? 90);
    if (!Number.isInteger(d) || d < 1 || d > 3650) throw new ValidationError('dias deve estar entre 1 e 3650');
    return api.get(await requireSession(), 'evolucao', { dias: d });
  });

  // Escrita
  handle('api:adicionar', check, async (body) => api.post(await requireSession(), 'adicionar', lancamento(body)));
  handle('api:excluir', check, async (value) => api.post(await requireSession(), 'excluir', { id: id(value) }));
  handle('api:acompanhar', check, async (body) => api.post(await requireSession(), 'acompanhar', alvo(body)));
  handle('api:alterarAlvo', check, async (body) => api.post(await requireSession(), 'alterarAlvo', alvo(body)));
  handle('api:desacompanhar', check, async (t) => api.post(await requireSession(), 'desacompanhar', { ticker: ticker(t) }));
}

module.exports = { registerIpc };
