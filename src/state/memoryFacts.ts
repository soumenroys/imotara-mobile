// src/state/memoryFacts.ts
// 🔴 MIRRORED in the web repo src/lib/memory/memoryFacts.ts — change both together.
//
// Dec release check (26 Nov 2026): "I'm stressed and overwhelmed" was saved as the person's
// JOB — "User is a/an stressed and overwhelmed" — shown in Settings and handed to the reply
// as a fact about them. A job is now recorded only when the phrase ENDS IN A KNOWN JOB WORD
// (missing a memory is harmless; a wrong one is not), and the wording is plain English.

const JOBS = new Set([
  "student", "teacher", "nurse", "doctor", "engineer", "developer", "programmer", "designer",
  "manager", "lawyer", "advocate", "accountant", "artist", "writer", "author", "musician", "chef",
  "cook", "driver", "farmer", "mechanic", "electrician", "plumber", "carpenter", "pharmacist",
  "consultant", "analyst", "scientist", "researcher", "professor", "lecturer", "tutor",
  "principal", "clerk", "cashier", "salesperson", "shopkeeper", "businessman", "businesswoman",
  "entrepreneur", "founder", "freelancer", "architect", "photographer", "journalist", "editor",
  "officer", "soldier", "firefighter", "pilot", "receptionist", "secretary", "assistant",
  "intern", "homemaker", "housewife", "caregiver", "carer", "nanny", "banker", "technician",
  "labourer", "laborer", "worker", "employee", "administrator", "executive", "director",
  "coordinator", "supervisor", "dentist", "surgeon", "physician", "paramedic", "veterinarian",
  "actor", "actress", "dancer", "singer", "athlete", "coach", "trainer", "barista", "waiter",
  "waitress", "cleaner", "guard", "counsellor", "counselor", "therapist", "psychologist",
  "librarian", "translator", "interpreter", "tailor", "beautician", "hairdresser", "barber",
  "retiree", "volunteer", "researcher", "economist", "statistician", "pharmacist", "midwife",
]);

// words that end a phrase ("a teacher AT a school", "a nurse AND tired")
const STOP = new Set(["and", "but", "so", "at", "in", "for", "with", "who", "from", "of", "on",
  "to", "because", "since", "or", "now", "here", "there", "too", "also", "by"])

function cut(phrase: string, maxWords: number): string {
  const out: string[] = [];
  for (const w of phrase.trim().split(/\s+/)) {
    const bare = w.replace(/[.,!?;:]+$/, "");
    if (!bare || STOP.has(bare.toLowerCase())) break;
    out.push(bare);
    if (bare !== w || out.length >= maxWords) break; // punctuation ends the phrase
  }
  return out.join(" ");
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

// a word allowed before the job word ("SOFTWARE engineer", "HIGH SCHOOL teacher")
const QUALIFIERS = new Set(["software", "medical", "school", "high", "primary", "senior", "junior",
  "staff", "social", "civil", "data", "web", "graphic", "police", "art", "music", "research",
  "college", "university", "phd", "law", "nursing", "it", "bank", "government", "sales",
  "marketing", "hr", "student", "trainee", "head", "assistant", "full-time", "part-time",
  "freelance", "retired", "factory", "office", "delivery", "security", "home", "civil"]);

const JOB_RE = /\b(?:i(?:'m|’m| am)(?: working as| employed as)?|i work as|my job is|my profession is) (an? )?([a-z][a-z ,.!?'-]{1,60})/i;

/** The job in "I'm a teacher at…", "I work as a nurse" — or null. */
export function occupationFrom(text: string): string | null {
  const m = text.match(JOB_RE);
  if (!m) return null;
  const words = cut(m[2], 3).toLowerCase().split(" ").filter(Boolean);
  if (words.length === 0) return null;
  if (!m[1]) {
    // no "a/an": only "I am teacher" — the very next word must be the job
    return JOBS.has(words[0]) ? words[0] : null;
  }
  // with "a/an": the job word, kept with the qualifiers directly before it
  const i = words.findIndex((w) => JOBS.has(w));
  if (i < 0) return null;
  let start = i;
  while (start > 0 && QUALIFIERS.has(words[start - 1])) start--;
  if (start > 0) return words[i]; // "a worried student" → "student"
  let end = i;
  while (end + 1 < words.length && JOBS.has(words[end + 1])) end++; // "student nurse"
  return words.slice(start, end + 1).join(" ");
}

export function occupationFact(job: string): string {
  return `User works as ${article(job)} ${job}`;
}

const PLACE_RE = /\b(i(?:'m|’m| am) from|i live in|i(?:'m|’m| am) based in) ([^\n]{2,60})/i;

/** "User is from Kolkata" / "User lives in Pune" — only for a capitalised place name. */
export function placeFact(text: string): string | null {
  const m = text.match(PLACE_RE);
  if (!m) return null;
  const place = cut(m[2], 3);
  if (!/^[A-Z]/.test(place)) return null; // "I live in fear", "I'm from a small town"
  const verb = m[1].toLowerCase();
  if (verb.includes("live")) return `User lives in ${place}`;
  if (verb.includes("based")) return `User is based in ${place}`;
  return `User is from ${place}`;
}

/**
 * Facts saved before this fix: repair the wording, or null to drop a wrong one.
 * Any other text is returned unchanged.
 */
export function repairLegacyFact(text: string): string | null {
  const job = text.match(/^User is a\/an (.+)$/);
  if (job) {
    const o = occupationFrom(`I am ${job[1]}`);
    return o ? occupationFact(o) : null;
  }
  const place = text.match(/^User is from\/lives in (.+)$/);
  if (place) {
    const p = cut(place[1], 3);
    return /^[A-Z]/.test(p) ? `User is from or lives in ${p}` : null;
  }
  return text;
}
