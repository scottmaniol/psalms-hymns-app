# Service Planner Implementation Guide - Part 4: Song Integration & Usage Tracking

**Steps 16-20: Song Search, Auto-Duration, and Usage History**

---

## STEP 16: Create Song Search Panel Component

### Goal
Create a dedicated song search panel for adding songs to services

### File to Create
`components/SongSearchPanel.tsx`

---

### Full File Content

```typescript
import React, { useState, useMemo } from 'react';
import { Search, X, Music, Plus } from 'lucide-react';
import { Song } from '../types';

interface SongSearchPanelProps {
  songs: Song[]; // All hymnal songs
  onSelectSong: (song: Song) => void;
  onClose: () => void;
}

const SongSearchPanel: React.FC<SongSearchPanelProps> = ({
  songs,
  onSelectSong,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter songs based on search
  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return songs.slice(0, 50); // Show first 50 if no search
    
    const q = searchQuery.toLowerCase();
    return songs.filter(song => 
      song.number.toLowerCase().includes(q) ||
      song.title.toLowerCase().includes(q) ||
      (song.tune && song.tune.toLowerCase().includes(q)) ||
      (song.category && song.category.toLowerCase().includes(q))
    ).slice(0, 100); // Limit results
  }, [songs, searchQuery]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-slate-800">Search Songs</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full">
            <X size={20} />
          </button>
        </div>
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by number, title, or tune..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      
      {/* Results */}
      <div className="flex-1 overflow-y-auto p-3 bg-slate-50">
        {filteredSongs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Music size={48} className="mx-auto mb-3 opacity-20" />
            <p>No songs found</p>
            <p className="text-xs mt-2">Try a different search term</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSongs.map(song => (
              <div
                key={song.id}
                onClick={() => onSelectSong(song)}
                className="bg-white border border-slate-200 rounded-lg p-3 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-indigo-600 text-sm shrink-0">
                        #{song.number}
                      </span>
                      <span className="font-medium text-slate-800 truncate">
                        {song.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      {song.tune && song.tune !== 'Unknown' && (
                        <span>{song.tune}</span>
                      )}
                      {song.category && (
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded">
                          {song.category}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <button className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {searchQuery && (
        <div className="p-3 border-t border-slate-200 bg-white text-xs text-slate-500 text-center">
          Showing {filteredSongs.length} of {songs.length} songs
        </div>
      )}
    </div>
  );
};

export default SongSearchPanel;
```

### ✅ Checkpoint
- Component compiles without errors
- Search input filters songs in real-time
- Click song → triggers onSelectSong callback
- Results show song number, title, tune, category
- Empty state shows when no results
- Close button works

---

## STEP 17: Integrate Song Search into Element Editor

### Goal
Add song search capability when element type is "song"

### File to Modify
`components/ElementEditorModal.tsx`

---

### 17.1 Add Props for Song Data

Update the props interface:

```typescript
interface ElementEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  element?: ServiceElement | null;
  onSave: (element: ServiceElement) => void;
  existingElements: ServiceElement[];
  hymnalData: Song[]; // Add this
}
```

Update component parameters:

```typescript
const ElementEditorModal: React.FC<ElementEditorModalProps> = ({
  isOpen,
  onClose,
  element,
  onSave,
  existingElements,
  hymnalData // Add this
}) => {
```

---

### 17.2 Add Imports

```typescript
import { useState } from 'react';
import SongSearchPanel from './SongSearchPanel';
import { Song } from '../types';
import { estimateSongDuration } from '../utils/servicePlannerUtils';
```

---

### 17.3 Add State for Song Selection

Add these state variables:

```typescript
const [showSongSearch, setShowSongSearch] = useState(false);
const [selectedSong, setSelectedSong] = useState<Song | null>(
  element?.type === 'song' && element?.songNumber 
    ? hymnalData.find(s => s.number === element.songNumber) || null
    : null
);
```

---

### 17.4 Add Song Selection Handler

```typescript
const handleSelectSong = (song: Song) => {
  setSelectedSong(song);
  setType('song');
  setTitle(song.title);
  setDuration(estimateSongDuration(song).toString());
  setShowSongSearch(false);
};
```

---

### 17.5 Update Save Handler for Songs

Modify the `handleSave` function to include song data:

```typescript
const handleSave = () => {
  if (!title.trim()) {
    alert('Please enter a title');
    return;
  }

  const newElement: ServiceElement = {
    id: element?.id || generateElementId(),
    type,
    order: element?.order ?? existingElements.length,
    title: title.trim(),
    duration: duration ? parseInt(duration) : getDefaultDuration(type),
    notes: notes.trim() || undefined,
    bulletinNotes: bulletinNotes.trim() || undefined,
    leader: leader.trim() || undefined,
    
    // Song-specific
    songNumber: type === 'song' && selectedSong ? selectedSong.number : undefined,
    songTitle: type === 'song' && selectedSong ? selectedSong.title : undefined,
    
    // Other type-specific fields
    scriptureRef: type === 'scripture' ? scriptureRef.trim() || undefined : undefined,
    sermonTitle: type === 'sermon' ? sermonTitle.trim() || undefined : undefined,
    description: type === 'other' ? description.trim() || undefined : undefined
  };

  onSave(newElement);
  onClose();
};
```

