
import React, { useState, useEffect } from 'react';
import { X, Check, Crown, Music, ListMusic, Users, Star, Loader2, AlertCircle, LogIn } from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';

// TODO: Replace this with the actual Price ID from your Stripe Dashboard (e.g., price_12345...)
const STRIPE_PRICE_ID = "price_1SWljaHGwWuPd2tHjsIkjQdS";

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}

const PremiumModal: React.FC<PremiumModalProps> = ({ isOpen, onClose, onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear error when reopened
  useEffect(() => {
      if (isOpen) setError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubscribe = async () => {
    const user = auth.currentUser;
    setError(null);
    
    if (!user) {
        onLogin(); // Redirect to login instead of alerting
        return;
    }

    setIsLoading(true);

    try {
        // 1. Create a checkout session document in the 'customers' collection.
        // The "Run Payments with Stripe" extension defaults to listening here.
        const docRef = await addDoc(collection(db, "customers", user.uid, "checkout_sessions"), {
            price: STRIPE_PRICE_ID,
            success_url: window.location.origin,
            cancel_url: window.location.origin,
        });

        // Safety Timeout
        const timeoutId = setTimeout(() => {
            setIsLoading(false);
            setError("Request timed out. The payment system may be unavailable.");
        }, 15000);

        // 2. Listen for the extension to attach the payment URL
        const unsubscribe = onSnapshot(docRef, (snap) => {
            const { error, url } = snap.data() as any || {};
            
            if (error) {
                clearTimeout(timeoutId);
                console.error("Stripe Error:", error);
                setError(`Payment error: ${error.message}`);
                setIsLoading(false);
            }
            
            if (url) {
                clearTimeout(timeoutId);
                // We have a Stripe Checkout URL, let's redirect.
                window.location.assign(url);
            }
        });

    } catch (err: any) {
        console.error("Subscription Error:", err);
        
        if (err.code === 'permission-denied') {
             setError("Setup Required: Database permissions are blocking this request. Please update Firestore Rules in the Firebase Console.");
        } else {
             setError(`Subscription failed: ${err.message}`);
        }
        setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-4 right-4 z-50">
            <button 
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
                <X size={20} />
            </button>
        </div>

        {/* Header Content */}
        <div className="relative z-10 px-8 pt-10 pb-6 text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl shadow-sm border border-indigo-100 mx-auto flex items-center justify-center mb-4 transform rotate-3">
                <Crown size={32} className="text-indigo-600" fill="currentColor" fillOpacity={0.1} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Upgrade to Premium</h2>
            <p className="text-slate-500 text-sm font-medium">Unlock the full Psalms & Hymns experience</p>
        </div>

        {/* Features List */}
        <div className="p-6 pt-2 bg-white flex-1 overflow-y-auto">
            {/* Error Display */}
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 animate-in slide-in-from-top-2">
                    <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 leading-relaxed font-medium">{error}</p>
                </div>
            )}

            <div className="space-y-4 mt-2">
                <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="bg-indigo-100 p-2.5 rounded-lg text-indigo-600 shrink-0">
                        <Music size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900">Vocal Tracks</h3>
                        <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                            Access professional vocal recordings for select hymns to help you learn parts or sing along. More vocal recordings added regularly.
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="bg-purple-100 p-2.5 rounded-lg text-purple-600 shrink-0">
                        <ListMusic size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900">Unlimited Playlists</h3>
                        <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                            Create as many personal playlists as you need. Free users are limited to 3 playlists.
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="bg-emerald-100 p-2.5 rounded-lg text-emerald-600 shrink-0">
                        <Users size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900">Create Organizations</h3>
                        <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                            Create and manage groups to share playlists with your choir, family, or congregation.
                        </p>
                    </div>
                </div>
            </div>

            {/* Pricing & CTA */}
            <div className="mt-8 bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-2xl font-bold text-slate-900">$0.99</span>
                    <span className="text-sm text-slate-500 font-medium">/ month</span>
                </div>
                <p className="text-xs text-slate-400 mb-4">Cancel anytime.</p>
                
                {auth.currentUser ? (
                    <button 
                        onClick={handleSubscribe}
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md shadow-indigo-200 transform transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <>
                                <Star size={18} fill="currentColor" />
                                Subscribe Now
                            </>
                        )}
                    </button>
                ) : (
                    <button 
                        onClick={onLogin}
                        className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transform transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <LogIn size={18} />
                        Log In to Subscribe
                    </button>
                )}
                <p className="text-[10px] text-slate-400 mt-3">
                    Secure payment via Stripe. Supports the ministry.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PremiumModal;
