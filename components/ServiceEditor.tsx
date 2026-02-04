import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Calendar, Clock, Save, ChevronLeft, Trash2, Mail, List, GripVertical, Edit3, Plus, ChevronDown, Settings, ChevronUp, Eye } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Service, ServiceElement, Song, ServiceTemplate, ServiceSection } from '../types';
import { SERVICE_SECTIONS } from '../constants';
import AddElementModal from './AddElementModal';
import SongLibraryPanel from './SongLibraryPanel';
import SongDetailViewer from './SongDetailViewer';
import ServiceViewer from './ServiceViewer';
import SongUsageHistoryModal from './SongUsageHistoryModal';
import { generateElementId, getNextOrder, formatDuration, formatDurationLong, calculateTotalDuration, parseDurationInput, fetchAudioDuration, generatePlaylistName } from '../utils/servicePlannerUtils';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';

interface ServiceEditorProps {
  service: Service;
  onClose: () => void;
  onSave: (updatedService: Partial<Service>) => Promise<void>;
  hymnalData: Song[];
  onCreatePlaylist?: (serviceTitle: string, songs: Song[]) => Promise<void>;
  orgServices?: Service[]; // All services from the organization for usage history
  templates?: ServiceTemplate[]; // Available templates for this organization
  userId?: string; // For creating templates
  // Audio player props
  playerState?: {
    currentUrl: string;
    isPlaying: boolean;
    progress: number;
    hasError: boolean;
    settings: {
      speed: number;
      transpose: number;
    };
  };
  onPlayTrack?: (url: string, label: string, song: Song) => void;
  onTogglePlay?: () => void;
  onRestartTrack?: () => void;
  onAddToPlaylist?: (song: Song, url: string, label: string) => void;
  onSpeedChange?: (speed: number) => void;
  onTransposeChange?: (transpose: number) => void;
  vocalAvailability?: { [key: string]: boolean };
  isPremium?: boolean;
  onOpenPremium?: () => void;
}