---

### 17.6 Replace Modal Content for Song Type

Replace the content section when type is 'song':

```typescript
{/* Content */}
<div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
  {showSongSearch ? (
    <SongSearchPanel
      songs={hymnalData}
      onSelectSong={handleSelectSong}
      onClose={() => setShowSongSearch(false)}
    />
  ) : (
    <div className="space-y-4">
      {/* Element Type */}
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">
          Element Type
        </label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {ELEMENT_TYPES.map(elementType => (
            <button
              key={elementType.value}
              onClick={() => {
                if (elementType.value === 'song') {
                  setShowSongSearch(true);
                } else {
                  handleTypeChange(elementType.value as ServiceElementType);
                }
              }}
              disabled={isEditing && type === 'song'}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                type === elementType.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              } ${isEditing && type === 'song' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {elementType.label}
            </button>
          ))}
        </div>
      </div>

      {/* If song is selected, show song info */}
      {type === 'song' && selectedSong && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="text-sm text-indigo-600 font-bold mb-1">
                Hymn #{selectedSong.number}
              </div>
              <div className="font-bold text-slate-800">{selectedSong.title}</div>
              {selectedSong.tune && (
                <div className="text-sm text-slate-600 mt-1">{selectedSong.tune}</div>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedSong(null);
                setShowSongSearch(true);
              }}
              className="text-indigo-600 hover:bg-indigo-100 p-1.5 rounded-lg"
              title="Change song"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Show other form fields only if not searching for song */}
      {type !== 'song' || selectedSong ? (
        <>
          {/* Title (read-only for songs) */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={type === 'song'}
              placeholder={type === 'prayer' ? 'e.g., Opening Prayer' : 'Element title'}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100"
            />
          </div>

          {/* Rest of the form fields... */}
          {/* (Keep all existing form fields from previous version) */}
        </>
      ) : null}
    </div>
  )}
</div>
```

### ✅ Checkpoint
- Click "Song" type → song search panel appears
- Search and select song → panel closes, song info shows
- Song title and number populate automatically
- Duration auto-calculates for songs
- Can change song selection
- Other element types still work normally

---

## STEP 18: Wire Song Search into ServiceEditor

### Goal
Pass hymnal data to ElementEditorModal

### File to Modify
`components/ServiceEditor.tsx`

---

### 18.1 Add Hymnal Data Prop

Update ServiceEditorProps:

```typescript
interface ServiceEditorProps {
  service: Service;
  onBack: () => void;
  onUpdate: (updates: Partial<Service>) => Promise<void>;
  hymnalData: Song[]; // Add this
}
```

Update component parameters:

```typescript
const ServiceEditor: React.FC<ServiceEditorProps> = ({
  service,
  onBack,
  onUpdate,
  hymnalData // Add this
}) => {
```

---

### 18.2 Pass to ElementEditorModal

Update the ElementEditorModal component call:

```typescript
<ElementEditorModal
  isOpen={isElementEditorOpen}
  onClose={() => {
    setIsElementEditorOpen(false);
    setEditingElement(null);
    setEditingSection(null);
  }}
  element={editingElement}
  onSave={handleSaveElement}
  existingElements={editingSection ? service.sections[editingSection] : []}
  hymnalData={hymnalData}
/>
```

### ✅ Checkpoint
- ServiceEditor compiles
- ElementEditorModal receives hymnal data
- Song search works when adding elements

---

## STEP 19: Pass Hymnal Data from ServicePlanner

### Goal
Pass hymnal data all the way from App through ServicePlanner to ServiceEditor

### Files to Modify
1. `components/ServicePlanner.tsx`
2. `App.tsx`

---

### 19.1 Update ServicePlanner Props

In `ServicePlanner.tsx`, add to the interface:

```typescript
interface ServicePlannerProps {
  // ... existing props
  hymnalData: Song[]; // Add this
}
```

Add to component parameters:

```typescript
const ServicePlanner: React.FC<ServicePlannerProps> = ({
  // ... existing
  hymnalData // Add this
}) => {
```

---

### 19.2 Pass to ServiceEditor

Update the ServiceEditor call in ServicePlanner:

```typescript
<ServiceEditor
  service={currentService}
  onBack={() => {
    setView('list');
    setEditingServiceId(null);
  }}
  onUpdate={handleUpdateService}
  hymnalData={hymnalData}
/>
```

---

### 19.3 Update App.tsx

In `App.tsx`, update the ServicePlanner component call:

```typescript
<ServicePlanner
  isOpen={isServicePlannerOpen}
  onClose={() => setIsServicePlannerOpen(false)}
  user={user}
  myOrgs={myOrgs}
  isPremium={isPremium}
  onOpenPremium={() => setIsPremiumModalOpen(true)}
  hymnalData={hymnalData}
/>
```

### ✅ Checkpoint
- All components compile
- Song search works throughout the flow
- Can add songs to any section
- Songs display with hymn number
- Duration auto-calculates correctly

