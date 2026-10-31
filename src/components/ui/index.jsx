import { useEffect, useRef } from 'react';
import { CircleAlert, LoaderCircle, RotateCw, X } from 'lucide-react';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

/* ------------------------------------------------------------------ Button */
const BUTTON_VARIANTS = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  ghost: 'text-slate-700 hover:bg-slate-100 disabled:text-slate-400',
  outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400',
};

export function Button({ variant = 'primary', loading = false, icon: Icon, className, children, disabled, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium whitespace-nowrap transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed',
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : Icon && <Icon className="size-4" />}
      {children}
    </button>
  );
}

export function IconButton({ label, icon: Icon, className, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700',
        'focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <Icon className="size-4" />
    </button>
  );
}

/* -------------------------------------------------------------------- Card */
export function Card({ className, children, ...props }) {
  return (
    <div className={cx('rounded-2xl border border-slate-200 bg-white shadow-sm', className)} {...props}>
      {children}
    </div>
  );
}

export function Kpi({ label, value, hint, hintClass = 'text-slate-500', loading, onClick, active }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? Boolean(active) : undefined}
      className={cx(
        'rounded-2xl border bg-white p-5 text-left shadow-sm transition-colors',
        active ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200',
        onClick && 'hover:border-blue-300 focus-visible:outline-2 focus-visible:outline-blue-500',
      )}
    >
      <p className="text-sm text-slate-500">{label}</p>
      {loading ? (
        <>
          <Skeleton className="mt-3 h-7 w-36" />
          <Skeleton className="mt-2 h-4 w-20" />
        </>
      ) : (
        <>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
          {hint && <p className={cx('mt-1 text-sm tabular-nums', hintClass)}>{hint}</p>}
        </>
      )}
    </Tag>
  );
}

/* ------------------------------------------------------------- Feedback */
export function Skeleton({ className }) {
  return <span className={cx('block animate-pulse rounded-md bg-slate-200/70', className)} />;
}

const BADGE_TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function Badge({ tone = 'slate', className, children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Badge de variação: verde se ≥ 0, vermelho se < 0, cinza se nulo. */
export function ChangeBadge({ value, children }) {
  const tone = value == null ? 'slate' : value > 0 ? 'green' : value < 0 ? 'red' : 'slate';
  return <Badge tone={tone}>{children}</Badge>;
}

export function ErrorState({ error, onRetry, className }) {
  return (
    <div className={cx('flex flex-col items-center gap-3 px-6 py-10 text-center', className)}>
      <CircleAlert className="size-6 text-rose-500" />
      <p className="max-w-md text-sm text-slate-600">{error?.message || 'Não foi possível carregar os dados.'}</p>
      {onRetry && (
        <Button variant="outline" icon={RotateCw} onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, className }) {
  return (
    <div className={cx('flex flex-col items-center gap-2 px-6 py-12 text-center', className)}>
      {Icon && <Icon className="size-6 text-slate-400" />}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {children && <p className="max-w-sm text-sm text-slate-500">{children}</p>}
    </div>
  );
}

export function Spinner({ className }) {
  return <LoaderCircle className={cx('size-4 animate-spin text-slate-400', className)} />;
}

/* ------------------------------------------------------------------ Forms */
export function Field({ label, htmlFor, error, hint, children, className }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-rose-600">{error}</p>
      ) : (
        hint && <p className="text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

export function Input({ className, invalid, icon: Icon, ...props }) {
  const input = (
    <input
      aria-invalid={invalid || undefined}
      className={cx(
        'h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400',
        'focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:bg-slate-50',
        invalid ? 'border-rose-400' : 'border-slate-200',
        Icon && 'pl-9',
        className,
      )}
      {...props}
    />
  );
  if (!Icon) return input;
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
      {input}
    </div>
  );
}

/** Controle segmentado (abas pequenas). */
export function Segmented({ options, value, onChange, className, size = 'md' }) {
  return (
    <div role="tablist" className={cx('inline-flex rounded-lg bg-slate-100 p-1', className)}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.value)}
            className={cx(
              'flex-1 rounded-md font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-blue-500',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              selected ? cx('bg-white shadow-sm', opt.selectedClass ?? 'text-slate-900') : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Modal */
/**
 * Usa <dialog> nativo: foco preso, Esc e camada superior de graça.
 * O conteúdo só é montado quando aberto (formulários começam limpos).
 * Elemento com [data-autofocus] recebe o foco ao abrir.
 */
export function Modal({ open, onClose, title, description, children, width = 'max-w-lg', busy = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector('[data-autofocus]')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const requestClose = () => {
    if (!busy) onClose();
  };

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) requestClose(); // clique no backdrop
      }}
      className={cx(
        'm-auto w-full rounded-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-[1px]',
        width,
      )}
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
            <IconButton label="Fechar" icon={X} onClick={requestClose} disabled={busy} className="-mt-1 -mr-2" />
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Excluir', onConfirm, onCancel, loading }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} busy={loading} width="max-w-md">
      <div className="text-sm text-slate-600">{message}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading} data-autofocus>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- Layout */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
