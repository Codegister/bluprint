/**
 * The set texts Save My Exams publishes for GCSE English Literature.
 *
 * The picker and the server validation use the same lists, so a saved choice is
 * always a text that can be matched to the course's own notes tree. Boards that
 * Save My Exams does not publish for this qualification return null and keep
 * the whole course rather than showing choices that cannot be applied.
 */

export type LiteratureChoices = {
  shakespeare: readonly string[];
  novel: readonly string[];
  modern: readonly string[];
  poetry: readonly string[];
};

export type LiteratureChoiceSet = LiteratureChoices & {
  shakespeareLabel: string;
  novelLabel: string;
  modernLabel: string;
  poetryLabel: string;
};

const AQA: LiteratureChoiceSet = {
  shakespeareLabel: "Shakespeare play",
  novelLabel: "19th-century novel",
  modernLabel: "Modern text",
  poetryLabel: "Poetry cluster",
  shakespeare: [
    "Macbeth",
    "Romeo & Juliet",
    "The Merchant of Venice",
    "Much Ado About Nothing",
    "The Tempest",
    "Julius Caesar",
  ],
  novel: [
    "A Christmas Carol",
    "Great Expectations",
    "Dr Jekyll & Mr Hyde",
    "Sign of Four",
    "Jane Eyre",
    "Frankenstein",
    "Pride & Prejudice",
  ],
  modern: [
    "An Inspector Calls",
    "Blood Brothers",
    "Lord of the Flies",
    "Animal Farm",
    "Anita and Me",
    "DNA",
    "Leave Taking",
    "Pigeon English",
    "Princess & The Hustler",
    "My Name is Leon",
    "A Taste of Honey",
  ],
  poetry: ["Power & Conflict", "Love & Relationships", "Worlds & Lives"],
};

const EDEXCEL: LiteratureChoiceSet = {
  shakespeareLabel: "Shakespeare play",
  novelLabel: "19th-century novel",
  modernLabel: "Post-1914 text",
  poetryLabel: "Poetry cluster",
  shakespeare: [
    "Macbeth",
    "Romeo & Juliet",
    "Much Ado About Nothing",
    "Twelfth Night",
    "The Merchant of Venice",
    "The Tempest",
  ],
  novel: [
    "A Christmas Carol",
    "Strange Case of Dr Jekyll and Mr Hyde",
    "Pride and Prejudice",
    "Silas Marner",
    "Frankenstein",
    "Great Expectations",
    "Jane Eyre",
  ],
  modern: [
    "An Inspector Calls",
    "Animal Farm",
    "Blood Brothers",
    "Lord of the Flies",
    "Anita and Me",
    "The Woman in Black",
    "Boys Don't Cry",
  ],
  poetry: ["Conflict", "Relationships"],
};

const OCR: LiteratureChoiceSet = {
  shakespeareLabel: "Shakespeare play",
  novelLabel: "19th-century novel",
  modernLabel: "Modern prose",
  poetryLabel: "Poetry cluster",
  shakespeare: [
    "Macbeth",
    "Romeo and Juliet",
    "The Merchant of Venice",
    "Much Ado About Nothing",
  ],
  novel: [
    "A Christmas Carol",
    "The Strange Case of Dr Jekyll and Mr Hyde",
    "Great Expectations",
    "Pride and Prejudice",
    "Jane Eyre",
    "The War of the Worlds",
  ],
  modern: [
    "An Inspector Calls",
    "Animal Farm",
    "Anita and Me",
    "DNA",
    "Leave Taking",
  ],
  poetry: [],
};

/** The choice groups for a board, or null when Save My Exams has no match. */
export function literatureChoicesFor(board: string): LiteratureChoiceSet | null {
  if (/^aqa$/i.test(board.trim())) return AQA;
  if (/edexcel|pearson/i.test(board)) return EDEXCEL;
  if (/^ocr\b/i.test(board.trim())) return OCR;
  return null;
}
