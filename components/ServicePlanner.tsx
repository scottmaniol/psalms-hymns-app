import React, { useState, useMemo, useEffect } from 'react';
import { X, Calendar, Plus, Loader2, Trash2, HelpCircle, ChevronLeft, Settings, Eye, Edit3 } from 'lucide-react';
import { Organization, Song, ServiceTemplate } from '../types';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, Timestamp, query, where, onSnapshot, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Service } from '../types';
import { createEmptyService } from '../utils/servicePlannerUtils';
import ServiceEditor from './ServiceEditor';
import ServiceViewer from './ServiceViewer';
import SongDetailViewer from './SongDetailViewer';
import ServicePlannerHelp from './ServicePlannerHelp';
import TemplateManager from './TemplateManager';
import { createDefaultTemplate } from '../utils/templateUtils';

interface ServicePlannerProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  myOrgs: Organization[];
  isPremium: boolean;
  onOpenPremium: () => void;
  hymnalData: Song[];
  onSongSelect?: (song: Song) => void;
  // Audio player props
  playerState?: {
    currentUrl: string;
    isPlaying: boolean;
    progress: number;
    hasError: boolean;
    settings: {
      speed: number;
      transpose: number;
    };
  };
  onPlayTrack?: (url: string, label: string, song: Song) => void;
  onTogglePlay?: () => void;
  onRestartTrack?: () => void;
  onAddToPlaylist?: (song: Song, url: string, label: string) => void;
  onSpeedChange?: (speed: number) => void;
  onTransposeChange?: (transpose: number) => void;
  vocalAvailability?: { [key: string]: boolean };
}

