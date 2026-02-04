
import React, { useState, useEffect, useRef } from 'react';
import { X, Users, Building2, Search, Shield, Crown, Trash2, ChevronRight, Check, Loader2, AlertTriangle, UserPlus, ArrowLeft, Copy, Database, RefreshCw, CreditCard, ShieldAlert, AlertCircle, FileText, Download, Upload, Terminal, BarChart3, TrendingUp, Calendar, ListOrdered } from 'lucide-react';
import { collection, query, onSnapshot, doc, updateDoc, setDoc, getDocs, where, arrayUnion, arrayRemove, writeBatch, Timestamp, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProfile, Organization, Song, RichDataEntry, SavedPlaylist } from '../types';
import { FIRESTORE_RULES } from '../firebaseRules';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  songData: Song[];
}

type AdminTab = 'users' | 'orgs' | 'data' | 'analytics';

const CORS_CONFIG = `[
  {
    "origin": ["*"],
    "method": ["GET"],
    "maxAgeSeconds": 3600
  }
]`;

// Helper Component to fetch and display Stripe status for a specific user
const UserStatusCell: React.FC<{ user: UserProfile, onToggleManual: (e: React.MouseEvent) => void, isUpdating: boolean, align?: 'start' | 'end' }> = ({ user, onToggleManual, isUpdating, align = 'end' }) => {
    // ... (existing UserStatusCell logic - keeping concise for brevity) ...
    const [stripeStatus, setStripeStatus] = useState<string | null>(null);
    const [isStripePremium, setIsStripePremium] = useState(false);
    const [checkingStripe, setCheckingStripe] = useState(true);
    const [permError, setPermError] = useState(false);

    useEffect(() => {
        setPermError(false);
        const q = query(collection(db, "customers", user.uid, "subscriptions"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                setStripeStatus(null);
                setIsStripePremium(false);
            } else {
                const activeSub = snapshot.docs.find(doc => {
                    const s = doc.data().status;
                    return s === 'active' || s === 'trialing';
                });
                if (activeSub) {
                    setStripeStatus(activeSub.data().status);
                    setIsStripePremium(true);
                } else {
                    const firstSub = snapshot.docs[0];
                    setStripeStatus(firstSub.data().status);
                    setIsStripePremium(false);
                }
            }
            setCheckingStripe(false);
            setPermError(false); 
        }, (err) => {
            if (err.code === 'permission-denied') setPermError(true);
            setCheckingStripe(false);
        });
        return () => unsubscribe();
    }, [user.uid]);

    const effectivePremium = user.isPremium || isStripePremium;

    return (
        <div className={`flex flex-col gap-1.5 ${align === 'start' ? 'items-start' : 'items-end'}`}>
            {effectivePremium ? (
                <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-xs font-bold border border-emerald-200 shadow-sm">
                    <Check size={12} strokeWidth={3} /> Premium
                </span>
            ) : (
                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full text-xs font-medium border border-slate-200">
                    Free
                </span>
            )}
            <div className={`flex flex-col gap-1 ${align === 'start' ? 'items-start' : 'items-end'}`}>
                {user.isPremium && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100" title="Premium granted by Admin">
                        <Crown size={10} fill="currentColor" />
                        <span>Manual Override</span>
                    </div>
                )}
                {stripeStatus ? (
                    <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${isStripePremium ? 'text-indigo-700 bg-indigo-50 border-indigo-100' : 'text-slate-500 bg-slate-50 border-slate-100'}`}>
                        <CreditCard size={10} />
                        <span className="uppercase">Stripe: {stripeStatus}</span>
                    </div>
                ) : permError ? (
                     <div className="group relative flex items-center gap-1 text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 cursor-help">
                        <ShieldAlert size={10} />
                        <span>Check Perms</span>
                    </div>
                ) : null}
            </div>
            <button 
                onClick={onToggleManual}
                disabled={isUpdating}
                className={`text-[10px] font-semibold px-2 py-1 rounded transition-colors flex items-center gap-1 mt-1 ${
                    user.isPremium 
                        ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' 
                        : 'text-indigo-600 hover:bg-indigo-50'
                } disabled:opacity-50`}
            >
                {isUpdating && <Loader2 size={10} className="animate-spin" />}
                {user.isPremium ? "Revoke Manual Access" : "Grant Manual Access"}
            </button>
        </div>
    );
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose, songData }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [userFilter, setUserFilter] = useState<'all' | 'free' | 'premium' | 'admin'>('all');
  const [userSort, setUserSort] = useState<'newest' | 'oldest' | 'email'>('newest');
  const [permissionError, setPermissionError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCors, setCopiedCors] = useState(false);
  
  // Track which user is currently being updated (for loading spinner)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  
  // Org Management State
  const [userSearchEmail, setUserSearchEmail] = useState('');
  const [isSearchingUser, setIsSearchingUser] = useState(false);

  // Data Import State
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification Toast State
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // Analytics State
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [analyticsData, setAnalyticsData] = useState<{
      hits: number;
      uniqueVisitors: number;
      songStats: Record<string, { views: number, plays: number, saves: number, title?: string }>;
      topSongs: { number: string, title: string, score: number, views: number, plays: number, saves: number }[];
      topSearches: { term: string, count: number }[];
  } | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  
  // Track Stripe premium status for all users
  const [stripePremiumUsers, setStripePremiumUsers] = useState<Set<string>>(new Set());

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
      setToast({ msg, type });
      setTimeout(() => setToast(null), 3000);
  };

  // Admin Self-Check
  const currentUser = auth.currentUser;
  const myProfile = users.find(u => u.uid === currentUser?.uid);
  const isDbAdmin = myProfile?.isAdmin === true;
  const isHardcodedAdmin = currentUser?.email === 'saniol@gmail.com';

  const handleCopyRules = () => {
    navigator.clipboard.writeText(FIRESTORE_RULES);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCors = () => {
    navigator.clipboard.writeText(CORS_CONFIG);
    setCopiedCors(true);
    setTimeout(() => setCopiedCors(false), 2000);
  };

  const handleExportCSV = () => {
    // ... (CSV Export Logic - no changes) ...
    if (!songData || songData.length === 0) {
        showToast("No song data available to export.", "error");
        return;
    }
    const headers = ['Number', 'Title', 'Meter', 'Author', 'Composer', 'Tune', 'Category'];
    const csvContent = [
      headers.join(','),
      ...songData.map(song => {
        const row = [
          song.number, song.title, song.meter, song.author, song.composer, song.tune, song.category
        ].map(field => `"${(field || '').replace(/"/g, '""')}"`);
        return row.join(',');
      })
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'hymnal_metadata.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV Exported Successfully!");
  };

  // --- CSV Parsing Logic ---
  const parseCSV = (text: string) => {
    // ... (CSV Parse Logic - no changes) ...
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        if (inQuotes) {
            if (char === '"' && nextChar === '"') { currentField += '"'; i++; }
            else if (char === '"') { inQuotes = false; }
            else { currentField += char; }
        } else {
            if (char === '"') { inQuotes = true; }
            else if (char === ',') { currentRow.push(currentField.trim()); currentField = ''; }
            else if (char === '\n' || char === '\r') {
                if (currentField || currentRow.length > 0) currentRow.push(currentField.trim());
                if (currentRow.length > 0) rows.push(currentRow);
                currentRow = []; currentField = '';
                if (char === '\r' && nextChar === '\n') i++;
            } else { currentField += char; }
        }
    }
    if (currentField || currentRow.length > 0) { currentRow.push(currentField.trim()); if (currentRow.length > 0) rows.push(currentRow); }
    return rows;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      // ... (File Upload Logic - no changes) ...
      const file = e.target.files?.[0];
      if (!file) return;
      setIsUploading(true);
      showToast("Processing file...", "success");
      const reader = new FileReader();
      reader.onload = async (evt) => {
          const text = evt.target?.result as string;
          if (!text) { setIsUploading(false); return; }
          try {
              const rows = parseCSV(text);
              if (rows.length < 2) { showToast("CSV is empty or invalid format.", "error"); setIsUploading(false); return; }
              const headers = rows[0].map(h => h.toLowerCase());
              const requiredFields = ['number', 'title'];
              const fieldMap: Record<string, number> = {};
              headers.forEach((h, idx) => fieldMap[h] = idx);
              if (!requiredFields.every(f => fieldMap[f] !== undefined)) { showToast("CSV must contain 'Number' and 'Title'.", "error"); setIsUploading(false); return; }
              const updates: { id: string, data: Partial<RichDataEntry> }[] = [];
              for (let i = 1; i < rows.length; i++) {
                  const row = rows[i];
                  if (row.length < headers.length) continue;
                  const number = row[fieldMap['number']];
                  if (!number) continue;
                  const updateData: Partial<RichDataEntry> = {};
                  if (fieldMap['title'] !== undefined) updateData.title = row[fieldMap['title']];
                  if (fieldMap['meter'] !== undefined) updateData.meter = row[fieldMap['meter']];
                  if (fieldMap['author'] !== undefined) updateData.author = row[fieldMap['author']];
                  if (fieldMap['composer'] !== undefined) updateData.composer = row[fieldMap['composer']];
                  if (fieldMap['tune'] !== undefined) updateData.tune = row[fieldMap['tune']];
                  if (fieldMap['category'] !== undefined) updateData.category = row[fieldMap['category']];
                  updates.push({ id: number, data: updateData });
              }
              const chunkSize = 400;
              for (let i = 0; i < updates.length; i += chunkSize) {
                  const chunk = updates.slice(i, i + chunkSize);
                  const batch = writeBatch(db);
                  chunk.forEach(update => {
                      const ref = doc(db, "song_metadata", update.id);
                      batch.set(ref, update.data, { merge: true });
                  });
                  await batch.commit();
              }
              showToast(`Updated ${updates.length} songs!`, "success");
              if (fileInputRef.current) fileInputRef.current.value = '';
          } catch (err: any) { console.error(err); showToast(`Import failed: ${err.message}`, "error"); } 
          finally { setIsUploading(false); }
      };
      reader.readAsText(file);
  };

  // Fetch Users
  useEffect(() => {
    if (isOpen) {
      const q = query(collection(db, "users"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const userList: UserProfile[] = [];
        snapshot.forEach(doc => userList.push({ uid: doc.id, ...doc.data() } as UserProfile));
        setUsers(userList);
      }, (err) => {
        if (err.code === 'permission-denied') setPermissionError(true);
      });
      return () => unsubscribe();
    }
  }, [isOpen]);

  // Fetch Stripe subscription status for all users
  useEffect(() => {
    if (!isOpen || users.length === 0) return;
    
    const unsubscribers: Array<() => void> = [];
    const premiumSet = new Set<string>();
    
    users.forEach(user => {
      const q = query(collection(db, "customers", user.uid, "subscriptions"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const hasActiveSub = snapshot.docs.some(doc => {
          const status = doc.data().status;
          return status === 'active' || status === 'trialing';
        });
        
        if (hasActiveSub) {
          premiumSet.add(user.uid);
        } else {
          premiumSet.delete(user.uid);
        }
        
        setStripePremiumUsers(new Set(premiumSet));
      }, (err) => {
        // Silently handle permission errors for individual subscriptions
        if (err.code === 'permission-denied') {
          // User might not have subscription data accessible
        }
      });
      
      unsubscribers.push(unsubscribe);
    });
    
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [isOpen, users]);

  // Fetch Orgs
  useEffect(() => {
    if (isOpen && activeTab === 'orgs') {
      setIsLoading(true);
      setPermissionError(false);
      const q = query(collection(db, "organizations"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orgList: Organization[] = [];
        snapshot.forEach(doc => orgList.push({ id: doc.id, ...doc.data() } as Organization));
        setOrgs(orgList);
        setIsLoading(false);
      }, (err) => {
        if (err.code === 'permission-denied') setPermissionError(true);
        setIsLoading(false);
      });
      return () => unsubscribe();
    } else if (isOpen && activeTab === 'users') {
        if (users.length > 0) setIsLoading(false);
        else { setIsLoading(true); const timer = setTimeout(() => setIsLoading(false), 1000); return () => clearTimeout(timer); }
    }
  }, [isOpen, activeTab, users.length]);

  // Fetch Analytics
  useEffect(() => {
    if (isOpen && activeTab === 'analytics') {
      setIsLoadingAnalytics(true);
      
      const fetchAnalytics = async () => {
        try {
          // 1. Determine Date Range
          const now = new Date();
          let startDate: Date | null = new Date();
          if (analyticsTimeRange === 'today') {
            startDate.setHours(0, 0, 0, 0);
          } else if (analyticsTimeRange === 'week') {
            startDate.setDate(now.getDate() - 7);
          } else if (analyticsTimeRange === 'month') {
            startDate.setMonth(now.getMonth() - 1);
          } else {
            startDate = null; // All Time
          }

          // 2. Fetch Events
          let q = query(collection(db, 'analytics_events'), orderBy('timestamp', 'desc'));
          if (startDate) {
            q = query(collection(db, 'analytics_events'), where('timestamp', '>=', Timestamp.fromDate(startDate)), orderBy('timestamp', 'desc'));
          }

          const eventsSnap = await getDocs(q);
          const events = eventsSnap.docs.map(d => d.data());

          // 3. Process Events
          const hits = events.filter(e => e.eventName === 'page_view').length;
          const uniqueVisitors = new Set(events.filter(e => e.eventName === 'page_view').map(e => e.visitorId)).size;
          
          const songStats: Record<string, { views: number, plays: number, saves: number, title?: string }> = {};
          const searchStats: Record<string, number> = {};

          events.forEach(e => {
            if (e.eventName === 'search') {
                const term = e.query ? `"${e.query}"` : (e.category ? `Theme: ${e.category}` : null);
                if (term) {
                    searchStats[term] = (searchStats[term] || 0) + 1;
                }
            } else if (e.songNumber) {
              if (!songStats[e.songNumber]) {
                songStats[e.songNumber] = { views: 0, plays: 0, saves: 0, title: e.title };
              }
              if (e.eventName === 'song_view') songStats[e.songNumber].views++;
              if (e.eventName === 'song_played') songStats[e.songNumber].plays++;
              // Note: 'playlist_add' is historical adds in this range
              if (e.eventName === 'playlist_add') songStats[e.songNumber].saves++; 
            }
          });

          const topSearches = Object.entries(searchStats)
            .map(([term, count]) => ({ term, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);

          // 4. Fetch CURRENT Playlist Stats
          const playlistsSnap = await getDocs(collection(db, 'playlists'));
          const currentSaves: Record<string, number> = {};
          playlistsSnap.forEach(doc => {
              const data = doc.data(); 
              if (data.items && Array.isArray(data.items)) {
                  data.items.forEach((item: any) => {
                      if (item.songNumber) {
                          currentSaves[item.songNumber] = (currentSaves[item.songNumber] || 0) + 1;
                      }
                  });
              }
          });

          // Merge current saves into songStats if they don't exist (so they appear in the list)
          if (analyticsTimeRange === 'all') {
              Object.keys(currentSaves).forEach(num => {
                  if (!songStats[num]) {
                      songStats[num] = { views: 0, plays: 0, saves: 0, title: undefined };
                  }
              });
          }
          
          // 5. Calculate Top Songs Score
          const topSongs = Object.entries(songStats).map(([number, stats]) => {
            // If 'All Time', use current active saves. Else use the trend (adds in period)
            const effectiveSaves = analyticsTimeRange === 'all' ? (currentSaves[number] || 0) : stats.saves;
            
            return {
                number,
                title: stats.title || songData.find(s => s.number === number)?.title || `Hymn ${number}`,
                views: stats.views,
                plays: stats.plays,
                saves: effectiveSaves,
                score: stats.views + (stats.plays * 2) + (effectiveSaves * 5),
            };
          }).sort((a, b) => b.score - a.score);

          setAnalyticsData({
            hits,
            uniqueVisitors,
            songStats,
            topSongs,
            topSearches
          });

        } catch (e) {
          console.error("Analytics fetch error:", e);
          showToast("Failed to fetch analytics", "error");
        } finally {
          setIsLoadingAnalytics(false);
        }
      };

      fetchAnalytics();
    }
  }, [isOpen, activeTab, analyticsTimeRange]);

  const initializeAdmin = async () => {
      if (!currentUser || !isHardcodedAdmin) return;
      setUpdatingUserId(currentUser.uid);
      try {
          await setDoc(doc(db, "users", currentUser.uid), { isAdmin: true, email: currentUser.email }, { merge: true });
          showToast("Admin privileges initialized!");
      } catch (e: any) { showToast(`Failed: ${e.message}`, "error"); } 
      finally { setUpdatingUserId(null); }
  };

  const togglePremium = async (e: React.MouseEvent, user: UserProfile) => {
    // ... (Toggle Premium Logic - no changes) ...
    e.preventDefault(); e.stopPropagation();
    if (!isDbAdmin && !isHardcodedAdmin) { showToast("No Admin privileges.", "error"); return; }
    const newStatus = !user.isPremium;
    setUpdatingUserId(user.uid);
    try {
      await setDoc(doc(db, "users", user.uid), { isPremium: newStatus }, { merge: true });
    } catch (err: any) {
      if (err.code === 'permission-denied') { setPermissionError(true); showToast("Permission denied.", "error"); }
      else { showToast(`Failed: ${err.message}`, "error"); }
    } finally { setUpdatingUserId(null); }
  };

  const toggleAdmin = async (e: React.MouseEvent, user: UserProfile) => {
    e.preventDefault(); e.stopPropagation();
    if (!isDbAdmin && !isHardcodedAdmin) { showToast("No Admin privileges.", "error"); return; }
    
    const newStatus = !user.isAdmin;
    const confirmMsg = newStatus 
      ? `Are you sure you want to promote ${user.email} to Admin? They will have full admin privileges.`
      : `Are you sure you want to revoke admin privileges from ${user.email}?`;
    
    if (!window.confirm(confirmMsg)) return;
    
    setUpdatingUserId(user.uid);
    try {
      await setDoc(doc(db, "users", user.uid), { isAdmin: newStatus }, { merge: true });
      showToast(newStatus ? "User promoted to Admin!" : "Admin privileges revoked.");
    } catch (err: any) {
      if (err.code === 'permission-denied') { setPermissionError(true); showToast("Permission denied.", "error"); }
      else { showToast(`Failed: ${err.message}`, "error"); }
    } finally { setUpdatingUserId(null); }
  };

  const addUserToOrg = async (orgId: string, role: 'member' | 'admin') => {
    // ... (Add User to Org Logic - no changes) ...
    if (!userSearchEmail.trim()) return;
    setIsSearchingUser(true);
    try {
      const q = query(collection(db, "users"), where("email", "==", userSearchEmail.trim()));
      const snap = await getDocs(q);
      if (snap.empty) { showToast("User not found.", "error"); setIsSearchingUser(false); return; }
      const targetUser = snap.docs[0].data() as UserProfile;
      const targetUid = targetUser.uid;
      const orgRef = doc(db, "organizations", orgId);
      if (role === 'admin') { await updateDoc(orgRef, { memberIds: arrayUnion(targetUid), adminIds: arrayUnion(targetUid) }); } 
      else { await updateDoc(orgRef, { memberIds: arrayUnion(targetUid) }); }
      setUserSearchEmail(''); showToast(`Added ${targetUser.email} as ${role}.`);
    } catch (e: any) { if (e.code === 'permission-denied') setPermissionError(true); else showToast("Failed to add user.", "error"); } 
    finally { setIsSearchingUser(false); }
  };

  const removeUserFromOrg = async (orgId: string, uid: string) => {
    // ... (Remove User Logic - no changes) ...
    if (window.confirm("Remove this user?")) {
        try {
            const orgRef = doc(db, "organizations", orgId);
            await updateDoc(orgRef, { memberIds: arrayRemove(uid), adminIds: arrayRemove(uid) });
            showToast("User removed.");
        } catch(e: any) { if (e.code === 'permission-denied') setPermissionError(true); }
    }
  };

  const toggleOrgAdmin = async (orgId: string, uid: string, isAdmin: boolean) => {
      try {
        const orgRef = doc(db, "organizations", orgId);
        if (isAdmin) { await updateDoc(orgRef, { adminIds: arrayRemove(uid) }); } 
        else { await updateDoc(orgRef, { adminIds: arrayUnion(uid) }); }
      } catch(e: any) { if (e.code === 'permission-denied') setPermissionError(true); }
  }

  // Filter and Sort Users
  let filteredUsers = users.filter(u => {
    // Search filter
    const matchesSearch = (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) || u.uid.includes(searchQuery);
    if (!matchesSearch) return false;
    
    // Type filter
    if (userFilter === 'admin') return u.isAdmin === true;
    if (userFilter === 'premium') return u.isPremium === true;
    if (userFilter === 'free') return !u.isPremium && !u.isAdmin;
    return true; // 'all'
  });

  // Sort users
  filteredUsers = [...filteredUsers].sort((a, b) => {
    if (userSort === 'email') {
      return (a.email || '').localeCompare(b.email || '');
    }
    if (!a.createdAt || !b.createdAt) return 0;
    const aTime = a.createdAt.seconds || 0;
    const bTime = b.createdAt.seconds || 0;
    return userSort === 'newest' ? bTime - aTime : aTime - bTime;
  });

  // Calculate user stats
  const userStats = {
    total: users.length,
    free: users.filter(u => !u.isPremium && !stripePremiumUsers.has(u.uid) && !u.isAdmin).length,
    premium: users.filter(u => u.isPremium || stripePremiumUsers.has(u.uid)).length,
    admin: users.filter(u => u.isAdmin).length,
  };
  const filteredOrgs = orgs.filter(o => o.name.toLowerCase().includes(searchQuery.toLowerCase()) || o.uniqueCode.includes(searchQuery));
  const getUserEmail = (uid: string) => {
      const u = users.find(user => user.uid === uid);
      if (u && u.email) return u.email;
      if (uid.length > 20 && !uid.includes('@')) return `User (${uid.substring(0, 6)}...)`;
      return uid;
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-slate-100 overflow-hidden flex flex-col animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="bg-slate-900 text-white px-4 md:px-6 py-3 md:py-4 shadow-md flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
            <Shield className="text-indigo-400 w-5 h-5 md:w-6 md:h-6" />
            <h1 className="text-base md:text-lg font-bold tracking-wide">Admin Dashboard</h1>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X size={24} />
        </button>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex md:flex-col shrink-0 overflow-x-auto no-scrollbar">
            <nav className="p-2 md:p-4 flex md:flex-col gap-2 min-w-full md:min-w-0">
                <button onClick={() => { setActiveTab('users'); setSelectedOrg(null); }} className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'users' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <Users className="w-4 h-4 md:w-[18px] md:h-[18px]" /> Users
                </button>
                <button onClick={() => { setActiveTab('orgs'); setSelectedOrg(null); }} className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'orgs' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <Building2 className="w-4 h-4 md:w-[18px] md:h-[18px]" /> Organizations
                </button>
                <button onClick={() => { setActiveTab('data'); setSelectedOrg(null); }} className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'data' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <Database className="w-4 h-4 md:w-[18px] md:h-[18px]" /> Data
                </button>
                <button onClick={() => { setActiveTab('analytics'); setSelectedOrg(null); }} className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'analytics' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <BarChart3 className="w-4 h-4 md:w-[18px] md:h-[18px]" /> Analytics
                </button>
            </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 md:bg-white">
            
            {/* Admin Initialization Warning */}
            {isHardcodedAdmin && !isDbAdmin && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="text-amber-500 shrink-0" size={24} />
                        <div><h3 className="font-bold text-amber-800">Setup Required</h3><p className="text-xs text-amber-700">You are logged in as the Super Admin, but your database permissions are not set yet.</p></div>
                    </div>
                    <button onClick={initializeAdmin} disabled={updatingUserId === currentUser?.uid} className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors">{updatingUserId === currentUser?.uid && <Loader2 size={16} className="animate-spin" />} Initialize</button>
                </div>
            )}

            {/* Permission Error Overlay */}
            {permissionError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 md:p-6 mb-6 animate-in slide-in-from-top-2">
                    <div className="flex items-start gap-4">
                        <AlertTriangle className="text-red-500 shrink-0 mt-1" size={24} />
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-red-700 mb-2">Database Permissions Missing</h3>
                            <p className="text-sm text-red-600 mb-4">Update your <strong>Firestore Rules</strong> in the Firebase Console.</p>
                            <div className="bg-white p-3 rounded border border-red-200 mb-4 font-mono text-xs text-slate-600 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">{FIRESTORE_RULES}</div>
                            <button onClick={handleCopyRules} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors">{copied ? <Check size={16}/> : <Copy size={16}/>}{copied ? "Rules Copied!" : "Copy Rules"}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Search Bar & Filters */}
            {activeTab === 'users' && (
                <div className="mb-4 md:mb-6 space-y-4">
                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="text-xs md:text-sm font-medium text-slate-500 mb-1">Total Users</div>
                            <div className="text-xl md:text-2xl font-bold text-slate-900">{userStats.total}</div>
                        </div>
                        <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="text-xs md:text-sm font-medium text-slate-500 mb-1">Free</div>
                            <div className="text-xl md:text-2xl font-bold text-slate-600">{userStats.free}</div>
                        </div>
                        <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="text-xs md:text-sm font-medium text-emerald-600 mb-1">Premium</div>
                            <div className="text-xl md:text-2xl font-bold text-emerald-600">{userStats.premium}</div>
                        </div>
                        <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="text-xs md:text-sm font-medium text-indigo-600 mb-1">Admins</div>
                            <div className="text-xl md:text-2xl font-bold text-indigo-600">{userStats.admin}</div>
                        </div>
                    </div>

                    {/* Search & Filter Controls */}
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Search users..." 
                                value={searchQuery} 
                                onChange={(e) => setSearchQuery(e.target.value)} 
                                className="w-full pl-10 pr-4 py-2.5 md:py-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                            />
                        </div>
                        <div className="flex gap-2">
                            <select 
                                value={userFilter} 
                                onChange={(e) => setUserFilter(e.target.value as any)}
                                className="px-3 py-2.5 md:py-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm bg-white"
                            >
                                <option value="all">All Users</option>
                                <option value="free">Free Only</option>
                                <option value="premium">Premium Only</option>
                                <option value="admin">Admins Only</option>
                            </select>
                            <select 
                                value={userSort} 
                                onChange={(e) => setUserSort(e.target.value as any)}
                                className="px-3 py-2.5 md:py-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm bg-white"
                            >
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                                <option value="email">Email A-Z</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Search Bar for Organizations */}
            {activeTab === 'orgs' && !selectedOrg && (
                <div className="mb-4 md:mb-6 max-w-2xl">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search organizations..." 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)} 
                            className="w-full pl-10 pr-4 py-2.5 md:py-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                        />
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 size={48} className="animate-spin text-indigo-300" /></div>
            ) : (
                <>
                    {/* --- USERS VIEW --- */}
                    {activeTab === 'users' && (
                        <>
                            <div className="md:hidden space-y-3">
                                {filteredUsers.map(u => (
                                    <div key={u.uid} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <div><div className="font-bold text-slate-900 break-all">{u.email || 'No Email'}</div><div className="text-[10px] text-slate-400 font-mono mt-0.5 break-all">{u.uid}</div></div>
                                            {u.isAdmin && <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded uppercase shrink-0 ml-2">Admin</span>}
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
                                            <span>Joined:</span>
                                            <span className="font-medium">{u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
                                        </div>
                                        <div className="pt-3 border-t border-slate-100 mt-2">
                                            <UserStatusCell user={u} onToggleManual={(e) => togglePremium(e, u)} isUpdating={updatingUserId === u.uid} align="start"/>
                                            {(isDbAdmin || isHardcodedAdmin) && (
                                                <button 
                                                    onClick={(e) => toggleAdmin(e, u)}
                                                    disabled={updatingUserId === u.uid}
                                                    className={`w-full mt-2 text-xs font-semibold px-3 py-2 rounded transition-colors flex items-center justify-center gap-1 ${
                                                        u.isAdmin 
                                                            ? 'text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200' 
                                                            : 'text-white bg-indigo-600 hover:bg-indigo-700'
                                                    } disabled:opacity-50`}
                                                >
                                                    {updatingUserId === u.uid && <Loader2 size={12} className="animate-spin" />}
                                                    <Shield size={12} />
                                                    {u.isAdmin ? "Revoke Admin" : "Promote to Admin"}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-3 font-semibold text-slate-600">User</th>
                                                <th className="px-6 py-3 font-semibold text-slate-600">Joined</th>
                                                <th className="px-6 py-3 font-semibold text-slate-600">Role</th>
                                                <th className="px-6 py-3 font-semibold text-slate-600 text-right">Account Status</th>
                                                <th className="px-6 py-3 font-semibold text-slate-600 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredUsers.map(u => (
                                                <tr key={u.uid} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-medium text-slate-900">{u.email || 'No Email'}</div>
                                                        <div className="text-xs text-slate-400 font-mono mt-0.5">{u.uid}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500">
                                                        {u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {u.isAdmin ? (
                                                            <span className="text-indigo-600 font-bold text-xs uppercase">Global Admin</span>
                                                        ) : (
                                                            <span className="text-slate-500 text-xs">User</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <UserStatusCell user={u} onToggleManual={(e) => togglePremium(e, u)} isUpdating={updatingUserId === u.uid} align="end"/>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {(isDbAdmin || isHardcodedAdmin) && (
                                                            <button 
                                                                onClick={(e) => toggleAdmin(e, u)}
                                                                disabled={updatingUserId === u.uid}
                                                                className={`text-xs font-semibold px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ml-auto ${
                                                                    u.isAdmin 
                                                                        ? 'text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200' 
                                                                        : 'text-white bg-indigo-600 hover:bg-indigo-700'
                                                                } disabled:opacity-50`}
                                                            >
                                                                {updatingUserId === u.uid && <Loader2 size={12} className="animate-spin" />}
                                                                <Shield size={12} />
                                                                {u.isAdmin ? "Revoke Admin" : "Promote to Admin"}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {/* --- ORGS VIEW --- */}
                    {activeTab === 'orgs' && !selectedOrg && (
                        <>
                            <div className="md:hidden space-y-3">
                                {filteredOrgs.map(o => (
                                    <div key={o.id} onClick={() => setSelectedOrg(o)} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm active:bg-slate-50 transition-colors cursor-pointer">
                                        <div className="flex justify-between items-center mb-3"><h3 className="font-bold text-slate-900 text-sm">{o.name}</h3><ChevronRight className="text-slate-400" size={18} /></div>
                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            <div className="bg-slate-50 p-2 rounded border border-slate-100"><span className="text-[10px] font-bold text-slate-400 uppercase block">Member Code</span><span className="font-mono text-sm font-bold text-slate-700">{o.uniqueCode}</span></div>
                                            <div className="bg-slate-50 p-2 rounded border border-slate-100"><span className="text-[10px] font-bold text-slate-400 uppercase block">Admin Code</span><span className="font-mono text-sm font-bold text-slate-700">{o.adminCode || 'N/A'}</span></div>
                                        </div>
                                        <div className="text-xs text-slate-500">{o.memberIds.length} Members ({o.adminIds?.length || 0} Admins)</div>
                                    </div>
                                ))}
                            </div>
                            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="px-6 py-3 font-semibold text-slate-600">Organization Name</th><th className="px-6 py-3 font-semibold text-slate-600">Codes</th><th className="px-6 py-3 font-semibold text-slate-600">Members</th><th className="px-6 py-3 font-semibold text-slate-600 text-right">Action</th></tr></thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredOrgs.map(o => (
                                                <tr key={o.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedOrg(o)}>
                                                    <td className="px-6 py-4 font-medium text-slate-900">{o.name}</td>
                                                    <td className="px-6 py-4 font-mono text-xs text-slate-500">M: {o.uniqueCode}<br/>A: {o.adminCode || 'N/A'}</td>
                                                    <td className="px-6 py-4 text-slate-600">{o.memberIds.length} Members <br/><span className="text-xs text-slate-400">({o.adminIds?.length || 0} Admins)</span></td>
                                                    <td className="px-6 py-4 text-right"><button className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-full"><ChevronRight size={20} /></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {/* --- ORG DETAIL VIEW --- */}
                    {activeTab === 'orgs' && selectedOrg && (
                        <div className="space-y-6 animate-in slide-in-from-right duration-200">
                            <div className="flex items-center gap-3 mb-4">
                                <button onClick={() => setSelectedOrg(null)} className="p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-50 text-slate-600"><ArrowLeft size={20} /></button>
                                <div className="min-w-0"><h2 className="text-xl md:text-2xl font-bold text-slate-900 truncate">{selectedOrg.name}</h2><p className="text-sm text-slate-500">Members & Admins</p></div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                                <div className="flex-1"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Add User by Email</label><input type="email" placeholder="user@example.com" value={userSearchEmail} onChange={(e) => setUserSearchEmail(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"/></div>
                                <div className="flex gap-2"><button onClick={() => addUserToOrg(selectedOrg.id, 'member')} disabled={isSearchingUser || !userSearchEmail} className="flex-1 sm:flex-none bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap">Add Member</button><button onClick={() => addUserToOrg(selectedOrg.id, 'admin')} disabled={isSearchingUser || !userSearchEmail} className="flex-1 sm:flex-none bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap">Make Admin</button></div>
                            </div>
                            <div className="md:hidden space-y-3">
                                {selectedOrg.memberIds.map(uid => {
                                    const isOrgAdmin = selectedOrg.adminIds?.includes(uid);
                                    const isCreator = selectedOrg.createdBy === uid;
                                    const email = getUserEmail(uid);
                                    return (
                                        <div key={uid} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="flex justify-between items-start mb-3"><div><div className="font-bold text-slate-900 text-sm break-all">{email}</div><div className="text-[10px] text-slate-400 font-mono break-all">{uid}</div></div>{isCreator ? <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[10px] font-bold shrink-0 ml-2">Creator</span> : isOrgAdmin ? <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-[10px] font-bold shrink-0 ml-2">Admin</span> : <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-[10px] font-medium shrink-0 ml-2">Member</span>}</div>
                                            {!isCreator && (<div className="flex gap-2 pt-3 border-t border-slate-100"><button onClick={() => toggleOrgAdmin(selectedOrg.id, uid, !!isOrgAdmin)} className={`flex-1 text-xs py-2 rounded font-medium transition-colors ${isOrgAdmin ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-600'}`}>{isOrgAdmin ? "Demote" : "Make Admin"}</button><button onClick={() => removeUserFromOrg(selectedOrg.id, uid)} className="flex-1 bg-red-50 text-red-600 text-xs py-2 rounded font-medium">Remove</button></div>)}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="px-6 py-3 font-semibold text-slate-600">User</th><th className="px-6 py-3 font-semibold text-slate-600">Org Role</th><th className="px-6 py-3 font-semibold text-slate-600 text-right">Actions</th></tr></thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {selectedOrg.memberIds.map(uid => {
                                                const isOrgAdmin = selectedOrg.adminIds?.includes(uid);
                                                const isCreator = selectedOrg.createdBy === uid;
                                                const email = getUserEmail(uid);
                                                return (
                                                    <tr key={uid} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4"><div className="font-medium text-slate-900">{email}</div><div className="text-xs text-slate-400 font-mono">{uid}</div></td>
                                                        <td className="px-6 py-4">{isCreator ? <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-bold">Creator</span> : isOrgAdmin ? <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs font-bold">Admin</span> : <span className="text-slate-500">Member</span>}</td>
                                                        <td className="px-6 py-4 text-right flex justify-end gap-2">{!isCreator && (<><button onClick={() => toggleOrgAdmin(selectedOrg.id, uid, !!isOrgAdmin)} className={`text-xs px-3 py-1 rounded font-medium transition-colors ${isOrgAdmin ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>{isOrgAdmin ? "Demote to Member" : "Make Admin"}</button><button onClick={() => removeUserFromOrg(selectedOrg.id, uid)} className="text-red-500 hover:bg-red-50 p-1 rounded" title="Remove from Organization"><Trash2 size={16} /></button></>)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- DATA TAB --- */}
                    {activeTab === 'data' && (
                        <div className="animate-in slide-in-from-right duration-200 space-y-4 md:space-y-6">
                            {/* Metadata Export */}
                            <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm max-w-3xl">
                                <div className="flex flex-col sm:flex-row items-start gap-4">
                                    <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600 shrink-0 hidden sm:block">
                                        <Download size={32} />
                                    </div>
                                    <div className="flex-1 w-full">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600 shrink-0 sm:hidden">
                                                <Download size={20} />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-900">Export Metadata</h3>
                                        </div>
                                        <p className="text-sm text-slate-600 mt-1 mb-4">
                                            Download CSV of {songData.length} songs.
                                        </p>
                                        <button 
                                            onClick={handleExportCSV}
                                            className="w-full sm:w-auto bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
                                        >
                                            <FileText size={18} /> Download CSV
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Metadata Import */}
                            <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm max-w-3xl">
                                <div className="flex flex-col sm:flex-row items-start gap-4">
                                    <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600 shrink-0 hidden sm:block">
                                        <Upload size={32} />
                                    </div>
                                    <div className="flex-1 w-full">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600 shrink-0 sm:hidden">
                                                <Upload size={20} />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-900">Import Metadata</h3>
                                        </div>
                                        <p className="text-sm text-slate-600 mt-1 mb-4">
                                            Batch update song details via CSV.
                                        </p>
                                        
                                        <input 
                                            type="file" 
                                            accept=".csv"
                                            ref={fileInputRef}
                                            onChange={handleFileUpload}
                                            className="hidden"
                                        />
                                        
                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploading}
                                            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                                        >
                                            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                                            {isUploading ? "Processing..." : "Upload CSV"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- ANALYTICS TAB --- */}
                    {activeTab === 'analytics' && (
                        isLoadingAnalytics ? (
                            <div className="flex justify-center py-12"><Loader2 size={48} className="animate-spin text-indigo-300" /></div>
                        ) : analyticsData && (
                        <div className="animate-in slide-in-from-right duration-200 space-y-6">
                            
                            {/* Time Range Filter */}
                            <div className="flex justify-end mb-2">
                              <div className="bg-white p-1 rounded-lg border border-slate-200 flex shadow-sm">
                                {(['today', 'week', 'month', 'all'] as const).map((range) => (
                                  <button
                                    key={range}
                                    onClick={() => setAnalyticsTimeRange(range)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${analyticsTimeRange === range ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                                  >
                                    {range === 'all' ? 'All Time' : range === 'today' ? 'Today' : `This ${range.charAt(0).toUpperCase() + range.slice(1)}`}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Key Metrics */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><TrendingUp size={20} /></div>
                                        <span className="text-sm font-medium text-slate-500">Total Hits</span>
                                    </div>
                                    <div className="text-2xl font-bold text-slate-900">{analyticsData.hits}</div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Users size={20} /></div>
                                        <span className="text-sm font-medium text-slate-500">Unique Visitors</span>
                                    </div>
                                    <div className="text-2xl font-bold text-slate-900">{analyticsData.uniqueVisitors}</div>
                                </div>
                                {/* We could add more aggregate stats here */}
                            </div>

                            {/* Top Songs Table */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                                    <div className="flex items-center gap-2">
                                        <ListOrdered className="text-indigo-600" size={20} />
                                        <h3 className="font-bold text-slate-800">Top Songs</h3>
                                    </div>
                                    <div className="text-xs text-slate-500">Sorted by Engagement Score</div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-3 font-semibold text-slate-600 w-16">#</th>
                                                <th className="px-6 py-3 font-semibold text-slate-600">Title</th>
                                                <th className="px-6 py-3 font-semibold text-slate-600 text-right">Views</th>
                                                <th className="px-6 py-3 font-semibold text-slate-600 text-right">Plays</th>
                                                <th className="px-6 py-3 font-semibold text-slate-600 text-right">Playlist Adds</th>
                                                <th className="px-6 py-3 font-semibold text-slate-600 text-right">Score</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {analyticsData.topSongs.length === 0 ? (
                                                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">No data for this period</td></tr>
                                            ) : (
                                                analyticsData.topSongs.slice(0, 50).map((song) => (
                                                    <tr key={song.number} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4 font-mono text-slate-500">{song.number}</td>
                                                        <td className="px-6 py-4 font-medium text-slate-900">{song.title}</td>
                                                        <td className="px-6 py-4 text-right text-slate-600">{song.views}</td>
                                                        <td className="px-6 py-4 text-right text-slate-600">{song.plays}</td>
                                                        <td className="px-6 py-4 text-right text-slate-600">{song.saves}</td>
                                                        <td className="px-6 py-4 text-right font-bold text-indigo-600">{song.score}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Top Searches Table */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                                    <div className="flex items-center gap-2">
                                        <Search className="text-indigo-600" size={20} />
                                        <h3 className="font-bold text-slate-800">Top Searches</h3>
                                    </div>
                                    <div className="text-xs text-slate-500">Most frequent queries</div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-3 font-semibold text-slate-600">Search Term / Theme</th>
                                                <th className="px-6 py-3 font-semibold text-slate-600 text-right">Count</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {analyticsData.topSearches.length === 0 ? (
                                                <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-400 italic">No search data for this period</td></tr>
                                            ) : (
                                                analyticsData.topSearches.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4 font-medium text-slate-900">{item.term}</td>
                                                        <td className="px-6 py-4 text-right font-mono text-slate-600">{item.count}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        )
                    )}
                </>
            )}
        </div>

        {/* Toast Notification Container */}
        {toast && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-max max-w-[90%] z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className={`px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                    {toast.type === 'success' ? <Check size={14} strokeWidth={3} /> : <AlertCircle size={14} strokeWidth={3} />}
                    {toast.msg}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
