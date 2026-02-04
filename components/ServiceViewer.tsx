import React, { useState, useMemo } from 'react';
import { X, Calendar, Clock, ChevronLeft, Music, BookOpen, FileText, Mic, MoreHorizontal, Share2, Check } from 'lucide-react';
import { Service, Song } from '../types';
import { formatDuration, formatDurationLong, calculateTotalDuration } from '../utils/servicePlannerUtils';

interface ServiceViewerProps {
  service: Service;
  onClose: () => void;
  hymnalData: Song[];
  onSongSelect?: (song: Song) => void;
}

const ServiceViewer: React.FC<ServiceViewerProps> = ({
  service,
  onClose,
  hymnalData,
  onSongSelect
}) => {
  const [shareSuccess, setShareSuccess] = useState(false);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/service/${service.id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      alert(`Share this link:\n${shareUrl}`);
    }
  };

  // Group elements by their actual sections (not hardcoded sections)
  const sectionGroups = useMemo(() => {
    const groups: { [sectionTitle: string]: Service['elements'] } = {};
    
    service.elements.forEach(element => {
      if (!groups[element.section]) {
        groups[element.section] = [];
      }
      groups[element.section].push(element);
    });
    
    // Sort elements within each section by order
    Object.keys(groups).forEach(sectionTitle => {
      groups[sectionTitle].sort((a, b) => a.order - b.order);
    });
    
    return groups;
  }, [service.elements]);

  const getElementIcon = (type: string) => {
    switch (type) {
      case 'Song': return <Music size={16} style={{ color: '#5ba2d5' }} />;
      case 'Prayer': return <BookOpen size={16} className="text-indigo-600" />;
      case 'Scripture': return <FileText size={16} className="text-blue-600" />;
      case 'Sermon': return <Mic size={16} className="text-amber-600" />;
      default: return <MoreHorizontal size={16} className="text-slate-600" />;
    }
  };

  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-lg border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={onClose}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
            >
              <ChevronLeft size={20} />
              <span className="font-medium">Back</span>
            </button>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
                style={{ 
                  backgroundColor: shareSuccess ? '#10b981' : '#5ba2d5',
                  color: 'white'
                }}
              >
                {shareSuccess ? (
                  <>
                    <Check size={18} />
                    Link Copied!
                  </>
                ) : (
                  <>
                    <Share2 size={18} />
                    Share
                  </>
                )}
              </button>
              
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Service Header */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-bold text-slate-900 mb-6">
            {service.title}
          </h1>
          
          <div className="flex items-center justify-center gap-6 text-slate-600">
            {service.date && (
              <div className="flex items-center gap-2">
                <Calendar size={18} />
                <span className="font-medium">
                  {new Date(service.date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
            )}
            {service.time && (
              <div className="flex items-center gap-2">
                <Clock size={18} />
                <span className="font-medium">{service.time}</span>
              </div>
            )}
          </div>

          {service.notes && (
            <div className="mt-6 max-w-2xl mx-auto">
              <p className="text-slate-600 italic bg-slate-50 px-6 py-4 rounded-lg border border-slate-200">
                {service.notes}
              </p>
            </div>
          )}
          
          {/* Total Duration - Only show if service.showDurations is true (default true) */}
          {calculateTotalDuration(service.elements) > 0 && (service.showDurations ?? true) && (
            <div className="mt-6 flex items-center justify-center gap-2 text-slate-700 bg-indigo-50 px-4 py-3 rounded-lg border border-indigo-100 inline-flex mx-auto">
              <Clock size={18} className="text-indigo-600" />
              <span className="font-semibold">
                Estimated Duration: {formatDurationLong(calculateTotalDuration(service.elements))}
              </span>
            </div>
          )}
        </div>

        {/* Service Order */}
        <div className="space-y-8">
          {Object.entries(sectionGroups).map(([sectionTitle, sectionElements]) => {
            if (sectionElements.length === 0) return null;

            return (
              <div key={sectionTitle} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Section Header */}
                <div className="px-6 py-4" style={{ background: 'linear-gradient(to right, #5ba2d5, #4a8ec7)' }}>
                  <h2 className="text-xl font-bold text-white">
                    {sectionTitle}
                  </h2>
                </div>

                {/* Section Elements */}
                <div className="p-6 space-y-4">
                  {sectionElements.map((element, idx) => {
                    const isSong = element.type === 'Song' && element.songId;
                    const song = isSong ? hymnalData.find(s => s.number === element.songId) : null;
                    const isClickable = isSong && song && onSongSelect;

                    return (
                      <div 
                        key={element.id}
                        onClick={() => {
                          if (isClickable && song) {
                            onSongSelect(song);
                          }
                        }}
                        className={`flex gap-4 p-4 bg-slate-50 rounded-lg transition-all ${
                          isClickable 
                            ? 'hover:bg-indigo-50 hover:border-indigo-200 hover:shadow-md cursor-pointer border border-transparent' 
                            : 'hover:bg-slate-100'
                        }`}
                      >
                        {/* Content */}
                        <div className="flex-1">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                  {element.type}
                                </span>
                                {isClickable && (
                                  <span className="text-xs text-indigo-600 font-medium">Click to view</span>
                                )}
                              </div>
                              
                              <h3 className={`font-bold text-slate-900 text-lg mb-1 ${isClickable ? 'group-hover:text-indigo-600' : ''}`}>
                                {isSong && element.songId ? (
                                  <>
                                    <span style={{ color: '#5ba2d5' }}>#{element.songId}</span>{' '}
                                    {song?.title || element.title}
                                  </>
                                ) : (
                                  element.title
                                )}
                              </h3>

                              {element.details && (
                                <p className="text-slate-600 text-sm mt-2">
                                  {element.details}
                                </p>
                              )}

                              {element.assignedTo && (
                                <div 
                                  className="mt-2 inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full"
                                  style={{ color: '#5ba2d5', backgroundColor: '#e8f4fb' }}
                                >
                                  {element.assignedTo}
                                </div>
                              )}
                            </div>
                            
                            {/* Duration Badge - Only show if service.showDurations is true (default true) */}
                            {element.duration && (service.showDurations ?? true) && (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-mono font-semibold shrink-0">
                                <Clock size={14} />
                                {formatDuration(element.duration)}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Visual Indicator for Clickable Songs */}
                        {isClickable && (
                          <div className="flex items-center">
                            <ChevronLeft className="rotate-180 text-slate-300" size={20} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-slate-400 text-sm">
          <p>Service plan created {service.createdAt && 'seconds' in service.createdAt 
            ? new Date(service.createdAt.seconds * 1000).toLocaleDateString()
            : 'recently'}</p>
        </div>
      </div>
    </div>
  );
};

export default ServiceViewer;
