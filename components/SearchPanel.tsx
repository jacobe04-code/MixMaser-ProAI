
import React, { useState } from 'react';
import { Track, DeckId } from '../types';
import { Icon } from '../constants';

interface SearchPanelProps {
  onLoadTrack: (id: DeckId, track: Track) => void;
}

const MOODS = [
  { label: '🔥 Peak Time', query: 'Top Charts Techno House' },
  { label: '🌅 Sunset Mix', query: 'Melodic Deep House chill' },
  { label: '🍹 Chill Vibe', query: 'Lo-fi beats ambient' },
  { label: '⚡ Energy Boost', query: 'High Energy Pop Dance' },
  { label: '🌌 Underground', query: 'Minimal Techno Tech House' }
];

const SearchPanel: React.FC<SearchPanelProps> = ({ onLoadTrack }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery) return;
    setLoading(true);
    try {
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&entity=song&limit=8`);
      const data = await response.json();
      const tracks: Track[] = data.results.map((r: any) => ({
        id: r.trackId,
        name: r.trackName,
        artist: r.artistName,
        image: r.artworkUrl100,
        url: r.previewUrl,
        type: 'preview',
        trackName: r.trackName,
        artistName: r.artistName
      }));
      setResults(tracks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  return (
    <div className="w-full bg-slate-900/60 backdrop-blur-2xl rounded-[2rem] border border-white/10 p-8 mb-12 shadow-2xl">
      <div className="flex flex-col md:flex-row gap-8 items-start mb-8">
        <div className="flex-1 w-full">
          <form onSubmit={onFormSubmit} className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <input 
                type="text" 
                placeholder="Find tracks, artists, or vibes..." 
                className="w-full bg-black/60 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all pl-12 shadow-inner"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <Icon name="search" size={20} />
              </div>
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 px-10 rounded-2xl font-black text-[10px] tracking-widest transition-all shadow-lg hover:shadow-blue-500/30 disabled:opacity-30"
            >
              {loading ? "SEARCHING..." : "FIND AUDIO"}
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {MOODS.map((mood) => (
              <button
                key={mood.label}
                onClick={() => { setQuery(mood.query); handleSearch(mood.query); }}
                className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-full px-4 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400 hover:text-white transition-all"
              >
                {mood.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {results.map(track => (
          <div key={track.id} className="group bg-black/40 border border-white/5 p-4 rounded-2xl hover:border-blue-500/30 hover:bg-black/60 transition-all shadow-lg">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative shrink-0">
                <img src={track.image || ''} alt="" className="w-14 h-14 rounded-xl object-cover bg-slate-800 shadow-md" />
                <div className="absolute inset-0 bg-blue-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm truncate group-hover:text-blue-400 transition-colors">{track.name}</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight truncate">{track.artist}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => onLoadTrack('A', track)}
                className="flex-1 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
              >
                LOAD A
              </button>
              <button 
                onClick={() => onLoadTrack('B', track)}
                className="flex-1 bg-pink-500/10 hover:bg-pink-500 text-pink-400 hover:text-white py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
              >
                LOAD B
              </button>
            </div>
          </div>
        ))}
        {results.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-2xl text-slate-600 font-bold uppercase tracking-[0.3em] text-[10px]">
            Enter a search or select a mood above to populate the library
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPanel;
