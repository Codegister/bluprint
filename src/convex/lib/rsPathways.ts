/**
 * Saved pathway content for Edexcel GCSE Religious Studies A and B.
 *
 * Religious Studies does not publish a topic list the scraper can read, so a
 * scraped RS course came out as exam-technique filler ("how to get marks",
 * "mark scheme analysis"). These maps are written from the two Pearson
 * specifications and are committed with the code, so every RS course is built
 * from the same saved content and looks identical each time it is rebuilt:
 *
 *   RS A (1RA0) — Faith and Practice in the 21st Century
 *     Paper 1  Study of religion           beliefs, practices, sources of
 *                                          wisdom, forms of expression
 *     Paper 2  Study of a second religion  beliefs and practices
 *     Paper 3  Philosophy and Ethics   OR   Paper 4  Textual Studies
 *
 *   RS B (1RB0) — Beliefs in Action
 *     Two of: Religion and Ethics; Religion, Peace and Conflict;
 *     Religion, Philosophy and Social Justice.
 *
 * Everything below is subject content, not exam advice.
 */

export type RsPathwayTopic = {
  id: string;
  title: string;
  specReference?: string;
  summary: string;
  keyPoints: string[];
  examSkill: string;
};

export type RsPathwayUnit = {
  title: string;
  summary: string;
  topics: RsPathwayTopic[];
};

export type RsPathway = {
  overview: string;
  examFormat: string;
  units: RsPathwayUnit[];
};

type TopicSeed = { title: string; points: string[] };

type ReligionContent = {
  /** The religion's holy text, used by the sources of wisdom unit. */
  scripture: string;
  beliefs: TopicSeed[];
  practices: TopicSeed[];
  /** How the religion describes how it is lived day to day. */
  living: TopicSeed[];
  expressions: TopicSeed[];
};

const CHRISTIANITY: ReligionContent = {
  scripture: "the Bible (Old and New Testaments)",
  beliefs: [
    {
      title: "The nature of God",
      points: [
        "God as omnipotent, omnibenevolent and omniscient, and what each word means for believers.",
        "God as creator and sustainer of the universe, and how Christians respond to scientific accounts of origins.",
        "God as personal and involved in the world today, including answers to prayer.",
      ],
    },
    {
      title: "The Trinity",
      points: [
        "One God in three persons: Father, Son and Holy Spirit.",
        "Evidence in scripture and in the creeds, and why the Trinity matters for Christian belief.",
        "How the Trinity appears in worship, blessing and baptism.",
      ],
    },
    {
      title: "Creation",
      points: [
        "Genesis 1 and Genesis 2: what each account says and how they differ.",
        "Humanity made in the image of God, and stewardship of the world.",
        "Christian responses to the environment, including dominion and stewardship.",
      ],
    },
    {
      title: "The incarnation",
      points: [
        "Jesus as fully God and fully human, and the meaning of the Virgin Birth.",
        "Why the incarnation matters for how Christians understand God and humanity.",
        "How the incarnation is celebrated and used in teaching.",
      ],
    },
    {
      title: "Redemption and salvation",
      points: [
        "The crucifixion as sacrifice for sin, and the resurrection as victory over death.",
        "Sin, grace and the role of good works in salvation.",
        "Christian responses to the claim that salvation is only through Christ.",
      ],
    },
    {
      title: "Life after death",
      points: [
        "Resurrection, judgement, heaven and hell.",
        "Christian funeral rites and what they express about hope and grief.",
        "Different Christian views on the nature of the afterlife.",
      ],
    },
  ],
  practices: [
    {
      title: "Worship",
      points: [
        "Liturgical and non-liturgical worship, and private devotion.",
        "The Lord's Prayer and the use of set prayers.",
        "How worship builds community and shapes belief.",
      ],
    },
    {
      title: "Sacraments",
      points: [
        "Baptism: infant and believer's baptism, and what each shows about faith.",
        "The Eucharist or Holy Communion, and the different ways churches understand it.",
        "Sacraments in other areas of Christian life, such as confirmation and marriage.",
      ],
    },
    {
      title: "The Church and its role",
      points: [
        "The Church as the body of Christ and the people of God.",
        "The role of clergy, lay people and church leaders.",
        "The Church's work in the community and in public life.",
      ],
    },
    {
      title: "Pilgrimage and festivals",
      points: [
        "Christmas and Easter: what is celebrated and how.",
        "Places of pilgrimage and why believers travel to them.",
        "How festivals express core beliefs and pass them on.",
      ],
    },
    {
      title: "Mission and evangelism",
      points: [
        "The Great Commission and the call to share the faith.",
        "Different approaches to mission, including service and preaching.",
        "Christian responses to people of other faiths and to secular society.",
      ],
    },
    {
      title: "Living the Christian life",
      points: [
        "The Ten Commandments and the Beatitudes as guides for living.",
        "Agape (selfless love) and how it is practised.",
        "Charity, generosity and stewardship of money and time.",
      ],
    },
  ],
  living: [
    {
      title: "Beliefs that shape Christian living",
      points: [
        "How belief in judgement motivates moral choices.",
        "How love of neighbour shapes attitudes to poverty and inequality.",
        "Forgiveness and reconciliation in practice.",
      ],
    },
    {
      title: "Christian responses to ethical issues",
      points: [
        "Attitudes to wealth and poverty, and reasons behind them.",
        "Attitudes to prejudice and discrimination.",
        "Attitudes to war and peace, with the just war tradition and pacifism.",
      ],
    },
  ],
  expressions: [
    {
      title: "Art and imagery",
      points: [
        "How churches use art, icons and stained glass to teach and inspire.",
        "Protestant and Orthodox attitudes to religious imagery.",
        "The role of symbolism in worship.",
      ],
    },
    {
      title: "Architecture and music",
      points: [
        "How church design shapes worship, from cathedrals to meeting houses.",
        "Traditional hymns, contemporary worship songs and chant.",
        "How music supports prayer and community.",
      ],
    },
    {
      title: "Drama, media and everyday expression",
      points: [
        "Christian themes in drama, film and literature.",
        "How churches use media and online worship.",
        "The place of dress, symbols and pilgrimage souvenirs.",
      ],
    },
  ],
};

