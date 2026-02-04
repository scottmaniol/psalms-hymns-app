import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause, RotateCcw, Sliders, Loader2, AlertCircle, FileWarning, ExternalLink, ShieldAlert, Minus, Plus, Gauge, Music } from 'lucide-react';
import * as Tone from 'tone';

export interface VoicePartMixerControls {
  togglePlay: () => void;
  stopAudio: () => void;
}

interface VoicePartMixerProps {
  xmlUrl: string;
  title: string;
  songNumber: string;
  onStateChange: (isPlaying: boolean, progress: number) => void;
  isGloballyActive: boolean;
}

interface NoteEvent {
  pitch: string;
  duration: number; // in seconds (base time)
  startTime: number; // in seconds (base time)
}

interface VoiceParts {
  soprano: NoteEvent[];
  alto: NoteEvent[];
  tenor: NoteEvent[];
  bass: NoteEvent[];
}

const VoicePartMixer = forwardRef<VoicePartMixerControls, VoicePartMixerProps>(({ 
  xmlUrl, 
  title, 
  songNumber,
  onStateChange,
  isGloballyActive
}, ref) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fileFound, setFileFound] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCorsError, setIsCorsError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dataSource, setDataSource] = useState<'json' | 'xml' | null>(null);
  
  // Detect iOS
  const [isIos, setIsIos] = useState(false);
  
  // Audio Settings
  const [speed, setSpeed] = useState(1.0);
  const [transpose, setTranspose] = useState(0);

  // Volumes (0 to 1)
  const [volumes, setVolumes] = useState({
    soprano: 1.0,
    alto: 1.0,
    tenor: 1.0,
    bass: 1.0
  });

  // Tone References
  const synthsRef = useRef<Record<string, Tone.PolySynth>>({});
  const gainsRef = useRef<Record<string, Tone.Gain>>({});
  const voicePartsRef = useRef<VoiceParts | null>(null);
  const durationRef = useRef(0); // Base duration at 1.0x speed
  const progressIntervalRef = useRef<any>(null);
  const isAudioSetupRef = useRef(false);

  // Refs for State (to access in intervals/effects without dependencies)
  const speedRef = useRef(speed);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    onStateChange(isPlaying, progress);
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      onStateChange(true, progress);
    }
  }, [progress]);

  // When global state deactivates this player, ensure it stops locally.
  useEffect(() => {
    if (!isGloballyActive && isPlaying) {
      stopAudio();
    }
  }, [isGloballyActive]);

  // Cleanup Tone on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  // Update gains when volumes change
  useEffect(() => {
    Object.entries(volumes).forEach(([voice, vol]) => {
      if (gainsRef.current[voice]) {
        gainsRef.current[voice].gain.rampTo(vol, 0.1);
      }
    });
  }, [volumes]);

  // Update Pitch (Detune) when transpose changes
  useEffect(() => {
    Object.values(synthsRef.current).forEach(synth => {
        const s = synth as Tone.PolySynth;
        if (!s.disposed) {
            s.set({ detune: transpose * 100 });
        }
    });
  }, [transpose]);

  // Detect iOS on mount
  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = 
      /iphone|ipad|ipod/.test(userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIos(isIosDevice);
  }, []);

  // Initialize on song change
  useEffect(() => {
    loadData();
  }, [xmlUrl, songNumber]);

  const cleanupAudio = () => {
    stopAudio();
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    
    Object.values(synthsRef.current).forEach(s => (s as Tone.PolySynth).dispose());
    Object.values(gainsRef.current).forEach(g => (g as Tone.Gain).dispose());
    synthsRef.current = {};
    gainsRef.current = {};
    isAudioSetupRef.current = false;
  };

  const getFilename = (url: string) => {
      try {
          const decoded = decodeURIComponent(url);
          const parts = decoded.split('/');
          let filePart = parts[parts.length - 1];
          filePart = filePart.split('?')[0]; 
          return filePart.replace("XML/", "");
      } catch (e) {
          return "unknown file";
      }
  };

  const processStaticJson = (data: any): VoiceParts => {
      const bpm = 100; 
      const divisions = data.metadata.divisions;
      const parts: VoiceParts = { soprano: [], alto: [], tenor: [], bass: [] };
      
      let maxTime = 0;

      Object.keys(parts).forEach(key => {
          const voiceKey = key as keyof VoiceParts;
          if (data.parts[key]) {
              data.parts[key].forEach((note: any) => {
                  const durationSec = (note.duration / divisions) * (60 / bpm);
                  const startTimeSec = (note.startTime / divisions) * (60 / bpm);
                  
                  parts[voiceKey].push({
                      pitch: note.pitch,
                      duration: durationSec,
                      startTime: startTimeSec
                  });

                  if (startTimeSec + durationSec > maxTime) {
                      maxTime = startTimeSec + durationSec;
                  }
              });
          }
      });
      
      durationRef.current = maxTime;
      return parts;
  };

  // --- ADVANCED XML PARSING ---
  // This replaces the simple parser to handle chords, split voices, and P1/P2 staves
  const parseMusicXML = (xmlDoc: Document): VoiceParts => {
    const parts: VoiceParts = { soprano: [], alto: [], tenor: [], bass: [] };
    // Default divisions if not found
    let globalDivisions = 4; 
    
    // Try to find divisions in the first measure attributes or global attributes
    const firstDivTag = xmlDoc.querySelector("divisions");
    if (firstDivTag && firstDivTag.textContent) {
        globalDivisions = parseInt(firstDivTag.textContent, 10);
    }

    const part1 = xmlDoc.querySelector(`part[id="P1"]`);
    const part2 = xmlDoc.querySelector(`part[id="P2"]`);

    // Helper to extract pitch
    const extractPitch = (noteNode: Element): string | null => {
        const pitch = noteNode.querySelector('pitch');
        if (!pitch) return null;
        const step = pitch.querySelector('step')?.textContent || 'C';
        const octave = pitch.querySelector('octave')?.textContent || '4';
        const alter = pitch.querySelector('alter')?.textContent;
        let acc = '';
        if (alter === '1') acc = '#';
        if (alter === '-1') acc = 'b';
        return `${step}${acc}${octave}`;
    };

    // Helper to add notes to result array
    const addToPart = (target: NoteEvent[], note: any) => {
        target.push(note);
    };

    // Helper to get MIDI value for sorting chords
    const getMidi = (note: string) => {
        try {
            return Tone.Frequency(note).toMidi();
        } catch (e) {
            return 0;
        }
    };

    // Parse a specific Part (Staff)
    const parsePartData = (partNode: Element | null, isTreble: boolean) => {
        if (!partNode) return;
        
        const measures = Array.from(partNode.querySelectorAll("measure"));
        let currentMeasureStartDivs = 0;

        measures.forEach((measure) => {
            // Update divisions if changed within measure attributes
            const divTag = measure.querySelector("divisions");
            if (divTag && divTag.textContent) {
                globalDivisions = parseInt(divTag.textContent, 10);
            }

            // 1. Collect all notes in the measure with their timing
            // We need to handle <backup> and <forward> tags which move the cursor
            const events: { 
                pitch: string, 
                duration: number, 
                startTime: number, 
                voice: string,
                isChord: boolean 
            }[] = [];
            
            let cursor = 0;
            let maxMeasureDuration = 0; 
            let lastNoteStart = 0; // For chords

            Array.from(measure.children).forEach(child => {
                if (child.tagName === 'note') {
                    const durationNode = child.querySelector('duration');
                    const durationTicks = durationNode ? parseInt(durationNode.textContent || '0', 10) : 0;
                    const isChord = child.querySelector('chord') !== null;
                    const isRest = child.querySelector('rest') !== null;
                    const voice = child.querySelector('voice')?.textContent || '1';
                    
                    let noteStart = cursor;
                    if (isChord) {
                        noteStart = lastNoteStart; 
                    } else {
                        lastNoteStart = cursor;
                    }

                    if (!isRest) {
                        const pitch = extractPitch(child);
                        if (pitch) {
                            events.push({ 
                                pitch, 
                                duration: durationTicks, 
                                startTime: noteStart, 
                                voice, 
                                isChord 
                            });
                        }
                    }

                    if (!isChord) {
                        cursor += durationTicks;
                        if (cursor > maxMeasureDuration) maxMeasureDuration = cursor;
                    }
                } else if (child.tagName === 'backup') {
                    const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10);
                    cursor -= dur;
                } else if (child.tagName === 'forward') {
                    const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10);
                    cursor += dur;
                    if (cursor > maxMeasureDuration) maxMeasureDuration = cursor;
                }
            });

            // 2. Assign to voices based on rules
            const hasVoice2 = events.some(e => e.voice === '2');

            if (hasVoice2) {
                // Logic A: Split Voices (Polyphonic)
                events.forEach(e => {
                    const noteObj = { 
                        pitch: e.pitch, 
                        duration: e.duration, 
                        startTime: currentMeasureStartDivs + e.startTime 
                    };

                    if (isTreble) {
                        // P1: Voice 1 = Soprano, Voice 2 = Alto
                        if (e.voice === '1') addToPart(parts.soprano, noteObj);
                        else if (e.voice === '2') addToPart(parts.alto, noteObj);
                    } else {
                        // P2: Voice 1 = Tenor, Voice 2 = Bass
                        if (e.voice === '1') addToPart(parts.tenor, noteObj);
                        else if (e.voice === '2') addToPart(parts.bass, noteObj);
                    }
                });
            } else {
                // Logic B: Single Voice / Chords (Homophonic)
                // Group by startTime to identify chords
                const groups: Record<number, typeof events> = {};
                events.forEach(e => {
                    if (!groups[e.startTime]) groups[e.startTime] = [];
                    groups[e.startTime].push(e);
                });

                Object.entries(groups).forEach(([start, groupEvents]) => {
                    const startTick = parseInt(start, 10);
                    const absStart = currentMeasureStartDivs + startTick;
                    
                    // Sort by pitch ascending [Low, ..., High]
                    groupEvents.sort((a, b) => getMidi(a.pitch) - getMidi(b.pitch));

                    // Get lowest and highest notes of the chord
                    const lowNote = groupEvents[0];
                    const highNote = groupEvents[groupEvents.length - 1];

                    const lowObj = { pitch: lowNote.pitch, duration: lowNote.duration, startTime: absStart };
                    const highObj = { pitch: highNote.pitch, duration: highNote.duration, startTime: absStart };

                    if (isTreble) {
                        if (groupEvents.length === 1) {
                            // Logic C: Single note -> Soprano
                            addToPart(parts.soprano, highObj);
                        } else {
                            // Chord: Highest -> Soprano, Lowest -> Alto
                            addToPart(parts.alto, lowObj);
                            addToPart(parts.soprano, highObj);
                        }
                    } else {
                        // Bass Staff (P2)
                        if (groupEvents.length === 1) {
                            // Logic: Single note in Bass staff defaults to Bass
                            addToPart(parts.bass, lowObj);
                        } else {
                            // Chord: Highest -> Tenor, Lowest -> Bass
                            addToPart(parts.bass, lowObj);
                            addToPart(parts.tenor, highObj);
                        }
                    }
                });
            }

            // Advance global cursor by measure duration
            currentMeasureStartDivs += maxMeasureDuration;
        });
        
        // Return total duration for this part
        return currentMeasureStartDivs;
    };

    const dur1 = parsePartData(part1, true); // Treble
    const dur2 = parsePartData(part2, false); // Bass

    const maxDurationTicks = Math.max(dur1 || 0, dur2 || 0);
    
    // Conversion to Seconds
    // Assuming standard 100 BPM for relative timing calculation
    const BPM = 100; 
    const convertToSeconds = (partEvents: any[]) => {
        return partEvents.map(e => ({
            pitch: e.pitch,
            duration: (e.duration / globalDivisions) * (60 / BPM),
            startTime: (e.startTime / globalDivisions) * (60 / BPM)
        })).sort((a, b) => a.startTime - b.startTime);
    };

    const finalParts = {
        soprano: convertToSeconds(parts.soprano),
        alto: convertToSeconds(parts.alto),
        tenor: convertToSeconds(parts.tenor),
        bass: convertToSeconds(parts.bass)
    };

    // Calculate total duration in seconds
    durationRef.current = (maxDurationTicks / globalDivisions) * (60 / BPM);

    return finalParts;
  };

  const loadData = async () => {
    cleanupAudio();
    setFileFound(null);
    setErrorMsg(null);
    setIsCorsError(false);
    setIsLoading(true);
    setIsPlaying(false);
    setProgress(0);
    setDataSource(null);
    setSpeed(1.0);
    setTranspose(0);

    // 1. Attempt to load pre-processed JSON first (Optimization)
    try {
        const jsonUrl = `/VocalParts/${songNumber}.json`;
        const response = await fetch(jsonUrl);
        
        if (response.ok) {
            const data = await response.json();
            const parts = processStaticJson(data);
            voicePartsRef.current = parts;
            setFileFound(true);
            setDataSource('json');
            setIsLoading(false);
            return; 
        }
    } catch (e) {
        // Ignore JSON error, proceed to XML
    }

    // 2. Fallback to Dynamic XML Parsing
    if (!xmlUrl) {
        setFileFound(false);
        setErrorMsg("No XML URL provided.");
        setIsLoading(false);
        return;
    }

    try {
      const response = await fetch(xmlUrl);
      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
            setFileFound(false);
            setErrorMsg(`File not found: ${getFilename(xmlUrl)}`);
            setIsLoading(false);
            return;
        }
        throw new Error(`Failed to load XML: ${response.statusText}`);
      }

      const text = await response.text();
      if (text.includes("<Error>") || text.includes("<Code>AccessDenied</Code>")) {
          setFileFound(false);
          setErrorMsg(`Access Denied or File Missing: ${getFilename(xmlUrl)}`);
          setIsLoading(false);
          return;
      }

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");
      
      if (xmlDoc.querySelector("parsererror")) {
        throw new Error("Invalid XML format");
      }

      // Use the robust parser
      const parsedParts = parseMusicXML(xmlDoc);
      voicePartsRef.current = parsedParts;
      setFileFound(true);
      setDataSource('xml');

    } catch (err: any) {
      console.warn("Voice Mixer Load Error:", err);
      setFileFound(false);
      
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
          setIsCorsError(true);
          setErrorMsg("Access Blocked (CORS). The file exists but cannot be read by the app.");
      } else {
          setErrorMsg(err.message || "Unknown error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- AUDIO SETUP & CONTROL ---

  const setupAudioNodes = async () => {
    if (isAudioSetupRef.current) return;
    await Tone.start();

    Object.values(synthsRef.current).forEach(s => (s as Tone.PolySynth).dispose());
    Object.values(gainsRef.current).forEach(g => (g as Tone.Gain).dispose());

    const voices = ["soprano", "alto", "tenor", "bass"];
    voices.forEach(v => {
      const gain = new Tone.Gain(volumes[v as keyof typeof volumes]).toDestination();
      gainsRef.current[v] = gain;

      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: {
          attack: 0.05,
          decay: 0.1,
          sustain: 0.8,
          release: 1.0
        },
        volume: -8, 
        detune: transpose * 100 // Initialize with current transpose
      });
      
      synth.maxPolyphony = 32;
      synth.connect(gain);
      synthsRef.current[v] = synth;
    });
    isAudioSetupRef.current = true;
  };

  const scheduleEvents = () => {
      Tone.Transport.cancel();
      const parts = voicePartsRef.current;
      if (!parts) return;

      Object.entries(parts).forEach(([voiceName, events]) => {
          (events as NoteEvent[]).forEach(evt => {
              // Scale time and duration by speed
              const sTime = evt.startTime / speed;
              const sDur = evt.duration / speed;
              
              Tone.Transport.schedule((time) => {
                  const synth = synthsRef.current[voiceName] as Tone.PolySynth;
                  if (synth && !synth.disposed) {
                      synth.triggerAttackRelease(evt.pitch, sDur, time);
                  }
              }, sTime);
          });
      });

      // Stop at end
      const effectiveDuration = durationRef.current / speed;
      Tone.Transport.schedule(() => {
          stopAudio();
      }, effectiveDuration + 1.0);
  };

  const togglePlay = async () => {
    // If we're not globally active, this play action should make us active.
    // The parent will handle this via onStateChange and then can call back via ref if needed.
    // For now, we just proceed with local playback logic.

    if (isPlaying) {
      pauseAudio();
    } else {
      await setupAudioNodes(); 
      
      if (Tone.Transport.state !== 'started') {
          scheduleEvents();
      }

      Tone.Transport.start();
      setIsPlaying(true);
      
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = setInterval(() => {
          const t = Tone.Transport.seconds;
          // Use ref for current speed to avoid closure staleness
          const effectiveDuration = durationRef.current / speedRef.current;
          if (effectiveDuration > 0) {
              setProgress(Math.min(100, (t / effectiveDuration) * 100));
          }
      }, 100);
    }
  };

  const pauseAudio = () => {
    Tone.Transport.pause();
    Object.values(synthsRef.current).forEach(s => (s as Tone.PolySynth).releaseAll());
    setIsPlaying(false);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  };

  const stopAudio = () => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Object.values(synthsRef.current).forEach(s => (s as Tone.PolySynth).releaseAll());
    setIsPlaying(false);
    setProgress(0);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  };

  // Expose controls to parent component
  useImperativeHandle(ref, () => ({
    togglePlay,
    stopAudio
  }));

  const handleSpeedChange = (newSpeed: number) => {
      if (!voicePartsRef.current) return;
      setSpeed(newSpeed);
  };

  // Effect to handle rescheduling when speed changes
  useEffect(() => {
      if (!voicePartsRef.current || !isAudioSetupRef.current) return;

      const wasPlaying = isPlayingRef.current;
      
      // Temporarily pause transport to reschedule events safely
      if (Tone.Transport.state === 'started') {
          Tone.Transport.pause();
      }
      
      // Reschedule with new speed value
      scheduleEvents(); 
      
      // Seek to correct time relative to progress
      const newEffectiveDuration = durationRef.current / speed;
      const newTime = (progress / 100) * newEffectiveDuration;
      if (isFinite(newTime)) {
          Tone.Transport.seconds = newTime;
      }

      // If we were playing, resume immediately
      if (wasPlaying) {
          Tone.Transport.start();
      }
      
  }, [speed]);

  const handleVolumeChange = (voice: keyof typeof volumes, val: number) => {
    setVolumes(prev => ({ ...prev, [voice]: val }));
  };

  return (
    <div className={`mt-6 bg-white rounded-xl p-5 border shadow-sm animate-in fade-in duration-500 min-h-[200px] ${isGloballyActive ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${fileFound === false ? 'bg-red-50 text-red-500' : 'bg-indigo-100 text-indigo-600'}`}>
                {fileFound === false ? <FileWarning size={20} /> : <Sliders size={20} />}
            </div>
            <div>
                <h3 className="font-bold text-slate-800 text-sm">Voice Parts Mixer</h3>
                <p className="text-xs text-slate-500">
                  {isGloballyActive ? <span className="text-indigo-600 font-bold">Active in Player</span> : 'Practice parts individually (SATB)'}
                </p>
            </div>
        </div>
        {isLoading && (
            <div className="flex items-center gap-2 text-xs text-indigo-500">
                <Loader2 className="animate-spin" size={14} />
                Processing...
            </div>
        )}
      </div>

      {/* iOS Unmute Reminder */}
      {isIos && fileFound === true && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 animate-in fade-in">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="text-xs">
              <p className="font-bold mb-1">iPhone/iPad Users:</p>
              <p>Make sure your device is <strong>unmuted</strong> (ringer switch on) to hear the voice parts mixer.</p>
            </div>
          </div>
        </div>
      )}

      {fileFound === false ? (
          <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-sm text-red-800 animate-in fade-in">
              <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <div className="w-full min-w-0">
                        <p className="font-bold mb-1">{isCorsError ? "CORS Configuration Needed" : "Voice Parts Not Found"}</p>
                        <p className="mb-2 opacity-90 text-xs">{errorMsg}</p>
                    </div>
                  </div>
                  
                  <div className="bg-white p-2 rounded border border-red-200 overflow-x-auto">
                      <p className="text-[10px] text-slate-500 font-mono whitespace-nowrap">{xmlUrl}</p>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                      <a 
                        href={xmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-bold bg-white border border-red-200 text-red-700 px-3 py-2 rounded hover:bg-red-50 transition-colors"
                      >
                          <ExternalLink size={12} /> Test Link
                      </a>
                      <button 
                        onClick={loadData}
                        className="text-xs font-bold bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded transition-colors"
                      >
                          Retry
                      </button>
                  </div>
                  
                  {isCorsError && (
                      <div className="mt-3 bg-white p-2 rounded border border-red-100 text-[10px] text-red-700">
                          <p className="font-bold flex items-center gap-1 mb-1"><ShieldAlert size={10}/> Admin Fix Required</p>
                          <p>The file exists (Test Link works), but the server is blocking the app from reading it. Please configure CORS in the Admin Dashboard.</p>
                      </div>
                  )}
              </div>
          </div>
      ) : (
        <div className={isLoading ? 'opacity-50 pointer-events-none' : ''}>
            {/* Main Controls */}
            <div className="flex items-center gap-3 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <button 
                    onClick={stopAudio}
                    disabled={!isPlaying}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                    title="Reset"
                >
                    <RotateCcw size={16} />
                </button>
                <button
                    onClick={togglePlay}
                    disabled={isLoading}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm transition-all shrink-0 ${
                        isPlaying ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-600 hover:bg-indigo-700'
                    } disabled:opacity-50 disabled:bg-slate-400`}
                >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                </button>
                
                <div className="flex-1 relative h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-indigo-600 transition-all duration-100 ease-linear" 
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Voice Sliders */}
            <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-6">
                {(['soprano', 'alto', 'tenor', 'bass'] as const).map((voice) => (
                    <div key={voice} className="flex flex-col items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        
                        {/* Visual Track Wrapper */}
                        <div className="h-32 w-8 relative flex justify-center">
                            {/* Track Background */}
                            <div className="absolute h-full w-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                    className={`absolute bottom-0 w-full transition-all duration-75 ${
                                        voice === 'soprano' ? 'bg-rose-400' :
                                        voice === 'alto' ? 'bg-amber-400' :
                                        voice === 'tenor' ? 'bg-emerald-400' : 'bg-sky-400'
                                    }`}
                                    style={{ height: `${volumes[voice] * 100}%` }}
                                />
                            </div>
                            
                            {/* Invisible Range Input */}
                            <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.05"
                                value={volumes[voice]}
                                onChange={(e) => handleVolumeChange(voice, parseFloat(e.target.value))}
                                className="absolute w-32 h-8 -rotate-90 top-12 cursor-pointer opacity-0"
                                style={{ transformOrigin: 'center' }}
                                title={`${voice} Volume`}
                            />
                            
                            {/* Knob Visual */}
                            <div 
                                className="absolute w-4 h-4 bg-white border shadow-sm rounded-full pointer-events-none transition-all duration-75 left-2"
                                style={{ 
                                    bottom: `calc(${volumes[voice] * 100}% - 8px)`,
                                    borderColor: voice === 'soprano' ? '#fb7185' : voice === 'alto' ? '#fbbf24' : voice === 'tenor' ? '#34d399' : '#38bdf8'
                                }} 
                            />
                        </div>

                        <div className="text-center">
                            <span className="text-xs font-bold text-slate-700 block mb-0.5 capitalize">
                                {voice}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block">
                                {Math.round(volumes[voice] * 100)}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Playback Settings (Speed & Pitch) */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-3">
                {/* Speed Control */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 w-24">
                        <Gauge size={14} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-600">Speed</span>
                    </div>
                    <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                        <button onClick={() => handleSpeedChange(Math.max(0.5, Number((speed - 0.1).toFixed(1))))} className="text-slate-400 hover:text-indigo-600 p-1"><Minus size={14}/></button>
                        <div className="flex-1 relative h-6 flex items-center">
                            <input 
                                type="range" min="0.5" max="2.0" step="0.1" 
                                value={speed} 
                                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                        </div>
                        <button onClick={() => handleSpeedChange(Math.min(2.0, Number((speed + 0.1).toFixed(1))))} className="text-slate-400 hover:text-indigo-600 p-1"><Plus size={14}/></button>
                    </div>
                    <div className="w-12 text-right text-xs font-mono text-slate-600">{speed.toFixed(1)}x</div>
                    {speed !== 1.0 && <button onClick={() => handleSpeedChange(1.0)} className="ml-2 text-[10px] text-indigo-600 hover:underline">Reset</button>}
                </div>

                {/* Pitch Control */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 w-24">
                        <Music size={14} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-600">Pitch</span>
                    </div>
                    <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                        <button onClick={() => setTranspose(Math.max(-12, transpose - 1))} className="text-slate-400 hover:text-indigo-600 p-1"><Minus size={14}/></button>
                        <div className="flex-1 relative h-6 flex items-center">
                            <input 
                                type="range" min="-12" max="12" step="1" 
                                value={transpose} 
                                onChange={(e) => setTranspose(parseInt(e.target.value))}
                                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                        </div>
                        <button onClick={() => setTranspose(Math.min(12, transpose + 1))} className="text-slate-400 hover:text-indigo-600 p-1"><Plus size={14}/></button>
                    </div>
                    <div className="w-12 text-right text-xs font-mono text-slate-600">{transpose > 0 ? '+' : ''}{transpose}</div>
                    {transpose !== 0 && <button onClick={() => setTranspose(0)} className="ml-2 text-[10px] text-indigo-600 hover:underline">Reset</button>}
                </div>
            </div>
        </div>
      )}
    </div>
  );
});

export default VoicePartMixer;
