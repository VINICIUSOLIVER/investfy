import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '../lib/api';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const REFRESH = {
  carteira: MINUTE, // 1 em 1 minuto
  evolucao: 5 * HOUR, // 5h em 5h — não é invalidado por lançamentos
  acompanhamento: 5 * MINUTE, // 5 em 5 minutos
};

export const keys = {
  carteira: ['carteira'],
  lancamentos: ['lancamentos'],
  evolucao: (dias) => ['evolucao', dias],
  acompanhamento: ['acompanhamento'],
  cotacao: (ticker) => ['cotacao', ticker],
};

/* ---------------------------------------------------------------------------
 * Carteira
 * Logo após uma escrita a planilha recalcula e `precoAtual` pode vir null por
 * alguns segundos. Nesse caso tentamos de novo a cada 3 s (máx. 3 vezes)
 * antes de voltar ao ciclo normal de 1 minuto.
 * ------------------------------------------------------------------------- */
const QUOTE_RETRY_MS = 3_000;
const QUOTE_MAX_RETRIES = 3;
let pendingQuoteStreak = 0;

const hasPendingQuotes = (posicoes) =>
  Array.isArray(posicoes) && posicoes.some((p) => p.quantidade > 0 && p.precoAtual == null);

export function useCarteira() {
  return useQuery({
    queryKey: keys.carteira,
    queryFn: async () => {
      const dados = await api.carteira();
      pendingQuoteStreak = hasPendingQuotes(dados) ? pendingQuoteStreak + 1 : 0;
      return dados;
    },
    staleTime: REFRESH.carteira,
    refetchInterval: () =>
      pendingQuoteStreak > 0 && pendingQuoteStreak <= QUOTE_MAX_RETRIES ? QUOTE_RETRY_MS : REFRESH.carteira,
  });
}

export function useLancamentos() {
  return useQuery({
    queryKey: keys.lancamentos,
    queryFn: () => api.lancamentos(),
    staleTime: REFRESH.carteira,
    refetchInterval: REFRESH.carteira,
  });
}

export function useEvolucao(dias = 90) {
  return useQuery({
    queryKey: keys.evolucao(dias),
    queryFn: () => api.evolucao(dias),
    staleTime: REFRESH.evolucao,
    refetchInterval: REFRESH.evolucao,
    refetchOnWindowFocus: false,
    // Mantém o cache mesmo fora da tela, senão o GC (5 min) quebraria a janela de 5h
    gcTime: Infinity,
  });
}

export function useAcompanhamento() {
  return useQuery({
    queryKey: keys.acompanhamento,
    queryFn: () => api.acompanhamento(),
    staleTime: REFRESH.acompanhamento,
    refetchInterval: REFRESH.acompanhamento,
  });
}

export function useCotacao(ticker) {
  return useQuery({
    queryKey: keys.cotacao(ticker),
    queryFn: async () => {
      const dados = await api.cotacao(ticker);
      // ok:true sem dados (null/undefined) não pode virar tela vazia nem erro técnico
      if (!dados || typeof dados !== 'object') {
        throw new ApiError('API', `A API respondeu sem dados para ${ticker}. Tente novamente em instantes.`);
      }
      return dados;
    },
    enabled: Boolean(ticker),
    staleTime: MINUTE,
    retry: false, // rota lenta e serializada no servidor: não empilhar tentativas
  });
}

/* ---------------------------------------------------------------------------
 * Mutações
 * ------------------------------------------------------------------------- */

/**
 * Após compra/venda: limpa o cache da carteira, lançamentos e cotações
 * (que trazem a `posicao`) e força nova consulta. Evolução fica de fora.
 */
function useResetCarteira() {
  const qc = useQueryClient();
  return () => {
    pendingQuoteStreak = 0;
    return Promise.all([
      qc.resetQueries({ queryKey: keys.carteira }),
      qc.resetQueries({ queryKey: keys.lancamentos }),
      qc.resetQueries({ queryKey: ['cotacao'] }),
    ]);
  };
}

export function useAdicionarLancamento() {
  const reset = useResetCarteira();
  return useMutation({ mutationFn: (body) => api.adicionar(body), onSuccess: reset });
}

export function useExcluirLancamento() {
  const reset = useResetCarteira();
  return useMutation({ mutationFn: (id) => api.excluir(id), onSuccess: reset });
}

function useAcompanhamentoMutation(fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.acompanhamento }),
  });
}

export const useAcompanhar = () => useAcompanhamentoMutation((body) => api.acompanhar(body));
export const useAlterarAlvo = () => useAcompanhamentoMutation((body) => api.alterarAlvo(body));
export const useDesacompanhar = () => useAcompanhamentoMutation((ticker) => api.desacompanhar(ticker));
