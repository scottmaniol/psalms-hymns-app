
// components/AboutModal.tsx

import React from 'react';
import { X, ExternalLink, BookOpen } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
  releaseNotes: string[];
  buyUrl: string;
}

const AboutModal: React.FC<AboutModalProps> = ({ 
  isOpen, 
  onClose, 
  version, 
  releaseNotes,
  buyUrl 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <img 
              src="https://firebasestorage.googleapis.com/v0/b/psalms-and-hymns-85ee4.firebasestorage.app/o/data%2FPHLG_logo_favicon.png?alt=media"
              alt="Logo"
              className="w-5 h-5 rounded-sm"
            />
            About
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto text-slate-700 space-y-6">
          
          {/* App Info */}
          <div className="text-center">
            <h3 className="text-xl font-bold text-slate-900">Psalms & Hymns to the Living God</h3>
            <p className="text-xs text-slate-400 mt-1">Version {version}</p>
            
            <div className="mt-4 flex justify-center">
              <img 
                src="/images/PLG_Cover.png"
                alt="Psalms & Hymns to the Living God Cover" 
                className="h-48 w-auto rounded-lg shadow-md border border-slate-100"
              />
            </div>
          </div>

          <div className="text-sm leading-relaxed">
            <p className="mb-4">
              This app is a digital companion for the <em>Psalms & Hymns to the Living God</em> hymnal. 
              It allows you to search for songs, view lyrics and scores, and listen to piano and vocal accompaniments.
            </p>
            <p>
              To support this work and obtain a physical copy of the hymnal, please visit the publisher's website.
            </p>
          </div>

          <div className="text-center">
            <a 
              href={buyUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
            >
              Buy Hymnal <ExternalLink size={16} />
            </a>
          </div>

          {/* Release Notes */}
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-sm font-bold text-slate-800 mb-3">Release Notes</h4>
            <ul className="space-y-3">
              {releaseNotes.map((note, index) => (
                <li key={index} className="text-xs text-slate-600 leading-snug flex gap-2">
                  <span className="text-indigo-400">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 text-center">
          <p className="text-[10px] text-slate-400">
            &copy; {new Date().getFullYear()} G3 Ministries. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