const CATHOLIC_CHRISTIANITY: ReligionContent = {
  ...CHRISTIANITY,
  scripture: "the Bible and the teaching of the Magisterium",
  beliefs: [
    ...CHRISTIANITY.beliefs,
    {
      title: "The Magisterium and authority",
      points: [
        "The Pope and bishops as teachers of the faith.",
        "Apostolic succession and how doctrine develops.",
        "How Catholics understand scripture, tradition and reason together.",
      ],
    },
  ],
  practices: [
    ...CHRISTIANITY.practices,
    {
      title: "The Mass",
      points: [
        "The structure of the Mass, from the Liturgy of the Word to the Eucharist.",
        "Transubstantiation and how it is explained.",
        "Why Mass is described as the source and summit of the Christian life.",
      ],
    },
  ],
  expressions: [
    ...CHRISTIANITY.expressions,
    {
      title: "Sacramentals and devotions",
      points: [
        "The Rosary, the stations of the cross and prayer to the saints.",
        "Holy water, medals and other sacramentals.",
        "Spectacle and silence in Catholic worship.",
      ],
    },
  ],
};

const ISLAM: ReligionContent = {
  scripture: "the Qur'an and the Sunnah",
  beliefs: [
    {
      title: "Tawhid: the oneness of God",
      points: [
        "Allah as one, without partner, and why shirk is the gravest sin.",
        "The 99 names of Allah and what they reveal about God.",
        "How tawhid shapes Muslim worship and daily life.",
      ],
    },
    {
      title: "Risalah and the prophets",
      points: [
        "Adam, Ibrahim, Musa, Isa and Muhammad as prophets.",
        "Muhammad as the final prophet and the seal of the prophets.",
        "Why prophethood is needed to guide humanity.",
      ],
    },
    {
      title: "Angels and the unseen",
      points: [
        "Jibril and the revelation of the Qur'an.",
        "The recording angels and the roles of other angels.",
        "What belief in the unseen adds to Muslim life.",
      ],
    },
    {
      title: "Akhirah: life after death",
      points: [
        "Death, the grave, the Day of Judgement and the afterlife.",
        "Jannah and Jahannam, and how they are described.",
        "How belief in akhirah affects how Muslims live now.",
      ],
    },
    {
      title: "Predestination and human responsibility",
      points: [
        "Al-Qadr and God's knowledge of all things.",
        "The tension between God's will and free will.",
        "Different Muslim views on how far humans choose their actions.",
      ],
    },
    {
      title: "Jihad",
      points: [
        "Greater jihad as the struggle within oneself.",
        "Lesser jihad and the strict conditions attached to it.",
        "Why the term is often misunderstood, and Muslim responses.",
      ],
    },
  ],
  practices: [
    {
      title: "The Five Pillars",
      points: [
        "Shahadah: the declaration of faith and what it commits a Muslim to.",
        "Salah, Zakah and Sawm, and what each involves.",
        "Hajj and how the rites retell the story of Ibrahim and Hajar.",
      ],
    },
    {
      title: "Salah and prayer",
      points: [
        "The five daily prayers, their times and the movements of prayer.",
        "Jummah and the Friday sermon.",
        "Du'a as personal supplication.",
      ],
    },
    {
      title: "Zakah and charity",
      points: [
        "The rate of Zakah and what counts as eligible wealth.",
        "Sadaqah as voluntary giving.",
        "Charity as purification of wealth and a duty to the community.",
      ],
    },
    {
      title: "Sawm and Ramadan",
      points: [
        "Who fasts, and the exemptions the law allows.",
        "What Ramadan is for and how the month is structured.",
        "Laylat al-Qadr and Eid al-Fitr.",
      ],
    },
    {
      title: "Hajj",
      points: [
        "The rites, from ihram to the final tawaf.",
        "Ibrahim, Hajar and Isma'il in the rituals.",
        "What Hajj shows about equality and obedience to God.",
      ],
    },
    {
      title: "Festivals and communal life",
      points: [
        "Id-ul-Adha and Eid al-Fitr.",
        "Ashura and the Ten Obligatory Acts in Shia Islam.",
        "The mosque as a centre of worship, learning and charity.",
      ],
    },
  ],
  living: [
    {
      title: "Beliefs that shape Muslim living",
      points: [
        "How tawhid and submission shape daily decisions.",
        "Halal and haram in food, money and relationships.",
        "The example of the Prophet in ordinary life.",
      ],
    },
    {
      title: "Muslim responses to ethical issues",
      points: [
        "Attitudes to wealth, poverty and charity.",
        "Attitudes to prejudice, equality and the ummah.",
        "Attitudes to war, with the rules of lawful conflict.",
      ],
    },
  ],
  expressions: [
    {
      title: "Calligraphy and geometric art",
      points: [
        "Why figurative art is avoided in many mosques.",
        "Calligraphy of the Qur'an and geometric patterns.",
        "Islamic architecture and interior design.",
      ],
    },
    {
      title: "The mosque",
      points: [
        "The role of the mihrab, minbar and minaret.",
        "How the design supports prayer and community.",
        "The mosque in the local community today.",
      ],
    },
    {
      title: "Recitation and music",
      points: [
        "Qur'an recitation and its rules.",
        "Nasheeds and music in Muslim communities.",
        "The place of the human voice in Muslim devotion.",
      ],
    },
  ],
};

