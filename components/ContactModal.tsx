import React, { useState } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent("App Feedback: Psalms & Hymns");
    // We include the user's email in the body in case their mail client defaults don't make it obvious,
    // though the email will come FROM them.
    const body = encodeURIComponent(`User Email: ${email}\n\nMessage:\n${message}`);
    
    // Open default mail client
    window.location.href = `mailto:saniol@gmail.com?subject=${subject}&body=${body}`;
    
    // Close modal after a short delay to allow the action to register
    setTimeout(() => {
        onClose();
        setEmail('');
        setMessage('');
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare className="text-indigo-600" size={20} />
            Contact & Report
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSend} className="p-6 space-y-4 flex-1 overflow-y-auto">
          <p className="text-sm text-slate-600 mb-4">
            Have a feature request or found an error? Please let us know below. 
            Clicking send will open your email client.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Your Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-base text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Message</label>
            <textarea 
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the error or feature request..."
              rows={5}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-base text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Send size={18} />
            Send Message
          </button>
        </form>
      </div>
    </div>
  );
};

export default ContactModal;