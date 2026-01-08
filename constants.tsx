
import React from 'react';

export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const CAMELOT_MAP: Record<string, string> = {
  'C': '8B', 'C#': '3B', 'D': '10B', 'D#': '5B', 'E': '12B', 'F': '7B', 
  'F#': '2B', 'G': '9B', 'G#': '4B', 'A': '11B', 'A#': '6B', 'B': '1B',
  'Am': '8A', 'A#m': '3A', 'Bm': '10A', 'Cm': '5A', 'C#m': '12A', 'Dm': '7A',
  'D#m': '2A', 'Em': '9A', 'Fm': '4A', 'F#m': '11A', 'Gm': '6A', 'G#m': '1A'
};

export const AI_VOICES = [
  { name: "JD (Late Night FM)", id: "Charon" },
  { name: "Puck (Energetic Male)", id: "Puck" },
  { name: "Aoede (Cheerful Female)", id: "Aoede" },
  { name: "Fenrir (Deep Nordic)", id: "Fenrir" },
  { name: "Kore (Soft & Smooth)", id: "Kore" },
  { name: "Zephyr (Breezy Accent)", id: "Zephyr" },
  { name: "Orpheus (Classic Baritone)", id: "Orpheus" }
];

export const ICONS = {
  play: <path d="M5 3l14 9-14 9V3z" />,
  pause: <path d="M6 4h4v16H6zm8 0h4v16h-4z" />,
  stop: <rect x="6" y="6" width="12" height="12" />,
  search: <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
  shuffle: <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l5 5M4 4l5 5" />,
  layers: <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />,
  upload: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />,
  music: <path d="M9 18V5l12-2v13M9 9l12-2M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
  sparkles: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
  mic: <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>,
  wand: <path d="M15 4V2m0 2v2m0-2h2m-2 0h-2M5.7 14.3l9.6-9.6a1 1 0 0 1 1.4 0l1 1a1 1 0 0 1 0 1.4l-9.6 9.6a1 1 0 0 1-1.4 0l-1-1a1 1 0 0 1 0-1.4zM5 19l4-4" />,
  eye: <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />,
  eyeOff: <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />,
  refresh: <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />,
  radio: <><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></>
};

export const Icon: React.FC<{ name: keyof typeof ICONS, size?: number, className?: string }> = ({ name, size = 20, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {ICONS[name]}
  </svg>
);
