import { FIREBASE_BUCKET_NAME } from './constants';
import { RICH_DATA_MAP } from './richDataMap';
import { CUSTOM_PDF_FILENAMES } from './pdfFilenames';
import { XML_FILENAMES } from './xmlFilenames';
import { Song, RichDataEntry } from './types';

const getHymnCategory = (number: number): string => {
  if (number <= 150) return "Psalm";
  if (number >= 151 && number <= 199) return "Revelation and Adoration";
  if (number >= 200 && number <= 210) return "Repentance and Faith";
  if (number >= 211 && number <= 221) return "Advent";
  if (number >= 222 && number <= 254) return "Incarnation";
  if (number >= 255 && number <= 259) return "Earthly Ministry";
  if (number >= 260 && number <= 280) return "Suffering and Death";
  if (number >= 281 && number <= 307) return "Resurrection and Exaltation";
  if (number >= 308 && number <= 311) return "The Holy Spirit";
  if (number >= 312 && number <= 345) return "Salvation";
  if (number >= 346 && number <= 349) return "God's Word";
  if (number >= 350 && number <= 372) return "Submission and Profession";
  if (number >= 373 && number <= 376) return "Prayer";
  if (number >= 377 && number <= 384) return "Communion";
  if (number >= 385 && number <= 390) return "The Church";
  if (number >= 391 && number <= 396) return "Commission";
  if (number >= 397 && number <= 429) return "Comfort, Death, and Glory";
  if (number >= 430) return "Benediction";
  return "Hymn";
};

export const parseHymnalData = (
  lyricsMap?: Record<string, string | string[]>, 
  metadataMap?: Record<string, RichDataEntry>
): Song[] => {
  // Force active since we know the bucket is configured
  const isFirebaseActive = true; 

  // Derive songs from available keys in CUSTOM_PDF_FILENAMES, RICH_DATA_MAP, lyricsMap, and metadataMap.
  const allKeys = new Set([
    ...Object.keys(CUSTOM_PDF_FILENAMES),
    ...Object.keys(RICH_DATA_MAP),
    ...(lyricsMap ? Object.keys(lyricsMap) : []),
    ...(metadataMap ? Object.keys(metadataMap) : [])
  ]);

  const sortedKeys = Array.from(allKeys).sort((a, b) => {
    // Sort numerically
    const numA = parseInt(a.replace(/\D/g, ''), 10);
    const numB = parseInt(b.replace(/\D/g, ''), 10);
    
    // Handle cases like 8A vs 8B
    if (numA === numB) {
      return a.localeCompare(b);
    }
    return numA - numB;
  });

  return sortedKeys.map(number => {
    const richData = (RICH_DATA_MAP[number] || {}) as Partial<RichDataEntry>;
    const overrideData = (metadataMap && metadataMap[number]) || {};
    
    // Merge data: Override takes precedence
    const mergedData = { ...richData, ...overrideData };

    const pdfFilename = CUSTOM_PDF_FILENAMES[number];

    let title = mergedData.title;
    let tune = mergedData.tune;

    // Infer metadata from filename if missing in Rich Data
    if (!title && pdfFilename) {
      // Example: "191 Praise to the Lord the Almighty.pdf" -> "Praise to the Lord the Almighty"
      let clean = pdfFilename.replace(/\.pdf$/i, ''); // remove extension
      clean = clean.replace(/^\d+[A-Za-z]*\s+/, ''); // remove leading number
      clean = clean.replace(/\s*\(Ps\s*\d+.*\)$/i, ''); // remove (Ps X)
      clean = clean.replace(/_[A-Za-z0-9 ]+$/, ''); // remove _Code suffixes
      title = clean.trim();
    }
    
    if (!title) title = "Unknown Title";
    if (!tune) tune = "Unknown";

    const numericPart = parseInt(number.replace(/\D/g, ''), 10);
    const category = mergedData.category || getHymnCategory(numericPart);

    let accompanimentLink = "";
    let vocalLink = "";
    let rawPdfLink = "";
    let embeddedPdfUrl = "";
    let xmlLink = "";

    if (isFirebaseActive) {
         const accompanimentFileName = `audio%2F${number}.mp3`;
         accompanimentLink = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_BUCKET_NAME}/o/${accompanimentFileName}?alt=media`;
         
         const vocalFileName = `vocal%2F${number}_vocal.mp3`;
         vocalLink = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_BUCKET_NAME}/o/${vocalFileName}?alt=media`;

         const finalPdfName = pdfFilename ? pdfFilename : `${number}.pdf`;
         const objectPath = `scores%2F${encodeURIComponent(finalPdfName)}`;
         
         rawPdfLink = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_BUCKET_NAME}/o/${objectPath}?alt=media`;
         embeddedPdfUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(rawPdfLink)}&embedded=true`;

         // XML Path Logic
         // Check explicit map first (safest for shifted/renamed files)
         let mappedXml = XML_FILENAMES[number];
         
         if (!mappedXml) {
             // Fallback algorithm: Remove all punctuation and spaces to match user's "TitleNoSpaces.xml" format
             let cleanTitle = title.replace(/[?,!':";.]/g, "");
             // Attempt to normalize "LORD" to "Lord" as this is common in the user's list, but some exceptions exist.
             // The fallback tries to be smart, but the MAP is the source of truth.
             cleanTitle = cleanTitle.replace(/\bLORD\b/g, "Lord"); 
             cleanTitle = cleanTitle.replace(/\bGOD\b/g, "God");
             cleanTitle = cleanTitle.replace(/\s+/g, ""); // Remove all spaces
             mappedXml = cleanTitle + ".xml";
         }

         const xmlPath = `XML%2F${encodeURIComponent(mappedXml)}`;
         xmlLink = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_BUCKET_NAME}/o/${xmlPath}?alt=media`;
    } else {
        rawPdfLink = "#"; 
    }

    // Resolve lyrics - Firestore overrides take precedence over static JSON
    let lyricsText = "";
    if (mergedData.lyrics) {
      // Use Firestore override if it exists
      lyricsText = mergedData.lyrics;
    } else if (lyricsMap && lyricsMap[number]) {
      // Fall back to static JSON
      const rawLyrics = lyricsMap[number];
      lyricsText = Array.isArray(rawLyrics) ? rawLyrics.join('\n') : rawLyrics;
    }

    return {
      id: number,
      number,
      title: title!,
      tune: tune!,
      category,
      author: mergedData.author || "Unknown",
      composer: mergedData.composer || "Unknown",
      meter: mergedData.meter || "Unknown",
      key: mergedData.key,
      lyrics: lyricsText,
      pdfUrl: embeddedPdfUrl,
      rawPdfLink: rawPdfLink,
      accompanimentUrl: accompanimentLink,
      vocalUrl: vocalLink || mergedData.vocalUrl || "",
      xmlUrl: xmlLink,
      hasDetails: !!mergedData.title || !!lyricsText
    };
  });
};
