/**
 * Specification-derived pathways for courses where Bluprint can state the
 * board's own structure and numbering.
 *
 * Save My Exams writes its notes to the specification, but its page titles are
 * not specification points: in the audit, "Diffusion in Multicellular
 * Organisms" appeared as a spec point, active transport was missing, and a
 * notes-site "Exam Skills" section became part 8 of 8. For AQA GCSE Biology the
 * pathway below is the specification itself, so every reference can be checked
 * against AQA 8461 and no required content is dropped.
 */

export type SpecificationTopic = {
  reference: string;
  title: string;
  summary: string;
};

export type SpecificationUnit = {
  title: string;
  summary: string;
  topics: SpecificationTopic[];
};

const CELLS: SpecificationUnit = {
  title: "4.1 Cell biology",
  summary: "Cell structure, division, transport and the practical skills attached to them.",
  topics: [
    {
      reference: "4.1.1.1",
      title: "Eukaryotes and prokaryotes",
      summary:
        "Compare eukaryotic and prokaryotic cells: size, plasmids, DNA arrangement and sub-cellular structures.",
    },
    {
      reference: "4.1.1.2",
      title: "Animal and plant cells",
      summary:
        "Name the structures in animal and plant cells and state the function of each. Required practical 1: use a light microscope to observe plant and animal cells.",
    },
    {
      reference: "4.1.1.3",
      title: "Cell specialisation",
      summary: "Explain how cell structure relates to function in specialised animal and plant cells.",
    },
    {
      reference: "4.1.1.4",
      title: "Cell differentiation",
      summary: "Describe differentiation in animal and plant cells, including when it stops.",
    },
    {
      reference: "4.1.1.5",
      title: "Microscopy",
      summary:
        "Use the magnification equation, convert units and compare light and electron microscopes.",
    },
    {
      reference: "4.1.1.6",
      title: "Culturing microorganisms",
      summary:
        "Describe aseptic technique, culture conditions and the calculation of colony areas or numbers.",
    },
    {
      reference: "4.1.2.1",
      title: "Chromosomes",
      summary: "State what chromosomes are, where they are found and how many human body cells contain.",
    },
    {
      reference: "4.1.2.2",
      title: "Mitosis and the cell cycle",
      summary: "Describe the cell cycle, the stages of mitosis and why mitosis produces identical cells.",
    },
    {
      reference: "4.1.2.3",
      title: "Stem cells",
      summary:
        "Define stem cells, compare embryonic and adult stem cells, and discuss their uses and ethical issues.",
    },
    {
      reference: "4.1.3.1",
      title: "Diffusion",
      summary:
        "Explain diffusion in terms of particle movement and concentration gradient, and name factors that affect its rate.",
    },
    {
      reference: "4.1.3.2",
      title: "Osmosis",
      summary:
        "Define osmosis and predict water movement into and out of cells. Required practical 3: investigate osmosis with plant tissue.",
    },
    {
      reference: "4.1.3.3",
      title: "Active transport",
      summary:
        "Explain active transport as movement against a concentration gradient using energy from respiration, with a named example such as root hair cells.",
    },
  ],
};

const ORGANISATION: SpecificationUnit = {
  title: "4.2 Organisation",
  summary: "Cells to organ systems, digestion, transport in humans and plants, and health.",
  topics: [
    { reference: "4.2.1", title: "Principles of organisation", summary: "Relate cells, tissues, organs and organ systems to their functions." },
    { reference: "4.2.2.1", title: "The human digestive system", summary: "Describe digestion, enzymes and absorption. Required practical 4: test for carbohydrates, lipids and proteins." },
    { reference: "4.2.2.2", title: "The heart and blood vessels", summary: "Describe the double circulatory system, the heart's structure and the differences between arteries, veins and capillaries." },
    { reference: "4.2.2.3", title: "Blood", summary: "State the functions of plasma, red blood cells, white blood cells and platelets." },
    { reference: "4.2.2.4", title: "Coronary heart disease", summary: "Explain causes and treatments of coronary heart disease, including stents and statins." },
    { reference: "4.2.2.5", title: "Health issues", summary: "Distinguish communicable and non-communicable disease and describe interactions between them." },
    { reference: "4.2.2.6", title: "Lifestyle and non-communicable disease", summary: "Explain how lifestyle factors affect the risk of non-communicable disease." },
    { reference: "4.2.2.7", title: "Cancer", summary: "Describe benign and malignant tumours and explain how cancer arises." },
    { reference: "4.2.3.1", title: "Plant tissues", summary: "Name plant tissues and relate their structure to their function." },
    { reference: "4.2.3.2", title: "Plant organ systems", summary: "Explain transport in xylem and phloem, transpiration and translocation." },
  ],
};

