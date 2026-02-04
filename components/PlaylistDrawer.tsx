
import React, { useState, useEffect } from 'react';
import { Play, Pause, X, GripVertical, Trash2, Infinity, StepForward, PlayCircle, Save, List, Loader2, Folder, ListPlus, Replace, AlertTriangle, Copy, Check, Link, Building2, ArrowLeft, Plus, Database, HardDrive, LogIn, HelpCircle, ShieldAlert, Share2, Lock, Crown, AlertCircle, Link2 } from 'lucide-react';
import { PlaylistItem, PlayMode, SavedPlaylist, Song, Organization } from '../types';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, serverTimestamp, getDocs, updateDoc, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore';
import HelpModal from './HelpModal';
import PlanningCenterSettings from './PlanningCenterSettings';
import { FIRESTORE_RULES, STORAGE_RULES } from '../firebaseRules';

interface PlaylistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: PlaylistItem[];
  currentPlayingId: string | null;
  isPlaying: boolean;
  onReorder: (newPlaylist: PlaylistItem[]) => void;
  onRemove: (uniqueId: string) => void;
  onPlayItem: (item: PlaylistItem) => void;
  onPlayAll: () => void;
  playMode: PlayMode;
  onToggleMode: () => void;
  onClear: () => void;
  user: User | null;
  hymnalData: Song[];
  externalPlaylist?: SavedPlaylist | null;
  onClearExternalPlaylist?: () => void;
  onAuthTrigger: () => void;
  isPremium: boolean; // Pass premium status
  onOpenPremium: () => void; // Pass upsell trigger
}

