import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { AppRouter } from './router/index.jsx';
import { useAuthStore } from './store/authStore.js';

export default function App() {
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <>
      <AppRouter />
      <Toaster
        position="bottom-center"
        duration={5000}
        toastOptions={{
          style: {
            background: 'var(--ink)',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontFamily: 'var(--font)',
            fontSize: '18px',
          },
        }}
      />
    </>
  );
}
