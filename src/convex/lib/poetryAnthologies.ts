/**
 * Saved AQA GCSE English Literature poetry anthologies.
 *
 * The specification publishes fixed clusters, but a scraped English Literature
 * page only lists the poems it happens to have notes for (Love and
 * Relationships came through with 10 of its 15). These lists are committed with
 * the code so a pathway always carries the whole cluster, in the anthology's
 * own order, with the same ids and wording on every rebuild.
 *
 * AQA 8702: each cluster contains 15 poems. Schools study one cluster for
 * Paper 2 Section B, and the question asks students to compare the printed poem
 * with one other poem from the same cluster.
 */

export type AnthologyPoem = {
  title: string;
  poet: string;
  /** What the poem is about, in one sentence. */
  about: string;
  /** Two or three things worth knowing for the comparison question. */
  notes: string[];
};

export type AnthologyCluster = {
  key: string;
  title: string;
  poems: AnthologyPoem[];
};

export const LOVE_AND_RELATIONSHIPS: AnthologyCluster = {
  key: "love-and-relationships",
  title: "Poetry anthology: Love and Relationships",
  poems: [
    {
      title: "When We Two Parted",
      poet: "Lord Byron",
      about:
        "A speaker grieves a secret love affair that has ended, and the public silence that has to hide it.",
      notes: [
        "Cold, clipped monosyllables and repeated 'silence and tears' carry the restraint.",
        "Love and loss are inseparable: the memory still wounds years later.",
        "Compare with Neutral Tones and Winter Swans on endings and emotional coldness.",
      ],
    },
    {
      title: "Love's Philosophy",
      poet: "Percy Bysshe Shelley",
      about:
        "A speaker argues that everything in nature mingles, so his beloved should return his kiss.",
      notes: [
        "Natural imagery is used as a persuasive argument, not decoration.",
        "The rhetorical questions and exclamations push a male speaker's desire.",
        "Compare with Sonnet 29 and Singh Song! on persuasion and desire.",
      ],
    },
    {
      title: "Porphyria's Lover",
      poet: "Robert Browning",
      about:
        "A speaker describes murdering his lover so that the moment of possession can last forever.",
      notes: [
        "The calm, conversational tone contrasts with the violence of the act.",
        "The dramatic monologue gives only the speaker's version of events.",
        "Compare with My Last Duchess (Power and Conflict) on control, and The Farmer's Bride on possession.",
      ],
    },
    {
      title: "Sonnet 29 – 'I think of thee!'",
      poet: "Elizabeth Barrett Browning",
      about:
        "A speaker says thinking of her beloved fills her mind so completely that she longs for his actual presence.",
      notes: [
        "The sonnet form and volta turn longing into fulfilment.",
        "Tree and vine imagery shows love as growth and dependence.",
        "Compare with Love's Philosophy on desire, and Letters from Yorkshire on distance.",
      ],
    },
    {
      title: "Neutral Tones",
      poet: "Thomas Hardy",
      about:
        "A speaker recalls the winter day a relationship ended, and the bitterness that has stayed with it.",
      notes: [
        "The colourless landscape mirrors the death of feeling.",
        "The final line's 'sun' is a bitter irony about what was learned.",
        "Compare with When We Two Parted on endings, and Winter Swans on cold imagery.",
      ],
    },
    {
      title: "Letters from Yorkshire",
      poet: "Maura Dooley",
      about:
        "A speaker compares her office life with a friend's outdoor working life, and the distance between them.",
      notes: [
        "Everyday, unglamorous detail makes the friendship feel real.",
        "Distance is both geographic and about different ways of living.",
        "Compare with Mother, Any Distance on separation, and Sonnet 29 on longing.",
      ],
    },
    {
      title: "The Farmer's Bride",
      poet: "Charlotte Mew",
      about:
        "A farmer describes his young wife's fear of him and his baffled longing after she runs away.",
      notes: [
        "Dialect and a matter-of-fact voice hide the coercion underneath.",
        "The wife has no voice of her own in the poem.",
        "Compare with Porphyria's Lover on possession, and Before You Were Mine on women's lives.",
      ],
    },
    {
      title: "Walking Away",
      poet: "Cecil Day-Lewis",
      about:
        "A parent watches a child leave for school and recognises the beginning of independence.",
      notes: [
        "Natural imagery (a satellite, a wing) makes separation feel inevitable.",
        "The poem is about letting go as an act of love.",
        "Compare with Follower and Mother, Any Distance on parenthood.",
      ],
    },
    {
      title: "Eden Rock",
      poet: "Charles Causley",
      about:
        "A speaker imagines a picnic with his dead parents, in a place that feels both memory and afterlife.",
      notes: [
        "The present tense makes the meeting feel real, not remembered.",
        "Ordinary details (a thermos, a hair ribbon) carry the emotion.",
        "Compare with Before You Were Mine and Climbing My Grandfather on family memory.",
      ],
    },
    {
      title: "Follower",
      poet: "Seamus Heaney",
      about:
        "A child admires his father's skill at ploughing, then admits that as an adult he follows him in a different way.",
      notes: [
        "Technical farming vocabulary shows precision and respect.",
        "The role reversal at the end changes who is following whom.",
        "Compare with Walking Away and Climbing My Grandfather on admiration and distance.",
      ],
    },
    {
      title: "Mother, Any Distance",
      poet: "Simon Armitage",
      about:
        "A speaker moving into his own home measures the space between himself and his mother.",
      notes: [
        "The tape measure becomes a metaphor for growing independence.",
        "The tone is affectionate but honest about the need to break free.",
        "Compare with Letters from Yorkshire on distance, and Follower on parents.",
      ],
    },
    {
      title: "Before You Were Mine",
      poet: "Carol Ann Duffy",
      about:
        "A daughter imagines her mother's life before she was born, and the freedom that was given up.",
      notes: [
        "The mother is imagined as a young woman with her own desires.",
        "The poem blends admiration, guilt and loss of possibility.",
        "Compare with Eden Rock on parents, and The Farmer's Bride on women's lives.",
      ],
    },
    {
      title: "Winter Swans",
      poet: "Owen Sheers",
      about:
        "A couple walk in silence after an argument and watch two swans, and something begins to mend.",
      notes: [
        "The swans' pairing mirrors what the couple have lost and might recover.",
        "Short lines and enjambment create hesitancy and then movement.",
        "Compare with Neutral Tones on cold imagery, and When We Two Parted on repair vs ending.",
      ],
    },
    {
      title: "Singh Song!",
      poet: "Daljit Nagra",
      about:
        "A shopkeeper celebrates his wife, his marriage and his refusal of his father's expectations.",
      notes: [
        "Non-standard spelling and puns celebrate a playful, mixed voice.",
        "Love here is domestic, funny and rebellious against convention.",
        "Compare with Love's Philosophy on desire, and Before You Were Mine on expectations of women.",
      ],
    },
    {
      title: "Climbing My Grandfather",
      poet: "Andrew Waterhouse",
      about:
        "A speaker climbs his grandfather like a landscape, learning him through touch and trust.",
      notes: [
        "The extended metaphor turns a family memory into physical exploration.",
        "The poem is tender without being sentimental.",
        "Compare with Follower and Eden Rock on grandparents and family memory.",
      ],
    },
  ],
};