const JUDAISM: ReligionContent = {
  scripture: "the Tanakh (Torah, Nevi'im and Ketuvim) and the Talmud",
  beliefs: [
    {
      title: "The nature of God",
      points: [
        "God as one, creator, lawgiver and judge.",
        "God as a personal God who enters into covenant.",
        "The Shekhinah and the presence of God in the world.",
      ],
    },
    {
      title: "The covenant with Abraham",
      points: [
        "The call of Abraham and the promises made to him.",
        "Circumcision as the sign of the covenant.",
        "The Akedah and what Abraham's obedience shows about faith.",
      ],
    },
    {
      title: "The covenant at Sinai",
      points: [
        "Moses, the Exodus and the giving of the Law.",
        "The Ten Commandments and the mitzvot.",
        "Different Jewish views on what keeping the Law means today.",
      ],
    },
    {
      title: "The Messiah",
      points: [
        "The idea of the anointed one and where it comes from.",
        "What different Jewish groups expect of the Messianic age.",
        "Why Jews do not accept Jesus as the Messiah.",
      ],
    },
    {
      title: "Mitzvot and free will",
      points: [
        "The 613 mitzvot, with categories for ritual and moral law.",
        "Free will and the yetzer tov and yetzer hara.",
        "Why obedience is a sign of love rather than a burden.",
      ],
    },
    {
      title: "Life after death",
      points: [
        "The range of Jewish belief, including olam ha-ba and resurrection.",
        "Judgement and the afterlife in scripture.",
        "How mourning rites express belief about death.",
      ],
    },
  ],
  practices: [
    {
      title: "Synagogue and prayer",
      points: [
        "The role of the synagogue in worship and community.",
        "The minyan and the layout of the building.",
        "The role of the rabbi and the cantor.",
      ],
    },
    {
      title: "Shema and Amidah",
      points: [
        "The Shema as the declaration of God's oneness.",
        "The Amidah and its place in daily prayer.",
        "Blessings, prayer shawls and phylacteries.",
      ],
    },
    {
      title: "Shabbat",
      points: [
        "Kiddush, challah and the Shabbat meal.",
        "What rest means, and the 39 categories of work.",
        "How Shabbat shapes family and community life.",
      ],
    },
    {
      title: "Festivals",
      points: [
        "Passover: the Seder and the Exodus story.",
        "Rosh Hashanah and Yom Kippur as the Days of Awe.",
        "Sukkot, Hanukkah and other festivals of the Jewish year.",
      ],
    },
    {
      title: "Mitzvot in daily life",
      points: [
        "Kashrut and keeping a kosher home.",
        "The mezuzah, tzitzit and small daily acts of obedience.",
        "Kiddush, grace after meals and daily blessings.",
      ],
    },
    {
      title: "Rites of passage",
      points: [
        "Brit Milah on the eighth day.",
        "Bar Mitzvah and Bat Mitzvah.",
        "Jewish marriage and Jewish mourning rites.",
      ],
    },
  ],
  living: [
    {
      title: "Beliefs that shape Jewish living",
      points: [
        "How covenant and law shape identity.",
        "Tzedek (justice) and tzedakah (charity) in practice.",
        "Family and community as a religious duty.",
      ],
    },
    {
      title: "Jewish responses to ethical issues",
      points: [
        "Attitudes to wealth, poverty and charity.",
        "Attitudes to prejudice and discrimination.",
        "Attitudes to war and peace, and to justice and forgiveness.",
      ],
    },
  ],
  expressions: [
    {
      title: "Symbols, art and objects",
      points: [
        "The menorah, the Star of David and the chai.",
        "Objects used in worship, such as the Sefer Torah and the bimah.",
        "Why Jewish art has often avoided figurative images.",
      ],
    },
    {
      title: "Synagogue design and music",
      points: [
        "The ark, the ner tamid and the direction of prayer.",
        "Traditional melodies and cantorial chant.",
        "Klezmer music and contemporary Jewish music.",
      ],
    },
    {
      title: "The Law in everyday expression",
      points: [
        "Dress, including the kippah, tzitzit and modest dress.",
        "Food and the kosher kitchen.",
        "The Jewish home as a place of worship.",
      ],
    },
  ],
};

