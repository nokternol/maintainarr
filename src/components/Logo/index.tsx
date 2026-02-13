import React from 'react';

export const MaintainarrLogo = ({ 
  className = "w-24 h-24", 
  id = "maintainarr-logo",
  isLoader = false 
}) => {
  const teeth = Array.from({ length: 8 }, (_, i) => i * 45);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* 1. Conditional Mounting Glow: Only shows if not in loader mode */}
      {!isLoader && (
        <div className="absolute inset-0 bg-teal-500/20 blur-2xl rounded-full" />
      )}
      
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-labelledby={`${id}-title`}
        className={`relative z-10 ${!isLoader ? 'drop-shadow-[0_0_8px_rgba(20,184,166,0.5)]' : ''} ${isLoader ? 'animate-spin-slow' : ''}`}
      >
        <title id={`${id}-title`}>Maintainarr Logo</title>
        
        {/* Gear Teeth - Reduced depth (shorter) */}
        <g transform="translate(12, 12)">
          {teeth.map((angle) => (
            <rect
              key={angle}
              x="-2"
              y="-9.5"  /* Moved closer to center */
              width="4"
              height="3" /* Shorter teeth */
              rx="1"
              transform={`rotate(${angle})`}
              className="fill-teal-500"
            />
          ))}
        </g>

        {/* Cog Face - Increased depth/radius */}
        <circle cx="12" cy="12" r="8" className="fill-teal-500" />
        
        {/* Inner Hub Cutout */}
        <circle cx="12" cy="12" r="4.5" className="fill-slate-950" />

        {/* Central Metadata Hub */}
        <g className="fill-teal-400">
          <circle cx="12" cy="12" r="1.3" />
          <circle cx="12" cy="10" r="0.6" />
          <circle cx="13.7" cy="11" r="0.6" />
          <circle cx="13.7" cy="13" r="0.6" />
          <circle cx="12" cy="14" r="0.6" />
          <circle cx="10.3" cy="13" r="0.6" />
          <circle cx="10.3" cy="11" r="0.6" />
        </g>
      </svg>
    </div>
  );
};

export const PlexIcon = ({ className = "w-6 h-6" }) => (
  <svg 
    viewBox="0 0 24 24" 
    className={className} 
    fill="currentColor" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>Plex</title>
    {/* The official Plex Chevron/Arrowhead shape */}
    <path d="M11.643 0L8.68 7.74 0 12l8.68 4.26 2.963 7.74 2.963-7.74L23.286 12l-8.68-4.26L11.643 0z"/>
  </svg>
);