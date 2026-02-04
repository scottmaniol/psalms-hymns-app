# Service Timing Feature - Testing Guide

## Overview
The service timing feature has been added. Here's how to test it:

## Prerequisites
1. You must be signed in with a **Premium account**
2. You must be part of an **Organization**
3. Access the **Service Planner** from the menu

## Testing Steps

### 1. Create/Edit a Service
- Go to Service Planner
- Create a new service or edit an existing one

### 2. Add a Song Element
- Click "+ Add Element" in any section
- Select "Song" type
- Search for and select a song (e.g., type "1" to find Psalm 1)
- **Watch the Duration field** - it should auto-populate after selecting a song
- The duration appears as "Fetching..." then shows a time like "3:45"
- Click "Add Element"

### 3. Add Other Elements
- Click "+ Add Element"
- Select Prayer, Scripture, Sermon, or Other
- Enter a title
- **Manually enter duration** in the Duration field:
  - Format: "3:45" (3 minutes 45 seconds)
  - Or just: "5" (5 minutes)
- Click "Add Element"

### 4. Check Total Duration
- Look at the **Service Order** header
- You should see "Total Duration: 0:15:30" (or similar)
- It also shows how many elements have durations set

### 5. Check Individual Element Durations
- Each element in the service should show its duration
- Small clock icon with time next to the element
- Also shows in a badge on the right side

## Debugging

If durations aren't showing:

1. **Open Browser Console** (F12 or Cmd+Option+I)
2. Look for console logs when adding an element:
   - "AddElementModal - finalDuration: ..." 
   - "AddElementModal - newElement: ..."
3. Check if there are errors fetching audio files

### Common Issues:

**Duration shows 0:00:**
- The audio file may not be loading (CORS issue or file not found)
- Check console for errors

**Duration field is empty for songs:**
- Wait a few seconds for auto-fetch
- Check console for "Failed to fetch duration" errors

**Total duration shows 0:00:**
- Elements may not have duration saved
- Check console logs to see if duration is in the newElement object

## Expected Behavior

✅ Songs: Auto-fetch duration from MP3 file  
✅ Other elements: Manual entry, optional  
✅ Total duration: Sum of all element durations  
✅ Display: MM:SS format throughout
