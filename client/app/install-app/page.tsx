'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import {
  Field,
  FieldDescription,
  FieldGroup,
} from "@/components/ui/field";

function InstallAppContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [installed, setInstalled] = useState(false);

  const redirectUrl = searchParams.get('redirect');
  const returnUrl = searchParams.get('return') || '/dashboard';

  useEffect(() => {
    checkInstallation();
  }, []);

  const checkInstallation = async () => {
    try {
      const response = await axiosInstance.get('/auth/profile');
      if (response.data.hasAppInstalled) {
        setInstalled(true);
        // Already installed, redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push(returnUrl);
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to check installation:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleInstall = () => {
    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      window.location.href = 'https://github.com/apps/git-task-dev/installations/new';
    }
  };

  const handleSkip = () => {
    router.push(returnUrl);
  };

  if (checking) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-green-900" />
          <p className="text-sm">Checking installation status...</p>
        </div>
      </div>
    );
  }

  if (installed) {
    return (
      <div className="min-h-svh flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle className="h-12 w-12 text-green-600" />
            <div>
              <h2 className="text-2xl font-semibold">
                App Already Installed!
              </h2>
              <p className="text-sm text-green-700 mt-2">
                Redirecting to dashboard...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col gap-4 p-6 md:p-10">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 font-medium">
          <Image src="/logo.png" alt="GitTask Logo" width={20} height={20} />
          GitTask
        </div>
        <Button 
          onClick={handleSkip}
          variant="ghost"
          size="sm"
          type="button"
        >
          Skip
        </Button>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-md">
          <form className={cn("flex flex-col gap-6")}>
            <FieldGroup>
              <div className="flex flex-col items-center gap-1 text-center">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-6 w-6 text-primary" />
                  <h1 className="text-2xl font-bold">Complete Setup</h1>
                </div>
                <p className="text-muted-foreground text-sm text-balance">
                  Install the GitHub App to enable automatic task scanning
                </p>
              </div>

              {/* Features */}
              <div className="space-y-3 text-left">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  What you'll get:
                </h3>
                <ul className="space-y-2 text-sm list-disc list-inside">
                  <li>Automatic scanning when you push code to GitHub</li>
                  <li>Track TODOs, FIXMEs, and other tasks across commits</li>
                  <li>Real-time webhook notifications for new tasks</li>
                  <li>Link tasks to commits, authors, and line numbers</li>
                </ul>
              </div>

              {/* Permissions */}
              <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2 text-left">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  Permissions Requested:
                </h3>
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2">
                    <span className="font-mono font-medium bg-muted px-2 py-0.5 rounded">
                      repo
                    </span>
                    <span>Read access to code (to scan for tasks)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono font-medium bg-muted px-2 py-0.5 rounded">
                      email
                    </span>
                    <span>Read access to email (for notifications)</span>
                  </li>
                </ul>
              </div>

              <Field>
                <Button 
                  onClick={handleInstall}
                  type="button"
                  className="w-full"
                >
                  Install GitHub App
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <FieldDescription className="text-center">
                  You can always install the app later from your settings.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function InstallAppPage() {
  return (
    <Suspense fallback={
      <div className="min-h-svh flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <InstallAppContent />
    </Suspense>
  );
}