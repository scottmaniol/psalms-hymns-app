# Service Planner Implementation Guide - Part 1: Foundation & Setup

**Steps 1-5: TypeScript Types, Constants, Rules, Utilities, and Base Component**

---

## STEP 1: Add TypeScript Types to types.ts

### Goal
Define all data structures for services and elements

### File to Modify
`types.ts`

### Code to Add

Add these types after the existing types (after UserProfile or at the end):

```typescript
// Service Planning Types
export type ServiceElementType = 'song' | 'prayer' | 'scripture' | 'sermon' | 'other';

export interface ServiceElement {
  id: string;
  type: ServiceElementType;
  order: number;
  
  // Common fields for all types
  title: string;
  duration?: number; // minutes
  notes?: string; // Internal notes
  bulletinNotes?: string; // Notes for bulletin
  leader?: string; // Person leading this element
  
  // Song-specific fields
  songNumber?: string;
  songTitle?: string;
  
  // Type-specific fields
  scriptureRef?: string; // e.g., "John 3:16-21"
  sermonTitle?: string;
  description?: string; // Generic text for "other" type
}

export interface Service {
  id: string;
  organizationId: string;
  createdBy: string;
  title: string;
  date: any; // Firestore Timestamp
  time?: string; // e.g., "10:30 AM"
  location?: string;
  isTemplate: boolean; // For reusable templates
  archivedAt?: any; // Firestore Timestamp
  createdAt: any;
  updatedAt: any;
  
  // Elements organized by liturgical section
  sections: {
    revelation: ServiceElement[];
    adoration: ServiceElement[];
    confession: ServiceElement[];
    propitiation: ServiceElement[];
    praise: ServiceElement[];
    proclamation: ServiceElement[];
    dedication: ServiceElement[];
    communion: ServiceElement[];
    supplication: ServiceElement[];
    commission: ServiceElement[];
  };
  
  // Computed metadata
  totalDuration?: number; // minutes
  songCount?: number;
}

export type ServiceSectionKey = keyof Service['sections'];

export interface SongUsageRecord {
  songNumber: string;
  serviceId: string;
  serviceTitle: string;
  date: any; // Firestore Timestamp
}
```

### ✅ Checkpoint
- TypeScript compiles without errors
- No type conflicts with existing types
- All interfaces are properly exported

---

## STEP 2: Add Constants for Sections and Element Types

### Goal
Define liturgical sections and element type configurations as constants

### File to Modify
`constants.ts`

### Code to Add

Add to the bottom of `constants.ts`:

```typescript
// Service Planning Constants

export const SERVICE_SECTIONS = [
  { key: 'revelation', title: 'Revelation: God Calls Us To Worship Him' },
  { key: 'adoration', title: 'Adoration: We Praise Our Triune God' },
  { key: 'confession', title: 'Confession: God Calls Us to Confess Our Sins' },
  { key: 'propitiation', title: 'Propitiation: God Declares Us Forgiven Through Christ' },
  { key: 'praise', title: 'We Praise God for Our Salvation' },
  { key: 'proclamation', title: 'Proclamation: God Speaks to Us Through His Word' },
  { key: 'dedication', title: 'Dedication: We Respond to God\'s Word' },
  { key: 'communion', title: 'Communion: The Lord Invites Us to His Table' },
  { key: 'supplication', title: 'Supplication: We Bring Our Requests Before the Lord' },
  { key: 'commission', title: 'Commission: God Sends Us Forth to Serve Him' }
] as const;

export const ELEMENT_TYPES = [
  { value: 'song', label: 'Song' },
  { value: 'prayer', label: 'Prayer' },
  { value: 'scripture', label: 'Scripture Reading' },
  { value: 'sermon', label: 'Sermon' },
  { value: 'other', label: 'Other' }
] as const;

// Default durations for non-song elements (in minutes)
export const DEFAULT_DURATIONS: Record<string, number> = {
  prayer: 2,
  scripture: 3,
  sermon: 30,
  other: 5
};
```

### ✅ Checkpoint
- Constants export correctly
- No TypeScript errors
- Array is marked as `const` for type safety

---

## STEP 3: Add Firestore Security Rules

### Goal
Add security rules for services collection

### File to Modify
`firestore.rules`

