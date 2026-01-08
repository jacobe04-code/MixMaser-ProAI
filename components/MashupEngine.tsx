
import React, { useState, useEffect } from 'react';
import { StemConfig, DeckId } from '../types';
import { Icon, KEYS } from '../constants';
import { audioEngine } from '../services/audioService';

interface MashupEngineProps {
  onPlayMashup: () => void;
  isPlaying: boolean;
  masterBpm: number;
  setMasterBpm: (bpm: number) => void;
  masterKey: string;
  setMasterKey: (key: string) => void;
  syncEnabled: boolean;
  setSyncEnabled: (sync: boolean) => void;
  onEQChange: (deck: DeckId, config: StemConfig) => void;
  autoDjMode: boolean;
  setAutoDjMode: (enabled: boolean) => void;
}

const MashupEngine: React.FC<MashupEngineProps> = ({ 
  onPlayMashup, isPlaying, masterBpm, setMasterBpm, masterKey, setMasterKey, syncEnabled, setSyncEnabled, onEQChange, autoDjMode, setAutoDjMode
}) => {
  const [deckAConfig, setDeckAConfig] = useState<StemConfig>({ low: true, mid: true, high: true });
  const [deckBConfig, setDeckBConfig] = useState<StemConfig>({ low: false, mid: true, high: true });
  const [crossfade, setCrossfade] = useState(0.5);

  useEffect(() => {
    onEQChange('A', deckAConfig);
  }, [deckAConfig]);

  useEffect(() => {
    onEQChange('B', deckBConfig);
  }, [deckBConfig]);

  useEffect(() => {
    audioEngine.crossFade.fade.value = crossfade;
  }, [crossfade]);

  const togglePart = (deck: DeckId, part: keyof StemConfig) => {
    if (deck === 'A') setDeckAConfig(prev => ({ ...prev, [part]: !prev[part] }));
    else setDeckBConfig(prev => ({ ...prev, [part]: !prev[part] }));
  };

  const EQBtn: React.FC<{ label: string, active: boolean, onClick: () => void, color: 'blue' | 'pink' }> = ({ label, active, onClick, color }) => (
    <button 
      onClick={onClick}
      className={`flex-1 py-3 text-[9px] font-black uppercase rounded-xl border-2 transition-all transform active:scale-95 ${
        active 
          ? (color === 'blue' ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/30' : 'bg-pink-600 border-pink-400 text-white shadow-lg shadow-pink-500/30')
          : 'bg-black/40 border-white/5 text-slate-600 hover:border-white/20'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 p-10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-50" />
      
      <div className="flex flex-col lg:flex-row justify-between items-center mb-10 gap-10">
        <div className="flex flex-col">
          <h2 className="text-4xl font-black italic tracking-tighter flex items-center gap-3">
            <Icon name="layers" className="text-purple-400" size={32} /> MASHUP CORE
          </h2>
          <span className="text-[10px] font-black text-slate-500 tracking-[0.5em] uppercase mt-2">Harmonic Logic Controller</span>
        </div>

        <div className="flex flex-wrap justify-center gap-6 bg-black/60 p-3 rounded-[2rem] border border-white/5 shadow-inner">
          <div className="flex flex-col items-center border-r border-white/10 px-6">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">MASTER BPM</label>
            <div className="flex items-center gap-4">
              <button onClick={() => setMasterBpm(masterBpm - 1)} className="text-white/40 hover:text-white transition-colors p-1">-</button>
              <span className="text-3xl font-mono font-black text-white w-14 text-center">{masterBpm}</span>
              <button onClick={() => setMasterBpm(masterBpm + 1)} className="text-white/40 hover:text-white transition-colors p-1">+</button>
            </div>
          </div>
          <div className="flex flex-col items-center border-r border-white/10 px-6">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">MASTER KEY</label>
            <select 
              value={masterKey} 
              onChange={(e) => setMasterKey(e.target.value)}
              className="bg-transparent text-3xl font-mono font-black text-blue-400 focus:outline-none cursor-pointer text-center w-16 hover:text-blue-300 transition-colors"
            >
              {KEYS.map(k => <option key={k} value={k} className="bg-slate-900">{k}</option>)}
            </select>
          </div>
          <div className="flex flex-col items-center px-6 justify-center gap-3">
             <button 
              onClick={() => setSyncEnabled(!syncEnabled)}
              className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${syncEnabled ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}
             >
               {syncEnabled ? 'SYNC ON' : 'SYNC OFF'}
             </button>
             <button 
              onClick={() => setAutoDjMode(!autoDjMode)}
              className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${autoDjMode ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}
             >
               <Icon name="refresh" size={12} /> AUTO DJ
             </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-16 items-center">
        {/* EQ A */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
             <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest">DECK A EQ</div>
             <div className="h-1 flex-1 mx-4 bg-blue-500/10 rounded-full" />
          </div>
          <div className="flex gap-3">
            <EQBtn label="Bass" active={deckAConfig.low} onClick={() => togglePart('A', 'low')} color="blue" />
            <EQBtn label="Mid" active={deckAConfig.mid} onClick={() => togglePart('A', 'mid')} color="blue" />
            <EQBtn label="High" active={deckAConfig.high} onClick={() => togglePart('A', 'high')} color="blue" />
          </div>
        </div>

        {/* Central Transport & Crossfader */}
        <div className="flex flex-col items-center gap-10">
          <button 
            onClick={onPlayMashup}
            className={`group w-full py-8 rounded-3xl font-black text-2xl shadow-2xl transition-all transform active:scale-95 flex items-center justify-center gap-4 ${
              isPlaying 
                ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/40' 
                : 'bg-gradient-to-br from-blue-600 via-indigo-600 to-pink-600 hover:from-blue-500 hover:to-pink-500 text-white shadow-blue-500/20'
            }`}
          >
            <div className="bg-white/20 p-2 rounded-full group-hover:scale-110 transition-transform">
               <Icon name={isPlaying ? "pause" : "play"} size={28} />
            </div>
            {isPlaying ? "STOP MIX" : "START MIX"}
          </button>

          <div className="w-full space-y-4">
             <div className="flex justify-between text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] px-2">
                <span className={crossfade < 0.3 ? 'text-blue-400' : 'transition-colors'}>DECK A</span>
                <span className={crossfade > 0.7 ? 'text-pink-400' : 'transition-colors'}>DECK B</span>
             </div>
             <div className="relative h-14 bg-black/60 rounded-[1.5rem] border-2 border-white/5 flex items-center px-4 shadow-inner">
               <input 
                type="range" min="0" max="1" step="0.001" 
                value={crossfade} 
                onChange={(e) => setCrossfade(parseFloat(e.target.value))}
                className="w-full appearance-none bg-transparent cursor-pointer relative z-10 h-full"
               />
               {/* Fader Track Styling */}
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                  <div className="w-0.5 h-6 bg-white/50" />
               </div>
               <div className="absolute inset-y-2 left-2 rounded-l-xl transition-all duration-75 pointer-events-none bg-blue-500/10" style={{ width: `calc(${(1 - crossfade) * 100}% - 8px)` }} />
               <div className="absolute inset-y-2 right-2 rounded-r-xl transition-all duration-75 pointer-events-none bg-pink-500/10" style={{ width: `calc(${crossfade * 100}% - 8px)` }} />
             </div>
          </div>
        </div>

        {/* EQ B */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
             <div className="h-1 flex-1 mx-4 bg-pink-500/10 rounded-full" />
             <div className="text-[10px] font-black text-pink-400 uppercase tracking-widest">DECK B EQ</div>
          </div>
          <div className="flex gap-3">
            <EQBtn label="Bass" active={deckBConfig.low} onClick={() => togglePart('B', 'low')} color="pink" />
            <EQBtn label="Mid" active={deckBConfig.mid} onClick={() => togglePart('B', 'mid')} color="pink" />
            <EQBtn label="High" active={deckBConfig.high} onClick={() => togglePart('B', 'high')} color="pink" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MashupEngine;
