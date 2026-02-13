'use client';

import { MaintainarrLogo, PlexIcon } from "@app/components/Logo";
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
      console.info("token", authToken);

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
      if ("message" in err && err.message === "Authentication cancelled")
        return;

      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 px-6">
      {/* Background with Teal Tint */}
      <div className="absolute inset-0 z-0">
        <ImageFader images={backdrops || []} className="opacity-40 grayscale" />
        <div className="absolute inset-0 bg-gradient-to-br from-teal-900/40 via-slate-950/90 to-slate-950" />
      </div>

      <div className="relative z-10 w-full max-w-md text-center">
        {/* SVG Logo Container */}
        <div className="mb-6 flex justify-center">
          <div className="p-4 rounded-3xl bg-slate-900/80 border border-teal-500/30 shadow-[0_0_30px_rgba(20,184,166,0.2)]">
            {/* SVG Logo here */}
            <MaintainarrLogo isLoader={isLoading} className="w-20 h-20" /> 
          </div>
        </div>

        <h1 className="text-4xl font-black text-white tracking-tighter mb-2 uppercase">
          Maintain<span className="text-teal-400">arr</span>
        </h1>
        <p className="text-slate-400 text-sm font-medium tracking-wide mb-10 px-4 leading-relaxed">
          Task automation and metadata-driven grouping <br/> for the <span className="text-teal-500 italic">*arr ecosystem</span>
        </p>
        
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-white p-4 rounded-lg mb-6 text-center">
            <p className="font-bold">Authentication Failed</p>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Login Card */}
        <div className="dark:bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-teal-500/10 py-2 border-b border-white/5">
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-teal-400">
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
            
            <p className="mt-6 text-xs text-slate-500">
              By signing in, you agree to your server's automation policies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
