# Bluprint

Bluprint is a private revision workspace with two ways in. Choose your courses once and it
maps each specification into units and topics, then builds study material for any topic — or
upload photos of your notes, sample a video, or paste text and compile a study set directly.
Every set gets a summary, flashcards, a multiple-choice quiz, and exam-style questions with
AI marking, plus an AI tutor that knows the material. Each course also keeps up to four
**saved practice papers**, written from the specification in that subject's real question
format — RS 3/4/5/12-mark parts, a single English Literature essay, maths calculations, and
so on — and marked question by question. Courses can be turned into a colour-coded weekly
revision timetable built from topics, from past papers only, or from a mix of the two.

Version 1 is built for a small group of friends. Each person signs in separately and gets
their own dashboard containing only their courses and study sets.

## Stack

- **Vite + React 19 + TypeScript** — the frontend
- **Tailwind CSS v4 + shadcn/ui** — the interface
- **Convex** — database, file storage, server actions, and authentication
- **Convex Auth (email one-time code)** — separate accounts without password management
- **NVIDIA API** — study-set and past-paper generation, vision, marking, and tutoring,
  through the OpenAI-compatible endpoint at `integrate.api.nvidia.com`
- **Published specification outlines (scraped)** — the official topic outline for each
  course. The pathway builder follows the published qualification → subject → exam board →
  tier route, so the map matches the board's own specification headings exactly. No AI is
  used for the pathway.
- **Bun** — package manager and scripts

There is no separate server to deploy. Convex hosts the backend, file storage, and AI
actions.

The visual direction is a light, friendly study workspace: a white sidebar with the deck
list, soft rounded cards on a pale grey canvas, a violet accent with pastel icon tints, and
Poppins headings. The little violet axolotl is drawn in SVG, so the app needs no image
assets.

## Two ways to start

### 1. Choose your courses (course pathway)

Open **Choose courses** from the dashboard and choose your qualification first — GCSE, KS3,
A-Level, IB, AP or Undergraduate. That decides which exam boards and tiers the picker
offers. Subjects then appear as a single-line list with the common ones at the top and the
rest alphabetically below, plus a search box for anything further down. Clicking a subject
replaces the list with **one question at a time** — which exam board, then which tier — and
returns to the list as soon as the last one is answered. Nothing expands inline and no
side panel grows, so a whole timetable of subjects can be scanned at a glance, and a school
that uses AQA for Biology and Edexcel for Maths is still handled one subject at a time (up
to 12 courses). GCSE asks for a board and a **Higher tier** / **Foundation tier** choice,
with Higher preselected; A-Level asks for a board only; IB asks HL or SL; KS3, AP and
university modules have nothing to ask, so tapping one simply adds it. **The first board
and tier you answer become the default** for every subject added afterwards: after the
first subject, a new one is added straight away with that board and tier, and the row
shows the choice with a small star, and the row is briefly highlighted as it appears.
Clicking an already-added subject reopens its questions so a subject with a different
board or tier can be changed (changing it then updates only that subject, not the
default), and finishing the questions returns you to the same scroll position in the list. KS3 stores no board
or tier and is read from the published KS3 subject pages. Combined Science is its own
subject, so there is no separate Triple/Combined toggle. Poetry is
not chosen in the picker: every anthology cluster the board publishes arrives as its own
unit, and the ones your school does not teach are removed from the pathway.

Bluprint queues each course immediately and maps the current specification server-side. It
starts from the published outline for that exact level, subject and board, so every paper,
topic and subtopic in the specification reaches the map,
then writes a summary, key points and an exam skill for each topic.

Each course gets its own workspace on the dashboard, with topic-level progress. Open any
topic and **Study this topic** creates a normal study set from that topic's summary, key
points, and exam skill — a long summary, 20 detail-heavy cards, a ten-question quiz, and
four exam questions — linked back to the course. Ticking topics off tracks course progress;
the next unrevised topic is always offered at the top of the course page.

Every unit and topic has its own **remove** control. Removing something edits only the
pathway: study sets already built from it stay in the library, and a rebuild brings the
full published outline back. That is how a student keeps one poetry cluster, drops an
optional unit, or skips a paper their school does not enter them for.

The mapping is deterministic: the published outline is read from source, then each topic's
summary and key points are assembled from its own subtopics. No model is consulted, so a
slow or rate-limited AI provider can never leave a course half-mapped or invent a topic. A
course never lands in a "needs a retry" state.

### 2. Upload your own material

Use **Upload material** to add up to eight photos, a short video, or pasted notes. This keeps
the upload compile flow and is the right path for a single handout, a textbook page, or
notes that do not follow a specification. Three sliders choose the length separately:
flashcards, quiz questions and exam-style questions, each from 1 to 100. If the notes
cannot realistically support the number asked for, Bluprint builds the maximum it can and
says so on the set page; it never silently pretends the request was met.

### 3. Practise a paper in your subject's format

