import React, { useState, useMemo, useEffect } from 'react';
import { Search, Music, X, ChevronDown, BarChart3, Eye, BarChart2, Clock } from 'lucide-react';
import { Song, Service, ServiceElement } from '../types';
import { HYMN_THEMES } from '../hymnThemes';
import { getSongUsageStats } from '../utils/songUsageUtils';
import { fetchAudioDuration, formatDuration } from '../utils/servicePlannerUtils';

interface SongLibraryPanelProps {
  hymnalData: Song[];
  orgServices: Service[];
  onDragStart: (song: Song) => void;
  currentServiceElements?: ServiceElement[]; // Current draft service elements
  currentServiceDate?: string; // Date of current service being edited
  onSongClick?: (song: Song) => void; // Open song in viewer
  onViewUsageHistory?: (song: Song | null) => void; // View usage history
}

type TimeFilter = 'all' | '30d' | '90d' | '6mo' | '1yr' | 'never';

const SongLibraryPanel: React.FC<SongLibraryPanelProps> = ({
  hymnalData,
  orgServices,
  onDragStart,
  currentServiceElements = [],
  currentServiceDate,
  onSongClick,
  onViewUsageHistory
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('90d');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [songDurations, setSongDurations] = useState<Map<string, number>>(new Map());

  // Calculate cutoff date based on time filter
  const getCutoffDate = (filter: TimeFilter): Date | null => {
    if (filter === 'all') return null;
    
    const now = new Date();
    switch (filter) {
      case '30d': return new Date(now.setDate(now.getDate() - 30));
      case '90d': return new Date(now.setDate(now.getDate() - 90));
      case '6mo': return new Date(now.setMonth(now.getMonth() - 6));
      case '1yr': return new Date(now.setFullYear(now.getFullYear() - 1));
      case 'never': return new Date(); // For "never used" filter
      default: return null;
    }
  };

  // Filter and enrich songs with usage data
  const filteredSongs = useMemo(() => {
    const cutoffDate = getCutoffDate(timeFilter);
    
    let songs = hymnalData;

    // Text search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      songs = songs.filter(song =>
        song.number.toLowerCase().includes(q) ||
        song.title.toLowerCase().includes(q) ||
        (song.tune && song.tune.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (selectedCategory !== 'All') {
      songs = songs.filter(song => song.category === selectedCategory);
    }

    // Enrich with usage stats and apply time filter
    return songs.map(song => {
      const stats = getSongUsageStats(song.number, orgServices, cutoffDate);
      
      // Check if song is in current draft service
      const inCurrentService = currentServiceElements.some(
        el => el.type === 'Song' && el.songId === song.number
      );
      
      // Add +1 to usage if in current service but not yet saved
      const adjustedCount = inCurrentService ? stats.count + 1 : stats.count;
      
      // Show current service date as last used if in current service
      let displayLastUsed = stats.lastDate;
      if (inCurrentService && currentServiceDate) {
        const serviceDate = new Date(currentServiceDate + 'T00:00:00');
        const formattedDate = serviceDate.toLocaleDateString('en-US', { 
          month: 'numeric', 
          day: 'numeric', 
          year: 'numeric' 
        });
        displayLastUsed = formattedDate;
      }
      
      return { 
        ...song, 
        usageCount: adjustedCount, 
        lastUsed: displayLastUsed,
        usageDates: stats.dates 
      };
    }).filter(song => {
      // Filter based on usage in timeframe
      if (timeFilter === 'never') {
        return song.usageCount === 0;
      }
      return true;
    }).sort((a, b) => {
      // Sort by number by default
      return a.number.localeCompare(b.number, undefined, { numeric: true });
    });
  }, [hymnalData, searchQuery, selectedCategory, timeFilter, orgServices, currentServiceElements]);

  // Fetch durations for visible songs
  useEffect(() => {
    filteredSongs.forEach(song => {
      // Only fetch if we don't already have it
      if (!songDurations.has(song.number) && song.accompanimentUrl) {
        fetchAudioDuration(song.accompanimentUrl)
          .then(duration => {
            setSongDurations(prev => new Map(prev).set(song.number, duration));
          })
          .catch(err => {
            console.error(`Failed to fetch duration for song ${song.number}:`, err);
          });
      }
    });
  }, [filteredSongs.map(s => s.number).join(',')]); // Re-fetch when filtered songs change

  const handleDragStart = (e: React.DragEvent, song: Song & { usageCount?: number; lastUsed?: string }) => {
    e.dataTransfer.setData('songId', song.number);
    e.dataTransfer.setData('songTitle', song.title);
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart(song);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="p-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Music size={20} className="text-indigo-600" />
            Song Library
          </h3>
          {onViewUsageHistory && (
            <button
              onClick={() => onViewUsageHistory(null)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm shadow-sm"
              title="View song usage history"
            >
              <BarChart2 size={18} />
              View History
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by number or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 bg-slate-100 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-2">
          {/* Category Filter */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full appearance-none bg-slate-100 text-slate-700 text-xs font-medium pl-3 pr-8 py-2 rounded-lg border-none focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
            >
              <option value="All">All Categories</option>
              {HYMN_THEMES.map(theme => (
                <option key={theme} value={theme}>{theme}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          {/* Time Filter */}
          <div className="relative">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
              className="w-full appearance-none bg-slate-100 text-slate-700 text-xs font-medium pl-3 pr-8 py-2 rounded-lg border-none focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="6mo">Last 6 Months</option>
              <option value="1yr">Last Year</option>
              <option value="never">Never Used</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        </div>

        {/* Results Count */}
        <p className="text-xs text-slate-500 mt-2">
          {filteredSongs.length} songs {timeFilter !== 'all' && `(${timeFilter})`}
        </p>
      </div>

      {/* Song List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredSongs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Music size={48} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No songs found</p>
            <p className="text-xs mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          filteredSongs.map((song) => (
            <div
              key={song.number}
              onClick={() => setSelectedSong(song)}
              className={`bg-white rounded-lg border-2 p-3 hover:shadow-md transition-all group relative cursor-pointer ${
                selectedSong?.number === song.number
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-slate-200 hover:border-indigo-400'
              }`}
            >
              <div 
                draggable
                onDragStart={(e) => handleDragStart(e, song)}
                className="cursor-grab active:cursor-grabbing"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-indigo-600 font-bold text-sm shrink-0">
                      {song.number}
                    </span>
                    <span className="font-semibold text-slate-800 text-sm truncate">
                      {song.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {song.category && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {song.category}
                      </span>
                    )}
                    {song.tune && song.tune !== 'Unknown' && (
                      <span className="text-xs text-slate-500">
                        {song.tune}
                      </span>
                    )}
                    </div>
                  </div>
                  {onSongClick && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSongClick(song);
                        }}
                        className="p-1.5 hover:bg-indigo-100 rounded transition-colors text-indigo-600 opacity-0 group-hover:opacity-100"
                        title="View song details"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  )}
                </div>

              {/* Usage Stats & Duration */}
              <div className="flex items-center justify-between gap-2">
                {song.usageCount !== undefined && (
                  <div className="flex items-center gap-2 text-xs">
                    <BarChart3 size={12} className="text-slate-400" />
                    <span className={`font-medium ${
                      song.usageCount === 0 
                        ? 'text-slate-400' 
                        : song.usageCount > 3 
                        ? 'text-amber-600' 
                        : 'text-emerald-600'
                    }`}>
                      {song.usageCount === 0 
                        ? 'Never used' 
                        : `Used ${song.usageCount}×`}
                    </span>
                    {song.lastUsed && (
                      <span className="text-slate-500">
                        • Last: {song.lastUsed}
                      </span>
                    )}
                  </div>
                )}
                
                {/* Duration Badge */}
                {songDurations.has(song.number) && (
                  <div className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                    <Clock size={12} className="text-slate-400" />
                    <span className="font-mono font-medium">
                      {formatDuration(songDurations.get(song.number)!)}
                    </span>
                  </div>
                )}
              </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SongLibraryPanel;
