import React, { useState, useEffect, useMemo } from 'react';
import { X, Music, BookOpen, FileText, Mic, MoreHorizontal, Search, BarChart3, Clock } from 'lucide-react';
import { ServiceElement, Song, Service } from '../types';
import SongUsageHistoryModal from './SongUsageHistoryModal';
import { aggregateSongUsage } from '../utils/songUsageUtils';
import { fetchAudioDuration, formatDuration, parseDurationInput } from '../utils/servicePlannerUtils';

interface AddElementModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: string;
  onAddElement: (element: Omit<ServiceElement, 'id' | 'order'>) => void;
  hymnalData: Song[];
  editingElement?: ServiceElement | null;
  orgServices?: Service[]; // Services from the organization for usage history
}

const AddElementModal: React.FC<AddElementModalProps> = ({
  isOpen,
  onClose,
  section,
  onAddElement,
  hymnalData,
  editingElement,
  orgServices
}) => {
  const [selectedType, setSelectedType] = useState<'Song' | 'Prayer' | 'Scripture' | 'Sermon' | 'Other'>('Song');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [durationInput, setDurationInput] = useState('');
  const [isFetchingDuration, setIsFetchingDuration] = useState(false);

  // Auto-fetch duration when song is selected
  useEffect(() => {
    if (selectedSong && selectedType === 'Song') {
      setIsFetchingDuration(true);
      fetchAudioDuration(selectedSong.accompanimentUrl)
        .then(dur => {
          setDuration(dur);
          setDurationInput(formatDuration(dur));
        })
        .catch(err => {
          console.error('Failed to fetch duration:', err);
          setDuration(undefined);
          setDurationInput('');
        })
        .finally(() => {
          setIsFetchingDuration(false);
        });
    }
  }, [selectedSong, selectedType]);

  // Pre-populate form when editing
  useEffect(() => {
    if (editingElement) {
      setSelectedType(editingElement.type);
      setTitle(editingElement.title);
      setDetails(editingElement.details || '');
      setAssignedTo(editingElement.assignedTo || '');
      
      // Restore duration
      if (editingElement.duration) {
        setDuration(editingElement.duration);
        setDurationInput(formatDuration(editingElement.duration));
      }
      
      if (editingElement.type === 'Song' && editingElement.songId) {
        setSongSearchQuery(editingElement.songId);
        const song = hymnalData.find(s => s.number === editingElement.songId);
        setSelectedSong(song || null);
      }
    } else {
      // Reset form when adding new
      setSelectedType('Song');
      setTitle('');
      setDetails('');
      setAssignedTo('');
      setSongSearchQuery('');
      setSelectedSong(null);
      setDuration(undefined);
      setDurationInput('');
    }
  }, [editingElement, hymnalData, isOpen]);

  // Aggregate song usage data
  const songUsageMap = useMemo(() => {
    if (!orgServices || orgServices.length === 0) return new Map();
    
    const usageData = aggregateSongUsage(orgServices, hymnalData, 'all');
    const map = new Map();
    usageData.forEach(usage => {
      map.set(usage.songNumber, usage);
    });
    return map;
  }, [orgServices, hymnalData]);

  // Filter songs based on search query
  const matchedSongs = songSearchQuery
    ? hymnalData.filter(song => 
        song.number.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
        song.title.toLowerCase().includes(songSearchQuery.toLowerCase())
      ).slice(0, 5) // Limit to 5 results
    : [];

  const handleSubmit = () => {
    if (selectedType === 'Song' && !songSearchQuery) {
      alert('Please search and select a song');
      return;
    }
    if (selectedType !== 'Song' && !title) {
      alert('Please enter a title');
      return;
    }

    // Parse duration if manually entered (for non-songs or edited song durations)
    const finalDuration = selectedType === 'Song' 
      ? duration // Use auto-fetched duration for songs
      : parseDurationInput(durationInput); // Parse manual input for other types

    console.log('AddElementModal - finalDuration:', finalDuration, 'duration:', duration, 'durationInput:', durationInput);

    // Build element object, only including fields with values
    const newElement: Omit<ServiceElement, 'id' | 'order'> = {
      type: selectedType,
      section,
      title: selectedType === 'Song' 
        ? (selectedSong?.title || `Song #${songSearchQuery}`)
        : title,
      ...(details ? { details } : {}), // Only include details if not empty
      ...(assignedTo ? { assignedTo } : {}), // Only include assignedTo if not empty
      ...(selectedType === 'Song' && songSearchQuery ? { songId: songSearchQuery } : {}),
      ...(finalDuration && finalDuration > 0 ? { duration: finalDuration } : {}) // Include duration if set and > 0
    };

    console.log('AddElementModal - newElement:', newElement);

    onAddElement(newElement);
    
    // Reset form
    setTitle('');
    setDetails('');
    setAssignedTo('');
    setSongSearchQuery('');
    setSelectedSong(null);
    setSelectedType('Song');
    setDuration(undefined);
    setDurationInput('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-800">
                {editingElement ? 'Edit Element' : 'Add Element'}
              </h3>
              <p className="text-sm text-slate-500 mt-1">{section}</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-200/50 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Element Type Selection */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-600 uppercase mb-3">
              Element Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <button
                onClick={() => setSelectedType('Song')}
                className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                  selectedType === 'Song'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <Music size={24} />
                <span className="text-sm font-medium">Song</span>
              </button>

              <button
                onClick={() => setSelectedType('Prayer')}
                className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                  selectedType === 'Prayer'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <BookOpen size={24} />
                <span className="text-sm font-medium">Prayer</span>
              </button>

              <button
                onClick={() => setSelectedType('Scripture')}
                className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                  selectedType === 'Scripture'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <FileText size={24} />
                <span className="text-sm font-medium">Scripture</span>
              </button>

              <button
                onClick={() => setSelectedType('Sermon')}
                className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                  selectedType === 'Sermon'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <Mic size={24} />
                <span className="text-sm font-medium">Sermon</span>
              </button>

              <button
                onClick={() => setSelectedType('Other')}
                className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                  selectedType === 'Other'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <MoreHorizontal size={24} />
                <span className="text-sm font-medium">Other</span>
              </button>
            </div>
          </div>

          {/* Dynamic Input Fields Based on Type */}
          <div className="space-y-4">
            {selectedType === 'Song' ? (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-slate-700">
                      Search for Song
                    </label>
                    {orgServices && orgServices.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowHistoryModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <BarChart3 size={14} />
                        View History
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={songSearchQuery}
                    onChange={(e) => setSongSearchQuery(e.target.value)}
                    placeholder="Enter song number (e.g., 23, 100, 119A)"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Type the hymn number or title to search the database
                  </p>
                </div>

                {/* Song Search Results */}
                {matchedSongs.length > 0 && (
                  <div className="mt-3">
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                      Select a Song
                    </label>
                    <div className="space-y-2">
                      {matchedSongs.map(song => {
                        const usage = songUsageMap.get(song.number);
                        return (
                          <button
                            key={song.id}
                            type="button"
                            onClick={() => {
                              setSelectedSong(song);
                              setSongSearchQuery(song.number);
                            }}
                            className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                              selectedSong?.id === song.id
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded">
                                {song.number}
                              </span>
                              <div className="flex-1">
                                <p className="font-semibold text-slate-800">{song.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {song.tune && `Tune: ${song.tune}`} • {song.category}
                                </p>
                                {usage && (
                                  <p className="text-xs text-indigo-600 mt-1 font-medium">
                                    Used {usage.count}× • Last: {usage.latestUse.toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Selected Song Preview */}
                {selectedSong && (
                  <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs font-bold text-green-700 uppercase mb-2">Selected</p>
                    <p className="font-bold text-slate-800">
                      {selectedSong.number}. {selectedSong.title}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {selectedSong.tune} • {selectedSong.category}
                    </p>
                  </div>
                )}

                {/* Details field for songs */}
                <div className="mt-4">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Details (Optional)
                  </label>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="e.g., Stanzas 1, 3, 5 only • A cappella • Piano accompaniment"
                    rows={2}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Add notes about how this song should be performed
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`Enter ${selectedType.toLowerCase()} title`}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Details (Optional)
                  </label>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder={
                      selectedType === 'Scripture' ? 'e.g., John 3:16-21' :
                      selectedType === 'Prayer' ? 'e.g., Led by Elder John' :
                      selectedType === 'Sermon' ? 'e.g., "The Gospel of Grace" - Pastor Smith' :
                      'Additional notes or details'
                    }
                    rows={3}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  />
                </div>
              </>
            )}
            
            {/* Assigned To field - applies to all element types */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Assigned To (Optional)
              </label>
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="e.g., John Smith, Worship Team, Pastor Dave"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-2">
                Optionally assign this element to a person or team
              </p>
            </div>

            {/* Duration field */}
            <div className="mt-4">
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <Clock size={16} />
                Duration
                {selectedType !== 'Song' && <span className="text-xs font-normal text-slate-500">(Optional)</span>}
              </label>
              
              {selectedType === 'Song' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={durationInput}
                    readOnly
                    placeholder={isFetchingDuration ? "Fetching..." : "Select a song first"}
                    className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 font-mono"
                  />
                  {isFetchingDuration && (
                    <div className="text-sm text-indigo-600 animate-pulse">
                      Loading...
                    </div>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  placeholder="e.g., 3:45 or 5"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                />
              )}
              
              <p className="text-xs text-slate-500 mt-2">
                {selectedType === 'Song' 
                  ? "Duration is automatically fetched from the piano accompaniment"
                  : "Format: MM:SS (e.g., 3:45) or just minutes (e.g., 5 for 5 minutes)"
                }
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-sm"
          >
            {editingElement ? 'Update Element' : 'Add Element'}
          </button>
        </div>
        
      </div>

      {/* Song Usage History Modal */}
      {orgServices && (
        <SongUsageHistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          services={orgServices}
          hymnalData={hymnalData}
          onSelectSong={(songNumber) => {
            setSongSearchQuery(songNumber);
            const song = hymnalData.find(s => s.number === songNumber);
            setSelectedSong(song || null);
          }}
        />
      )}
    </div>
  );
};

export default AddElementModal;