const BUDDHISM: ReligionContent = {
  scripture: "the Pali Canon and Buddhist sutras",
  beliefs: [
    {
      title: "The Buddha and enlightenment",
      points: [
        "The life of Siddhartha Gautama and the four sights.",
        "The enlightenment under the Bodhi tree.",
        "The Buddha as a teacher rather than a god.",
      ],
    },
    {
      title: "The Three Marks of Existence",
      points: [
        "Anicca (impermanence) and what it means for attachment.",
        "Anatta (no fixed self) and the five aggregates.",
        "Dukkha (unsatisfactoriness) as the starting point of the path.",
      ],
    },
    {
      title: "The Four Noble Truths",
      points: [
        "Suffering, its cause, its ending and the path to its ending.",
        "Tanha (craving) as the cause of suffering.",
        "Why the Four Noble Truths are compared to a doctor's diagnosis.",
      ],
    },
    {
      title: "The Eightfold Path",
      points: [
        "Right understanding, thought and speech.",
        "Right action, livelihood and effort.",
        "Right mindfulness and right concentration.",
      ],
    },
    {
      title: "Karma and rebirth",
      points: [
        "Karma as intentional action and its effects.",
        "Rebirth without a permanent soul.",
        "The six realms in different Buddhist traditions.",
      ],
    },
    {
      title: "Nirvana",
      points: [
        "Nirvana as the end of suffering and of rebirth.",
        "The difference between nirvana in life and final nirvana.",
        "How the goal shapes practice.",
      ],
    },
  ],
  practices: [
    {
      title: "Meditation",
      points: [
        "Samatha and the calming of the mind.",
        "Vipassana and insight into impermanence.",
        "Walking meditation, chanting and visualisation.",
      ],
    },
    {
      title: "Puja and chanting",
      points: [
        "Offerings of flowers, light and incense.",
        "Chanting and taking refuge in the Three Jewels.",
        "Puja at home and at a temple or monastery.",
      ],
    },
    {
      title: "The Five Precepts",
      points: [
        "Not killing, not stealing, not lying.",
        "Not committing sexual misconduct and not taking intoxicants.",
        "The precepts as promises practised by monastics and lay Buddhists.",
      ],
    },
    {
      title: "The Sangha and monastic life",
      points: [
        "The Sangha as the community of the Buddha's followers.",
        "Monastic life and the rules of the Vinaya.",
        "The relationship between monastics and lay supporters.",
      ],
    },
    {
      title: "Festivals",
      points: [
        "Wesak and the birth, enlightenment and death of the Buddha.",
        "Vassa and the end of the rains retreat.",
        "New Year and other festivals in different Buddhist traditions.",
      ],
    },
    {
      title: "Ethics and compassion",
      points: [
        "Karuna (compassion) and metta (loving-kindness).",
        "Vegetarianism and the first precept.",
        "Buddhist engagement with social and environmental issues.",
      ],
    },
  ],
  living: [
    {
      title: "Beliefs that shape Buddhist living",
      points: [
        "How the Four Noble Truths guide daily choices.",
        "Mindfulness in ordinary activity.",
        "The role of generosity (dana) in lay life.",
      ],
    },
    {
      title: "Buddhist responses to ethical issues",
      points: [
        "Attitudes to wealth and poverty.",
        "Attitudes to prejudice and discrimination.",
        "Attitudes to war and to the environment.",
      ],
    },
  ],
  expressions: [
    {
      title: "Statues, stupas and symbols",
      points: [
        "The image of the Buddha and its symbolism.",
        "Stupas, prayer wheels and the wheel of dharma.",
        "How art supports meditation and devotion.",
      ],
    },
    {
      title: "Temples and architecture",
      points: [
        "How temple layout supports puja and meditation.",
        "Monasteries and their role in the community.",
        "Landscape and garden design, such as Zen gardens.",
      ],
    },
    {
      title: "Chanting and ritual music",
      points: [
        "Chants and sutra reading.",
        "Prostration and offerings.",
        "Silence and sound in different traditions.",
      ],
    },
  ],
};

const HINDUISM: ReligionContent = {
  scripture:
    "the Vedas, the Upanishads and the Bhagavad Gita",
  beliefs: [
    {
      title: "Brahman",
      points: [
        "Brahman as ultimate reality, without form and beyond description.",
        "Nirguna and saguna Brahman.",
        "How Brahman is approached in worship.",
      ],
    },
    {
      title: "The Trimurti and the deities",
      points: [
        "Brahma, Vishnu and Shiva and their roles.",
        "Avatars, especially the avatars of Vishnu.",
        "How different traditions and families focus on different deities.",
      ],
    },
    {
      title: "Atman",
      points: [
        "The self as eternal and connected with Brahman.",
        "The relationship between atman and the material world.",
        "Why self-knowledge is a religious aim.",
      ],
    },
    {
      title: "Samsara, karma and moksha",
      points: [
        "Karma as the law of cause and effect.",
        "Samsara as the cycle of birth and rebirth.",
        "Moksha as release, and the paths towards it.",
      ],
    },
    {
      title: "Dharma",
      points: [
        "Dharma as duty, law and right action.",
        "Varnashrama dharma and the ideal stages of life.",
        "Sanatana dharma as the eternal law.",
      ],
    },
    {
      title: "The four aims of life",
      points: [
        "Kama, artha, dharma and moksha.",
        "How the aims shape family and working life.",
        "Why moksha is the highest aim.",
      ],
    },
  ],
  practices: [
    {
      title: "Puja",
      points: [
        "Puja at home and in the mandir.",
        "Murti and the meanings of images and offerings.",
        "Aarti and the use of fire, water and flowers.",
      ],
    },
    {
      title: "Festivals",
      points: [
        "Diwali and the story of Rama and Sita.",
        "Holi and the beginning of spring.",
        "Navaratri and other regional festivals.",
      ],
    },
    {
      title: "Pilgrimage",
      points: [
        "Varanasi and the River Ganges.",
        "The Kumbh Mela and its scale.",
        "Why pilgrimage is seen as an act of devotion.",
      ],
    },
    {
      title: "Rites of passage",
      points: [
        "The samskaras, starting with name-giving.",
        "Upanayana and marriage.",
        "Hindu funeral rites and cremation.",
      ],
    },
    {
      title: "Ahimsa and the environment",
      points: [
        "Non-violence in word, thought and deed.",
        "Vegetarianism and Hindu attitudes to animals.",
        "Reverence for rivers and mountains.",
      ],
    },
    {
      title: "Living as a Hindu",
      points: [
        "The role of the family and the guru.",
        "Sewa and charity.",
        "Modern debates about caste and equality.",
      ],
    },
  ],
  living: [
    {
      title: "Beliefs that shape Hindu living",
      points: [
        "How dharma guides family and social duties.",
        "How karma shapes moral choice.",
        "How devotion (bhakti) shapes daily life.",
      ],
    },
    {
      title: "Hindu responses to ethical issues",
      points: [
        "Attitudes to wealth and poverty.",
        "Attitudes to prejudice and equality.",
        "Attitudes to war, guided by ahimsa and dharma.",
      ],
    },
  ],
  expressions: [
    {
      title: "Images and temples",
      points: [
        "The many forms of murti and their symbolism.",
        "Temple architecture and the sanctum.",
        "Art, dance and drama in Hindu devotion.",
      ],
    },
    {
      title: "Music and dance",
      points: [
        "Bhajan, kirtan and classical raga.",
        "Bharatanatyam and other dance forms as worship.",
        "The role of sound in puja.",
      ],
    },
    {
      title: "The home and everyday symbols",
      points: [
        "The shrine in the home.",
        "The lotus, the OM symbol and the swastika.",
        "Dress, jewellery and the bindi.",
      ],
    },
  ],
};

