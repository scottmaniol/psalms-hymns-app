
export interface RichDataEntry {
  title?: string;
  author: string;
  composer: string;
  meter: string;
  tune?: string;
  key?: string;
  lyrics: string;
  vocalUrl?: string;
  category?: string;
}

export interface RichDataMap {
  [key: string]: RichDataEntry;
}

export interface Song {
  id: string;
  number: string;
  title: string;
  tune: string | null;
  category: string;
  author: string;
  composer: string;
  meter: string;
  key?: string;
  lyrics: string;
  pdfUrl: string;
  rawPdfLink: string;
  accompanimentUrl: string;
  vocalUrl: string;
  xmlUrl: string;
  hasDetails: boolean;
}

export interface PlaylistItem {
  uniqueId: string; // For React keys and reordering
  song: Song;
  url: string;
  label: string; // "Piano" or "Vocal"
}

export interface SerializedPlaylistItem {
  songNumber: string;
  label: string;
  url: string;
}

export interface Organization {
  id: string;
  name: string;
  uniqueCode: string; // Regular member code
  adminCode?: string; // Admin join code
  createdBy: string;
  memberIds: string[];
  adminIds?: string[]; // Array of user IDs with admin privileges
  createdAt: any;
}

export interface SavedPlaylist {
  id: string;
  userId: string;
  name: string;
  items: SerializedPlaylistItem[];
  createdAt: any; // Firestore Timestamp
  organizationId?: string; // Optional link to an organization
  order?: number; // For manual sorting
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  isPremium?: boolean;
  isAdmin?: boolean; // Global app admin
  createdAt?: any;
  lastLoginAt?: any;
}

// Flattened view of a Stripe subscription doc from the payments extension
// (customers/{uid}/subscriptions/{id}), for display on the account screen.
export interface SubscriptionInfo {
  id: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  created: Date | null;
  unitAmount: number | null; // in cents
  currency: string | null;
  interval: string | null;
}

export type SortOrder = 'number' | 'alpha_asc' | 'alpha_desc';
export type ViewMode = 'list' | 'detail';
export type TabMode = 'lyrics' | 'score' | 'audio';
export type PlayMode = 'continue' | 'stop'; // Continue to next song or stop

// --- Google Cast & AirPlay Types ---

declare global {
  interface Window {
    chrome: any;
    cast: any;
    __onGCastApiAvailable: (isAvailable: boolean) => void;
    WebKitPlaybackTargetAvailabilityEvent: any;
  }
  
  interface HTMLAudioElement {
    webkitShowPlaybackTargetPicker: () => void;
    webkitAudioDecodedByteCount: number; // Safari specific
  }
}

// --- Service Planning Types ---

export interface ServiceElement {
  id: string;
  type: 'Song' | 'Prayer' | 'Scripture' | 'Sermon' | 'Other';
  section: string; // Liturgical section title
  order: number;
  title: string;
  details?: string;
  songId?: string; // Song number from the hymnal
  assignedTo?: string; // Person/team assigned to this element
  duration?: number; // Duration in seconds
}

export interface Service {
  id?: string;
  orgId: string;
  createdBy: string;
  title: string;
  date?: string; // ISO date string
  time?: string;
  notes?: string;
  elements: ServiceElement[];
  sections?: ServiceSection[]; // Custom sections for this service (overrides template)
  templateId?: string; // Template used for this service
  playlistId?: string; // Linked auto-generated playlist
  showDurations?: boolean; // Whether to show duration badges in service view (default: true)
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
}

export interface SongUsageRecord {
  songNumber: string;
  serviceId: string;
  serviceTitle: string;
  date: any; // Firestore Timestamp
}

// --- Service Template Types ---

export interface ServiceSection {
  id: string;
  title: string;
  order: number;
}

export interface ServiceTemplate {
  id?: string;
  orgId: string;
  name: string;
  sections: ServiceSection[];
  isDefault: boolean;
  createdBy: string;
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
}
