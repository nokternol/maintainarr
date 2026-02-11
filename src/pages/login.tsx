'use client';

import { ImageFader } from '@app/components/ui/ImageFader';
import { PlexOAuth } from '@app/lib/utils/plexOAuth';
import { useState } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((d) => d.data);

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: backdrops } = useSWR<string[]>('/api/backdrops', fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
  });

  const handlePlexLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const oauth = new PlexOAuth();
      const authToken = await oauth.login();

      const response = await fetch('/api/auth/plex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authToken }),
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <ImageFader images={backdrops || []} className="fixed inset-0 -z-10" />

      <div className="max-w-md w-full bg-gray-800/90 backdrop-blur-sm rounded-lg p-8 shadow-xl">
        <h1 className="text-4xl font-bold text-white mb-2 text-center">Maintainarr</h1>
        <p className="text-gray-400 mb-8 text-center">Task automation for the *arr ecosystem</p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-200 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handlePlexLogin}
          disabled={isLoading}
          type="button"
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600
                     text-white font-semibold py-3 px-4 rounded transition-colors
                     flex items-center justify-center gap-2"
        >
          {isLoading ? 'Authenticating...' : 'Sign in with Plex'}
        </button>
      </div>
    </div>
  );
}