export const POWER_AND_CONFLICT: AnthologyCluster = {
  key: "power-and-conflict",
  title: "Poetry anthology: Power and Conflict",
  poems: [
    {
      title: "Ozymandias",
      poet: "Percy Bysshe Shelley",
      about:
        "A traveller describes a ruined statue whose boastful inscription now sits in empty desert.",
      notes: [
        "Irony: the claim to power survives only as decay.",
        "Framed narration distances the reader from the ruler.",
        "Compare with My Last Duchess and The Prelude on human power and nature.",
      ],
    },
    {
      title: "London",
      poet: "William Blake",
      about:
        "A walk through London shows every institution as corrupted and every person as constrained.",
      notes: [
        "Repetition and rigid four-beat lines create a feeling of oppression.",
        "Institutions — church, monarchy, marriage — are indicted.",
        "Compare with Checking Out Me History and Tissue on power structures.",
      ],
    },
    {
      title: "Extract from, The Prelude",
      poet: "William Wordsworth",
      about:
        "A boy steals a boat, rows out, and is terrified by the huge presence of a mountain behind him.",
      notes: [
        "Nature is shown as vast, unsettling and morally significant.",
        "The poem moves from confidence to fear in a single incident.",
        "Compare with Storm on the Island and Exposure on nature's power.",
      ],
    },
    {
      title: "My Last Duchess",
      poet: "Robert Browning",
      about:
        "A duke shows a portrait of his dead wife and reveals, without noticing, that he had her killed.",
      notes: [
        "The dramatic monologue exposes the speaker through what he refuses to admit.",
        "Power is about control and possession, not just status.",
        "Compare with Ozymandias and Porphyria's Lover on control.",
      ],
    },
    {
      title: "The Charge of the Light Brigade",
      poet: "Alfred Lord Tennyson",
      about:
        "A cavalry brigade charges into pointless fire, and the poem commemorates their obedience.",
      notes: [
        "The dactylic rhythm imitates the horses' gallop.",
        "The poem celebrates courage while exposing the order that wasted it.",
        "Compare with Bayonet Charge and Remains on soldiers and command.",
      ],
    },
    {
      title: "Exposure",
      poet: "Wilfred Owen",
      about:
        "Soldiers wait in freezing mud and are worn down by weather rather than by the enemy.",
      notes: [
        "Nature, not the opposing army, is the true adversary.",
        "The refrain 'But nothing happens' drains hope out of each stanza.",
        "Compare with Storm on the Island and The Prelude on nature's power.",
      ],
    },
    {
      title: "Storm on the Island",
      poet: "Seamus Heaney",
      about:
        "An island community prepares for a storm and learns how little shelter human effort provides.",
      notes: [
        "Conversational opening ('We are prepared') is undercut by the storm.",
        "Military language turns weather into an assault.",
        "Compare with Exposure and The Prelude on nature against people.",
      ],
    },
    {
      title: "Bayonet Charge",
      poet: "Ted Hughes",
      about:
        "A soldier sprints towards a hedge in battle, moving from patriotism to animal panic.",
      notes: [
        "Harsh consonants and plosives recreate the confusion of combat.",
        "The poem questions what the soldier is fighting for.",
        "Compare with The Charge of the Light Brigade and Remains.",
      ],
    },
    {
      title: "Remains",
      poet: "Simon Armitage",
      about:
        "A soldier describes shooting a looter and the memory that will not leave him.",
      notes: [
        "Colloquial voice and first-person account make it feel like testimony.",
        "Post-traumatic stress is shown through repetition and broken lines.",
        "Compare with Exposure and Poppies on the aftermath of conflict.",
      ],
    },
    {
      title: "Poppies",
      poet: "Jane Weir",
      about:
        "A mother remembers preparing her son for war and waits for news.",
      notes: [
        "Domestic detail contrasts with the public language of remembrance.",
        "The poem is about grief at home, not combat itself.",
        "Compare with Remains and Before You Were Mine on parenthood and loss.",
      ],
    },
    {
      title: "War Photographer",
      poet: "Carol Ann Duffy",
      about:
        "A photographer develops images of suffering in a darkroom while the reader's comfort is implicated.",
      notes: [
        "Religious language gives the work a moral weight.",
        "The poem contrasts distant war with ordinary life in England.",
        "Compare with Remains and Poppies on distance from conflict.",
      ],
    },
    {
      title: "Tissue",
      poet: "Imtiaz Dharker",
      about:
        "Paper, maps, buildings and human lives are shown as fragile, layered and temporary.",
      notes: [
        "Tissue becomes a metaphor for how human structures are made and unmade.",
        "Light imagery suggests fragility and value at once.",
        "Compare with Ozymandias on impermanence and London on power structures.",
      ],
    },
    {
      title: "The Émigrée",
      poet: "Carol Rumens",
      about:
        "An exile remembers a city she left as a child, and finds memory and reality cannot agree.",
      notes: [
        "The repeated 'my city' insists on belonging.",
        "The ending turns hope into a political warning.",
        "Compare with Checking Out Me History on identity and belonging.",
      ],
    },
    {
      title: "Checking Out Me History",
      poet: "John Agard",
      about:
        "A speaker rejects a history curriculum that erased his own heritage and names the figures it left out.",
      notes: [
        "Layout, dialect and lack of punctuation challenge formal history.",
        "Repetition of 'dem' and 'me' creates a defiant voice.",
        "Compare with London and The Émigrée on power over identity.",
      ],
    },
    {
      title: "Kamikaze",
      poet: "Beatrice Garland",
      about:
        "A pilot turns back from a suicide mission and his family treat him as if he died anyway.",
      notes: [
        "The poem is told by the pilot's daughter, at a distance.",
        "Patriotism and shame are set against the value of ordinary life.",
        "Compare with Bayonet Charge and The Charge of the Light Brigade on duty.",
      ],
    },
  ],
};

export const ANTHOLOGIES: AnthologyCluster[] = [
  LOVE_AND_RELATIONSHIPS,
  POWER_AND_CONFLICT,
];

/** Matches a stored poetry theme to the saved cluster, if one is named. */
export function clusterForTheme(theme?: string): AnthologyCluster[] {
  if (!theme) return ANTHOLOGIES;
  const needle = theme.trim().toLowerCase();
  if (!needle) return ANTHOLOGIES;
  const match = ANTHOLOGIES.filter(
    (cluster) =>
      cluster.key === needle ||
      cluster.title.toLowerCase().includes(needle) ||
      needle.includes(cluster.key.replace(/-/g, " ")),
  );
  return match.length > 0 ? match : ANTHOLOGIES;
}