const ServiceEditor: React.FC<ServiceEditorProps> = ({
  service,
  onClose,
  onSave,
  hymnalData,
  onCreatePlaylist,
  orgServices,
  templates = [],
  userId,
  playerState,
  onPlayTrack,
  onTogglePlay,
  onRestartTrack,
  onAddToPlaylist,
  onSpeedChange,
  onTransposeChange,
  vocalAvailability,
  isPremium,
  onOpenPremium
}) => {
  const [title, setTitle] = useState(service.title);
  const [date, setDate] = useState(service.date || '');
  const [time, setTime] = useState(service.time || '');
  const [notes, setNotes] = useState(service.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [elements, setElements] = useState<ServiceElement[]>(service.elements);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [editingElement, setEditingElement] = useState<ServiceElement | null>(null);
  const [draggedElement, setDraggedElement] = useState<ServiceElement | null>(null);
  const [dragOverElement, setDragOverElement] = useState<string | null>(null);
  const [draggedSong, setDraggedSong] = useState<Song | null>(null);
  const [dropTargetSection, setDropTargetSection] = useState<string | null>(null);
  const [draggedSection, setDraggedSection] = useState<ServiceSection | null>(null);
  const [dragOverSection, setDragOverSection] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(service.templateId || 'default');
  
  // Initialize sections directly from service.sections or empty array
  // Templates will be loaded in a separate effect after mount
  const [currentSections, setCurrentSections] = useState<ServiceSection[]>(() => {
    // If service has custom sections, use them
    if (service.sections && service.sections.length > 0) {
      // DEFENSIVE: Ensure all sections have valid IDs (for old data compatibility)
      return service.sections.map((section, idx) => ({
        ...section,
        id: section.id || `section_${Date.now()}_${idx}`, // Generate ID if missing
        order: section.order ?? idx // Ensure order exists
      }));
    }
    // Otherwise return empty - will be populated by useEffect below
    return [];
  });
  
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isServiceInfoCollapsed, setIsServiceInfoCollapsed] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [viewingSong, setViewingSong] = useState<Song | null>(null);
  const [showUsageHistory, setShowUsageHistory] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [editingDurationId, setEditingDurationId] = useState<string | null>(null);
  const [editingDurationValue, setEditingDurationValue] = useState('');
  const [isViewingService, setIsViewingService] = useState(false);
  const [showDurations, setShowDurations] = useState<boolean>(service.showDurations ?? true);
  
  // Track initialization to prevent re-running effects
  const hasInitializedRef = useRef(false);
  const isMountedRef = useRef(false);
  const onSaveRef = useRef(onSave);
  
  // Keep onSave ref up to date
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Load sections from template if service doesn't have custom sections - ONLY ONCE
  useEffect(() => {
    // Only run once ever
    if (hasInitializedRef.current) {
      return;
    }
    
    // Mark as initialized immediately to prevent re-runs
    hasInitializedRef.current = true;
    
    // If service has custom sections, they're already in state from useState initializer
    if (service.sections && service.sections.length > 0) {
      return;
    }
    
    // Only load from templates if templates are available
    if (templates.length === 0) {
      return;
    }
    
    // Load sections from the selected template
    const template = templates.find(t => t.id === selectedTemplateId);
    
    if (template) {
      // DEFENSIVE: Ensure template sections have IDs
      const sectionsWithIds = template.sections.map((section, idx) => ({
        ...section,
        id: section.id || `section_${Date.now()}_${idx}`,
        order: section.order ?? idx
      }));
      setCurrentSections(sectionsWithIds);
    } else {
      // Template not found, fall back to default template
      const defaultTemplate = templates.find(t => t.isDefault);
      if (defaultTemplate && defaultTemplate.id) {
        setSelectedTemplateId(defaultTemplate.id);
        const sectionsWithIds = defaultTemplate.sections.map((section, idx) => ({
          ...section,
          id: section.id || `section_${Date.now()}_${idx}`,
          order: section.order ?? idx
        }));
        setCurrentSections(sectionsWithIds);
      } else if (templates[0]) {
        // Use first template if no default
        setSelectedTemplateId(templates[0].id || '');
        const sectionsWithIds = templates[0].sections.map((section, idx) => ({
          ...section,
          id: section.id || `section_${Date.now()}_${idx}`,
          order: section.order ?? idx
        }));
        setCurrentSections(sectionsWithIds);
      }
    }
  }, [templates.length]); // Only re-run if templates array changes from empty to populated

  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Autosave with debounce
  useEffect(() => {
    // Don't autosave on initial mount
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }

    // Don't autosave if sections haven't been loaded yet
    if (currentSections.length === 0) {
      return;
    }

    // Debounce autosave by 2 seconds
    const timeoutId = setTimeout(async () => {
      setIsAutoSaving(true);
      try {
        await onSaveRef.current({
          title,
          date,
          time,
          notes,
          elements,
          sections: currentSections, // Save custom sections
          templateId: selectedTemplateId, // Save the active template
          showDurations
        });
      } catch (err) {
        console.error('Autosave error:', err);
        // Silent fail for autosave - user can still manually save
      } finally {
        setIsAutoSaving(false);
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeoutId);
  }, [title, date, time, notes, elements, currentSections, selectedTemplateId, showDurations]); // Removed onSave from dependencies

  // Auto-sync playlist songs when elements change
  useEffect(() => {
    if (!service.playlistId || !elements) return;

    const syncPlaylistSongs = async () => {
      try {
        // Extract only song elements
        const songElements = elements.filter(el => el.type === 'Song' && el.songId);
        
        // Convert to playlist items
        const playlistItems = songElements.map(el => {
          const song = hymnalData.find(s => s.number === el.songId);
          return {
            songNumber: el.songId!,
            label: 'Piano',
            url: song?.accompanimentUrl || ''
          };
        });
        
        // Update the linked playlist
        await updateDoc(doc(db, 'playlists', service.playlistId), {
          items: playlistItems
        });
        
        console.log(`✅ Playlist synced: ${playlistItems.length} songs`);
      } catch (err) {
        console.error('Error syncing playlist songs:', err);
        // Silent fail - don't disrupt user experience
      }
    };

    // Debounce to avoid excessive Firestore writes
    const timer = setTimeout(syncPlaylistSongs, 1000);
    return () => clearTimeout(timer);
  }, [elements, service.playlistId, hymnalData]);

  // Auto-sync playlist name when title or date changes
  useEffect(() => {
    if (!service.playlistId || !title) return;

    const syncPlaylistName = async () => {
      try {
        const playlistName = generatePlaylistName(title, date);
        await updateDoc(doc(db, 'playlists', service.playlistId!), {
          name: playlistName
        });
        console.log(`✅ Playlist name updated: "${playlistName}"`);
      } catch (err) {
        console.error('Error syncing playlist name:', err);
        // Silent fail
      }
    };

    // Debounce
    const timer = setTimeout(syncPlaylistName, 1000);
    return () => clearTimeout(timer);
  }, [title, date, service.playlistId]);

  // Handle template change
  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      // Warn user if there are existing elements
      if (elements.length > 0) {
        const confirm = window.confirm(
          'Changing the template will keep your existing elements, but they may appear in different sections if section names have changed. Continue?'
        );
        if (!confirm) return;
      }

      setCurrentSections(template.sections);
      setSelectedTemplateId(templateId);
    }
  };

  // Redirect mobile users to view-only mode
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-xl p-6 max-w-md text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-3">Mobile Not Supported</h2>
          <p className="text-slate-600 mb-4">
            Service editing is only available on desktop. Please use a larger screen to edit services.
          </p>
          <p className="text-sm text-slate-500 mb-4">
            You can view services on mobile using the "View" button.
          </p>
          <button
            onClick={onClose}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        title,
        date,
        time,
        notes,
        elements,
        sections: currentSections, // Save custom sections
        templateId: selectedTemplateId, // Save the active template
        showDurations
      });
    } catch (err) {
      console.error('Error saving service:', err);
      alert('Failed to save service. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddElement = (newElement: Omit<ServiceElement, 'id' | 'order'>) => {
    if (editingElement) {
      // Update existing element
      setElements(prev => prev.map(el => 
        el.id === editingElement.id 
          ? { ...el, ...newElement }
          : el
      ));
      setEditingElement(null);
    } else {
      // Add new element
      const element: ServiceElement = {
        ...newElement,
        id: generateElementId(),
        order: getNextOrder(elements, newElement.section)
      };
      setElements(prev => [...prev, element]);
    }
  };

  const handleEditElement = (element: ServiceElement) => {
    setEditingElement(element);
    setSelectedSection(element.section);
    setIsAddModalOpen(true);
  };

  const handleDeleteElement = (elementId: string) => {
    setElements(prev => prev.filter(el => el.id !== elementId));
  };

  const openAddModal = (section: string) => {
    setEditingElement(null);
    setSelectedSection(section);
    setIsAddModalOpen(true);
  };
  
  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingElement(null);
  };

  const formatServiceAsText = (): string => {
    let text = `${title}\n`;
    if (date) text += `${new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}\n`;
    if (time) text += `${time}\n`;
    text += `\n`;
    
    if (notes) {
      text += `Notes: ${notes}\n\n`;
    }

    SERVICE_SECTIONS.forEach(section => {
      const sectionElements = elements.filter(el => el.section === section.title);
      if (sectionElements.length > 0) {
        text += `\n${section.title}\n`;
        text += '='.repeat(section.title.length) + '\n';
        sectionElements.forEach((element, idx) => {
          text += `${idx + 1}. `;
          if (element.type === 'Song' && element.songId) {
            const song = hymnalData.find(s => s.number === element.songId);
            text += `${element.title}${song ? ` - ${song.title}` : ''}\n`;
          } else {
            text += `${element.title}\n`;
          }
          if (element.details) {
            text += `   ${element.details}\n`;
          }
          if (element.assignedTo) {
            text += `   Assigned to: ${element.assignedTo}\n`;
          }
        });
      }
    });

    return text;
  };

  const handleExport = async () => {
    const serviceText = formatServiceAsText();
    const subject = `Service Plan: ${title}`;

    // Try native share first (mobile-friendly)
    if (navigator.share) {
      try {
        await navigator.share({
          title: subject,
          text: serviceText
        });
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    }

    // Fallback to mailto
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(serviceText)}`;
    window.location.href = mailtoLink;
  };

  const handleCreatePlaylist = async () => {
    if (!onCreatePlaylist) {
      alert('Playlist creation is not available');
      return;
    }

    // Get all song elements
    const songElements = elements.filter(el => el.type === 'Song' && el.songId);
    
    if (songElements.length === 0) {
      alert('No songs in this service to create a playlist');
      return;
    }

    // Find the actual song objects
    const songs: Song[] = [];
    songElements.forEach(el => {
      const song = hymnalData.find(s => s.number === el.songId);
      if (song) songs.push(song);
    });

    if (songs.length === 0) {
      alert('Could not find songs in database');
      return;
    }

    // Format playlist name as "[Service Title] ([Date])"
    let playlistName = title;
    if (date) {
      const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { 
        month: 'numeric', 
        day: 'numeric', 
        year: 'numeric' 
      });
      playlistName = `${title} (${formattedDate})`;
    }

    try {
      await onCreatePlaylist(playlistName, songs);
      // Success - no alert here, ServicePlanner will show confirmation
    } catch (err) {
      console.error('Error creating playlist:', err);
      alert('Failed to create playlist. Please try again.');
    }
  };

  // Drag-and-drop handler using @hello-pangea/dnd
  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;

    // Dropped outside any droppable area
    if (!destination) {
      return;
    }

    // Dropped in same position
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    // SECTION REORDERING
    if (type === 'SECTION') {
      const reordered = Array.from(currentSections);
      const [removed] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, removed);
      
      // Update order values
      const updated = reordered.map((s, idx) => ({ ...s, order: idx }));
      setCurrentSections(updated);
      return;
    }

    // ELEMENT REORDERING (within or between sections)
    // Source and dest are now section IDs, not titles - need to find titles
    const sourceSectionId = source.droppableId;
    const destSectionId = destination.droppableId;
    
    const sourceSection = currentSections.find(s => s.id === sourceSectionId);
    const destSection = currentSections.find(s => s.id === destSectionId);
    
    if (!sourceSection || !destSection) {
      console.error('Could not find sections for drag operation');
      return;
    }
    
    const sourceSectionTitle = sourceSection.title;
    const destSectionTitle = destSection.title;

    // Get elements for source and destination sections (by title)
    const sourceElements = elements.filter(el => el.section === sourceSectionTitle);
    const destElements = elements.filter(el => el.section === destSectionTitle);
    const otherElements = elements.filter(el => el.section !== sourceSectionTitle && el.section !== destSectionTitle);

    if (sourceSectionId === destSectionId) {
      // SAME SECTION: Just reorder
      const reordered = Array.from(sourceElements);
      const [removed] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, removed);

      // Update order values
      const updated = reordered.map((el, idx) => ({ ...el, order: idx }));

      //  Combine with other sections
      setElements([...otherElements, ...updated, ...destElements.filter(el => el.section !== sourceSectionTitle)]);
    } else {
      // CROSS-SECTION: Move element to new section (update title)
      const sourceReordered = Array.from(sourceElements);
      const [removed] = sourceReordered.splice(source.index, 1);

      // Update the moved element's section to dest section TITLE
      const movedElement = { ...removed, section: destSectionTitle };

      // Insert into destination
      const destReordered = Array.from(destElements);
      destReordered.splice(destination.index, 0, movedElement);

      // Update order values for both sections
      const updatedSource = sourceReordered.map((el, idx) => ({ ...el, order: idx }));
      const updatedDest = destReordered.map((el, idx) => ({ ...el, order: idx }));

      // Combine all elements
      setElements([...otherElements, ...updatedSource, ...updatedDest]);
    }
  };

  // Song library drag handlers
  const handleSongDragStart = (song: Song) => {
    setDraggedSong(song);
  };

  const handleSectionDragOver = (e: React.DragEvent, sectionTitle: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDropTargetSection(sectionTitle);
  };

  const handleSectionDrop = async (e: React.DragEvent, sectionTitle: string) => {
    e.preventDefault();
    
    const songId = e.dataTransfer.getData('songId');
    const songTitle = e.dataTransfer.getData('songTitle');
    
    if (songId && songTitle) {
      // Find the song object to get the accompaniment URL
      const song = hymnalData.find(s => s.number === songId);
      
      // Create base element
      const newElement: ServiceElement = {
        id: generateElementId(),
        type: 'Song',
        section: sectionTitle,
        songId: songId,
        title: songTitle,
        order: getNextOrder(elements, sectionTitle),
        details: '',
        assignedTo: ''
      };
      
      // Fetch duration in the background
      if (song?.accompanimentUrl) {
        fetchAudioDuration(song.accompanimentUrl)
          .then(duration => {
            // Update the element with duration
            setElements(prev => 
              prev.map(el => 
                el.id === newElement.id ? { ...el, duration } : el
              )
            );
            console.log('Drag-drop - fetched duration:', duration, 'for song:', songId);
          })
          .catch(err => {
            console.error('Failed to fetch duration for dropped song:', err);
          });
      }
      
      // Add element immediately (duration will be added when fetch completes)
      setElements(prev => [...prev, newElement]);
    }
    
    setDraggedSong(null);
    setDropTargetSection(null);
  };

  const handleSectionDragLeave = () => {
    setDropTargetSection(null);
  };

  // Section drag-and-drop handlers
  const handleSectionDragStart = (e: React.DragEvent, section: ServiceSection) => {
    setDraggedSection(section);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSectionDragOverSection = (e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent triggering song drop
    if (draggedSection) {
      e.dataTransfer.dropEffect = 'move';
      setDragOverSection(sectionId);
    }
  };

  const handleSectionDropOnSection = (e: React.DragEvent, targetSection: ServiceSection) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedSection || draggedSection.id === targetSection.id) {
      setDraggedSection(null);
      setDragOverSection(null);
      return;
    }

    // Reorder sections
    const draggedIndex = currentSections.findIndex(s => s.id === draggedSection.id);
    const targetIndex = currentSections.findIndex(s => s.id === targetSection.id);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedSection(null);
      setDragOverSection(null);
      return;
    }

    // Create new ordered array
    const reordered = [...currentSections];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    // Update order values
    const updated = reordered.map((s, idx) => ({ ...s, order: idx }));
    setCurrentSections(updated);

    setDraggedSection(null);
    setDragOverSection(null);
  };

  const handleSectionDragEnd = () => {
    setDraggedSection(null);
    setDragOverSection(null);
  };

  // Section management
  const handleAddSection = () => {
    const newSection: ServiceSection = {
      id: `section_${Date.now()}`,
      title: 'New Section',
      order: 0
    };
    // Add to top and reorder all existing sections
    setCurrentSections(prev => {
      const updated = [newSection, ...prev.map(s => ({ ...s, order: s.order + 1 }))];
      return updated;
    });
  };

  const handleDeleteSection = (sectionId: string) => {
    // Check if section has elements
    const sectionTitle = currentSections.find(s => s.id === sectionId)?.title;
    const hasElements = sectionTitle && elements.some(el => el.section === sectionTitle);
    
    if (hasElements) {
      if (!confirm('This section has elements. Deleting it will remove those elements. Continue?')) {
        return;
      }
      // Remove elements from this section
      setElements(prev => prev.filter(el => el.section !== sectionTitle));
    }
    
    // Remove section and reorder
    setCurrentSections(prev => {
      const filtered = prev.filter(s => s.id !== sectionId);
      return filtered.map((s, idx) => ({ ...s, order: idx }));
    });
  };

  const handleStartEditSection = (section: ServiceSection) => {
    setEditingSectionId(section.id);
    setEditingSectionTitle(section.title);
  };

  const handleSaveEditSection = (sectionId: string) => {
    if (!editingSectionTitle.trim()) {
      alert('Section title cannot be empty');
      return;
    }

    const oldTitle = currentSections.find(s => s.id === sectionId)?.title;
    const newTitle = editingSectionTitle.trim();

    // Update section title
    setCurrentSections(prev =>
      prev.map(s => (s.id === sectionId ? { ...s, title: newTitle } : s))
    );

    // Update all elements that reference this section
    if (oldTitle) {
      setElements(prev =>
        prev.map(el => (el.section === oldTitle ? { ...el, section: newTitle } : el))
      );
    }

    setEditingSectionId(null);
    setEditingSectionTitle('');
  };

  const handleCancelEditSection = () => {
    setEditingSectionId(null);
    setEditingSectionTitle('');
  };

  // Inline duration editing handlers
  const handleStartEditDuration = (element: ServiceElement) => {
   setEditingDurationId(element.id);
    setEditingDurationValue(element.duration ? formatDuration(element.duration) : '');
  };

  const handleSaveDuration = (elementId: string) => {
    const parsedDuration = parseDurationInput(editingDurationValue);
    
    setElements(prev =>
      prev.map(el => {
        if (el.id === elementId) {
          if (parsedDuration) {
            return { ...el, duration: parsedDuration };
          } else {
            // Remove duration field entirely if empty (Firebase doesn't allow undefined)
            const { duration, ...rest } = el;
            return rest as ServiceElement;
          }
        }
        return el;
      })
    );

    setEditingDurationId(null);
    setEditingDurationValue('');
  };

  const handleCancelEditDuration = () => {
    setEditingDurationId(null);
    setEditingDurationValue('');
  };

  // Save current sections as template
  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    if (!userId || !service.orgId) {
      alert('Unable to save template - missing user or organization info');
      return;
    }

    setIsSavingTemplate(true);
    try {
      const templateData: Omit<ServiceTemplate, 'id'> = {
        orgId: service.orgId,
        name: newTemplateName.trim(),
        sections: currentSections,
        isDefault: false,
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'serviceTemplates'), templateData);
      
      // Set the new template as selected
      setSelectedTemplateId(docRef.id);
      
      alert(`✅ Template "${newTemplateName}" saved successfully!`);
      setShowSaveTemplateModal(false);
      setNewTemplateName('');
    } catch (err) {
      console.error('Error saving template:', err);
      alert('Failed to save template. Please try again.');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Memoize expensive calculations
  const songCount = useMemo(() => 
    elements.filter(el => el.type === 'Song').length,
    [elements]
  );

  return (
    <div className="fixed inset-0 z-[300] bg-white flex flex-col">
      {/* Close Button (Top Left) */}
      <div className="absolute top-4 left-4 z-10">
        <button 
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600 hover:text-slate-900"
          title="Close"
        >
          <X size={24} />
        </button>
      </div>

      {/* Split-Screen Content: Service Editor (Left) + Song Library (Right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Service Editor */}
        <div className="w-1/2 border-r border-slate-200 flex flex-col bg-slate-50">
          {/* Service Info Header */}
          <div className="bg-white border-b border-slate-200 shrink-0">
            {/* Collapsible Header */}
            <div className="w-full p-4 pl-16 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-indigo-100 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">Service Info</h2>
              
              <div className="flex items-center gap-2">
                {/* Action Buttons */}
                <button
                  onClick={() => setIsViewingService(true)}
                  className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 px-3 py-2 rounded-lg font-medium transition-colors shadow-sm text-sm whitespace-nowrap"
                  title="View service"
                >
                  <Eye size={16} />
                  View
                </button>
                
                <button
                  onClick={handleSave}
                  disabled={isSaving || isAutoSaving}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-3 py-2 rounded-lg font-medium transition-colors shadow-sm text-sm whitespace-nowrap"
                >
                  <Save size={16} />
                  {isSaving ? 'Saving...' : isAutoSaving ? 'Auto-saving...' : 'Saved ✓'}
                </button>
                
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 px-3 py-2 rounded-lg font-medium transition-colors shadow-sm text-sm whitespace-nowrap"
                  title="Export or email service"
                >
                  <Mail size={16} />
                  Export
                </button>
                
                {/* Playlist auto-syncs - no manual button needed */}
                
                {/* Collapse Toggle */}
                <button
                  onClick={() => setIsServiceInfoCollapsed(!isServiceInfoCollapsed)}
                  className="p-2 hover:bg-indigo-100 rounded-full transition-colors"
                  title={isServiceInfoCollapsed ? 'Expand' : 'Collapse'}
                >
                  {isServiceInfoCollapsed ? (
                    <ChevronDown size={24} className="text-indigo-600" />
                  ) : (
                    <ChevronUp size={24} className="text-indigo-600" />
                  )}
                </button>
              </div>
            </div>
            
            {/* Service Details Form */}
            {!isServiceInfoCollapsed && (
              <div className="px-6 pb-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                  Service Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Sunday Morning Worship"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2 flex items-center gap-1">
                    <Calendar size={12} /> Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2 flex items-center gap-1">
                    <Clock size={12} /> Time
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  placeholder="Optional notes about this service..."
                />
              </div>

              {/* Template & Actions - Single Row */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                  Template
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      className="w-full appearance-none bg-white border border-slate-300 text-slate-700 text-sm font-medium pl-3 pr-8 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                      disabled={templates.length === 0}
                    >
                      {templates.length === 0 ? (
                        <option value="">No templates - using custom sections</option>
                      ) : (
                        <>
                          {templates.map(template => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                  
                  <button
                    onClick={() => setShowSaveTemplateModal(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors text-sm whitespace-nowrap"
                    title="Save current sections as a template"
                  >
                    Save as Template
                  </button>
                </div>
              </div>
            </div>
            )}
          </div>

          {/* Service Order Section */}
          <div className="p-4 border-b border-slate-200 bg-white shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-slate-800">Service Order</h3>
              <button
                onClick={handleAddSection}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors text-xs"
              >
                <Plus size={14} />
                Add Section
              </button>
            </div>
            {/* Total Duration Display + Show Durations Toggle */}
            <div className="flex items-center justify-between gap-3 text-sm bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-indigo-600" />
                <span className="font-semibold text-indigo-900">
                  Total Duration: {formatDurationLong(calculateTotalDuration(elements))}
                </span>
                <span className="text-indigo-600 text-xs">
                  ({elements.filter(el => el.duration).length} of {elements.length} timed)
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDurations}
                  onChange={(e) => setShowDurations(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-medium text-indigo-900 whitespace-nowrap">
                  Show durations on Service
                </span>
              </label>
            </div>
          </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <DragDropContext onDragEnd={onDragEnd}>
                {/* Droppable container for sections */}
                <Droppable droppableId="all-sections" type="SECTION">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-3"
                    >
                      {currentSections.map((section, sectionIndex) => {
                        const sectionElements = elements
                          .filter(el => el.section === section.title)
                          .sort((a, b) => a.order - b.order);
                        const isDropTarget = dropTargetSection === section.title;
                        
                        return (
                          <Draggable
                            key={section.id}
                            draggableId={section.id}
                            index={sectionIndex}
                          >
                            {(sectionProvided, sectionSnapshot) => (
                              <div
                                ref={sectionProvided.innerRef}
                                {...sectionProvided.draggableProps}
                                onDragOver={(e) => handleSectionDragOver(e, section.title)}
                                onDrop={(e) => handleSectionDrop(e, section.title)}
                                onDragLeave={handleSectionDragLeave}
                                className={`bg-white rounded-lg border-2 transition-all ${
                                  sectionSnapshot.isDragging
                                    ? 'shadow-2xl ring-2 ring-indigo-400'
                                    : isDropTarget
                                    ? 'border-indigo-400 bg-indigo-50/30 shadow-lg'
                                    : 'border-slate-200'
                                }`}
                              >
                        {/* Section Header */}
                        <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between group">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div 
                              {...sectionProvided.dragHandleProps}
                              className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0"
                              title="Drag to reorder section"
                            >
                              <GripVertical size={16} />
                            </div>
                            {editingSectionId === section.id ? (
                              <input
                                type="text"
                                value={editingSectionTitle}
                                onChange={(e) => setEditingSectionTitle(e.target.value)}
                                onBlur={() => handleSaveEditSection(section.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditSection(section.id);
                                  if (e.key === 'Escape') handleCancelEditSection();
                                }}
                                className="flex-1 px-2 py-1 text-xs font-bold text-slate-800 border border-indigo-400 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <>
                                <h4 className="font-bold text-slate-800 text-xs flex-1 truncate">{section.title}</h4>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEditSection(section);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-indigo-600 hover:bg-indigo-100 rounded transition-all shrink-0"
                                  title="Rename section"
                                >
                                  <Edit3 size={12} />
                                </button>
                              </>
                            )}
                          </div>
                          {isDropTarget && (
                            <span className="text-xs text-indigo-600 font-medium animate-pulse flex items-center gap-1 mr-2 shrink-0">
                              <Plus size={12} /> Drop song here
                            </span>
                          )}
                          <button
                            onClick={() => handleDeleteSection(section.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-100 rounded transition-all shrink-0"
                            title="Delete section"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      
                        {/* Section Content - Droppable Area - Use section.id for stable IDs */}
                        <Droppable droppableId={section.id}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className="p-3 min-h-[60px]"
                            >
                              {sectionElements.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-3">
                                  Drag elements here or click "+ Add Element"
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {sectionElements.map((element, index) => (
                                    <Draggable key={element.id} draggableId={element.id} index={index}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={`flex items-center gap-2 p-2 rounded border transition-all ${
                                            snapshot.isDragging
                                              ? 'shadow-lg bg-white border-indigo-500 ring-2 ring-indigo-200'
                                              : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                                          }`}
                                        >
                                          <div className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0">
                                            <GripVertical size={14} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                                                {element.type}
                                              </span>
                                              <span className="text-xs font-medium text-slate-800 truncate">
                                                {element.type === 'Song' && element.songId ? (
                                                  <>
                                                    #{element.songId} {hymnalData.find(s => s.number === element.songId)?.title || element.title}
                                                  </>
                                                ) : element.title}
                                              </span>
                                            </div>
                                            {element.details && (
                                              <p className="text-[10px] text-slate-500 mt-0.5 truncate">{element.details}</p>
                                            )}
                                            {element.assignedTo && (
                                              <p className="text-[10px] text-indigo-600 mt-0.5 truncate">
                                                👤 {element.assignedTo}
                                              </p>
                                            )}
                                          </div>
                                          {editingDurationId === element.id ? (
                                            <input
                                              type="text"
                                              value={editingDurationValue}
                                              onChange={(e) => setEditingDurationValue(e.target.value)}
                                              onBlur={() => handleSaveDuration(element.id)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveDuration(element.id);
                                                if (e.key === 'Escape') handleCancelEditDuration();
                                              }}
                                              className="w-16 text-xs font-mono px-2 py-1 border border-indigo-400 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-center shrink-0"
                                              autoFocus
                                              onClick={(e) => e.stopPropagation()}
                                              placeholder="0:00"
                                            />
                                          ) : (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleStartEditDuration(element);
                                              }}
                                              className="text-xs font-mono px-2 py-1 rounded shrink-0 hover:ring-2 hover:ring-indigo-300 transition-all cursor-pointer text-slate-500 bg-slate-100"
                                              title="Click to edit duration"
                                            >
                                              {element.duration ? formatDuration(element.duration) : '00:00'}
                                            </button>
                                          )}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEditElement(element);
                                            }}
                                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors shrink-0"
                                            title="Edit element"
                                          >
                                            <Edit3 size={12} />
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteElement(element.id);
                                            }}
                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors shrink-0"
                                            title="Delete element"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                </div>
                              )}
                              
                              {/* Add Element Button */}
                              <button 
                                onClick={() => openAddModal(section.title)}
                                className="w-full mt-2 px-2 py-1.5 border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30 rounded-lg text-xs text-slate-500 hover:text-indigo-600 font-medium transition-colors"
                              >
                                + Add Element
                              </button>
                            </div>
                          )}
                        </Droppable>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          </div>

        {/* RIGHT: Song Library */}
        <div className="w-1/2 flex flex-col">
          <SongLibraryPanel
            hymnalData={hymnalData}
            orgServices={orgServices || []}
            onDragStart={handleSongDragStart}
            currentServiceElements={elements}
            currentServiceDate={date}
            onSongClick={(song) => setViewingSong(song)}
            onViewUsageHistory={() => setShowUsageHistory(true)}
          />
        </div>
      </div>

      {/* AddElementModal */}
      <AddElementModal
        isOpen={isAddModalOpen}
        onClose={closeModal}
        section={selectedSection}
        onAddElement={handleAddElement}
        hymnalData={hymnalData}
        editingElement={editingElement}
        orgServices={orgServices}
      />

      {/* Song Viewer Modal */}
      {viewingSong && (
        <SongDetailViewer
          song={viewingSong}
          onClose={() => setViewingSong(null)}
          playerState={playerState}
          onPlayTrack={onPlayTrack}
          onTogglePlay={onTogglePlay}
          onRestartTrack={onRestartTrack}
          onAddToPlaylist={onAddToPlaylist}
          onSpeedChange={onSpeedChange}
          onTransposeChange={onTransposeChange}
          vocalAvailability={vocalAvailability}
          isPremium={isPremium}
          onOpenPremium={onOpenPremium}
        />
      )}

      {/* Usage History Modal */}
      <SongUsageHistoryModal
        isOpen={showUsageHistory}
        onClose={() => setShowUsageHistory(false)}
        services={orgServices || []}
        hymnalData={hymnalData}
        onSelectSong={(songNumber) => {
          // Find the song and open viewer
          const song = hymnalData.find(s => s.number === songNumber);
          if (song) {
            setViewingSong(song);
          }
          setShowUsageHistory(false);
        }}
      />

      {/* Service Viewer - Full Screen Overlay */}
      {isViewingService && (
        <div className="fixed inset-0 z-[400] bg-white">
          <ServiceViewer
            service={{
              ...service,
              title,
              date,
              time,
              notes,
              elements,
              sections: currentSections,
              showDurations
            }}
            onClose={() => setIsViewingService(false)}
            hymnalData={hymnalData}
            onSongSelect={(song) => {
              setViewingSong(song);
              setIsViewingService(false);
            }}
          />
        </div>
      )}

      {/* Save Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSaveTemplateModal(false)} />
          
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-800">Save as Template</h3>
              <button 
                onClick={() => setShowSaveTemplateModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Save the current {currentSections.length} section{currentSections.length !== 1 ? 's' : ''} as a reusable template for your organization.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Template Name
              </label>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSaveTemplate()}
                placeholder="e.g., Simple Sunday Service"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveTemplateModal(false)}
                className="flex-1 px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={isSavingTemplate || !newTemplateName.trim()}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors"
              >
                {isSavingTemplate ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceEditor;