Every ready course opens onto **Practice papers**. A paper is written from the saved
specification in that subject's real question format. Edexcel Religious Studies uses
1 (a) 3 marks, 1 (b) 4 marks, 1 (c) 5 marks and 1 (d) 12 marks; AQA RS uses 1, 2, 4, 5 and
12 marks; Eduqas uses 2, 5, 8 and 15; English Literature is a single long essay (30 marks
for AQA, 40 for Edexcel and OCR); English Language is one extended writing task; maths is
calculations with no essays; and so on. The course section shows the exact format before
you build, and the paper keeps the board's cover rubric, numbering, mark notation and
command words.

Each paper is generated once and saved, so it is the same paper on every visit and can be
scheduled as a one-hour session in the timetable. Open it and answer each question.
**Mark answer** sends it to the examiner prompt used across the app. Point-marked
questions are credited one bullet at a time; essay questions are marked against level
descriptors. The model answer and mark scheme unlock after marking, and the score is saved,
so the course section shows how much of each paper you have answered and how many marks you
earned. Four practice papers per course is the cap; remove one to build another.

## What version 1 does

1. **Add source material** — up to eight photos (JPG or PNG), a video (six frames are
   sampled in the browser), or pasted text.
2. **Compile** — NVIDIA reads the source, then generates a structured summary and up to
   100 of each: detail-heavy flashcards, quiz questions with explanations, and written
   exam questions with marking guides. The numbers are chosen with three sliders at
   upload. Long sets are generated in batches so a single JSON response cannot truncate
   the middle of the deck, and a batch that comes back malformed is retried rather than
   ending the run.
3. **Study** — flip and self-rate flashcards, take the quiz, and answer exam questions
   that are marked against the guide with feedback and a model answer.
4. **Set the exam context** — tag a set with a course, an exam board (AQA, Pearson
   Edexcel, OCR, WJEC / Eduqas, Cambridge International, IB, SQA, College Board AP), and a
   level (GCSE, A-Level, IB, AP, Undergraduate). Board and level steer the summary's exam
   focus, the phrasing of exam questions, and how written answers are marked. Course,
   board, and level are filterable and searchable on the dashboard.
5. **Review on a schedule** — flashcards use a simplified SM-2 schedule: a card you miss
   returns in ten minutes, a card you recall returns tomorrow and then at widening
   intervals (×2.5 ease, capped at 180 days). Each deck shows how many cards are due.
6. **Keep a habit** — the dashboard shows how many cards you have reviewed today against your daily goal.
7. **Ask the tutor** — the tutor can be pointed at a study set, a whole course, or one
   unit of a course. A set thread reads that set's notes; a course or unit thread reads the
   scraped pathway for that scope. It knows the course, board, and level, and keeps each
   conversation saved separately, so a question about one unit never blends into another.
   Answers are **streamed** — the reply is written into the chat as the model produces it,
   and is saved as it grows, so it survives a reload.
   A **Web** switch on the tutor header decides whether it may search the internet for the
   question. With web on, it can check exam-board pages and other sites, and the pages it
   used are listed under the answer and saved with the thread. With web off it answers from
   your material alone. Suggested first questions get you started; exam practice is one
   question at a time.
   The **power picker** under the prompt chooses how hard the tutor works: **Balanced**
   (default), **Ultra**, **Fast**, **Powerful**, or **Max**. **Ultra** is the ultra-fast
   option — the lowest-latency model with a short answer budget — while **Max** gives
   maximum strength, the largest reasoning model with the longest budget and the lowest
   temperature, so it deliberates deeply over a full derivation or a marked essay plan.
   Tiers are named by feel rather than by model — each one maps to a different NVIDIA
   model on the server, so the browser never sees a model id.
8. **Edit and rebuild** — **Set settings** next to a set's title changes its name, course,
   board, or level, and its three build sliders (1–100 flashcards, quiz questions and
   exam-style questions). "Save and rebuild" regenerates the summary, cards, quiz, and exam
   questions with those counts and the new board conventions; your notes and uploads are
   kept.
9. **Persist** — study sets, extracted notes, uploads, card progress, due dates, quiz
   scores, and tutor conversations stay saved between sessions, scoped to the account that
   created them.
10. **Plan your revision** — **Build revision timetable** asks which subjects to revise,
    which **study method** the plan uses (topics, past papers only, or a mix of both), how
    long each topic session should be, one paper choice for the whole plan, how long a school
    day and a day off should be, how many days a week you can work, and when your first exam
    is. Sessions are separated by short gaps, nothing runs past 8:00 pm, and if the topics
    will not fit the date you chose, the plan starts earlier rather than dropping topics.
    The schedule is saved to your account and appears in the sidebar as a colour-coded weekly
    timetable; clicking a topic session opens (or builds) its study set, and clicking a past
    paper session opens the saved paper.
11. **Practise a paper** — every ready course keeps up to four saved practice papers,
    written from its specification in that subject's real question format (RS 3/4/5/12,
    English essays, maths calculations, and so on) and marked question by question against
    their own mark schemes. Progress and marks per paper are kept alongside the course.

