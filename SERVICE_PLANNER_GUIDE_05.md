# Service Planner Implementation Guide - Part 5: Export Features

**Steps 21-25: Email Export, Playlist Creation, PDF Export, Templates, and Archiving**

---

## STEP 21: Add Email Export Functionality

### Goal
Allow users to email service orders formatted plaintext

### File to Modify
`components/ServiceEditor.tsx`

---

### 21.1 Add Email Export Function

Add this helper function before the return statement:

```typescript
const handleEmailExport = () => {
  const { title, date, time, location } = service;
  
  // Format header
  let emailBody = `SERVICE ORDER\n`;
  emailBody += `${'='.repeat(50)}\n\n`;
  emailBody += `${title}\n`;
  if (date) {
    emailBody += `${formatServiceDate(date)}\n`;
  }
  if (time) emailBody += `Time: ${time}\n`;
  if (location) emailBody += `Location: ${location}\n`;
  emailBody += `\nTotal Duration: ${formatDuration(service.totalDuration || 0)}\n`;
  emailBody += `${'-'.repeat(50)}\n\n`;
  
  // Add each section
  SERVICE_SECTIONS.forEach(section => {
    const elements = service.sections[section.key as ServiceSectionKey];
    if (elements.length === 0) return;
    
    emailBody += `${section.title.toUpperCase()}\n`;
    emailBody += `${'-'.repeat(section.title.length)}\n`;
    
    elements.forEach((element, index) => {
      emailBody += `${index + 1}. ${element.title}`;
      if (element.type === 'song' && element.songNumber) {
        emailBody += ` (Hymn #${element.songNumber})`;
      }
      if (element.duration) {
        emailBody += ` [${element.duration} min]`;
      }
      if (element.leader) {
        emailBody += ` - Led by ${element.leader}`;
      }
      emailBody += `\n`;
      
      if (element.scriptureRef) {
        emailBody += `   Scripture: ${element.scriptureRef}\n`;
      }
      if (element.bulletinNotes) {
        emailBody += `   Note: ${element.bulletinNotes}\n`;
      }
    });
    
    emailBody += `\n`;
  });
  
  // Create mailto link
  const subject = encodeURIComponent(`Service Order: ${title}`);
  const body = encodeURIComponent(emailBody);
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
};
```

---

### 21.2 Add Import for formatServiceDate

```typescript
import { 
  formatDuration, 
  timestampToDateInput, 
  dateInputToDate,
  formatServiceDate // Add this
} from '../utils/servicePlannerUtils';
```

---

### 21.3 Add Email Button to Header

In the header section, add an email button after the duration/song count badges:

```typescript
import { 
  // ... existing icons
  Mail
} from 'lucide-react';

// In the header, add:
<button
  onClick={handleEmailExport}
  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
  title="Email service order"
>
  <Mail size={16} />
  Email
