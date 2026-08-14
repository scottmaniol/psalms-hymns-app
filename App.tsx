import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Music, 
  FileText, 
  ChevronLeft, 
  BookOpen, 
  Music4,
  AlignLeft, 
  Info,
  ArrowUpDown,
  ListMusic,
  X,
  Library,
  ExternalLink,
  ListPlus,
  Play,
  Pause,
  Share,
  Check,
  Lock,
  Clock,
  Filter,
  Eye,
  Edit3,
  Calendar
} from 'lucide-react';
import AudioPlayer from './components/AudioPlayer';
import SongEditor from './components/SongEditor';
import FloatingPlayer from './components/FloatingPlayer';
import PlaylistDrawer from './components/PlaylistDrawer';
import Menu from './components/Menu';
import AboutModal from './components/AboutModal';
import ResourcesModal from './components/ResourcesModal';
import ContactModal from './components/ContactModal';
import InstallInstructionsModal from './components/InstallInstructionsModal';
import AuthModal from './components/AuthModal';
import AdminDashboard from './components/AdminDashboard';
import PremiumModal from './components/PremiumModal';
import ServicePlanner from './components/ServicePlanner';
import ServiceViewer from './components/ServiceViewer';
import ErrorBoundary from './components/ErrorBoundary';
import VoicePartMixer, { VoicePartMixerControls } from './components/VoicePartMixer';
import StartingPitchButton from './components/StartingPitchButton';
import audioManager from './utils/audioManager';
import { parseHymnalData } from './utils';
import { Song, ViewMode, SortOrder, TabMode, PlaylistItem, PlayMode, SavedPlaylist, RichDataEntry, Organization } from './types';
import * as Tone from 'tone';
import { APP_VERSION, RELEASE_NOTES, BUY_HYMNAL_URL, DONATE_URL } from './config';
import { HYMN_THEMES } from './hymnThemes';
import { auth, db } from './firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, onSnapshot } from 'firebase/firestore';
import { logEvent } from './analytics';

const PREVIEW_LIMIT = 45; // Seconds

// Feature flag to disable Tone.js features (StartingPitchButton & VoicePartMixer)
// Set to true for local testing/debugging, false for production until issues are resolved
const ENABLE_TONE_FEATURES = true;

const MetaRow = ({ label, value }: { label: string; value: string | undefined }) => (
  <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
    <span className="text-sm text-slate-900 font-medium text-right">{value || "-"}</span>
  </div>
);

// Custom Icon for Vocal/Choir
const VocalIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <img 
    src="/images/choir.png"
    alt="Vocal"
    width={size}
    height={size}
    referrerPolicy="no-referrer"
    className={`object-contain ${className}`}
    style={{ width: size, height: size }}
  />
);

interface AudioSettings {
  speed: number;
  transpose: number; // in semitones
}

interface PlayerState {
  isPlaying: boolean;
  activePlayer: 'audio' | 'mixer';
  currentUrl: string | null;
  trackLabel: string;
  songTitle: string;
  songNumber: string;
  progress: number; // 0-100
  hasError: boolean;
  // Track the unique playlist ID if currently playing from playlist
  playlistItemId: string | null; 
  settings: AudioSettings;
}

type ListMode = 'songs' | 'themes';

