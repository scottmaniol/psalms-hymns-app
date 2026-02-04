# Service Planner Implementation Guide - Part 3: Element Management

**Steps 11-15: Adding, Editing, and Deleting Service Elements**

---

## STEP 11: Create Element Editor Modal Component

### Goal
Create a modal for adding/editing service elements

### File to Create
`components/ElementEditorModal.tsx`

---

### Full File Content

```typescript
import React, { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { ServiceElement, ServiceElementType } from '../types';
import { ELEMENT_TYPES } from '../constants';
import { generateElementId, getDefaultDuration } from '../utils/servicePlannerUtils';

interface ElementEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  element?: ServiceElement | null; // If editing existing
  onSave: (element: ServiceElement) => void;
  existingElements: ServiceElement[]; // For determining order
}

const ElementEditorModal: React.FC<ElementEditorModalProps> = ({
  isOpen,
  onClose,
  element,
  onSave,
  existingElements
}) => {
  const isEditing = element != null;
  
  const [type, setType] = useState<ServiceElementType>(element?.type || 'prayer');
  const [title, setTitle] = useState(element?.title || '');
  const [duration, setDuration] = useState(element?.duration?.toString() || '');
  const [notes, setNotes] = useState(element?.notes || '');
  const [bulletinNotes, setBulletinNotes] = useState(element?.bulletinNotes || '');
  const [leader, setLeader] = useState(element?.leader || '');
  
  // Type-specific fields
  const [scriptureRef, setScriptureRef] = useState(element?.scriptureRef || '');
  const [sermonTitle, setSermonTitle] = useState(element?.sermonTitle || '');
  const [description, setDescription] = useState(element?.description || '');

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
      scriptureRef: type === 'scripture' ? scriptureRef.trim() || undefined : undefined,
      sermonTitle: type === 'sermon' ? sermonTitle.trim() || undefined : undefined,
      description: type === 'other' ? description.trim() || undefined : undefined
    };

    onSave(newElement);
    onClose();
  };

  const handleTypeChange = (newType: ServiceElementType) => {
    setType(newType);
    // Auto-fill duration based on type
    if (!duration) {
      setDuration(getDefaultDuration(newType).toString());
    }
    // Auto-fill title for some types
    if (!title) {
      if (newType === 'prayer') setTitle('Prayer');
      if (newType === 'scripture') setTitle('Scripture Reading');
      if (newType === 'sermon') setTitle('Sermon');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">
            {isEditing ? 'Edit Element' : 'Add Element'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-4">
          {/* Element Type */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Element Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {ELEMENT_TYPES.map(elementType => (
                <button
                  key={elementType.value}
                  onClick={() => handleTypeChange(elementType.value as ServiceElementType)}
                  disabled={isEditing && type === 'song'} // Can't change song type
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

          {/* Title */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === 'prayer' ? 'e.g., Opening Prayer' : 'Element title'}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Type-specific fields */}
          {type === 'scripture' && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Scripture Reference
              </label>
              <input
                type="text"
                value={scriptureRef}
                onChange={(e) => setScriptureRef(e.target.value)}
                placeholder="e.g., John 3:16-21"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          )}

          {type === 'sermon' && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Sermon Title
              </label>
              <input
                type="text"
                value={sermonTitle}
                onChange={(e) => setSermonTitle(e.target.value)}
                placeholder="e.g., The Grace of God"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          )}

          {type === 'other' && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this element..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              />
            </div>
          )}

          {/* Duration and Leader */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min="1"
                max="120"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Leader
              </label>
              <input
                type="text"
                value={leader}
                onChange={(e) => setLeader(e.target.value)}
                placeholder="e.g., Pastor John"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Internal Notes
              <span className="text-xs text-slate-500 font-normal ml-2">(Not printed in bulletin)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes for planning team..."
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>

          {/* Bulletin Notes */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Bulletin Notes
              <span className="text-xs text-slate-500 font-normal ml-2">(Printed in bulletin)</span>
            </label>
            <textarea
              value={bulletinNotes}
              onChange={(e) => setBulletinNotes(e.target.value)}
              placeholder="Notes for congregation..."
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <button
            onClick={onClose}
            className="px-6 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Save size={18} />
            {isEditing ? 'Update' : 'Add'} Element
          </button>
        </div>
      </div>
    </div>
  );
};

export default ElementEditorModal;
```