### Code to Add

Add this section after the `organizations` match block:

```javascript
// Services Collection (Service Planning - Premium Feature)
match /services/{serviceId} {
  function isOrgMember(orgId) {
    return request.auth != null && 
           request.auth.uid in get(/databases/$(database)/documents/organizations/$(orgId)).data.memberIds;
  }
  
  function isOrgAdmin(orgId) {
    return request.auth != null && (
      get(/databases/$(database)/documents/organizations/$(orgId)).data.createdBy == request.auth.uid ||
      request.auth.uid in get(/databases/$(database)/documents/organizations/$(orgId)).data.adminIds ||
      isGlobalAdmin()
    );
  }
  
  // Members can read services from their org
  allow read: if isOrgMember(resource.data.organizationId);
  
  // Only org admins can create, update, delete
  allow create: if request.auth != null && 
                  isOrgAdmin(request.resource.data.organizationId);
  allow update, delete: if request.auth != null && 
                          isOrgAdmin(resource.data.organizationId);
}

// Song Usage Index (for tracking when songs were used)
match /song_usage_index/{songNumber} {
  allow read: if true; // Public read for displaying usage
  allow write: if false; // Only Cloud Functions can write
}
```

### ✅ Checkpoint
- Rules validate in Firebase Console (no syntax errors)
- Test: Non-admin cannot create service
- Test: Org admin CAN create service
- Test: Anyone can read song_usage_index

---

## STEP 4: Create Utility Helper Functions

### Goal
Create helper functions for service management

### File to Create
Create new file: `utils/servicePlannerUtils.ts`

### Full File Content

```typescript
import { Service, ServiceElement, Song, ServiceSectionKey } from '../types';
import { SERVICE_SECTIONS, DEFAULT_DURATIONS } from '../constants';
import { Timestamp } from 'firebase/firestore';

/**
 * Creates an empty service template
 */
export const createEmptyService = (
  organizationId: string,
  userId: string,
  title: string = 'New Service'
): Omit<Service, 'id' | 'createdAt' | 'updatedAt'> => {
  const sections: any = {};
  
  SERVICE_SECTIONS.forEach(section => {
    sections[section.key] = [];
  });
  
  return {
    organizationId,
    createdBy: userId,
    title,
    date: null,
    time: '',
    location: '',
    isTemplate: false,
    sections,
    totalDuration: 0,
    songCount: 0
  };
};

/**
 * Generates a unique ID for service elements
 */
export const generateElementId = (): string => {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

/**
 * Calculates total duration of a service
 */
export const calculateServiceDuration = (service: Service): number => {
  let total = 0;
  
  SERVICE_SECTIONS.forEach(section => {
    const elements = service.sections[section.key as ServiceSectionKey];
    elements.forEach(el => {
      total += el.duration || 0;
    });
  });
  
  return total;
};

/**
 * Counts total songs in a service
 */
export const countSongs = (service: Service): number => {
  let count = 0;
  
  SERVICE_SECTIONS.forEach(section => {
    const elements = service.sections[section.key as ServiceSectionKey];
    count += elements.filter(el => el.type === 'song').length;
  });
  
  return count;
};

/**
 * Estimates song duration based on lyrics
 */
export const estimateSongDuration = (song: Song): number => {
  if (!song.lyrics) return 3; // Default
  
  // Count stanzas (separated by double newlines)
  const stanzaCount = song.lyrics.split('\n\n').filter(s => s.trim()).length;
  
  // Average: ~45 seconds per stanza + 30 seconds for intro/outro
  const estimatedMinutes = Math.ceil((stanzaCount * 0.75 + 0.5));
  
  return Math.max(2, Math.min(estimatedMinutes, 8)); // Between 2-8 minutes
};

/**
 * Gets default duration for element type
 */
export const getDefaultDuration = (type: string): number => {
  return DEFAULT_DURATIONS[type] || 5;
};

/**
 * Formats duration for display
 */
export const formatDuration = (minutes: number): string => {
  if (minutes < 1) return '< 1 min';
  if (minutes === 1) return '1 min';
  if (minutes < 60) return `${minutes} min`;
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

/**
 * Formats date for display
 */
export const formatServiceDate = (timestamp: any): string => {
  if (!timestamp) return 'No date set';
  
  const date = timestamp.seconds 
    ? new Date(timestamp.seconds * 1000) 
    : new Date(timestamp);
  
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Converts Date to Firestore Timestamp format for input fields
 */
export const timestampToDateInput = (timestamp: any): string => {
  if (!timestamp) return '';
  
  const date = timestamp.seconds 
    ? new Date(timestamp.seconds * 1000) 
    : new Date(timestamp);
  
  return date.toISOString().split('T')[0];
};

/**
 * Converts date input string to Date object
 */
export const dateInputToDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  return new Date(dateString);
};
```