After signing in, the main screen is the **Home** dashboard. It keeps one primary action,
**New study set**, for uploading notes, a **Build revision timetable** action for planning
course topics, and one course action, **Add courses**, for building revision pathways from
published specifications.
Below those sit a course table with topic progress and material counts, and a saved-sets
table with status, due counts, card mastery and last quiz score. The sidebar also links to
the saved **Revision timetable**. Opening a set gives you five tabs — Summary, Flashcards,
Quiz, Exam, and Tutor — plus a **Set settings** button for renaming, rebuilding, or deleting
it. Sets built from a course topic link back to that course.

## Assumptions

- **Course pathways are scraped from the published specification, not written by a model.**
  The builder reads the page for the exact qualification, subject, board and tier —
  including the specification page when the notes page is not server-rendered. If there is
  no published page for a course, Bluprint stores a small starter map instead of inventing topics. Always check
  the official specification; the course page says this too. Topic study sets are generated
  lazily (one tap per topic), which keeps a nine-course setup affordable on free tiers.
- **The course picker is a curated catalogue plus custom entry.** It covers common GCSE,
  A-Level, IB, AP, and undergraduate subjects. Anything missing can be typed in. Every
  GCSE subject offers Higher tier and Foundation tier, defaulting to Higher because that is
  the more common entry; Combined Science is its own subject, and IB adds HL/SL.
- **Pathway rebuilds keep tick-offs by topic title.** A regenerated map may reorder units,
  so progress is re-matched by title; a topic whose title changed loses its tick. Study sets
  are never deleted when a course is removed; they stay in the library without a course
  link.
- **Course is free text with presets.** StudySmarter asks for an education system and Gizmo
  links a school; both are heavier than this app needs. A course label per set is enough to
  group decks, and it stays optional.
- **Days are UTC.** The daily goal and streak use UTC calendar days so two friends in
  different time zones see consistent numbers. A 4 a.m. local cut-off, as Anki uses, is not
  implemented.
- **Ten cards a day is the goal.** It is a display target, not a hard limit: any number of
  reviews counts and nothing is blocked.
- **A card you mark "again" comes back in ten minutes**, not the next day, so a study
  session can repair a gap immediately.
- **Board conventions are prompt guidance, not official mark schemes.** Real past papers
  and mark schemes are copyrighted, so questions are original and the AI imitates each
  board's published wording and marking style rather than reproducing a paper. Cambridge
  International answers use B1/M1/A1 points, IB extended answers use markband
  descriptors, and AQA, Edexcel, OCR, WJEC, and SQA answers earn one mark per creditable
  bullet.
- **A saved practice paper is original, but set out in the subject's format.** It is
  written from the course's stored specification in that subject's real question structure
  — for example RS 3/4/5/12-mark parts for each religion, or two long English Literature
  essays — and laid out the way the board lays out its own papers: cover rubric, question
  numbering, mark notation
  and command words. Published board papers and mark schemes are copyrighted, so the
  questions are original. The app does not link to or reproduce external papers. The
  timetable counts a paper as one hour, and the cover states that allowance. Papers are
  generated on demand, up to four per course, so a large course setup only pays for the
  papers someone actually sits.
- **The tutor has three scopes.** A study set reads that set's notes (up to 12,000
  characters); a course reads the whole scraped pathway; a unit reads only that unit's
  topics. Each scope keeps the last ten saved turns, has no web access, and is not a
  general-purpose chatbot. That keeps answers aligned with your material and keeps token
  cost predictable.
- **Tutor history is saved in the database**, one thread per set, per course, and per unit.
  There is no clear-thread button yet; deleting a set or course deletes its conversations.
- **Requested counts are capped by the material.** The sliders allow 1–100, but before
  generating Bluprint estimates a sane ceiling from the notes' word count — roughly one
  card per 12 words, one quiz question per 30, and one exam question per 90. The request is
  kept on the set, so the page can say "asked for 100, built 34" and explain that the
  material set the limit. This is deliberately conservative for exam questions, which need
  much more substance than a flashcard.
- **A single failed generation stage does not lose the set.** Bad JSON is repaired first
  (unescaped LaTeX backslashes and literal newlines, the usual cause of Physics sets
  failing), a malformed batch is retried, and if one section still cannot be produced the
  others are saved and the set page names the missing section with a rebuild prompt. Only a
  run where nothing at all came back is reported as a failure.

## Run it

### In this Freebuff environment

The Vite dev server is managed. The client currently uses a temporary Convex URL fallback
in `src/main.tsx` because the platform's `.env.local` still references the old deployment.
Once `VITE_CONVEX_URL` points at the new deployment and the Convex integration is repointed,
remove that fallback. Open the preview, add the NVIDIA keys (below), and use the app. No
terminal process needs to be started.

### Locally

```bash
bun install

# 1. Start the Convex dev deployment (creates or links a deployment and regenerates types)
bunx convex dev

# 2. In a second terminal, start Vite
bun dev
```

`bunx convex dev` writes the deployment URL into the project's environment. This template
already has Convex Auth configured. A fresh Convex deployment needs the auth environment
keys generated by the first `convex dev` run.

Open the printed local URL (usually `http://localhost:5173`).

### Checks

