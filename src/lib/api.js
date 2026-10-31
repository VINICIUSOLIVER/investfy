/**
 * Ponte com o processo main (window.api, exposto pelo preload).
 * O main responde envelopes { ok, dados } | { ok: false, code, erro };
 * aqui convertemos em Promise que resolve `dados` ou rejeita ApiError.
 */
export class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

let unauthorizedHandler = null;

/** Registrado pelo AuthProvider: token rejeitado pela API → logout. */
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

function bridge() {
  if (!window.api) throw new ApiError('CONFIG', 'Aplicação deve ser executada dentro do Electron.');
  return window.api;
}

export async function unwrap(promise) {
  const res = await promise;
  if (res?.ok) return res.dados;
  const err = new ApiError(res?.code ?? 'UNKNOWN', res?.erro ?? 'Erro inesperado.');
  if (err.code === 'UNAUTHORIZED') unauthorizedHandler?.(err);
  throw err;
}

const call = (name) => (arg) => unwrap(bridge()[name](arg));

export const api = {
  carteira: call('carteira'),
  lancamentos: call('lancamentos'),
  evolucao: call('evolucao'),
  acompanhamento: call('acompanhamento'),
  cotacao: call('cotacao'),
  adicionar: call('adicionar'),
  excluir: call('excluir'),
  acompanhar: call('acompanhar'),
  alterarAlvo: call('alterarAlvo'),
  desacompanhar: call('desacompanhar'),
};

export const authApi = {
  status: () => bridge().auth.status(),
  login: (token) => bridge().auth.login(token),
  logout: () => bridge().auth.logout(),
};
