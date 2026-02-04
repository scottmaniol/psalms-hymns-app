import React, { useState, useEffect } from 'react';
import { X, Link2, Unlink, CheckCircle, AlertCircle, Loader2, Building2, Key, ExternalLink } from 'lucide-react';
import { User } from 'firebase/auth';
import { db, functions } from '../firebase';
import { doc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Organization } from '../types';

interface PlanningCenterSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  myOrgs: Organization[];
  isPremium: boolean;
  onOpenPremium: () => void;
}

interface PCConnection {
  userId: string;
  pcOrganizationName: string;
  linkedOrgId: string;
  active: boolean;
  createdAt: any;
  lastSync: any;
}

const PlanningCenterSettings: React.FC<PlanningCenterSettingsProps> = ({
  isOpen,
  onClose,
  user,
  myOrgs,
  isPremium,
  onOpenPremium
}) => {
  const [connection, setConnection] = useState<PCConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [applicationId, setApplicationId] = useState('');
  const [secret, setSecret] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch connection data
  useEffect(() => {
    if (!isOpen || !user) return;

    setIsLoading(true);
    const connectionRef = doc(db, 'planning_center_connections', user.uid);
    
    const unsubscribe = onSnapshot(connectionRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as PCConnection;
        setConnection(data);
        setSelectedOrgId(data.linkedOrgId || '');
      } else {
        setConnection(null);
        setSelectedOrgId('');
      }
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching PC connection:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, user]);

  const handleConnect = async () => {
    if (!isPremium) {
      onOpenPremium();
      return;
    }

    if (!applicationId.trim() || !secret.trim()) {
      showToast('Please enter both Application ID and Secret', 'error');
      return;
    }

    setIsConnecting(true);
    try {
      // Combine into appId:secret format for Basic Auth
      const token = `${applicationId.trim()}:${secret.trim()}`;
      
      // Call Cloud Function to verify and store the token
      const connectPC = httpsCallable(functions, 'connectPlanningCenter');
      const result = await connectPC({ token }) as any;
      
      if (result.data.success) {
        showToast('Connected successfully!', 'success');
        setApplicationId('');
        setSecret('');
      } else {
        showToast(result.data.error || 'Failed to connect', 'error');
      }
    } catch (error: any) {
      console.error('Error connecting:', error);
      showToast('Failed to connect. Please check your token.', 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await deleteDoc(doc(db, 'planning_center_connections', user.uid));
      showToast('Planning Center disconnected', 'success');
    } catch (error) {
      console.error('Error disconnecting:', error);
      showToast('Failed to disconnect', 'error');
    }
  };

  const handleLinkOrg = async () => {
    if (!selectedOrgId || !connection) return;

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'planning_center_connections', user.uid), {
        linkedOrgId: selectedOrgId
      });
      showToast('Organization linked successfully!', 'success');
    } catch (error) {
      console.error('Error linking org:', error);
      showToast('Failed to link organization', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm" 
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Link2 size={24} />
              Planning Center
            </h2>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-indigo-100">
            Automatically sync service playlists from Planning Center Services
          </p>
        </div>

        {/* Content - Scrollable */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-160px)]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={32} className="animate-spin text-indigo-500" />
            </div>
          ) : connection && connection.active ? (
            // Connected State
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-emerald-700 font-bold mb-1">
                  <CheckCircle size={20} />
                  Connected
                </div>
                <p className="text-sm text-emerald-600">
                  {connection.pcOrganizationName}
                </p>
                <p className="text-xs text-emerald-500 mt-1">
                  Last synced: {connection.lastSync ? new Date(connection.lastSync.seconds * 1000).toLocaleDateString() : 'Never'}
                </p>
              </div>

              {/* Organization Linking */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Link to Organization
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  Select which organization should receive auto-synced playlists from Planning Center services.
                </p>
                
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  disabled={myOrgs.length === 0}
                >
                  <option value="">Select an organization...</option>
                  {myOrgs.filter(org => 
                    org.createdBy === user.uid || 
                    (org.adminIds && org.adminIds.includes(user.uid))
                  ).map(org => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>

                {myOrgs.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <AlertCircle size={12} />
                    You need to create an organization first
                  </p>
                )}

                {selectedOrgId && selectedOrgId !== connection.linkedOrgId && (
                  <button
                    onClick={handleLinkOrg}
                    disabled={isSaving}
                    className="w-full mt-3 bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Building2 size={16} />
                        Link Organization
                      </>
                    )}
                  </button>
                )}

                {connection.linkedOrgId && (
                  <div className="mt-3 text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle size={12} />
                    Currently linked to: {myOrgs.find(o => o.id === connection.linkedOrgId)?.name || 'Unknown'}
                  </div>
                )}
              </div>

              {/* Disconnect Button */}
              <button
                onClick={handleDisconnect}
                className="w-full border-2 border-red-200 text-red-600 py-2 px-4 rounded-lg font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
              >
                <Unlink size={16} />
                Disconnect Planning Center
              </button>
            </div>
          ) : (
            // Not Connected State
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h3 className="font-bold text-slate-800 mb-2">How it works:</h3>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 font-bold">1.</span>
                    Generate a Personal Access Token in Planning Center
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 font-bold">2.</span>
                    Enter the token below and connect
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 font-bold">3.</span>
                    Link to one of your organizations
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 font-bold">4.</span>
                    Playlists auto-sync when you create services!
                  </li>
                </ul>
              </div>

              {/* Instructions to get PAT */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs">
                <p className="font-bold text-indigo-900 mb-1 flex items-center gap-1">
                  <Key size={12} />
                  Get your Personal Access Token:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-indigo-700 ml-1">
                  <li>Go to Planning Center → Account settings</li>
                  <li>Click "Personal Access Tokens"</li>
                  <li>Create new token with "Services" scope</li>
                  <li>Copy and paste it below</li>
                </ol>
                <a
                  href="https://api.planningcenteronline.com/oauth/applications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <ExternalLink size={12} />
                  Open Planning Center API
                </a>
              </div>

              {/* Token Inputs - Split for clarity */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Application ID
                  </label>
                  <input
                    type="text"
                    value={applicationId}
                    onChange={(e) => setApplicationId(e.target.value)}
                    placeholder="Enter Application ID..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Secret
                  </label>
                  <input
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="Enter Secret..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                  />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <strong>Note:</strong> Only hymns that match your hymnal will be added. Unmatched songs are skipped.
              </div>

              <button
                onClick={handleConnect}
                disabled={isConnecting || !applicationId.trim() || !secret.trim()}
                className="w-full text-indigo-600 font-medium py-2 px-4 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isConnecting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Link2 size={16} />
                    Connect Planning Center
                  </>
                )}
              </button>

              {!isPremium && (
                <p className="text-xs text-center text-slate-500">
                  Premium feature • <button onClick={onOpenPremium} className="text-indigo-600 font-bold hover:underline">Upgrade</button>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-max max-w-[90%] z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className={`px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold ${
              toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}>
              {toast.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {toast.msg}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanningCenterSettings;