const SIKHISM: ReligionContent = {
  scripture: "the Guru Granth Sahib",
  beliefs: [
    {
      title: "Waheguru",
      points: [
        "God as one, eternal and beyond description.",
        "The meanings of Sat Naam and the Mool Mantar.",
        "God's presence in creation.",
      ],
    },
    {
      title: "Guru Nanak and the ten Gurus",
      points: [
        "Guru Nanak's life, travels and teaching.",
        "The ten Gurus and how authority passed between them.",
        "Why Guru Gobind Singh ended the line of human Gurus.",
      ],
    },
    {
      title: "Mool Mantar and God's nature",
      points: [
        "Ik Onkar and the oneness of God.",
        "Kartar, Akal and other names used in the Mool Mantar.",
        "How the Mool Mantar is used in prayer.",
      ],
    },
    {
      title: "Karma, samsara and mukti",
      points: [
        "Karma as the consequence of action.",
        "Samsara and rebirth.",
        "Mukti through devotion and grace.",
      ],
    },
    {
      title: "Sewa and the equality of all people",
      points: [
        "Sewa as selfless service.",
        "Equality across caste, gender and religion.",
        "Guru Nanak's rejection of ritual without devotion.",
      ],
    },
    {
      title: "The Khalsa",
      points: [
        "The founding of the Khalsa in 1699.",
        "Amrit and initiation.",
        "The meaning of loyalty and courage in the Khalsa.",
      ],
    },
  ],
  practices: [
    {
      title: "The gurdwara",
      points: [
        "The Guru Granth Sahib and the rituals that surround it.",
        "The role of the granthi and the sangat.",
        "Why the gurdwara is open to everyone.",
      ],
    },
    {
      title: "Langar and sewa",
      points: [
        "Langar as a shared meal for all.",
        "Sewa in the community and in the gurdwara.",
        "How the two express equality.",
      ],
    },
    {
      title: "Prayer",
      points: [
        "Nitnem and the daily prayers.",
        "Prayer at home and in the gurdwara.",
        "The role of music and kirtan in prayer.",
      ],
    },
    {
      title: "Amrit and the Five Ks",
      points: [
        "The Amrit initiation ceremony.",
        "Kesh, kanga, kachha, kara and kirpan.",
        "What each K means and how it is worn.",
      ],
    },
    {
      title: "Festivals",
      points: [
        "Vaisakhi and its link to the Khalsa.",
        "Guru Nanak Gurpurab.",
        "Bandi Chhor Divas and other gurpurabs.",
      ],
    },
    {
      title: "Living as a Sikh",
      points: [
        "Nam japna, kirat karna and vand chhakna.",
        "Honest work and honest earning.",
        "Sharing with others and caring for creation.",
      ],
    },
  ],
  living: [
    {
      title: "Beliefs that shape Sikh living",
      points: [
        "How sewa shapes everyday choices.",
        "The place of gratitude and remembrance.",
        "Equality in family and community life.",
      ],
    },
    {
      title: "Sikh responses to ethical issues",
      points: [
        "Attitudes to wealth and poverty.",
        "Attitudes to prejudice, caste and gender.",
        "Attitudes to war and conflict, including the use of the kirpan.",
      ],
    },
  ],
  expressions: [
    {
      title: "Art and symbols",
      points: [
        "The Khanda symbol and its parts.",
        "Art in the gurdwara and the decoration of the Guru Granth Sahib.",
        "Portraits and images of the Gurus.",
      ],
    },
    {
      title: "Gurdwara architecture and music",
      points: [
        "The design of the gurdwara and the place of the Guru Granth Sahib.",
        "Kirtan and the harmonium.",
        "The chauri and other objects used in worship.",
      ],
    },
    {
      title: "Dress and everyday expression",
      points: [
        "The turban and what it signifies.",
        "The kirpan as a symbol of duty.",
        "Festival processions and the display of the Khalsa colours.",
      ],
    },
  ],
};

const RELIGIONS: Record<string, ReligionContent> = {
  christianity: CHRISTIANITY,
  "catholic christianity": CATHOLIC_CHRISTIANITY,
  islam: ISLAM,
  judaism: JUDAISM,
  buddhism: BUDDHISM,
  hinduism: HINDUISM,
  sikhism: SIKHISM,
};

/** RS A paper 3 / paper 4 options, and RS B's three Areas of Study. */
export const RS_A_THIRD_PAPERS = [
  "Philosophy and Ethics",
  "Textual Studies: Mark's Gospel",
  "Textual Studies: The Qur'an",
] as const;

export const RS_B_AREAS = [
  "Religion and Ethics",
  "Religion, Peace and Conflict",
  "Religion, Philosophy and Social Justice",
] as const;

export const RS_RELIGIONS = [
  "Christianity",
  "Catholic Christianity",
  "Islam",
  "Judaism",
  "Buddhism",
  "Hinduism",
  "Sikhism",
] as const;

function seedToTopic(seed: TopicSeed, id: string, examSkill: string): RsPathwayTopic {
  return {
    id,
    title: seed.title,
    summary: seed.points[0] ?? seed.title,
    keyPoints: seed.points,
    examSkill,
  };
}

function unit(
  title: string,
  summary: string,
  seeds: TopicSeed[],
  unitIndex: number,
  examSkill: string,
): RsPathwayUnit {
  return {
    title,
    summary,
    topics: seeds.map((seed, index) =>
      seedToTopic(seed, `u${unitIndex + 1}t${index + 1}`, examSkill),
    ),
  };
}