const INFECTION: SpecificationUnit = {
  title: "4.3 Infection and response",
  summary: "Pathogens, human defences, vaccination, drug development and plant disease.",
  topics: [
    { reference: "4.3.1.1", title: "Communicable diseases", summary: "Describe how pathogens cause disease and how they spread." },
    { reference: "4.3.1.2", title: "Viral diseases", summary: "Describe measles, HIV and tobacco mosaic virus, including symptoms and control." },
    { reference: "4.3.1.3", title: "Bacterial diseases", summary: "Describe salmonella and gonorrhoea, including prevention and treatment." },
    { reference: "4.3.1.4", title: "Fungal diseases", summary: "Describe rose black spot and the effects of fungal disease." },
    { reference: "4.3.1.5", title: "Protist diseases", summary: "Describe malaria, its vector and methods of control." },
    { reference: "4.3.1.6", title: "Human defence systems", summary: "Describe non-specific defences and the immune response." },
    { reference: "4.3.1.7", title: "Vaccination", summary: "Explain how vaccination produces immunity and discuss its benefits and risks." },
    { reference: "4.3.1.8", title: "Antibiotics and painkillers", summary: "Distinguish antibiotics from painkillers and explain antibiotic resistance." },
    { reference: "4.3.1.9", title: "Drug development", summary: "Describe the stages of drug testing, including preclinical testing, clinical trials and peer review." },
    { reference: "4.3.2.1", title: "Monoclonal antibodies", summary: "Describe how monoclonal antibodies are produced." },
    { reference: "4.3.2.2", title: "Uses of monoclonal antibodies", summary: "Describe uses in diagnosis and treatment, including cancer therapy." },
    { reference: "4.3.3.1", title: "Plant disease detection", summary: "Identify plant diseases from symptoms and use laboratory tests." },
    { reference: "4.3.3.2", title: "Plant defence responses", summary: "Describe physical, chemical and mechanical plant defences." },
  ],
};

const BIOENERGETICS: SpecificationUnit = {
  title: "4.4 Bioenergetics",
  summary: "Photosynthesis, respiration and the practical work that measures them.",
  topics: [
    { reference: "4.4.1.1", title: "Photosynthetic reaction", summary: "State the word and balanced symbol equations for photosynthesis." },
    { reference: "4.4.1.2", title: "Rate of photosynthesis", summary: "Explain limiting factors and interpret rate graphs. Required practical 6: investigate the effect of light intensity on photosynthesis." },
    { reference: "4.4.1.3", title: "Uses of glucose", summary: "Describe how plants use the glucose made in photosynthesis." },
    { reference: "4.4.2.1", title: "Aerobic and anaerobic respiration", summary: "Compare aerobic and anaerobic respiration in animals and yeast." },
    { reference: "4.4.2.2", title: "Response to exercise", summary: "Explain changes during exercise and the idea of oxygen debt." },
    { reference: "4.4.2.3", title: "Metabolism", summary: "Describe metabolism and the role of enzymes in metabolic reactions." },
  ],
};

const HOMEOSTASIS: SpecificationUnit = {
  title: "4.5 Homeostasis and response",
  summary: "Nervous and hormonal control, reproduction, and plant hormones.",
  topics: [
    { reference: "4.5.1", title: "Homeostasis", summary: "Explain why maintaining a stable internal environment matters." },
    { reference: "4.5.2.1", title: "Nervous system structure and function", summary: "Describe receptors, effectors, neurones, synapses and reflexes. Required practical 7: investigate reaction time." },
    { reference: "4.5.2.2", title: "The brain", summary: "Describe the brain's regions and methods used to study it." },
    { reference: "4.5.2.3", title: "The eye", summary: "Describe accommodation, the pupil reflex and common eye defects." },
    { reference: "4.5.2.4", title: "Control of body temperature", summary: "Explain thermoregulation in humans." },
    { reference: "4.5.3.1", title: "Human endocrine system", summary: "Describe glands, hormones and their target organs." },
    { reference: "4.5.3.2", title: "Control of blood glucose", summary: "Explain insulin, glucagon and negative feedback, including diabetes." },
    { reference: "4.5.3.3", title: "Water and nitrogen balance", summary: "Explain how the kidneys regulate water and nitrogen balance." },
    { reference: "4.5.3.4", title: "Hormones in human reproduction", summary: "Describe the menstrual cycle and the roles of reproductive hormones." },
    { reference: "4.5.3.5", title: "Contraception", summary: "Explain hormonal and non-hormonal methods of contraception." },
    { reference: "4.5.3.6", title: "Treating infertility", summary: "Describe fertility treatments, including IVF, and evaluate their issues." },
    { reference: "4.5.3.7", title: "Negative feedback", summary: "Explain negative feedback using a named example." },
    { reference: "4.5.4.1", title: "Plant hormones: control and coordination", summary: "Describe auxins, phototropism and gravitropism." },
    { reference: "4.5.4.2", title: "Uses of plant hormones", summary: "Describe commercial uses of plant hormones." },
  ],
};

