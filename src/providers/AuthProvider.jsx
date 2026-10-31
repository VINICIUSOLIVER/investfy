import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, authApi, setUnauthorizedHandler } from '../lib/api';

const AuthContext = createContext(null);

/**
 * Gerencia a sessão. Token e código de implantação ficam no processo main
 * (criptografados); o renderer só conhece o estado
 * 'checking' | 'authenticated' | 'anonymous' e o código, para pré-preencher o login.
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('checking');
  const [notice, setNotice] = useState(null);
  // Código de implantação salvo (mantido após o logout para pré-preencher o login)
  const [deploymentId, setDeploymentId] = useState('');

  // Ao abrir o app: existe sessão guardada? Então entra direto.
  useEffect(() => {
    let alive = true;
    authApi
      .status()
      .then((res) => {
        if (!alive) return;
        setDeploymentId(res?.ok ? (res.dados.deploymentId ?? '') : '');
        setStatus(res?.ok && res.dados.authenticated ? 'authenticated' : 'anonymous');
      })
      .catch(() => alive && setStatus('anonymous'));
    return () => {
      alive = false;
    };
  }, []);

  const endSession = useCallback(
    (message = null) => {
      queryClient.cancelQueries();
      queryClient.clear();
      setNotice(message);
      setStatus('anonymous');
    },
    [queryClient],
  );

  // Qualquer chamada que receba "não autorizado" encerra a sessão
  useEffect(() => {
    setUnauthorizedHandler(() => endSession('Seu token não é mais aceito pela API. Informe-o novamente.'));
    return () => setUnauthorizedHandler(null);
  }, [endSession]);

  /**
   * Valida código de implantação + token na API; só salva se forem aceitos.
   * Erros: code 'DEPLOYMENT' → problema no código; 'UNAUTHORIZED'/'VALIDATION' → token.
   */
  const login = useCallback(async ({ deploymentId: id, token }) => {
    const res = await authApi.login({ deploymentId: id, token });
    if (!res?.ok) {
      const message = res?.code === 'UNAUTHORIZED' ? 'Token inválido.' : res?.erro;
      throw new ApiError(res?.code ?? 'UNKNOWN', message || 'Não foi possível entrar.');
    }
    setDeploymentId(res.dados.deploymentId ?? id);
    setNotice(null);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    endSession();
  }, [endSession]);

  const value = useMemo(
    () => ({ status, notice, deploymentId, login, logout }),
    [status, notice, deploymentId, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