</button>
```

### ✅ Checkpoint
- Email button appears in header
- Click → opens email client with formatted service
- Service order includes all sections
- Elements show correctly with durations
- Song hymn numbers included
- Leader names included

---

## STEP 22: Add Playlist Creation from Service

### Goal
Create an organization playlist from all songs in a service

### File to Modify
`components/ServiceEditor.tsx`

---

### 22.1 Add Props for Playlist Creation

Update ServiceEditorProps:

```typescript
interface ServiceEditorProps {
  service: Service;
  onBack: () => void;
  onUpdate: (updates: Partial<Service>) => Promise<void>;
  hymnalData: Song[];
  organizationId: string; // Add this
  userId: string; // Add this
}
```

Update component parameters:

```typescript
const ServiceEditor: React.FC<ServiceEditorProps> = ({
  service,
  onBack,
  onUpdate,
  hymnalData,
  organizationId, // Add this
  userId // Add this
}) => {
```

---

### 22.2 Add Imports

```typescript
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { SerializedPlaylistItem } from '../types';
```

---

### 22.3 Add Playlist Creation Function

```typescript
const handleCreatePlaylist = async () => {
  try {
    // Collect all songs from the service
    const songs: Array<{ song: Song; label: string }> = [];
    
    SERVICE_SECTIONS.forEach(section => {
      const elements = service.sections[section.key as ServiceSectionKey];
      elements.forEach(element => {
        if (element.type === 'song' && element.songNumber) {
          const song = hymnalData.find(s => s.number === element.songNumber);
          if (song) {
            songs.push({ song, label: 'Piano' }); // Default to piano
          }
        }
      });
    });
    
    if (songs.length === 0) {
      alert('No songs in this service to add to playlist');
      return;
    }
    
    // Create serialized playlist items
    const items: SerializedPlaylistItem[] = songs.map(({ song, label }) => ({
      songNumber: song.number,
      label,
      url: song.accompanimentUrl
    }));
    
    // Save to Firestore
    await addDoc(collection(db, 'playlists'), {
      userId,
      name: `${service.title} - Playlist`,
      items,
      organizationId,
      createdAt: serverTimestamp(),
      order: 9999
    });
    
    alert(`Playlist created with ${songs.length} songs!`);
  } catch (error) {
    console.error('Error creating playlist:', error);
    alert('Failed to create playlist');
  }
};
```

---

### 22.4 Add Playlist Button

Add button in header:

```typescript
import { 
  // ... existing
  ListMusic
} from 'lucide-react';

// Add button:
<button
  onClick={handleCreatePlaylist}
  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
  title="Create playlist from service songs"
>
  <ListMusic size={16} />
  Create Playlist
</button>
```

---

### 22.5 Update ServicePlanner to Pass Props

In `ServicePlanner.tsx`, update the ServiceEditor call:

```typescript
<ServiceEditor
  service={currentService}
  onBack={() => {
    setView('list');
    setEditingServiceId(null);
  }}
  onUpdate={handleUpdateService}
  hymnalData={hymnalData}
  organizationId={selectedOrg}
  userId={user.uid}
/>
```

### ✅ Checkpoint
- "Create Playlist" button appears
- Click → creates org playlist with all service songs
- Playlist appears in PlaylistDrawer under org
- Confirmation alert shows song count
- Works even with no songs (shows alert)

---

## STEP 23: Add Service Duplication and Templates

### Goal
Allow duplicating services and saving as templates

### File to Modify
`components/ServicePlanner.tsx`

---

### 23.1 Add Duplicate Handler

```typescript
const handleDuplicateService = async (sourceService: Service) => {
  if (!user || !selectedOrg) return;
  
  try {
    const emptyService = createEmptyService(selectedOrg, user.uid);
    
    await addDoc(collection(db, 'services'), {
      ...emptyService,
      title: `${sourceService.title} (Copy)`,
      date: Timestamp.now(),
      time: sourceService.time,
      location: sourceService.location,
      sections: sourceService.sections, // Copy all elements
      totalDuration: sourceService.totalDuration,
      songCount: sourceService.songCount,
      isTemplate: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    alert('Service duplicated successfully!');
  } catch (error) {
    console.error('Error duplicating service:', error);
    alert('Failed to duplicate service');
  }
};
```

---

### 23.2 Add Template Toggle Handler

```typescript
const handleToggleTemplate = async (serviceId: string, currentState: boolean) => {
  try {
    await updateDoc(doc(db, 'services', serviceId), {
      isTemplate: !currentState,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error toggling template:', error);
    alert('Failed to update template status');
  }
};
```

---

### 23.3 Add Action Menu to Service Cards

Update the service card with an actions dropdown:

```typescript
import { MoreVertical, Copy, Star, StarOff } from 'lucide-react';

// Add state for action menu
const [actionMenuId, setActionMenuId] = useState<string | null>(null);

// In service card:
<div 
  key={service.id}
  className="bg-white border border-slate-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-md transition-all relative"
>
  <div 
    onClick={() => {
      setEditingServiceId(service.id);
      setView('edit');
    }}
    className="cursor-pointer"
  >
    {/* ... existing content ... */}
  </div>
  
  {/* Actions Menu */}
  <div className="absolute top-3 right-3">
    <button
      onClick={(e) => {
        e.stopPropagation();
        setActionMenuId(actionMenuId === service.id ? null : service.id);
      }}
      className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"
    >
      <MoreVertical size={18} className="text-slate-500" />
    </button>
    
    {actionMenuId === service.id && (
      <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 z-10 overflow-hidden">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDuplicateService(service);
            setActionMenuId(null);
          }}
          className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
        >
          <Copy size={16} />
          Duplicate
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggleTemplate(service.id, service.isTemplate);
            setActionMenuId(null);
          }}
          className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
        >
          {service.isTemplate ? <StarOff size={16} /> : <Star size={16} />}
          {service.isTemplate ? 'Remove Template' : 'Save as Template'}
        </button>
      </div>
    )}
  </div>
</div>
```

### ✅ Checkpoint
- Three-dot menu appears on service cards
- "Duplicate" creates exact copy with "(Copy)" suffix
- "Save as Template" toggles template status
- Template badge shows correctly
- Can duplicate templates

---

## STEP 24: Add Service Archiving

### Goal
Archive old services to declutter active list

### File to Modify
`components/ServicePlanner.tsx`

---

### 24.1 Add Archive Handler

```typescript
const handleArchiveService = async (serviceId: string, isArchived: boolean) => {
  try {
    await updateDoc(doc(db, 'services', serviceId), {
      archivedAt: isArchived ? null : Timestamp.now(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error archiving service:', error);
    alert('Failed to archive service');
  }
};
```

---

### 24.2 Add Delete Handler

```typescript
const handleDeleteService = async (serviceId: string) => {
  const confirmed = window.confirm(
    'Are you sure you want to delete this service? This cannot be undone.'
  );
  if (!confirmed) return;
  
  try {
    await deleteDoc(doc(db, 'services', serviceId));
  } catch (error) {
    console.error('Error deleting service:', error);
    alert('Failed to delete service');
  }
};
```

---

### 24.3 Add to Action Menu

```typescript
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';

// In action menu dropdown:
<button
  onClick={(e) => {
    e.stopPropagation();
    handleArchiveService(service.id, service.archivedAt != null);
    setActionMenuId(null);
  }}
  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100"
>
  {service.archivedAt ? <ArchiveRestore size={16} /> : <Archive size={16} />}
  {service.archivedAt ? 'Restore' : 'Archive'}
</button>
<button
  onClick={(e) => {
    e.stopPropagation();
    handleDeleteService(service.id);
    setActionMenuId(null);
  }}
  className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-slate-100"
>
  <Trash2 size={16} />
  Delete
</button>
```

### ✅ Checkpoint
- Archive button in action menu
- Archive → service moves to "Archived" filter
- Restore → service returns to "Active" filter
- Delete → confirmation then permanent removal
- Archived services not visible in active list

---

## STEP 25: Add Bulletin View Export

### Goal
Create a clean, print-friendly bulletin view

### File to Modify
`components/ServiceEditor.tsx`

---

### 25.1 Add Bulletin View State

```typescript
const [showBulletinView, setShowBulletinView] = useState(false);
```

---

### 25.2 Create Bulletin View Component

```typescript
const BulletinView = () => (
  <div className="bg-white p-8 max-w-4xl mx-auto">
    <div className="text-center mb-8">
      <h1 className="text-3xl font-bold mb-2">{service.title}</h1>
      {service.date && (
        <p className="text-lg text-slate-600">{formatServiceDate(service.date)}</p>
      )}
      {service.time && <p className="text-slate-600">{service.time}</p>}
      {service.location && <p className="text-slate-600">{service.location}</p>}
    </div>
    
    <div className="space-y-6">
      {SERVICE_SECTIONS.map(section => {
        const elements = service.sections[section.key as ServiceSectionKey];
        if (elements.length === 0) return null;
        
        return (
          <div key={section.key}>
            <h2 className="font-bold text-lg mb-3 text-indigo-800 border-b-2 border-indigo-200 pb-1">
              {section.title}
            </h2>
            <div className="space-y-2 pl-4">
              {elements.map(element => (
                <div key={element.id} className="text-sm">
                  <div className="font-medium">
                    {element.title}
                    {element.type === 'song' && element.songNumber && (
                      <span className="text-indigo-600 ml-2">
                        (Hymn #{element.songNumber})
                      </span>
                    )}
                    {element.leader && (
                      <span className="text-slate-500 ml-2 italic">
                        - {element.leader}
                      </span>
                    )}
                  </div>
                  {element.scriptureRef && (
                    <div className="text-slate-600 pl-4">{element.scriptureRef}</div>
                  )}
                  {element.bulletinNotes && (
                    <div className="text-slate-600 pl-4 italic">{element.bulletinNotes}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
    
    <div className="mt-8 pt-4 border-t border-slate-200 text-center">
      <button
        onClick={() => window.print()}
        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 mr-2"
      >
        Print
      </button>
      <button
        onClick={() => setShowBulletinView(false)}
        className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-300"
      >
        Close
      </button>
    </div>
  </div>
);
```

---

### 25.3 Add Bulletin View Button

```typescript
import { FileText } from 'lucide-react';

// In header:
<button
  onClick={() => setShowBulletinView(true)}
  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
  title="View bulletin format"
>
  <FileText size={16} />
  Bulletin
</button>
```

---

### 25.4 Render Bulletin View

```typescript
// Add at top level of return:
{showBulletinView ? (
  <BulletinView />
) : (
  // ... existing editor content ...
)}
```

---

### 25.5 Add Print Styles

Add to your global CSS or create `print.css`:

```css
@media print {
  @page {
    margin: 1in;
  }
  
  body {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  
  button {
    display: none !important;
  }
}
```

### ✅ Checkpoint
- "Bulletin" button appears in header
- Click → shows clean bulletin view
- Print button works
- Only bulletin notes show (not internal notes)
- Hymn numbers included
- Print-friendly formatting

---

## Summary of Part 5

**Completed:**
- ✅ Step 21: Email export with formatted order
- ✅ Step 22: Playlist creation from service songs
- ✅ Step 23: Service duplication and templates
- ✅ Step 24: Service archiving and deletion
- ✅ Step 25: Bulletin view for printing

**Files Modified:**
- `components/ServiceEditor.tsx`
- `components/ServicePlanner.tsx`

**Next:** Part 6 will add final polish, mobile optimization, and help documentation

---

## Testing Checklist for Part 5

- [ ] Email export opens mail client with formatted service
- [ ] Create playlist adds all songs to org playlist
- [ ] Duplicate service creates exact copy
- [ ] Save as template toggles template status
- [ ] Template filter shows only templates
- [ ] Archive moves service to archived filter
- [ ] Restore brings service back
- [ ] Delete permanently removes service
- [ ] Bulletin view shows clean format
- [ ] Print bulletin works correctly
- [ ] Only public notes show in bulletin