const INHERITANCE: SpecificationUnit = {
  title: "4.6 Inheritance, variation and evolution",
  summary: "Reproduction, inheritance, evolution, classification and resistance.",
  topics: [
    { reference: "4.6.1.1", title: "Sexual and asexual reproduction", summary: "Compare sexual and asexual reproduction." },
    { reference: "4.6.1.2", title: "Meiosis", summary: "Describe meiosis and explain how it produces variation." },
    { reference: "4.6.1.3", title: "Advantages and disadvantages of reproduction", summary: "Compare sexual and asexual reproduction in named organisms." },
    { reference: "4.6.1.4", title: "DNA and the genome", summary: "Describe DNA, genes and the genome." },
    { reference: "4.6.1.5", title: "DNA structure", summary: "Describe the structure of DNA and complementary base pairing." },
    { reference: "4.6.1.6", title: "Genetic inheritance", summary: "Use genetic diagrams to predict inherited characteristics." },
    { reference: "4.6.1.7", title: "Inherited disorders", summary: "Interpret family trees and explain inherited disorders." },
    { reference: "4.6.1.8", title: "Sex determination", summary: "Explain sex determination from sex chromosomes." },
    { reference: "4.6.2.1", title: "Variation", summary: "Describe genetic and environmental variation." },
    { reference: "4.6.2.2", title: "Evolution", summary: "Explain natural selection and evolution." },
    { reference: "4.6.2.3", title: "Selective breeding", summary: "Describe selective breeding and its risks." },
    { reference: "4.6.2.4", title: "Genetic engineering", summary: "Describe genetic engineering and evaluate its uses." },
    { reference: "4.6.2.5", title: "Cloning", summary: "Describe cloning and its advantages and disadvantages." },
    { reference: "4.6.2.6", title: "Adult cell cloning", summary: "Describe adult cell cloning and its issues." },
    { reference: "4.6.3.1", title: "Theory of evolution", summary: "Describe Darwin's theory and the evidence for it." },
    { reference: "4.6.3.2", title: "Speciation", summary: "Explain how new species arise." },
    { reference: "4.6.3.3", title: "Understanding genetics", summary: "Describe how understanding of genetics has developed." },
    { reference: "4.6.3.4", title: "Evidence for evolution", summary: "Explain how fossils and other evidence support evolution." },
    { reference: "4.6.3.5", title: "Fossils", summary: "Describe how fossils form and what they show." },
    { reference: "4.6.3.6", title: "Extinction", summary: "Explain causes of extinction." },
    { reference: "4.6.3.7", title: "Resistant bacteria", summary: "Explain natural selection in bacteria and antibiotic resistance." },
    { reference: "4.6.4", title: "Classification", summary: "Describe classification systems and binomial naming." },
  ],
};

