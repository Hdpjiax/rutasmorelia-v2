'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/toast-provider';
import { PwaRegister } from '@/components/pwa-register';
import { DeepLinkBridge } from '@/components/deep-link-bridge';
import { PreventPageZoom } from '@/components/prevent-page-zoom';
import { SafeAreaBootstrap } from '@/components/safe-area-bootstrap';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastProvider />
      <PwaRegister />
      <DeepLinkBridge />
      <PreventPageZoom />
      <SafeAreaBootstrap />
    </QueryClientProvider>
  );
}