/** Philosophy and Ethics (RS A paper 3). */
function philosophyUnits(religion: string): RsPathwayUnit[] {
  return [
    unit(
      "Arguments for the existence of God",
      `Philosophical arguments for God's existence, and the religious responses to them.`,
      [
        {
          title: "The design argument",
          points: [
            "Paley's watch and the appearance of purpose in nature.",
            "Strengths of the argument, and the problem of evil as a challenge.",
            `How ${religion} teaching supports belief in a purposeful creation.`,
          ],
        },
        {
          title: "The cosmological argument",
          points: [
            "Everything that begins has a cause, and the idea of a first cause.",
            "Aquinas and the argument from contingency.",
            "Objections, including the claim that the universe needs no cause.",
          ],
        },
        {
          title: "Religious experience",
          points: [
            "Numinous, conversion, mystical and answered-prayer experiences.",
            "How believers argue from experience to God's existence.",
            "Why experiences are hard to verify and easy to explain away.",
          ],
        },
        {
          title: "The problem of evil and suffering",
          points: [
            "Moral and natural evil.",
            "The inconsistent triad and the logical problem of evil.",
            `How ${religion} explains or responds to suffering, including free will and soul-making.`,
          ],
        },
      ],
      0,
      "Explain the argument first, then weigh it against the strongest objection.",
    ),
    unit(
      "Relationships and families",
      "Religious teaching on marriage, family life and sexual relationships.",
      [
        {
          title: "Marriage and its purpose",
          points: [
            `What ${religion} teaches about the purpose of marriage.`,
            "The marriage ceremony and the promises made.",
            "Attitudes to cohabitation and to divorce.",
          ],
        },
        {
          title: "Family life and gender",
          points: [
            `Roles and responsibilities in a ${religion} family.`,
            "Attitudes to contraception and family planning.",
            "Different views on the roles of men and women.",
          ],
        },
        {
          title: "Sexual relationships",
          points: [
            `Teaching on sex before and outside marriage.`,
            "Attitudes to homosexuality, and the range of views within the religion.",
            "How believers apply teaching when it conflicts with wider society.",
          ],
        },
        {
          title: "Equality and commitment",
          points: [
            "Religious teaching on equality within relationships.",
            "The place of love, promise-keeping and forgiveness.",
            "How beliefs shape responses to relationship breakdown.",
          ],
        },
      ],
      1,
      "Give the teaching, its reason, and the way different believers apply it.",
    ),
  ];
}

/** Textual Studies (RS A paper 4). */
function textualUnits(paper: string): RsPathwayUnit[] {
  if (paper.includes("Qur'an")) {
    return [
      unit(
        "The Qur'an: revelation and authority",
        "How the Qur'an was revealed and why it is authoritative for Muslims.",
        [
          {
            title: "Revelation",
            points: [
              "The first revelation in the cave of Hira.",
              "Jibril and the transmission of the text.",
              "The difference between the Qur'an and the Sunnah.",
            ],
          },
          {
            title: "Structure and language",
            points: [
              "Surahs, ayahs and the order of the text.",
              "The Arabic text and the status of translations.",
              "Recitation and the rules of tajwid.",
            ],
          },
          {
            title: "Core themes",
            points: [
              "God, guidance and the straight path.",
              "Prophets, judgement and the afterlife.",
              "Law, community and moral teaching.",
            ],
          },
          {
            title: "The Qur'an in Muslim life",
            points: [
              "How the Qur'an is used in prayer and daily life.",
              "Memorisation (hifz) and its place in Muslim education.",
              "Interpretation (tafsir) and differing readings.",
            ],
          },
        ],
        0,
        "Quote accurately and explain what the passage teaches, not just what it says.",
      ),
    ];
  }

  return [
    unit(
      "Mark's Gospel: context and message",
      "The setting, structure and central message of Mark's Gospel.",
      [
        {
          title: "Context and authorship",
          points: [
            "Mark as the earliest Gospel, and its audience.",
            "The Roman occupation of Judea and the Jewish world of the first century.",
            "Why context changes how the text is read.",
          ],
        },
        {
          title: "The person of Jesus",
          points: [
            "Titles used for Jesus, including Messiah and Son of God.",
            "The baptism and the voice from heaven.",
            "The transfiguration and what it reveals.",
          ],
        },
        {
          title: "Miracles, parables and teaching",
          points: [
            "Healing miracles and what they show about Jesus' authority.",
            "The parables of the kingdom and their interpretation.",
            "Teaching on discipleship and on wealth.",
          ],
        },
        {
          title: "Passion, death and resurrection",
          points: [
            "The entry to Jerusalem and the Last Supper.",
            "The crucifixion in Mark's account.",
            "The empty tomb and the ending of the Gospel.",
          ],
        },
      ],
      0,
      "Answer from the text: name the passage, then explain what Mark is showing.",
    ),
  ];
}