### ✅ Checkpoint
- Component compiles without errors
- Modal displays when isOpen is true
- Type selector buttons work
- All form fields render correctly
- Type-specific fields show based on selection
- Save button validates title
- Cancel closes modal

---

## STEP 12: Wire Element Editor into ServiceEditor

### Goal
Add ability to open element editor from section headers

### File to Modify
`components/ServiceEditor.tsx`

---

### 12.1 Add Imports

```typescript
import { useState } from 'react';
import ElementEditorModal from './ElementEditorModal';
import { ServiceElement, ServiceSectionKey } from '../types';
import { calculateServiceDuration, countSongs } from '../utils/servicePlannerUtils';
```

---

### 12.2 Add State for Element Editor

Add these state variables after the existing `isSaving` state:

```typescript
const [isElementEditorOpen, setIsElementEditorOpen] = useState(false);
const [editingElement, setEditingElement] = useState<ServiceElement | null>(null);
const [editingSection, setEditingSection] = useState<ServiceSectionKey | null>(null);
```

---

### 12.3 Add Element Save Handler

Add this function before the return statement:

```typescript
const handleSaveElement = async (element: ServiceElement) => {
  if (!editingSection) return;
  
  const currentElements = service.sections[editingSection];
  let updatedElements: ServiceElement[];
  
  if (editingElement) {
    // Update existing element
    updatedElements = currentElements.map(el => 
      el.id === element.id ? element : el
    );
  } else {
    // Add new element
    updatedElements = [...currentElements, element];
  }
  
  // Update sections
  const updatedSections = {
    ...service.sections,
    [editingSection]: updatedElements
  };
  
  // Recalculate metadata
  const updatedService = {
    ...service,
    sections: updatedSections
  };
  
  await handleUpdate({
    sections: updatedSections,
    totalDuration: calculateServiceDuration(updatedService),
    songCount: countSongs(updatedService)
  });
  
  // Reset state
  setIsElementEditorOpen(false);
  setEditingElement(null);
  setEditingSection(null);
};
```

---

### 12.4 Add Open Editor Handler

```typescript
const handleOpenElementEditor = (sectionKey: ServiceSectionKey, element?: ServiceElement) => {
  setEditingSection(sectionKey);
  setEditingElement(element || null);
  setIsElementEditorOpen(true);
};
```

---

###12.5 Update Plus Button Click Handler

Find the Plus button in the section header and update it:

```typescript
<button 
  onClick={() => handleOpenElementEditor(section.key as ServiceSectionKey)}
  className="text-indigo-600 hover:bg-indigo-100 p-1.5 rounded-lg transition-colors"
  title="Add element"
>
  <Plus size={16} />
</button>
```

Also update the "Add Element" button in empty sections:

```typescript
<button 
  onClick={() => handleOpenElementEditor(section.key as ServiceSectionKey)}
  className="mt-2 text-indigo-600 hover:text-indigo-700 font-medium text-xs"
>
  + Add Element
</button>
```

---

### 12.6 Render Element Editor Modal

Add this before the closing div in the return statement:

```typescript
{/* Element Editor Modal */}
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
/>
```

### ✅ Checkpoint
- Click "+ Add Element" → modal opens
- Type selection works
- Fill form and save → element appears in section
- Element displays title and duration
- Total service duration updates
- Modal closes after save

---

## STEP 13: Add Edit and Delete Element Functionality

### Goal
Allow editing and deleting existing elements

### File to Modify
`components/ServiceEditor.tsx`

---

### 13.1 Add Delete Handler

Add this function after `handleSaveElement`:

```typescript
const handleDeleteElement = async (sectionKey: ServiceSectionKey, elementId: string) => {
  const confirmed = window.confirm('Delete this element?');
  if (!confirmed) return;
  
  const currentElements = service.sections[sectionKey];
  const updatedElements = currentElements.filter(el => el.id !== elementId);
  
  // Reorder remaining elements
  const reorderedElements = updatedElements.map((el, index) => ({
    ...el,
    order: index
  }));
  
  // Update sections
  const updatedSections = {
    ...service.sections,
    [sectionKey]: reorderedElements
  };
  
  // Recalculate metadata
  const updatedService = {
    ...service,
    sections: updatedSections
  };
  
  await handleUpdate({
    sections: updatedSections,
    totalDuration: calculateServiceDuration(updatedService),
    songCount: countSongs(updatedService)
  });
};
```

