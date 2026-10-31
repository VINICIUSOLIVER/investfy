import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider, useAuth } from './providers/AuthProvider';
import { ToastProvider } from './providers/ToastProvider';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { Logo } from './components/layout/Logo';
import { Spinner } from './components/ui';
import { UpdateNotifier } from './components/UpdateNotifier';

function Root() {
  const { status } = useAuth();
  if (status === 'checking') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <Logo size="lg" />
        <Spinner className="size-5" />
      </div>
    );
  }
  return status === 'authenticated' ? <AppShell /> : <LoginPage />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <UpdateNotifier />
        <AuthProvider>
          <Root />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
