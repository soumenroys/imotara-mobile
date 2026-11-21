// The house punctuation for a reply: straight quotes, spaced hyphen for an em
// dash, plain hyphen for an en dash. ONE function, used for the streamed text
// AND the final text, so a reply does not visibly change its punctuation the
// moment streaming finishes (#164, 21 Nov 2026 — seen in the simulator:
// "anything—you" while streaming, "anything - you" once final).
export function normalizeReplyPunctuation(text: string): string {
  return text
    .replace(/‘|’/g, "'")
    .replace(/“|”/g, '"')
    .replace(/—/g, " - ")
    .replace(/–/g, "-");
}
