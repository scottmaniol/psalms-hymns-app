import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const VISITOR_ID_KEY = 'phlg_visitor_id';

export const getVisitorId = (): string => {
  let vid = localStorage.getItem(VISITOR_ID_KEY);
  if (!vid) {
    vid = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(VISITOR_ID_KEY, vid);
  }
  return vid;
};

export type AnalyticsEventType = 'page_view' | 'song_view' | 'song_played' | 'playlist_add' | 'search';

export const logEvent = async (
  eventName: AnalyticsEventType, 
  params: Record<string, any> = {}
) => {
  try {
    const visitorId = getVisitorId();
    // We don't wait for this to finish to avoid blocking UI
    addDoc(collection(db, 'analytics_events'), {
      eventName,
      visitorId,
      ...params,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent
    }).catch(err => console.warn("Analytics Error:", err));
  } catch (e) {
    console.warn("Analytics Failed:", e);
  }
};
