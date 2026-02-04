import Fuzzysort from 'fuzzysort';
import { Song, PCSong } from '../types';

/**
 * Normalizes a string for comparison (lowercase, trim, remove special chars)
 */
function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

/**
 * Extracts hymn number from Planning Center song title
 * Looks for patterns like "123", "#123", "Hymn 123", "Psalm 123"
 */
function extractHymnNumber(title: string): string | null {
  // Try patterns: "#123", "Hymn 123", "Psalm 123", or just "123" at start
  const patterns = [
    /^#?(\d+[A-Z]?)\b/i,           // #123, 123A at start
    /hymn\s+#?(\d+[A-Z]?)\b/i,     // Hymn 123, Hymn #123
    /psalm\s+#?(\d+[A-Z]?)\b/i     // Psalm 123
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1].toUpperCase(); // Return the number (with optional letter)
    }
  }
  
  return null;
}

/**
 * Normalizes song title by removing common prefixes
 */
function normalizeSongTitle(title: string): string {
  let normalized = title.toLowerCase().trim();
  
  // Remove common prefixes
  normalized = normalized.replace(/^(hymn|psalm|song|#)\s*\d+[a-z]?[\s:-]*/i, '');
  
  // Remove special characters
  normalized = normalized.replace(/[^a-z0-9\s]/g, '');
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Attempts to match a Planning Center song to a hymnal song
 * Returns the matched song or null if no match found
 */
export function matchSongToHymnal(pcSong: PCSong, hymnalData: Song[]): Song | null {
  const pcTitle = pcSong.attributes.title;
  
  // Strategy 1: Try exact hymn number match
  const numberMatch = extractHymnNumber(pcTitle);
  if (numberMatch) {
    const song = hymnalData.find(s => s.number.toUpperCase() === numberMatch);
    if (song) {
      console.log(`Matched by number: ${numberMatch} -> ${song.title}`);
      return song;
    }
  }
  
  // Strategy 2: Try exact normalized title match
  const normalizedPCTitle = normalizeSongTitle(pcTitle);
  if (normalizedPCTitle) {
    const exactMatch = hymnalData.find(s => 
      normalizeSongTitle(s.title) === normalizedPCTitle
    );
    if (exactMatch) {
      console.log(`Matched by exact title: "${pcTitle}" -> ${exactMatch.title}`);
      return exactMatch;
    }
  }
  
  // Strategy 3: Try matching by tune name
  const pcTune = pcSong.attributes.arrangement?.name;
  if (pcTune) {
    const tuneMatch = hymnalData.find(s => 
      s.tune && normalizeString(s.tune) === normalizeString(pcTune)
    );
    if (tuneMatch) {
      console.log(`Matched by tune: "${pcTune}" -> ${tuneMatch.title}`);
      return tuneMatch;
    }
  }
  
  // Strategy 4: Fuzzy title matching (requires high confidence)
  if (normalizedPCTitle && hymnalData.length > 0) {
    const results = Fuzzysort.go(normalizedPCTitle, hymnalData, {
      key: 'title',
      threshold: -5000, // Only very close matches
      limit: 1
    });
    
    if (results.length > 0 && results[0].score > -1000) {
      const match = results[0].obj;
      console.log(`Fuzzy matched: "${pcTitle}" -> ${match.title} (score: ${results[0].score})`);
      return match;
    }
  }
  
  // No match found
  console.log(`No match found for Planning Center song: "${pcTitle}"`);
  return null;
}