---

### 13.2 Update Element Card with Actions

Replace the element card rendering with this enhanced version:

```typescript
<div className="space-y-2">
  {elements.map(element => (
    <div 
      key={element.id}
      className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:border-indigo-300 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-800">{element.title}</div>
          <div className="text-xs text-slate-500 mt-1 space-x-2">
            {element.type === 'song' && element.songNumber && (
              <span className="text-indigo-600 font-medium">Hymn {element.songNumber}</span>
            )}
            {element.type !== 'song' && (
              <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">
                {element.type}
              </span>
            )}
            {element.duration && <span>• {element.duration} min</span>}
            {element.leader && <span>• {element.leader}</span>}
          </div>
          {element.scriptureRef && (
            <div className="text-xs text-slate-600 mt-1">{element.scriptureRef}</div>
          )}
          {element.notes && (
            <div className="text-xs text-amber-700 mt-1 italic">📝 {element.notes}</div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => handleOpenElementEditor(section.key as ServiceSectionKey, element)}
            className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded transition-colors"
            title="Edit"
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={() => handleDeleteElement(section.key as ServiceSectionKey, element.id)}
            className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  ))}
</div>
```

---

### 13.3 Add Icon Imports

Add these icons to the imports from 'lucide-react':

```typescript
import { 
  // ... existing icons
  Edit3,
  Trash2
} from 'lucide-react';
```

### ✅ Checkpoint
- Hover over element → edit and delete buttons appear
- Click edit → modal opens with element data pre-filled
- Edit and save → element updates
- Click delete → confirmation dialog appears
- Confirm delete → element removed
- Duration recalculates correctly

---

## STEP 14: Add Drag-and-Drop Reordering

### Goal
Allow reordering elements within sections via drag and drop

### File to Modify
`components/ServiceEditor.tsx`

---

### 14.1 Add Drag State

Add these state variables:

```typescript
const [draggedElement, setDraggedElement] = useState<{
  sectionKey: ServiceSectionKey;
  elementId: string;
} | null>(null);
```

---

### 14.2 Add Drag Handlers

Add these functions:

```typescript
const handleDragStart = (sectionKey: ServiceSectionKey, elementId: string) => {
  setDraggedElement({ sectionKey, elementId });
};

const handleDragOver = (e: React.DragEvent, sectionKey: ServiceSectionKey, targetElementId: string) => {
  e.preventDefault();
  
  if (!draggedElement) return;
  
  // Can only drag within same section for now
  if (draggedElement.sectionKey !== sectionKey) return;
  if (draggedElement.elementId === targetElementId) return;
  
  const elements = service.sections[sectionKey];
  const fromIndex = elements.findIndex(el => el.id === draggedElement.elementId);
  const toIndex = elements.findIndex(el => el.id === targetElementId);
  
  if (fromIndex === -1 || toIndex === -1) return;
  
  // Reorder
  const newElements = [...elements];
  const [movedElement] = newElements.splice(fromIndex, 1);
  newElements.splice(toIndex, 0, movedElement);
  
  // Update order property
  const reorderedElements = newElements.map((el, index) => ({
    ...el,
    order: index
  }));
  
  // Update sections
  const updatedSections = {
    ...service.sections,
    [sectionKey]: reorderedElements
  };
  
  handleUpdate({ sections: updatedSections });
};

const handleDragEnd = () => {
  setDraggedElement(null);
};
```

---

### 14.3 Add Drag Attributes to Element Cards

Update the element card div with drag attributes:

```typescript
<div 
  key={element.id}
  draggable
  onDragStart={() => handleDragStart(section.key as ServiceSectionKey, element.id)}
  onDragOver={(e) => handleDragOver(e, section.key as ServiceSectionKey, element.id)}
  onDragEnd={handleDragEnd}
  className={`bg-slate-50 border border-slate-200 rounded-lg p-3 hover:border-indigo-300 transition-colors group cursor-move ${
    draggedElement?.elementId === element.id ? 'opacity-50' : ''
  }`}
>
  {/* Add drag handle visual */}
  <div className="flex items-start gap-2">
    <div className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing mt-1">
      <GripVertical size={16} />
    </div>
    
    <div className="flex-1 min-w-0">
      {/* ... existing element content ... */}
    </div>
    
    {/* ... action buttons ... */}
  </div>
</div>
```

