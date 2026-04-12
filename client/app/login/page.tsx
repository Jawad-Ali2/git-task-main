"use client";

import { LoginForm } from "@/components/auth"
import Image from 'next/image';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/authHook';
import { CenteredLoader } from '@/components/common/page-loading';

export default function LoginPage() {
  const router = useRouter();
  const { initialized, isAuthenticated } = useAuth();

  useEffect(() => {
    if (initialized && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [initialized, isAuthenticated, router]);

  if (!initialized) {
    return <CenteredLoader label="Checking session..." />;
  }

  if (isAuthenticated) {
    return <CenteredLoader label="Redirecting to dashboard..." />;
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <Image src="/logo.png" alt="GitTask Logo" width={20} height={20} />
            GitTask
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <img
          src="/login-bg.jpg"
          alt="Image of grass with a zigzag pattern"
          className="absolute inset-0 h-full w-full grayscale object-cover dark:brightness-[0.2]"
        />
      </div>
    </div>
  )
}