/** One RS B Area of Study. */
function areaOfStudyUnit(area: string, religion: string, unitIndex: number): RsPathwayUnit {
  if (area === "Religion and Ethics") {
    return unit(
      "Religion and Ethics",
      `Ethical issues explored through ${religion} beliefs and teaching.`,
      [
        {
          title: "Beliefs and ethical decision-making",
          points: [
            `Which ${religion} beliefs and sources of authority shape moral choices.`,
            "The role of conscience, community and scripture.",
            "How believers weigh religious teaching against other views.",
          ],
        },
        {
          title: "Marriage and the family",
          points: [
            `What ${religion} teaches about marriage and family life.`,
            "Attitudes to divorce, contraception and gender roles.",
            "Different views within the religion and between religions.",
          ],
        },
        {
          title: "Matters of life and death",
          points: [
            `What ${religion} teaches about the value of life.`,
            "Attitudes to abortion, euthanasia and the treatment of animals.",
            "How beliefs about the afterlife shape these views.",
          ],
        },
        {
          title: "Living the religious life",
          points: [
            `How ${religion} believers live out their beliefs day to day.`,
            "Worship, prayer and charity as part of ethical life.",
            "The place of forgiveness and reconciliation.",
          ],
        },
      ],
      unitIndex,
      "Weigh up both sides, then justify a conclusion with religious reasoning.",
    );
  }

  if (area === "Religion, Peace and Conflict") {
    return unit(
      "Religion, Peace and Conflict",
      `War, justice and peace through ${religion} beliefs and teaching.`,
      [
        {
          title: "Beliefs about justice and forgiveness",
          points: [
            `What ${religion} teaches about justice, judgement and forgiveness.`,
            "Sources of authority used in debates about punishment.",
            "The tension between mercy and retribution.",
          ],
        },
        {
          title: "Crime and punishment",
          points: [
            `What ${religion} teaches about law, punishment and reform.`,
            "Attitudes to the death penalty and to prisons.",
            "Why forgiveness does not remove responsibility.",
          ],
        },
        {
          title: "Peace and conflict",
          points: [
            `What ${religion} teaches about peace and reconciliation.`,
            "The just war tradition and its conditions.",
            "Pacifism, holy war and the use of force in self-defence.",
          ],
        },
        {
          title: "Living the religious life",
          points: [
            `How ${religion} believers work for peace in practice.`,
            "Worship and prayer as responses to conflict.",
            "The role of religious leaders in peacemaking.",
          ],
        },
      ],
      unitIndex,
      "Apply the teaching to the situation, then evaluate whether it justifies the action.",
    );
  }

  return unit(
    "Religion, Philosophy and Social Justice",
    `Philosophy of religion and questions of justice through ${religion} beliefs.`,
    [
      {
        title: "Beliefs about God and the world",
        points: [
          `What ${religion} teaches about God's nature and God's relationship with the world.`,
          "Revelation and how believers claim to know God.",
          "The place of reason and faith.",
        ],
      },
      {
        title: "Philosophy of religion",
        points: [
          "Arguments for and against God's existence.",
          "The problem of evil and religious responses to it.",
          "Life after death and why it matters to believers.",
        ],
      },
      {
        title: "Human rights and equality",
        points: [
          `What ${religion} teaches about the dignity of the person.`,
          "Attitudes to prejudice, discrimination and racism.",
          "Religious responses to inequality in society.",
        ],
      },
      {
        title: "Wealth, poverty and justice",
        points: [
          `What ${religion} teaches about wealth and its responsibilities.`,
          "Attitudes to poverty, charity and fair pay.",
          "How believers work for social justice today.",
        ],
      },
    ],
    unitIndex,
    "Use religious teaching to argue a position on a social issue, then critique it.",
  );
}

function contentFor(religion: string): ReligionContent {
  return RELIGIONS[religion.trim().toLowerCase()] ?? CHRISTIANITY;
}

function isRsA(route: string): boolean {
  return /studies\s*a$/i.test(route.trim());
}

function isRsB(route: string): boolean {
  return /studies\s*b$/i.test(route.trim());
}

export type RsCourseInput = {
  subject: string;
  level: string;
  examBoard: string;
  rsRoute?: string;
  rsReligion?: string;
  /** The second religion: RS A Paper 2, and RS B's second Area of Study. */
  rsReligion2?: string;
  rsSpec?: string;
  rsSpec2?: string;
};

/**
 * The saved RS pathway for a course, or null when the course is not GCSE
 * Religious Studies. The same inputs always produce the same pathway, so a
 * rebuild shows identical units, topics and wording.
 */
