'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function JiraCallbackPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Jira OAuth 2.0 returns code in query params (not hash like Trello)
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (errorParam) {
      setStatus('error');
      setError(errorDescription || errorParam || 'Authorization failed');
      
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'jira-error',
            error: errorDescription || errorParam,
          },
          window.location.origin
        );
        setTimeout(() => window.close(), 2000);
      }
      return;
    }

    if (code && window.opener) {
      // Send code back to parent window
      window.opener.postMessage(
        {
          type: 'jira-code',
          code,
        },
        window.location.origin
      );

      setStatus('success');

      // Close popup after a short delay
      setTimeout(() => {
        window.close();
      }, 500);
    } else if (!code) {
      setStatus('error');
      setError('No authorization code received. Authorization may have been cancelled.');
      
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'jira-error',
            error: 'No authorization code received.',
          },
          window.location.origin
        );
      }

      setTimeout(() => {
        window.close();
      }, 2000);
    } else {
      // No opener window (direct navigation)
      setStatus('error');
      setError('Please use the integrations page to connect Jira.');
      
      setTimeout(() => {
        window.location.href = '/dashboard/settings/integrations';
      }, 2000);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === 'loading' && (
          <>
            <div className="flex justify-center">
              <svg
                className="animate-spin h-12 w-12 text-primary"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
            <h2 className="text-2xl font-semibold">Completing authorization...</h2>
            <p className="text-muted-foreground">
              This window will close automatically.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center">
              <svg
                className="h-12 w-12 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-green-600">
              Authorization successful!
            </h2>
            <p className="text-muted-foreground">
              This window will close automatically.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex justify-center">
              <svg
                className="h-12 w-12 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-red-600">
              Authorization failed
            </h2>
            <p className="text-muted-foreground">{error}</p>
          </>
        )}
      </div>
    </div>
  );
}
