import { createContext, useContext } from 'react';

/** Ações globais do app: navegação e modais compartilhadas. */
export const ShellContext = createContext(null);

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell deve ser usado dentro de <AppShell>');
  return ctx;
}
