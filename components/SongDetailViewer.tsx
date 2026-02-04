import React, { useState } from 'react';
import { X, FileText, Music as ScoreIcon, Headphones, ChevronLeft, Music, Mic } from 'lucide-react';
import { Song } from '../types';
import AudioPlayer from './AudioPlayer';
import StartingPitchButton from './StartingPitchButton';

interface SongDetailViewerProps {
  song: Song;
  onClose: () => void;
  // Audio player props
  playerState?: {
    currentUrl: string;
    isPlaying: boolean;
    progress: number;
    hasError: boolean;
    settings: {
      speed: number;
      transpose: number;
    };
  };
  onPlayTrack?: (url: string, label: string, song: Song) => void;
  onTogglePlay?: () => void;
  onRestartTrack?: () => void;
  onAddToPlaylist?: (song: Song, url: string, label: string) => void;
  onSpeedChange?: (speed: number) => void;
  onTransposeChange?: (transpose: number) => void;
  vocalAvailability?: { [key: string]: boolean };
  isPremium?: boolean;
  onOpenPremium?: () => void;
}

const SongDetailViewer: React.FC<SongDetailViewerProps> = ({ 
  song, 
  onClose,
  playerState,
  onPlayTrack,
  onTogglePlay,
  onRestartTrack,
  onAddToPlaylist,
  onSpeedChange,
  onTransposeChange,
  vocalAvailability = {},
  isPremium = false,
  onOpenPremium
}) => {
  const [activeTab, setActiveTab] = useState<'lyrics' | 'score' | 'listen'>('lyrics');
  
  // Check if audio player functionality is available
  const hasPlayerFunctionality = playerState && onPlayTrack && onTogglePlay && onRestartTrack;

  return (
    <div className="fixed inset-0 z-[500] bg-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm shrink-0">
        <button
          onClick={onClose}
          className="p-2 -ml-2 hover:bg-slate-100 rounded-full text-slate-600"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-slate-900 truncate leading-tight">
            {song.number}. {song.title}
          </h2>
          <p className="text-xs text-slate-500">{song.category}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-full text-slate-600"
        >
          <X size={24} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white shrink-0">
        <button
          onClick={() => setActiveTab('lyrics')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
            activeTab === 'lyrics'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText size={18} />
          Lyrics
        </button>
        <button
          onClick={() => setActiveTab('score')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
            activeTab === 'score'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ScoreIcon size={18} />
          Score
        </button>
        <button
          onClick={() => setActiveTab('listen')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
            activeTab === 'listen'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Headphones size={18} />
          Listen
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {activeTab === 'lyrics' && (
          <div className="p-6 max-w-3xl mx-auto">
            {/* Information Box */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-3 text-blue-700">
                <FileText size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">Information</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between py-1">
                  <span className="text-sm font-semibold text-slate-600">AUTHOR</span>
                  <span className="text-sm text-slate-900">{song.author || 'Unknown'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-sm font-semibold text-slate-600">TUNE</span>
                  <span className="text-sm text-slate-900">{song.tune || 'Unknown'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-sm font-semibold text-slate-600">COMPOSER</span>
                  <span className="text-sm text-slate-900">{song.composer || 'Unknown'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-sm font-semibold text-slate-600">METER</span>
                  <span className="text-sm text-slate-900">{song.meter || 'Unknown'}</span>
                </div>
              </div>
            </div>

            {/* Starting Pitch Button */}
            <StartingPitchButton songNumber={song.number} />

            {/* Lyrics */}
            <div className="bg-white rounded-lg p-8 shadow-sm border border-slate-200">
              <h3 className="text-center font-bold text-2xl text-slate-900 mb-8 font-serif">
                {song.title}
              </h3>
              {song.lyrics ? (
                <div className="font-serif text-lg text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {song.lyrics}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 italic">
                  <FileText size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Lyrics not available for this hymn.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'score' && (
          <div className="p-6 h-full">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 h-full overflow-hidden">
              {song.pdfUrl ? (
                <iframe
                  src={song.pdfUrl}
                  className="w-full h-full"
                  title={`Score for ${song.title}`}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400">
                  <ScoreIcon size={48} className="mb-4 opacity-20" />
                  <p className="text-sm text-slate-500 font-bold mb-2">Score Not Available</p>
                  <p className="text-sm">The sheet music for this hymn could not be loaded.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'listen' && (
          <div className="p-6 max-w-2xl mx-auto">
            {hasPlayerFunctionality ? (
              <div className="space-y-4">
                {/* Piano/Accompaniment */}
                <AudioPlayer
                  url={song.accompanimentUrl}
                  label="Piano Accompaniment"
                  icon={Music}
                  isActive={playerState!.currentUrl === song.accompanimentUrl}
                  isPlaying={playerState!.isPlaying}
                  progress={playerState!.progress}
                  onPlay={() => onPlayTrack!(song.accompanimentUrl, "Piano", song)}
                  onTogglePlay={onTogglePlay!}
                  onRestart={onRestartTrack!}
                  onAddToPlaylist={() => onAddToPlaylist?.(song, song.accompanimentUrl, "Piano")}
                  hasError={playerState!.currentUrl === song.accompanimentUrl && playerState!.hasError}
                  speed={playerState!.settings.speed}
                  transpose={playerState!.settings.transpose}
                  onSpeedChange={onSpeedChange}
                  onTransposeChange={onTransposeChange}
                  isLocked={!isPremium}
                  onUnlock={onOpenPremium}
                />
                
                {/* Vocal Performance */}
                <AudioPlayer
                  url={vocalAvailability[song.number] !== false ? song.vocalUrl : ""}
                  label="Vocal Performance"
                  icon={Mic}
                  isActive={playerState!.currentUrl === song.vocalUrl}
                  isPlaying={playerState!.isPlaying}
                  progress={playerState!.progress}
                  onPlay={() => onPlayTrack!(song.vocalUrl, "Vocal", song)}
                  onTogglePlay={onTogglePlay!}
                  onRestart={onRestartTrack!}
                  onAddToPlaylist={() => {
                    if (!isPremium && onOpenPremium) {
                      onOpenPremium();
                    } else {
                      onAddToPlaylist?.(song, song.vocalUrl, "Vocal");
                    }
                  }}
                  hasError={playerState!.currentUrl === song.vocalUrl && playerState!.hasError}
                  speed={playerState!.settings.speed}
                  transpose={playerState!.settings.transpose}
                  onSpeedChange={onSpeedChange}
                  onTransposeChange={onTransposeChange}
                  isLocked={!isPremium}
                  isPreview={!isPremium}
                  onUnlock={onOpenPremium}
                />
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Headphones size={48} className="text-indigo-600" />
                </div>
                <h3 className="font-bold text-xl text-slate-800 mb-2">{song.title}</h3>
                <p className="text-slate-500 font-medium mb-4">{song.tune}</p>
                <p className="text-sm text-slate-600 bg-blue-50 border border-blue-100 rounded-lg p-4">
                  Audio playback is available in the main app. Close this preview to return to the service planner.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SongDetailViewer;
