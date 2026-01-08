
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Track, DeckId, VisualizerMode } from './types';
import Deck, { DeckHandle } from './components/Deck';
import MashupEngine from './components/MashupEngine';
import SearchPanel from './components/SearchPanel';
import Visualizer from './components/Visualizer';
import AIFeatures from './components/AIFeatures';
import { Icon } from './constants';
import { generateMagicMatch, interactWithAIDJ, generateJDVoice } from './services/geminiService';
import { audioEngine } from './services/audioService';
import * as Tone from 'tone';

const VIBE_OPTIONS = [
  { label: 'TOP HITS', query: 'Top 40 Pop Hits' },
  { label: 'TECHNO', query: 'Dark Underground Techno' },
  { label: 'HOUSE', query: 'Classic Soulful House' },
  { label: 'LO-FI', query: 'Chill Lo-fi Hip Hop beats' },
  { label: 'DISCO', query: 'Nu-Disco Funk' },
  { label: 'HIP HOP', query: '90s Boom Bap Hip Hop' },
  { label: 'AMBIENT', query: 'Ambient Cinematic Soundscapes' },
  { label: 'ROCK', query: 'Classic Rock Anthems' },
  { label: 'JAZZ', query: 'Smooth Contemporary Jazz' }
];

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
  const [audioStarted, setAudioStarted] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiResponse, setAiResponse] = useState('JD System Dormant. Awaiting authorization.');
  const [isJDActive, setIsJDActive] = useState(false);
  const [crossfade, setCrossfade] = useState(0.5);
  const [aiHistory, setAiHistory] = useState<any[]>([]);
  const [isJDSpeaking, setIsJDSpeaking] = useState(false);
  const [vibeMood, setVibeMood] = useState<string>(VIBE_OPTIONS[0].query);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const deckARef = useRef<DeckHandle>(null);
  const deckBRef = useRef<DeckHandle>(null);
  const isInteracting = useRef(false);
  const currentActiveDeck = useRef<DeckId>('A');
  const vibeTimerRef = useRef<number | null>(null);
  const nextTrackTimerRef = useRef<number | null>(null);

  const handleBpmReport = useCallback((bpm: number) => {
    if (!trackA && !trackB) setMasterBpm(bpm);
  }, [trackA, trackB]);

  const initAudio = async () => {
    try {
      await Tone.start();
      await audioEngine.start();
      setAudioStarted(true);
      setAiPanelOpen(true);
    } catch (e) {
      console.error("Audio Context Failed", e);
    }
  };

  const activateJD = async () => {
    if (!audioStarted) await initAudio();
    setIsJDActive(true);
    const welcome = "JD is on the air. Systems are nominal. Monitoring spectral density and vibe levels.";
    setAiResponse(welcome);
    speakAsJD(welcome);
  };

  const deactivateJD = () => {
    setIsJDActive(false);
    setAiResponse("JD System Dormant. Awaiting authorization.");
  };

  const speakAsJD = async (text: string) => {
    if (!text || !isJDActive) return;
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
      } else {
        setIsJDSpeaking(false);
        audioEngine.duckMusic(false);
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
    }
  };

  const handleMagicMatch = async (sourceDeckId: DeckId) => {
    const sourceTrack = sourceDeckId === 'A' ? trackA : trackB;
    const targetDeckId = sourceDeckId === 'A' ? 'B' : 'A';
    
    try {
      let matchQuery = "";
      if (sourceTrack) {
        matchQuery = await generateMagicMatch(
          sourceTrack.name,
          sourceTrack.artist,
          masterKey,
          masterBpm,
          targetDeckId,
          vibeMood // Pass current vibe to bias the AI
        );
      } else {
        matchQuery = vibeMood;
      }

      const searchRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(matchQuery)}&entity=song&limit=5`);
      const data = await searchRes.json();
      
      if (data.results?.length > 0) {
        // Pick a random one from top 5 to keep the variety up
        const rIdx = Math.floor(Math.random() * data.results.length);
        const r = data.results[rIdx];
        const track: Track = {
          id: r.trackId,
          name: r.trackName,
          artist: r.artistName,
          image: r.artworkUrl100,
          url: r.previewUrl,
          type: 'preview',
          trackName: r.trackName,
          artistName: r.artistName
        };
        
        if (targetDeckId === 'A') setTrackA(track);
        else setTrackB(track);
        return track;
      }
    } catch (err) {
      console.error("Magic Mix Failed:", err);
    }
    return null;
  };

  const prepareNextVibeTrack = async () => {
    const sourceDeck = currentActiveDeck.current;
    if (isJDActive && Math.random() > 0.85) {
        speakAsJD(`Synchronizing frequency domain. Aligning next sequence in the ${vibeMood.split(' ').pop()} spectrum.`);
    }
    await handleMagicMatch(sourceDeck);
  };

  const executeVibeTransition = () => {
    const sourceDeck = currentActiveDeck.current;
    const targetDeck = sourceDeck === 'A' ? 'B' : 'A';
    const targetRef = targetDeck === 'A' ? deckARef : deckBRef;
    const sourceRef = sourceDeck === 'A' ? deckARef : deckBRef;

    // Trigger Play on target
    targetRef.current?.play();

    // Crossfade Logic
    const startFade = crossfade;
    const endFade = targetDeck === 'A' ? 0 : 1;
    let startT = performance.now();
    const duration = 2500; // 2.5 second snappy crossfade

    const anim = (now: number) => {
      const p = Math.min((now - startT) / duration, 1);
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const currentVal = startFade + (endFade - startFade) * eased;
      
      setCrossfade(currentVal);
      audioEngine.crossFade.fade.value = currentVal;
      
      if (p < 1) {
        requestAnimationFrame(anim);
      } else {
        sourceRef.current?.stop();
        currentActiveDeck.current = targetDeck;
      }
    };
    requestAnimationFrame(anim);
  };

  const toggleVibeMix = async () => {
    if (!audioStarted) await initAudio();
    
    const newAutoMode = !autoDjMode;
    setAutoDjMode(newAutoMode);

    if (newAutoMode) {
      // 1. Initial Track Load based on vibe
      const searchRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(vibeMood)}&entity=song&limit=1`);
      const data = await searchRes.json();
      if (data.results?.[0]) {
          const r = data.results[0];
          const track: Track = { id: r.trackId, name: r.trackName, artist: r.artistName, image: r.artworkUrl100, url: r.previewUrl, type: 'preview', trackName: r.trackName, artistName: r.artistName };
          setTrackA(track);
          setCrossfade(0);
          audioEngine.crossFade.fade.value = 0;
          currentActiveDeck.current = 'A';
          setIsPlayingMashup(true);
          // Wait for load then play
          setTimeout(() => deckARef.current?.play(), 500);
      }
    } else {
      setIsPlayingMashup(false);
      deckARef.current?.stop();
      deckBRef.current?.stop();
      if (vibeTimerRef.current) clearInterval(vibeTimerRef.current);
      if (nextTrackTimerRef.current) clearTimeout(nextTrackTimerRef.current);
    }
  };

  useEffect(() => {
    if (!autoDjMode || !isPlayingMashup) return;

    const startVibeLoop = () => {
        // Clear old timers
        if (vibeTimerRef.current) clearInterval(vibeTimerRef.current);
        if (nextTrackTimerRef.current) clearTimeout(nextTrackTimerRef.current);

        // Transition every 28 seconds (tail end of a 30s preview)
        vibeTimerRef.current = window.setInterval(() => {
            executeVibeTransition();
            
            // 15 seconds into the CURRENT song, start finding the NEXT one
            nextTrackTimerRef.current = window.setTimeout(() => {
                prepareNextVibeTrack();
            }, 15000);
        }, 28000);
        
        // Immediate preparation for the first upcoming switch
        nextTrackTimerRef.current = window.setTimeout(() => {
            prepareNextVibeTrack();
        }, 15000);
    };

    startVibeLoop();

    return () => {
      if (vibeTimerRef.current) clearInterval(vibeTimerRef.current);
      if (nextTrackTimerRef.current) clearTimeout(nextTrackTimerRef.current);
    };
  }, [autoDjMode, isPlayingMashup]);

  const handleAIDJInteraction = async (inputOverride?: string) => {
    if (isInteracting.current || !isJDActive) return;
    const prompt = inputOverride || aiInput;
    if (!prompt.trim()) return;

    isInteracting.current = true;
    if (!inputOverride) setAiInput('');
    setAiResponse('...analyzing audio spectrum...');

    const context = {
      deckA: trackA ? { name: trackA.name, artist: trackA.artist } : 'Empty',
      deckB: trackB ? { name: trackB.name, artist: trackB.artist } : 'Empty',
      masterBpm,
      crossfade,
      isPlaying: isPlayingMashup,
      autoPilot: autoDjMode,
      currentVibe: vibeMood,
      hostActive: isJDActive
    };

    try {
      const result = await interactWithAIDJ(prompt, aiHistory, context);
      if (!result) throw new Error("Null result");

      const newResponse = result.text || 'Acknowledged.';
      setAiResponse(newResponse);
      setAiHistory(prev => [...prev.slice(-6), { role: 'user', parts: [{ text: prompt }] }, { role: 'model', parts: [{ text: newResponse }] }]);
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
            const end = call.args.targetDeck === 'A' ? 0 : 1;
            const durMs = (call.args.duration || 5) * 1000;
            const start = crossfade;
            let startT = performance.now();
            const anim = (now: number) => {
              const p = Math.min((now - startT) / durMs, 1);
              const val = start + (end - start) * p;
              setCrossfade(val);
              audioEngine.crossFade.fade.value = val;
              if (p < 1) requestAnimationFrame(anim);
              else {
                currentActiveDeck.current = call.args.targetDeck;
                if (call.args.swapOtherDeck) handleAIDJInteraction(`JD, cycle the silent deck harmonics.`);
              }
            };
            requestAnimationFrame(anim);
          }
          if (call.name === 'vibe_shift') {
            setVibeMood(call.args.mood);
            const searchRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(call.args.mood)}&entity=song&limit=2`);
            const data = await searchRes.json();
            if (data.results?.length >= 2) {
              setTrackA({...data.results[0], url: data.results[0].previewUrl, name: data.results[0].trackName, artist: data.results[0].artistName, image: data.results[0].artworkUrl100});
              setTrackB({...data.results[1], url: data.results[1].previewUrl, name: data.results[1].trackName, artist: data.results[1].artistName, image: data.results[1].artworkUrl100});
              setCrossfade(0);
              audioEngine.crossFade.fade.value = 0;
              currentActiveDeck.current = 'A';
              deckARef.current?.play();
              setIsPlayingMashup(true);
              setAutoDjMode(true);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.message?.includes('429')) {
        setAiResponse("Transmission limit reached. Signal degradation detected.");
        setQuotaExceeded(true);
      } else {
        setAiResponse("Signal dropped. Re-calibrating...");
      }
    } finally {
      isInteracting.current = false;
    }
  };

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
      if (autoDjMode) {
          toggleVibeMix();
      } else {
          deckARef.current?.play(); deckBRef.current?.play();
          setIsPlayingMashup(true);
      }
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
           <p className="text-slate-400 max-w-sm mb-12 text-sm uppercase tracking-[0.3em] font-bold">Awaiting hardware initialization.</p>
           <button onClick={initAudio} className="px-16 py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-black text-xs uppercase tracking-[0.4em] transform active:scale-95 transition-all shadow-xl shadow-blue-500/30">
             INITIALIZE AUDIO CORE
           </button>
        </div>
      )}

      <div className={`relative z-10 p-6 max-w-7xl mx-auto transition-all duration-1000 ${uiVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-8 bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
          <div className="flex flex-col">
            <h1 className="text-5xl font-black italic tracking-tighter bg-gradient-to-r from-blue-400 via-indigo-400 to-pink-500 bg-clip-text text-transparent uppercase">
              MIXMASTER <span className="text-white/20 font-light text-base not-italic tracking-[0.4em] ml-2">PRO AI</span>
            </h1>
            <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.5em] mt-3 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isJDSpeaking ? 'bg-red-500 shadow-[0_0_10px_red] animate-pulse' : (isJDActive ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-slate-700')}`}></span> {isJDSpeaking ? 'ON AIR' : (isJDActive ? 'JD STANDBY' : 'JD DORMANT')}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-4 bg-black/40 px-6 py-4 rounded-2xl border border-white/10 shadow-inner">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SET VIBE</span>
               <select 
                 value={vibeMood} 
                 onChange={(e) => setVibeMood(e.target.value)}
                 className="bg-transparent text-[11px] font-black text-blue-400 focus:outline-none cursor-pointer uppercase tracking-wider hover:text-blue-300 transition-colors"
               >
                 {VIBE_OPTIONS.map(v => <option key={v.query} value={v.query} className="bg-slate-900 text-white">{v.label}</option>)}
               </select>
            </div>

            <button 
              onClick={toggleVibeMix}
              className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-3 border-2 transform active:scale-95 ${autoDjMode ? 'bg-pink-600 border-pink-400 text-white shadow-pink-500/40' : 'bg-slate-800 border-white/10 text-slate-400 hover:text-white hover:border-white/20'}`}
            >
              <Icon name="refresh" size={16} className={autoDjMode ? 'animate-spin' : ''} /> {autoDjMode ? 'STOP VIBE MIX' : 'START VIBE MIX'}
            </button>
            
            <div className="flex items-center gap-4 bg-black/40 px-6 py-4 rounded-2xl border border-white/10">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">VISUALS</span>
              <select value={vizMode} onChange={(e) => setVizMode(e.target.value as VisualizerMode)} className="bg-transparent text-xs font-black text-white focus:outline-none cursor-pointer uppercase">
                <option value={VisualizerMode.BARS} className="bg-slate-900">BARS</option>
                <option value={VisualizerMode.WAVES} className="bg-slate-900">WAVES</option>
                <option value={VisualizerMode.DOTS} className="bg-slate-900">DOTS</option>
              </select>
            </div>
          </div>
        </header>

        <div className="mb-10"><SearchPanel onLoadTrack={handleLoadTrack} /></div>
        <AIFeatures trackA={trackA} trackB={trackB} isPlaying={isPlayingMashup} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 mb-10">
          <Deck ref={deckARef} id="A" track={trackA} masterBpm={masterBpm} masterKey={masterKey} syncEnabled={syncEnabled} onMagicMatch={handleMagicMatch} onReportBpm={handleBpmReport} />
          <Deck ref={deckBRef} id="B" track={trackB} masterBpm={masterBpm} masterKey={masterKey} syncEnabled={syncEnabled} onMagicMatch={handleMagicMatch} onReportBpm={handleBpmReport} />
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
                   <div className={`w-14 h-14 rounded-full flex items-center justify-center p-0.5 shadow-xl transition-all ${isJDActive ? 'bg-gradient-to-tr from-blue-500 via-indigo-600 to-pink-500' : 'bg-slate-800'}`}>
                     <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center relative overflow-hidden">
                        {isJDActive && <div className={`absolute inset-0 bg-blue-500/10 ${isJDSpeaking ? 'animate-pulse' : ''}`} />}
                        <Icon name="mic" size={24} className={`relative z-10 ${isJDActive ? 'text-white' : 'text-slate-600'}`} />
                     </div>
                   </div>
                   <div>
                      <h4 className="text-[12px] font-black uppercase tracking-[0.4em] text-blue-400">HOST: JD</h4>
                      <p className="text-[10px] font-bold text-slate-400 flex items-center gap-2">
                        {isJDActive ? (
                          <><span className={`w-2 h-2 rounded-full ${isJDSpeaking ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span> {isJDSpeaking ? 'TRANSMITTING' : 'LISTENING'}</>
                        ) : 'OFF AIR'}
                      </p>
                   </div>
                </div>
                <button onClick={() => setAiPanelOpen(false)} className="text-slate-500 hover:text-white transition-colors p-2">
                  <Icon name="stop" size={20} />
                </button>
             </div>
             
             <div className={`rounded-3xl p-6 mb-8 min-h-[100px] text-[15px] font-medium leading-relaxed italic border shadow-inner flex flex-col justify-center relative ${isJDActive ? 'bg-black/50 text-indigo-100 border-white/10' : 'bg-slate-950 text-slate-600 border-white/5'}`}>
                "{aiResponse}"
                {quotaExceeded && (
                  <button onClick={handleUpgradeKey} className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-[9px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full shadow-xl">Update Key</button>
                )}
             </div>
             
             {isJDActive ? (
               <form onSubmit={(e) => { e.preventDefault(); handleAIDJInteraction(); }} className="relative mb-6">
                  <input 
                    type="text" value={aiInput} onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Command JD..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-16 text-[14px] focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
                  />
                  <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 p-2.5 rounded-xl hover:bg-indigo-500 shadow-lg">
                    <Icon name="search" size={16} />
                  </button>
               </form>
             ) : (
               <button onClick={activateJD} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] mb-6 shadow-xl shadow-blue-500/20">
                 ACTIVATE JD CORE
               </button>
             )}
             
             <div className="flex flex-wrap gap-2">
               {isJDActive && <button onClick={deactivateJD} className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-[9px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500 hover:text-white transition-all">Deactivate</button>}
               <button onClick={handleUpgradeKey} className="px-4 py-2 rounded-xl bg-slate-500/10 border border-slate-500/20 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-500 hover:text-white transition-all">Update Key</button>
             </div>
          </div>
        )}
        <button 
          onClick={() => { if(!aiPanelOpen) setAiPanelOpen(true); }}
          className={`w-28 h-28 rounded-full flex items-center justify-center shadow-3xl transition-all transform hover:scale-105 active:scale-95 border-4 ${isJDActive ? 'bg-indigo-600 border-indigo-300 shadow-indigo-500/40' : 'bg-slate-950 border-slate-800'}`}
        >
          <div className="relative">
            <div className={`absolute inset-0 blur-3xl animate-pulse rounded-full ${isJDActive ? 'bg-indigo-500/30' : ''}`} />
            <Icon name="radio" size={48} className={`relative z-10 transition-colors ${isJDActive ? 'text-white' : 'text-slate-600'}`} />
          </div>
        </button>
      </div>
    </div>
  );
};

export default App;