export function buildRsPathway(course: RsCourseInput): RsPathway | null {
  if (course.subject.trim().toLowerCase() !== "religious studies") return null;
  if (course.level !== "GCSE" && course.level !== "A-Level") return null;

  // Pearson is the only board that publishes an A / B split, so anything else
  // is treated as RS A rather than being given the old generic map.
  const route = course.rsRoute ?? "Edexcel Religious Studies A";
  const religionName = (course.rsReligion ?? "Christianity").trim();
  const religion = contentFor(religionName);
  // Both routes need a second religion: RS A examines it in Paper 2, and RS B
  // requires a different religion for each Area of Study.
  const secondReligionName =
    course.rsReligion2?.trim() &&
    course.rsReligion2.trim().toLowerCase() !== religionName.toLowerCase()
      ? course.rsReligion2.trim()
      : RS_RELIGIONS.find(
          (religionOption) =>
            religionOption.toLowerCase() !== religionName.toLowerCase(),
        ) ?? "Islam";
  const secondReligion = contentFor(secondReligionName);
  const secondary = course.rsSpec2?.trim();
  const primary = course.rsSpec?.trim();

  if (course.level === "A-Level") {
    const units: RsPathwayUnit[] = [
      unit(
        `Beliefs and teachings — ${religionName}`,
        `The content of ${religionName} belief, taught from sources of wisdom and authority.`,
        religion.beliefs,
        0,
        "Explain the belief with a source, then show what difference it makes.",
      ),
      unit(
        `Practices and living — ${religionName}`,
        `How ${religionName} is practised, individually and in community.`,
        religion.practices,
        1,
        "Describe the practice and explain its meaning for believers.",
      ),
      unit(
        "Philosophy of religion",
        "Arguments about God, religious language and life after death.",
        [
          {
            title: "Arguments for God's existence",
            points: [
              "Ontological, cosmological, teleological and moral arguments.",
              "The strengths and weaknesses of each argument.",
              "How believers use arguments in support of faith.",
            ],
          },
          {
            title: "Religious language",
            points: [
              "Analogy, symbol and myth.",
              "Verification and falsification challenges.",
              "How religious language shapes doctrine.",
            ],
          },
          {
            title: "Life after death",
            points: [
              "Dualism and materialism.",
              "Resurrection and reincarnation.",
              "The evidence appealed to on both sides.",
            ],
          },
        ],
        2,
        "Set out the argument, its critics, and your own judgement.",
      ),
      unit(
        "Religion and ethics",
        "Ethical theory applied to religious belief.",
        [
          {
            title: "Ethical theories",
            points: [
              "Natural law, situation ethics and virtue ethics.",
              "Utilitarianism and Kantian ethics.",
              "How each theory is used in religious decision-making.",
            ],
          },
          {
            title: "Applied ethics",
            points: [
              "Medical ethics, including euthanasia and abortion.",
              "War and peace.",
              "Sexual ethics and the environment.",
            ],
          },
        ],
        3,
        "Apply the theory to the case, then evaluate the theory itself.",
      ),
    ];
    return {
      overview: `${religionName} ${course.level} Religious Studies (${course.examBoard}): the beliefs, practices, philosophy and ethics content for this course, arranged into ${units.length} units.`,
      examFormat:
        route.trim().length > 0
          ? `${route} is examined by written papers on the study of religion, philosophy of religion and ethics. Check your board's current specification for paper durations and weightings.`
          : "Check your board's current specification for paper durations and weightings.",
      units,
    };
  }

  if (isRsB(route)) {
    const first = primary && primary.length > 0 ? primary : RS_B_AREAS[0];
    const second =
      secondary && secondary.length > 0
        ? secondary
        : RS_B_AREAS.find((area) => area !== first) ?? RS_B_AREAS[1];

    const units: RsPathwayUnit[] = [
      unit(
        `Beliefs and practices — ${religionName}`,
        `The ${religionName} beliefs and practices that the ${first} Area of Study builds on.`,
        [...religion.beliefs, ...religion.practices],
        0,
        "Learn the belief or practice precisely, then link it to the ethical issue.",
      ),
      areaOfStudyUnit(first, religionName, 1),
      unit(
        `Beliefs and practices — ${secondReligionName}`,
        `The ${secondReligionName} beliefs and practices that the ${second} Area of Study builds on.`,
        [...secondReligion.beliefs, ...secondReligion.practices],
        2,
        "Keep the second religion's teaching separate from the first.",
      ),
      areaOfStudyUnit(second, secondReligionName, 3),
      unit(
        "Living the religious life and forms of expression",
        `How ${religionName} and ${secondReligionName} believers live out these beliefs.`,
        [...religion.living, ...religion.expressions],
        4,
        "Show how belief leads to action, with examples.",
      ),
    ];

    return {
      overview: `Edexcel GCSE Religious Studies B (Beliefs in Action) with ${religionName} and ${secondReligionName}: ${first} through ${religionName}, ${second} through ${secondReligionName}. This pathway is built from the saved specification content, so it is the same each time it is rebuilt.`,
      examFormat:
        "Two written papers, one for each Area of Study, each taken with a different religion. Every paper covers beliefs, the ethical issue and living the religious life for its religion.",
      units,
    };
  }

  if (!isRsA(route) && !isRsB(route)) {
    return null;
  }

  const thirdPaper =
    primary && primary.length > 0 ? primary : RS_A_THIRD_PAPERS[0];

  const units: RsPathwayUnit[] = [
    unit(
      `Beliefs and teachings — ${religionName}`,
      `The core beliefs of ${religionName}, with the sources of wisdom and authority behind them.`,
      religion.beliefs,
      0,
      "State the belief, support it with a source, then explain why it matters.",
    ),
    unit(
      `Practices — ${religionName}`,
      `How ${religionName} is worshipped and lived, in private and in community.`,
      religion.practices,
      1,
      "Name the practice, describe it accurately, then explain its purpose.",
    ),
    unit(
      "Sources of wisdom and authority",
      `How ${religion.scripture} is used to shape belief and practice.`,
      [
        {
          title: "The scriptures",
          points: [
            `What ${religion.scripture} contains and how it is organised.`,
            "How the text is read in worship and in study.",
            "Why the text is treated as authoritative.",
          ],
        },
        {
          title: "Teaching authority",
          points: [
            `Who interprets scripture in ${religionName}, and how.`,
            "The role of tradition, scholars and community.",
            "What happens when interpretations disagree.",
          ],
        },
        {
          title: "Sources in exam answers",
          points: [
            `Learn short quotations or references from ${religion.scripture}.`,
            "Explain the teaching behind the quotation.",
            "Use the source to support or challenge a viewpoint.",
          ],
        },
      ],
      2,
      "Quote the source accurately and then explain what it teaches.",
    ),
    unit(
      "Forms of expression and ways of life",
      `How ${religionName} belief is expressed in art, buildings, music and daily life.`,
      religion.expressions,
      3,
      "Link the form of expression to the belief it carries.",
    ),
    unit(
      `Paper 2: second religion — ${secondReligionName}`,
      `The beliefs and practices Edexcel examines for ${secondReligionName} in Paper 2, worth 25% of the GCSE.`,
      [...secondReligion.beliefs, ...secondReligion.practices],
      4,
      `Answer on ${secondReligionName} only, and keep its teaching separate from the Paper 1 religion.`,
    ),
  ];

  const extra =
    thirdPaper === "Philosophy and Ethics"
      ? philosophyUnits(religionName)
      : textualUnits(thirdPaper);

  const allUnits = [...units, ...extra].map(
    (entry, unitIndex) => ({
      ...entry,
      topics: entry.topics.map((topic, topicIndex) => ({
        ...topic,
        id: `u${unitIndex + 1}t${topicIndex + 1}`,
      })),
    }),
  );

  return {
    overview: `Edexcel GCSE Religious Studies A (Faith and Practice in the 21st Century) with ${religionName} and ${secondReligionName}. Paper 1 covers ${religionName} beliefs, practices, sources of wisdom and forms of expression; Paper 2 covers ${secondReligionName} beliefs and practices; the third paper is ${
      thirdPaper
    }. Built from the saved specification content so it is the same every time.`,
    examFormat:
      "Three written papers: Paper 1 on the main religion (50%), Paper 2 on the second religion (25%), and Paper 3 Philosophy and Ethics or Paper 4 Textual Studies (25%).",
    units: allUnits,
  };
}
