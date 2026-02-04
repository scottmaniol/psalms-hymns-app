
import React from 'react';
import { Play, Pause, X, Music, RotateCcw, Cast, Airplay } from 'lucide-react';

interface FloatingPlayerProps {
  title: string;
  subtitle: string;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onClose: () => void;
  onClick: () => void;
  onRestart: () => void;
  onCastClick?: () => void;
  castState?: 'available' | 'connected' | 'unavailable';
  airPlayAvailable?: boolean;
}

const FloatingPlayer: React.FC<FloatingPlayerProps> = ({ 
  title, 
  subtitle, 
  isPlaying, 
  onTogglePlay,
  onClose,
  onClick,
  onRestart,
  onCastClick,
  castState = 'unavailable',
  airPlayAvailable = false
}) => {
  
  const showCast = castState !== 'unavailable' || airPlayAvailable;
  const isConnected = castState === 'connected';

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-6 md:right-auto md:bottom-6 z-[100] flex justify-center md:justify-start pointer-events-none">
      <div 
        onClick={onClick}
        className="bg-white rounded-full shadow-2xl border border-slate-200 p-2 pr-5 flex items-center gap-3 pointer-events-auto w-full md:w-auto max-w-full md:max-w-md cursor-pointer hover:bg-slate-50 transition-colors group"
      >
        {/* Restart Button */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onRestart();
          }}
          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors shrink-0 ml-1"
          title="Restart"
        >
          <RotateCcw size={16} />
        </button>

        {/* Play/Pause Button */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlay();
          }}
          className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-sm transition-colors shrink-0"
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
        </button>

        {/* Track Info */}
        <div className="flex flex-col flex-1 md:flex-none min-w-0 overflow-hidden w-32 sm:w-48">
          <span className="text-xs font-bold text-slate-800 truncate leading-tight group-hover:text-indigo-700 transition-colors">{title}</span>
          <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1 truncate">
             <Music size={10} /> {subtitle}
          </span>
        </div>

        {/* Cast/AirPlay Button */}
        {showCast && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onCastClick) onCastClick();
            }}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors shrink-0 ${
              isConnected ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            title={airPlayAvailable ? "AirPlay" : "Cast"}
          >
            {airPlayAvailable ? <Airplay size={16} /> : <Cast size={16} />}
          </button>
        )}

        {/* Close Button */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors ml-1 shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default FloatingPlayer;
