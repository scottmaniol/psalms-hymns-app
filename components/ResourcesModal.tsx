
import React from 'react';
import { X, ExternalLink, BookOpen, FileText, Music, Library } from 'lucide-react';

interface ResourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ResourcesModal: React.FC<ResourcesModalProps> = ({ isOpen, onClose }) => {
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
            <Library className="text-indigo-600" size={20} />
            Resources
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto text-slate-700 space-y-4">
            <a href="https://g3min.org/download/113104/?tmstv=1697823113" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 hover:border-indigo-100 transition-all group">
                <div className="bg-red-50 p-2 rounded-lg text-red-600 group-hover:text-red-700 shrink-0">
                    <FileText size={20} />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 text-sm">Download Hymnal PDF</h3>
                    <p className="text-xs text-slate-500">Official PDF from G3 Ministries</p>
                </div>
                <ExternalLink size={16} className="ml-auto text-slate-300 group-hover:text-indigo-600" />
            </a>

            <a href="https://hymnary.org/hymnal/PHLG2023" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 hover:border-indigo-100 transition-all group">
                <div className="bg-blue-50 p-2 rounded-lg text-blue-600 group-hover:text-blue-700 shrink-0">
                    <BookOpen size={20} />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 text-sm">Hymnary.org</h3>
                    <p className="text-xs text-slate-500">Detailed hymnal information</p>
                </div>
                <ExternalLink size={16} className="ml-auto text-slate-300 group-hover:text-indigo-600" />
            </a>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 text-center">
          <button onClick={onClose} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResourcesModal;
