
import React, { useState, useEffect } from 'react';
import { Track } from '../types';
import { Icon, AI_VOICES } from '../constants';
import { generateMashupNames, generateDJIntro, getAssistantTip } from '../services/geminiService';
import { audioEngine } from '../services/audioService';
import * as Tone from 'tone';

interface AIFeaturesProps {
  trackA: Track | null;
  trackB: Track | null;
  isPlaying: boolean;
}

const AIFeatures: React.FC<AIFeaturesProps> = ({ trackA, trackB, isPlaying }) => {
  const [names, setNames] = useState<string[]>([]);
  const [loadingNames, setLoadingNames] = useState(false);
  const [loadingIntro, setLoadingIntro] = useState(false);
  const [isPlayingIntro, setIsPlayingIntro] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(AI_VOICES[0].id);
  const [assistantTip, setAssistantTip] = useState("Load tracks to start your AI-powered performance!");
  const [loadingTip, setLoadingTip] = useState(false);

  useEffect(() => {
    const updateTip = async () => {
      setLoadingTip(true);
      const tip = await getAssistantTip({
        deckA: trackA?.name || null,
        deckB: trackB?.name || null,
        isPlaying,
        crossfade: audioEngine.crossFade.fade.value
      });
      setAssistantTip(tip);
      setLoadingTip(false);
    };

    const timer = setTimeout(updateTip, 2000);
    return () => clearTimeout(timer);
  }, [trackA, trackB, isPlaying]);

  const handleGenNames = async () => {
    if (!trackA || !trackB) return;
    setLoadingNames(true);
    const result = await generateMashupNames(trackA.name, trackB.name);
    setNames(result);
    setLoadingNames(false);
  };

  const handleDJHost = async () => {
    if (!trackA || !trackB) return;
    setLoadingIntro(true);
    const base64 = await generateDJIntro(trackA.name, trackB.name, selectedVoice);
    if (base64) {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = await audioEngine.decodeAudioData(bytes, audioContext, 24000, 1);
      
      const player = new Tone.Player(buffer).connect(audioEngine.masterCompressor);
      player.onstop = () => setIsPlayingIntro(false);
      setIsPlayingIntro(true);
      player.start();
    }
    setLoadingIntro(false);
  };

  return (
    <div className="w-full flex flex-col gap-6 mb-10">
      {/* Assistant Ribbon */}
      <div className="bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 backdrop-blur-xl border border-white/10 p-4 rounded-2xl flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
            <Icon name="sparkles" className="text-blue-400" size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Live AI Assistant</p>
            <p className={`text-sm font-bold tracking-tight transition-opacity duration-500 ${loadingTip ? 'opacity-40' : 'opacity-100'}`}>
              {assistantTip}
            </p>
          </div>
        </div>
        <div className="text-[9px] font-black bg-white/5 px-3 py-1 rounded-full text-slate-400 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          AI AGENT READY
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Namer */}
        <div className="bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-white/10 flex flex-col justify-between group">
          <div>
            <h3 className="text-blue-400 font-black text-[10px] uppercase tracking-[0.3em] flex items-center gap-2 mb-6">
              <Icon name="music" size={14} /> Mix Identification
            </h3>
            <div className="min-h-[60px] flex flex-col justify-center">
              {names.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {names.map((n, i) => (
                    <div key={i} className="bg-white/5 border border-white/5 px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/10 transition-colors">
                      {n}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 leading-relaxed italic">
                  Generate a professional DJ name for your current track combination.
                </p>
              )}
            </div>
          </div>
          <button 
            onClick={handleGenNames}
            disabled={loadingNames || !trackA || !trackB}
            className="mt-8 w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/10 disabled:text-blue-400/50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-blue-500/30"
          >
            {loadingNames ? "ANALYZING ACOUSTICS..." : "GENERATE MASHUP NAMES"}
          </button>
        </div>

        {/* DJ Host */}
        <div className="bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-pink-400 font-black text-[10px] uppercase tracking-[0.3em] flex items-center gap-2">
                <Icon name="mic" size={14} /> AI Commentary
              </h3>
              <select 
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-xl text-[10px] font-black text-white px-3 py-1.5 focus:outline-none hover:border-white/30 transition-colors"
              >
                {AI_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="min-h-[60px] flex flex-col justify-center">
              <p className="text-xs text-slate-500 leading-relaxed italic">
                {isPlayingIntro ? "🎙️ DJ Host is live on the air..." : "AI creates a bespoke high-energy voiceover intro for your performance."}
              </p>
            </div>
          </div>
          <button 
            onClick={handleDJHost}
            disabled={loadingIntro || isPlayingIntro || !trackA || !trackB}
            className={`mt-8 w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
              isPlayingIntro 
                ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/40 animate-pulse' 
                : 'bg-pink-600 hover:bg-pink-500 disabled:bg-pink-600/10 disabled:text-pink-400/50 text-white'
            }`}
          >
            {loadingIntro ? "SYNTHESIZING HYPE..." : (isPlayingIntro ? "BROADCASTING" : "GENERATE STAGE INTRO")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIFeatures;
