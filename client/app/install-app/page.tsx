'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import axiosInstance from '@/lib/axios';

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking installation status...</p>
        </div>
      </div>
    );
  }

  if (installed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle className="h-16 w-16 text-green-600" />
              <div>
                <h2 className="text-2xl font-semibold text-green-900">
                  App Already Installed!
                </h2>
                <p className="text-sm text-green-700 mt-2">
                  Redirecting to dashboard...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted">
      <Card className="max-w-2xl border-2 shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-primary/10 rounded-full">
              <AlertCircle className="h-12 w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl">One More Step!</CardTitle>
          <CardDescription className="text-base mt-3">
            Install the GitHub App to enable automatic task scanning on every push
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Features */}
          <div className="bg-muted/50 rounded-lg p-5 space-y-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              What you'll get:
            </h3>
            <ul className="space-y-2 ml-7">
              <li className="flex items-start gap-2 text-sm">
                <ArrowRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>Automatic scanning when you push code to GitHub</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <ArrowRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>Track TODOs, FIXMEs, and other tasks across all commits</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <ArrowRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>Real-time webhook notifications for new tasks</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <ArrowRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>Link tasks to specific commits, authors, and line numbers</span>
              </li>
            </ul>
          </div>

          {/* Permissions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 space-y-3">
            <h3 className="font-semibold text-blue-900 flex items-center gap-2">
              🔒 Permissions Requested:
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <span className="font-mono bg-blue-100 px-2 py-0.5 rounded text-xs">
                  repo
                </span>
                <span>Read access to code (to scan for tasks)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono bg-blue-100 px-2 py-0.5 rounded text-xs">
                  email
                </span>
                <span>Read access to email (for notifications)</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-4">
            <Button 
              onClick={handleInstall}
              size="lg"
              className="w-full text-base"
            >
              Install GitHub App
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            
            <Button 
              onClick={handleSkip}
              variant="ghost"
              size="lg"
              className="w-full"
            >
              Skip for Now
            </Button>
          </div>

          {/* Footer Note */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              You can always install the app later from your dashboard settings
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InstallAppPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <InstallAppContent />
    </Suspense>
  );
}