const ServicePlanner: React.FC<ServicePlannerProps> = ({
  isOpen,
  onClose,
  user,
  myOrgs,
  isPremium,
  onOpenPremium,
  hymnalData,
  onSongSelect,
  playerState,
  onPlayTrack,
  onTogglePlay,
  onRestartTrack,
  onAddToPlaylist,
  onSpeedChange,
  onTransposeChange,
  vocalAvailability
}) => {
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [services, setServices] = useState<Service[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [viewingService, setViewingService] = useState<Service | null>(null);
  const [viewingHymnFromService, setViewingHymnFromService] = useState<{service: Service, song: Song} | null>(null);
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);

  // Filter to only organizations where user is admin
  const adminOrgs = useMemo(() => {
    if (!user) return [];
    return myOrgs.filter(org => 
      org.createdBy === user.uid || 
      (org.adminIds && org.adminIds.includes(user.uid))
    );
  }, [myOrgs, user]);

  // Check if current user is admin of selected org
  const isOrgAdmin = useMemo(() => {
    if (!user || !selectedOrg) return false;
    const org = myOrgs.find(o => o.id === selectedOrg);
    if (!org) return false;
    return org.createdBy === user.uid || (org.adminIds && org.adminIds.includes(user.uid));
  }, [user, selectedOrg, myOrgs]);

  // Fetch services for selected org
  useEffect(() => {
    if (!selectedOrg || !user) {
      setServices([]);
      return;
    }

    const q = query(
      collection(db, 'services'),
      where('orgId', '==', selectedOrg),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const servicesList: Service[] = [];
      snapshot.forEach(doc => {
        servicesList.push({ id: doc.id, ...doc.data() } as Service);
      });
      setServices(servicesList);
    }, (err) => {
      console.error('Error fetching services:', err);
    });

    return () => unsubscribe();
  }, [selectedOrg, user]);

  // Fetch templates for selected org
  useEffect(() => {
    if (!selectedOrg || !user) {
      setTemplates([]);
      return;
    }

    const q = query(
      collection(db, 'serviceTemplates'),
      where('orgId', '==', selectedOrg),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const templatesList: ServiceTemplate[] = [];
      snapshot.forEach(doc => {
        templatesList.push({ id: doc.id, ...doc.data() } as ServiceTemplate);
      });
      setTemplates(templatesList);
    }, (err) => {
      console.error('Error fetching templates:', err);
    });

    return () => unsubscribe();
  }, [selectedOrg, user]);

  // Create new service
  const handleCreateService = async () => {
    if (!user || !selectedOrg) return;
    
    setIsCreating(true);
    try {
      const newService = createEmptyService(user.uid, selectedOrg);
      
      // Find default template (or first template) to seed sections
      const defaultTemplate = templates.find(t => t.isDefault) || templates[0];
      let initialSections = undefined;
      let initialTemplateId = undefined;
      
      if (defaultTemplate) {
        // Give the new service its own copy of template sections
        initialSections = defaultTemplate.sections.map((section, idx) => ({
          ...section,
          id: section.id || `section_${Date.now()}_${idx}`,
          order: section.order ?? idx
        }));
        initialTemplateId = defaultTemplate.id;
      }
      
      // Create the service first
      const serviceDocRef = await addDoc(collection(db, 'services'), {
        ...newService,
        ...(initialSections ? { sections: initialSections } : {}),
        ...(initialTemplateId ? { templateId: initialTemplateId } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Auto-create linked playlist
      const playlistName = `${newService.title}`;
      const playlistDocRef = await addDoc(collection(db, 'playlists'), {
        userId: user.uid,
        name: playlistName,
        items: [], // Empty initially - will sync from service
        organizationId: selectedOrg,
        createdAt: serverTimestamp()
      });
      
      // Link them together
      await updateDoc(serviceDocRef, { playlistId: playlistDocRef.id });
      
    } catch (err) {
      console.error('Error creating service:', err);
      alert('Failed to create service. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Save service updates
  const handleSaveService = async (updatedService: Partial<Service>) => {
    if (!selectedService) return;
    
    // Only update specific fields to avoid Firestore serialization issues
    // Convert empty strings to null or omit undefined fields
    const updateData: any = {
      updatedAt: serverTimestamp()
    };
    
    if (updatedService.title !== undefined) {
      updateData.title = updatedService.title || '';
    }
    if (updatedService.date !== undefined) {
      updateData.date = updatedService.date || '';
    }
    if (updatedService.time !== undefined) {
      updateData.time = updatedService.time || '';
    }
    if (updatedService.notes !== undefined) {
      updateData.notes = updatedService.notes || '';
    }
    if (updatedService.elements !== undefined) {
      updateData.elements = updatedService.elements;
    }
    if (updatedService.templateId !== undefined) {
      updateData.templateId = updatedService.templateId;
    }
    // Save custom sections
    if (updatedService.sections !== undefined) {
      updateData.sections = updatedService.sections;
    }
    // Save showDurations preference
    if (updatedService.showDurations !== undefined) {
      updateData.showDurations = updatedService.showDurations;
    }
    
    try {
      const serviceRef = doc(db, 'services', selectedService.id!);
      await updateDoc(serviceRef, updateData);
      // Don't close editor - user must explicitly click X to close
    } catch (err: any) {
      console.error('Error updating service:', err);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);
      console.error('Attempted update with data:', JSON.stringify(updateData, null, 2));
      console.error('Service ID:', selectedService.id);
      throw err; // Re-throw so editor can handle it
    }
  };

  // Delete service
  const handleDeleteService = async (serviceId: string, serviceTitle: string, playlistId: string | undefined, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the service
    
    if (!confirm(`Are you sure you want to delete "${serviceTitle}"? This cannot be undone.`)) {
      return;
    }
    
    try {
      // Delete the service
      await deleteDoc(doc(db, 'services', serviceId));
      
      // Delete the linked playlist if it exists
      if (playlistId) {
        await deleteDoc(doc(db, 'playlists', playlistId));
      }
    } catch (err) {
      console.error('Error deleting service:', err);
      alert('Failed to delete service. Please try again.');
    }
  };

  // Create organization
  const handleCreateOrg = async () => {
    if (!user || !newOrgName.trim()) {
      alert('Please enter an organization name');
      return;
    }

    setIsCreatingOrg(true);
    try {
      const uniqueCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const adminCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const newOrg = {
        name: newOrgName.trim(),
        uniqueCode,
        adminCode,
        createdBy: user.uid,
        memberIds: [user.uid],
        adminIds: [user.uid],
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'organizations'), newOrg);
      
      // Auto-select the new org
      setSelectedOrg(docRef.id);
      
      // Close modal and reset
      setShowCreateOrg(false);
      setNewOrgName('');
      
      alert(`✅ Organization "${newOrgName}" created successfully!\n\nYou are the admin and can now create services.`);
    } catch (err) {
      console.error('Error creating organization:', err);
      alert('Failed to create organization. Please try again.');
    } finally {
      setIsCreatingOrg(false);
    }
  };

  if (!isOpen) return null;

  // Premium gate - full page version
  if (!isPremium) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="p-4 bg-white border-b border-slate-200 flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-600"
          >
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-xl font-bold text-slate-800">Service Planner</h2>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center border border-slate-200">
            <div className="mb-6">
              <Calendar size={64} className="mx-auto text-indigo-500 mb-4" />
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Service Planner</h2>
              <p className="text-slate-600">
                The Service Planner is a premium feature that allows you to plan worship services
                with liturgical structure, song integration, and team collaboration.
              </p>
            </div>
            
            <button
              onClick={() => {
                onOpenPremium();
                onClose();
              }}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-lg font-bold transition-colors mb-3"
            >
              Upgrade to Premium
            </button>
            
            <button
              onClick={onClose}
              className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header with Back Arrow */}
      <div className="p-4 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
            title="Back"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <Calendar size={28} className="text-indigo-600" />
            <h2 className="text-2xl font-bold text-slate-800">Service Planner</h2>
          </div>
          {selectedOrg && user && (
            <button
              onClick={() => setShowTemplateManager(true)}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
              title="Manage Templates"
            >
              <Settings size={18} />
              Templates
            </button>
          )}
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 hover:bg-indigo-100 rounded-full transition-colors text-indigo-600"
            title="Help"
          >
            <HelpCircle size={24} />
          </button>
        </div>
      </div>

        {/* Org Selector Bar */}
        <div className="p-4 bg-white border-b border-slate-200">
          <div className="max-w-2xl">
            <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
              Organization
            </label>
            <div className="flex gap-3">
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">Select an organization...</option>
                {adminOrgs.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowCreateOrg(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                <Plus size={16} />
                Create Org
              </button>
            </div>
            {adminOrgs.length === 0 && (
              <p className="text-xs text-amber-600 mt-2">
                Create your first organization to get started!
              </p>
            )}
          </div>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {!selectedOrg ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-slate-400">
                <Calendar size={64} className="mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Select an organization to begin</p>
                <p className="text-sm mt-2">Choose from the dropdown above</p>
              </div>
            </div>
          ) : view === 'list' ? (
            <div className="max-w-4xl mx-auto">
              {/* Create Button */}
              <div className="mb-6">
                <button
                  onClick={handleCreateService}
                  disabled={isCreating}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
                >
                  {isCreating ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={20} />
                      Create New Service
                    </>
                  )}
                </button>
              </div>

              {/* Services List */}
              {services.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Calendar size={64} className="mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">No services yet</p>
                  <p className="text-sm mt-2">Click "Create New Service" to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {services.map(service => (
                    <div
                      key={service.id}
                      className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-bold text-slate-800 mb-1">{service.title}</h3>
                          <p className="text-sm text-slate-500">
                            {service.date ? new Date(service.date + 'T00:00:00').toLocaleDateString() : 'No date set'}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {service.elements.length} elements
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-xs text-slate-400 text-right mr-2">
                            {service.createdAt && 'seconds' in service.createdAt 
                              ? new Date(service.createdAt.seconds * 1000).toLocaleDateString()
                              : 'Recently created'}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingService(service);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-sm font-medium"
                            title="View service"
                          >
                            <Eye size={16} />
                            View
                          </button>
                          {isOrgAdmin && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedService(service);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors text-sm font-medium"
                                title="Edit service"
                              >
                                <Edit3 size={16} />
                                Edit
                              </button>
                              <button
                                onClick={(e) => handleDeleteService(service.id!, service.title, service.playlistId, e)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete service"
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              <p>Edit view (coming in next steps)</p>
            </div>
          )}
        </div>

      {/* ServiceViewer - Full screen read-only view */}
      {viewingService && !viewingHymnFromService && (
        <div className="fixed inset-0 z-[800] bg-white">
          <ServiceViewer
            service={viewingService}
            onClose={() => setViewingService(null)}
            hymnalData={hymnalData}
            onSongSelect={(song) => {
              // Show the hymn detail viewer with context to return to service
              setViewingHymnFromService({ service: viewingService, song });
            }}
          />
        </div>
      )}

      {/* SongDetailViewer - When viewing a hymn from a service */}
      {viewingHymnFromService && (
        <div className="fixed inset-0 z-[900] bg-white">
          <SongDetailViewer
            song={viewingHymnFromService.song}
            onClose={() => {
              // Go back to the service viewer
              setViewingHymnFromService(null);
            }}
            playerState={playerState}
            onPlayTrack={onPlayTrack}
            onTogglePlay={onTogglePlay}
            onRestartTrack={onRestartTrack}
            onAddToPlaylist={onAddToPlaylist}
            onSpeedChange={onSpeedChange}
            onTransposeChange={onTransposeChange}
            vocalAvailability={vocalAvailability}
            isPremium={isPremium}
            onOpenPremium={onOpenPremium}
          />
        </div>
      )}

      {/* ServiceEditor Modal - Renders on top when service is selected */}
      {selectedService && user && (
        <ServiceEditor
          service={selectedService}
          onClose={() => setSelectedService(null)}
          onSave={handleSaveService}
          hymnalData={hymnalData}
          orgServices={services}
          templates={templates}
          userId={user.uid}
          playerState={playerState}
          onPlayTrack={onPlayTrack}
          onTogglePlay={onTogglePlay}
          onRestartTrack={onRestartTrack}
          onAddToPlaylist={onAddToPlaylist}
          onSpeedChange={onSpeedChange}
          onTransposeChange={onTransposeChange}
          vocalAvailability={vocalAvailability}
          isPremium={isPremium}
          onOpenPremium={onOpenPremium}
          onCreatePlaylist={async (serviceTitle, songs) => {
            if (!user || !selectedOrg) return;
            
            try {
              // Create SerializedPlaylistItem array (Piano/Accompaniment by default)
              const items = songs.map(song => ({
                songNumber: song.number,
                label: 'Piano',
                url: song.accompanimentUrl
              }));

              // Save to Firestore playlists collection
              await addDoc(collection(db, 'playlists'), {
                userId: user.uid,
                name: serviceTitle,
                items,
                organizationId: selectedOrg,
                createdAt: serverTimestamp()
              });

              alert(`✅ Playlist "${serviceTitle}" created successfully!\n\n${songs.length} songs added to your organization's playlists.`);
            } catch (err) {
              console.error('Error creating playlist:', err);
              alert('Failed to create playlist. Please try again.');
              throw err;
            }
          }}
        />
      )}

      {/* Help Modal */}
      <ServicePlannerHelp 
        isOpen={showHelp} 
        onClose={() => setShowHelp(false)} 
      />

      {/* Template Manager Modal */}
      {selectedOrg && user && (
        <TemplateManager
          isOpen={showTemplateManager}
          onClose={() => setShowTemplateManager(false)}
          orgId={selectedOrg}
          user={user}
        />
      )}

      {/* Create Organization Modal */}
      {showCreateOrg && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateOrg(false)} />
          
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-800">Create Organization</h3>
              <button 
                onClick={() => setShowCreateOrg(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Organization Name
              </label>
              <input
                type="text"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateOrg()}
                placeholder="e.g., First Presbyterian Church"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                autoFocus
              />
              <p className="text-xs text-slate-500 mt-2">
                You'll be the admin and can create services and templates.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateOrg(false)}
                className="flex-1 px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrg}
                disabled={isCreatingOrg || !newOrgName.trim()}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors"
              >
                {isCreatingOrg ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicePlanner;