```bash
bunx convex dev --once  # push functions and regenerate types
bun tsc -b --noEmit     # frontend + Convex types
bun run lint            # ESLint (the template's UI primitives have pre-existing findings)
```

## Supply the API keys

Keys must never be committed or shipped to the browser. They are read only on the Convex
server, by the AI actions. The environment variable is named **`NVIDIA_API_KEY`**
everywhere in the code, comments, and configuration.

`NVIDIA_API_KEY` may contain a single key or a pool of keys separated by commas,
semicolons, or newlines:

```bash
npx convex env set NVIDIA_API_KEY "nvapi-key-one,nvapi-key-two,nvapi-key-three"
```

On Freebuff, add `NVIDIA_API_KEY` in the project's **Keys** tab and paste the keys as a
comma-separated value. Convex functions read it as `process.env.NVIDIA_API_KEY`.

Every NVIDIA request rotates to the next key in the pool. A key that returns HTTP 429 is
cooled down for 45 seconds and the request immediately moves to the next key. A key
rejected with 401 or 403 is dropped from rotation for the life of the server process.
There is no key configuration screen and no key storage in the database.

This is a shared pool for the whole app. Friends do not need their own NVIDIA accounts,
and usage bills to whoever owns the keys.

Get keys from [NVIDIA Build](https://build.nvidia.com/).

### Web access for the tutor

The tutor's **Web** switch searches the internet in four tiers, cheapest first. Every tier
is optional except the last, so the app works with no search credentials at all.

1. **Keyless sources (free, no account).** Wikipedia search plus article introductions,
   Wikibooks, DuckDuckGo's Instant Answer API, and Stack Exchange (biology, chemistry,
   physics, maths, computer science, English, history, chosen from the course). These run
   first on every question.
2. **Live-information questions skip tier 1.** Dates, timetables, prices, "latest", "this
   year" and any year from 2025 onwards cannot be answered by an encyclopedia, so those go
   straight to a real search provider instead of being grounded in an article about "GCSE".
3. **Keyed search providers, only when the free sources were thin.** Tavily, then Exa, then
   Serper, whichever have keys set. A provider that returns 429 (rate limit) or 402 (no
   credit) is parked for ten minutes and the next one takes over, so a used-up free tier
   degrades into the next provider rather than into an error.
4. **OpenRouter's browsing model**, only when no search provider found anything at all
   (typically a live question with no search keys configured). This is the paid fallback.

If none of them produce sources, the tutor answers from the student's own material. A
search outage never blocks an answer; the reply simply has no citations.

Results are cached for 15 minutes per question, and a Wikimedia rate limit parks the wiki
providers for ten minutes on their own.

#### Setting the keys

All are optional; add any one and its tier switches on.

| Provider | Environment variable | Free allowance | Get a key |
| --- | --- | --- | --- |
| Tavily | `TAVILY_API_KEY` | 1,000 credits/month, no card | <https://app.tavily.com> |
| Exa | `EXA_API_KEY` | $10 of credits/month, no card | <https://dashboard.exa.ai> |
| Serper | `SERPER_API_KEY` | 2,500 queries once | <https://serper.dev> |
| OpenRouter | `OPENROUTER_API_KEY` | Paid web plugin (last resort) | <https://openrouter.ai/keys> |
| Wikimedia | `WIKIMEDIA_CONTACT` | Not a key — your email, for a higher rate limit | — |

```bash
npx convex env set TAVILY_API_KEY "tvly-..."
npx convex env set EXA_API_KEY "..."
npx convex env set SERPER_API_KEY "..."
npx convex env set WIKIMEDIA_CONTACT "you@example.com"
```

On Freebuff, add the same names in the project's **Keys** tab. Keys are read only on the
Convex server and never reach the browser. Adding `WIKIMEDIA_CONTACT` matters: Wikimedia
allows unnamed clients about ten requests a minute, and a cloud IP is shared with other
traffic, so a compliant contact raises that limit considerably.

#### Other providers considered

| Provider | Free tier | Why it is not wired in |
| --- | --- | --- |
| You.com | Keyless MCP search, 100 queries/day | Non-standard endpoint; would need an MCP client |
| Linkup | $20/month credits for professional email accounts | Free tier depends on the account type |
| Firecrawl | 1,000 credits/month | Terms restrict commercial use of the free tier |
| Jina Search | 10M free tokens (~1,000 searches) | Reader models are CC-BY-NC; commercial licence needed |
| Brave Search | $5 monthly credit, card required | Terms forbid using results to build AI services |
| Perplexity Sonar | None | Pay-as-you-go only |

Keyless scraping of DuckDuckGo, Mojeek, Startpage, Ecosia, Qwant or Google is deliberately
not used: they return bot challenges (DuckDuckGo answers HTTP 202 with no results), and
Startpage and Qwant forbid automated retrieval in their terms.

### Course pathways need no key

Pathways are read from the published specification pages, so they build with no AI key at all.
`NVIDIA_API_KEY` is used only to build study sets and past papers, mark written answers
and answer tutor questions.

### Optional model overrides

NVIDIA retires models periodically. Defaults chosen from currently available hosted
endpoints:

