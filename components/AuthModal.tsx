
import React, { useState } from 'react';
import { X, Mail, Lock, LogIn, UserPlus, AlertCircle, Loader2, KeyRound, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  sendPasswordResetEmail,
  User
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const resetState = () => {
      setError(null);
      setSuccess(null);
      setLoading(false);
      setShowPassword(false);
  }

  const handleClose = () => {
      resetState();
      setIsResetMode(false);
      setPassword(''); 
      onClose();
  }

  // Helper to sync user to Firestore for Admin Dashboard visibility
  const syncUserToFirestore = async (user: User) => {
    try {
      const userRef = doc(db, "users", user.uid);
      
      const payload: any = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '',
        lastLoginAt: serverTimestamp(),
        // We use merge: true to avoid overwriting existing fields like isPremium or isAdmin
      };

      // Auto-grant admin to specific email
      if (user.email === 'saniol@gmail.com') {
          payload.isAdmin = true;
      }

      await setDoc(userRef, payload, { merge: true });
    } catch (e) {
      console.error("Error syncing user to DB:", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();
    setLoading(true);

    try {
      if (isResetMode) {
        await sendPasswordResetEmail(auth, email);
        setSuccess("Password reset email sent! Check your inbox.");
      } else if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await syncUserToFirestore(cred.user);
        handleClose();
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // For new users, we set created at
        const userRef = doc(db, "users", cred.user.uid);
        const payload: any = {
            uid: cred.user.uid,
            email: cred.user.email,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            isPremium: false,
            isAdmin: false
        };

        if (cred.user.email === 'saniol@gmail.com') {
            payload.isAdmin = true;
        }

        await setDoc(userRef, payload);
        handleClose();
      }
    } catch (err: any) {
      const code = err.code;
      // Only log unexpected errors to console
      if (code !== 'auth/invalid-credential' && code !== 'auth/user-not-found' && code !== 'auth/wrong-password' && code !== 'auth/weak-password') {
          console.error(err);
      }
      
      let msg = "An error occurred.";
      
      switch (code) {
        case 'auth/invalid-credential':
          msg = "Invalid email or password.";
          break;
        case 'auth/user-not-found':
          msg = "No account found with this email.";
          break;
        case 'auth/wrong-password':
          msg = "Incorrect password.";
          break;
        case 'auth/email-already-in-use':
          msg = "An account already exists with this email.";
          break;
        case 'auth/weak-password':
          msg = "Password should be at least 6 characters.";
          break;
        case 'auth/invalid-email':
          msg = "Please enter a valid email address.";
          break;
        case 'auth/too-many-requests':
          msg = "Too many attempts. Please try again later.";
          break;
        default:
          msg = err.message || "An error occurred.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    resetState();
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const cred = await signInWithPopup(auth, provider);
      await syncUserToFirestore(cred.user);
      handleClose();
    } catch (err: any) {
        const errorCode = err.code;
        const errorMessage = err.message;
        const currentDomain = window.location.hostname;

        if (errorCode === 'auth/unauthorized-domain' || (errorMessage && errorMessage.includes('unauthorized domain'))) {
            console.warn(`Firebase Auth Error: The domain ${currentDomain} is not authorized.`);
            
            setError(`Configuration Error: The domain "${currentDomain}" is not authorized for Google Sign In. Please add it to your Firebase Console under Authentication > Settings > Authorized Domains.`);
        } 
        else if (errorCode === 'auth/popup-closed-by-user') {
            setError("Sign in cancelled.");
        } 
        else if (errorCode === 'auth/popup-blocked') {
            setError("Sign in popup was blocked by the browser. Please allow popups for this site.");
        } 
        else {
            console.error("Google Sign In Error", err);
            setError("Could not sign in with Google. " + (errorMessage || "Please try again."));
        }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex justify-between items-center">
            <div>
                <h2 className="text-xl font-bold text-slate-900">
                    {isResetMode ? 'Reset Password' : (isLogin ? 'Welcome Back' : 'Create Account')}
                </h2>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                    {isResetMode 
                        ? 'Enter your email to receive instructions.' 
                        : 'Save custom playlists, join organizations, and sync your account across all devices.'
                    }
                </p>
            </div>
            <button 
                onClick={handleClose}
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
            >
                <X size={20} />
            </button>
        </div>

        <div className="p-6 space-y-6">
            {/* Google Sign In - Only show if NOT in reset mode */}
            {!isResetMode && (
                <>
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 text-slate-700 font-medium py-2.5 px-4 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-70"
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                        <span>Continue with Google</span>
                    </button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-slate-500">Or continue with email</span>
                        </div>
                    </div>
                </>
            )}

            {/* Email Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <span className="break-words text-xs leading-relaxed">{error}</span>
                    </div>
                )}

                {success && (
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm p-3 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <CheckCircle size={16} className="mt-0.5 shrink-0" />
                        <span className="break-words text-xs leading-relaxed">{success}</span>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email</label>
                    <div className="relative">
                        <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="name@example.com"
                        />
                    </div>
                </div>

                {!isResetMode && (
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Password</label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-10 p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="••••••••"
                                minLength={6}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-md hover:bg-slate-100 transition-colors"
                                title={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {isLogin && (
                            <div className="flex justify-end mt-1">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        resetState();
                                        setIsResetMode(true);
                                    }}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                                >
                                    Forgot Password?
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
                >
                    {loading ? (
                        <Loader2 size={20} className="animate-spin" />
                    ) : isResetMode ? (
                        <>
                            <KeyRound size={18} /> Send Reset Link
                        </>
                    ) : isLogin ? (
                        <>
                            <LogIn size={18} /> Sign In
                        </>
                    ) : (
                        <>
                            <UserPlus size={18} /> Create Account
                        </>
                    )}
                </button>

                {isResetMode && (
                    <button
                        type="button"
                        onClick={() => {
                            resetState();
                            setIsResetMode(false);
                        }}
                        className="w-full text-slate-500 font-medium py-2 text-sm hover:text-slate-700 flex items-center justify-center gap-2"
                    >
                        <ArrowLeft size={16} /> Back to Login
                    </button>
                )}
            </form>

            {/* Toggle Login/Signup (Only show if not in reset mode) */}
            {!isResetMode && (
                <div className="text-center text-sm">
                    <span className="text-slate-600">
                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                    </span>
                    <button 
                        onClick={() => {
                            setIsLogin(!isLogin);
                            resetState();
                        }}
                        className="text-indigo-600 font-bold hover:underline"
                    >
                        {isLogin ? 'Sign Up' : 'Log In'}
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