---

## STEP 20: Add Song Usage Tracking Display

### Goal
Show where and when songs have been used in services

### File to Create
`components/SongUsageDisplay.tsx`

---

### Full File Content

```typescript
import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

interface ServiceUsage {
  serviceId: string;
  serviceTitle: string;
  date: any;
  time?: string;
  location?: string;
}

interface SongUsageDisplayProps {
  songNumber: string;
}

const SongUsageDisplay: React.FC<SongUsageDisplayProps> = ({ songNumber }) => {
  const [usages, setUsages] = useState<ServiceUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchUsages = async () => {
      setIsLoading(true);
      try {
        // Query all services
        const servicesQuery = query(
          collection(db, 'services'),
          orderBy('date', 'desc'),
          limit(100) // Get recent services
        );
        
        const snapshot = await getDocs(servicesQuery);
        const foundUsages: ServiceUsage[] = [];
        
        snapshot.forEach(doc => {
          const service = doc.data();
          
          // Check all sections for this song
          let foundInService = false;
          Object.keys(service.sections || {}).forEach(sectionKey => {
            const elements = service.sections[sectionKey] || [];
            elements.forEach((element: any) => {
              if (element.type === 'song' && element.songNumber === songNumber) {
                foundInService = true;
              }
            });
          });
          
          if (foundInService) {
            foundUsages.push({
              serviceId: doc.id,
              serviceTitle: service.title,
              date: service.date,
              time: service.time,
              location: service.location
            });
          }
        });
        
        setUsages(foundUsages);
      } catch (error) {
        console.error('Error fetching song usages:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUsages();
  }, [songNumber]);

  if (isLoading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-center py-4">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  if (usages.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h4 className="font-bold text-slate-700 mb-2 text-sm">Service History</h4>
        <p className="text-sm text-slate-500">
          This song hasn't been used in any services yet.
        </p>
      </div>
    );
  }

  const displayedUsages = showAll ? usages : usages.slice(0, 3);
  const lastUsed = usages[0];

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h4 className="font-bold text-blue-900 mb-3 text-sm flex items-center gap-2">
        <Calendar size={16} />
        Service History
      </h4>
      
      {/* Summary */}
      <div className="mb-3 text-sm text-blue-800">
        <p>
          <strong>Used {usages.length} time{usages.length !== 1 ? 's' : ''}</strong>
        </p>
        {lastUsed && (
          <p className="text-blue-700 mt-1">
            Last used: <strong>{new Date(lastUsed.date.seconds * 1000).toLocaleDateString()}</strong> 
            {' '}in "{lastUsed.serviceTitle}"
          </p>
        )}
      </div>
      
      {/* Recent Services List */}
      <div className="space-y-2">
        {displayedUsages.map((usage) => (
          <div 
            key={usage.serviceId}
            className="bg-white border border-blue-200 rounded-lg p-3 text-xs"
          >
            <div className="font-bold text-slate-800 mb-1">{usage.serviceTitle}</div>
            <div className="flex items-center gap-3 text-slate-600">
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {new Date(usage.date.seconds * 1000).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
              {usage.time && (
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {usage.time}
                </span>
              )}
              {usage.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} />
                  {usage.location}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Show More Button */}
      {usages.length > 3 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 w-full text-center text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          {showAll ? 'Show Less' : `Show All ${usages.length} Uses`}
        </button>
      )}
    </div>
  );
};

export default SongUsageDisplay;
```

---

### Add to Song Detail View

In `App.tsx`, find the song detail view (where lyrics are shown) and add the usage display:

```typescript
// In the 'lyrics' tab content, after the metadata card:
{user && isPremium && (
  <SongUsageDisplay songNumber={selectedSong.number} />
)}
```

Don't forget to import:

```typescript
import SongUsageDisplay from './components/SongUsageDisplay';
```

### ✅ Checkpoint
- Song usage component displays in song detail view
- Shows count of times used
- Shows most recent usage
- Lists recent services where song was used
- "Show All" button works for >3 usages
- Only visible to premium users

---

## Summary of Part 4

**Completed:**
- ✅ Step 16: Song search panel component created
- ✅ Step 17: Song search integrated into element editor
- ✅ Step 18: Song data wired through ServiceEditor
- ✅ Step 19: Hymnal data passed from App
- ✅ Step 20: Song usage tracking display added

**Files Created:**
- `components/SongSearchPanel.tsx`
- `components/SongUsageDisplay.tsx`

**Files Modified:**
- `components/ElementEditorModal.tsx`
- `components/ServiceEditor.tsx`
- `components/ServicePlanner.tsx`
- `App.tsx`

**Next:** Part 5 will add export features (email, PDF, playlist creation)

---

## Testing Checklist for Part 4

- [ ] Click "Song" element type → search panel appears
- [ ] Search filters songs correctly
- [ ] Select song → auto-fills title and duration
- [ ] Song number displays in element card
- [ ] Can add songs to any section
- [ ] Duration calculates based on song length
- [ ] Song usage displays in song detail (premium)
- [ ] Usage shows correct service count
- [ ] Recent services list accurately
- [ ] Show all button works
