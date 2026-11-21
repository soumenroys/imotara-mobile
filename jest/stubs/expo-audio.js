// Test stub for expo-audio (native module 'ExpoAudio' is unavailable under Jest).
// Only the surface src/lib/audio/av.ts touches. Tests can swap behaviour through
// `__controls` (e.g. make prepareToRecordAsync reject for one source).
const controls = { refuseSources: new Set(), lastRecorderOptions: [], modes: [] };

class AudioRecorder {
  constructor(options) { this.options = options; this.uri = null; this.isRecording = false; this.released = false; controls.lastRecorderOptions.push(options); }
  async prepareToRecordAsync() {
    if (controls.refuseSources.has(this.options.audioSource)) throw new Error("source refused");
    this.uri = "file:///tmp/rec-" + controls.lastRecorderOptions.length + ".m4a";
  }
  record() { this.isRecording = true; }
  async stop() { this.isRecording = false; }
  getStatus() { return { canRecord: true, isRecording: this.isRecording, durationMillis: 1200, metering: -30 }; }
  release() { this.released = true; }
}

class Player {
  constructor(source) { this.source = source; this.isLoaded = true; this.volume = 1; this.loop = false; this.playing = false; this.listeners = []; this.removed = false; this.rate = 1; this.pitch = undefined; }
  get currentStatus() { return { isLoaded: true, playing: this.playing, didJustFinish: false, currentTime: 0, duration: 1, loop: this.loop }; }
  addListener(_ev, cb) { this.listeners.push(cb); return { remove: () => { this.listeners = this.listeners.filter((l) => l !== cb); } }; }
  emit(s) { this.listeners.slice().forEach((l) => l(s)); }
  setPlaybackRate(rate, pitch) { this.rate = rate; this.pitch = pitch; }
  play() { this.playing = true; }
  pause() { this.playing = false; }
  async seekTo() {}
  remove() { this.removed = true; }
}
const players = [];
module.exports = {
  __controls: controls,
  __players: players,
  createAudioPlayer: (source) => { const p = new Player(source); players.push(p); return p; },
  setAudioModeAsync: async (m) => { controls.modes.push(m); },
  requestRecordingPermissionsAsync: async () => ({ granted: true, canAskAgain: true, status: "granted" }),
  getRecordingPermissionsAsync: async () => ({ granted: true, canAskAgain: true, status: "granted" }),
  RecordingPresets: {
    HIGH_QUALITY: { extension: ".m4a", sampleRate: 44100, numberOfChannels: 2, bitRate: 128000, android: { outputFormat: "mpeg4", audioEncoder: "aac" }, ios: { audioQuality: 127 } },
    LOW_QUALITY: { extension: ".m4a", sampleRate: 44100, numberOfChannels: 2, bitRate: 64000, android: { extension: ".3gp", outputFormat: "3gp", audioEncoder: "amr_nb" }, ios: { audioQuality: 32 } },
  },
  __AudioRecorder: AudioRecorder,
};
