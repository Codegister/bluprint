/**
 * The supplied paper-format guideline, used as context for the generator.
 *
 * It describes the furniture, mark-to-minute ratios and board conventions that
 * separate an authentic paper from a generic worksheet.
 */
export const PAPER_FORMAT_GUIDELINE = `BLUPRINT PRACTICE PAPER GUIDELINE
A reference document for an AI paper generator.

HOW TO USE THIS DOCUMENT

Read this document before generating any paper. It explains how real exam papers
are built: what furniture they carry, how marks and minutes relate, which command
words belong to which board, how mark schemes are written, and where subjects and
boards depart from the general pattern. It does not contain the exact numbers for
every qualification, because those numbers vary by board, subject, specification
version and exam series. The companion file paper_checklist.csv holds the paper
specifications you must match and the tick boxes you must complete. The companion
file paper_generator_system_prompt.txt tells you the procedure to follow.

Rule zero: never invent a specification number. If a figure is not in the checklist
and not supplied by the user, look it up or mark the paper PARTIAL. A paper with the
wrong duration or mark total is instantly recognisable to a student and does more
damage than no paper at all.

1. WHAT AN EXAM PAPER IS MADE OF

A real paper is a document with fixed furniture. Generated papers usually look fake
because the furniture is missing, not because the questions are poor.

Front page: board name, qualification title and level, specification code, paper
number and title, date or series, time allowed, total marks, materials and
instructions (calculator, ruler, formula sheet, source booklet), candidate
identifiers, and a line telling candidates how many questions to answer.

Rubric: the instruction block that sets conditions. It must be internally
consistent with the paper: if it says answer all questions, there must be no choice;
if it says answer one from each section, the sections must offer a real choice.
Common real rubrics include "Answer all questions", "Answer all questions in
Section A and one question from Section B", "You are advised to spend about 45
minutes on Section A", and "Write your answers in the spaces provided".

Sections: many papers are divided by content, by skill, or by text. Section headers
carry their own marks and time guidance. Some boards never letter sections (AQA GCSE
sciences run as a single numbered sequence); others depend on lettered sections
(OCR sciences, Edexcel history options). Match the checklist, not habit.

Answer spaces: line counts signal expected length. A one-mark question gets one
line; a six-mark question gets six to eight lines or a box; an extended response
gets a full page. If your output includes line guidance, make it proportional to the
tariff.

Materials: formula sheets, periodic tables, equations sheets, source booklets,
extracts, photographs, data tables, graph paper, case studies. A paper that
references a table which is not provided is unusable.

Furniture at the end: "END OF QUESTION PAPER", acknowledgements, copyright lines,
and in real papers a blank page. Optional but authentic.

2. MINUTES AND MARKS: THE INVISIBLE SIGNATURE

The ratio of marks to time is the strongest signal of authenticity, and it is the
thing generated papers most often get wrong.

    Maths, GCSE, all boards: about 0.9 marks per minute
    (Edexcel GCSE Maths 1MA1: 80 marks in 90 minutes, 0.89)
    Sciences, GCSE: about 0.95 per minute
    (AQA GCSE Biology 8461: 100 marks in 105 minutes, 0.95)
    Sciences, A-level: about 0.76 per minute
    (AQA A-level Biology 7402: 91 marks in 120 minutes, 0.76)
    Maths, A-level: about 0.83 per minute
    (Edexcel 9MA0: 100 marks in 120 minutes, 0.83)
    Essay subjects, GCSE: about 0.55 to 0.7 per minute
    (Edexcel GCSE History Paper 1: 52 marks in 80 minutes, 0.65 from summer 2025)
    Essay subjects, A-level: about 0.5 to 0.65 per minute
    (many humanities A-level papers carry about 80 marks in 150 minutes, 0.53;
    check the row, because AQA A-level English Literature Paper 1 is 75 marks in
    180 minutes)
    Scottish qualifications: lower, because reading load is higher
    (SQA National 5 Maths Paper 1: 40 marks in 60 minutes, 0.67;
    Paper 2: 50 marks in 90 minutes, 0.56)

Use the checklist value. Where the checklist is marked TYPICAL or UNVERIFIED, keep
within 0.05 of the stated ratio and flag the assumption in your output.

Consequence for generation: a paper that is 100 marks with 60 minutes is wrong even
if every question is excellent. If you have a mark total and no duration, derive
duration as marks divided by the family ratio, then round to a plausible exam length
(45, 60, 75, 90, 105, 120, 135, 150).

3. TARIFFS AND HOW THEY LADDER

A tariff is the mark value of a question. Real papers use a small set of tariffs and
they ascend. Moving from 1 to 2 to 3 to 4 to 6 to 8 to 12 to 16 to 20 to 25 marks is
the normal ladder. A paper using 7-mark or 11-mark questions where the board uses
6 and 12 is a tell.

Typical tariffs by level and family:

    GCSE maths: 1, 2, 3, 4, 5 marks, occasionally 6. Every mark is earned by a step,
    so multi-step questions carry 3 to 5.
    GCSE sciences: 1, 2, 3, 4, 6. The 6-mark extended response is the standard high
    tariff and uses levels of response.
    GCSE humanities: 4, 8, 12, 16, with 16 usually being an essay or a source
    evaluation.
    GCSE English Language: reading tariffs vary by board; AQA uses 4, 8, 8, 20, 40
    (Paper 1) and 4, 8, 12, 16, 40 (Paper 2), plus a 40-mark writing task.
    A-level sciences: 1 to 6 in structured questions, plus 25 for the essay.
    A-level humanities: 25 or 30 for essays, 10 to 20 for source or interpretation
    questions.
    A-level maths: 1 to 12, average about 7 per question across a 100-mark paper.
    Vocational and KS3: 1, 2, 3, 4; rarely above 6.

Question count follows from tariff and marks. A 100-mark paper of 6-mark questions
has 16 questions; a 100-mark maths paper has 12 to 16 questions; an 80-mark essay
paper has 4 to 6 questions. Check the checklist field question_count_note.

4. COMMAND WORDS

Command words are board-specific and they carry marking consequences. Use the board's
own vocabulary. The shared core, in ascending cognitive demand:

    State, Give, Name, Identify - one word or phrase, one mark, no explanation.
    Describe - say what happens or what it is; no mechanism, no reason.
    Explain - give a reason or mechanism; marks attach to causal steps.
    Calculate, Determine, Work out - show working; method marks then accuracy marks.
    Compare - both sides, explicitly, with a connective.
    Contrast - differences only.
    Analyse - break into parts and show how they relate.
    Discuss - balanced treatment, both sides, usually with a judgement.
    Evaluate - weigh evidence and reach a supported conclusion.
    Justify - give the reason for a choice already made.
    Assess - similar to evaluate, often used for source or interpretation questions.
    Suggest - apply knowledge to an unfamiliar context; answers are not in the text.

Board personalities in command words:

    AQA sciences use Suggest heavily, and its mark schemes accept "any two from"
    lists. AQA humanities use Evaluate and Assess with published descriptors.
    Edexcel favours Justify, and its maths papers use "Work out" and "Show that".
    OCR uses Outline and State as a low-tariff pair, and Describe with a precise
    subject meaning in sciences.
    WJEC and Eduqas use Explain and Discuss, and their mark schemes often accept
    "valid point" rather than fixed content.
    SQA uses Evaluate and Discuss with marking instructions written per question.
    Cambridge IGCSE uses Give, State, Describe, Explain, Suggest, Calculate, and its
    mark schemes are usually point-based with a strict mark total.

If you use a command word the board does not use, the paper reads as foreign. When
unsure, use the board's own past-paper vocabulary from the checklist row.

5. QUESTION ARCHETYPES BY SUBJECT FAMILY

Mathematics. Multi-part stems are normal: part (a) is a one or two mark entry point,
later parts build. Worked example in shape: "A shop sells x pens at 45p and y
notebooks at £1.20. (a) Write an expression for the total cost in pence. (2) (b) A
customer spends £6.60. Show that 45x + 120y = 660. (1) (c) Find one possible
combination. (3)". Geometry questions carry a diagram note. "Show that" questions
must be provable from the given data. Give exact answers where the board does, and
state the required degree of accuracy.

Sciences. Structure: short factual recall, then application to a novel context, then
extended response. Required practicals appear as data-handling questions with a table
or graph. "Suggest why" questions rely on unfamiliar contexts. Six-mark extended
responses use levels of response and expect linked, causally sequenced points rather
than a list. Include units, significant figures, and a stated apparatus where
relevant.

English Language. Paper 1 is fiction: an extract or a whole short text, then
questions moving from retrieval to analysis to creative writing. Paper 2 is
non-fiction: two texts, comparison, then transactional writing with a stated form,
audience and purpose. Quote-based analysis answers use a "what, how, why" structure.
Writing tasks always carry a form, an audience and a purpose; omit any of the three
and the task is not authentic.

English Literature. AQA GCSE English Literature (8702) is untiered. Paper 1 is
105 minutes and 64 marks: Section A Shakespeare is 30 marks plus 4 SPaG, and
Section B, the 19th-century novel, is 30 marks. Both questions are extract-based
and the paper is closed book. Paper 2 is 135 minutes and 96 marks: Section A modern
text is 30 marks plus 4 SPaG and has no extract; Section B is a named poem; Section
C is unseen poetry. Open-book rules vary: AQA A-level English Literature Paper 1
is open book in Section C only; Sections A and B are closed book. Check the row.
Essays combine an extract-based question with a whole-text question. Assessment
objectives are split between the text, the writer's methods, context, and
comparison; structure the question so each can be reached.

History. Source and interpretation questions have a fixed grammar: "How useful is
Source A to an enquiry into..." (utility: provenance, content, purpose), "Explain
why..." (causation), "Write an account of..." (narrative sequence), "How far do you
agree..." (judgement with criteria). Source booklets are mandatory when referenced.
Edexcel structures differ by paper: thematic study with a historic environment,
period study plus British depth, then modern depth with sources and interpretations.

Geography. Fieldwork questions and physical/human splits. Data-response questions
carry maps, graphs or photographs. Extended responses use "assess" and "evaluate"
with a structure the mark scheme expects (point, evidence, evaluation).

Business and economics. Case studies carry the context, and questions move from
knowledge ("State two...") to analysis ("Explain one effect on...") to evaluation
("Evaluate whether..."). Calculations (profit, margins, break-even, ratios) appear
inside case-study questions. Evaluation answers need a judgement and a "depends on"
condition.

Languages. Four skills, separately assessed. Reading and listening use authentic-
style short texts and announcements, with questions in the target language for the
higher tier. Writing tasks carry a word count, a bullet-point content list, and a
form (blog, letter, article). Speaking is a role play, a photo card and a general
conversation. Do not generate a listening paper without acknowledging you cannot
supply audio.

Computer science. Pseudocode or code in the board's specified notation, trace tables,
algorithm questions with a stated input and output, and longer answers on
architecture or ethics. Program code must run. Marks attach to each correct step in a
trace, so state the trace table columns.

6. ASSESSMENT OBJECTIVES AND HOW TO HIT THEM WITHOUT LABELLING THEM

Boards publish AO weightings. You do not label questions with AOs in the paper; you
allocate them so the mix matches.

AQA A-level Biology 7402 is a clean worked example: AO1 30 to 35 per cent (knowledge),
AO2 40 to 45 (application), AO3 25 to 30 (analysis and evaluation). AQA GCSE sciences
run close to 40/40/20. A-level humanities typically weight AO1 knowledge, AO2
analysis, AO3 evaluation and, where present, AO4 context and AO5 comparison.

To hit an AO split, count questions by demand rather than by topic: recall and
definition questions are AO1; unfamiliar context questions are AO2; "evaluate",
"assess" and "justify" questions are AO3. If the split is 40/40/20 and your paper is
all definitions, it will feel wrong before anyone checks the numbers.

Practical and mathematical skills carry quotas in sciences: AQA A-level Biology
requires at least 10 per cent Level 2 mathematical skills and at least 15 per cent
practical skills. Include one data-handling question and one practical-based question
at minimum.

7. MARK SCHEMES: FOUR ARCHETYPES

The mark scheme must be written in the board's style. A prose answer key is the
loudest tell of a generated paper.

Point-marked schemes (maths, and much of sciences). Marks are awarded per step.
Conventions: M1 for method, A1 for accuracy, B1 for an independent mark, ft or ecf
for error carried forward, cao for correct answer only, oe for or equivalent, and
"ignore" for things that do not invalidate. Example shape:

    Question 3(a)  M1  45x + 120y seen
                   A1  45x + 120y = 660
    Question 3(c)  M1  attempts a valid combination
                   A1  8 pens and 2 notebooks (or equivalent)

Levels of response (extended writing, humanities and science six-markers). Bands
with descriptors and an indicative content list. Example shape:

    Level 3 (5 to 6 marks)  Detailed, linked explanation covering both structure and
                            function, with accurate use of terminology.
    Level 2 (3 to 4 marks)  Some linked explanation, partially accurate.
    Level 1 (1 to 2 marks)  Isolated relevant points.
    Indicative content: active site; denaturation; shape change; rate falls.

Hybrid: point marks for the short parts, levels for the extended part of the same
question. Common at GCSE.

SQA style: per-question marking instructions, often with "award 1 mark for each
correct point", and explicit handling of common wrong answers.

Always include: total marks for each question, the total for the paper, acceptable
alternatives, and "any two from" phrasing where the board uses it. Never write a mark
scheme that requires a point the source material cannot support.

8. BOARDS: WHAT ACTUALLY DIFFERS

AQA. Three-paper sciences at A-level. At GCSE, separate sciences have two papers
each, while Combined Science: Trilogy has six papers (two biology, two chemistry,
two physics), each 1h15/70 marks; Combined Science: Synergy has four longer
papers. Tiered at GCSE, untiered at A-level. Papers are one continuous numbered sequence in sciences. Mark schemes use
levels of response with indicative content. Papers are typographically plain.

Pearson Edexcel. Three papers for maths at both GCSE and A-level, with a formula
sheet provided. History splits by study type. Business and economics lean on case
studies. Mark schemes show a Process column and an Evidence column for maths, and
indicative content grids for extended writing. Papers carry structured front matter.

OCR. Lettered sections are common (A, B), and papers are explicit about "Answer all
questions in Section A". Chemistry A at A-level uses named themes per paper
(periodic table and physical chemistry; synthesis and analytical techniques; unified
chemistry). Mark schemes use levels of response with detailed indicative content.

WJEC and Eduqas. Component-based rather than paper-based naming at GCSE. English
Language runs two components with a 40/60 split; Component 2 has six reading
questions and two 20-mark transactional writing tasks. Mark schemes accept a range of
valid responses and often invite examiner judgement.

CCEA. Northern Irish context, with local case studies in geography and history.
Unit-based modular structure in several subjects.

SQA. National 5 and Higher instead of GCSE and A-level. Papers are shorter, with a
lower marks-per-minute ratio and a separate assignment or added value unit. Marking
instructions are written per question.

Cambridge IGCSE. Core and Extended tiers with separate paper codes (for Maths 0580:
Core Papers 1 and 3 are 1h30/80 marks each; Extended Papers 2 and 4 are 2h/100
marks each; each paper is 50% of its tier). Mark schemes are point-marked and strict about accepted
answers.

If the checklist does not state a board's habit, do not assume it. Flag it.

9. LEVELS: WHAT CHANGES BETWEEN THEM

KS3. There are no awarding-body KS3 papers. Assessment is school-designed against the
National Curriculum. Generate school-style assessment: 45 to 75 minutes, 40 to 80
marks, tariffs 1 to 6, familiar contexts, no board branding, no tiering, and language
pitched below GCSE. If a user asks for a "board" KS3 paper, say plainly that no board
publishes one and offer school-style instead.

GCSE. Tiered in maths, sciences and languages (Foundation and Higher); untiered in
English, history and most humanities. Two or three papers. Tariffs up to 6 in
sciences, 16 in humanities. Language is accessible and direct.

AS. Half a qualification, usually two papers, shorter essays (25 marks rather than
30), and a narrower content range. Graded A to E.

A-level. Two or three papers plus, in several subjects, a non-examined assessment
worth 20 per cent. Tariffs reach 25 or 30 for essays. Expect sustained argument,
synoptic links across topics, and greater reading load, which is why marks per minute
drops compared with GCSE.

Vocational and other. BTEC and similar use assignment briefs and criteria rather than
timed papers. Do not generate a timed paper for a coursework-based qualification
unless explicitly asked.

10. PROGRESSION AND DIFFICULTY INSIDE ONE PAPER

Real papers ramp. The first question of each section is an entry point; the last is
discriminating. Patterns that hold across boards:

    Maths: questions ascend in difficulty but not monotonically; topic order matters
    more than difficulty, and the final question of each section is the
    discriminator. Papers usually open with a one or two mark calculation.
    Sciences: recall, then application, then extended response; extended responses
    sit late in each paper.
    English: extraction, then analysis, then creation. The writing task is last and
    carries the highest tariff.
    Humanities: short source work first, essays last.
    Languages: listening or reading first, writing last.

For a Foundation tier paper, cap the ceiling: everything should be reachable, the
final questions should be the hardest accessible item, not an A-level style stretch.
For Higher, include one genuinely discriminating item. For A-level, include at least
one synoptic question that draws on more than one topic.

11. FIFTEEN THINGS THAT MAKE A GENERATED PAPER LOOK FAKE

1.  Mark total does not equal the sum of the questions.
2.  Duration inconsistent with the marks-per-minute band for the family.
3.  Tariffs outside the board's ladder (7-mark questions at GCSE, 11-mark questions).
4.  Questions that are all the same length and difficulty.
5.  A rubric promising choice that the paper does not offer.
6.  Referenced materials absent (no source booklet, no table, no formula sheet).
7.  Command words the board does not use.
8.  A prose answer key where the board uses point marks or levels.
9.  Mark scheme awarding marks for content absent from the paper's stimulus.
10. No 6-mark or extended response in a paper that always has one.
11. AO mix skewed to recall in a paper weighted towards application.
12. Tiers ignored: one paper for both Foundation and Higher.
13. Contexts that are anachronistic, geographically wrong, or outside the spec.
14. Sections or component names invented for a board that does not use them.
15. Board voice wrong: American spellings, wrong exam series naming, wrong paper
    codes.

12. UNCERTAINTY: WHAT TO DO WHEN YOU DO NOT KNOW

The checklist marks each row VERIFIED, TYPICAL or UNVERIFIED.

VERIFIED means the figures came from a board document. Use them exactly.

TYPICAL means the figures are consistent across papers but not confirmed on the
current specification. Use them, but state "duration and mark total assumed" in your
output notes.

UNVERIFIED means the figures conflict or could not be confirmed. Do not guess. Either
ask the user for the specification values, or generate with clearly labelled
assumptions and mark the paper PARTIAL rather than PASS.

Never present an assumption as a fact. A student revising from a paper with an
invented duration is being misled, and that is worse than a blank field.

END OF GUIDELINE
`;
