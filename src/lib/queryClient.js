import { QueryClient } from '@tanstack/react-query';

/** Erros "de negócio" não melhoram com nova tentativa. */
const NON_RETRYABLE = new Set(['UNAUTHORIZED', 'API', 'VALIDATION', 'DEPLOYMENT', 'CONFIG']);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => !NON_RETRYABLE.has(error?.code) && failureCount < 2,
      // Polling só com a janela visível (minimizada/oculta = pausa)
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});
