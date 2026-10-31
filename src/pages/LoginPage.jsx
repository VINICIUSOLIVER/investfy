import { useState } from 'react';
import { Eye, EyeOff, KeyRound, Link2 } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { Button, Card, Field, Input } from '../components/ui';
import { Logo } from '../components/layout/Logo';

/** Em qual campo exibir o erro devolvido pelo main. */
function errorField(code) {
  if (code === 'DEPLOYMENT') return 'deployment';
  if (code === 'UNAUTHORIZED' || code === 'VALIDATION') return 'token';
  return 'form'; // rede, etc.
}

export function LoginPage() {
  const { login, notice, deploymentId: savedDeployment } = useAuth();
  const [deployment, setDeployment] = useState(savedDeployment);
  const [token, setToken] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(null); // { field, message }
  const [loading, setLoading] = useState(false);

  const canSubmit = deployment.trim() && token.trim() && !loading;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await login({ deploymentId: deployment.trim(), token: token.trim() });
    } catch (err) {
      setError({ field: errorField(err.code), message: err.message });
      setLoading(false);
    }
  };

  const clearError = () => setError(null);
  const fieldError = (field) => (error?.field === field ? error.message : null);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-50 px-4">
      <Logo size="lg" />
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold text-slate-900">Entrar</h1>
        <p className="mt-0.5 text-sm text-slate-500">Informe o código de implantação da API e seu token de acesso.</p>

        {notice && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>}

        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          <Field
            label="Código de implantação"
            htmlFor="deployment"
            error={fieldError('deployment')}
            hint="O trecho entre /s/ e /exec da URL do Apps Script. Você pode colar a URL inteira."
          >
            <Input
              id="deployment"
              icon={Link2}
              autoFocus={!savedDeployment}
              autoComplete="off"
              spellCheck={false}
              placeholder="AKfycb..."
              value={deployment}
              onChange={(e) => {
                setDeployment(e.target.value);
                clearError();
              }}
              invalid={!!fieldError('deployment')}
              disabled={loading}
            />
          </Field>

          <Field label="Token" htmlFor="token" error={fieldError('token')}>
            <div className="relative">
              <Input
                id="token"
                icon={KeyRound}
                type={visible ? 'text' : 'password'}
                autoFocus={!!savedDeployment}
                autoComplete="off"
                spellCheck={false}
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  clearError();
                }}
                invalid={!!fieldError('token')}
                className="pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                aria-label={visible ? 'Ocultar token' : 'Mostrar token'}
              >
                {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          {fieldError('form') && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {fieldError('form')}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={!canSubmit} loading={loading}>
            {loading ? 'Validando…' : 'Acessar'}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">
          Os dados são validados na API e guardados com criptografia neste computador.
        </p>
      </Card>
    </div>
  );
}
