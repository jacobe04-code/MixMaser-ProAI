
import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as Tone from 'tone';
import { DeckId, Track } from '../types';
import { Icon, KEYS, CAMELOT_MAP } from '../constants';
import { audioEngine } from '../services/audioService';

interface DeckProps {
  id: DeckId;
  track: Track | null;
  masterBpm: number;
  masterKey: string;
  syncEnabled: boolean;
  onMagicMatch: (id: DeckId) => void;
  onReportBpm: (bpm: number) => void;
  onEnded?: (id: DeckId) => void;
}

export interface DeckHandle {
  play: () => void;
  stop: () => void;
  setEQ: (low: number, mid: number, high: number) => void;
  isPlaying: boolean;
  getCurrentKey: () => string;
}

const Deck = forwardRef<DeckHandle, DeckProps>(({ id, track, masterBpm, masterKey, syncEnabled, onMagicMatch, onReportBpm, onEnded }, ref) => {
  const [player, setPlayer] = useState<Tone.Player | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [originalBpm, setOriginalBpm] = useState(128);
  const [originalKey, setOriginalKey] = useState('C');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [pitchShift, setPitchShift] = useState(0);
  const [volume, setVolume] = useState(0); // dB

  const eqRef = useRef<Tone.EQ3 | null>(null);
  const pitchRef = useRef<Tone.PitchShift | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  
  const playbackRef = useRef({
    isPlaying: false,
    startTime: 0,
    offset: 0
  });

  useImperativeHandle(ref, () => ({
    play: () => handlePlay(),
    stop: () => handleStop(),
    setEQ: (low, mid, high) => {
      if (eqRef.current) {
        eqRef.current.low.value = low;
        eqRef.current.mid.value = mid;
        eqRef.current.high.value = high;
      }
    },
    isPlaying: playbackRef.current.isPlaying,
    getCurrentKey: () => originalKey
  }));

  useEffect(() => {
    if (!track) return;
    const init = async () => {
      setLoaded(false);
      handleStop();
      if (player) {
        player.dispose();
      }
      
      const newPlayer = new Tone.Player({
        url: track.url,
        loop: true, // Enable continuous looping
        onload: () => {
          setLoaded(true);
          setDuration(newPlayer.buffer.duration);
          const detectedBpm = Math.floor(Math.random() * 20 + 115);
          const detectedKey = KEYS[Math.floor(Math.random() * KEYS.length)];
          setOriginalBpm(detectedBpm);
          setOriginalKey(detectedKey);
          onReportBpm(detectedBpm);
          drawWaveform(newPlayer.buffer);
        },
        onstop: () => {
          if (newPlayer.state === 'stopped' && playbackRef.current.isPlaying) {
             const isNearEnd = Math.abs(currentTime - duration) < 0.5;
             if (isNearEnd && !newPlayer.loop) {
                playbackRef.current.isPlaying = false;
                setIsPlaying(false);
                onEnded?.(id);
             }
          }
        }
      });

      const eq = new Tone.EQ3(0, 0, 0);
      const pitch = new Tone.PitchShift(0);
      const targetInput = id === 'A' ? audioEngine.deckAInput : audioEngine.deckBInput;
      
      newPlayer.chain(eq, pitch, targetInput);
      
      eqRef.current = eq;
      pitchRef.current = pitch;
      setPlayer(newPlayer);
    };
    init();

    return () => {
      if (player) player.dispose();
    };
  }, [track?.id]); 

  // Synchronize playback rate and pitch shift
  useEffect(() => {
    if (!player || !loaded) return;
    
    let targetRate = playbackRate;
    let targetPitch = pitchShift;

    if (syncEnabled) {
      targetRate = masterBpm / originalBpm;
      
      let keyDiff = KEYS.indexOf(masterKey) - KEYS.indexOf(originalKey);
      if (keyDiff > 6) keyDiff -= 12;
      if (keyDiff < -6) keyDiff += 12;
      targetPitch = keyDiff;
    }

    player.playbackRate = targetRate;
    if (pitchRef.current) {
      pitchRef.current.pitch = targetPitch;
    }
  }, [masterBpm, masterKey, syncEnabled, loaded, originalBpm, originalKey, playbackRate, pitchShift, player]);

  useEffect(() => {
    if (player) player.volume.value = volume;
  }, [volume, player]);

  const handlePlay = async (offset = playbackRef.current.offset) => {
    if (!player || !loaded || playbackRef.current.isPlaying) return;
    await audioEngine.start();
    const startOffset = Math.max(0, Math.min(offset, duration));
    player.start(0, startOffset);
    playbackRef.current.isPlaying = true;
    playbackRef.current.startTime = player.now();
    playbackRef.current.offset = startOffset;
    setIsPlaying(true);
  };

  const handleStop = () => {
    if (player) player.stop();
    playbackRef.current.isPlaying = false;
    playbackRef.current.offset = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!loaded || !player) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(x / rect.width, 1));
    const newOffset = percent * duration;
    if (playbackRef.current.isPlaying) {
      player.stop();
      playbackRef.current.isPlaying = false;
      handlePlay(newOffset);
    } else {
      playbackRef.current.offset = newOffset;
      setCurrentTime(newOffset);
    }
  };

  useEffect(() => {
    const update = () => {
      if (playbackRef.current.isPlaying && player) {
        const elapsed = (player.now() - playbackRef.current.startTime) * player.playbackRate;
        const total = (playbackRef.current.offset + elapsed) % duration;
        setCurrentTime(total);
      }
      rafRef.current = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(rafRef.current);
  }, [duration, player]);

  const drawWaveform = (buffer: Tone.ToneAudioBuffer) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / canvas.width);
    const amp = canvas.height / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = id === 'A' ? '#3b82f6' : '#ec4899';
    for (let i = 0; i < canvas.width; i++) {
      let min = 1.0, max = -1.0;
      for (let j = 0; j < step; j++) {
        const val = data[i * step + j];
        if (val < min) min = val;
        if (val > max) max = val;
      }
      ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
  };

  return (
    <div className={`relative bg-slate-900/60 backdrop-blur-xl rounded-3xl border-2 p-6 transition-all flex gap-6 group ${id === 'A' ? 'border-blue-500/40 shadow-blue-500/10' : 'border-pink-500/40 shadow-pink-500/10'}`}>
      <div className="flex flex-col items-center justify-center gap-3">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">VOL</span>
        <div className="h-48 w-6 bg-black/60 rounded-full relative flex items-center justify-center overflow-hidden border border-white/10 group-hover:border-white/20 transition-all">
          <input 
            type="range" min="-60" max="6" step="0.1" 
            value={volume} 
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="h-40 -rotate-90 appearance-none bg-transparent cursor-pointer z-10"
            style={{ width: '160px' }}
          />
          <div className={`absolute bottom-0 w-full transition-all duration-75 ${id === 'A' ? 'bg-blue-500/20' : 'bg-pink-500/20'}`} style={{ height: `${((volume + 60) / 66) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-4 gap-4">
          <div className="min-w-0">
            <h3 className={`text-2xl font-black italic tracking-tighter ${id === 'A' ? 'text-blue-400' : 'text-pink-400'}`}>DECK {id}</h3>
            <p className="text-sm font-bold truncate text-white">{track ? track.name : "EMPTY DECK"}</p>
            <div className="flex gap-2 mt-1">
              <span className="text-[9px] font-black bg-white/10 px-2 py-0.5 rounded text-white/70 uppercase">BPM: {originalBpm}</span>
              <span className="text-[9px] font-black bg-white/10 px-2 py-0.5 rounded text-white/70 uppercase">KEY: {CAMELOT_MAP[originalKey] || originalKey}</span>
            </div>
          </div>
          <button 
            onClick={() => onMagicMatch(id)}
            disabled={!track}
            className="shrink-0 flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <Icon name="wand" size={14} /> MAGIC MIX
          </button>
        </div>

        <div className="h-28 bg-black/60 rounded-2xl mb-4 overflow-hidden relative border border-white/10 cursor-crosshair" onClick={handleSeek}>
          <canvas ref={canvasRef} width="400" height="112" className="w-full h-full opacity-40 group-hover:opacity-70 transition-opacity" />
          {loaded && <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_15px_white] z-20" style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }} />}
        </div>

        <div className="flex gap-3 mb-6">
          <button onClick={() => handlePlay()} disabled={!loaded || isPlaying} className={`flex-1 py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all ${isPlaying ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'}`}>
            <Icon name="play" size={20} /> PLAY
          </button>
          <button onClick={handleStop} disabled={!loaded} className="flex-1 py-4 bg-white/10 hover:bg-red-500 hover:text-white border border-white/10 text-white/70 rounded-2xl font-black flex items-center justify-center gap-2 transition-all">
            <Icon name="stop" size={20} /> STOP
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-black/40 p-4 rounded-2xl border border-white/5">
          <div className="space-y-2">
            <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase">
              <span>TEMPO</span>
              <span className="text-white">{(syncEnabled ? (masterBpm/originalBpm) : playbackRate).toFixed(2)}x</span>
            </div>
            <input 
              type="range" min="0.5" max="1.5" step="0.001" 
              value={syncEnabled ? (masterBpm/originalBpm) : playbackRate} 
              onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
              className={`w-full ${syncEnabled ? 'opacity-30 pointer-events-none' : ''}`}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase">
              <span>PITCH</span>
              <span className="text-white">{(syncEnabled ? (pitchShift) : pitchShift) > 0 ? '+' : ''}{syncEnabled ? (pitchShift) : pitchShift}st</span>
            </div>
            <input 
              type="range" min="-12" max="12" step="1" 
              value={pitchShift} 
              onChange={(e) => setPitchShift(parseInt(e.target.value))}
              className={`w-full ${syncEnabled ? 'opacity-30 pointer-events-none' : ''}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

export default Deck;
