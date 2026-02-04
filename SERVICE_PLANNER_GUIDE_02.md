# Service Planner Implementation Guide - Part 2: App Integration & Service List

**Steps 6-10: Wire to App, Firestore Integration, Service CRUD, and Service Editor**

---

## STEP 6: Wire ServicePlanner into App and Menu

### Goal
Add Service Planner menu item and integrate modal into main app

### Files to Modify
1. `App.tsx`
2. `components/Menu.tsx`

---

### 6.1 Update App.tsx

#### Import ServicePlanner
Add this import near the top with other component imports:

```typescript
import ServicePlanner from './components/ServicePlanner';
```

#### Add State for Modal
Add this state near other modal states (around line 70-80):

```typescript
const [isServicePlannerOpen, setIsServicePlannerOpen] = useState(false);
```

#### Render ServicePlanner Component
Add this in the return JSX, after the `InstallInstructionsModal` component (before the closing `</div>`):

```typescript
<ServicePlanner
  isOpen={isServicePlannerOpen}
  onClose={() => setIsServicePlannerOpen(false)}
  user={user}
  myOrgs={myOrgs}
  isPremium={isPremium}
  onOpenPremium={() => setIsPremiumModalOpen(true)}
/>
```

---

### 6.2 Update Menu.tsx

#### Add Import
At the top of `Menu.tsx`, add to the imports from 'lucide-react':

```typescript
import { ..., Calendar } from 'lucide-react';
```

#### Update Interface
Add the new prop to the `MenuProps` interface:

```typescript
interface MenuProps {
  // ... existing props
  onOpenServicePlanner: () => void;
}
```

Update the component parameters to include it:

```typescript
const Menu: React.FC<MenuProps> = ({
  // ... existing props
  onOpenServicePlanner
}) => {
```

#### Add Menu Item
Find the menu dropdown items section and add this button after the "Resources" button:

```typescript
<button
  onClick={() => {
    if (!isPremium) {
      onOpenPremium();
      setIsOpen(false);
      return;
    }
    onOpenServicePlanner();
    setIsOpen(false);
  }}
  className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
>
  <Calendar size={18} />
  Service Planner
  {!isPremium && (
    <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
      Premium
    </span>
  )}
</button>
```

---

### 6.3 Update Menu Call in App.tsx

Find where `<Menu` is rendered in App.tsx and add the new prop:

```typescript
<Menu 
  // ... existing props
  onOpenServicePlanner={() => setIsServicePlannerOpen(true)}
/>
```

Do this in **both locations** where Menu is rendered (list view and detail view).

### ✅ Checkpoint
- App compiles without errors
- Menu shows "Service Planner" option
- Click "Service Planner" → modal opens
- Free users see premium badge and get upsell modal
- Premium users see the Service Planner modal
- Modal closes when clicking backdrop

---

## STEP 7: Add Firestore Listener to Fetch Services

### Goal
Connect ServicePlanner to Firestore to fetch real services

### File to Modify
`components/ServicePlanner.tsx`

---

### 7.1 Add Imports

Add these imports at the top:

```typescript
import { useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Service } from '../types';
```

---

### 7.2 Add State for Services

Add these new state variables after the existing ones:

```typescript
const [services, setServices] = useState<Service[]>([]);
const [isLoading, setIsLoading] = useState(false);
const [filter, setFilter] = useState<'active' | 'archived' | 'templates'>('active');
```

---

### 7.3 Add Auto-Select First Org

Add this useEffect after the state declarations:

```typescript
// Auto-select first admin org
useEffect(() => {
  if (adminOrgs.length > 0 && !selectedOrg) {
    setSelectedOrg(adminOrgs[0].id);
  }
}, [adminOrgs, selectedOrg]);
```

---

### 7.4 Add Firestore Listener

Add this useEffect to listen for services:

```typescript
// Fetch services for selected org
useEffect(() => {
  if (!isOpen || !user || !selectedOrg) {
    setServices([]);
    return;
  }
  
  setIsLoading(true);
  
  const q = query(
    collection(db, 'services'),
    where('organizationId', '==', selectedOrg),
    orderBy('date', 'desc')
  );
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const fetchedServices: Service[] = [];
    snapshot.forEach(doc => {
      fetchedServices.push({ id: doc.id, ...doc.data() } as Service);
    });
    setServices(fetchedServices);
    setIsLoading(false);
  }, (error) => {
    console.error('Error fetching services:', error);
    setIsLoading(false);
  });
  
  return () => unsubscribe();
}, [isOpen, user, selectedOrg]);
```

