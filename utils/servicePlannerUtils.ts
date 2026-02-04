import { Service, ServiceElement } from '../types';

/**
 * Generate a unique ID for service elements
 */
export const generateElementId = (): string => {
  return `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create an empty service
 */
export const createEmptyService = (userId: string, orgId: string): Omit<Service, 'id' | 'createdAt' | 'updatedAt'> => {
  return {
    orgId,
    createdBy: userId,
    title: 'New Service',
    elements: []
  };
};

/**
 * Get the next order number for a section
 */
export const getNextOrder = (elements: ServiceElement[], section: string): number => {
  const sectionElements = elements.filter(el => el.section === section);
  if (sectionElements.length === 0) return 0;
  return Math.max(...sectionElements.map(el => el.order)) + 1;
};

/**
 * Sort elements by section order and element order
 */
export const sortElements = (elements: ServiceElement[]): ServiceElement[] => {
  return [...elements].sort((a, b) => {
    // First sort by section, then by order within section
    if (a.section === b.section) {
      return a.order - b.order;
    }
    return 0;
  });
};

/**
 * Reorder elements after a drag-and-drop
 */
export const reorderElements = (
  elements: ServiceElement[],
  sourceIndex: number,
  destinationIndex: number,
  section: string
): ServiceElement[] => {
  const sectionElements = elements.filter(el => el.section === section);
  const otherElements = elements.filter(el => el.section !== section);
  
  const [movedElement] = sectionElements.splice(sourceIndex, 1);
  sectionElements.splice(destinationIndex, 0, movedElement);
  
  // Update order numbers
  const reorderedSection = sectionElements.map((el, index) => ({
    ...el,
    order: index
  }));
  
  return [...otherElements, ...reorderedSection];
};

/**
 * Format date for display
 */
export const formatServiceDate = (dateString?: string): string => {
  if (!dateString) return 'No date set';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// --- TIMING UTILITIES ---

/**
 * Fetch audio duration from MP3 file
 */
export const fetchAudioDuration = (url: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    
    audio.onloadedmetadata = () => {
      const duration = Math.floor(audio.duration);
      audio.removeAttribute('src');
      resolve(duration);
    };
    
    audio.onerror = () => {
      reject(new Error('Failed to load audio'));
    };
    
    audio.src = url;
  });
};

/**
 * Format duration in seconds to MM:SS format
 */
export const formatDuration = (seconds?: number): string => {
  if (!seconds || seconds === 0) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format duration for display with hours if needed (HH:MM:SS)
 */
export const formatDurationLong = (seconds?: number): string => {
  if (!seconds || seconds === 0) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Parse user duration input to seconds
 * Accepts formats: "3:45", "45", "3"
 */
export const parseDurationInput = (input: string): number => {
  if (!input || input.trim() === '') return 0;
  
  const trimmed = input.trim();
  
  // Check if it contains a colon (MM:SS format)
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length !== 2) return 0;
    
    const mins = parseInt(parts[0], 10);
    const secs = parseInt(parts[1], 10);
    
    if (isNaN(mins) || isNaN(secs)) return 0;
    if (secs >= 60) return 0; // Invalid seconds
    
    return (mins * 60) + secs;
  }
  
  // No colon - treat as plain number
  const num = parseInt(trimmed, 10);
  if (isNaN(num)) return 0;
  
  // If number is less than 10, assume minutes (e.g., "5" = 5 minutes)
  // If 10 or greater, assume seconds for safety
  if (num < 10) {
    return num * 60;
  }
  
  return num;
};

/**
 * Calculate total duration of all elements in service
 */
export const calculateTotalDuration = (elements: ServiceElement[]): number => {
  return elements.reduce((total, element) => {
    return total + (element.duration || 0);
  }, 0);
};

// --- PLAYLIST UTILITIES ---

/**
 * Generate playlist name from service title and date
 * Format: "{Service Title} ({Date})" or just "{Service Title}" if no date
 */
export const generatePlaylistName = (title: string, date?: string): string => {
  if (!date) return title;
  
  try {
    // Format date as MM/DD/YYYY
    const dateObj = new Date(date + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    });
    return `${title} (${formattedDate})`;
  } catch (err) {
    return title; // Fallback if date parsing fails
  }
};

/**
 * Extract songs from service elements and convert to playlist items
 * @param service - The service containing elements
 * @param hymnalData - Array of all songs to lookup song details
 * @returns Array of SerializedPlaylistItem
 */
export const extractSongsFromService = (service: Service, hymnalData: any[]): any[] => {
  const songElements = service.elements.filter(el => el.type === 'Song' && el.songId);
  
  return songElements.map(el => {
    const song = hymnalData.find(s => s.number === el.songId);
    return {
      songNumber: el.songId!,
      label: 'Piano',
      url: song?.accompanimentUrl || ''
    };
  });
};
