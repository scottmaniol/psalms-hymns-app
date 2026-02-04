import * as Tone from 'tone';

/**
 * A centralized manager for handling all Web Audio API logic, specifically for Tone.js.
 * This ensures a single synth instance and a reliable, one-time audio context unlock.
 */
class AudioManager {
  private synth: Tone.Synth | null = null;
  private isUnlocked = false;

  constructor() {
    // Ensure this class is a singleton
    if ((window as any).audioManagerInstance) {
      return (window as any).audioManagerInstance;
    }
    (window as any).audioManagerInstance = this;
  }

  /**
   * Unlocks the audio context. This must be called from a user gesture (e.g., a click or tap).
   * Returns true if unlock succeeded, false otherwise.
   */
  public async unlockAudio(): Promise<boolean> {
    if (this.isUnlocked) return true;

    try {
      await Tone.start();
      
      // Wait for context to actually be running
      const context = Tone.getContext();
      if (context.state === 'running') {
        this.isUnlocked = true;
        this.initializeSynth();
        console.log('✅ Audio context unlocked successfully!');
        return true;
      } else {
        console.warn('Tone.start() completed but context not running:', context.state);
        return false;
      }
    } catch (error) {
      console.error('Audio unlock failed:', error);
      return false;
    }
  }

  /**
   * Check if audio context is running
   */
  public isContextRunning(): boolean {
    try {
      const context = Tone.getContext();
      return context.state === 'running';
    } catch {
      return false;
    }
  }

  /**
   * Initializes the shared synth instance.
   */
  private initializeSynth() {
    if (this.synth) {
      this.synth.dispose();
    }
    this.synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.02,
        decay: 0.1,
        sustain: 0.8,
        release: 0.5,
      },
      volume: -5,
    }).toDestination();
    console.log('Synth pre-warmed.')
  }

  /**
   * Plays a pitch.
   * @param pitch The note to play (e.g., "C4").
   * @param transpose The transposition in semitones.
   * Returns AUDIO_LOCKED if context not unlocked - caller must unlock first!
   */
  public playPitch(pitch: string, transpose: number = 0): 'PLAYING' | 'AUDIO_LOCKED' | 'ERROR' {
    // Do NOT auto-unlock - caller must unlock explicitly
    if (!this.isUnlocked || !this.isContextRunning()) {
      console.warn('Cannot play pitch: Audio context not unlocked or not running.');
      return 'AUDIO_LOCKED';
    }

    if (!this.synth || this.synth.disposed) {
      this.initializeSynth();
    }

    if (this.synth) {
        this.synth.set({ detune: transpose * 100 });
        this.synth.triggerAttack(pitch);
        return 'PLAYING';
    }
    
    return 'ERROR';
  }

  /**
   * Stops the currently playing pitch.
   */
  public stopPitch() {
    if (this.synth && !this.synth.disposed) {
      this.synth.triggerRelease();
    }
  }
}

// Export a single instance for the entire app
const audioManager = new AudioManager();
export default audioManager;