| Purpose | Environment variable | Default |
| --- | --- | --- |
| Summaries, cards, quizzes, exams | `NVIDIA_TEXT_MODEL` | `nvidia/nemotron-3.5-lightning-30b-a3b` |
| Reading photos / video frames | `NVIDIA_VISION_MODEL` | `meta/llama-3.2-90b-vision-instruct` |
| Tutor tier: Fast | `NVIDIA_TUTOR_FAST_MODEL` | `meta/llama-3.1-8b-instruct` |
| Tutor tier: Balanced (default) | `NVIDIA_TUTOR_BALANCED_MODEL` | `NVIDIA_TEXT_MODEL`'s model |
| Tutor tier: Powerful | `NVIDIA_TUTOR_POWERFUL_MODEL` | `meta/llama-3.3-70b-instruct` |
| Tutor tier: Ultra (ultra fast) | `NVIDIA_TUTOR_ULTRA_MODEL` | `nvidia/nemotron-3.5-lightning-30b-a3b` |
| Tutor tier: Max (deep deliberation) | `NVIDIA_TUTOR_MAX_MODEL` | `nvidia/llama-3.1-nemotron-ultra-253b-v1` |
| Tutor answers with web access | `OPENROUTER_TUTOR_MODEL` | `meta-llama/llama-3.3-70b-instruct` |
| Tutor dictation through OpenRouter | `OPENROUTER_STT_MODELS` | `nvidia/parakeet-tdt-0.6b-v3`, then `openai/whisper-large-v3-turbo` |

Set overrides on the Convex deployment the same way as `NVIDIA_API_KEY`. If a model is
retired, the set shows a clear "model not available" message and the environment variable
is the fix.

### Dictation in the tutor

Dictation works in two layers, and neither needs a new key:

1. **Live browser dictation, used first.** Chrome, Edge and Safari include a speech
   engine, so words appear in the prompt as you speak. Nothing is uploaded and there is
   no cost; the audio is handled by the browser vendor rather than by this app.
2. **Server transcription, as the fallback.** When the browser has no engine, or it stops
   (no network, blocked, unsupported), the 60-second clip is uploaded and transcribed
   server-side. No key reaches the page. Providers are tried in order:

| Order | Provider | Needs |
| --- | --- | --- |
| 1 | NVIDIA's own speech deployment | `NVIDIA_API_KEY` **and** `NVIDIA_ASR_URL` |
| 2 | NVIDIA Parakeet, through OpenRouter | `OPENROUTER_API_KEY` with credit |
| 3 | OpenAI Whisper, through OpenRouter | `OPENROUTER_API_KEY` with credit |

**About credits:** OpenRouter bills transcription per audio second (roughly one penny per
twelve minutes of speech) and currently lists no free transcription model. An OpenRouter
account without credit answers HTTP 402, and the prompt says exactly that. Either add a
little credit, or point `NVIDIA_ASR_URL` at an NVIDIA speech deployment so
`NVIDIA_API_KEY` is used:

```bash
npx convex env set NVIDIA_ASR_URL "https://<id>.invocation.api.nvcf.nvidia.com/v1/audio/transcriptions"
# only if that deployment also asks for the function id
npx convex env set NVIDIA_ASR_FUNCTION_ID "<uuid>"
```

NVIDIA's OpenAI-compatible gateway (`integrate.api.nvidia.com`) has no
`/v1/audio/transcriptions` route — NVIDIA serves speech as per-model deployments, which is
why the URL is configuration. Copy it from the API tab for
`nvidia/parakeet-tdt-0.6b-v3` on <https://build.nvidia.com>.

A blocked microphone, a rate limit, an empty recording or a provider error each show a
readable message under the prompt instead of a fake transcript. Clips are capped at 60
seconds in the browser and rejected above 8 MB. `NVIDIA_ASR_MODEL` and
`OPENROUTER_STT_MODELS` (comma separated) override the model choice.

## How a set is compiled

- Creating a set saves it immediately with status **queued**.
- Opening the set triggers one server action. An atomic claim prevents duplicate runs.
- The action reads stored images (one vision request per image), writes the extracted
  notes to the set, then asks NVIDIA in sequence for the summary, flashcards, quiz, and
  exam questions. Progress messages are written to the set so the page updates live.
- If anything fails, the set gets an **error** status, a readable message, and a retry
  button. Extracted notes and uploads are kept.
- Rate limits (HTTP 429) rotate to the next key in the pool. If the whole pool is
exhausted, the set is paused with a clear message so you can retry after the cooldown.
  Rejected keys are skipped automatically.

Convex actions can run for several minutes, so generation continues if the page is closed.
Reopening the set shows the saved result.

Tutor questions are a single NVIDIA request each: the set's notes, its course/board/level,
and the last ten turns are sent, and the question and answer are saved only after a usable
reply comes back. A failed call leaves the previous conversation untouched and shows the
same rate-limit messages as the rest of the app.

## How a course pathway is built

- Choosing courses writes every course with status **queued** in one transaction, then
  schedules one Convex action per course, 1.5 seconds apart. The browser is not held open.
