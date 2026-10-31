import { useEffect } from 'react';
import { useToast } from '../providers/ToastProvider';

/** Avisa quando o processo main baixou uma versão nova e vai reiniciar o app. */
export function UpdateNotifier() {
  const toast = useToast();

  useEffect(() => {
    const onStatus = window.api?.updates?.onStatus;
    if (!onStatus) return undefined;
    return onStatus(({ state, version, inMs }) => {
      if (state === 'downloading') toast.success(`Baixando a versão ${version} do Investfy…`);
      if (state === 'restarting') {
        const s = Math.round((inMs ?? 0) / 1000);
        toast.success(`Versão ${version} pronta. O Investfy vai reiniciar em ${s} segundos para atualizar.`);
      }
    });
  }, [toast]);

  return null;
}
