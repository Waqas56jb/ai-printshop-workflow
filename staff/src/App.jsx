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
        toastOptions={{
          style: {
            background: 'var(--ink)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontFamily: 'var(--font)',
          },
        }}
      />
    </>
  );
}