- The builder walks the published route: qualification, subject, exam board, then tier. It
  fetches `/courses/<level>/<subject>/<board>/<tier>/notes`, follows the site's redirect to
  its dated route (Biology → biology-triple) and reads the paper, module, topic and subtopic
  headings from the page. IB uses its `ibhl` / `ibsl` route instead of a board segment.
- Combined Science is the one qualification split before the exam board: Biology,
  Chemistry and Physics are separate component routes. The scraper reads all three and
  merges them into one pathway with a unit per science, so a Combined Science course covers
  the whole qualification.
- If that notes page is a client-rendered shell, the specification page at
  `/specifications/<level>/<subject>/<board>` supplies the numbered topic list instead.
- The pathway is a direct mapping of those headings: summaries, key points and exam skills
  are assembled from the scraped subtopics. Nothing is invented, so the map covers the
  entire published specification and no unit needs a model call.
- If there is no published page for a course, the deterministic starter map keeps it
  usable, and a rebuild replaces it once the outline is published. Students are never asked
  to retry.
- **Study this topic** writes the topic's summary and key points into a study set and opens
  it. The existing compile pipeline takes over, so the topic set has the same summary,
  cards, quiz, exam marking, scheduling, and tutor as an uploaded set.
- Marking topics complete is manual. A topic's linked study set, card counts, and course
  scores are derived from the set, not duplicated.

## How a revision timetable is built

- The builder is four separate pages, each with its own URL and a **Next** button:
  subjects; **one study method for the whole timetable** (topics, past papers only, or a mix
  of both) plus a session length (25, 45, 60, or 90 minutes) and **one paper choice** for
  every subject (Paper 1, Paper 2, or both); a school-day study budget (30, 60, 90, or 120
  minutes), a day-off study budget (1, 1½, 2, 3, or 4 hours), revision days per week (three,
  five, or seven) and a session start time; then the start date and first exam date. The
  answers stay in place while paging, and the final page builds.
- **Topics** is the original route: every session opens a pathway topic. **Past papers only**
  makes every session a whole paper, and each paper counts as **60 minutes**, so a paper day
  holds one paper per hour of budget. **Mix of both** alternates paper and topic blocks,
  starting with a paper on the first day and a topic on the next so a short day still mixes
  the two across the plan. A paper or mixed plan needs at least 60 minutes on a school day
  and on a day off; the builder disables a 30-minute day for those routes.
- Paper sessions rotate through the course's saved papers in creation order. A course with
  no saved paper still gets a labelled "Past paper practice" slot, whose card opens the
  course page where one can be built.
- The server fills each school day up to the chosen budget with interleaved subject
  sessions. A subject that no longer has time for a whole session waits
  for the next revision day. A different subject starts each day so the same course does
  not always occupy the first slot.
- Sessions never run back to back. A break as long as the session before it is inserted
  before the next subject, so a 45-minute session is followed by 45 minutes off. Breaks sit
  outside the study budget: the student chose study time, not desk time. The day's last
  session has no trailing break.
- **Nothing is scheduled to end after 8:00 pm.** A session that would cross that line waits
  for the next revision day, and if the topics then will not fit before the exam the plan
  starts earlier. The builder disables start times too late for your session length, and the
  server rejects a plan whose sessions would run past the cutoff.
- Bank holidays, weekends and school-holiday weekdays use the **day-off budget the student
  chose** — nothing is multiplied or assumed. This lets a busy weekend stay short and a
  free half-term carry longer days.
- Three-day plans use Monday/Wednesday/Friday, five-day plans use weekdays, and seven-day
  plans use every day. The selected paper rotates between Paper 1 and Paper 2 when the
  student chooses to cover both.
- The planner recognises **England and Wales bank holidays** automatically, including
  substitute days for Christmas and New Year, and treats them as days off. Dates are
  calculated per year (Easter is derived, not hard-coded), so the plan stays correct across
  different exam seasons.
- Sessions run from the start date up to the day before the first exam, capped at 60
  revision days. If the topics do not all fit by then, the planner moves the start back a
  day at a time (up to twelve weeks, never before today) and builds again, so a complete
  plan can begin earlier than the date entered. The timetable reports when it did this.
- A plan is deterministic and does not call an AI model, so it builds instantly and cannot
  fail on a model rate limit.
- The saved plan is rendered as a real week table: days run across the top, start times
  run down the left, and each cell holds that day's session or a hatched **Free** block.
  One week is shown at a time with previous/next controls, and it opens on the week that
  holds the first scheduled session rather than an empty calendar week. Each subject has a colour,
  every session shows its start and end time, duration, paper and topic, and bank
  holidays and school breaks are labelled with the longer day they carry. The grid is
  fluid rather than fixed-width, so the whole week fits the screen (a narrower time
  gutter and compact session cards on phones) with no horizontal scrolling.
- Every entry is clickable. A topic entry calls the same topic-to-study-set mutation as the
  course page, reusing an existing set for that topic or creating one and opening it. A past
  paper entry opens its saved paper.
- Only one plan is stored per account. Building again replaces it, so the sidebar never
  shows a stale schedule beside a new one.

