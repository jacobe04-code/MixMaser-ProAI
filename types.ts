
export interface Track {
  id: string | number;
  name: string;
  artist: string;
  image: string | null;
  url: string;
  type: 'preview' | 'full';
  trackName: string;
  artistName: string;
}

export enum VisualizerMode {
  BARS = 'bars',
  WAVES = 'waves',
  DOTS = 'dots',
  PIXELS = 'pixels',
  FIREWORKS = 'fireworks',
  FIRE = 'fire'
}

export type DeckId = 'A' | 'B';

export interface StemConfig {
  low: boolean;
  mid: boolean;
  high: boolean;
}

export interface VoiceOption {
  name: string;
  id: string;
}