---

### 7.5 Filter Services by Type

Add this computed value before the return statement:

```typescript
// Filter services based on active filter
const filteredServices = services.filter(service => {
  if (filter === 'archived') {
    return service.archivedAt != null;
  } else if (filter === 'templates') {
    return service.isTemplate === true;
  } else {
    // active = not archived and not template
    return service.archivedAt == null && !service.isTemplate;
  }
});
```

---

### 7.6 Update UI to Show Loading and Services

Replace the empty state section with this complete services list:

```typescript
{/* Services List */}
<div className="flex-1 overflow-y-auto p-4">
  {/* Filter Tabs */}
  <div className="flex gap-2 mb-4">
    <button
      onClick={() => setFilter('active')}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        filter === 'active'
          ? 'bg-indigo-600 text-white'
          : 'bg-white text-slate-600 hover:bg-slate-100'
      }`}
    >
      Active ({services.filter(s => s.archivedAt == null && !s.isTemplate).length})
    </button>
    <button
      onClick={() => setFilter('templates')}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        filter === 'templates'
          ? 'bg-indigo-600 text-white'
          : 'bg-white text-slate-600 hover:bg-slate-100'
      }`}
    >
      Templates ({services.filter(s => s.isTemplate).length})
    </button>
    <button
      onClick={() => setFilter('archived')}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        filter === 'archived'
          ? 'bg-indigo-600 text-white'
          : 'bg-white text-slate-600 hover:bg-slate-100'
      }`}
    >
      Archived ({services.filter(s => s.archivedAt != null).length})
    </button>
  </div>

  {isLoading ? (
    <div className="flex justify-center py-12">
      <Loader2 size={32} className="animate-spin text-indigo-500" />
    </div>
  ) : filteredServices.length === 0 ? (
    <div className="text-center py-12 text-slate-400">
      <Calendar size={48} className="mx-auto mb-3 opacity-20" />
      <p className="text-lg font-medium">
        {filter === 'templates' ? 'No templates' : filter === 'archived' ? 'No archived services' : 'No services yet'}
      </p>
      <p className="text-sm mt-2">Create your first worship service</p>
      <button 
        className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto transition-colors"
        disabled={!selectedOrg}
      >
        <Plus size={16} />
        Create Service
      </button>
    </div>
  ) : (
    <div className="space-y-3">
      {filteredServices.map(service => (
        <div 
          key={service.id}
          className="bg-white border border-slate-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-bold text-slate-800 text-lg">{service.title}</h3>
              <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {service.date 
                    ? new Date(service.date.seconds * 1000).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })
                    : 'No date set'
                  }
                </span>
                {service.time && <span>• {service.time}</span>}
                {service.location && <span>• {service.location}</span>}
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                <span>{service.songCount || 0} songs</span>
                {service.totalDuration && <span>• {service.totalDuration} min</span>}
                {service.isTemplate && (
                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                    Template
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

### ✅ Checkpoint
- Services load from Firestore
- Filter tabs work correctly
- Loading spinner shows while fetching
- Empty state shows when no services
- Services display with date, time, location
- Template badge shows for templates

---

## STEP 8: Implement Create Service Functionality

### Goal
Add ability to create new services in Firestore

### File to Modify
`components/ServicePlanner.tsx`

---

### 8.1 Add Imports

Add these to the existing Firestore imports:

```typescript
import { addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
```

Add util import:

```typescript
import { createEmptyService } from '../utils/servicePlannerUtils';
```

---

### 8.2 Add State for Editing

Add this state variable:

```typescript
const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
```

---

### 8.3 Create Handler Function

Add this handler function before the return statement:

```typescript
const handleCreateService = async () => {
  if (!user || !selectedOrg) return;
  
  try {
    const emptyService = createEmptyService(selectedOrg, user.uid);
    
    const docRef = await addDoc(collection(db, 'services'), {
      ...emptyService,
      date: Timestamp.now(), // Default to today
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Switch to edit view
    setEditingServiceId(docRef.id);
    setView('edit');
  } catch (error) {
    console.error('Error creating service:', error);
    alert('Failed to create service. Please try again.');
  }
};
```

---

### 8.4 Wire Up Create Button

Find the "Create Service" button in the empty state and update its onClick:

```typescript
<button 
  onClick={handleCreateService}
  className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto transition-colors disabled:opacity-50"
  disabled={!selectedOrg}
>
  <Plus size={16} />
  Create Service
</button>
```

---

### 8.5 Add Create Button to Header

Add a floating create button that's always visible when org is selected. Add this inside the org selector bar section:

```typescript
{/* Org Selector Bar */}
<div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
  <div className="max-w-sm flex-1">
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
  
  {selectedOrg && (
    <button
      onClick={handleCreateService}
      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
    >
      <Plus size={18} />
      New Service
    </button>
  )}
</div>
```

### ✅ Checkpoint
- Click "Create Service" → new service created in Firestore
- Automatically switches to edit view
- Service has default title "New Service"
- Service has today's date by default
- All 10 sections exist but are empty
- Can verify in Firestore console that document was created

---

## STEP 9: Create ServiceEditor Component with Sections Display

### Goal
Create the editor view for editing service details and viewing sections

### File to Create
`components/ServiceEditor.tsx`

---

### Full File Content

Create a new file `components/ServiceEditor.tsx`:

```typescript
import React, { useState } from 'react';
import { Service, ServiceSectionKey } from '../types';
import { SERVICE_SECTIONS } from '../constants';
import { 
  ArrowLeft, 
  Save, 
  Calendar, 
  Clock, 
  MapPin, 
  Plus,
  Music,
  Timer
} from 'lucide-react';
import { 
  formatDuration, 
  timestampToDateInput, 
  dateInputToDate 
} from '../utils/servicePlannerUtils';
import { Timestamp } from 'firebase/firestore';

interface ServiceEditorProps {
  service: Service;
  onBack: () => void;
  onUpdate: (updates: Partial<Service>) => Promise<void>;
}

const ServiceEditor: React.FC<ServiceEditorProps> = ({
  service,
  onBack,
  onUpdate
}) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdate = async (updates: Partial<Service>) => {
    setIsSaving(true);
    try {
      await onUpdate(updates);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDateChange = (dateString: string) => {
    const date = dateInputToDate(dateString);
    if (date) {
      handleUpdate({ date: Timestamp.fromDate(date) });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center gap-4 bg-white">
        <button 
          onClick={onBack} 
          className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          title="Back to list"
        >
          <ArrowLeft size={20} />
        </button>
        
        <input
          type="text"
          value={service.title}
          onChange={(e) => handleUpdate({ title: e.target.value })}
          className="flex-1 text-xl font-bold border-none outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 py-1"
          placeholder="Service Title"
        />
        
        <div className="flex items-center gap-2 text-sm text-slate-600">
          {isSaving && (
            <span className="flex items-center gap-2 text-indigo-600">
              <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse"></div>
              Saving...
            </span>
          )}
          <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 rounded-lg">
            <Timer size={16} />
            {formatDuration(service.totalDuration || 0)}
          </div>
          <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 rounded-lg">
            <Music size={16} />
            {service.songCount || 0} songs
          </div>
        </div>
      </div>
      
      {/* Metadata Bar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
              <Calendar size={12} />
              Date
            </label>
            <input
              type="date"
              value={timestampToDateInput(service.date)}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
              <Clock size={12} />
              Time
            </label>
            <input
              type="time"
              value={service.time || ''}
              onChange={(e) => handleUpdate({ time: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
              <MapPin size={12} />
              Location
            </label>
            <input
              type="text"
              value={service.location || ''}
              onChange={(e) => handleUpdate({ location: e.target.value })}
              placeholder="Church Building"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
      </div>
      
      {/* Sections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {SERVICE_SECTIONS.map(section => {
          const elements = service.sections[section.key as ServiceSectionKey];
          const sectionDuration = elements.reduce((sum, el) => sum + (el.duration || 0), 0);
          
          return (
            <div 
              key={section.key} 
              className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm"
            >
              {/* Section Header */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">{section.title}</h3>
                  <div className="flex items-center gap-3">
                    {sectionDuration > 0 && (
                      <span className="text-xs text-slate-600">
                        {formatDuration(sectionDuration)}
                      </span>
                    )}
                    <button 
                      className="text-indigo-600 hover:bg-indigo-100 p-1.5 rounded-lg transition-colors"
                      title="Add element"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Section Content */}
              <div className="p-3">
                {elements.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm">
                    <p>No elements yet</p>
                    <button className="mt-2 text-indigo-600 hover:text-indigo-700 font-medium text-xs">
                      + Add Element
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {elements.map(element => (
                      <div 
                        key={element.id}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:border-indigo-300 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-slate-800">{element.title}</div>
                            <div className="text-xs text-slate-500 mt-1">
                              {element.type === 'song' && element.songNumber && (
                                <span>Hymn {element.songNumber} • </span>
                              )}
                              {element.duration && <span>{element.duration} min</span>}
                              {element.leader && <span> • Led by {element.leader}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ServiceEditor;
```

### ✅ Checkpoint
- ServiceEditor component compiles
- All imports resolve
- Component displays service metadata inputs
- All 10 sections render
- Empty sections show "No elements yet"
- Section headers show duration when elements exist
- Title editing works
- Date/time/location inputs work
- Total duration displays in header
- Song count displays in header

---

## STEP 10: Wire ServiceEditor into ServicePlanner

### Goal
Connect the editor to the main ServicePlanner modal

### File to Modify
`components/ServicePlanner.tsx`

---

### 10.1 Add Import

```typescript
import ServiceEditor from './ServiceEditor';
import { updateDoc, doc } from 'firebase/firestore';
```

---

### 10.2 Add Update Handler

Add this function before the return statement:

```typescript
const handleUpdateService = async (updates: Partial<Service>) => {
  if (!editingServiceId) return;
  
  try {
    await updateDoc(doc(db, 'services', editingServiceId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating service:', error);
    alert('Failed to update service');
  }
};
```

---

### 10.3 Get Current Service

Add this helper before the return:

```typescript
const currentService = services.find(s => s.id === editingServiceId);
```

---

### 10.4 Add Edit View to Render

Replace the content area to handle both list and edit views:

```typescript
{/* Content Area */}
<div className="flex-1 overflow-hidden bg-slate-50">
  {view === 'list' ? (
    // ... existing list view code ...
  ) : view === 'edit' && currentService ? (
    <ServiceEditor
      service={currentService}
      onBack={() => {
        setView('list');
        setEditingServiceId(null);
      }}
      onUpdate={handleUpdateService}
    />
  ) : (
    <div className="h-full flex items-center justify-center text-slate-400">
      <p>Loading...</p>
    </div>
  )}
</div>
```

---

### 10.5 Add Click Handler to Service Cards

In the service card rendering, add an onClick:

```typescript
<div 
  key={service.id}
  onClick={() => {
    setEditingServiceId(service.id);
    setView('edit');
  }}
  className="bg-white border border-slate-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
>
  {/* ... existing content ... */}
</div>
```

### ✅ Checkpoint
- Click service card → opens editor
- Editor shows service details
- Can edit title, date, time, location
- Changes save to Firestore automatically
- Click back arrow → returns to list
- All 10 sections visible in editor
- Real-time updates reflect immediately

---

## Summary of Part 2

**Completed:**
- ✅ Step 6: Service Planner wired into App and Menu
- ✅ Step 7: Firestore listener fetches services
- ✅ Step 8: Create service functionality works
- ✅ Step 9: ServiceEditor component created
- ✅ Step 10: ServiceEditor integrated with ServicePlanner

**Files Created:**
- `components/ServiceEditor.tsx`

**Files Modified:**
- `App.tsx`
- `components/Menu.tsx`
- `components/ServicePlanner.tsx`

**Next:** Part 3 will add element CRUD operations (add, edit, delete, reorder elements within sections)

---

## Testing Checklist for Part 2

- [ ] Menu shows "Service Planner" option
- [ ] Clicking opens modal for premium users
- [ ] Free users see upsell
- [ ] Services list shows all services from Firestore
- [ ] Filter tabs work (Active, Templates, Archived)
- [ ] Click "Create Service" → new service appears
- [ ] Click service card → opens editor
- [ ] Editor shows correct service details
- [ ] Editing title saves to Firestore
- [ ] Editing date/time/location saves
- [ ] Back button returns to list
- [ ] Changes reflect in list immediately
