// Test stub for expo-av (native module 'ExponentAV' is unavailable under Jest).
// Only the surface mobileTTS touches; extend as needed.
class Sound {
  async loadAsync() { return { isLoaded: true }; }
  async unloadAsync() {}
  async playAsync() {}
  async stopAsync() {}
  setOnPlaybackStatusUpdate() {}
  async setRateAsync() {}
}
Sound.createAsync = async () => ({ sound: new Sound(), status: { isLoaded: true } });
module.exports = {
  Audio: {
    Sound,
    setAudioModeAsync: async () => {},
    setIsEnabledAsync: async () => {},
  },
};
