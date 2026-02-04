
import React from 'react';
import { Play, Pause, AlertCircle, ListPlus, Check, Settings, Minus, Plus, Info, RotateCcw, Cast, Airplay, Lock, Clock } from 'lucide-react';

interface AudioPlayerProps {
  url: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;     // Is this specific track currently loaded in the global player?
  isPlaying: boolean;    // Is the global player currently playing?
  progress: number;      // 0-100
  onPlay: () => void;    // Request to play this track
  onTogglePlay: () => void; // Toggle play/pause for this track
  onRestart: () => void; // Restart track from beginning
  onAddToPlaylist: () => void;
  hasError: boolean;
  speed: number;
  transpose: number;
  onSpeedChange: (speed: number) => void;
  onTransposeChange: (transpose: number) => void;
  showSpeedControl?: boolean;
  onCastClick?: () => void;
  castState?: 'available' | 'connected' | 'unavailable';
  airPlayAvailable?: boolean;
  isLocked?: boolean; // Hard lock - totally disabled (legacy use or future use)
  isPreview?: boolean; // Soft lock - enables 15s preview mode
  onUnlock?: () => void; // Callback when locked item is clicked
  customColor?: string; // Optional hex color for custom theming
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  url, 
  label, 
  icon: Icon,
  isActive,
  isPlaying,
  progress,
  onPlay,
  onTogglePlay,
  onRestart,
  onAddToPlaylist,
  hasError,
  speed,
  transpose,
  onSpeedChange,
  onTransposeChange,
  showSpeedControl = true,
  onCastClick,
  castState = 'unavailable',
  airPlayAvailable = false,
  isLocked = false,
  isPreview = false,
  onUnlock,
  customColor
}) => {
  const [showAdded, setShowAdded] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);

  const handleButtonClick = () => {
    if (isLocked) {
        if (onUnlock) onUnlock();
        return;
    }
    
    if (isActive) {
      onTogglePlay();
    } else {
      onPlay();
    }
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Prevent adding if locked OR if it's a preview item (gated feature)
    if (isLocked || isPreview) {
        if (onUnlock) onUnlock();
        return;
    }
    onAddToPlaylist();
    setShowAdded(true);
    setTimeout(() => setShowAdded(false), 2000);
  };

  const showCast = (castState !== 'unavailable') || airPlayAvailable;
  const isConnected = castState === 'connected';

  // Determine if the add button should show a lock
  const isAddLocked = isLocked || isPreview;

  // Only render the player container if we have a URL. 
  // If no URL, show "Not Available" regardless of lock/preview state.
  if (!url) {
    return (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-3 opacity-60">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                <Icon size={18} className={customColor ? "" : "text-indigo-600"} style={customColor ? { color: customColor } : {}} />
                <span>{label}</span>
                </div>
                <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">Not Available</span>
            </div>
            <div className="flex items-center gap-3">
                <button disabled className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 text-slate-300">
                    <Play size={20} className="ml-0.5" />
                </button>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"></div>
            </div>
        </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border mb-3 relative overflow-hidden ${hasError ? 'border-red-200' : 'border-slate-200'} ${isLocked ? 'bg-slate-50' : ''}`}>
      
      {/* Locked Overlay (Subtle) */}
      {isLocked && (
          <div className="absolute top-2 right-2">
              <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200">
                  <Lock size={10} /> Premium
              </span>
          </div>
      )}

      {/* Preview Badge */}
      {isPreview && !isLocked && (
          <div className="absolute top-2 right-2">
              <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-indigo-100">
                  <Clock size={10} /> 45s Preview
              </span>
          </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-slate-700 font-semibold">
          <Icon 
            size={18} 
            className={hasError ? "text-red-500" : (isLocked ? "text-slate-400" : (customColor ? "" : "text-indigo-600"))} 
            style={(!hasError && !isLocked && customColor) ? { color: customColor } : {}}
          />
          <span className={isLocked ? "text-slate-500" : ""}>{label}</span>
        </div>
        {hasError && !isLocked && <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded flex items-center gap-1"><AlertCircle size={10}/> Error</span>}
        {isActive && !hasError && !isLocked && (
            <span 
                className={`text-xs px-2 py-1 rounded font-medium ${customColor ? '' : 'text-indigo-600 bg-indigo-50'}`}
                style={customColor ? { color: customColor, backgroundColor: `${customColor}20` } : {}}
            >
                Playing
            </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button 
          onClick={onRestart}
          disabled={!isActive || hasError || isLocked}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          title="Restart Song"
          style={customColor && isActive && !hasError ? { color: customColor } : {}}
        >
          <RotateCcw size={16} />
        </button>

        <button 
          onClick={handleButtonClick}
          disabled={(!url && !isLocked && !isPreview) || hasError}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 ${
            isLocked ? 'bg-slate-200 text-slate-500 hover:bg-amber-100 hover:text-amber-600' :
            hasError ? 'bg-red-50 text-red-300' : 
            (isActive && isPlaying) 
                ? (customColor ? 'hover:opacity-80' : 'bg-indigo-100 text-indigo-600') 
                : (customColor ? 'hover:opacity-90 shadow-sm' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm')
          }`}
          style={
            (!isLocked && !hasError) ? (
              (isActive && isPlaying) 
                ? (customColor ? { backgroundColor: `${customColor}20`, color: customColor } : {}) 
                : (customColor ? { backgroundColor: customColor, color: 'white' } : {})
            ) : {}
          }
        >
          {isLocked ? <Lock size={18} /> : (isActive && isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />)}
        </button>
        
        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden relative">
          <div 
            className={`h-full transition-all duration-100 ${hasError ? 'bg-red-300' : (customColor ? '' : 'bg-indigo-600')}`}
            style={{ 
                width: `${isActive && !isLocked ? progress : 0}%`,
                ...(customColor && !hasError ? { backgroundColor: customColor } : {})
            }}
          />
        </div>

        {showCast && !isLocked && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onCastClick) onCastClick();
            }}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors shrink-0 ${
              isConnected ? (customColor ? '' : 'bg-indigo-100 text-indigo-600') : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
            style={isConnected && customColor ? { backgroundColor: `${customColor}20`, color: customColor } : {}}
            title={airPlayAvailable ? "AirPlay" : "Cast"}
          >
            {airPlayAvailable ? <Airplay size={16} /> : <Cast size={16} />}
          </button>
        )}

        <button
          onClick={handleAddClick}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-all shrink-0 ${
            showAdded ? 'bg-emerald-100 text-emerald-600' : (customColor ? 'bg-slate-50 hover:bg-slate-100' : 'bg-slate-50 text-indigo-600 hover:bg-slate-100')
          }`}
          style={!showAdded && !isAddLocked && customColor ? { color: customColor } : {}}
          title={isAddLocked ? "Unlock to Add" : "Add to Playlist"}
        >
          {isAddLocked ? <Lock size={14} className="text-slate-400" /> : (showAdded ? <Check size={16} /> : <ListPlus size={16} />)}
        </button>

        {!hasError && !isConnected && !isLocked && (
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-all shrink-0 ${
              showSettings ? 'bg-slate-200 text-slate-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
            title="Playback Settings"
          >
            <Settings size={16} />
          </button>
        )}
      </div>

      {/* Settings Panel */}
      {showSettings && !hasError && !isConnected && !isLocked && (
        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100 animate-in slide-in-from-top-2 duration-200">
          
          {/* Info Note for Pitch Shifting - Only show if speed control is available, otherwise advice is confusing */}
          {showSpeedControl && transpose !== 0 && (
            <div className="mb-3 bg-amber-50 border border-amber-100 text-amber-800 text-[10px] p-2 rounded flex gap-2 items-start leading-tight">
               <Info size={14} className="shrink-0 mt-0.5" />
               <span><strong>Pitch Shift Active:</strong> Changing speed will also affect pitch. Reset pitch to 0 to control speed independently.</span>
            </div>
          )}

          {/* Speed Control */}
          {showSpeedControl && (
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-600">Speed ({speed.toFixed(1)}x)</span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onSpeedChange(Math.max(0.5, Number((speed - 0.1).toFixed(1))))}
                className="p-1 hover:bg-slate-200 rounded text-slate-500"
              >
                <Minus size={14}/>
              </button>
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.1" 
                value={speed}
                onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                className="w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                style={customColor ? { accentColor: customColor } : {}}
              />
              <button 
                onClick={() => onSpeedChange(Math.min(2.0, Number((speed + 0.1).toFixed(1))))}
                className="p-1 hover:bg-slate-200 rounded text-slate-500"
              >
                <Plus size={14}/>
              </button>
            </div>
          </div>
          )}

          {/* Transpose Control */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-600">Pitch ({transpose > 0 ? '+' : ''}{transpose})</span>
                {transpose !== 0 && (
                    <button 
                        onClick={() => onTransposeChange(0)}
                        className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 font-medium transition-colors ${customColor ? 'bg-slate-200 hover:bg-slate-300' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}
                        style={customColor ? { color: customColor } : {}}
                        title="Reset Pitch to 0 (Restores independent speed)"
                    >
                        <RotateCcw size={10} /> Reset
                    </button>
                )}
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onTransposeChange(Math.max(-2, transpose - 1))}
                disabled={transpose <= -2}
                className="p-1 hover:bg-slate-200 rounded text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Minus size={14}/>
              </button>
              <input 
                type="range" 
                min="-2" 
                max="0" 
                step="1" 
                value={transpose}
                onChange={(e) => onTransposeChange(parseInt(e.target.value))}
                className="w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                style={customColor ? { accentColor: customColor } : {}}
              />
              <button 
                onClick={() => onTransposeChange(Math.min(0, transpose + 1))}
                disabled={transpose >= 0}
                className="p-1 hover:bg-slate-200 rounded text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Plus size={14}/>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;