## How a past paper is built

- **Build a past paper** creates the paper row immediately, then schedules one Convex
  action. The course page and the paper page both subscribe to that row, so the paper
  appears as it finishes.
- The prompt contains the qualification (board, level, subject, tier or route), the stored
  specification as a list of units, topics and specification references, and a **subject
  blueprint** from `convex/lib/paperBlueprint.ts`: the exact number of questions, each
  question's printed label, marks and command word, and whether it is point-marked or
  levels-marked. RS repeats 3/4/5/12 once for each religion or Area of Study (AQA's parts
  are 1/1/4/6/12 from summer 2026); English Literature is two long essays and no short
  answers; maths gets calculations and no essays. The model writes the question stems,
  model answers and mark schemes to that structure; only the layout and question types are
  imitated, never a real question.
- The **cover is built on the server**, not by the model, from the board's own rubric in
  `convex/lib/paperFormat.ts`, so it is exact and identical every time the paper is rebuilt,
  and the total mark it prints is the total the stored questions actually carry.
- Questions are stored as a flat ordered list that carries its layout — the printed label
  (`1 (a)`), the section, the section's instruction line, the command word and the
  specification reference — so the paper page can render real section headings and the
  board's mark notation without storing a second structure.
- The reply is checked against the blueprint before anything is stored: the question
  count and every mark must match. If they do not, the paper is generated once more with a
  format correction; a second failure leaves a readable **Build again** message rather than
  a half-written paper.
- The paper stores the blueprint it was written to. When a subject's format changes, an
  existing paper is marked **Older format** in the course's past-paper list and on its own
  page, with one tap to rebuild it in the current structure.
- Questions are stored once the whole paper validates, along with the model answer and
  either a one-bullet-per-mark guide or level descriptors. A levels-marked essay is graded
  against those descriptors; a point-marked question is graded against its bullets, whole
  marks only, with no benefit of the doubt.
- The awarded mark and the examiner note are saved with the answer.
- A paper is **60 minutes** by definition, and that is what the timetable schedules. The
  questions are a representative paper rather than a reproduction of a board paper, which is
  why the cover is stamped **"Practice mock — not an official examination paper"** and every
  paper page says so.

## Project structure

```
src/
  pages/
    Landing.tsx          public landing page
    Auth.tsx             email-code sign-in and guest sign-in
    Dashboard.tsx        primary actions, course table, and saved study sets
    CourseSetup.tsx      level, board, tier, and multi-subject course picker
    Course.tsx           one course workspace: units, topics, progress, topic sets,
                         and saved practice papers
    PastPaper.tsx        one saved practice paper: its cover, build progress, and
                         AI-marked questions
    StudySet.tsx         set detail, compile progress, and the five study tabs
    TimetableBuilder.tsx subjects, session length, one paper answer, budgets, exam dates
    Timetable.tsx        colour-coded weekly plan with holidays and clickable sessions
  components/
    AppShell.tsx         sidebar / mobile navigation for signed-in pages
    CreateSetDialog.tsx  photo, video, and pasted-text upload flow
    Brand.tsx            Bluprint wordmark
    BlueprintMark.tsx    geometric mark and drafting-grid hero glyph
    study/               flashcard review, quiz runner, exam practice, practice papers,
                         tutor chat, set settings
  convex/
    schema.ts            users, courses, studySets, cards, quiz, exam, practice papers,
                         tutor, study days, plans
    courses.ts           pathway CRUD, topic progress, topic-to-set creation, schedulers
    pastPapers.ts        saved practice papers, build queue, progress and marked answers
    timetable.ts         deterministic revision-plan generation (topics, papers, mixed)
    studySets.ts         ownership-checked queries/mutations + internal compile writes
    tutor.ts             saved tutor threads and the context the action reads
    ai.ts                "use node" NVIDIA calls, key rotation, OCR, JSON validation, marking,
                         tutoring, study-set generation, and the course-outline pathway actions
    settings.ts          environment key-pool status for the UI
    lib/nvidiaConfig.ts  NVIDIA URL, model IDs, key parsing, notes limit
    lib/cognito.ts       reads a course's published topic outline
    lib/paperBlueprint.ts each subject's question types, marks and marking style
    lib/paperFormat.ts   each board's cover rubric, numbering, mark notation and format brief
  lib/
    media.ts             image compression and video frame sampling
    examBoards.ts        exam board and level choices, qualification labels
    subjects.ts          subject catalogue, icons, tints, tier and route options
```

## Assumptions made for version 1

- **Video means sampled frames, not audio.** Six frames are captured in the browser and
  only those JPEGs are uploaded. Lecture slides, whiteboards, and pages you pan over work
  best; talking-head audio is not transcribed. Photo uploads are the fallback.
- **Up to 8 photos per set**, compressed to a 1600px JPEG before upload. There is no PDF
  input, which keeps the browser upload path dependable.
- **Length is a request, not a guarantee.** Quiz and exam sliders set a target; if the
  model produces fewer usable items after retries, the set still compiles with what it
  could validate so a long request does not fail completely. Twenty cards are the default
  for uploads, and each batch is told to avoid repeating earlier fronts.