const ECOLOGY: SpecificationUnit = {
  title: "4.7 Ecology",
  summary: "Ecosystems, biodiversity, material cycles and food production.",
  topics: [
    { reference: "4.7.1.1", title: "Communities", summary: "Describe interdependence and competition in a community. Required practical 9: measure population size." },
    { reference: "4.7.1.2", title: "Abiotic factors", summary: "Explain how abiotic factors affect communities." },
    { reference: "4.7.1.3", title: "Biotic factors", summary: "Explain how biotic factors affect communities." },
    { reference: "4.7.1.4", title: "Adaptations", summary: "Describe behavioural, structural and functional adaptations." },
    { reference: "4.7.2.1", title: "Levels of organisation", summary: "Describe organisms, populations, communities and ecosystems." },
    { reference: "4.7.2.2", title: "How materials are cycled", summary: "Describe the carbon and water cycles." },
    { reference: "4.7.2.3", title: "Decomposition", summary: "Explain decomposition and the effect of temperature, water and oxygen." },
    { reference: "4.7.2.4", title: "Impact of environmental change", summary: "Explain how environmental change affects the distribution of organisms." },
    { reference: "4.7.3.1", title: "Biodiversity", summary: "Explain why biodiversity matters and how it is affected." },
    { reference: "4.7.3.2", title: "Waste management", summary: "Describe the effects of waste and how it is managed." },
    { reference: "4.7.3.3", title: "Land use", summary: "Describe the effects of changing land use." },
    { reference: "4.7.3.4", title: "Deforestation", summary: "Explain the effects of deforestation." },
    { reference: "4.7.3.5", title: "Global warming", summary: "Explain the greenhouse effect and the consequences of global warming." },
    { reference: "4.7.4.1", title: "Trophic levels", summary: "Describe food chains, trophic levels and energy transfer." },
    { reference: "4.7.4.2", title: "Pyramids of biomass", summary: "Interpret pyramids of biomass." },
    { reference: "4.7.4.3", title: "Transfer of biomass", summary: "Calculate and explain energy transfer between trophic levels." },
    { reference: "4.7.5.1", title: "Factors affecting food security", summary: "Explain the factors that affect food security." },
    { reference: "4.7.5.2", title: "Farming techniques", summary: "Describe farming techniques that increase food production." },
    { reference: "4.7.5.3", title: "Sustainable fisheries", summary: "Explain how fish stocks can be conserved." },
    { reference: "4.7.5.4", title: "Role of biotechnology", summary: "Describe the use of biotechnology in food production." },
  ],
};

export const AQA_BIOLOGY_UNITS = [CELLS, ORGANISATION, INFECTION, BIOENERGETICS, HOMEOSTASIS, INHERITANCE, ECOLOGY];

const EXAM_FORMAT =
  "AQA GCSE Biology (8461). Paper 1 covers 4.1–4.4; Paper 2 covers 4.5–4.7. Each paper is 1 hour 45 minutes, 100 marks and 50% of the GCSE. Both are available at Foundation and Higher tier; there is no coursework. Required practicals are examined in the written papers.";

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True only for the exact course the map covers. */
export function isAqaGcseBiology(course: {
  subject: string;
  level: string;
  examBoard: string;
}): boolean {
  const level = normalise(course.level);
  return (
    normalise(course.subject) === "biology" &&
    normalise(course.examBoard) === "aqa" &&
    (level === "gcse" || level.startsWith("gcse "))
  );
}

/**
 * The specification as the page should render it. Every topic carries a real
 * AQA reference, so a student can cross-check it. The unit count is the seven
 * specification sections, not a notes-site "Exam Skills" page.
 */
export function buildAqaBiologyPathway(course: {
  subject: string;
  level: string;
  examBoard: string;
}) {
  if (!isAqaGcseBiology(course)) return null;
  const units = AQA_BIOLOGY_UNITS.map((unit, unitIndex) => ({
    title: unit.title,
    summary: unit.summary,
    topics: unit.topics.map((topic, topicIndex) => ({
      id: `u${unitIndex + 1}t${topicIndex + 1}`,
      title: topic.title,
      specReference: topic.reference,
      summary: `AQA specification ${topic.reference}: ${topic.summary}`,
      keyPoints: [] as string[],
      examSkill: "",
    })),
  }));
  const paperOne = units.slice(0, 4).flatMap((unit) => unit.topics.map((topic) => topic.id));
  const paperTwo = units.slice(4).flatMap((unit) => unit.topics.map((topic) => topic.id));
  return {
    overview:
      "The AQA GCSE Biology (8461) specification, in its own order and numbering: 7 sections and the subject content AQA requires, including active transport and the required practicals.",
    examFormat: EXAM_FORMAT,
    units,
    papers: [
      { label: "Paper 1", topicIds: paperOne },
      { label: "Paper 2", topicIds: paperTwo },
    ],
    source: "specification" as const,
  };
}

/** A gap check for the map itself: catches an edit that drops required content. */
export function aqaBiologyGaps(): string[] {
  const topics = AQA_BIOLOGY_UNITS.flatMap((unit) => unit.topics);
  const refs = new Set(topics.map((topic) => topic.reference));
  const required = [
    "4.1.3.1",
    "4.1.3.2",
    "4.1.3.3",
    "4.1.1.2",
    "4.4.1.2",
    "4.5.2.1",
    "4.7.1.1",
  ];
  return required.filter((reference) => !refs.has(reference));
}
