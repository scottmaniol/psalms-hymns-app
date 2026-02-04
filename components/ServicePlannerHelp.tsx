import React from 'react';
import { X, Calendar, Music, Plus, Mail, ListMusic, FileText, Eye, Share2, Settings, BarChart3, Users, Clock } from 'lucide-react';

interface ServicePlannerHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const ServicePlannerHelp: React.FC<ServicePlannerHelpProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-indigo-100">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800">Service Planner Help</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-200/50 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] space-y-6">
          
          {/* Getting Started */}
          <section>
            <h3 className="text-lg font-bold text-indigo-600 mb-3 flex items-center gap-2">
              <Calendar size={20} />
              Getting Started
            </h3>
            <div className="space-y-2 text-sm text-slate-700">
              <p><strong>1. Create/Select Organization:</strong> Click "+ Create Org" to create a new organization (you'll be the admin automatically), or select an existing organization from the dropdown.</p>
              <p><strong>2. Create Service:</strong> Click "Create New Service" to begin planning a worship service.</p>
              <p><strong>3. Add Details:</strong> Fill in the service title, date, time, and notes.</p>
              <p><strong>4. Add Elements:</strong> Click "+ Add Element" in any section to add songs, prayers, scripture readings, sermons, or other elements.</p>
              <p><strong>5. Drag to Reorder:</strong> Drag and drop elements within sections to rearrange order.</p>
              <p><strong>6. Assign Team Members:</strong> Add names to the "Assigned To" field to indicate who's leading each element.</p>
            </div>
          </section>

          {/* Organizations */}
          <section>
            <h3 className="text-lg font-bold text-indigo-600 mb-3 flex items-center gap-2">
              <Users size={20} />
              Organizations
            </h3>
            <div className="space-y-2 text-sm text-slate-700">
              <p><strong>Create Org:</strong> Click the "+ Create Org" button to create a new organization. You automatically become the admin.</p>
              <p><strong>Auto-Select:</strong> New organizations are automatically selected after creation.</p>
              <p><strong>Join Codes:</strong> Each organization has unique member and admin join codes for inviting others.</p>
              <p><strong>Cross-App Integration:</strong> Organizations created here automatically appear in playlists and other features.</p>
            </div>
          </section>

          {/* Service Templates */}
          <section>
            <h3 className="text-lg font-bold text-indigo-600 mb-3 flex items-center gap-2">
              <Settings size={20} />
              Service Templates
            </h3>
            <div className="space-y-2 text-sm text-slate-700">
              <p><strong>Default Template:</strong> "Gospel-Shaped Service" with 11 liturgical sections is created automatically for each organization.</p>
              <p><strong>Manage Templates:</strong> Click the "Templates" button to create custom templates, rename sections, reorder, or delete sections.</p>
              <p><strong>Drag & Drop:</strong> Reorder template sections by dragging them up or down.</p>
              <p><strong>Set Default:</strong> Choose which template is used for new services.</p>
              <p><strong>Multiple Templates:</strong> Create different templates for different service types (e.g., Sunday Morning, Evening Worship, Special Services).</p>
            </div>
          </section>

          {/* Default Liturgical Sections */}
          <section>
            <h3 className="text-lg font-bold text-indigo-600 mb-3">Gospel-Shaped Service Template</h3>
            <div className="bg-slate-50 rounded-lg p-4 text-sm space-y-1">
              <p><strong>1. Revelation:</strong> God Calls Us To Worship Him</p>
              <p><strong>2. Adoration:</strong> We Praise Our Triune God</p>
              <p><strong>3. Confession:</strong> God Calls Us to Confess Our Sins</p>
              <p><strong>4. Propitiation:</strong> God Declares Us Forgiven Through Christ</p>
              <p><strong>5. We Praise God for Our Salvation</strong></p>
              <p><strong>6. Proclamation:</strong> God Speaks to Us Through His Word</p>
              <p><strong>7. Dedication:</strong> We Respond to God's Word</p>
              <p><strong>8. Communion:</strong> The Lord Invites Us to His Table</p>
              <p><strong>9. Supplication:</strong> We Bring Our Requests Before the Lord</p>
              <p><strong>10. Commission:</strong> God Sends Us Forth to Serve Him</p>
              <p className="text-xs text-slate-500 mt-2">This template follows a gospel-centered worship structure.</p>
            </div>
          </section>

          {/* Element Types */}
          <section>
            <h3 className="text-lg font-bold text-indigo-600 mb-3 flex items-center gap-2">
              <Plus size={20} />
              Element Types
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <div>
                <strong className="text-indigo-600">Song:</strong> Search and add hymns from the app database (400+ psalms & hymns available).
              </div>
              <div>
                <strong className="text-indigo-600">Prayer:</strong> Add prayers with custom titles and details.
              </div>
              <div>
                <strong className="text-indigo-600">Scripture Reading:</strong> Add Bible readings with scripture references (e.g., "John 3:16-21").
              </div>
              <div>
                <strong className="text-indigo-600">Sermon:</strong> Add sermon details with title and notes.
              </div>
              <div>
                <strong className="text-indigo-600">Other:</strong> Add any other element (offering, announcements, benediction, etc.).
              </div>
            </div>
          </section>

          {/* Export Features */}
          <section>
            <h3 className="text-lg font-bold text-indigo-600 mb-3">Export & Automatic Playlists</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Mail size={18} className="text-slate-600 mt-0.5 shrink-0" />
                <div>
                  <strong>Email/Export:</strong> Send a formatted service order via email or native share to your team members.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <ListMusic size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <strong>Automatic Playlists:</strong> Every service automatically creates a linked playlist in your organization! Songs are automatically synced in real-time:
                  <ul className="list-disc list-inside ml-2 mt-2 space-y-1">
                    <li>Playlist created automatically when you create a service</li>
                    <li>Songs sync automatically when you add/remove/reorder them</li>
                    <li>Playlist name updates when you change service title or date</li>
                    <li>Format: "Service Title (Date)" - e.g., "Sunday Worship (12/29/2024)"</li>
                    <li>All organization members can access the playlist</li>
                    <li>Playlist deleted automatically if you delete the service</li>
                  </ul>
                  <div className="bg-emerald-50 border border-emerald-200 rounded p-2 mt-2">
                    <p className="text-xs text-emerald-800"><strong>✨ Zero Manual Work:</strong> Just add songs to your service and the playlist updates automatically - perfect for musicians to practice!</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Song Search & Analytics */}
          <section>
            <h3 className="text-lg font-bold text-indigo-600 mb-3 flex items-center gap-2">
              <Music size={20} />
              Song Search & Usage Analytics
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <div>
                <strong className="text-indigo-600">Search Songs:</strong>
                <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                  <li>By Number: Type "23", "119A", "100" to find specific psalms/hymns</li>
                  <li>By Title: Type "Amazing Grace", "Lord's Prayer", etc.</li>
                  <li>Quick Select: Click a search result to select it</li>
                </ul>
              </div>
              <div>
                <strong className="text-indigo-600">Usage Analytics:</strong>
                <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                  <li>Inline Stats: See "Used 5× • Last: 12/25/2024" next to each song</li>
                  <li>View History: Click "📊 View Usage History" to see all services where a song was used</li>
                  <li>Date Filters: Filter by 30 days, 90 days, 6 months, 1 year, or all time</li>
                  <li>Sortable: Sort by song number, title, or usage count</li>
                  <li>Click to Select: Click any song in history to auto-populate the song field</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Service Timing Features */}
          <section>
            <h3 className="text-lg font-bold text-indigo-600 mb-3 flex items-center gap-2">
              <Clock size={20} />
              Service Timing Features
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <div>
                <strong className="text-indigo-600">Automatic Duration Tracking:</strong>
                <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                  <li><strong>Songs:</strong> Durations automatically fetched when you add a song (from MP3 file metadata)</li>
                  <li><strong>Manual Entry:</strong> Add durations for prayers, scripture, sermons, and other elements</li>
                  <li><strong>Inline Editing:</strong> Click any duration to edit it directly in the service</li>
                  <li><strong>Total Duration:</strong> See total service length in the header (updates automatically)</li>
                </ul>
              </div>
              <div>
                <strong className="text-indigo-600">Song Library Integration:</strong>
                <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                  <li>Song durations show on library cards when dragging</li>
                  <li>Background loading - durations fetch progressively</li>
                  <li>Graceful error handling for missing files</li>
                </ul>
              </div>
              <div>
                <strong className="text-indigo-600">Format & Display:</strong>
                <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                  <li>Times shown in MM:SS format (e.g., "3:45" for 3 minutes 45 seconds)</li>
                  <li>Each element shows its duration next to the title</li>
                  <li>Element count + total time displayed in header (e.g., "12 elements • 65:30")</li>
                  <li>Autosaves to Firebase when you make changes</li>
                </ul>
              </div>
              <div className="bg-green-50 rounded p-3 border border-green-200">
                <p className="text-xs"><strong>💡 Use Case:</strong> Perfect for planning services that need to fit specific time slots. Plan a 60-minute service and see your total in real-time as you add elements!</p>
              </div>
            </div>
          </section>

          {/* View & Share Services */}
          <section>
            <h3 className="text-lg font-bold text-indigo-600 mb-3 flex items-center gap-2">
              <Eye size={20} />
              View & Share Services
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Eye size={18} className="text-slate-600 mt-0.5 shrink-0" />
                <div>
                  <strong>View Service:</strong> Click the "View" button on any service to see a beautiful, read-only, full-screen display. Perfect for projection, printing, or sharing with team members.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Share2 size={18} className="text-slate-600 mt-0.5 shrink-0" />
                <div>
                  <strong>Share Permalink:</strong> In View mode, click the "Share" button to copy a direct link to the service. Anyone with the link can view the service (no login required). Perfect for emailing to congregation or posting on website.
                </div>
              </div>
              <div className="bg-blue-50 rounded p-3 border border-blue-200">
                <p className="text-xs"><strong>Note:</strong> All users (members & admins) can view services. Only organization admins can edit or delete services.</p>
              </div>
            </div>
          </section>

          {/* Tips */}
          <section className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
            <h3 className="text-lg font-bold text-indigo-800 mb-3">💡 Pro Tips</h3>
            <ul className="space-y-2 text-sm text-indigo-900 list-disc list-inside">
              <li><strong>Auto-Save:</strong> Services save automatically when you make changes</li>
              <li><strong>Service Timing:</strong> Watch the total duration in the header as you plan - perfect for staying within time limits!</li>
              <li><strong>Click to Edit Times:</strong> Click any duration to edit it inline - no need to delete and re-add</li>
              <li><strong>Song Durations:</strong> Song times load automatically from MP3 files - no manual entry needed</li>
              <li><strong>Song Analytics:</strong> Check usage history to avoid repeating songs too often</li>
              <li><strong>Drag & Drop:</strong> Reorder elements by dragging them within sections</li>
              <li><strong>Assignments:</strong> Add team member names to know who's leading each element</li>
              <li><strong>View Mode:</strong> Use View mode for clean projection or printing (includes all durations)</li>
              <li><strong>Share Links:</strong> Send service permalinks to your team via email or text</li>
              <li><strong>Create Playlists:</strong> Generate playlists from services for musicians to practice</li>
              <li><strong>Custom Templates:</strong> Create templates for different service types</li>
              <li><strong>Export:</strong> Use the Export button to email formatted service plans with timing</li>
              <li><strong>Real-time Sync:</strong> All organization admins see updates instantly</li>
            </ul>
          </section>

          {/* Keyboard Shortcuts */}
          <section className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-700 mb-3">⌨️ Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <strong>View Service:</strong> Click "View" button
              </div>
              <div>
                <strong>Edit Service:</strong> Click "Edit" button (admin)
              </div>
              <div>
                <strong>Share Service:</strong> View → "Share" button
              </div>
              <div>
                <strong>Delete Service:</strong> Click trash icon (admin)
              </div>
              <div>
                <strong>Add Element:</strong> "+ Add Element" button
              </div>
              <div>
                <strong>Reorder:</strong> Drag & drop elements
              </div>
              <div>
                <strong>Song History:</strong> "📊 View Usage History"
              </div>
              <div>
                <strong>Templates:</strong> Click "Templates" button
              </div>
            </div>
          </section>

          {/* Permissions */}
          <section>
            <h3 className="text-lg font-bold text-indigo-600 mb-3">Permissions & Access</h3>
            <div className="space-y-2 text-sm text-slate-700">
              <p><strong>Organization Admins:</strong> Can create, edit, delete services. Can manage templates. Can create playlists.</p>
              <p><strong>Organization Members:</strong> Can view all services. Cannot edit or delete. Can access shared permalinks.</p>
              <p><strong>Public Access:</strong> Anyone with a service permalink can view that service (no login required).</p>
              <p><strong>Premium Required:</strong> The Service Planner is a premium-only feature for creating/editing services.</p>
              <p><strong>Cross-Org:</strong> Services are scoped to organizations. Each org has its own services and templates.</p>
            </div>
          </section>

          {/* Footer */}
          <div className="text-center text-xs text-slate-400 pt-4 border-t border-slate-200">
            <p>Service Planner • Premium Feature • Real-time Collaboration</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServicePlannerHelp;
