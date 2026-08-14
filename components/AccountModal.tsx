
import React, { useState, useEffect } from 'react';
import { X, Crown, CreditCard, Loader2, AlertCircle, CheckCircle, KeyRound, Mail, Calendar, Star, Gift } from 'lucide-react';
import { User as FirebaseUser, sendPasswordResetEmail } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebase';
import { SubscriptionInfo } from '../types';

// Deployed by the "Run Payments with Stripe" extension (instance id: firestore-stripe-payments)
// in us-central1, which is the default region for our `functions` instance.
const PORTAL_LINK_FUNCTION = 'ext-firestore-stripe-payments-createPortalLink';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: FirebaseUser | null;
  isPremium: boolean;
  subscription: SubscriptionInfo | null;
  onOpenPremium: () => void;
}

const formatDate = (d: Date | null) =>
  d ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

const formatPrice = (sub: SubscriptionInfo) => {
  if (sub.unitAmount == null) return null;
  const amount = (sub.unitAmount / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: (sub.currency || 'usd').toUpperCase(),
  });
  return sub.interval ? `${amount} / ${sub.interval}` : amount;
};

const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  user,
  isPremium,
  subscription,
  onOpenPremium,
}) => {
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Clear transient state when reopened
  useEffect(() => {
    if (isOpen) {
      setPortalError(null);
      setResetSent(false);
      setResetError(null);
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const usesPassword = user.providerData.some(p => p.providerId === 'password');
  const usesGoogle = user.providerData.some(p => p.providerId === 'google.com');
  const memberSince = user.metadata?.creationTime ? new Date(user.metadata.creationTime) : null;

  // Premium with no Stripe record means it was granted manually by an admin.
  const isComplimentary = isPremium && !subscription;

  const handleManageSubscription = async () => {
    setPortalError(null);
    setPortalLoading(true);

    try {
      const createPortalLink = httpsCallable<{ returnUrl: string }, { url: string }>(
        functions,
        PORTAL_LINK_FUNCTION
      );
      const { data } = await createPortalLink({ returnUrl: window.location.origin });

      if (!data?.url) throw new Error('No portal URL returned');

      // Leaving the app for Stripe, so no need to clear the loading state.
      window.location.assign(data.url);
    } catch (err: any) {
      console.error('Billing portal error:', err);
      setPortalError("We couldn't open the billing portal. Please use Contact in the menu and we'll help you right away.");
      setPortalLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user.email) return;
    setResetError(null);
    setResetLoading(true);

    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetSent(true);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setResetError('Could not send the reset email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  // --- Plan status line -------------------------------------------------
  let planNote: { tone: 'good' | 'warn' | 'bad'; text: string } | null = null;

  if (subscription) {
    if (subscription.cancelAtPeriodEnd) {
      planNote = {
        tone: 'warn',
        text: `Your subscription is set to cancel. You'll keep Premium access until ${formatDate(subscription.currentPeriodEnd)}, and you won't be charged again.`,
      };
    } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
      planNote = {
        tone: 'bad',
        text: "Your last payment didn't go through, so Premium features are paused. Update your card below to restore access.",
      };
    } else if (subscription.status === 'trialing') {
      planNote = { tone: 'good', text: `Your free trial runs until ${formatDate(subscription.currentPeriodEnd)}.` };
    } else if (subscription.status === 'active') {
      planNote = { tone: 'good', text: `Renews automatically on ${formatDate(subscription.currentPeriodEnd)}.` };
    }
  }

  // A past_due/unpaid subscriber has lost access but still has a plan — calling
  // that "Free" next to a monthly price reads as a contradiction.
  const planLabel = isPremium ? 'Premium' : subscription ? 'Premium (paused)' : 'Free';

  const noteStyles = {
    good: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    warn: 'bg-amber-50 border-amber-100 text-amber-800',
    bad: 'bg-red-50 border-red-100 text-red-800',
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative border border-slate-200 max-h-[90vh]"
        onClick={e => e.stopPropagation()}
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

        {/* Header */}
        <div className="px-8 pt-10 pb-5 text-center border-b border-slate-100">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl shadow-sm border border-slate-200 mx-auto flex items-center justify-center mb-3">
            {isPremium ? (
              <Crown size={30} className="text-amber-500" fill="currentColor" fillOpacity={0.15} />
            ) : (
              <Mail size={28} className="text-slate-500" />
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-0.5">Your Account</h2>
          <p className="text-slate-500 text-sm font-medium truncate px-4">{user.email}</p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* --- Profile --- */}
          <section className="mb-6">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Profile</h3>
            <dl className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100 text-sm">
              {user.displayName && (
                <div className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-slate-500">Name</dt>
                  <dd className="font-medium text-slate-800 truncate">{user.displayName}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium text-slate-800 truncate">{user.email}</dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-slate-500">Sign-in method</dt>
                <dd className="font-medium text-slate-800">
                  {usesGoogle ? 'Google' : 'Email & password'}
                </dd>
              </div>
              {memberSince && (
                <div className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-slate-500 flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-400" /> Member since
                  </dt>
                  <dd className="font-medium text-slate-800">{formatDate(memberSince)}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* --- Plan --- */}
          <section className="mb-6">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Plan</h3>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2 min-w-0">
                  {isPremium ? (
                    <Crown size={16} className="text-amber-500 shrink-0" fill="currentColor" />
                  ) : subscription ? (
                    <Crown size={16} className="text-slate-400 shrink-0" />
                  ) : (
                    <Star size={16} className="text-slate-400 shrink-0" />
                  )}
                  <span className="font-bold text-slate-900">{planLabel}</span>
                </div>
                {subscription && formatPrice(subscription) && (
                  <span className="text-sm text-slate-600 font-medium shrink-0">
                    {formatPrice(subscription)}
                  </span>
                )}
              </div>

              <div className="p-4 space-y-3">
                {planNote && (
                  <div className={`p-3 rounded-lg border text-xs leading-relaxed font-medium ${noteStyles[planNote.tone]}`}>
                    {planNote.text}
                  </div>
                )}

                {isComplimentary && (
                  <div className="p-3 rounded-lg border border-indigo-100 bg-indigo-50 flex items-start gap-2">
                    <Gift size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-indigo-800 leading-relaxed font-medium">
                      Complimentary Premium, granted by the Psalms &amp; Hymns team. There's no
                      payment method attached and you won't be billed.
                    </p>
                  </div>
                )}

                {/* Only pitch the upgrade to someone with no plan at all — a past_due
                    subscriber needs to fix their card, not buy something. */}
                {!isPremium && !subscription && (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Upgrade for vocal tracks, unlimited playlists, and the ability to create
                    organizations.
                  </p>
                )}

                {portalError && (
                  <div className="p-3 rounded-lg border border-red-100 bg-red-50 flex items-start gap-2">
                    <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 leading-relaxed font-medium">{portalError}</p>
                  </div>
                )}

                {subscription ? (
                  <>
                    <button
                      onClick={handleManageSubscription}
                      disabled={portalLoading}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {portalLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" /> Opening…
                        </>
                      ) : (
                        <>
                          <CreditCard size={16} /> Manage Subscription
                        </>
                      )}
                    </button>
                    <p className="text-[11px] text-slate-400 text-center leading-snug">
                      Opens Stripe, where you can update your card, change your plan, or cancel.
                    </p>
                  </>
                ) : (
                  !isPremium && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenPremium();
                      }}
                      className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                    >
                      <Crown size={16} fill="currentColor" /> Upgrade to Premium
                    </button>
                  )
                )}
              </div>
            </div>
          </section>

          {/* --- Security --- */}
          <section>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Security</h3>
            <div className="rounded-xl border border-slate-200 p-4">
              {usesPassword ? (
                <>
                  {resetSent ? (
                    <div className="flex items-start gap-2">
                      <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                        Password reset link sent to {user.email}. Check your inbox.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500 leading-relaxed mb-3">
                        We'll email you a secure link to choose a new password.
                      </p>
                      {resetError && (
                        <div className="mb-3 p-3 rounded-lg border border-red-100 bg-red-50 flex items-start gap-2">
                          <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-red-700 leading-relaxed font-medium">{resetError}</p>
                        </div>
                      )}
                      <button
                        onClick={handlePasswordReset}
                        disabled={resetLoading}
                        className="w-full bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold py-2.5 px-4 rounded-xl border border-slate-300 flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {resetLoading ? (
                          <>
                            <Loader2 size={16} className="animate-spin" /> Sending…
                          </>
                        ) : (
                          <>
                            <KeyRound size={16} /> Send password reset email
                          </>
                        )}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-500 leading-relaxed">
                  You sign in with Google, so your password is managed in your Google Account.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AccountModal;