### ✅ Checkpoint
- File compiles without TypeScript errors
- All imports resolve correctly
- Functions are properly typed
- Test: `createEmptyService()` returns valid structure
- Test: `estimateSongDuration()` returns reasonable values

---

## STEP 5: Create ServicePlanner Modal Skeleton

### Goal
Create the main modal container component

### File to Create
Create new file: `components/ServicePlanner.tsx`

### Full File Content

```typescript
import React, { useState } from 'react';
import { X, Plus, Calendar, Loader2 } from 'lucide-react';
import { User } from 'firebase/auth';
import { Organization } from '../types';

interface ServicePlannerProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  myOrgs: Organization[];
  isPremium: boolean;
  onOpenPremium: () => void;
}

const ServicePlanner: React.FC<ServicePlannerProps> = ({
  isOpen,
  onClose,
  user,
  myOrgs,
  isPremium,
  onOpenPremium
}) => {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [selectedOrg, setSelectedOrg] = useState<string>('');

  // Filter to only orgs where user is admin
  const adminOrgs = myOrgs.filter(org => 
    org.createdBy === user?.uid || 
    (org.adminIds && org.adminIds.includes(user?.uid || ''))
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Calendar size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Service Planner</h1>
              <p className="text-xs text-slate-600">Plan and organize worship services</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-200/50 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-hidden bg-slate-50">
          {view === 'list' && (
            <div className="h-full flex flex-col">
              {/* Org Selector Bar */}
              <div className="p-4 bg-white border-b border-slate-200">
                <div className="max-w-sm">
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                    Organization
                  </label>
                  <select
                    value={selectedOrg}
                    onChange={(e) => setSelectedOrg(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">Select an organization...</option>
                    {adminOrgs.map(org => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                  {adminOrgs.length === 0 && (
                    <p className="text-xs text-amber-600 mt-2">
                      You need to create an organization first (with admin privileges).
                    </p>
                  )}
                </div>
              </div>
              
              {/* Empty State */}
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                <Calendar size={64} className="mb-4 opacity-20" />
                <p className="text-lg font-medium">No services yet</p>
                <p className="text-sm mt-2 text-center max-w-md">
                  Create your first worship service to get started with planning
                </p>
                <button 
                  className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!selectedOrg}
                >
                  <Plus size={20} />
                  Create Service
                </button>
                {!selectedOrg && adminOrgs.length > 0 && (
                  <p className="text-xs text-slate-400 mt-3">
                    Select an organization to create a service
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServicePlanner;
```

### ✅ Checkpoint
- Component compiles without errors
- Modal appears when `isOpen={true}`
- Backdrop closes modal on click
- Org selector displays admin orgs
- Empty state shows correctly
- "Create Service" button is disabled when no org selected

---

## Summary of Part 1

**Completed:**
- ✅ Step 1: TypeScript types added to `types.ts`
- ✅ Step 2: Constants defined in `constants.ts`
- ✅ Step 3: Firestore rules added for services
- ✅ Step 4: Utility functions created in `utils/servicePlannerUtils.ts`
- ✅ Step 5: ServicePlanner modal skeleton created

**Files Created:**
- `utils/servicePlannerUtils.ts`
- `components/ServicePlanner.tsx`

**Files Modified:**
- `types.ts`
- `constants.ts`
- `firestore.rules`

**Next:** Part 2 will wire this into the app and add Firestore integration

---

## Testing Checklist for Part 1

- [ ] TypeScript compiles with no errors (`npm run build`)
- [ ] All new files are in correct directories
- [ ] ServicePlanner component exports correctly
- [ ] Constants are accessible from other files
- [ ] Firestore rules deploy without errors
