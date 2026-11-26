// Dec release check (26 Nov 2026): "I'm stressed and overwhelmed" was saved as the person's job.
// 🔴 MIRRORED in the web repo src/__tests__/memoryFactsNoFeelingsAsJobs.test.ts

import { occupationFrom, occupationFact, placeFact, repairLegacyFact } from "../state/memoryFacts";

const NOT_JOBS = [
  "I'm stressed and overwhelmed",
  "I am so tired of everything",
  "I'm a mess right now",
  "I'm a bit lost",
  "I'm worried my teacher hates me",
  "I'm a terrible person",
  "I'm a burden to my family",
  "i am feeling low today",
  "my job is killing me",
  "I'm not a student anymore", // ⚠️ "not" is not a job word — must stay null
];

const JOBS: [string, string][] = [
  ["I'm a teacher at a school in Pune", "teacher"],
  ["I work as a nurse and I'm exhausted", "nurse"],
  ["I am an engineer.", "engineer"],
  ["I'm a software engineer", "software engineer"],
  ["I am teacher", "teacher"],
  ["I am working as a driver", "driver"],
  ["I'm a student nurse", "student nurse"],
  ["I'm a worried student", "student"],
  ["I’m a doctor", "doctor"],
];

describe("occupationFrom", () => {
  it.each(NOT_JOBS)("never makes a job out of: %s", (t) => {
    expect(occupationFrom(t)).toBeNull();
  });
  it.each(JOBS)("finds the job in: %s", (t, job) => {
    expect(occupationFrom(t)).toBe(job);
  });
  it("plain English with the right article", () => {
    expect(occupationFact("engineer")).toBe("User works as an engineer");
    expect(occupationFact("teacher")).toBe("User works as a teacher");
  });
});

describe("placeFact", () => {
  it("names the place with the right verb", () => {
    expect(placeFact("I live in Kolkata and work in IT")).toBe("User lives in Kolkata");
    expect(placeFact("I'm from Lagos.")).toBe("User is from Lagos");
    expect(placeFact("I'm based in New York City now")).toBe("User is based in New York City");
  });
  it("ignores things that are not places", () => {
    expect(placeFact("I live in fear every day")).toBeNull();
    expect(placeFact("I'm from a small town")).toBeNull();
  });
});

describe("repairLegacyFact (rows saved before the fix)", () => {
  it("drops a feeling saved as a job", () => {
    expect(repairLegacyFact("User is a/an stressed and overwhelmed")).toBeNull();
  });
  it("rewrites a real job in plain English", () => {
    expect(repairLegacyFact("User is a/an teacher")).toBe("User works as a teacher");
  });
  it("rewrites the slash wording for places, drops non-places", () => {
    expect(repairLegacyFact("User is from/lives in Kolkata")).toBe("User is from or lives in Kolkata");
    expect(repairLegacyFact("User is from/lives in fear")).toBeNull();
  });
  it("leaves every other fact alone", () => {
    expect(repairLegacyFact("User's name is Rina")).toBe("User's name is Rina");
  });
});

import * as fs from "fs";
import * as path from "path";
import { detectMemories, repairItems } from "../state/companionMemory";

describe("the app uses the rule", () => {
  it("detectMemories no longer turns a feeling into a job", () => {
    expect(detectMemories("I'm stressed and overwhelmed")).toEqual([]);
    expect(detectMemories("I'm a teacher and I live in Kolkata")).toEqual([
      "User works as a teacher",
      "User lives in Kolkata",
    ]);
  });

  it("saved memories are repaired on load (drop wrong, reword old)", () => {
    const items = [
      { id: "1", text: "User is a/an stressed and overwhelmed", source: "", createdAt: 1 },
      { id: "2", text: "User is a/an nurse", source: "", createdAt: 2 },
      { id: "3", text: "User's name is Rina", source: "", createdAt: 3 },
    ];
    expect(repairItems(items).map((m) => m.text)).toEqual(["User works as a nurse", "User's name is Rina"]);
    const clean = [items[2]];
    expect(repairItems(clean)).toBe(clean); // unchanged list ⇒ no rewrite of storage
  });

  it("loadMemories runs the repair on both storage paths", () => {
    const src = fs.readFileSync(path.join(__dirname, "../state/companionMemory.ts"), "utf8");
    const load = src.slice(src.indexOf("export async function loadMemories"), src.indexOf("export async function saveMemories"));
    expect(load).toContain("repairItems(items)");
    expect(load).toContain("repairItems(await migrateFromAsyncStorage())");
  });
});
