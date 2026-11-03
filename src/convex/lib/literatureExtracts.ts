export type LiteratureExtract = {
  text: string;
  source: string;
  reference: string;
};

/**
 * Exact, public-domain passages for the set texts the app knows best.
 *
 * The extract model is useful for an arbitrary text, but it must never be the
 * source of a Dickens or Shakespeare quotation: a repeated or paraphrased
 * passage is worse than no extract. These passages are checked in tests and
 * used before the model is asked for anything.
 */
const A_CHRISTMAS_CAROL = `Oh! But he was a tight-fisted hand at the grind-stone, Scrooge! a squeezing, wrenching, grasping, scraping, clutching, covetous, old sinner! Hard and sharp as flint, from which no steel had ever struck out generous fire; secret, and self-contained, and solitary as an oyster. The cold within him froze his old features, nipped his pointed nose, shrivelled his cheek, stiffened his gait; made his eyes red, his thin lips blue; and spoke out shrewdly in his grating voice. A frosty rime was on his head, and on his eyebrows, and his wiry chin. He carried his own low temperature always about with him; he iced his office in the dog-days; and didn't thaw it one degree at Christmas.

External heat and cold had little influence on Scrooge. No warmth could warm, no wintry weather chill him. No wind that blew was bitterer than he, no falling snow was more intent upon its purpose, no pelting rain less open to entreaty. Foul weather didn't know where to have him. The heaviest rain, and snow, and hail, and sleet, could boast of the advantage over him in only one respect. They often "came down" handsomely, and Scrooge never did.

Nobody ever stopped him in the street to say, with gladsome looks, "My dear Scrooge, how are you? When will you come to see me?" No beggars implored him to bestow a trifle, no children asked him what it was o'clock, no man or woman ever once in all his life inquired the way to such and such a place, of Scrooge. Even the blind men's dogs appeared to know him; and when they saw him coming on, would tug their owners into doorways and up courts; and then would wag their tails as though they said, "No eye at all is better than an evil eye, dark master!"

But what did Scrooge care! It was the very thing he liked. To edge his way along the crowded paths of life, warning all human sympathy to keep its distance, was what the knowing ones call "nuts" to Scrooge.`;

const MACBETH = `If it were done when 'tis done, then 'twere well
It were done quickly. If th' assassination
Could trammel up the consequence, and catch
With his surcease success; that but this blow
Might be the be-all and the end-all—here,
But here, upon this bank and shoal of time,
We'd jump the life to come. But in these cases
We still have judgement here; that we but teach
Bloody instructions, which being taught, return
To plague th' inventor. This even-handed justice
Commends th' ingredience of our poison'd chalice
To our own lips. He's here in double trust:
First, as I am his kinsman and his subject,
Strong both against the deed; then, as his host,
Who should against his murderer shut the door,
Not bear the knife myself. Besides, this Duncan
Hath borne his faculties so meek, hath been
So clear in his great office, that his virtues
Will plead like angels, trumpet-tongued, against
The deep damnation of his taking-off;
And pity, like a naked new-born babe,
Striding the blast, or heaven's cherubin, hors'd
Upon the sightless couriers of the air,
Shall blow the horrid deed in every eye,
That tears shall drown the wind.—I have no spur
To prick the sides of my intent, but only
Vaulting ambition, which o'erleaps itself
And falls on th' other—`;

const EXTRACTS: Array<{ match: RegExp; extract: LiteratureExtract }> = [
  {
    match: /christmas carol/i,
    extract: {
      text: A_CHRISTMAS_CAROL,
      source: "A Christmas Carol",
      reference: "Stave 1 — Scrooge",
    },
  },
  {
    match: /macbeth/i,
    extract: {
      text: MACBETH,
      source: "Macbeth",
      reference: "Act 1, Scene 7 — Macbeth's soliloquy",
    },
  },
];

/** The exact passage for a known set text, or null when the model must write one. */
export function knownLiteratureExtract(
  source: string | undefined,
): LiteratureExtract | null {
  if (!source) return null;
  const entry = EXTRACTS.find((candidate) => candidate.match.test(source));
  return entry ? { ...entry.extract } : null;
}
