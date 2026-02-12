'use client';

import { ImageFader } from '@app/components/ui/ImageFader';
import { useBackdrops } from '@app/hooks/useBackdrops';
import { PlexOAuth } from '@app/lib/utils/plexOAuth';
import Image from 'next/image';
import { useState } from 'react';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { backdrops } = useBackdrops();

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
          className="group relative w-full bg-[#e5a00d] hover:bg-[#cc8e0b] disabled:bg-slate-700 
                     text-black font-bold py-4 px-6 rounded-lg transition-all 
                     flex items-center justify-center gap-3 active:scale-[0.98]"
        >
          {!isLoading && (
            <svg 
              viewBox="0 0 24 24" 
              className="w-6 h-6 fill-current" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>Plex</title>
              <path d="M12 0L9.33 6.92 2 12l7.33 5.08L12 24l2.67-6.92L22 12l-7.33-5.08L12 0z"/>
            </svg>
          )}
          
          <span className="text-lg">
            {isLoading ? 'Authenticating...' : 'Sign in with Plex'}
          </span>
        </button>
      </div>
    </div>
  );
}
