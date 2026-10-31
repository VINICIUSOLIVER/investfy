import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, ListChecks, LogOut, Search, Wallet } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { cx } from '../ui';
import { Logo } from './Logo';
import { ShellContext } from './shell-context';
import { ErrorBoundary } from '../ErrorBoundary';
import { CarteiraPage } from '../../pages/CarteiraPage';
import { LancamentosPage } from '../../pages/LancamentosPage';
import { MonitoramentoPage } from '../../pages/MonitoramentoPage';
import { LancamentoModal } from '../LancamentoModal';
import { SearchModal } from '../SearchModal';

const PAGES = [
  { id: 'carteira', label: 'Carteira', icon: Wallet, Component: CarteiraPage },
  { id: 'lancamentos', label: 'Lançamentos', icon: ListChecks, Component: LancamentosPage },
  { id: 'monitoramento', label: 'Monitoramento', icon: Eye, Component: MonitoramentoPage },
];

export function AppShell() {
  const { logout } = useAuth();
  const [page, setPage] = useState('carteira');
  const [lancamento, setLancamento] = useState(null); // null = fechado; objeto = prefill
  const [search, setSearch] = useState(null); // null = fechado; string = ticker inicial

  const openLancamento = useCallback((prefill = {}) => {
    setSearch(null);
    setLancamento(prefill);
  }, []);
  const openSearch = useCallback((ticker = '') => setSearch(ticker), []);

  // Atalho: Ctrl/⌘ + K abre a busca
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearch((s) => s ?? '');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const shell = useMemo(() => ({ navigate: setPage, openLancamento, openSearch }), [openLancamento, openSearch]);
  const { Component } = PAGES.find((p) => p.id === page);

  return (
    <ShellContext.Provider value={shell}>
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
            <Logo />
            <nav className="flex items-center gap-1" aria-label="Principal">
              {PAGES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPage(id)}
                  aria-current={page === id ? 'page' : undefined}
                  className={cx(
                    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-blue-500',
                    page === id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                onClick={() => openSearch('')}
                aria-keyshortcuts="Control+K"
                className="flex h-9 w-56 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-400 transition-colors hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-blue-500"
              >
                <Search className="size-4" />
                <span className="flex-1 text-left">Buscar ação</span>
                <kbd className="rounded border border-slate-200 px-1.5 text-[10px] font-medium text-slate-400">Ctrl K</kbd>
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-500"
              >
                <LogOut className="size-4" />
                Sair
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-8">
          <ErrorBoundary key={page}>
            <Component />
          </ErrorBoundary>
        </main>
      </div>

      <LancamentoModal open={lancamento !== null} prefill={lancamento} onClose={() => setLancamento(null)} />
      <SearchModal open={search !== null} initialTicker={search ?? ''} onClose={() => setSearch(null)} />
    </ShellContext.Provider>
  );
}
