'use client';

import { ImageFader } from '@app/components/ImageFader';
import { MaintainarrLogo, PlexIcon } from '@app/components/Logo';
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
      if ('message' in err && err.message === 'Authentication cancelled') return;

      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-surface-bg px-6">
      {/* Background with Theme Tint */}
      <div className="absolute inset-0 z-0">
        <ImageFader images={backdrops || []} className="opacity-100 dark:opacity-50" />
        {/* Base wash */}
        <div className="absolute inset-0 bg-gradient-to-br from-teal-600/15 via-slate-50/5 to-slate-50/30 dark:from-teal-600/30 dark:via-slate-950/40 dark:to-slate-950/80" />
        {/* Central stabilizing halo for text legibility (Darker in light mode, hidden in dark mode) */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900/15 via-transparent to-transparent dark:hidden pointer-events-none" />
      </div>

      <div className="relative z-10 w-full max-w-md text-center">
        {/* SVG Logo Container */}
        <div className="mb-6 flex justify-center">
          <div className="p-4 rounded-3xl bg-surface-panel/80 border border-primary/30 shadow-[0_0_30px_rgba(20,184,166,0.2)]">
            {/* SVG Logo here */}
            <MaintainarrLogo isLoader={isLoading} className="w-20 h-20" />
          </div>
        </div>

        <h1 className="text-4xl font-black text-text-primary tracking-tighter mb-2 uppercase">
          Maintain<span className="text-primary">arr</span>
        </h1>
        <p className="text-text-muted text-sm font-medium tracking-wide mb-10 px-4 leading-relaxed">
          Task automation and metadata-driven grouping <br /> for the{' '}
          <span className="text-primary italic">*arr ecosystem</span>
        </p>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-white p-4 rounded-lg mb-6 text-center">
            <p className="font-bold">Authentication Failed</p>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Login Card */}
        <div className="bg-surface-panel/60 backdrop-blur-xl border border-border rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-primary/10 py-2 border-b border-border">
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary">
              Authorized Access Only
            </span>
          </div>

          <div className="p-8">
            <button
              type="button"
              onClick={handlePlexLogin}
              className="w-full bg-[#e5a00d] hover:bg-[#ffb40d] text-slate-950 font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-orange-900/20"
            >
              <PlexIcon className="w-6 h-6" />
              <span>Sign in with Plex</span>
            </button>

            <p className="mt-6 text-xs text-text-secondary dark:text-text-muted">
              By signing in, you agree to your server's automation policies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