export default function App() {
  // --- NAVIGATION STATE ---
  const [view, setView] = useState<ViewMode>('list');
  const [listMode, setListMode] = useState<ListMode>('songs');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterVocal, setFilterVocal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabMode>('lyrics');
  const [sortOrder, setSortOrder] = useState<SortOrder>('number');
  const [pdfViewerType, setPdfViewerType] = useState<'google' | 'native'>('google');
  const [isEditMode, setIsEditMode] = useState(false);
  
  // --- DATA STATE ---
  const [lyricsMap, setLyricsMap] = useState<Record<string, string | string[]>>({});
  const [metadataMap, setMetadataMap] = useState<Record<string, RichDataEntry>>({});
  const [myOrgs, setMyOrgs] = useState<Organization[]>([]);

  // --- AUTH & PREMIUM STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  
  // Split premium sources for proper combination
  const [manualPremium, setManualPremium] = useState(false);
  const [stripePremium, setStripePremium] = useState(false);
  // Any Stripe subscription the user could still be billed for. Broader than
  // stripePremium so past_due/unpaid subscribers can still reach the portal to cancel.
  const [hasBillableSub, setHasBillableSub] = useState(false);

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [isServicePlannerOpen, setIsServicePlannerOpen] = useState(false);

  // --- AUDIO AVAILABILITY STATE ---
  // Cache availability checks: songNumber -> true (exists) / false (404)
  const [vocalAvailability, setVocalAvailability] = useState<Record<string, boolean>>({});
  // Queue references for batch processing
  const checkQueueRef = useRef<string[]>([]);
  const processingRef = useRef(false);

  // --- PLAYLIST STATE ---
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>('continue');
  const [sharedPlaylist, setSharedPlaylist] = useState<SavedPlaylist | null>(null);

  // --- UI STATE ---
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isResourcesOpen, setIsResourcesOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<{ id: string, type: 'play' | 'add' } | null>(null);
  const [showCopiedLink, setShowCopiedLink] = useState(false);
  
  // --- INSTALL/PWA STATE ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  // --- CAST & AIRPLAY STATE ---
  const [castState, setCastState] = useState<'available' | 'connected' | 'unavailable'>('unavailable');
  const [airPlayAvailable, setAirPlayAvailable] = useState(false);
  const remotePlayerRef = useRef<any>(null);
  const remotePlayerControllerRef = useRef<any>(null);

  // --- AUDIO STATE (Global) ---
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    activePlayer: 'audio',
    currentUrl: null,
    trackLabel: "",
    songTitle: "",
    songNumber: "",
    progress: 0,
    hasError: false,
    playlistItemId: null,
    settings: {
      speed: 1.0,
      transpose: 0
    }
  });
  const audioRef = useRef<HTMLAudioElement>(null);
  const mixerRef = useRef<VoicePartMixerControls>(null);

  // Maintain a ref to playerState for access inside event listeners (closures)
  const playerStateRef = useRef(playerState);
  useEffect(() => {
    playerStateRef.current = playerState;
  }, [playerState]);

  // Most robust iOS audio unlock
  useEffect(() => {
    const unlockAudio = async () => {
      // Create a silent audio element
      const silentAudio = document.createElement('audio');
      silentAudio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAQKAAAAAAAAA4QDR8i9AAAAAAAAAAAAAAAAAAAAAP/7kGQAD/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABExBTUUzLjEwMAEsAAAAAAAAAAAVCCQCQCEAAUAAAOFdDUjwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr/+xBkAA/wAABpAAAACAAADSAAAA';
      silentAudio.crossOrigin = 'anonymous';
      silentAudio.style.display = 'none';
      document.body.appendChild(silentAudio);

      try {
        // Play the silent audio to unlock the global HTML5 audio context
        await silentAudio.play();
        console.log('Silent audio played successfully.');
        
        // Now that HTML5 audio has played, Tone.js should be able to start
        await Tone.start();
        console.log('Tone.js started successfully.');

        // Remove the listener and the element after the first successful unlock
        document.removeEventListener('touchend', unlockAudio);
        document.body.removeChild(silentAudio);
      } catch (error) {
        console.error('Silent audio unlock failed:', error);
        // Leave the listener for another try
      }
    };

    document.addEventListener('touchend', unlockAudio, { once: true, passive: true });

    return () => {
      document.removeEventListener('touchend', unlockAudio);
    };
  }, []);


  // --- EFFECTS ---

  // Track Page View
  useEffect(() => {
    logEvent('page_view');
  }, []);

  // Combine Premium Sources
  useEffect(() => {
      setIsPremium(manualPremium || stripePremium);
  }, [manualPremium, stripePremium]);

  // Shared Playlist Deep Link Handler
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Support both 'id' (new) and 'playlistId' (legacy)
    const playlistId = params.get('id') || params.get('playlistId');

    if (playlistId) {
      const fetchPlaylist = async () => {
        try {
          const docRef = doc(db, "playlists", playlistId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
             const data = docSnap.data();
             setSharedPlaylist({ id: docSnap.id, ...data } as SavedPlaylist);
             setIsPlaylistOpen(true);
             
             // Clean URL to remove params but keep current path or reset to root
             const cleanUrl = window.location.pathname;
             window.history.replaceState({}, '', cleanUrl);
          } else {
             console.error("Playlist not found or permission denied");
          }
        } catch (err) {
          console.error("Error fetching shared playlist:", err);
        }
      };
      fetchPlaylist();
    }
  }, []);

  // Service Permalink Handler
  const [sharedService, setSharedService] = useState<any>(null);
  const [showSharedService, setShowSharedService] = useState(false);

  useEffect(() => {
    // Check if URL is /service/:id
    const pathParts = window.location.pathname.split('/');
    if (pathParts[1] === 'service' && pathParts[2]) {
      const serviceId = pathParts[2];
      
      const fetchService = async () => {
        try {
          const docRef = doc(db, "services", serviceId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setSharedService({ id: docSnap.id, ...docSnap.data() });
            setShowSharedService(true);
            
            // Clean URL to root
            window.history.replaceState({}, '', '/');
          } else {
            console.error("Service not found or permission denied");
            alert("Service not found or you don't have permission to view it.");
            window.history.replaceState({}, '', '/');
          }
        } catch (err) {
          console.error("Error fetching shared service:", err);
          alert("Error loading service. Please try again.");
          window.history.replaceState({}, '', '/');
        }
      };
      fetchService();
    }
  }, []);

  // Auth State Listener & User Sync
  useEffect(() => {
    let unsubscribeSubs: (() => void) | undefined;
    let unsubscribeUser: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      // Cleanup previous listeners to avoid leaks if user context changes
      if (unsubscribeSubs) {
          unsubscribeSubs();
          unsubscribeSubs = undefined;
      }
      if (unsubscribeUser) {
          unsubscribeUser();
          unsubscribeUser = undefined;
      }

      setUser(currentUser);
      
      if (currentUser) {
          try {
              const userDocRef = doc(db, "users", currentUser.uid);
              
              // 1. Listen to User Document (for Admin status & Manual Premium updates in real-time)
              unsubscribeUser = onSnapshot(userDocRef, async (docSnap) => {
                  if (docSnap.exists()) {
                      const data = docSnap.data();
                      
                      // Update Admin Status
                      // CRITICAL: Ensure database matches hardcoded admin for security rules to work
                      if (currentUser.email === 'saniol@gmail.com') {
                          setIsAdmin(true);
                          // Force update DB if not set, so security rules (isGlobalAdmin) pass
                          if (data.isAdmin !== true) {
                              updateDoc(userDocRef, { isAdmin: true }).catch(e => console.warn("Auto-admin update failed", e));
                          }
                      } else {
                          setIsAdmin(data.isAdmin === true);
                      }

                      // Update Manual Premium Status
                      setManualPremium(data.isPremium === true);
                  } else {
                      // Create User Doc if missing
                      const newUserData = {
                          uid: currentUser.uid,
                          email: currentUser.email || '',
                          displayName: currentUser.displayName || '',
                          createdAt: serverTimestamp(),
                          lastLoginAt: serverTimestamp(),
                          isPremium: false,
                          isAdmin: currentUser.email === 'saniol@gmail.com'
                      };
                      await setDoc(userDocRef, newUserData);
                      
                      // Set initial state
                      setIsAdmin(newUserData.isAdmin);
                      setManualPremium(false);
                  }
              });

              // 2. Update Login Timestamp (One-off)
              getDoc(userDocRef).then((snap) => {
                  if (snap.exists()) {
                      updateDoc(userDocRef, { lastLoginAt: serverTimestamp() });
                  }
              });

              // 3. LISTEN FOR PREMIUM SUBSCRIPTIONS (Customers Collection)
              // We fetch ALL subscriptions and check status in client to be robust against index issues
              const subsQuery = query(
                  collection(db, "customers", currentUser.uid, "subscriptions")
              );

              unsubscribeSubs = onSnapshot(subsQuery, (snapshot) => {
                  const statuses = snapshot.docs.map(doc => doc.data().status);

                  // Grants premium access
                  setStripePremium(statuses.some(s => s === 'active' || s === 'trialing'));

                  // Still attached to a payment method, so it must stay cancelable
                  setHasBillableSub(statuses.some(s =>
                      s === 'active' || s === 'trialing' || s === 'past_due' || s === 'unpaid'
                  ));
              }, (err) => {
                  console.error("Subscription sync error:", err);
              });

          } catch (e) {
              console.error("Error syncing user state:", e);
              // Fallback for admin if offline/error
              if (currentUser.email === 'saniol@gmail.com') setIsAdmin(true);
          }
      } else {
          // Cleanup on Logout
          setIsAdmin(false);
          setManualPremium(false);
          setStripePremium(false);
          setHasBillableSub(false);
      }
    });

    return () => {
        unsubscribeAuth();
        if (unsubscribeSubs) unsubscribeSubs();
        if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  // PWA / Install Detection
  useEffect(() => {
    // Detect Standalone (App Mode)
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(isStandaloneMode);

    // Detect User Agent
    const userAgent = window.navigator.userAgent.toLowerCase();
    
    // Improved iOS detection
    const isIosDevice = 
      /iphone|ipad|ipod/.test(userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIos(isIosDevice);

    // General Mobile Detection
    const isMobileDevice = isIosDevice || /android|blackberry|windows phone/i.test(userAgent);
    setIsMobile(isMobileDevice);

    // Capture install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Global click handler to close dropdowns
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Effect to stop mixer when navigating away
  useEffect(() => {
    if (view === 'list' && playerState.activePlayer === 'mixer') {
      closePlayer();
    }
  }, [view]);

  // Effect to stop mixer when navigating away
  useEffect(() => {
    if (view === 'list' && playerState.activePlayer === 'mixer') {
      closePlayer();
    }
  }, [view]);

  // --- CAST INITIALIZATION ---
  useEffect(() => {
    const initializeCast = () => {
      try {
        const castContext = window.cast.framework.CastContext.getInstance();
        
        castContext.setOptions({
          receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
        });

        // Listen for state changes
        const handleCastStateChange = (event: any) => {
          switch (event.castState) {
            case window.cast.framework.CastState.NO_DEVICES_AVAILABLE:
              setCastState('unavailable');
              break;
            case window.cast.framework.CastState.NOT_CONNECTED:
              setCastState('available');
              break;
            case window.cast.framework.CastState.CONNECTING:
            case window.cast.framework.CastState.CONNECTED:
              setCastState('connected');
              break;
            default:
              break;
          }
        };

        // Initialize Remote Player and Controller
        const remotePlayer = new window.cast.framework.RemotePlayer();
        const remotePlayerController = new window.cast.framework.RemotePlayerController(remotePlayer);
        
        remotePlayerRef.current = remotePlayer;
        remotePlayerControllerRef.current = remotePlayerController;

        // Bind controller events to sync UI
        remotePlayerController.addEventListener(
          window.cast.framework.RemotePlayerEventType.IS_PLAYING_CHANGED,
          () => {
            if (castState === 'connected' || castContext.getCastState() === 'CONNECTED') {
               setPlayerState(prev => ({ ...prev, isPlaying: remotePlayer.isPlaying }));
            }
          }
        );

        remotePlayerController.addEventListener(
          window.cast.framework.RemotePlayerEventType.CURRENT_TIME_CHANGED,
          () => {
             if (castState === 'connected' || castContext.getCastState() === 'CONNECTED') {
               const current = remotePlayer.currentTime;
               const duration = remotePlayer.duration;
               if (duration > 0) {
                 setPlayerState(prev => ({ ...prev, progress: (current / duration) * 100 }));
               }
             }
          }
        );

        // Listen for player connect/disconnect to handle state handoff
        remotePlayerController.addEventListener(
          window.cast.framework.RemotePlayerEventType.IS_CONNECTED_CHANGED,
          (event: any) => {
              const isConnected = event.value;
              if (isConnected) {
                  setCastState('connected');
                  const currentState = playerStateRef.current;
                  if (currentState.currentUrl && audioRef.current) {
                      audioRef.current.pause();
                      loadMediaOnCast(currentState.currentUrl, currentState.songTitle, currentState.songNumber);
                  }
              } else {
                  setCastState('available');
                  setPlayerState(prev => ({...prev, isPlaying: false}));
              }
          }
        );

        castContext.addEventListener(
          window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
          handleCastStateChange
        );
        
        handleCastStateChange({ castState: castContext.getCastState() });

      } catch (e) {
        console.error("Cast Init Error", e);
      }
    };

    if (window.cast && window.cast.framework) {
      initializeCast();
    } else {
      window['__onGCastApiAvailable'] = (isAvailable: boolean) => {
        if (isAvailable) {
          initializeCast();
        }
      };
    }
  }, []);

  // --- AIRPLAY DETECTION ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleAvailabilityChanged = (event: any) => {
        if (event.availability === 'available') {
            setAirPlayAvailable(true);
        } else {
            setAirPlayAvailable(false);
        }
    };

    if (window.WebKitPlaybackTargetAvailabilityEvent) {
        audio.addEventListener('webkitplaybacktargetavailabilitychanged', handleAvailabilityChanged);
    }

    return () => {
        if (window.WebKitPlaybackTargetAvailabilityEvent && audio) {
            audio.removeEventListener('webkitplaybacktargetavailabilitychanged', handleAvailabilityChanged);
        }
    }
  }, []);

  // Fetch lyrics
  useEffect(() => {
    const files = [
      '/lyrics_1_100.json',
      '/lyrics_101_200.json',
      '/lyrics_201_300.json',
      '/lyrics_301_400.json',
      '/lyrics_401_end.json'
    ];

    Promise.all(files.map(file => 
      fetch(file)
        .then(response => {
          if (!response.ok) return {};
          return response.json();
        })
        .catch(err => {
          console.warn(`Error fetching ${file}:`, err);
          return {};
        })
    )).then(dataArray => {
      const mergedLyrics = dataArray.reduce((acc, curr) => ({ ...acc, ...curr }), {});
      setLyricsMap(mergedLyrics);
    }).catch(err => console.error("Global lyrics fetch error:", err));
  }, []);

  // Fetch Song Metadata Overrides from Firestore
  useEffect(() => {
    const q = query(collection(db, "song_metadata"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const data: Record<string, RichDataEntry> = {};
        snapshot.forEach(doc => {
            data[doc.id] = doc.data() as RichDataEntry;
        });
        setMetadataMap(data);
    }, (err) => {
        console.error("Failed to fetch song_metadata", err);
        // Ignore permission errors for non-admins or if collection doesn't exist yet
    });
    return () => unsubscribe();
  }, []);

  // Auto-switch to 'songs' mode if user searches
  useEffect(() => {
    if (searchQuery) {
      setListMode('songs');
      // If searching by text, we clear the categorical filter to avoid confusion
      setSelectedCategory(null);
    }
  }, [searchQuery]);

  // Search Analytics Debounce
  useEffect(() => {
    if (!searchQuery.trim()) return;

    const handler = setTimeout(() => {
      logEvent('search', { query: searchQuery });
    }, 2000); 

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch Organizations for Current User
  useEffect(() => {
    if (!user) {
      setMyOrgs([]);
      return;
    }

    const q = query(
      collection(db, 'organizations'),
      where('memberIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orgs: Organization[] = [];
      snapshot.forEach(doc => {
        orgs.push({ id: doc.id, ...doc.data() } as Organization);
      });
      setMyOrgs(orgs);
    }, (err) => {
      console.error('Error fetching organizations:', err);
    });

    return () => unsubscribe();
  }, [user]);

  // Check for new version and show What's New modal - DISABLED
  // useEffect(() => {
  //   const LAST_VERSION_KEY = 'lastSeenVersion';
  //   const lastVersion = localStorage.getItem(LAST_VERSION_KEY);
  //   
  //   if (lastVersion !== APP_VERSION) {
  //     // Show modal after a brief delay for better UX
  //     const timer = setTimeout(() => {
  //       setShowWhatsNew(true);
  //       localStorage.setItem(LAST_VERSION_KEY, APP_VERSION);
  //     }, 1000);
  //     
  //     return () => clearTimeout(timer);
  //   }
  // }, []);

  const hymnalData = useMemo(() => parseHymnalData(lyricsMap, metadataMap), [lyricsMap, metadataMap]);

  useEffect(() => {
    if (selectedSong) {
      const updatedSong = hymnalData.find(s => s.number === selectedSong.number);
      if (updatedSong) {
        // Always update to ensure we have the latest data from Firestore
        setSelectedSong(updatedSong);
      }
    }
  }, [hymnalData]);

  // Deep Linking
  const initialDeepLinkProcessed = useRef(false);
  useEffect(() => {
    if (initialDeepLinkProcessed.current || hymnalData.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const number = params.get('number');

    if (number) {
        const song = hymnalData.find(s => s.number === number);
        if (song) {
            setSelectedSong(song);
            setView('detail');
            setActiveTab('lyrics');
        }
    }
    initialDeepLinkProcessed.current = true;
  }, [hymnalData]);

  const themeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    hymnalData.forEach(song => {
      if (song.category) {
        counts[song.category] = (counts[song.category] || 0) + 1;
      }
    });
    return counts;
  }, [hymnalData]);

  const filteredSongs = useMemo(() => {
    // 1. Strict Category Filter
    if (selectedCategory) {
        let matches = hymnalData.filter(song => song.category === selectedCategory);
        
        if (filterVocal) {
            matches = matches.filter(song => {
                if (!song.vocalUrl) return false;
                return vocalAvailability[song.number] !== false;
            });
        }

        return matches.sort((a, b) => {
            if (sortOrder === 'number') {
              return a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' });
            }
            if (sortOrder === 'alpha_asc') {
              return a.title.localeCompare(b.title);
            }
            if (sortOrder === 'alpha_desc') {
              return b.title.localeCompare(a.title);
            }
            return 0;
        });
    }

    // 2. Text Search
    const q = searchQuery.toLowerCase();
    
    let filtered = hymnalData.filter(song => 
      song.number.toLowerCase().includes(q) || 
      song.title.toLowerCase().includes(q) ||
      (song.tune && song.tune.toLowerCase().includes(q)) ||
      (song.lyrics && song.lyrics.toLowerCase().includes(q)) ||
      (song.category && song.category.toLowerCase().includes(q))
    );

    if (filterVocal) {
      filtered = filtered.filter(song => {
        if (!song.vocalUrl) return false;
        return vocalAvailability[song.number] !== false;
      });
    }

    return filtered.sort((a, b) => {
      if (sortOrder === 'number') {
        return a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortOrder === 'alpha_asc') {
        return a.title.localeCompare(b.title);
      }
      if (sortOrder === 'alpha_desc') {
        return b.title.localeCompare(a.title);
      }
      return 0;
    });
  }, [hymnalData, searchQuery, sortOrder, filterVocal, vocalAvailability, selectedCategory]);

  // Vocal Check Queue
  const processQueue = async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    while (checkQueueRef.current.length > 0) {
      const batchIds = checkQueueRef.current.splice(0, 5);
      const results: Record<string, boolean> = {};
      
      await Promise.all(batchIds.map(songNumber => {
        return new Promise<void>((resolve) => {
            const song = hymnalData.find(s => s.number === songNumber);
            if (!song || !song.vocalUrl) {
                resolve();
                return;
            }
            const audio = new Audio();
            audio.preload = 'metadata';
            audio.onloadedmetadata = () => {
                results[songNumber] = true;
                audio.removeAttribute('src');
                resolve();
            };
            audio.onerror = () => {
                results[songNumber] = false;
                resolve();
            };
            audio.src = song.vocalUrl;
        });
      }));

      setVocalAvailability(prev => ({ ...prev, ...results }));
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    processingRef.current = false;
  };

  useEffect(() => {
    const unknowns = filteredSongs
      .filter(s => s.vocalUrl && vocalAvailability[s.number] === undefined)
      .map(s => s.number);

    if (unknowns.length > 0) {
      const newItems = unknowns.filter(id => !checkQueueRef.current.includes(id));
      if (newItems.length > 0) {
        checkQueueRef.current.push(...newItems);
        processQueue();
      }
    }
  }, [filteredSongs, vocalAvailability, hymnalData]);


  // Audio Control Effect - Only handles pause/resume, NOT initial playback
  // Initial playback is handled synchronously in playTrack() and playPlaylistItem()
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (castState === 'connected') {
        audio.pause();
        return;
    }

    // Only handle pause/resume for already-loaded tracks
    const isAudioPlayerActive = playerState.activePlayer === 'audio';
    const hasMediaUrl = playerState.currentUrl && playerState.currentUrl.startsWith('http');

    if (!hasMediaUrl || !isAudioPlayerActive) {
      audio.pause();
      return;
    }

    // Only control playback if audio is already loaded (has a src)
    if (audio.src) {
      if (playerState.isPlaying) {
        // Resume playback - only if not already playing
        if (audio.paused) {
          audio.play().catch(error => {
            if (!playerState.hasError && error.name !== 'AbortError') {
              console.error("Resume failed:", error);
              setPlayerState(prev => ({ ...prev, isPlaying: false, hasError: true }));
            }
          });
        }
      } else {
        // Pause playback
        if (!audio.paused) {
          audio.pause();
        }
      }
    }
  }, [playerState.isPlaying, playerState.activePlayer, castState]);

  // Audio Settings Effect (Pitch & Speed)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const { speed, transpose } = playerState.settings;
    const pitchFactor = Math.pow(2, transpose / 12);
    const netRate = speed * pitchFactor;

    audio.playbackRate = netRate;
    const shouldPreservePitch = (transpose === 0);
    
    if ('preservesPitch' in audio) {
      // @ts-ignore
      audio.preservesPitch = shouldPreservePitch;
    } else if ('mozPreservesPitch' in audio) {
      // @ts-ignore
      audio.mozPreservesPitch = shouldPreservePitch;
    } else if ('webkitPreservesPitch' in audio) {
      // @ts-ignore
      audio.webkitPreservesPitch = shouldPreservePitch;
    }

  }, [playerState.settings]);

  // --- HANDLERS ---

  const handleInstallApp = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        setDeferredPrompt(null);
      });
    } else {
      setShowInstallModal(true);
    }
  };

  const handleSongSelect = (song: Song) => {
    // Unlock Tone.js WebAudio immediately on this click/tap (iOS requires click, not touchstart)
    if (ENABLE_TONE_FEATURES) {
      Tone.start().catch(() => console.log('Tone.start failed'));
    }
    
    logEvent('song_view', { songNumber: song.number, title: song.title });
    setSelectedSong(song);
    setView('detail');
    setActiveTab('lyrics');
    setIsEditMode(false);
  };

  const handleBack = () => {
    setView('list');
    setSelectedSong(null);
    setIsEditMode(false);
    if (window.location.search) {
        window.history.pushState({}, '', window.location.pathname);
    }
  };

  const handleShare = async () => {
    if (!selectedSong) return;
    
    const url = new URL(window.location.origin);
    url.searchParams.set('number', selectedSong.number);
    const shareUrl = url.toString();

    const shareData = {
        title: `Hymn ${selectedSong.number}: ${selectedSong.title}`,
        text: `Check out "${selectedSong.title}" from Psalms & Hymns to the Living God.`,
        url: shareUrl
    };

    if (navigator.share && isMobile) {
        try {
            await navigator.share(shareData);
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error("Share failed:", err);
            }
        }
    } else {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setShowCopiedLink(true);
            setTimeout(() => setShowCopiedLink(false), 2000);
        } catch (err) {
            console.error("Clipboard failed:", err);
        }
    }
  };

  const handleFloatingPlayerClick = () => {
    const song = hymnalData.find(s => s.number === playerState.songNumber);
    if (song) {
      setSelectedSong(song);
      setView('detail');
      // If mixer is playing, switch to audio tab for context
      if (playerState.activePlayer === 'mixer') {
        setActiveTab('audio');
      } else {
        setActiveTab('lyrics');
      }
    }
  };

  const handleThemeSelect = (theme: string) => {
    logEvent('search', { category: theme });
    setSelectedCategory(theme);
    setListMode('songs');
    setSearchQuery(''); // Clear text search to avoid conflict
  };

  const updateSpeed = (newSpeed: number) => {
    setPlayerState(prev => ({
      ...prev,
      settings: { ...prev.settings, speed: newSpeed }
    }));
  };

  const updateTranspose = (newTranspose: number) => {
    setPlayerState(prev => ({
      ...prev,
      settings: { ...prev.settings, transpose: newTranspose }
    }));
  };

  // --- CAST HANDLERS ---
  const loadMediaOnCast = (url: string, title: string, songNumber: string) => {
      if (!window.cast || !window.chrome.cast) return;
      
      const castSession = window.cast.framework.CastContext.getInstance().getCurrentSession();
      if (!castSession) return;

      const mediaInfo = new window.chrome.cast.media.MediaInfo(url, 'audio/mp3');
      const metadata = new window.chrome.cast.media.MusicTrackMediaMetadata();
      
      metadata.title = title;
      metadata.artist = `Hymn ${songNumber}`;
      metadata.images = [new window.chrome.cast.Image('/images/PHLG_logo.png')];
      
      mediaInfo.metadata = metadata;

      const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
      request.autoplay = true;

      castSession.loadMedia(request).then(
        () => { console.log('Cast Load Success'); },
        (errorCode: any) => { console.log('Cast Load Error', errorCode); }
      );
  };

  const handleCastClick = () => {
      if (airPlayAvailable && audioRef.current && audioRef.current.webkitShowPlaybackTargetPicker) {
          audioRef.current.webkitShowPlaybackTargetPicker();
      } else if (castState !== 'unavailable' && window.cast) {
          window.cast.framework.CastContext.getInstance().requestSession();
      }
  };

  // --- PLAYLIST HANDLERS ---

  const addToPlaylist = (song: Song, url: string, label: string) => {
    logEvent('playlist_add', { songNumber: song.number, title: song.title, label });
    const newItem: PlaylistItem = {
      uniqueId: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      song,
      url,
      label
    };
    setPlaylist(prev => [...prev, newItem]);
  };

  const removeFromPlaylist = (uniqueId: string) => {
    setPlaylist(prev => prev.filter(item => item.uniqueId !== uniqueId));
  };

  const playPlaylistItem = (item: PlaylistItem) => {
    const isNewTrack = playerState.currentUrl !== item.url;
    
    if (isNewTrack) {
        logEvent('song_played', { songNumber: item.song.number, title: item.song.title, type: item.label });
        setPlayerState(prev => ({
          ...prev,
          isPlaying: true,
          currentUrl: item.url,
          trackLabel: item.label,
          songTitle: item.song.title,
          songNumber: item.song.number,
          progress: 0,
          hasError: false,
          playlistItemId: item.uniqueId
        }));

        if (castState === 'connected') {
            loadMediaOnCast(item.url, item.song.title, item.song.number);
        } else if (audioRef.current) {
            audioRef.current.src = item.url;
            audioRef.current.currentTime = 0;
            // CRITICAL: Call play() synchronously within user interaction for iOS
            audioRef.current.play().catch(error => {
              if (error.name !== 'AbortError') {
                console.error("Playback failed:", error);
                setPlayerState(prev => ({ ...prev, isPlaying: false, hasError: true }));
              }
            });
        }
    } else {
        if (castState === 'connected') {
            if (remotePlayerControllerRef.current) {
                remotePlayerControllerRef.current.playOrPause();
            }
        } else {
            setPlayerState(prev => ({ ...prev, isPlaying: true, hasError: false, playlistItemId: item.uniqueId }));
        }
    }
  };

  const playAllPlaylist = () => {
    if (playlist.length > 0) {
      playPlaylistItem(playlist[0]);
    }
  };

  // --- AUDIO LOGIC ---

  const playTrack = (url: string, label: string, song: Song) => {
    // If the mixer is playing, stop it before starting a new track.
    if (playerState.activePlayer === 'mixer' && mixerRef.current) {
        mixerRef.current.stopAudio();
    }

    const isNewTrack = playerState.currentUrl !== url;

    if (isNewTrack) {
        logEvent('song_played', { songNumber: song.number, title: song.title, type: label });
        setPlayerState(prev => ({
          ...prev,
          activePlayer: 'audio',
          isPlaying: true,
          currentUrl: url,
          trackLabel: label,
          songTitle: song.title,
          songNumber: song.number,
          progress: 0,
          hasError: false,
          playlistItemId: null,
        }));

        if (castState === 'connected') {
            loadMediaOnCast(url, song.title, song.number);
        } else if (audioRef.current) {
            audioRef.current.src = url;
            audioRef.current.currentTime = 0;
            // CRITICAL: Call play() synchronously within user interaction for iOS
            audioRef.current.play().catch(error => {
              if (error.name !== 'AbortError') {
                console.error("Playback failed:", error);
                setPlayerState(prev => ({ ...prev, isPlaying: false, hasError: true }));
              }
            });
        }
    } else {
        if (castState === 'connected') {
             if (remotePlayerControllerRef.current) {
                remotePlayerControllerRef.current.playOrPause();
            }
        } else {
            setPlayerState(prev => ({ ...prev, isPlaying: true, hasError: false }));
        }
    }
  };

  const togglePlay = () => {
    if (playerState.activePlayer === 'mixer' && mixerRef.current) {
      mixerRef.current.togglePlay();
    } else if (castState === 'connected') {
        if (remotePlayerControllerRef.current) {
            remotePlayerControllerRef.current.playOrPause();
        }
    } else {
        setPlayerState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
    }
  };

  const restartTrack = () => {
    if (castState === 'connected') {
        if (remotePlayerRef.current) {
            remotePlayerRef.current.currentTime = 0;
            remotePlayerControllerRef.current.seek();
        }
    } else if (audioRef.current && audioRef.current.readyState >= 1) {
      audioRef.current.currentTime = 0;
      if (!playerState.isPlaying) {
         setPlayerState(prev => ({ ...prev, isPlaying: true }));
      }
    } else if (playerState.activePlayer === 'mixer' && mixerRef.current) {
        mixerRef.current.stopAudio();
        // After stopping, immediately trigger play
        setTimeout(() => mixerRef.current?.togglePlay(), 50);
    }
  };

  const closePlayer = () => {
    if (castState === 'connected') {
        if (remotePlayerControllerRef.current) {
            remotePlayerControllerRef.current.stop();
        }
    } else if (audioRef.current && playerState.activePlayer === 'audio') {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
    }
    
    // Also ensure the mixer is stopped if it was the active player
    if (playerStateRef.current.activePlayer === 'mixer' && mixerRef.current) {
        mixerRef.current.stopAudio();
    }

    setPlayerState(prev => ({ 
        ...prev, 
        isPlaying: false, 
        currentUrl: null, 
        progress: 0, 
        playlistItemId: null,
        hasError: false,
        activePlayer: 'audio' // Reset to default
    }));
  };

  const handleTimeUpdate = () => {
    if (castState === 'connected') return;

    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const duration = audioRef.current.duration;
      
      // PREVIEW LIMIT LOGIC
      // Ensure we match against "Vocal" or "Vocal Performance" to be safe
      if (!isPremium && playerState.trackLabel.includes('Vocal') && current >= PREVIEW_LIMIT) {
          audioRef.current.pause();
          setPlayerState(prev => ({ ...prev, isPlaying: false }));
          audioRef.current.currentTime = 0; // Reset to start or allow replay from start
          setIsPremiumModalOpen(true);
          return;
      }

      if (duration > 0 && isFinite(duration)) {
        setPlayerState(prev => ({ ...prev, progress: (current / duration) * 100 }));
      }
    }
  };

  const handleEnded = () => {
    if (playerState.playlistItemId && playlist.length > 0) {
      const currentIndex = playlist.findIndex(p => p.uniqueId === playerState.playlistItemId);
      
      if (currentIndex !== -1 && currentIndex < playlist.length - 1) {
        if (playMode === 'continue') {
          playPlaylistItem(playlist[currentIndex + 1]);
          return;
        } else {
          setPlayerState(prev => ({ ...prev, isPlaying: false, progress: 100 }));
          return;
        }
      }
    }
    setPlayerState(prev => ({ ...prev, isPlaying: false, progress: 100 }));
  };

  const handleAudioError = (e: any) => {
    if (!playerState.isPlaying || !playerState.currentUrl) return;
    if (!playerState.hasError) {
        console.error("Audio playback error:", e);
        setPlayerState(prev => ({ ...prev, isPlaying: false, hasError: true }));
    }
  };

  // --- LIST ITEM HANDLERS ---

  const handlePlayRequest = (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    
    const isPlayingThisSong = playerState.isPlaying && 
                              (playerState.currentUrl === song.accompanimentUrl || playerState.currentUrl === song.vocalUrl);

    if (isPlayingThisSong) {
        togglePlay();
        return;
    }

    const hasVocal = song.vocalUrl && vocalAvailability[song.number] === true;
    if (hasVocal) {
        setActiveDropdown(prev => (prev?.id === song.id && prev?.type === 'play') ? null : { id: song.id, type: 'play' });
    } else {
        playTrack(song.accompanimentUrl, "Piano", song);
    }
  };

  const handleAddRequest = (e: React.MouseEvent, song: Song) => {
      e.stopPropagation();
      const hasVocal = song.vocalUrl && vocalAvailability[song.number] === true;
      
      if (hasVocal) {
          setActiveDropdown(prev => (prev?.id === song.id && prev?.type === 'add') ? null : { id: song.id, type: 'add' });
      } else {
          addToPlaylist(song, song.accompanimentUrl, "Piano");
      }
  };

  // --- RENDERERS ---

  const renderList = () => (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-3">
              <img 
                src="https://firebasestorage.googleapis.com/v0/b/psalms-and-hymns-85ee4.firebasestorage.app/o/data%2FPHLG_logo_favicon.png?alt=media"
                alt="Logo"
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-md shadow-sm object-cover shrink-0" 
              />
              <span>Psalms & Hymns<span className="hidden sm:inline"> to the Living God</span></span>
            </h1>
            
            <div className="flex items-center gap-1 shrink-0">
                <button 
                  onClick={() => setIsServicePlannerOpen(true)}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                  title="Service Planner"
                >
                  <Calendar size={20} />
                </button>

                <button 
                  onClick={() => setIsPlaylistOpen(true)}
                  className="relative p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                  title="Playlist"
                >
                  <ListMusic size={20} />
                  {playlist.length > 0 && (
                    <span className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                      {playlist.length}
                    </span>
                  )}
                </button>

                <Menu 
                  onOpenAbout={() => setIsAboutOpen(true)}
                  onOpenResources={() => setIsResourcesOpen(true)}
                  onOpenContact={() => setIsContactOpen(true)}
                  onOpenAdmin={() => setIsAdminDashboardOpen(true)}
                  onOpenServicePlanner={() => setIsServicePlannerOpen(true)}
                  buyUrl={BUY_HYMNAL_URL}
                  donateUrl={DONATE_URL}
                  showInstallOption={!isStandalone}
                  onInstallClick={handleInstallApp}
                  user={user}
                  isAdmin={isAdmin}
                  onAuthClick={() => setIsAuthOpen(true)}
                  onLogoutClick={() => signOut(auth)}
                  isPremium={isPremium}
                  onOpenPremium={() => setIsPremiumModalOpen(true)}
                  hasStripeSubscription={hasBillableSub}
                />
            </div>
          </div>
          
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search number, title, tune, theme, or lyrics..."
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-100 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-base"
                  value={searchQuery}
                  onChange={(e) => {
                      setSearchQuery(e.target.value);
                      // Clear strict category if user types to search globally
                      if (e.target.value) setSelectedCategory(null);
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
            </div>

            {listMode === 'songs' && (
              <>
                <button 
                  onClick={() => setFilterVocal(!filterVocal)}
                  className={`h-[42px] w-[42px] flex items-center justify-center rounded-lg border transition-colors shrink-0 ${
                    filterVocal 
                      ? 'bg-[#58a3d3] border-[#58a3d3] text-white shadow-sm' 
                      : 'bg-slate-100 border-transparent text-slate-500 hover:bg-slate-200'
                  }`}
                  title={filterVocal ? "Show all songs" : "Show only songs with vocal tracks"}
                >
                  <VocalIcon size={20} />
                </button>

                <div className="relative shrink-0">
                    <select 
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                        className="appearance-none h-full bg-slate-100 text-slate-700 text-base font-medium pl-3 pr-8 py-2.5 rounded-lg border-none focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                        <option value="number">Number</option>
                        <option value="alpha_asc">Title (A-Z)</option>
                        <option value="alpha_desc">Title (Z-A)</option>
                    </select>
                    <ArrowUpDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </>
            )}
          </div>

          <div className="flex mt-3 p-1 bg-slate-100 rounded-lg">
            <button 
              onClick={() => {
                setListMode('songs');
                setSearchQuery('');
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                listMode === 'songs' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Music size={14} />
              All Songs ({filteredSongs.length})
            </button>
            <button 
              onClick={() => {
                setListMode('themes');
                if (searchQuery) setSearchQuery('');
                setSelectedCategory(null);
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                listMode === 'themes' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Library size={14} />
              Browse Themes
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4">
          {listMode === 'themes' ? (
            <div className="space-y-3">
              {HYMN_THEMES.map((theme) => {
                 const count = themeCounts[theme] || 0;
                 if (count === 0) return null;

                 return (
                   <div 
                    key={theme}
                    onClick={() => handleThemeSelect(theme)}
                    className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 active:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between"
                   >
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                         <img src="https://firebasestorage.googleapis.com/v0/b/psalms-and-hymns-85ee4.firebasestorage.app/o/data%2FPHLG_logo_favicon.png?alt=media" alt="Logo" className="w-5 h-5" />
                       </div>
                       <div>
                         <h3 className="font-semibold text-slate-900">{theme}</h3>
                         <p className="text-xs text-slate-500">{count} songs</p>
                       </div>
                     </div>
                     <div className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400">
                       <ChevronLeft className="rotate-180" size={16} />
                     </div>
                   </div>
                 );
              })}
            </div>
          ) : (
            <>
              {/* Active Filter Banner */}
              {selectedCategory && (
                <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 px-4 py-3 rounded-xl mb-4 shadow-sm animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 text-indigo-900">
                        <Filter size={16} className="text-indigo-500" />
                        <span className="text-sm font-medium">Theme: <strong>{selectedCategory}</strong></span>
                    </div>
                    <button 
                        onClick={() => setSelectedCategory(null)} 
                        className="p-1 hover:bg-indigo-100 rounded-full text-indigo-400 hover:text-indigo-600 transition-colors"
                        title="Clear Filter"
                    >
                        <X size={16} />
                    </button>
                </div>
              )}

              <div className="space-y-2">
                {filteredSongs.length > 0 ? (
                  filteredSongs.map((song) => {
                    const isPlayingThisSong = playerState.isPlaying && 
                                            (playerState.currentUrl === song.accompanimentUrl || playerState.currentUrl === song.vocalUrl);
                    const isPlayingVocal = isPlayingThisSong && playerState.trackLabel.includes('Vocal');
                    const showPlayDropdown = activeDropdown?.id === song.id && activeDropdown?.type === 'play';
                    const showAddDropdown = activeDropdown?.id === song.id && activeDropdown?.type === 'add';

                    return (
                      <div 
                        key={song.id}
                        onClick={() => handleSongSelect(song)}
                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 active:bg-slate-50 transition-colors cursor-pointer flex items-center gap-4"
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                          song.category === 'Psalm' ? 'bg-blue-50 text-indigo-600' : 'bg-indigo-50 text-indigo-600'
                        }`}>
                          {song.number}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 truncate">{song.title}</h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                // Strictly set category filter instead of loose search
                                handleThemeSelect(song.category);
                              }}
                              className="text-[10px] font-bold uppercase tracking-wider text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded hover:bg-slate-100 hover:text-slate-700 cursor-pointer transition-colors"
                            >
                              {song.category}
                            </span>
                            {song.tune && song.tune !== "Unknown" && (
                                <span 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSearchQuery(song.tune || "");
                                    setSelectedCategory(null); // Tune search is text-based
                                  }}
                                  className="text-xs text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded hover:bg-slate-200 hover:text-slate-700 cursor-pointer transition-colors"
                                >
                                    {song.tune}
                                </span>
                            )}
                            {song.vocalUrl && vocalAvailability[song.number] === true && (
                              <span className="flex items-center justify-center text-indigo-600 bg-indigo-50 p-1 rounded-md border border-indigo-100" title="Vocal Performance Available">
                                <VocalIcon size={12} />
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 relative">
                          <div className="relative">
                            <button
                              onClick={(e) => handlePlayRequest(e, song)}
                              className={`p-2 rounded-full transition-colors ${
                                isPlayingThisSong
                                  ? (isPlayingVocal ? 'text-[#58a3d3] bg-[#58a3d3]/10' : 'text-indigo-600 bg-indigo-50')
                                  : 'text-indigo-600 hover:bg-indigo-50'
                              }`}
                              title={isPlayingThisSong ? "Pause" : "Play"}
                            >
                              {isPlayingThisSong ? <Pause size={20} /> : <Play size={20} />}
                            </button>

                            {showPlayDropdown && (
                              <div className="absolute top-full right-0 mt-1 w-40 bg-white rounded-lg shadow-xl border border-slate-100 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                  <button 
                                      className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-3 border-b border-slate-50"
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          playTrack(song.accompanimentUrl, "Piano", song);
                                          setActiveDropdown(null);
                                      }}
                                  >
                                      <Music size={16} className="text-[#5ba2d5] shrink-0" /> Piano
                                  </button>
                                  <button 
                                      className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-3"
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          playTrack(song.vocalUrl, "Vocal", song);
                                          setActiveDropdown(null);
                                      }}
                                  >
                                      <VocalIcon size={16} className="shrink-0" /> 
                                      <span className="flex-1">Vocal</span>
                                      {!isPremium && <span title="45s Preview"><Clock size={12} className="text-slate-400" /></span>}
                                  </button>
                              </div>
                            )}
                          </div>

                          <div className="relative">
                            <button
                              onClick={(e) => handleAddRequest(e, song)}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                              title="Add to Playlist"
                            >
                              <ListPlus size={20} />
                            </button>

                            {showAddDropdown && (
                              <div className="absolute top-full right-0 mt-1 w-40 bg-white rounded-lg shadow-xl border border-slate-100 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                  <button 
                                      className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-3 border-b border-slate-50"
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          addToPlaylist(song, song.accompanimentUrl, "Piano");
                                          setActiveDropdown(null);
                                      }}
                                  >
                                      <Music size={16} className="text-[#5ba2d5] shrink-0" /> Piano
                                  </button>
                                  <button 
                                      className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-3"
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          if (!isPremium) {
                                              setActiveDropdown(null);
                                              setIsPremiumModalOpen(true);
                                              return;
                                          }
                                          addToPlaylist(song, song.vocalUrl, "Vocal");
                                          setActiveDropdown(null);
                                      }}
                                  >
                                      <VocalIcon size={16} className="shrink-0" /> 
                                      <span className="flex-1">Vocal</span>
                                      {!isPremium && <span title="Premium Only"><Lock size={12} className="text-slate-400" /></span>}
                                  </button>
                              </div>
                            )}
                          </div>

                          <ChevronLeft className="rotate-180 text-slate-300" size={20} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    {filterVocal ? (
                      <div className="flex flex-col items-center gap-2">
                        <VocalIcon size={48} className="text-slate-200" />
                        <p>Checking for vocal tracks...</p>
                        <p className="text-xs text-slate-400">Showing only songs with confirmed vocal performances.</p>
                      </div>
                    ) : (
                      <p>No songs found matching "{searchQuery}"</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
    </div>
  );

  const renderDetail = () => {
      if (!selectedSong) return null;
      const isVocalAvailable = vocalAvailability[selectedSong.number] !== false;
      const vocalUrlToPass = isVocalAvailable ? selectedSong.vocalUrl : "";

      return (
        <div className="min-h-screen bg-slate-50 flex flex-col h-full pb-24">
            {/* Detail Header */}
            <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-20 flex items-center gap-3 shadow-sm">
                <button 
                onClick={handleBack}
                className="p-2 -ml-2 hover:bg-slate-100 rounded-full text-slate-600"
                >
                <ChevronLeft size={24} />
                </button>
                <div className="flex-1 min-w-0">
                <h2 className="font-bold text-slate-900 truncate leading-tight">
                    {selectedSong.number}. {selectedSong.title}
                </h2>
                <p className="text-xs text-slate-500">{selectedSong.category}</p>
                </div>
                
                <div className="flex items-center gap-1">
                    {isAdmin && (
                      <button 
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={`p-2 rounded-full transition-colors ${
                          isEditMode 
                            ? 'bg-indigo-600 text-white' 
                            : 'text-indigo-600 hover:bg-indigo-50'
                        }`}
                        title={isEditMode ? "Exit Edit Mode" : "Edit Song"}
                      >
                        <Edit3 size={20} />
                      </button>
                    )}

                    <button 
                      onClick={handleShare}
                      className="relative p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                      title="Share Song"
                    >
                      {showCopiedLink ? <Check size={20} /> : <Share size={20} />}
                      {showCopiedLink && (
                          <span className="absolute top-full right-0 mt-1 text-[10px] bg-slate-800 text-white px-2 py-1 rounded shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-top-1 pointer-events-none">
                              Link Copied!
                          </span>
                      )}
                    </button>

                    <button 
                      onClick={() => setIsPlaylistOpen(true)}
                      className="relative p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                    >
                      <ListMusic size={20} />
                      {playlist.length > 0 && (
                        <span className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                          {playlist.length}
                        </span>
                      )}
                    </button>

                    <Menu 
                      onOpenAbout={() => setIsAboutOpen(true)}
                      onOpenResources={() => setIsResourcesOpen(true)}
                      onOpenContact={() => setIsContactOpen(true)}
                      onOpenAdmin={() => setIsAdminDashboardOpen(true)}
                      buyUrl={BUY_HYMNAL_URL}
                      donateUrl={DONATE_URL}
                      showInstallOption={!isStandalone}
                      onInstallClick={handleInstallApp}
                      user={user}
                      isAdmin={isAdmin}
                      onAuthClick={() => setIsAuthOpen(true)}
                      onLogoutClick={() => signOut(auth)}
                      isPremium={isPremium}
                      onOpenPremium={() => setIsPremiumModalOpen(true)}
                    />
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 bg-white sticky top-[60px] z-10 shadow-sm">
                <button 
                onClick={() => setActiveTab('lyrics')}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                    activeTab === 'lyrics' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
                >
                <AlignLeft size={18} />
                Lyrics
                </button>
                <button 
                onClick={() => setActiveTab('score')}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                    activeTab === 'score' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
                >
                <FileText size={18} />
                Score
                </button>
                <button 
                onClick={() => setActiveTab('audio')}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                    activeTab === 'audio' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
                >
                <Music size={18} />
                Listen
                </button>
            </div>

            <div className="flex-1 relative overflow-hidden bg-slate-50">
                
                {/* LYRICS TAB */}
                <div className={`absolute inset-0 w-full h-full overflow-y-auto ${activeTab === 'lyrics' ? 'block' : 'hidden'}`}>
                <div className="p-4 max-w-md mx-auto w-full">
                    {isEditMode ? (
                      <SongEditor 
                        song={selectedSong}
                        onClose={() => setIsEditMode(false)}
                        onSaved={() => {
                          // Editor will auto-close, data syncs via Firestore listener
                        }}
                      />
                    ) : (
                      <>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 mb-6">
                        <div className="flex items-center gap-2 mb-3 text-indigo-700">
                            <Info size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider">Information</span>
                        </div>
                        <MetaRow label="Author" value={selectedSong.author} />
                        <MetaRow label="Tune" value={selectedSong.tune || "Unknown"} />
                        <MetaRow label="Composer" value={selectedSong.composer} />
                        <MetaRow label="Meter" value={selectedSong.meter} />
                        </div>

                        {/* Starting Pitch Button - Temporarily Disabled */}
                        {ENABLE_TONE_FEATURES && <StartingPitchButton songNumber={selectedSong.number} />}

                        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                        <h3 className="text-center font-bold text-xl text-slate-800 mb-6 font-serif">
                            {selectedSong.title}
                        </h3>
                        {selectedSong.lyrics ? (
                            <div className="font-serif text-lg text-slate-800 leading-relaxed whitespace-pre-wrap">
                            {selectedSong.lyrics}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-400 italic">
                            <AlignLeft size={48} className="mx-auto mb-4 opacity-20" />
                            <p>Lyrics have not been uploaded for this song yet.</p>
                            </div>
                        )}
                        </div>
                      </>
                    )}
                </div>
                </div>

                {/* SCORE TAB - UPDATED WITH ROBUST VIEWER */}
                <div className={`absolute inset-0 w-full h-full overflow-y-auto ${activeTab === 'score' ? 'block' : 'hidden'}`}>
                <div className="p-4 h-full flex flex-col">
                    {/* Viewer Controls */}
                    <div className="mb-4 flex justify-end">
                        <button 
                            onClick={() => setPdfViewerType(prev => prev === 'google' ? 'native' : 'google')}
                            className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-50 font-medium flex items-center gap-2 shadow-sm transition-colors"
                            title="Toggle between Google Viewer and Native Browser Viewer"
                        >
                            <Eye size={14} />
                            Switch to {pdfViewerType === 'google' ? 'Native Viewer' : 'Google Viewer'}
                        </button>
                    </div>

                    <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden min-h-[70vh] relative">
                    {selectedSong.pdfUrl ? (
                         pdfViewerType === 'google' ? (
                            <iframe 
                                src={selectedSong.pdfUrl} 
                                className="w-full h-full absolute inset-0" 
                                title={`Score for ${selectedSong.title}`} 
                            />
                         ) : (
                            <iframe 
                                src={selectedSong.rawPdfLink} 
                                className="w-full h-full absolute inset-0" 
                                title={`Score for ${selectedSong.title}`}
                                type="application/pdf"
                            />
                         )
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-8 text-center">
                        <FileText size={48} className="mb-4 opacity-20" />
                        <p className="text-sm text-slate-500 font-bold mb-2">PDF Link Error</p>
                        <p className="text-sm">
                            The embedded viewer could not be loaded. Please ensure your Firebase Bucket ID is correct and files are in the 'scores' folder.
                        </p>
                        </div>
                    )}
                    </div>
                    
                    <div className="mt-4 shrink-0">
                        <a 
                            href={selectedSong.rawPdfLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 font-medium py-3 px-4 rounded-xl shadow-sm hover:bg-slate-50 hover:text-indigo-600 transition-all text-sm"
                        >
                            <ExternalLink size={18} />
                            Open PDF in New Tab
                        </a>
                    </div>
                </div>
                </div>

                {/* AUDIO TAB */}
                <div className={`absolute inset-0 w-full h-full overflow-y-auto ${activeTab === 'audio' ? 'block' : 'hidden'}`}>
                <div className="p-4">
                    <div className="space-y-6 max-w-md mx-auto mt-4">
                    <div className="text-center mb-8">
                        <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600 shadow-inner">
                        <img src="https://firebasestorage.googleapis.com/v0/b/psalms-and-hymns-85ee4.firebasestorage.app/o/data%2FPHLG_logo_favicon.png?alt=media" alt="Logo" className="w-12 h-12" />
                        </div>
                        <h3 className="font-bold text-xl text-slate-800">{selectedSong.title}</h3>
                        <p className="text-slate-500 font-medium">{selectedSong.tune}</p>
                        <p className="text-xs text-slate-400 mt-2">Tap the list icon on a player to add to playlist.</p>
                    </div>

                    {/* Starting Pitch Button - Temporarily Disabled */}
                    {ENABLE_TONE_FEATURES && <StartingPitchButton songNumber={selectedSong.number} />}

                    <AudioPlayer
                        url={selectedSong.accompanimentUrl} 
                        label="Piano Accompaniment" 
                        icon={Music}
                        isActive={playerState.currentUrl === selectedSong.accompanimentUrl}
                        isPlaying={playerState.isPlaying}
                        progress={playerState.progress}
                        onPlay={() => playTrack(selectedSong.accompanimentUrl, "Piano", selectedSong)}
                        onTogglePlay={togglePlay}
                        onRestart={restartTrack}
                        onAddToPlaylist={() => addToPlaylist(selectedSong, selectedSong.accompanimentUrl, "Piano")}
                        hasError={playerState.currentUrl === selectedSong.accompanimentUrl && playerState.hasError}
                        speed={playerState.settings.speed}
                        transpose={playerState.settings.transpose}
                        onSpeedChange={updateSpeed}
                        onTransposeChange={updateTranspose}
                        onCastClick={handleCastClick}
                        castState={castState}
                        airPlayAvailable={airPlayAvailable}
                    />
                    
                    <AudioPlayer 
                        url={vocalUrlToPass} 
                        label="Vocal Performance" 
                        icon={VocalIcon}
                        isActive={playerState.currentUrl === selectedSong.vocalUrl}
                        isPlaying={playerState.isPlaying}
                        progress={playerState.progress}
                        onPlay={() => playTrack(selectedSong.vocalUrl, "Vocal", selectedSong)}
                        onTogglePlay={togglePlay}
                        onRestart={restartTrack}
                        onAddToPlaylist={() => {
                            if (!isPremium) {
                                setIsPremiumModalOpen(true);
                            } else {
                                addToPlaylist(selectedSong, selectedSong.vocalUrl, "Vocal");
                            }
                        }}
                        hasError={playerState.currentUrl === selectedSong.vocalUrl && playerState.hasError}
                        speed={playerState.settings.speed}
                        transpose={playerState.settings.transpose}
                        onSpeedChange={updateSpeed}
                        onTransposeChange={updateTranspose}
                        showSpeedControl={false}
                        onCastClick={handleCastClick}
                        castState={castState}
                        airPlayAvailable={airPlayAvailable}
                        isPreview={!isPremium}
                        onUnlock={() => setIsPremiumModalOpen(true)}
                        customColor="#58a3d3"
                    />

                    {/* Voice Part Mixer - Temporarily Disabled */}
                    {ENABLE_TONE_FEATURES && selectedSong.xmlUrl && (
                        <VoicePartMixer
                            ref={mixerRef}
                            xmlUrl={selectedSong.xmlUrl} 
                            title={selectedSong.title}
                            songNumber={selectedSong.number}
                            isGloballyActive={playerState.activePlayer === 'mixer'}
                            onStateChange={(mixerIsPlaying, mixerProgress) => {
                                if (mixerIsPlaying && playerState.activePlayer !== 'mixer') {
                                  // CRITICAL: Nuclear option - completely disable the audio element
                                  if (audioRef.current) {
                                    // Stop all pending operations
                                    audioRef.current.pause();
                                    audioRef.current.currentTime = 0;
                                    
                                    // Remove ALL event listeners to prevent any callbacks
                                    audioRef.current.onplay = null;
                                    audioRef.current.onplaying = null;
                                    audioRef.current.oncanplay = null;
                                    
                                    // Clear the source completely
                                    audioRef.current.src = '';
                                    audioRef.current.removeAttribute('src');
                                    audioRef.current.load(); // Force complete reset
                                    
                                    // Set volume to 0 as extra safety
                                    audioRef.current.volume = 0;
                                  }
                                }
                                
                                setPlayerState(prev => {
                                  if (mixerIsPlaying && prev.activePlayer !== 'mixer') {
                                    return {
                                      ...prev,
                                      activePlayer: 'mixer',
                                      isPlaying: false, // Set to FALSE - mixer handles its own playback
                                      progress: 0,
                                      songTitle: selectedSong.title,
                                      songNumber: selectedSong.number,
                                      trackLabel: 'Voice Parts Mixer',
                                      currentUrl: null, // Set to NULL - no audio URL when mixer is active
                                      playlistItemId: null,
                                      hasError: false,
                                    };
                                  } else if (!mixerIsPlaying && prev.activePlayer === 'mixer') {
                                    if (mixerProgress >= 100) {
                                      closePlayer();
                                    }
                                    return { ...prev, isPlaying: false, progress: mixerProgress };
                                  } else if (prev.activePlayer === 'mixer') {
                                    return { ...prev, progress: mixerProgress };
                                  }
                                  return prev;
                                });
                            }}
                        />
                    )}
                    </div>
                </div>
                </div>
            </div>
        </div>
      );
  };

  // --- MAIN RENDER ---
  return (
    <div className="app-container">
      {/* Audio element - always rendered */}
      <audio 
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleAudioError}
        className="hidden"
      />

      {showSharedService && sharedService ? (
        <ServiceViewer
          service={sharedService}
          onClose={() => setShowSharedService(false)}
          hymnalData={hymnalData}
          onSongSelect={handleSongSelect}
        />
      ) : isServicePlannerOpen ? (
        <ErrorBoundary>
          <ServicePlanner
            isOpen={isServicePlannerOpen}
            onClose={() => setIsServicePlannerOpen(false)}
            user={user}
            myOrgs={myOrgs}
            isPremium={isPremium}
            onOpenPremium={() => setIsPremiumModalOpen(true)}
            hymnalData={hymnalData}
            onSongSelect={handleSongSelect}
            playerState={playerState}
            onPlayTrack={playTrack}
            onTogglePlay={togglePlay}
            onRestartTrack={restartTrack}
            onAddToPlaylist={addToPlaylist}
            onSpeedChange={updateSpeed}
            onTransposeChange={updateTranspose}
            vocalAvailability={vocalAvailability}
          />
        </ErrorBoundary>
      ) : (
        <>
          {view === 'list' ? renderList() : renderDetail()}
        </>
      )}

      {/* Floating Player - always available */}
      {(playerState.currentUrl || (playerState.activePlayer === 'mixer' && playerState.isPlaying)) && (
        <FloatingPlayer 
          title={`${playerState.songNumber}. ${playerState.songTitle}`}
          subtitle={playerState.trackLabel}
          isPlaying={playerState.isPlaying}
          onTogglePlay={togglePlay}
          onClose={closePlayer}
          onClick={handleFloatingPlayerClick}
          onRestart={restartTrack}
          onCastClick={handleCastClick}
          castState={castState}
          airPlayAvailable={airPlayAvailable}
        />
      )}

      {/* Modals & Drawers - always available */}
      <PlaylistDrawer
        isOpen={isPlaylistOpen}
        onClose={() => setIsPlaylistOpen(false)}
        playlist={playlist}
        currentPlayingId={playerState.playlistItemId}
        isPlaying={playerState.isPlaying}
        onReorder={setPlaylist}
        onRemove={removeFromPlaylist}
        onPlayItem={playPlaylistItem}
        onPlayAll={playAllPlaylist}
        playMode={playMode}
        onToggleMode={() => setPlayMode(prev => prev === 'continue' ? 'stop' : 'continue')}
        onClear={() => setPlaylist([])}
        user={user}
        hymnalData={hymnalData}
        externalPlaylist={sharedPlaylist}
        onClearExternalPlaylist={() => setSharedPlaylist(null)}
        onAuthTrigger={() => setIsAuthOpen(true)}
        isPremium={isPremium}
        onOpenPremium={() => setIsPremiumModalOpen(true)}
      />

      <AuthModal 
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <AdminDashboard
        isOpen={isAdminDashboardOpen}
        onClose={() => setIsAdminDashboardOpen(false)}
        songData={hymnalData}
      />

      <PremiumModal 
        isOpen={isPremiumModalOpen} 
        onClose={() => setIsPremiumModalOpen(false)}
        onLogin={() => {
            setIsPremiumModalOpen(false);
            setIsAuthOpen(true);
        }}
      />

      <AboutModal 
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        version={APP_VERSION}
        releaseNotes={RELEASE_NOTES}
        buyUrl={BUY_HYMNAL_URL}
      />

      <ResourcesModal
        isOpen={isResourcesOpen}
        onClose={() => setIsResourcesOpen(false)}
      />

      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
      />

      <InstallInstructionsModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        isIos={isIos}
      />

    </div>
  );
}
