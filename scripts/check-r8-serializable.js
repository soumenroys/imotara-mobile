#!/usr/bin/env node
// Post-build check: did R8 keep NotificationContent's serialization hooks?
//
// Run after `assembleRelease` (or against an EAS build's outputs). Reads R8's
// seeds.txt (members matched by -keep rules) and usage.txt (members removed)
// and fails unless writeObject/readObject are KEPT and NOT removed — the exact
// pair whose stripping made daily reminders impossible to schedule on Android
// (NotSerializableException: org.json.JSONObject, 2026-09-16).
//
// ⚠️ Do not use mapping.txt for this. R8's mapping lists only RENAMED members;
// once the class is fully kept its hooks vanish from the mapping precisely
// because they are safe — the first version of this script read that as
// "stripped" and failed on the fixed build.
const fs = require("fs");
const path = require("path");
const dir = process.argv[2] || path.join(__dirname, "..", "android", "app", "build", "outputs", "mapping", "release");
const seedsPath = path.join(dir, "seeds.txt"), usagePath = path.join(dir, "usage.txt");
for (const p of [seedsPath, usagePath]) if (!fs.existsSync(p)) { console.error(`✗ not found: ${p}`); process.exit(2); }
const CLS = "expo.modules.notifications.notifications.model.NotificationContent";
const seeds = fs.readFileSync(seedsPath, "utf8");
const keptWrite = new RegExp(`^${CLS.replace(/\./g, "\\.")}: .*void writeObject\\(java\\.io\\.ObjectOutputStream\\)`, "m").test(seeds);
const keptRead  = new RegExp(`^${CLS.replace(/\./g, "\\.")}: .*void readObject\\(java\\.io\\.ObjectInputStream\\)`, "m").test(seeds);
const usage = fs.readFileSync(usagePath, "utf8").split("\n");
const i = usage.indexOf(CLS);
let removed = [];
if (i >= 0) { for (let k = i + 1; k < usage.length && usage[k].startsWith("    "); k++) if (/writeObject|readObject/.test(usage[k])) removed.push(usage[k].trim()); }
if (!seeds.includes(CLS + ":") && !seeds.includes(CLS)) { console.error(`✗ ${CLS} absent from seeds.txt — is expo-notifications in this build, and is it kept at all?`); process.exit(1); }
if (keptWrite && keptRead && removed.length === 0) { console.log("✓ R8 kept NotificationContent.writeObject/readObject (seeds) and removed neither (usage) — scheduled reminders will serialize"); process.exit(0); }
console.error(`✗ serialization hooks at risk — kept: writeObject=${keptWrite} readObject=${keptRead}; removed: ${removed.length ? removed.join(" | ") : "none"}`);
console.error("  Reminders will fail with NotSerializableException. Check expo-build-properties.android.extraProguardRules in app.json.");
process.exit(1);
