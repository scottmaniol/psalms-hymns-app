
import React, { useState, useEffect, useRef } from 'react';
import { MoreVertical, ShoppingCart, Info, Download, Library, Heart, MessageSquare, LogIn, LogOut, User, Share2, Shield, Crown, Check, Calendar } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface MenuProps {
  onOpenAbout: () => void;
  onOpenResources: () => void;
  onOpenContact: () => void;
  onOpenAdmin?: () => void;
  onOpenServicePlanner: () => void;
  buyUrl: string;
  donateUrl: string;
  showInstallOption: boolean;
  onInstallClick: () => void;
  user: FirebaseUser | null;
  isAdmin?: boolean;
  onAuthClick: () => void;
  onLogoutClick: () => void;
  isPremium?: boolean;
  onOpenPremium?: () => void;
}

const Menu: React.FC<MenuProps> = ({ 
  onOpenAbout, 
  onOpenResources, 
  onOpenContact,
  onOpenAdmin,
  onOpenServicePlanner,
  buyUrl, 
  donateUrl, 
  showInstallOption, 
  onInstallClick,
  user,
  isAdmin = false,
  onAuthClick,
  onLogoutClick,
  isPremium = false,
  onOpenPremium
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setCopySuccess(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleShareApp = async () => {
    const shareData = {
      title: 'Psalms & Hymns',
      text: 'Check out Psalms & Hymns to the Living God! A digital hymnal with scores, lyrics, and audio.',
      url: 'http://classichymns.org'
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setIsOpen(false);
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        setCopySuccess(true);
        setTimeout(() => {
            setCopySuccess(false);
            setIsOpen(false);
        }, 1500);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-full transition-colors ${isOpen ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100'}`}
        title="Menu"
      >
        <MoreVertical size={20} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
          
          {/* Auth Section */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 mb-1">
            {user ? (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm truncate min-w-0">
                            <User size={16} className="text-indigo-600 shrink-0" />
                            <span className="truncate">{user.email}</span>
                        </div>
                        {isPremium ? (
                             <div title="Premium Member" className="shrink-0 bg-amber-100 text-amber-600 p-1 rounded-full border border-amber-200">
                                <Crown size={12} fill="currentColor" />
                             </div>
                        ) : (
                             <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-medium shrink-0 border border-slate-300">Free</span>
                        )}
                    </div>

                    {!isPremium && onOpenPremium && (
                        <button
                            onClick={() => {
                                onOpenPremium();
                                setIsOpen(false);
                            }}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm my-1"
                        >
                            <Crown size={14} fill="currentColor" /> Upgrade to Premium
                        </button>
                    )}

                    <button
                        onClick={() => {
                            onLogoutClick();
                            setIsOpen(false);
                        }}
                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium mt-1"
                    >
                        <LogOut size={12} /> Sign Out
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => {
                        onAuthClick();
                        setIsOpen(false);
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                    <LogIn size={16} /> Log In / Sign Up
                </button>
            )}
          </div>

          {/* Admin Button - Visible only if isAdmin is true */}
          {user && onOpenAdmin && isAdmin && (
             <button
                onClick={() => {
                  onOpenAdmin();
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Shield size={16} className="text-slate-500" />
                Admin Dashboard
              </button>
          )}

          <a
            href={buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            onClick={() => setIsOpen(false)}
          >
            <ShoppingCart size={16} className="text-emerald-600" />
            Buy Hymnal
          </a>

          <button
            onClick={() => {
              onOpenResources();
              setIsOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <Library size={16} className="text-purple-500" />
            Resources
          </button>

          <div className="border-t border-slate-100 my-1"></div>

          <button
            onClick={() => {
              onOpenAbout();
              setIsOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <Info size={16} className="text-blue-500" />
            About
          </button>

          <a
            href={donateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            onClick={() => setIsOpen(false)}
          >
            <Heart size={16} className="text-pink-500" />
            Support the App
          </a>

          <button
            onClick={() => {
              onOpenContact();
              setIsOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <MessageSquare size={16} className="text-orange-500" />
            Contact
          </button>

          <button
            onClick={handleShareApp}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            {copySuccess ? <Check size={16} className="text-emerald-500" /> : <Share2 size={16} className="text-cyan-500" />}
            {copySuccess ? "Link Copied!" : "Share App"}
          </button>

          {/* Install Option */}
          {showInstallOption && (
            <>
              <div className="border-t border-slate-100 my-1"></div>
              <button
                onClick={() => {
                  onInstallClick();
                  setIsOpen(false);
                }}
                className="w-full px-4 py-3 text-left text-sm text-indigo-700 hover:bg-indigo-50 bg-indigo-50/50 flex items-center gap-2 font-medium"
              >
                <Download size={16} className="text-indigo-600" />
                Save App
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Menu;