---

### 14.4 Add Icon Import

```typescript
import { 
  // ... existing
  GripVertical
} from 'lucide-react';
```

### ✅ Checkpoint
- Can grab and drag elements
- Element becomes semi-transparent while dragging
- Drop on another element → they swap positions
- Order persists after save
- Drag handle appears on hover

---

## STEP 15: Add Touch Support for Mobile Drag-and-Drop

### Goal
Make drag-and-drop work on mobile devices

### File to Modify
`components/ServiceEditor.tsx`

---

### 15.1 Add Touch Handlers

Add these additional handlers:

```typescript
const handleTouchStart = (sectionKey: ServiceSectionKey, elementId: string) => {
  setDraggedElement({ sectionKey, elementId });
};

const handleTouchMove = (e: React.TouchEvent, sectionKey: ServiceSectionKey) => {
  if (!draggedElement || draggedElement.sectionKey !== sectionKey) return;
  
  const touch = e.touches[0];
  const target = document.elementFromPoint(touch.clientX, touch.clientY);
  if (!target) return;
  
  const row = target.closest('[data-element-id]');
  if (!row) return;
  
  const targetElementId = row.getAttribute('data-element-id');
  if (!targetElementId || targetElementId === draggedElement.elementId) return;
  
  // Same reorder logic as drag
  const elements = service.sections[sectionKey];
  const fromIndex = elements.findIndex(el => el.id === draggedElement.elementId);
  const toIndex = elements.findIndex(el => el.id === targetElementId);
  
  if (fromIndex === -1 || toIndex === -1) return;
  
  const newElements = [...elements];
  const [movedElement] = newElements.splice(fromIndex, 1);
  newElements.splice(toIndex, 0, movedElement);
  
  const reorderedElements = newElements.map((el, index) => ({
    ...el,
    order: index
  }));
  
  const updatedSections = {
    ...service.sections,
    [sectionKey]: reorderedElements
  };
  
  handleUpdate({ sections: updatedSections });
};

const handleTouchEnd = () => {
  setDraggedElement(null);
};
```

---

### 15.2 Add Touch Attributes

Add touch handlers and data attribute to element cards:

```typescript
<div 
  key={element.id}
  draggable
  data-element-id={element.id}
  onDragStart={() => handleDragStart(section.key as ServiceSectionKey, element.id)}
  onDragOver={(e) => handleDragOver(e, section.key as ServiceSectionKey, element.id)}
  onDragEnd={handleDragEnd}
  onTouchStart={() => handleTouchStart(section.key as ServiceSectionKey, element.id)}
  onTouchMove={(e) => handleTouchMove(e, section.key as ServiceSectionKey)}
  onTouchEnd={handleTouchEnd}
  className={`bg-slate-50 border border-slate-200 rounded-lg p-3 hover:border-indigo-300 transition-colors group cursor-move ${
    draggedElement?.elementId === element.id ? 'opacity-50' : ''
  }`}
>
  {/* ... element content ... */}
</div>
```

### ✅ Checkpoint
- Drag and drop works on desktop
- Touch and drag works on mobile
- Elements reorder smoothly
- Visual feedback during drag
- Order saves to Firestore

---

## Summary of Part 3

**Completed:**
- ✅ Step 11: Element Editor Modal component created
- ✅ Step 12: Element editor wired into ServiceEditor
- ✅ Step 13: Edit and delete element functionality
- ✅ Step 14: Desktop drag-and-drop reordering
- ✅ Step 15: Mobile touch support for reordering

**Files Created:**
- `components/ElementEditorModal.tsx`

**Files Modified:**
- `components/ServiceEditor.tsx`

**Next:** Part 4 will add song search integration and automatic song duration calculation

---

## Testing Checklist for Part 3

- [ ] Click "+ Add Element" → modal opens
- [ ] Select element type → form adapts
- [ ] Fill form and save → element appears
- [ ] Edit element → changes save
- [ ] Delete element → confirmation then removal
- [ ] Drag element → reorders in list
- [ ] Touch drag on mobile → reorders
- [ ] Section duration updates automatically
- [ ] Total service duration updates
- [ ] Scripture/sermon specific fields work
- [ ] Notes display correctly