const PlaylistDrawer: React.FC<PlaylistDrawerProps> = ({
  isOpen,
  onClose,
  playlist,
  currentPlayingId,
  isPlaying,
  onReorder,
  onRemove,
  onPlayItem,
  onPlayAll,
  playMode,
  onToggleMode,
  onClear,
  user,
  hymnalData,
  externalPlaylist,
  onClearExternalPlaylist,
  onAuthTrigger,
  isPremium,
  onOpenPremium
}) => {
  // Queue Drag State
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  // Playlist List Drag State
  const [draggedPlaylistId, setDraggedPlaylistId] = useState<string | null>(null);
  
  const [confirmClear, setConfirmClear] = useState(false);
  
  // State
  const [activeTab, setActiveTab] = useState<'queue' | 'saved' | 'orgs'>('queue');
  
  // Saved Playlists State
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylist[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  
  // Saving State
  const [isSaving, setIsSaving] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedOrgIdForSave, setSelectedOrgIdForSave] = useState<string>('personal');
  const [showSaveInput, setShowSaveInput] = useState(false);
  
  // Error/Clipboard State
  const [permissionError, setPermissionError] = useState(false);
  const [copiedRulesType, setCopiedRulesType] = useState<'firestore' | 'storage' | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null); // Can be playlist ID or Org ID
  
  // Loading Playlist State
  const [pendingPlaylist, setPendingPlaylist] = useState<SavedPlaylist | null>(null);

  // Organization State
  const [myOrgs, setMyOrgs] = useState<Organization[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [viewingOrg, setViewingOrg] = useState<Organization | null>(null);
  const [orgPlaylists, setOrgPlaylists] = useState<SavedPlaylist[]>([]);
  
  // Org Actions State
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isJoiningOrg, setIsJoiningOrg] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Help Modal State
  const [showHelp, setShowHelp] = useState(false);
  
  // Planning Center Settings Modal State
  const [showPCSettings, setShowPCSettings] = useState(false);

  // Notification Toast State
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
      setToast({ msg, type });
      setTimeout(() => setToast(null), 3000);
  };

  const handleCopyRules = (type: 'firestore' | 'storage') => {
    const text = type === 'firestore' ? FIRESTORE_RULES : STORAGE_RULES;
    navigator.clipboard.writeText(text);
    setCopiedRulesType(type);
    setTimeout(() => setCopiedRulesType(null), 2000);
  };

  // Reset state when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmClear(false);
      setShowSaveInput(false);
      setNewPlaylistName('');
      setPendingPlaylist(null);
      setDeleteId(null);
      setCopiedLinkId(null);
      setViewingOrg(null);
      setShowCreateOrg(false);
      setJoinError(null);
      setShowHelp(false);
      setToast(null);
    }
  }, [isOpen]);

  // Handle external playlist loading
  useEffect(() => {
    if (externalPlaylist) {
        setPendingPlaylist(externalPlaylist);
        if (onClearExternalPlaylist) {
            onClearExternalPlaylist();
        }
    }
  }, [externalPlaylist, onClearExternalPlaylist]);

  // Fetch saved playlists (Personal)
  useEffect(() => {
    if (user && isOpen && !permissionError) {
        setIsLoadingSaved(true);
        
        const q = query(
            collection(db, "playlists"), 
            where("userId", "==", user.uid)
        );
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const lists: SavedPlaylist[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (!data.organizationId) {
                    lists.push({ id: doc.id, ...data } as SavedPlaylist);
                }
            });

            // Sort by custom order first, then by creation date
            lists.sort((a, b) => {
                if (a.order !== undefined && b.order !== undefined) {
                    return a.order - b.order;
                }
                const timeA = a.createdAt?.seconds ?? 0;
                const timeB = b.createdAt?.seconds ?? 0;
                return timeB - timeA;
            });

            setSavedPlaylists(lists);
            setIsLoadingSaved(false);
        }, (error) => {
            if (error.code === 'permission-denied') {
                console.warn("Firestore permission denied (Playlists). Showing rules helper.");
                setPermissionError(true);
            } else {
                console.error("Error fetching playlists:", error);
            }
            setIsLoadingSaved(false);
        });

        return () => unsubscribe();
    }
  }, [user, isOpen, permissionError]);

  // Fetch User's Organizations
  useEffect(() => {
      if (user && isOpen && !permissionError) {
          setIsLoadingOrgs(true);
          const q = query(
              collection(db, "organizations"),
              where("memberIds", "array-contains", user.uid)
          );

          const unsubscribe = onSnapshot(q, (snapshot) => {
              const orgs: Organization[] = [];
              snapshot.forEach(doc => {
                  orgs.push({ id: doc.id, ...doc.data() } as Organization);
              });
              setMyOrgs(orgs);
              setIsLoadingOrgs(false);
          }, (err) => {
              if (err.code === 'permission-denied') {
                  console.warn("Firestore permission denied (Orgs). Showing rules helper.");
                  setPermissionError(true);
              } else {
                  console.error("Error fetching orgs:", err);
              }
              setIsLoadingOrgs(false);
          });

          return () => unsubscribe();
      }
  }, [user, isOpen, permissionError]);

  // Fetch Organization Playlists
  useEffect(() => {
      if (user && viewingOrg) {
          const q = query(
              collection(db, "playlists"),
              where("organizationId", "==", viewingOrg.id)
          );

          const unsubscribe = onSnapshot(q, (snapshot) => {
              const lists: SavedPlaylist[] = [];
              snapshot.forEach(doc => {
                  lists.push({ id: doc.id, ...doc.data() } as SavedPlaylist);
              });
              
              // Sort by order, then date
              lists.sort((a, b) => {
                  if (a.order !== undefined && b.order !== undefined) {
                      return a.order - b.order;
                  }
                  return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
              });
              
              setOrgPlaylists(lists);
          }, (err) => {
              console.error("Error fetching org playlists:", err);
              if (err.code === 'permission-denied') setPermissionError(true);
          });

          return () => unsubscribe();
      }
  }, [user, viewingOrg]);


  // --- Organization Logic ---

  const generateUniqueCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
  };

  const handleCreateOrg = async () => {
      if (!user || !newOrgName.trim()) return;
      
      // Gate Org Creation
      if (!isPremium) {
          onOpenPremium();
          return;
      }

      try {
          const code = generateUniqueCode();
          const adminCode = generateUniqueCode(); // Generate admin code
          
          await addDoc(collection(db, "organizations"), {
              name: newOrgName.trim(),
              uniqueCode: code,
              adminCode: adminCode,
              createdBy: user.uid,
              memberIds: [user.uid],
              adminIds: [user.uid], // Creator is default admin
              createdAt: serverTimestamp()
          });
          setNewOrgName('');
          setShowCreateOrg(false);
      } catch (e: any) {
          console.error("Error creating org:", e);
          if (e.code === 'permission-denied') {
              setPermissionError(true);
          } else {
              showToast("Failed to create organization.", "error");
          }
      }
  };

  const handleJoinOrg = async () => {
      if (!user || !joinCode.trim()) return;
      setIsJoiningOrg(true);
      setJoinError(null);

      try {
          const code = joinCode.trim().toUpperCase();
          
          // Check for Member Code match
          const qMember = query(collection(db, "organizations"), where("uniqueCode", "==", code));
          const snapshotMember = await getDocs(qMember);

          // Check for Admin Code match
          const qAdmin = query(collection(db, "organizations"), where("adminCode", "==", code));
          const snapshotAdmin = await getDocs(qAdmin);

          if (snapshotMember.empty && snapshotAdmin.empty) {
              setJoinError("Invalid organization code.");
              setIsJoiningOrg(false);
              return;
          }

          let orgDoc, isAdminJoin;
          
          if (!snapshotAdmin.empty) {
              orgDoc = snapshotAdmin.docs[0];
              isAdminJoin = true;
          } else {
              orgDoc = snapshotMember.docs[0];
              isAdminJoin = false;
          }

          const orgData = orgDoc.data();

          if (orgData.memberIds.includes(user.uid)) {
              // Already a member - check if upgrading to admin
              if (isAdminJoin && !orgData.adminIds?.includes(user.uid)) {
                  await updateDoc(doc(db, "organizations", orgDoc.id), {
                      adminIds: arrayUnion(user.uid)
                  });
                  showToast(`Upgraded to Admin in ${orgData.name}!`, "success");
              } else {
                  setJoinError("You are already a member.");
              }
              setIsJoiningOrg(false);
              return;
          }

          // Prepare update payload
          const updatePayload: any = {
              memberIds: arrayUnion(user.uid)
          };
          
          if (isAdminJoin) {
              updatePayload.adminIds = arrayUnion(user.uid);
          }

          await updateDoc(doc(db, "organizations", orgDoc.id), updatePayload);

          setJoinCode('');
          showToast(`Joined ${orgData.name} successfully${isAdminJoin ? ' as Admin' : ''}!`, "success");
      } catch (e: any) {
          console.error("Error joining org:", e);
          if (e.code === 'permission-denied') {
              setPermissionError(true);
              setJoinError("Permission denied. Check database rules.");
          } else {
              setJoinError("Error joining organization.");
          }
      } finally {
          setIsJoiningOrg(false);
      }
  };

  const handleDeleteOrg = async (orgId: string) => {
      try {
          await deleteDoc(doc(db, "organizations", orgId));
          // Note: Playlists inside this org become orphaned. 
          // A real backend would clean them up, but for client-side simplicity 
          // we rely on the fact they won't be queried anymore.
          setDeleteId(null);
          showToast("Organization deleted.");
      } catch (e: any) {
          console.error("Error deleting org:", e);
          if (e.code === 'permission-denied') {
              showToast("Permission denied. Only the creator can delete this.", "error");
          } else {
              showToast("Failed to delete organization.", "error");
          }
      }
  };

  const handleShareOrg = (orgName: string, code: string, type: 'member' | 'admin') => {
      const subject = encodeURIComponent(
          type === 'admin' 
            ? `Admin Invite: Join "${orgName}" on Psalms & Hymns` 
            : `Join "${orgName}" on Psalms & Hymns`
      );
      
      let text = "";
      if (type === 'admin') {
          text = `I'm inviting you to be an Admin for the group "${orgName}" on the Psalms & Hymns app.\n\n` +
                 `As an Admin, you can add, delete, and reorder playlists for the organization.\n\n` +
                 `1. Open the app at http://classichymns.org\n` +
                 `2. Open the Playlist menu (list icon).\n` +
                 `3. Select the "Orgs" tab.\n` +
                 `4. Enter this Admin Code in the "Join via Code" box:\n\n` +
                 `${code}`;
      } else {
          text = `Join my group "${orgName}" on the Psalms & Hymns app to view our shared playlists.\n\n` +
                 `1. Open the app at http://classichymns.org\n` +
                 `2. Open the Playlist menu (list icon).\n` +
                 `3. Select the "Orgs" tab.\n` +
                 `4. Enter this Code in the "Join via Code" box:\n\n` +
                 `${code}`;
      }

      window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(text)}`;
  };

  // --- Drag and Drop Handlers (Playlists List) ---
  
  const handlePlaylistReorder = async (list: SavedPlaylist[], newOrder: SavedPlaylist[]) => {
      // Optimistic Update handled by parent state setter usually, but here we have local state
      // We update Firestore immediately
      
      // Batch update order fields
      const batch = writeBatch(db);
      
      newOrder.forEach((pl, index) => {
          const ref = doc(db, "playlists", pl.id);
          batch.update(ref, { order: index });
      });

      try {
          await batch.commit();
      } catch (e) {
          console.error("Error reordering playlists:", e);
          // Revert state handled by snapshot listener automatically if write fails
      }
  };

  const handlePlaylistDragStart = (id: string) => {
      setDraggedPlaylistId(id);
  };

  const handlePlaylistDragOver = (e: React.DragEvent, targetId: string, listType: 'saved' | 'org') => {
      e.preventDefault();
      if (!draggedPlaylistId || draggedPlaylistId === targetId) return;

      const currentList = listType === 'saved' ? savedPlaylists : orgPlaylists;
      const fromIndex = currentList.findIndex(p => p.id === draggedPlaylistId);
      const toIndex = currentList.findIndex(p => p.id === targetId);

      if (fromIndex === -1 || toIndex === -1) return;

      const newList = [...currentList];
      const [movedItem] = newList.splice(fromIndex, 1);
      newList.splice(toIndex, 0, movedItem);

      if (listType === 'saved') {
          setSavedPlaylists(newList); // Optimistic UI
      } else {
          setOrgPlaylists(newList); // Optimistic UI
      }
  };

  const handlePlaylistDrop = (listType: 'saved' | 'org') => {
      if (!draggedPlaylistId) return;
      
      const list = listType === 'saved' ? savedPlaylists : orgPlaylists;
      handlePlaylistReorder(list, list); // Save the current state order to DB
      setDraggedPlaylistId(null);
  };


  // --- Drag and Drop Handlers (Queue Songs) ---
  const handleDragStart = (index: number) => {
    setDraggedItemIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    const newPlaylist = [...playlist];
    const item = newPlaylist[draggedItemIndex];
    newPlaylist.splice(draggedItemIndex, 1);
    newPlaylist.splice(index, 0, item);
    
    onReorder(newPlaylist);
    setDraggedItemIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };

  // --- Touch Handlers (Mobile - Queue) ---
  const handleTouchStart = (index: number) => {
    setDraggedItemIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    if (draggedItemIndex === null) return;

    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!target) return;

    const row = target.closest('[data-playlist-item]');
    if (!row) return;

    const targetIndex = parseInt(row.getAttribute('data-index') || '-1', 10);

    if (targetIndex !== -1 && targetIndex !== draggedItemIndex) {
        const newPlaylist = [...playlist];
        const item = newPlaylist[draggedItemIndex];
        newPlaylist.splice(draggedItemIndex, 1);
        newPlaylist.splice(targetIndex, 0, item);
        
        onReorder(newPlaylist);
        setDraggedItemIndex(targetIndex);
    }
  };

  const handleTouchEnd = () => {
    setDraggedItemIndex(null);
  };

  const handleSavePlaylist = async () => {
      if (!user || !newPlaylistName.trim() || playlist.length === 0) return;
      
      // --- LIMIT CHECK FOR FREE USERS ---
      // Only check if saving a Personal Playlist
      // We check >= 3 because we want to prevent the 4th one from being created
      if (selectedOrgIdForSave === 'personal' && !isPremium && savedPlaylists.length >= 3) {
          onOpenPremium();
          return;
      }

      setIsSaving(true);
      
      try {
          const itemsToSave = playlist.map(item => ({
              songNumber: item.song.number,
              label: item.label,
              url: item.url
          }));

          const payload: any = {
              userId: user.uid,
              name: newPlaylistName.trim(),
              items: itemsToSave,
              createdAt: serverTimestamp(),
              organizationId: selectedOrgIdForSave === 'personal' ? null : selectedOrgIdForSave,
              order: 9999 // Push to end initially
          };

          await addDoc(collection(db, "playlists"), payload);

          setNewPlaylistName('');
          setShowSaveInput(false);
          
          if (selectedOrgIdForSave !== 'personal') {
              setActiveTab('orgs');
              const targetOrg = myOrgs.find(o => o.id === selectedOrgIdForSave);
              if (targetOrg) setViewingOrg(targetOrg);
          } else {
              setActiveTab('saved'); 
          }
          
          showToast("Playlist saved!");

      } catch (e: any) {
          console.error("Error saving playlist: ", e);
          if (e.code === 'permission-denied') {
              setPermissionError(true);
          } else {
              showToast(`Failed to save playlist: ${e.message || "Unknown error"}`, "error");
          }
      } finally {
          setIsSaving(false);
      }
  };

  const handlePlaylistClick = (saved: SavedPlaylist) => {
      if (playlist.length > 0) {
          setPendingPlaylist(saved);
      } else {
          processLoadPlaylist(saved, 'replace');
      }
  };

  const processLoadPlaylist = (saved: SavedPlaylist, action: 'replace' | 'append') => {
      const newItems: PlaylistItem[] = [];
      
      saved.items.forEach(item => {
          const song = hymnalData.find(s => s.number === item.songNumber);
          if (song) {
              newItems.push({
                  uniqueId: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                  song: song,
                  url: item.url,
                  label: item.label
              });
          }
      });

      if (action === 'replace') {
          onReorder(newItems);
      } else {
          onReorder([...playlist, ...newItems]);
      }

      setPendingPlaylist(null);
      setActiveTab('queue');
  };

  const handleDeleteTrigger = (id: string) => {
      if (deleteId === id) {
          // Determine if it's an org or playlist based on active tab/view
          if (activeTab === 'orgs' && !viewingOrg) {
              handleDeleteOrg(id);
          } else {
              handleDeletePlaylist(id);
          }
      } else {
          setDeleteId(id);
          setTimeout(() => {
              setDeleteId(prev => prev === id ? null : prev);
          }, 3000);
      }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
      try {
          await deleteDoc(doc(db, "playlists", playlistId));
          setDeleteId(null);
          showToast("Playlist deleted.");
      } catch (e: any) {
          console.error("Error deleting playlist: ", e);
          if (e.code === 'permission-denied') {
              setPermissionError(true);
          } else {
              showToast("Failed to delete playlist. Check permissions.", "error");
          }
      }
  };

  const generateShareUrl = (playlistId: string) => {
      const url = new URL(window.location.origin);
      url.pathname = '/'; 
      url.searchParams.set('id', playlistId);
      return url.toString();
  };

  const handleCopyLink = (playlistId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const url = generateShareUrl(playlistId);
      
      navigator.clipboard.writeText(url).then(() => {
          setCopiedLinkId(playlistId);
          setTimeout(() => setCopiedLinkId(null), 2000);
          showToast("Link copied to clipboard!");
      }).catch((err) => {
          console.error("Failed to copy: ", err);
      });
  };

  const handleCopyOrgCode = (code: string, type: 'member' | 'admin') => {
      navigator.clipboard.writeText(code).then(() => {
          if (type === 'admin') {
              setCopiedRulesType('storage'); // Use storage state for 2nd button feedback
          } else {
              setCopiedRulesType('firestore'); 
          }
          setTimeout(() => setCopiedRulesType(null), 2000);
          showToast("Code copied!");
      });
  }

  // Filter orgs for saving - show only ones where user is Admin or Creator
  const managedOrgs = myOrgs.filter(org => 
      org.createdBy === user?.uid || (org.adminIds && org.adminIds.includes(user?.uid || ''))
  );

  // Render a draggable playlist item
  const renderPlaylistItem = (pl: SavedPlaylist, listType: 'saved' | 'org') => {
      const isOwner = pl.userId === user?.uid;
      const isOrgAdmin = viewingOrg && (
          viewingOrg.createdBy === user?.uid || 
          (viewingOrg.adminIds && viewingOrg.adminIds.includes(user?.uid || ''))
      );
      
      // Allow drag/delete if owner OR if it's an org playlist and user is org admin
      const canManage = isOwner || isOrgAdmin;

      return (
        <div 
            key={pl.id}
            draggable={canManage}
            onDragStart={() => handlePlaylistDragStart(pl.id)}
            onDragOver={(e) => handlePlaylistDragOver(e, pl.id, listType)}
            onDragEnd={() => handlePlaylistDrop(listType)}
            className={`bg-white p-3 rounded-lg border border-slate-200 shadow-sm transition-colors flex items-center justify-between group ${draggedPlaylistId === pl.id ? 'opacity-50 bg-slate-50' : 'hover:border-indigo-200'}`}
        >
            {/* Drag Handle */}
            {canManage && (
                <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 mr-2">
                    <GripVertical size={16} />
                </div>
            )}

            <div 
                className="flex-1 cursor-pointer min-w-0"
                onClick={() => handlePlaylistClick(pl)}
            >
                <h3 className="font-semibold text-slate-800 text-sm truncate">{pl.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{pl.items.length} songs</p>
            </div>
            <div className="flex items-center gap-1">
                <button
                    onClick={(e) => handleCopyLink(pl.id, e)}
                    className={`p-2 rounded-full transition-colors ${
                        copiedLinkId === pl.id
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                    }`}
                    title="Copy Link"
                >
                    {copiedLinkId === pl.id ? <Check size={16} /> : <Link size={16} />}
                </button>

                <button
                    onClick={() => handlePlaylistClick(pl)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full"
                    title="Load"
                >
                    <Play size={16} />
                </button>
                
                {canManage && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTrigger(pl.id);
                        }}
                        className={`p-2 rounded-full transition-all ${
                            deleteId === pl.id 
                            ? 'bg-red-600 text-white shadow-sm' 
                            : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
                        }`}
                        title="Delete"
                    >
                        {deleteId === pl.id ? <Check size={16} /> : <Trash2 size={16} />}
                    </button>
                )}
            </div>
        </div>
      );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-white z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800">Playlist</h2>
                {isPremium && (
                    <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 border border-amber-200">
                        <Crown size={10} fill="currentColor" /> Premium
                    </span>
                )}
            </div>
            <div className="flex items-center">
                {user && (
                    <button 
                        onClick={() => setShowHelp(true)}
                        className="p-2 hover:bg-slate-100 rounded-full text-indigo-600 mr-1"
                        title="Help & Instructions"
                    >
                        <HelpCircle size={20} />
                    </button>
                )}
                <button 
                    onClick={onClose}
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
                >
                    <X size={20} />
                </button>
            </div>
          </div>

          {!user && (
            <button
              onClick={onAuthTrigger}
              className="w-full mb-3 bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <LogIn size={14} /> Log In / Sign Up
            </button>
          )}

          {/* Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('queue')}
                className={`flex-1 py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1 ${
                    activeTab === 'queue' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                  <List size={14} /> Queue
              </button>
              <button
                onClick={() => setActiveTab('saved')}
                className={`flex-1 py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1 ${
                    activeTab === 'saved' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                  <Folder size={14} /> My Saved
              </button>
              <button
                onClick={() => setActiveTab('orgs')}
                className={`flex-1 py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1 ${
                    activeTab === 'orgs' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                  <Building2 size={14} /> Orgs
              </button>
          </div>
        </div>

        {/* Load Confirmation Overlay */}
        {pendingPlaylist && (
            <div className="absolute inset-0 z-50 bg-white/95 flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
                <div className="text-center mb-6">
                    <Folder size={48} className="text-indigo-200 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-slate-800 mb-1">Load Playlist</h3>
                    <p className="text-slate-600 font-medium">"{pendingPlaylist.name}"</p>
                    <p className="text-sm text-slate-500 mt-2">How would you like to load these {pendingPlaylist.items.length} songs?</p>
                </div>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button
                        onClick={() => processLoadPlaylist(pendingPlaylist, 'replace')}
                        className="w-full bg-indigo-600 text-white py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Replace size={18} /> Replace Queue
                    </button>
                    <button
                        onClick={() => processLoadPlaylist(pendingPlaylist, 'append')}
                        className="w-full bg-white text-slate-700 border border-slate-200 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                    >
                        <ListPlus size={18} /> Add to End
                    </button>
                    <button
                        onClick={() => setPendingPlaylist(null)}
                        className="w-full text-slate-400 py-3 px-4 rounded-xl font-medium hover:text-slate-600 transition-colors text-sm"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        )}

        {activeTab === 'queue' && (
            <>
                {/* Queue Controls */}
                <div className="p-3 bg-slate-50 border-b border-slate-100 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onPlayAll}
                            disabled={playlist.length === 0}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <PlayCircle size={16} /> Play All
                        </button>
                        
                        <button
                            onClick={onToggleMode}
                            className={`py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 border transition-colors ${
                            playMode === 'continue' 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                            title={playMode === 'continue' ? "Auto-play next song" : "Stop after each song"}
                        >
                            {playMode === 'continue' ? <Infinity size={16} /> : <StepForward size={16} />}
                        </button>

                        <button 
                            onClick={() => {
                                if (playlist.length > 0) {
                                    if (confirmClear) {
                                        onClear();
                                        setConfirmClear(false);
                                    } else {
                                        setConfirmClear(true);
                                        setTimeout(() => setConfirmClear(false), 3000);
                                    }
                                }
                            }}
                            disabled={playlist.length === 0}
                            className={`py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center border transition-colors ${
                                confirmClear 
                                    ? 'bg-red-600 text-white border-red-600' 
                                    : 'bg-white border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200'
                            }`}
                            title="Clear Playlist"
                        >
                            {confirmClear ? <Check size={16} /> : <Trash2 size={16} />}
                        </button>
                    </div>

                    {/* Save Input Area */}
                    {showSaveInput ? (
                        <div className="mt-2 animate-in slide-in-from-top-2 duration-200 bg-white p-2 rounded-lg border border-indigo-100 shadow-sm">
                            <div className="flex flex-col gap-2">
                                <input 
                                    type="text" 
                                    value={newPlaylistName}
                                    onChange={(e) => setNewPlaylistName(e.target.value)}
                                    placeholder="Playlist Name"
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    autoFocus
                                />
                                
                                <select 
                                    value={selectedOrgIdForSave}
                                    onChange={(e) => setSelectedOrgIdForSave(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900"
                                >
                                    <option value="personal">Save as Personal Playlist</option>
                                    {managedOrgs.length > 0 && (
                                        <optgroup label="Or Save to Organization">
                                            {managedOrgs.map(org => (
                                                <option key={org.id} value={org.id}>{org.name}</option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>

                                <div className="flex gap-2 mt-1">
                                    <button 
                                        type="button"
                                        onClick={handleSavePlaylist}
                                        disabled={isSaving || !newPlaylistName.trim()}
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg disabled:opacity-50 text-sm font-medium"
                                    >
                                        {isSaving ? <Loader2 size={18} className="animate-spin mx-auto" /> : "Save Playlist"}
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setShowSaveInput(false)}
                                        className="text-slate-500 hover:bg-slate-100 px-3 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        playlist.length > 0 && user && (
                            <button
                                onClick={() => setShowSaveInput(true)}
                                className="w-full text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center justify-center gap-1 py-1 mt-1 hover:bg-indigo-50 rounded transition-colors"
                            >
                                <Save size={12} /> Save Queue as Playlist
                            </button>
                        )
                    )}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {playlist.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                    <PlayCircle size={48} className="mb-4 opacity-20" />
                    <p className="text-sm font-medium">Queue is empty</p>
                    <p className="text-xs mt-2">Add songs from the audio tab of any hymn.</p>
                    </div>
                ) : (
                    playlist.map((item, index) => {
                    const isPlayingItem = currentPlayingId === item.uniqueId;
                    
                    return (
                        <div
                        key={item.uniqueId}
                        data-playlist-item
                        data-index={index}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`group flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                            isPlayingItem 
                            ? 'bg-indigo-50 border-indigo-100' 
                            : 'bg-white border-transparent hover:border-slate-200 hover:bg-slate-50'
                        } ${draggedItemIndex === index ? 'opacity-50' : ''}`}
                        >
                        {/* Drag Handle */}
                        <div 
                            className="cursor-grab active:cursor-grabbing p-2 text-slate-300 hover:text-slate-500 touch-none"
                            onTouchStart={() => handleTouchStart(index)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <GripVertical size={16} />
                        </div>

                        {/* Content */}
                        <div 
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => onPlayItem(item)}
                        >
                            <div className={`text-sm font-semibold truncate ${isPlayingItem ? 'text-indigo-700' : 'text-slate-800'}`}>
                            {item.song.number}. {item.song.title}
                            </div>
                            <div className="text-xs text-slate-500">
                            {item.label} • {item.song.tune}
                            </div>
                        </div>

                        {/* Playing Indicator / Delete */}
                        <div className="flex items-center">
                            {isPlayingItem && isPlaying && (
                            <div className="mr-2">
                                <span className="flex space-x-1">
                                <span className="w-1 h-3 bg-indigo-500 rounded-full animate-pulse"></span>
                                <span className="w-1 h-3 bg-indigo-500 rounded-full animate-pulse delay-75"></span>
                                <span className="w-1 h-3 bg-indigo-500 rounded-full animate-pulse delay-150"></span>
                                </span>
                            </div>
                            )}
                            
                            <button
                            onClick={() => onRemove(item.uniqueId)}
                            className="p-2 text-slate-300 hover:text-red-500 rounded-full hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                            <Trash2 size={16} />
                            </button>
                        </div>
                        </div>
                    );
                    })
                )}
                </div>
            </>
        )}

        {/* --- MY SAVED PLAYLISTS --- */}
        {activeTab === 'saved' && (
            <div className="flex-1 flex flex-col bg-slate-50">
                {permissionError ? (
                    <div className="h-full flex flex-col items-center justify-start p-4 overflow-y-auto">
                        {/* ... Permission Error View ... */}
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 max-w-xs mx-auto space-y-4">
                            <div className="text-center">
                                <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
                                <h3 className="font-bold text-red-700 mb-1">Database & Storage Setup</h3>
                                <p className="text-xs text-red-600 leading-relaxed">
                                    You need to update <strong>both</strong> sections in your Firebase Console.
                                </p>
                            </div>
                            <button 
                                onClick={() => handleCopyRules('firestore')}
                                className="w-full bg-white border border-red-200 text-red-600 text-xs font-bold py-2 rounded hover:bg-red-50"
                            >
                                Copy Rules
                            </button>
                        </div>
                    </div>
                ) : !user ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                        <Folder size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">Log in to access saved playlists</p>
                        <p className="text-xs mt-2">Create an account to save your favorite queues.</p>
                    </div>
                ) : isLoadingSaved ? (
                    <div className="h-full flex items-center justify-center text-slate-400">
                        <Loader2 size={32} className="animate-spin opacity-50" />
                    </div>
                ) : (
                    <>
                        {/* Free limit notice */}
                        {!isPremium && savedPlaylists.length >= 3 && (
                            <div 
                                onClick={onOpenPremium}
                                className="mx-2 mt-2 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100 cursor-pointer hover:border-indigo-200 transition-colors"
                            >
                                <div className="flex items-center gap-2 text-indigo-800 font-bold text-xs mb-1">
                                    <Lock size={12} /> Free Limit Reached (3/3)
                                </div>
                                <p className="text-[10px] text-slate-600">
                                    Upgrade to Premium for unlimited playlists.
                                </p>
                            </div>
                        )}

                        {savedPlaylists.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                                <Folder size={48} className="mb-4 opacity-20" />
                                <p className="text-sm font-medium">No personal playlists</p>
                                <p className="text-xs mt-2">Go to the Queue tab and click "Save" to create one.</p>
                            </div>
                        ) : (
                            <div className="space-y-2 p-2 overflow-y-auto">
                                {savedPlaylists.map((pl) => renderPlaylistItem(pl, 'saved'))}
                            </div>
                        )}
                    </>
                )}
            </div>
        )}

        {/* --- ORGANIZATIONS --- */}
        {activeTab === 'orgs' && (
            <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
                {!user ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                        <Building2 size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">Log in to use Organizations</p>
                        <p className="text-xs mt-2">Share playlists with groups.</p>
                    </div>
                ) : permissionError ? (
                    <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 max-w-xs">
                            <AlertTriangle size={32} className="text-red-500 mx-auto mb-3" />
                            <h3 className="font-bold text-red-700 mb-1">Permission Error</h3>
                            <button onClick={() => handleCopyRules('firestore')} className="text-xs text-red-600 hover:underline">Copy Rules</button>
                        </div>
                    </div>
                ) : viewingOrg ? (
                    // VIEWING A SPECIFIC ORGANIZATION
                    <div className="flex flex-col h-full">
                        <div className="bg-white p-4 border-b border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <button 
                                    onClick={() => setViewingOrg(null)}
                                    className="p-1 -ml-1 hover:bg-slate-100 rounded-full text-slate-500"
                                >
                                    <ArrowLeft size={20} />
                                </button>
                                <h3 className="font-bold text-slate-800 text-lg">{viewingOrg.name}</h3>
                            </div>
                            
                            {/* Share Codes Display */}
                            <div className="space-y-2">
                                {/* Member Code */}
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-indigo-100 p-2 rounded-md text-indigo-600">
                                            <Building2 size={16} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Member Code</p>
                                            <p className="text-base font-mono font-bold text-slate-800 tracking-widest">{viewingOrg.uniqueCode}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => handleShareOrg(viewingOrg.name, viewingOrg.uniqueCode, 'member')}
                                            className="text-slate-400 p-2 hover:bg-slate-100 rounded-full transition-colors"
                                            title="Share Join Instructions"
                                        >
                                            <Share2 size={16} />
                                        </button>
                                        <button 
                                            onClick={() => handleCopyOrgCode(viewingOrg.uniqueCode, 'member')}
                                            className="text-indigo-600 p-2 hover:bg-indigo-50 rounded-full transition-colors"
                                            title="Copy Member Code"
                                        >
                                            {copiedRulesType === 'firestore' ? <Check size={16} /> : <Copy size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Admin Code - Only visible to Creator */}
                                {viewingOrg.createdBy === user.uid && viewingOrg.adminCode && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-amber-100 p-2 rounded-md text-amber-600">
                                                <ShieldAlert size={16} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Admin Code</p>
                                                <p className="text-base font-mono font-bold text-amber-800 tracking-widest">{viewingOrg.adminCode}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => handleShareOrg(viewingOrg.name, viewingOrg.adminCode!, 'admin')}
                                                className="text-amber-600/60 p-2 hover:bg-amber-100 rounded-full transition-colors"
                                                title="Share Admin Instructions"
                                            >
                                                <Share2 size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleCopyOrgCode(viewingOrg.adminCode!, 'admin')}
                                                className="text-amber-600 p-2 hover:bg-amber-100 rounded-full transition-colors"
                                                title="Copy Admin Code"
                                            >
                                                {copiedRulesType === 'storage' ? <Check size={16} /> : <Copy size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex-1 p-2 overflow-y-auto space-y-2">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 mt-2 mb-1">Org Playlists</div>
                            {orgPlaylists.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    No playlists shared yet.
                                    <br />
                                    <span className="text-xs opacity-70">Save a playlist and select "{viewingOrg.name}".</span>
                                </div>
                            ) : (
                                orgPlaylists.map((pl) => renderPlaylistItem(pl, 'org'))
                            )}
                        </div>
                    </div>
                ) : (
                    // LIST OF ORGANIZATIONS
                    <div className="p-3 space-y-4">
                        {/* Join/Create Actions */}
                        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 space-y-3">
                            {showCreateOrg ? (
                                <div className="animate-in slide-in-from-top-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-slate-700 uppercase">Create Organization</span>
                                        <button onClick={() => setShowCreateOrg(false)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
                                    </div>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text"
                                            value={newOrgName}
                                            onChange={(e) => setNewOrgName(e.target.value)}
                                            placeholder="Org Name (e.g. Choir)"
                                            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                            autoFocus
                                        />
                                        <button 
                                            onClick={handleCreateOrg}
                                            disabled={!newOrgName.trim()}
                                            className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                                        >
                                            Create
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* Join Input */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Join via Code</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text"
                                                value={joinCode}
                                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                                placeholder="ABC123"
                                                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-mono placeholder:normal-case placeholder:font-sans"
                                                maxLength={6}
                                            />
                                            <button 
                                                onClick={handleJoinOrg}
                                                disabled={isJoiningOrg || joinCode.length < 6}
                                                className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                                            >
                                                {isJoiningOrg ? <Loader2 size={16} className="animate-spin"/> : "Join"}
                                            </button>
                                        </div>
                                        {joinError && <p className="text-xs text-red-500 mt-1">{joinError}</p>}
                                    </div>
                                    
                                    <div className="relative flex items-center py-1">
                                        <div className="flex-grow border-t border-slate-100"></div>
                                        <span className="flex-shrink-0 mx-2 text-slate-300 text-[10px] uppercase font-bold">Or</span>
                                        <div className="flex-grow border-t border-slate-100"></div>
                                    </div>

                                    <button 
                                        onClick={() => isPremium ? setShowCreateOrg(true) : onOpenPremium()}
                                        className="w-full py-2 border border-dashed border-slate-300 text-slate-500 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-300 transition-all flex items-center justify-center gap-2"
                                    >
                                        {isPremium ? <Plus size={16} /> : <Lock size={16} />}
                                        Create New Org
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Planning Center Settings Button (Premium Feature) */}
                        {isPremium && (
                            <button
                                onClick={() => setShowPCSettings(true)}
                                className="w-full text-slate-500 py-2 px-4 rounded-lg font-medium hover:bg-slate-100 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2 text-xs border border-slate-200"
                            >
                                <Link2 size={14} />
                                Planning Center Sync
                            </button>
                        )}

                        {/* My Orgs List */}
                        <div className="space-y-2">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">My Organizations</div>
                            {isLoadingOrgs ? (
                                <div className="flex justify-center py-4"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
                            ) : myOrgs.length === 0 ? (
                                <div className="text-center py-4 text-slate-400 text-sm italic">
                                    You haven't joined any organizations yet.
                                </div>
                            ) : (
                                myOrgs.map(org => {
                                    const isAdmin = org.createdBy === user.uid || (org.adminIds && org.adminIds.includes(user.uid));
                                    return (
                                        <div 
                                            key={org.id}
                                            onClick={() => setViewingOrg(org)}
                                            className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                                        >
                                            <div>
                                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                                    {org.name}
                                                    {isAdmin && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase">Admin</span>}
                                                </h3>
                                                <p className="text-xs text-slate-500">{org.memberIds.length} members</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {org.createdBy === user.uid && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteTrigger(org.id);
                                                        }}
                                                        className={`p-2 rounded-full transition-all ${
                                                            deleteId === org.id 
                                                            ? 'bg-red-600 text-white shadow-sm' 
                                                            : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
                                                        }`}
                                                        title="Delete Organization"
                                                    >
                                                        {deleteId === org.id ? <Check size={16} /> : <Trash2 size={16} />}
                                                    </button>
                                                )}
                                                <div className="bg-slate-50 p-2 rounded-full text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors">
                                                    <ArrowLeft size={16} className="rotate-180" />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        )}
        
        <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
        
        <PlanningCenterSettings
          isOpen={showPCSettings}
          onClose={() => setShowPCSettings(false)}
          user={user!}
          myOrgs={myOrgs}
          isPremium={isPremium}
          onOpenPremium={onOpenPremium}
        />

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

export default PlaylistDrawer;
