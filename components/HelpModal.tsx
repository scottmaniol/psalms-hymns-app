
import React from 'react';
import { X, HelpCircle, Share2, Users, Save, Link, ShieldAlert, Crown, Link2, Calendar } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <HelpCircle className="text-indigo-600" size={20} />
            Help & Instructions
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto text-slate-700 space-y-6 text-sm leading-relaxed">
          
          {/* Premium Overview */}
          <section className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100">
            <h3 className="font-bold text-indigo-900 flex items-center gap-2 mb-3 text-sm uppercase tracking-wide">
               <Crown size={16} className="text-purple-600" fill="currentColor" fillOpacity={0.2} />
               Account Types
            </h3>
            <div className="space-y-3 text-xs">
               <div className="bg-white/60 p-2 rounded-lg border border-indigo-50">
                  <span className="font-bold text-slate-700 block mb-1">Free Account</span>
                  <ul className="list-disc pl-4 text-slate-600 space-y-0.5">
                    <li>Piano Accompaniment Audio</li>
                    <li>Up to 3 Personal Playlists</li>
                    <li>Join unlimited Organizations</li>
                  </ul>
               </div>
               <div className="bg-white/80 p-2 rounded-lg border border-purple-100 shadow-sm">
                  <span className="font-bold text-indigo-800 block mb-1 flex items-center gap-1"><Crown size={10}/> Premium Account</span>
                  <ul className="list-disc pl-4 text-indigo-700 space-y-0.5">
                    <li><strong>Vocal Performance Tracks</strong></li>
                    <li><strong>Unlimited</strong> Personal Playlists</li>
                    <li><strong>Create</strong> & Manage Organizations</li>
                    <li><strong>Service Planner</strong> with Playlist Generation</li>
                  </ul>
               </div>
            </div>
          </section>

          <div className="h-px bg-slate-100 w-full"></div>

          <section>
            <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2">
              <Save size={16} className="text-slate-400" />
              Saving Playlists
            </h3>
            <p>
              Build a queue of songs in the main "Queue" tab. Click <strong>Save Queue as Playlist</strong> to store it. 
            </p>
            <p className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                <strong>Note:</strong> Free users can save up to 3 personal playlists. Premium users can save an unlimited amount.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2">
              <Share2 size={16} className="text-slate-400" />
              Sharing Playlists
            </h3>
            <p>
              <strong>Personal Sharing:</strong> Click the <Link size={12} className="inline"/> Link icon on any saved playlist to copy a unique URL. 
              Anyone with this link can load your playlist into their queue.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2">
              <Users size={16} className="text-slate-400" />
              Organizations (Groups)
            </h3>
            <p className="mb-2">
              Organizations allow you to manage playlists as a group (e.g., "Choir," "Church").
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li><strong>Create:</strong> Premium users can create new Organizations in the "Orgs" tab or directly in Service Planner.</li>
              <li><strong>Join:</strong> Anyone can join an Organization using a <strong>6-character Share Code</strong> provided by the owner.</li>
              <li><strong>Share:</strong> When saving a playlist, select the Organization from the dropdown. All members can see and load these playlists.</li>
              <li><strong>Auto-Integration:</strong> Organizations created in Service Planner automatically appear in playlists.</li>
            </ul>
          </section>

          <section className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <h3 className="font-bold text-blue-900 flex items-center gap-2 mb-3">
              <Calendar size={16} />
              Service Planner Integration
            </h3>
            <p className="mb-3 text-blue-900">
              <strong className="text-blue-800">Premium users</strong> can create playlists directly from worship services planned in the Service Planner.
            </p>
            <div className="space-y-2 text-xs text-blue-800">
              <div>
                <strong className="block mb-1">1. Plan Your Service:</strong>
                <p className="text-blue-700">Go to Menu → Service Planner to create and plan worship services with songs, prayers, scripture, and more.</p>
              </div>
              <div>
                <strong className="block mb-1">2. Create Playlist from Service:</strong>
                <p className="text-blue-700">In the Service Editor, click "Create Playlist" to automatically generate an organization playlist with all songs from the service.</p>
              </div>
              <div>
                <strong className="block mb-1">3. Access Playlists:</strong>
                <p className="text-blue-700">Service playlists appear here in the "Orgs" tab. All organization members can view and play them.</p>
              </div>
              <div className="bg-white/60 p-2 rounded mt-2 border border-blue-200">
                <strong className="text-blue-900 block mb-1">💡 Pro Tip:</strong>
                <p className="text-blue-800">Use Service Planner to plan your weekly worship, then create playlists for musicians to practice during the week!</p>
              </div>
            </div>
          </section>

          <section className="bg-amber-50 p-3 rounded-lg border border-amber-100">
            <h4 className="font-bold text-amber-900 mb-1 text-xs uppercase flex items-center gap-1">
                <ShieldAlert size={12}/> Admin Privileges
            </h4>
            <p className="text-xs text-amber-800">
                Org Creators can see an <strong>Admin Code</strong>. Sharing this code allows others to join as Admins. 
                Admins can add, delete, and reorder playlists within the Organization.
            </p>
          </section>

          <div className="h-px bg-slate-100 w-full"></div>

          <section>
              <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2">
                  <Link2 size={16} className="text-slate-400" />
                  Planning Center Sync
              </h3>
              <p className="mb-2">
                  Premium users can connect to their Planning Center account to automatically sync service playlists.
              </p>
              <ol className="list-decimal pl-5 space-y-2 text-slate-600">
                  <li>
                      <strong>Generate a Personal Access Token:</strong> In Planning Center, go to your Account Settings, find Personal Access Tokens, and create a new token with the "Services" scope.
                  </li>
                  <li>
                      <strong>Connect:</strong> In the "Orgs" tab, click "Planning Center Sync," and paste your Application ID and Secret.
                  </li>
                  <li>
                      <strong>Link an Organization:</strong> Once connected, select one of your managed organizations to link it.
                  </li>
                  <li>
                      <strong>Auto-Sync:</strong> When you create a new service plan in Planning Center and add songs, a playlist will automatically be created in your linked organization.
                  </li>
              </ol>
          </section>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 text-center">
          <button 
            onClick={onClose}
            className="text-indigo-600 font-medium text-sm hover:text-indigo-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