- **Different boards per subject are supported.** Courses store their own board, so one
  timetable can mix AQA, Edexcel, OCR, and Cambridge. The level is shared across a setup
  batch; add another batch for a different qualification.
- **There is one active revision timetable per account.** Rebuilding replaces the previous
  plan. It fills up to 60 revision days with as many subject sessions as the daily budget
  allows, and cycles back through topics if there are more revision days than topics. If
  there are more topics than sessions, the page states how many are covered so the plan is
  not mistaken for a complete pass.
- **Timetable holidays cover England and Wales.** Scotland and Northern Ireland have
  different bank holiday dates; supporting those would need a region choice, which version 1
  leaves out to keep the setup short.
- **School-break dates are typical England term dates, not an official local-authority
  calendar.** The planner uses the common Monday-to-Friday windows for autumn, Christmas,
  February, Easter, May, and summer breaks. Local authorities can differ by a week; the
  table labels the break it used, and rebuilding after checking your school calendar is the
  simplest adjustment. Weekends, bank holidays and these break weekdays all use the
  day-off budget the student chose in the builder; nothing is multiplied or assumed.
- **Breaks count as time, not study time.** The budget the student picks is study time.
  Between two subjects Bluprint inserts a break as long as the session before it, so a
  45-minute session is followed by 45 minutes off before the next one. The timetable's
  clock includes those gaps; the day's study total does not. This is the simplest reading
  of "a break as long as the study before it", and it means a longer session buys a longer
  break rather than a shorter one.
- **One session length for the whole plan.** Sessions are the same length for every
  subject, because a study block is a habit rather than a per-subject setting. **One paper
  answer covers the whole timetable** instead of a paper per subject, since friends revise
  the same paper across their subjects. A session that does not fit the day's remaining
  budget or would cross 8:00 pm moves to the next revision day.
- **The study method is also one choice for the whole plan.** Topics, past papers only, or
  a mix of both is chosen once in the builder, like the session length. A past paper is a
  fixed 60-minute block, so a paper or mixed plan needs at least an hour of daily budget on
  school days and days off; the builder disables the 30-minute option for those routes.
  Leftover
  minutes in a mixed day go to a short topic block rather than staying free.
- **Paper choices label sessions, not separate sets.** A session marked Paper 1 or Paper 2
  opens the topic's study set; the set still covers the whole specification topic. Choosing
  "both" alternates the paper label between sessions so the plan covers both papers over
  time.
- **Timetable dates are UTC calendar keys.** They are stored as `YYYY-MM-DD` and rendered
  with a UTC weekday label, so a plan built in one timezone still shows the same dates for
  friends elsewhere.
- **Accounts use email codes, not passwords.** Guest sign-in exists for quick demos, but
  guest sets only survive that browser session. Use email to keep sets recoverable.
- **Sets are private.** There is no sharing or group folder in version 1; friends have
  separate accounts and separate libraries.
- **One shared key pool** per deployment, configured only through `NVIDIA_API_KEY`. There
  is no in-app key entry, so friends cannot add or change keys from the browser.
- **Web answers come from a second provider on purpose.** No NVIDIA-hosted model can
  search the internet, so the tutor's optional web switch uses OpenRouter's web plugin and
  saves the pages it cited. Turn the switch off to keep an answer entirely on NVIDIA.
- **English prompts and defaults**, with at most 60,000 characters of pasted notes stored
  (12,000 characters sent to the model per generation call).


## Troubleshooting

- **"NVIDIA_API_KEY is not set"** — add it to the Convex deployment environment.
- **401 / 403** — every key in the pool was rejected. Replace `NVIDIA_API_KEY` on the
  deployment.
- **429** — the whole pool is cooling down. Wait about a minute, then retry the set.
- **404 / 410 model not available** — NVIDIA retired that model. Set
  `NVIDIA_TEXT_MODEL` / `NVIDIA_VISION_MODEL` to a model currently listed on NVIDIA Build.
- **A pathway is generic** — there is no published page for that qualification yet, so the
  starter map is used. Rebuild the pathway later to pick up the published outline. Your
  board's own specification is always the source of truth.
- **Poor OCR** — use straighter, brighter photos; dark handwriting or blurry frames are
  the usual cause. Pasted text is the most reliable input.
- **Tutor answers have no web sources** — either the Web switch is off, or the question was
  a live one (an exam date, a timetable) that the keyless sources deliberately skip and no
  search provider key is set. Add `TAVILY_API_KEY` (free) and it will be searched properly;
  the answer itself is still valid, it just did not have sources.
- **Keyless search got slower or stopped** — Wikimedia rate limits unnamed clients per IP.
  Set `WIKIMEDIA_CONTACT` to your email, and add a search provider key so questions keep
  working when Wikipedia is parked.
- **Tutor reply stops mid-sentence** — the stream was cut off by a timeout. Ask again; the
  half-written reply is removed automatically before the next question.
- **A session is missing from the timetable** — it would have run past 8:00 pm, so it moved
  to the next revision day. Start earlier or shorten that subject's session to fit more in.
