
import React from 'react';
import { X, Share, PlusSquare, MoreVertical } from 'lucide-react';

interface InstallInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIos: boolean;
}

const InstallInstructionsModal: React.FC<InstallInstructionsModalProps> = ({ isOpen, onClose, isIos }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-sm rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        <div className="p-6 pb-0 text-center">
          <h3 className="text-lg font-bold text-slate-900 mb-2">Install App</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Install this application on your home screen for a better full-screen experience.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {isIos ? (
            <>
              <div className="flex items-start gap-4">
                <div className="bg-slate-100 p-2 rounded-lg shrink-0">
                  <Share className="text-blue-500" size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">1. Tap the Share Button</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Look for the square icon with an arrow, usually at the bottom of the screen.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-slate-100 p-2 rounded-lg shrink-0">
                  <PlusSquare className="text-slate-600" size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">2. Add to Home Screen</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Scroll down the list and tap "Add to Home Screen".
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-4">
                <div className="bg-slate-100 p-2 rounded-lg shrink-0">
                  <MoreVertical className="text-slate-600" size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">1. Open Browser Menu</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Tap the three dots icon (usually top right).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-slate-100 p-2 rounded-lg shrink-0">
                  <PlusSquare className="text-slate-600" size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">2. Install App</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Tap "Install App" or "Add to Home Screen".
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <button 
            onClick={onClose}
            className="text-indigo-600 font-medium text-sm hover:text-indigo-700"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallInstructionsModal;
