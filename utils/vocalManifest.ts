import { FIREBASE_BUCKET_NAME } from '../constants';

/**
 * Which hymns have a vocal recording.
 *
 * Only a fraction of the hymnal has vocal tracks, and the app used to work out
 * which by requesting every song's vocal file and treating a 404 as "no track".
 * That meant hundreds of requests on every load, nearly all of them failures.
 *
 * Firebase Storage will list a prefix in one call, so we ask it directly. This
 * also means newly uploaded recordings appear on their own, with no list to
 * maintain anywhere.
 */

const LIST_ENDPOINT = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_BUCKET_NAME}/o`;

// Storage returns up to 1000 objects per page; this is just a runaway guard.
const MAX_PAGES = 20;

const VOCAL_OBJECT = /^vocal\/(.+)_vocal\.mp3$/i;

/**
 * Returns the set of song numbers that have a vocal recording, or null if the
 * listing could not be fetched — callers should fall back to probing.
 */
export const fetchVocalTrackNumbers = async (): Promise<Set<string> | null> => {
  const numbers = new Set<string>();
  let pageToken: string | undefined;
  let pages = 0;

  try {
    do {
      const params = new URLSearchParams({ prefix: 'vocal/' });
      if (pageToken) params.set('pageToken', pageToken);

      const response = await fetch(`${LIST_ENDPOINT}?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Storage list returned ${response.status}`);
      }

      const data = await response.json();

      (data.items || []).forEach((item: { name?: string }) => {
        const match = item.name?.match(VOCAL_OBJECT);
        if (match) numbers.add(match[1]);
      });

      pageToken = data.nextPageToken;
    } while (pageToken && ++pages < MAX_PAGES);

    return numbers;
  } catch (err) {
    console.warn(
      'Could not list vocal tracks; falling back to per-song checks.',
      err
    );
    return null;
  }
};
