import React, { useState, useEffect } from 'react';
import { Save, X, RotateCcw, Loader2, AlertCircle, Check } from 'lucide-react';
import { doc, setDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { Song, RichDataEntry } from '../types';
import { RICH_DATA_MAP } from '../richDataMap';

interface SongEditorProps {
  song: Song;
  onClose: () => void;
  onSaved?: () => void;
}

const SongEditor: React.FC<SongEditorProps> = ({ song, onClose, onSaved }) => {
  // Get original/default values from RICH_DATA_MAP
  const originalData = RICH_DATA_MAP[song.number] as Partial<RichDataEntry> | undefined;

  // Track edited fields
  const [editedData, setEditedData] = useState<Partial<RichDataEntry>>({
    title: song.title,
    author: song.author,
    composer: song.composer,
    meter: song.meter,
    tune: song.tune || '',
    category: song.category,
    lyrics: song.lyrics,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Track if any changes have been made
  useEffect(() => {
    const hasChanges = 
      editedData.title !== song.title ||
      editedData.author !== song.author ||
      editedData.composer !== song.composer ||
      editedData.meter !== song.meter ||
      editedData.tune !== (song.tune || '') ||
      editedData.category !== song.category ||
      editedData.lyrics !== song.lyrics;
    
    setIsDirty(hasChanges);
  }, [editedData, song]);

  const handleFieldChange = (field: keyof RichDataEntry, value: string) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    // Validate required fields
    if (!editedData.title?.trim()) {
      showToast('Title is required', 'error');
      return;
    }

    setIsSaving(true);
    try {
      // Prepare data for Firestore (trim whitespace)
      const dataToSave: Partial<RichDataEntry> = {};
      
      if (editedData.title) dataToSave.title = editedData.title.trim();
      if (editedData.author) dataToSave.author = editedData.author.trim();
      if (editedData.composer) dataToSave.composer = editedData.composer.trim();
      if (editedData.meter) dataToSave.meter = editedData.meter.trim();
      if (editedData.tune) dataToSave.tune = editedData.tune.trim();
      if (editedData.category) dataToSave.category = editedData.category.trim();
      if (editedData.lyrics !== undefined) dataToSave.lyrics = editedData.lyrics; // Preserve formatting

      await setDoc(
        doc(db, 'song_metadata', song.number),
        dataToSave,
        { merge: true }
      );

      showToast('Changes saved successfully!');
      setIsDirty(false);
      
      // Call onSaved callback if provided
      if (onSaved) onSaved();
      
      // Close editor immediately - Firestore listener will update the UI
      setTimeout(() => onClose(), 500);
    } catch (error: any) {
      console.error('Save error:', error);
      showToast(`Failed to save: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetField = async (field: keyof RichDataEntry) => {
    if (!window.confirm(`Reset "${field}" to default value?`)) return;

    try {
      // Delete the field from Firestore to revert to default
      await setDoc(
        doc(db, 'song_metadata', song.number),
        { [field]: deleteField() },
        { merge: true }
      );

      // Update local state to original value
      const originalValue = originalData?.[field] || '';
      setEditedData(prev => ({ ...prev, [field]: originalValue }));
      
      showToast(`"${field}" reset to default`);
    } catch (error: any) {
      showToast(`Failed to reset: ${error.message}`, 'error');
    }
  };

  const handleCancel = () => {
    if (isDirty && !window.confirm('Discard unsaved changes?')) {
      return;
    }
    onClose();
  };

  // Check if a field has been overridden from default
  const isFieldOverridden = (field: keyof RichDataEntry): boolean => {
    const currentValue = editedData[field];
    const originalValue = originalData?.[field];
    
    // Consider empty/undefined as equivalent for comparison
    const normalizeCurrent = currentValue?.toString().trim() || '';
    const normalizeOriginal = originalValue?.toString().trim() || '';
    
    return normalizeCurrent !== normalizeOriginal;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!isSaving && isDirty) handleSave();
      }
      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, isDirty]);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Edit Hymn {song.number}
            {isDirty && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                Unsaved Changes
              </span>
            )}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Changes are saved to the database and will appear for all users
          </p>
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-4 mb-6">
        {/* Title */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-slate-700">
              Title *
              {isFieldOverridden('title') && (
                <span className="ml-2 text-xs text-indigo-600 font-normal">(Custom)</span>
              )}
            </label>
            {isFieldOverridden('title') && (
              <button
                onClick={() => handleResetField('title')}
                className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1"
              >
                <RotateCcw size={12} /> Reset
              </button>
            )}
          </div>
          <input
            type="text"
            value={editedData.title || ''}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-base"
            placeholder="Enter hymn title"
          />
        </div>

        {/* Author */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-slate-700">
              Author
              {isFieldOverridden('author') && (
                <span className="ml-2 text-xs text-indigo-600 font-normal">(Custom)</span>
              )}
            </label>
            {isFieldOverridden('author') && (
              <button
                onClick={() => handleResetField('author')}
                className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1"
              >
                <RotateCcw size={12} /> Reset
              </button>
            )}
          </div>
          <input
            type="text"
            value={editedData.author || ''}
            onChange={(e) => handleFieldChange('author', e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-base"
            placeholder="Enter author name"
          />
        </div>

        {/* Composer */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-slate-700">
              Composer
              {isFieldOverridden('composer') && (
                <span className="ml-2 text-xs text-indigo-600 font-normal">(Custom)</span>
              )}
            </label>
            {isFieldOverridden('composer') && (
              <button
                onClick={() => handleResetField('composer')}
                className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1"
              >
                <RotateCcw size={12} /> Reset
              </button>
            )}
          </div>
          <input
            type="text"
            value={editedData.composer || ''}
            onChange={(e) => handleFieldChange('composer', e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-base"
            placeholder="Enter composer name"
          />
        </div>

        {/* Tune */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-slate-700">
              Tune
              {isFieldOverridden('tune') && (
                <span className="ml-2 text-xs text-indigo-600 font-normal">(Custom)</span>
              )}
            </label>
            {isFieldOverridden('tune') && (
              <button
                onClick={() => handleResetField('tune')}
                className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1"
              >
                <RotateCcw size={12} /> Reset
              </button>
            )}
          </div>
          <input
            type="text"
            value={editedData.tune || ''}
            onChange={(e) => handleFieldChange('tune', e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-base"
            placeholder="Enter tune name"
          />
        </div>

        {/* Meter */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-slate-700">
              Meter
              {isFieldOverridden('meter') && (
                <span className="ml-2 text-xs text-indigo-600 font-normal">(Custom)</span>
              )}
            </label>
            {isFieldOverridden('meter') && (
              <button
                onClick={() => handleResetField('meter')}
                className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1"
              >
                <RotateCcw size={12} /> Reset
              </button>
            )}
          </div>
          <input
            type="text"
            value={editedData.meter || ''}
            onChange={(e) => handleFieldChange('meter', e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-base"
            placeholder="e.g., 8.8.8.8"
          />
        </div>

        {/* Category */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-slate-700">
              Category
              {isFieldOverridden('category') && (
                <span className="ml-2 text-xs text-indigo-600 font-normal">(Custom)</span>
              )}
            </label>
            {isFieldOverridden('category') && (
              <button
                onClick={() => handleResetField('category')}
                className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1"
              >
                <RotateCcw size={12} /> Reset
              </button>
            )}
          </div>
          <input
            type="text"
            value={editedData.category || ''}
            onChange={(e) => handleFieldChange('category', e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-base"
            placeholder="e.g., Psalm, Advent, etc."
          />
        </div>

        {/* Lyrics */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-slate-700">
              Lyrics
              {isFieldOverridden('lyrics') && (
                <span className="ml-2 text-xs text-indigo-600 font-normal">(Custom)</span>
              )}
            </label>
            {isFieldOverridden('lyrics') && (
              <button
                onClick={() => handleResetField('lyrics')}
                className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1"
              >
                <RotateCcw size={12} /> Reset
              </button>
            )}
          </div>
          <textarea
            value={editedData.lyrics || ''}
            onChange={(e) => handleFieldChange('lyrics', e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-base font-serif resize-y min-h-[300px]"
            placeholder="Enter lyrics with line breaks preserved"
          />
          <p className="text-xs text-slate-500 mt-1">
            Line breaks will be preserved as entered
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200">
        <button
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {isSaving ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save size={20} />
              Save Changes
            </>
          )}
        </button>
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          <X size={20} />
          Cancel
        </button>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-500 text-center">
          💡 Tip: Press <kbd className="px-2 py-1 bg-slate-100 rounded border border-slate-300 font-mono text-[10px]">Ctrl+S</kbd> to save or <kbd className="px-2 py-1 bg-slate-100 rounded border border-slate-300 font-mono text-[10px]">Esc</kbd> to cancel
        </p>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className={`px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-bold ${
            toast.type === 'success' 
              ? 'bg-emerald-600 text-white' 
              : 'bg-red-600 text-white'
          }`}>
            {toast.type === 'success' ? <Check size={16} strokeWidth={3} /> : <AlertCircle size={16} strokeWidth={3} />}
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
};

export default SongEditor;
