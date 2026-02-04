import React, { useEffect, useState, useRef } from 'react';
import { Loader2, AlertCircle, BellOff } from 'lucide-react';
import * as Tone from 'tone';

interface StartingPitchButtonProps {
  songNumber: string;
}

interface VocalPartsData {
  metadata: {
    workTitle: string;
    movementTitle: string;
    divisions: number;
    tempo: number;
  };
  parts: {
    soprano?: Array<{ pitch: string; duration: number; startTime: number }>;
    alto?: Array<{ pitch: string; duration: number; startTime: number }>;
    tenor?: Array<{ pitch: string; duration: number; startTime: number }>;
    bass?: Array<{ pitch: string; duration: number; startTime: number }>;
  };
}

const StartingPitchButton: React.FC<StartingPitchButtonProps> = ({ songNumber }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeButton, setActiveButton] = useState<number | null>(null);
  const [startingPitch, setStartingPitch] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isIos, setIsIos] = useState(false);
  const loadAttemptedRef = useRef(false);

  // Per-press synth (created on each button press)
  const synthRef = useRef<Tone.Synth | null>(null);

  // Detect iOS
  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) || 
                        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIos(isIosDevice);
  }, []);

  // Helper function to get just the note name (without octave)
  const getNoteName = (pitch: string): string => {
    const match = pitch.match(/^([A-G]#?)\d+$/);
    return match ? match[1] : pitch;
  };

  // Helper function to transpose a pitch by semitones
  const transposePitch = (pitch: string, semitones: number): string => {
    if (semitones === 0) return pitch;
    
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const match = pitch.match(/^([A-G]#?)(\d+)$/);
    if (!match) return pitch;
    
    const noteName = match[1];
    const octave = parseInt(match[2]);
    
    let noteIndex = notes.indexOf(noteName);
    if (noteIndex === -1) return pitch;
    
    noteIndex += semitones;
    let newOctave = octave;
    
    while (noteIndex < 0) {
      noteIndex += 12;
      newOctave--;
    }
    while (noteIndex >= 12) {
      noteIndex -= 12;
      newOctave++;
    }
    
    return notes[noteIndex] + newOctave;
  };

  useEffect(() => {
    loadAttemptedRef.current = false;
    loadStartingPitch();
  }, [songNumber]);

  const loadStartingPitch = async () => {
    if (loadAttemptedRef.current && startingPitch) return;
    
    loadAttemptedRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const jsonUrl = `/VocalParts/${songNumber}.json`;
      const response = await fetch(jsonUrl);
      
      if (!response.ok) {
        throw new Error('Vocal parts not available');
      }

      const data: VocalPartsData = await response.json();
      
      let pitch: string | null = null;
      
      if (data.parts.soprano && data.parts.soprano.length > 0) {
        const firstNote = data.parts.soprano.reduce((earliest, note) => 
          note.startTime < earliest.startTime ? note : earliest
        );
        pitch = firstNote.pitch;
      } else if (data.parts.alto && data.parts.alto.length > 0) {
        const firstNote = data.parts.alto.reduce((earliest, note) => 
          note.startTime < earliest.startTime ? note : earliest
        );
        pitch = firstNote.pitch;
      } else if (data.parts.tenor && data.parts.tenor.length > 0) {
        const firstNote = data.parts.tenor.reduce((earliest, note) => 
          note.startTime < earliest.startTime ? note : earliest
        );
        pitch = firstNote.pitch;
      } else if (data.parts.bass && data.parts.bass.length > 0) {
        const firstNote = data.parts.bass.reduce((earliest, note) => 
          note.startTime < earliest.startTime ? note : earliest
        );
        pitch = firstNote.pitch;
      }

      if (pitch) {
        setStartingPitch(pitch);
      } else {
        throw new Error('No vocal parts found');
      }
    } catch (err: any) {
      console.warn('[StartingPitch] Failed to load:', err);
      setError(err.message || 'Not available');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePointerDown = async (e: React.PointerEvent, transpose: number = 0) => {
    e.preventDefault();
    if (!startingPitch || isPlaying) return;

    console.log('[StartingPitch] Press detected');

    try {
      // Ensure Tone context is started
      await Tone.start();

      // Calculate target pitch with transpose
      const targetPitch = transposePitch(startingPitch, transpose);
      
      console.log('[StartingPitch] Playing:', targetPitch);
      
      // Create a new synth for this press
      const synth = new Tone.Synth({
        oscillator: {
          type: 'triangle'
        },
        envelope: {
          attack: 0.005,
          decay: 0.01,
          sustain: 1,
          release: 0.03
        },
        portamento: 0 // No pitch glide
      }).toDestination();
      
      // Store synth ref
      synthRef.current = synth;
      
      // Trigger attack with correct note immediately
      synth.triggerAttack(targetPitch, Tone.now());
      
      setIsPlaying(true);
      setActiveButton(transpose);
      
      console.log('[StartingPitch] ✅ Playing via new Synth');
    } catch (err) {
      console.error('[StartingPitch] Playback failed:', err);
      setError('Playback failed');
      setTimeout(() => setError(null), 2000);
    }
  };

  const handlePointerUp = (e?: React.PointerEvent) => {
    if (e) e.preventDefault();
    if (!isPlaying) return;

    console.log('[StartingPitch] Release detected');

    try {
      const synth = synthRef.current;
      if (synth) {
        // Release the note
        synth.triggerRelease(Tone.now());
        
        // Dispose synth after release completes
        setTimeout(() => {
          synth.dispose();
          synthRef.current = null;
        }, 100);
      }

      setIsPlaying(false);
      setActiveButton(null);
      
      console.log('[StartingPitch] ✅ Stopped');
    } catch (err) {
      console.error('[StartingPitch] Stop failed:', err);
      setIsPlaying(false);
      setActiveButton(null);
    }
  };

  const handlePointerLeave = () => {
    if (isPlaying) {
      handlePointerUp();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (synthRef.current) {
        try {
          synthRef.current.triggerRelease();
          synthRef.current.dispose();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-center gap-2 text-slate-400 text-sm">
        <Loader2 className="animate-spin" size={16} />
        <span>Loading pitch...</span>
      </div>
    );
  }

  if (error || !startingPitch) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-center gap-2 text-slate-400 text-sm">
        <AlertCircle size={16} />
        <span>Starting pitch not available</span>
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-2">
      {/* Main Starting Pitch Button */}
      <button
        onPointerDown={(e) => handlePointerDown(e, 0)}
        onPointerUp={(e) => handlePointerUp(e)}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={(e) => handlePointerUp(e)}
        className={`w-full rounded-lg p-4 border-2 transition-all duration-150 select-none touch-none ${
          activeButton === 0
            ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
            : 'bg-white border-indigo-300 text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50 shadow-sm'
        }`}
      >
        <div className="text-center">
          <div className="font-bold text-sm">
            {activeButton === 0 ? 'Playing' : 'Starting Pitch'}
          </div>
          <div className={`text-xs ${activeButton === 0 ? 'text-indigo-100' : 'text-slate-500'}`}>
            {activeButton === 0 ? getNoteName(startingPitch) : 'Hold to play'}
          </div>
        </div>
      </button>

      {/* Transpose Options */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onPointerDown={(e) => handlePointerDown(e, -2)}
          onPointerUp={(e) => handlePointerUp(e)}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={(e) => handlePointerUp(e)}
          className={`rounded-lg p-2 border transition-all duration-150 select-none touch-none ${
            activeButton === -2
              ? 'bg-orange-500 border-orange-500 text-white shadow-md'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700'
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-1">
            <div className="font-semibold text-xs">
              {activeButton === -2 ? getNoteName(transposePitch(startingPitch, -2)) : '1 Step Down'}
            </div>
            <div className={`text-[10px] ${activeButton === -2 ? 'text-orange-100' : 'text-slate-400'}`}>
              {activeButton === -2 ? 'Playing' : 'Hold to play'}
            </div>
          </div>
        </button>

        <button
          onPointerDown={(e) => handlePointerDown(e, -1)}
          onPointerUp={(e) => handlePointerUp(e)}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={(e) => handlePointerUp(e)}
          className={`rounded-lg p-2 border transition-all duration-150 select-none touch-none ${
            activeButton === -1
              ? 'bg-amber-500 border-amber-500 text-white shadow-md'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700'
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-1">
            <div className="font-semibold text-xs">
              {activeButton === -1 ? getNoteName(transposePitch(startingPitch, -1)) : '1/2 Step Down'}
            </div>
            <div className={`text-[10px] ${activeButton === -1 ? 'text-amber-100' : 'text-slate-400'}`}>
              {activeButton === -1 ? 'Playing' : 'Hold to play'}
            </div>
          </div>
        </button>
      </div>

      {/* iOS Silent Mode Tip */}
      {isIos && (
        <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1.5 mt-2 px-2">
          <BellOff size={11} className="text-slate-300 shrink-0" />
          <span>iPhone tip: Turn off Silent mode to hear the starting pitch</span>
        </div>
      )}
    </div>
  );
};

export default StartingPitchButton;
