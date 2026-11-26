// expo-audio/build/utils/options under Jest — same flattening as the real one (android branch).
module.exports = { createRecordingOptions: (o) => ({ extension: o.extension, sampleRate: o.sampleRate, numberOfChannels: o.numberOfChannels, bitRate: o.bitRate, isMeteringEnabled: o.isMeteringEnabled ?? false, ...(o.android || {}) }) };
