'use client';

import { useEffect } from 'react';

export default function TrelloCallbackPage() {
  useEffect(() => {
    // Extract token from URL hash
    const hash = window.location.hash.substring(1); // Remove #
    const params = new URLSearchParams(hash);
    const token = params.get('token');

    if (token && window.opener) {
      // Send token back to parent window
      window.opener.postMessage(
        {
          type: 'trello-token',
          token,
        },
        window.location.origin
      );

      // Close popup after a short delay
      setTimeout(() => {
        window.close();
      }, 500);
    } else if (!token) {
      // Authorization failed or was cancelled
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'trello-error',
            error: 'No token received. Authorization may have been cancelled.',
          },
          window.location.origin
        );
      }

      setTimeout(() => {
        window.close();
      }, 2000);
    } else {
      // No opener window (direct navigation)
      setTimeout(() => {
        window.location.href = '/dashboard/settings/integrations';
      }, 2000);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
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
      </div>
    </div>
  );
}
