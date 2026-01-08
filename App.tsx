
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Track, DeckId, VisualizerMode, StemConfig } from './types';
import Deck, { DeckHandle } from './components/Deck';
import MashupEngine from './components/MashupEngine';
import SearchPanel from './components/SearchPanel';
import Visualizer from './components/Visualizer';
import AIFeatures from './components/AIFeatures';
import { Icon } from './constants';
import { generateMagicMatch, interactWithAIDJ, generateJDVoice } from './services/geminiService';
import { audioEngine } from './services/audioService';
import * as Tone from 'tone';

const App: React.FC = () => {
  const [trackA, setTrackA] = useState<Track | null>(null);
  const [trackB, setTrackB] = useState<Track | null>(null);
  const [masterBpm, setMasterBpm] = useState(128);
  const [masterKey, setMasterKey] = useState('C');
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [isPlayingMashup, setIsPlayingMashup] = useState(false);
  const [vizMode, setVizMode] = useState<VisualizerMode>(VisualizerMode.BARS);
  const [uiVisible, setUiVisible] = useState(true);
  const [autoDjMode, setAutoDjMode] = useState(false);
  const [recommendation, setRecommendation] = useState<{deck: DeckId, text: string} | null>(null);
  const [audioStarted, setAudioStarted] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiResponse, setAiResponse] = useState('Welcome to the booth. JD here. Before we start transmitting, tell me: what kind of vibe are we chasing tonight?');
  const [crossfade, setCrossfade] = useState(0.5);
  const [aiHistory, setAiHistory] = useState<any[]>([]);
  const [isJDSpeaking, setIsJDSpeaking] = useState(false);
  const [vibeMood, setVibeMood] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const deckARef = useRef<DeckHandle>(null);
  const deckBRef = useRef<DeckHandle>(null);
  const isInteracting = useRef(false);
  const autoMixTimer = useRef<number | null>(null);
  const lastDeckTransition = useRef<DeckId>('A');

  const handleBpmReport = useCallback((bpm: number) => {
    if (!trackA && !trackB) setMasterBpm(bpm);
  }, [trackA, trackB]);

  const initAudio = async () => {
    try {
      await Tone.start();
      await audioEngine.start();
      setAudioStarted(true);
      setAiPanelOpen(true);
      speakAsJD(aiResponse);
    } catch (e) {
      console.error("Audio Context Failed", e);
    }
  };

  const speakAsJD = async (text: string) => {
    if (!text) return;
    setIsJDSpeaking(true);
    audioEngine.duckMusic(true);
    
    try {
      const base64 = await generateJDVoice(text, "Charon"); 
      if (base64) {
        const bytes = audioEngine.decode(base64);
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const buffer = await audioEngine.decodeAudioData(bytes, audioContext, 24000, 1);
        
        const player = new Tone.Player(buffer).connect(audioEngine.masterCompressor);
        player.onstop = () => {
          setIsJDSpeaking(false);
          audioEngine.duckMusic(false);
          player.dispose();
        };
        player.start();
      }
    } catch (err) {
      setIsJDSpeaking(false);
      audioEngine.duckMusic(false);
    }
  };

  const handleUpgradeKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setQuotaExceeded(false);
      handleAIDJInteraction("JD, I've updated the connection. Let's get back to it.");
    }
  };

  const handleAIDJInteraction = async (inputOverride?: string) => {
    if (isInteracting.current) return;
    const prompt = inputOverride || aiInput;
    if (!prompt.trim()) return;

    isInteracting.current = true;
    if (!inputOverride) setAiInput('');
    setAiResponse('...processing frequencies...');

    const context = {
      deckA: trackA ? { name: trackA.name, artist: trackA.artist } : 'Empty',
      deckB: trackB ? { name: trackB.name, artist: trackB.artist } : 'Empty',
      masterBpm,
      crossfade,
      isPlaying: isPlayingMashup,
      autoPilot: autoDjMode,
      currentVibe: vibeMood
    };

    try {
      const result = await interactWithAIDJ(prompt, aiHistory, context);
      if (!result) throw new Error("Null result");

      const newResponse = result.text || 'Loud and clear.';
      setAiResponse(newResponse);
      setAiHistory(prev => [...prev.slice(-10), { role: 'user', parts: [{ text: prompt }] }, { role: 'model', parts: [{ text: newResponse }] }]);
      setQuotaExceeded(false);
      speakAsJD(newResponse);

      if (result.functionCalls) {
        for (const call of result.functionCalls) {
          if (call.name === 'sync_master_levels') {
            if (typeof call.args.bpm === 'number') setMasterBpm(call.args.bpm);
            if (typeof call.args.key === 'string') setMasterKey(call.args.key);
          }
          if (call.name === 'set_auto_pilot') setAutoDjMode(call.args.enabled);
          if (call.name === 'load_track') {
            const searchRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(call.args.query)}&entity=song&limit=1`);
            const data = await searchRes.json();
            if (data.results?.[0]) {
               const track = {
                 id: data.results[0].trackId,
                 name: data.results[0].trackName, artist: data.results[0].artistName,
                 image: data.results[0].artworkUrl100, url: data.results[0].previewUrl,
                 type: 'preview' as const, trackName: data.results[0].trackName, artistName: data.results[0].artistName
               };
               if (call.args.deck === 'A') setTrackA(track); else setTrackB(track);
            }
          }
          if (call.name === 'smart_transition') {
            const start = crossfade;
            const end = call.args.targetDeck === 'A' ? 0 : 1;
            const durMs = (call.args.duration || 5) * 1000;
            let startT = performance.now();
            const anim = (now: number) => {
              const p = Math.min((now - startT) / durMs, 1);
              const val = start + (end - start) * p;
              setCrossfade(val);
              audioEngine.crossFade.fade.value = val;
              if (p < 1) requestAnimationFrame(anim);
              else {
                lastDeckTransition.current = call.args.targetDeck;
                if (call.args.swapOtherDeck) handleAIDJInteraction(`JD, find me a gem for the silent deck.`);
              }
            };
            requestAnimationFrame(anim);
          }
          if (call.name === 'vibe_shift') {
            setVibeMood(call.args.mood);
            const searchRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(call.args.mood)}&entity=song&limit=2`);
            const data = await searchRes.json();
            if (data.results?.length >= 2) {
              setTrackA({...data.results[0], url: data.results[0].previewUrl, name: data.results[0].trackName, artist: data.results[0].artistName});
              setTrackB({...data.results[1], url: data.results[1].previewUrl, name: data.results[1].trackName, artist: data.results[1].artistName});
              setTimeout(() => {
                deckARef.current?.play(); deckBRef.current?.play();
                setIsPlayingMashup(true); setAutoDjMode(true);
              }, 1000);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.message?.includes('429')) {
        setAiResponse("Transmission limit reached. The signal is weak. Use your own key for full bandwidth.");
        setQuotaExceeded(true);
      } else {
        setAiResponse("Signal dropped. Let's try that again.");
      }
    } finally {
      isInteracting.current = false;
    }
  };

  useEffect(() => {
    if (!autoDjMode || !isPlayingMashup) {
      if (autoMixTimer.current) clearInterval(autoMixTimer.current);
      return;
    }
    autoMixTimer.current = window.setInterval(() => {
      const nextTarget = lastDeckTransition.current === 'A' ? 'B' : 'A';
      handleAIDJInteraction(`JD, smooth transition to Deck ${nextTarget} and find a fresh track for the silent deck.`);
    }, 28000);
    return () => { if (autoMixTimer.current) clearInterval(autoMixTimer.current); };
  }, [autoDjMode, isPlayingMashup]);

  const handleLoadTrack = async (id: DeckId, track: Track) => {
    if (!audioStarted) await initAudio();
    if (id === 'A') setTrackA(track); else setTrackB(track);
  };

  const handlePlayMashup = async () => {
    if (!audioStarted) await initAudio();
    if (isPlayingMashup) {
      deckARef.current?.stop(); deckBRef.current?.stop();
      setIsPlayingMashup(false); setAutoDjMode(false);
    } else {
      deckARef.current?.play(); deckBRef.current?.play();
      setIsPlayingMashup(true);
    }
  };

  return (
    <div className="min-h-screen text-slate-100 selection:bg-blue-500/30">
      <Visualizer mode={vizMode} />

      {!audioStarted && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-3xl p-6 text-center">
           <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center mb-8 shadow-2xl animate-pulse">
             <Icon name="radio" size={48} className="text-white" />
           </div>
           <h1 className="text-4xl font-black italic mb-4 uppercase tracking-tighter">MixMaster Studio <span className="text-blue-500 font-normal">AI-1</span></h1>
           <p className="text-slate-400 max-w-sm mb-12 text-sm uppercase tracking-[0.3em] font-bold">JD is warming up the pre-amps. Ready to enter the booth?</p>
           <button onClick={initAudio} className="px-16 py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-black text-xs uppercase tracking-[0.4em] transform active:scale-95 transition-all shadow-xl shadow-blue-500/30">
             INITIALIZE AUDIO CORE
           </button>
        </div>
      )}

      <div className={`relative z-10 p-6 max-w-7xl mx-auto transition-all duration-1000 ${uiVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-8 bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
          <div className="flex flex-col">
            <h1 className="text-5xl font-black italic tracking-tighter bg-gradient-to-r from-blue-400 via-indigo-400 to-pink-500 bg-clip-text text-transparent">
              MIXMASTER <span className="text-white/20 font-light text-base not-italic tracking-[0.4em] ml-2">PRO AI</span>
            </h1>
            <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.5em] mt-3 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isJDSpeaking ? 'bg-red-500 shadow-[0_0_10px_red] animate-pulse' : 'bg-green-500 shadow-[0_0_10px_#22c55e]'}`}></span> {isJDSpeaking ? 'ON AIR - JD TRANSMITTING' : (autoDjMode ? 'JD AUTO-PILOT ENGAGED' : 'JD MONITORING MIX')}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { handleAIDJInteraction("JD, let's start the vibe mix. Take the wheel."); setAiPanelOpen(true); }}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 ${autoDjMode ? 'bg-pink-600 shadow-pink-500/30' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/30'}`}
            >
              <Icon name="radio" size={14} /> {autoDjMode ? 'STOP VIBE MIX' : 'START VIBE MIX'}
            </button>
            <div className="flex items-center gap-4 bg-black/40 px-6 py-3 rounded-2xl border border-white/10">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">VISUALS</span>
              <select value={vizMode} onChange={(e) => setVizMode(e.target.value as VisualizerMode)} className="bg-transparent text-xs font-black text-white focus:outline-none cursor-pointer">
                <option value={VisualizerMode.BARS}>BARS</option>
                <option value={VisualizerMode.WAVES}>WAVES</option>
                <option value={VisualizerMode.DOTS}>DOTS</option>
              </select>
            </div>
          </div>
        </header>

        <div className="mb-10"><SearchPanel onLoadTrack={handleLoadTrack} /></div>
        <AIFeatures trackA={trackA} trackB={trackB} isPlaying={isPlayingMashup} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 mb-10">
          <Deck ref={deckARef} id="A" track={trackA} masterBpm={masterBpm} masterKey={masterKey} syncEnabled={syncEnabled} onMagicMatch={() => {}} onReportBpm={handleBpmReport} />
          <Deck ref={deckBRef} id="B" track={trackB} masterBpm={masterBpm} masterKey={masterKey} syncEnabled={syncEnabled} onMagicMatch={() => {}} onReportBpm={handleBpmReport} />
        </div>

        <MashupEngine 
          onPlayMashup={handlePlayMashup} isPlaying={isPlayingMashup}
          masterBpm={masterBpm} setMasterBpm={setMasterBpm} masterKey={masterKey} setMasterKey={setMasterKey}
          syncEnabled={syncEnabled} setSyncEnabled={setSyncEnabled} onEQChange={() => {}} autoDjMode={autoDjMode} setAutoDjMode={setAutoDjMode}
        />
      </div>

      <div className="fixed bottom-8 right-8 z-[60] flex flex-col items-end gap-4">
        {aiPanelOpen && (
          <div className="w-[400px] bg-slate-900/98 backdrop-blur-3xl border border-white/20 rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-12 duration-500">
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                   <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-500 via-indigo-600 to-pink-500 flex items-center justify-center p-0.5 shadow-xl">
                     <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center relative overflow-hidden">
                        <div className={`absolute inset-0 bg-blue-500/10 ${isJDSpeaking ? 'animate-pulse' : ''}`} />
                        <Icon name="mic" size={24} className="text-white relative z-10" />
                     </div>
                   </div>
                   <div>
                      <h4 className="text-[12px] font-black uppercase tracking-[0.4em] text-blue-400">HOST: JD</h4>
                      <p className="text-[10px] font-bold text-slate-400 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isJDSpeaking ? 'bg-red-500 shadow-[0_0_8px_red] animate-pulse' : 'bg-green-500'}`}></span> {isJDSpeaking ? 'MICROPHONE LIVE' : 'LISTENING'}
                      </p>
                   </div>
                </div>
                <button onClick={() => setAiPanelOpen(false)} className="text-slate-500 hover:text-white transition-colors p-2">
                  <Icon name="stop" size={20} />
                </button>
             </div>
             
             <div className="bg-black/50 rounded-3xl p-6 mb-8 min-h-[120px] text-[15px] font-medium leading-relaxed text-indigo-100 italic border border-white/10 shadow-inner flex flex-col justify-center relative group">
                "{aiResponse}"
                {quotaExceeded && (
                  <button 
                    onClick={handleUpgradeKey}
                    className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 hover:bg-blue-500 text-[9px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full shadow-xl animate-bounce"
                  >
                    Upgrade Connection (New Key)
                  </button>
                )}
             </div>
             
             <form onSubmit={(e) => { e.preventDefault(); handleAIDJInteraction(); }} className="relative mb-8">
                <input 
                  type="text" value={aiInput} onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Drop a command for JD..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-6 pr-16 text-[15px] focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600 shadow-inner"
                />
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 p-3 rounded-xl hover:bg-indigo-500 transition-colors shadow-lg">
                  <Icon name="search" size={18} />
                </button>
             </form>
             
             <div className="flex flex-wrap gap-3">
               <button onClick={() => handleAIDJInteraction("JD, smooth blend to the next track.")} className="px-5 py-2.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all">Smooth Blend</button>
               <button onClick={handleUpgradeKey} className="px-5 py-2.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-500 hover:text-white transition-all">Select Project Key</button>
             </div>
          </div>
        )}
        <button 
          onClick={() => setAiPanelOpen(!aiPanelOpen)}
          className={`w-28 h-28 rounded-full flex items-center justify-center shadow-3xl transition-all transform hover:scale-105 active:scale-95 border-4 ${aiPanelOpen ? 'bg-indigo-600 border-indigo-300' : 'bg-slate-950 border-indigo-600/30'}`}
        >
          <div className="relative">
            <div className={`absolute inset-0 blur-3xl animate-pulse rounded-full ${isJDSpeaking ? 'bg-red-500/40' : aiPanelOpen ? 'bg-white/10' : 'bg-indigo-500/30'}`} />
            <Icon name="radio" size={48} className={`relative z-10 transition-colors ${aiPanelOpen ? 'text-white' : 'text-indigo-400'}`} />
            {!aiPanelOpen && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full border-4 border-slate-950 animate-ping shadow-lg"></span>}
          </div>
        </button>
      </div>
    </div>
  );
};

export default App;
