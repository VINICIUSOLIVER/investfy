import { Component } from 'react';
import { CircleAlert } from 'lucide-react';

/**
 * Sem boundary, um erro de renderização desmonta o app inteiro (tela vazia).
 * Aqui o erro vira uma mensagem visível e fica registrado no console.
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ui] erro de renderização:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <CircleAlert className="size-6 text-rose-500" />
        <p className="text-sm font-medium text-slate-700">Algo deu errado ao exibir esta tela.</p>
        <p className="max-w-md text-xs break-words text-slate-500">{String(error?.message || error)}</p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Tentar novamente
        </button>
      </div>
    );
  }
}
