import { Service, Song } from '../types';

export interface SongUsage {
  songNumber: string;
  songTitle: string;
  count: number;
  latestUse: Date;
  services: Array<{
    serviceId: string;
    serviceTitle: string;
    date: Date;
  }>;
}

export type DateRangeFilter = '30days' | '90days' | '6months' | '1year' | 'all';

/**
 * Get the cutoff date for a given date range filter
 */
export function getDateRangeCutoff(filter: DateRangeFilter): Date | null {
  if (filter === 'all') return null;
  
  const now = new Date();
  const cutoff = new Date(now);
  
  switch (filter) {
    case '30days':
      cutoff.setDate(now.getDate() - 30);
      break;
    case '90days':
      cutoff.setDate(now.getDate() - 90);
      break;
    case '6months':
      cutoff.setMonth(now.getMonth() - 6);
      break;
    case '1year':
      cutoff.setFullYear(now.getFullYear() - 1);
      break;
  }
  
  return cutoff;
}

/**
 * Aggregate song usage data from services
 */
export function aggregateSongUsage(
  services: Service[],
  hymnalData: Song[],
  dateFilter: DateRangeFilter = '6months'
): SongUsage[] {
  const cutoffDate = getDateRangeCutoff(dateFilter);
  
  // Filter services by date range
  const filteredServices = services.filter(service => {
    if (!cutoffDate || !service.date) return true;
    const serviceDate = new Date(service.date + 'T00:00:00');
    return serviceDate >= cutoffDate;
  });
  
  // Map to store song usage data
  const usageMap = new Map<string, SongUsage>();
  
  // Process each service
  filteredServices.forEach(service => {
    // Extract song elements
    const songElements = service.elements.filter(el => el.type === 'Song' && el.songId);
    
    songElements.forEach(element => {
      const songNumber = element.songId!;
      
      // Find song details from hymnal
      const songData = hymnalData.find(s => s.number === songNumber);
      const songTitle = songData?.title || element.title;
      
      // Get or create usage entry
      let usage = usageMap.get(songNumber);
      
      if (!usage) {
        usage = {
          songNumber,
          songTitle,
          count: 0,
          latestUse: new Date(0),
          services: []
        };
        usageMap.set(songNumber, usage);
      }
      
      // Increment count
      usage.count++;
      
      // Add service details
      const serviceDate = service.date 
        ? new Date(service.date + 'T00:00:00')
        : new Date(service.createdAt?.seconds * 1000 || 0);
      
      usage.services.push({
        serviceId: service.id || '',
        serviceTitle: service.title,
        date: serviceDate
      });
      
      // Update latest use
      if (serviceDate > usage.latestUse) {
        usage.latestUse = serviceDate;
      }
    });
  });
  
  // Convert to array and sort services by date (most recent first)
  const usageArray = Array.from(usageMap.values());
  usageArray.forEach(usage => {
    usage.services.sort((a, b) => b.date.getTime() - a.date.getTime());
  });
  
  return usageArray;
}

/**
 * Sort song usage data by different criteria
 */
export type SortBy = 'number' | 'title' | 'count';
export type SortDirection = 'asc' | 'desc';

export function sortSongUsage(
  usage: SongUsage[],
  sortBy: SortBy,
  direction: SortDirection
): SongUsage[] {
  const sorted = [...usage];
  
  sorted.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'number':
        // Natural sort for song numbers (handles 119A, 119B, etc.)
        comparison = naturalCompare(a.songNumber, b.songNumber);
        break;
      case 'title':
        comparison = a.songTitle.localeCompare(b.songTitle);
        break;
      case 'count':
        comparison = a.count - b.count;
        break;
    }
    
    return direction === 'asc' ? comparison : -comparison;
  });
  
  return sorted;
}

/**
 * Natural comparison for song numbers (handles 119A, 119B properly)
 */
function naturalCompare(a: string, b: string): number {
  const regex = /(\d+)([A-Z]*)/;
  const matchA = a.match(regex);
  const matchB = b.match(regex);
  
  if (!matchA || !matchB) {
    return a.localeCompare(b);
  }
  
  const numA = parseInt(matchA[1]);
  const numB = parseInt(matchB[1]);
  
  if (numA !== numB) {
    return numA - numB;
  }
  
  // Same number, compare letter suffix
  return matchA[2].localeCompare(matchB[2]);
}

/**
 * Filter song usage by search query
 */
export function filterSongUsage(
  usage: SongUsage[],
  searchQuery: string
): SongUsage[] {
  if (!searchQuery.trim()) return usage;
  
  const query = searchQuery.toLowerCase();
  return usage.filter(song => 
    song.songNumber.toLowerCase().includes(query) ||
    song.songTitle.toLowerCase().includes(query)
  );
}

/**
 * Get usage statistics for a specific song
 */
export function getSongUsageStats(
  songNumber: string,
  services: Service[],
  cutoffDate: Date | null = null
): { count: number; lastDate: string | null; dates: string[] } {
  // Filter services by date if cutoffDate provided
  const filteredServices = cutoffDate
    ? services.filter(service => {
        if (!service.date) return false;
        const serviceDate = new Date(service.date + 'T00:00:00');
        return serviceDate >= cutoffDate;
      })
    : services;
  
  const dates: Date[] = [];
  
  // Find all uses of this song
  filteredServices.forEach(service => {
    const hasSong = service.elements.some(
      el => el.type === 'Song' && el.songId === songNumber
    );
    
    if (hasSong && service.date) {
      dates.push(new Date(service.date + 'T00:00:00'));
    }
  });
  
  // Sort dates (most recent first)
  dates.sort((a, b) => b.getTime() - a.getTime());
  
  // Format dates
  const formattedDates = dates.map(d => 
    d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
  );
  
  return {
    count: dates.length,
    lastDate: formattedDates[0] || null,
    dates: formattedDates
  };
}
