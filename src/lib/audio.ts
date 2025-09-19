export class RingToneGenerator {
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying = false;

  async start() {
    if (this.isPlaying) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.oscillator = this.audioContext.createOscillator();
      this.gainNode = this.audioContext.createGain();

      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      // Create a pleasant ring tone pattern
      this.oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4
      this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      
      // Ring pattern: on for 1s, off for 0.5s, on for 1s, off for 3s
      const now = this.audioContext.currentTime;
      this.gainNode.gain.setValueAtTime(0.1, now);
      this.gainNode.gain.setValueAtTime(0.1, now + 1);
      this.gainNode.gain.setValueAtTime(0, now + 1);
      this.gainNode.gain.setValueAtTime(0, now + 1.5);
      this.gainNode.gain.setValueAtTime(0.1, now + 1.5);
      this.gainNode.gain.setValueAtTime(0.1, now + 2.5);
      this.gainNode.gain.setValueAtTime(0, now + 2.5);

      this.oscillator.start();
      this.isPlaying = true;

      // Auto-repeat every 4.5 seconds
      setTimeout(() => {
        if (this.isPlaying) {
          this.stop();
          this.start();
        }
      }, 4500);

    } catch (error) {
      console.error('Failed to start ring tone:', error);
    }
  }

  stop() {
    if (!this.isPlaying) return;

    try {
      if (this.oscillator) {
        this.oscillator.stop();
        this.oscillator.disconnect();
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
      }
      if (this.audioContext) {
        this.audioContext.close();
      }
    } catch (error) {
      console.error('Error stopping ring tone:', error);
    }

    this.oscillator = null;
    this.gainNode = null;
    this.audioContext = null;
    this.isPlaying = false;
  }
}

export const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
};