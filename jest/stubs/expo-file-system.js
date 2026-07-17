// Test stub for expo-file-system (SDK 54 File/Paths API).
class File {
  constructor(...parts) { this.uri = parts.join("/"); }
  async write() {}
  async delete() {}
  get exists() { return false; }
}
module.exports = {
  File,
  Paths: { cache: "/tmp/jest-cache", document: "/tmp/jest-doc" },
  Directory: class Directory {},
};
