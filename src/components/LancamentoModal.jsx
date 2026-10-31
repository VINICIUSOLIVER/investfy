import { useMemo, useState } from 'react';
import { useAdicionarLancamento, useCarteira } from '../hooks/queries';
import { money, num, parseDecimal, todayISO } from '../lib/format';
import { fullTicker, isValidTicker, normalizeTicker } from '../lib/ticker';
import { useToast } from '../providers/ToastProvider';
import { Button, Field, Input, Modal, Segmented } from './ui';

const TIPOS = [
  { value: 'C', label: 'Compra', selectedClass: 'text-emerald-600' },
  { value: 'V', label: 'Venda', selectedClass: 'text-rose-600' },
];

export function LancamentoModal({ open, onClose, prefill }) {
  const mutation = useAdicionarLancamento();
  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={mutation.isPending}
      title="Novo lançamento"
      description="Registre uma compra ou venda de ação."
    >
      <LancamentoForm prefill={prefill ?? {}} mutation={mutation} onClose={onClose} />
    </Modal>
  );
}

function validate(form, emCarteira) {
  const errors = {};
  const quantidade = parseDecimal(form.quantidade);
  const preco = parseDecimal(form.preco);
  const taxas = form.taxas.trim() === '' ? 0 : parseDecimal(form.taxas);

  if (!form.ticker.trim()) errors.ticker = 'Informe o código da ação.';
  else if (!isValidTicker(form.ticker)) errors.ticker = 'Use apenas letras, números, ".", "-" e ":".';

  if (!form.data) errors.data = 'Informe a data.';
  else if (form.data > todayISO()) errors.data = 'A data não pode ser futura.';

  if (!(quantidade > 0)) errors.quantidade = 'Quantidade deve ser maior que zero.';
  else if (form.tipo === 'V' && emCarteira != null && quantidade > emCarteira) {
    errors.quantidade = `Você tem ${num(emCarteira)} em carteira.`;
  }

  if (!(preco > 0)) errors.preco = 'Preço deve ser maior que zero.';
  if (!(taxas >= 0)) errors.taxas = 'Custos não podem ser negativos.';

  return { errors, values: { quantidade, preco, taxas } };
}

function quantidadeEmCarteira(posicoes, ticker) {
  if (!posicoes || !isValidTicker(ticker)) return null;
  const alvo = fullTicker(ticker);
  return posicoes.find((p) => p.ticker === alvo)?.quantidade ?? 0;
}

function LancamentoForm({ prefill, mutation, onClose }) {
  const toast = useToast();
  const carteiraQuery = useCarteira();
  const carteira = carteiraQuery.data;
  const [checking, setChecking] = useState(false);
  const [form, setForm] = useState({
    tipo: prefill.tipo ?? 'C',
    ticker: prefill.ticker ?? '',
    data: todayISO(),
    quantidade: '',
    preco: '',
    taxas: '0',
  });
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState(null);

  const set = (field) => (e) => {
    setServerError(null);
    setForm((f) => ({ ...f, [field]: e?.target ? e.target.value : e }));
  };

  // Quantidade em carteira para o ticker digitado (ajuda na venda)
  const emCarteira = useMemo(() => quantidadeEmCarteira(carteira, form.ticker), [carteira, form.ticker]);

  const { errors, values } = validate(form, emCarteira);
  const shown = touched ? errors : {};

  const bruto = (values.quantidade > 0 ? values.quantidade : 0) * (values.preco > 0 ? values.preco : 0);
  const custos = values.taxas >= 0 ? values.taxas : 0;
  const total = form.tipo === 'C' ? bruto + custos : Math.max(bruto - custos, 0);

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length) return;

    // Venda com a carteira ainda carregando: espera a posição antes de decidir,
    // senão a checagem "Você tem N em carteira" seria pulada.
    if (form.tipo === 'V' && !carteira) {
      setChecking(true);
      const { data } = await carteiraQuery.refetch();
      setChecking(false);
      if (Object.keys(validate(form, quantidadeEmCarteira(data, form.ticker)).errors).length) return;
    }

    try {
      await mutation.mutateAsync({
        tipo: form.tipo,
        ticker: normalizeTicker(form.ticker),
        data: form.data,
        quantidade: values.quantidade,
        preco: values.preco,
        taxas: values.taxas,
      });
      toast.success(`${form.tipo === 'C' ? 'Compra' : 'Venda'} de ${normalizeTicker(form.ticker)} registrada.`);
      onClose();
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Segmented options={TIPOS} value={form.tipo} onChange={set('tipo')} className="flex w-full" />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Ação" htmlFor="l-ticker" error={shown.ticker}>
          <Input
            id="l-ticker"
            data-autofocus
            placeholder="PETR4"
            autoComplete="off"
            value={form.ticker}
            onChange={(e) => set('ticker')(e.target.value.toUpperCase())}
            invalid={!!shown.ticker}
            maxLength={24}
          />
        </Field>
        <Field label="Data" htmlFor="l-data" error={shown.data}>
          <Input id="l-data" type="date" max={todayISO()} value={form.data} onChange={set('data')} invalid={!!shown.data} />
        </Field>

        <Field
          label="Quantidade"
          htmlFor="l-qtd"
          error={shown.quantidade}
          hint={form.tipo === 'V' && emCarteira != null ? `Em carteira: ${num(emCarteira)}` : null}
        >
          <Input
            id="l-qtd"
            inputMode="decimal"
            placeholder="100"
            value={form.quantidade}
            onChange={set('quantidade')}
            invalid={!!shown.quantidade}
          />
        </Field>
        <Field label="Preço unitário (R$)" htmlFor="l-preco" error={shown.preco}>
          <Input
            id="l-preco"
            inputMode="decimal"
            placeholder="0,00"
            value={form.preco}
            onChange={set('preco')}
            invalid={!!shown.preco}
          />
        </Field>
      </div>

      <Field label="Custos (corretagem, taxas) R$" htmlFor="l-taxas" error={shown.taxas}>
        <Input id="l-taxas" inputMode="decimal" placeholder="0,00" value={form.taxas} onChange={set('taxas')} invalid={!!shown.taxas} />
      </Field>

      <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3 text-sm">
        <span className="text-slate-600">Total da operação</span>
        <span className="font-semibold text-slate-900 tabular-nums">{money(total)}</span>
      </div>

      {serverError && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button type="submit" loading={mutation.isPending || checking}>
          {checking ? 'Verificando posição…' : mutation.isPending ? 'Salvando…' : 'Salvar lançamento'}
        </Button>
      </div>
    </form>
  );
}
