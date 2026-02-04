import React from 'react';
import { X, Sparkles, CalendarCheck, Music } from 'lucide-react';

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
}

const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Sparkles className="text-white" size={24} />
              </div>
              <div>
                <h2 className="font-bold text-slate-800 text-xl">What's New in Version 4.0</h2>
                <p className="text-sm text-slate-600">January 1, 2026</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-white/50 rounded-full text-slate-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto text-slate-700 space-y-6">
          {/* Service Planning */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarCheck className="text-indigo-600" size={20} />
              <h3 className="font-bold text-lg text-slate-900">Service Planning</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Plan your worship services with our new drag-and-drop service builder! Features include:
            </p>
            <ul className="text-sm text-slate-600 space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 mt-1">•</span>
                <span>Drag-and-drop interface to arrange service elements</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 mt-1">•</span>
                <span>Automatic timing calculations for your entire service</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 mt-1">•</span>
                <span>Planning Center integration to sync your services</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 mt-1">•</span>
                <span>Save and reuse service templates</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 mt-1">•</span>
                <span>Share services with your team</span>
              </li>
            </ul>
          </div>

          {/* Starting Pitch */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Music className="text-purple-600" size={20} />
              <h3 className="font-bold text-lg text-slate-900">Starting Pitch (Pitch Pipe)</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Find the perfect starting note for any hymn! Features include:
            </p>
            <ul className="text-sm text-slate-600 space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-1">•</span>
                <span>Press and hold to hear the starting pitch via MIDI playback</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-1">•</span>
                <span>Transpose options: 1/2 step down and 1 step down</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-1">•</span>
                <span>Automatically detects the soprano's starting note</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-1">•</span>
                <span>Available on Lyrics and Listen tabs for every hymn</span>
              </li>
            </ul>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
            <p className="text-sm text-indigo-900 font-medium">
              💡 <strong>Tip:</strong> Look for the "Service Planner" button in the main menu to start planning your services, and the "Starting Pitch" button on each hymn's page!
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <button 
            onClick={onClose} 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsNewModal;
