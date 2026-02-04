import React, { useState, useEffect } from 'react';
import { X, Save, Download, Trash2, FileText, Check, Copy } from 'lucide-react';

interface LyricsImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newLyrics: Record<string, string[]>) => void;
}

const LyricsImporter: React.FC<LyricsImporterProps> = ({ isOpen, onClose, onSave }) => {
  const [inputText, setInputText] = useState('');
  const [previewCount, setPreviewCount] = useState(0);
  const [status, setStatus] = useState<'idle' | 'success' | 'copied'>('idle');

  // Parse logic to match the format: No. Title Lyrics [Content...]
  const parseLyrics = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const newMap: Record<string, string[]> = {};
    
    // Regex to identify the start of a song: Number (digits + optional letters) followed by Title
    // This assumes the format you provided: "1 That Man Is Blest... Lyrics..."
    // Or standard copy paste where the number starts the line.
    
    let currentNumber = '';
    let currentBuffer: string[] = [];
    
    // Helper to save buffer
    const flushBuffer = () => {
      if (currentNumber && currentBuffer.length > 0) {
        // Clean up buffer: remove the first line if it contains the title/metadata we don't need in the lyrics body
        // For now, we just save all lines found under this number
        newMap[currentNumber] = [...currentBuffer];
      }
    };

    // Attempt to parse specific block format provided by user
    // Format often looks like: "1TitleLyricsStanza1..."
    // But raw copy-paste might differ. 
    // Let's try a robust line-by-line parser.

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if line starts with a Song Number (e.g., "1", "8A", "150")
      // followed by space and text.
      // We look for strict start of a new song marker.
      const match = line.match(/^(\d+[A-Za-z]?)\s+(.*)/);
      
      if (match) {
        // If we hit a new number, flush the old one
        flushBuffer();
        
        currentNumber = match[1];
        currentBuffer = [];
        
        // The rest of the line is the title. 
        // Usually the next line is "Lyrics" or the start of lyrics.
        // We skip adding the title line to the lyrics buffer.
        continue;
      }

      // Filter out the word "Lyrics" if it appears as a standalone header
      if (line.toLowerCase() === 'lyrics' || line.toLowerCase() === 'title') continue;
      
      // Filter out headers like "No." "Title"
      if (line.startsWith('No.') && line.includes('Title')) continue;

      // Add to buffer if we have a current number
      if (currentNumber) {
        currentBuffer.push(line);
      }
    }
    
    // Flush last
    flushBuffer();
    return newMap;
  };

  const handleProcess = () => {
    const parsed = parseLyrics(inputText);
    const count = Object.keys(parsed).length;
    setPreviewCount(count);
    if (count > 0) {
      onSave(parsed);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const handleCopyJson = () => {
    const saved = localStorage.getItem('imported_lyrics');
    if (saved) {
      navigator.clipboard.writeText(saved);
      setStatus('copied');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear all imported lyrics?")) {
        localStorage.removeItem('imported_lyrics');
        onSave({}); // Clear state
        setPreviewCount(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
              <Download size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Import Lyrics</h2>
              <p className="text-xs text-slate-500">Paste raw text from the website</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-hidden flex flex-col gap-4">
          <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg text-xs text-amber-800">
            <strong>Instructions:</strong> Copy the table or text blocks from the source (e.g. "1 That Man is Blest..."). 
            Ensure each song starts with its number (e.g., "1", "8A").
          </div>
          
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Paste text here...\n\nExample:\n1 That Man Is Blest\nThat man is blest who, fearing God,\nFrom sin restrains his feet...`}
            className="flex-1 w-full p-4 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
          />
          
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Detected: {previewCount > 0 ? `${previewCount} songs` : 'Waiting for input...'}</span>
            <div className="flex gap-2">
                <button onClick={handleClear} className="text-red-500 hover:text-red-700 flex items-center gap-1 px-2">
                    <Trash2 size={12} /> Clear Saved
                </button>
                <button onClick={handleCopyJson} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2">
                    {status === 'copied' ? <Check size={12}/> : <Copy size={12} />} Copy JSON
                </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 rounded-b-xl">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-medium text-sm hover:bg-slate-200 rounded-lg"
          >
            Close
          </button>
          <button 
            onClick={handleProcess}
            className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg flex items-center gap-2 transition-all ${status === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
          >
            {status === 'success' ? <Check size={16} /> : <Save size={16} />}
            {status === 'success' ? 'Saved!' : 'Parse & Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LyricsImporter;