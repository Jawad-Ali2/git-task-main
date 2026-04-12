"use client";

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/authHook';
import { CenteredLoader } from '@/components/common/page-loading';

export default function RepositoriesLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { initialized, isAuthenticated } = useAuth();

  useEffect(() => {
    if (initialized && !isAuthenticated) {
      router.replace('/login');
    }
  }, [initialized, isAuthenticated, router]);

  if (!initialized || !isAuthenticated) {
    return <CenteredLoader label="Checking authentication..." />;
  }

  return <>{children}</>;
}
