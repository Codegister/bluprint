# Bluprint

Bluprint is a private revision workspace with two ways in. Choose your courses once and it
maps each specification into units and topics, then builds study material for any topic — or
upload photos of your notes, sample a video, or paste text and compile a study set directly.
Every set gets a summary, flashcards, a multiple-choice quiz, and exam-style questions with
AI marking, plus an AI tutor that knows the material. Courses can also be turned into a
colour-coded weekly revision timetable, with every session linked to a topic study set.

Version 1 is built for a small group of friends. Each person signs in separately and gets
their own dashboard containing only their courses and study sets.

## Stack

- **Vite + React 19 + TypeScript** — the frontend
- **Tailwind CSS v4 + shadcn/ui** — the interface
- **Convex** — database, file storage, server actions, and authentication
- **Convex Auth (email one-time code)** — separate accounts without password management
- **NVIDIA API** — study-set generation, vision, marking, and tutoring, through the
  OpenAI-compatible endpoint at `integrate.api.nvidia.com`
- **Cognito (`cognito.org`)** — the published topic outline for each course, read at build
  time so pathway maps follow the board's own specification headings
- **OpenRouter** — fills in pathway detail with a larger free model, and writes the outline
  for courses Cognito does not publish, falling back to NVIDIA when `OPENROUTER_API_KEY`
  is absent
- **Bun** — package manager and scripts

There is no separate server to deploy. Convex hosts the backend, file storage, and AI
actions.

The visual direction is a light, friendly study workspace: a white sidebar with the deck
list, soft rounded cards on a pale grey canvas, a violet accent with pastel icon tints, and
Poppins headings. The little violet axolotl is drawn in SVG, so the app needs no image
assets.

## Two ways to start

### 1. Choose your courses (course pathway)

Open **Choose courses** from the dashboard, pick your level and a default exam board, then
select every subject you are taking in one pass (up to 12). Selecting a subject expands its
board and tier controls directly beneath it, so a school that uses AQA for Biology and
Edexcel for Maths is handled without a second setup. GCSE courses also show an explicit
**Higher tier** / **Foundation tier** choice, with Higher preselected. Combined Science is
its own subject, so there is no separate Triple/Combined toggle; IB adds HL/SL. GCSE English
Language and English Literature also offer a poetry theme choice: **Power and Conflict** or
**Love and Relationships**.

Bluprint queues each course immediately and maps the current specification server-side. It
starts from the published outline on [Cognito](https://cognito.org) for that exact level,
subject and board, so every paper, topic and subtopic in the specification reaches the map,
then writes a summary, key points and an exam skill for each topic.

Each course gets its own workspace on the dashboard, with topic-level progress. Open any
topic and **Study this topic** creates a normal study set from that topic's summary, key
points, and exam skill — a long summary, 20 detail-heavy cards, a ten-question quiz, and
four exam questions — linked back to the course. Ticking topics off tracks course progress;
the next unrevised topic is always offered at the top of the course page.

The mapping happens in two passes: an outline, then detail for one unit at a time. Free
models are busy occasionally, so the app tries the models in order, then NVIDIA, and fills
any topic a model skips from the outline itself. A course never lands in a "needs a retry"
state.

### 2. Upload your own material

Use **Upload material** to add up to eight photos, a short video, or pasted notes. This keeps
the upload compile flow and is the right path for a single handout, a textbook page, or
notes that do not follow a specification. Two sliders choose the length: 5–20 quiz
questions and 2–10 exam-style questions. Every set includes 20 flashcards written to target
niche, exam-distinguishing detail rather than broad topic headings.

## What version 1 does

1. **Add source material** — up to eight photos (JPG or PNG), a video (six frames are
   sampled in the browser), or pasted text.
2. **Compile** — NVIDIA reads the source, then generates a structured summary, 20
   detail-heavy flashcards, 5–20 quiz questions with explanations, and 2–10 written exam
   questions with marking guides. Long sets are generated in batches so a single JSON
   response cannot truncate the middle of the deck.
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
7. **Ask the tutor** — every set has an AI tutor tab. It answers using that set's notes,
   knows the course, board, and level, and keeps the conversation saved so you can come
   back to it. Suggested first questions get you started; exam practice is one question at
   a time.
8. **Edit and rebuild** — **Set settings** next to a set's title changes its name, course,
   board, or level. "Save and rebuild" regenerates the summary, cards, quiz, and exam
   questions so the new board conventions apply; your notes and uploads are kept.
9. **Persist** — study sets, extracted notes, uploads, card progress, due dates, quiz
   scores, and tutor conversations stay saved between sessions, scoped to the account that
   created them.
10. **Plan your revision** — **Build revision timetable** asks which subjects to revise, how
    long to spend on each one, which paper to cover, how long each revision day should be,
    how many days a week you can work, and when your first exam is. The schedule is saved to
    your account and appears in the sidebar as a colour-coded weekly timetable; clicking a
    session opens (or builds) the study set for that topic.

After signing in, the main screen is the **Home** dashboard. It keeps one primary action,
**New study set**, for uploading notes, a **Build revision timetable** action for planning
course topics, and one course action, **Add courses**, for building AI revision pathways.
Below those sit a course table with topic progress and material counts, and a saved-sets
table with status, due counts, card mastery and last quiz score. The sidebar also links to
the saved **Revision timetable**. Opening a set gives you five tabs — Summary, Flashcards,
Quiz, Exam, and Tutor — plus a **Set settings** button for renaming, rebuilding, or deleting
it. Sets built from a course topic link back to that course.

## Assumptions

- **Course pathways are AI-built, not licensed specification documents.** The model is
  asked for the current specification for the chosen board and level, and it leaves a
  reference blank when unsure. Always check the official specification; the course page
  says this too. Topic material is generated lazily (one tap per topic) rather than
  pre-building every deck in every course, which keeps a nine-course setup affordable on
  free tiers.
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
- **The tutor is set-scoped.** It reads the current set's notes (up to 12,000 characters)
  and the last ten saved turns, has no web access, and is not a general-purpose chatbot.
  That keeps answers aligned with your material and keeps token cost predictable.
- **Tutor history is saved in the database**, one thread per set and account. There is no
  clear-thread button yet; deleting the set deletes its conversation with it.

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

### OpenRouter key for course pathways

Course pathways use a larger model from OpenRouter's free catalogue. The key is named
**`OPENROUTER_API_KEY`** everywhere in the code, comments, and configuration. It is read
only in the Convex server action and is never logged or returned to the browser.

```bash
npx convex env set OPENROUTER_API_KEY "sk-or-v1-..."
```

On Freebuff, add `OPENROUTER_API_KEY` in the project's **Keys** tab. If the variable is
missing, pathways fall back to `NVIDIA_API_KEY`; the course page still works, but the map is
less detailed. Set `OPENROUTER_MODEL` to try a specific model first; Bluprint still keeps a
few free fallbacks so one bad response cannot fail the build. Without an override, the
action reads OpenRouter's live catalogue and picks models whose prompt and completion prices
are both zero. It prefers `nvidia/nemotron-3-ultra-550b-a55b:free`, then other free Nemotron
and Gemma models, so a retired model does not break the app.

OpenRouter's free tier is rate-limited. The action tries up to four free models with short
backoffs and validates each response before moving on, then falls back to NVIDIA. It returns
a clear message if all of them are busy. Queued courses are staggered ten seconds apart so a
nine-course setup does not fire nine requests at once.

### Optional model overrides

NVIDIA retires models periodically. Defaults chosen from currently available hosted
endpoints:

| Purpose | Environment variable | Default |
| --- | --- | --- |
| Summaries, cards, quizzes, exams | `NVIDIA_TEXT_MODEL` | `nvidia/nemotron-3.5-lightning-30b-a3b` |
| Reading photos / video frames | `NVIDIA_VISION_MODEL` | `meta/llama-3.2-90b-vision-instruct` |
| Course pathways | `OPENROUTER_MODEL` | live free-model discovery (prefers `nvidia/nemotron-3-ultra-550b-a55b:free`) |
| Course pathways when OpenRouter is absent | `NVIDIA_TEXT_MODEL` | same NVIDIA text model as above |

Set overrides on the Convex deployment the same way as `NVIDIA_API_KEY`. If a model is
retired, the set shows a clear "model not available" message and the environment variable
is the fix.

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
  schedules one Convex action per course, ten seconds apart. The browser is not held open.
- The action reads the course outline from Cognito's published page for that level, subject
  and exam board. Those pages carry the board's own paper, module, topic and subtopic
  headings, which is what keeps a topic from being dropped.
- When Cognito has no page for the course (its coverage is still growing), a free OpenRouter
  model writes the outline as a bare index — titles and subtopics only — with NVIDIA as the
  fallback. The outline stays small enough to finish in one answer.
- Each unit is then filled in by its own call: a one-sentence unit summary, plus a summary,
  2–6 key points and an exam skill for every topic. Three units run at a time. Every subtopic
  in the outline has to be named in a key point, and a topic a model skips is written from
  its outline entry, so the finished map covers the whole specification.
- A build that cannot reach any model still stores a complete outline, and a rebuild keeps
  the previous map until the new one is ready. Students are never asked to retry.
- **Study this topic** writes the topic's summary and key points into a study set and opens
  it. The existing compile pipeline takes over, so the topic set has the same summary,
  cards, quiz, exam marking, scheduling, and tutor as an uploaded set.
- Marking topics complete is manual. A topic's linked study set, card counts, and course
  scores are derived from the set, not duplicated.

## How a revision timetable is built

- The builder asks for subjects, a session length for each subject (25, 45, 60, or 90
  minutes), a paper for each subject (Paper 1, Paper 2, or both), one daily revision budget
  (30, 60, 90, or 120 minutes), revision days per week (three, five, or seven), a session
  start time, a start date, and the first exam date.
- The server fills each school day up to the chosen budget with interleaved subject
  sessions, respecting each subject's own length. A short subject can share a day with a
  long one; a subject that no longer fits waits for the next revision day. A different
  subject starts each day so the same course does not always occupy the first slot.
- Bank holidays, weekends and school-holiday weekdays get **double the school-day
  budget**, with a floor that guarantees at least one extra whole session, so a seven-day
  plan naturally puts more work into Saturday, Sunday, half-term and bank holidays. A
  school day keeps the budget chosen in the builder.
- Three-day plans use Monday/Wednesday/Friday, five-day plans use weekdays, and seven-day
  plans use every day. The selected paper rotates between Paper 1 and Paper 2 when the
  student chooses to cover both.
- The planner recognises **England and Wales bank holidays** automatically, including
  substitute days for Christmas and New Year, and treats them as days off. Dates are
  calculated per year (Easter is derived, not hard-coded), so the plan stays correct across
  different exam seasons.
- Sessions run from the start date up to the day before the first exam, capped at 60
  revision days. A plan is deterministic and does not call an AI model, so it builds
  instantly and cannot fail on a model rate limit.
- The saved plan is rendered as a real week table: days run across the top, start times
  run down the left, and each cell holds that day's session or a hatched **Free** block.
  One week is shown at a time with previous/next controls. Each subject has a colour,
  every session shows its start and end time, duration, paper and topic, and bank
  holidays and school breaks are labelled with the longer day they carry.
- Every entry is clickable. It calls the same topic-to-study-set mutation as the course
  page, reusing an existing set for that topic or creating one and opening it.
- Only one plan is stored per account. Building again replaces it, so the sidebar never
  shows a stale schedule beside a new one.

## Project structure

```
src/
  pages/
    Landing.tsx          public landing page
    Auth.tsx             email-code sign-in and guest sign-in
    Dashboard.tsx        primary actions, course table, and saved study sets
    CourseSetup.tsx      level, board, poetry theme, and multi-subject course picker
    Course.tsx           one course workspace: units, topics, progress, topic sets
    StudySet.tsx         set detail, compile progress, and the five study tabs
    TimetableBuilder.tsx subjects, per-subject time and paper, daily budget, and exam dates
    Timetable.tsx        colour-coded weekly plan with holidays and clickable sessions
  components/
    AppShell.tsx         sidebar / mobile navigation for signed-in pages
    CreateSetDialog.tsx  photo, video, and pasted-text upload flow
    Brand.tsx            Bluprint wordmark
    BlueprintMark.tsx    geometric mark and drafting-grid hero glyph
    study/               flashcard review, quiz runner, exam practice, tutor chat,
                         set settings
  convex/
    schema.ts            users, courses, studySets, cards, quiz, exam, tutor, study days, plans
    courses.ts           pathway CRUD, topic progress, topic-to-set creation, schedulers
    timetable.ts         deterministic revision-plan generation and saved-plan queries
    studySets.ts         ownership-checked queries/mutations + internal compile writes
    tutor.ts             saved tutor threads and the context the action reads
    ai.ts                "use node" NVIDIA + OpenRouter calls, key rotation, OCR, JSON validation,
                         marking, tutoring, and pathway generation
    settings.ts          environment key-pool and pathway-model status for the UI
    lib/nvidiaConfig.ts  NVIDIA URL, model IDs, key parsing, notes limit
    lib/openrouterConfig.ts  OpenRouter URL, key parsing, free-model preferences
    lib/cognito.ts       reads the published topic outline for a course from cognito.org
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
  simplest adjustment. Weekends, bank holidays and these break weekdays all receive the
  same doubled capacity (2x, plus at least one whole extra session).
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
- **English prompts and defaults**, with at most 60,000 characters of pasted notes stored
  (12,000 characters sent to the model per generation call).


## Troubleshooting

- **"NVIDIA_API_KEY is not set"** — add it to the Convex deployment environment.
- **401 / 403** — every key in the pool was rejected. Replace `NVIDIA_API_KEY` on the
  deployment.
- **429** — the whole pool is cooling down. Wait about a minute, then retry the set.
- **404 / 410 model not available** — NVIDIA retired that model. Set
  `NVIDIA_TEXT_MODEL` / `NVIDIA_VISION_MODEL` to a model currently listed on NVIDIA Build.
- **"OPENROUTER_API_KEY is not set"** — add it to the Convex deployment environment, or
  set `NVIDIA_API_KEY` and retry; pathways fall back to NVIDIA.
- **"OpenRouter's free models are rate-limited"** — free capacity is shared. Wait a minute
  and hit **Retry pathway**; builds are already staggered to reduce this.
- **A pathway is missing a topic** — Cognito publishes an outline for most GCSE, A-Level
  and IB courses, and Bluprint falls back to a model-written outline for the rest. Rebuild
  the pathway, or set `OPENROUTER_MODEL` to a stronger free model; the course page always
  links the current specification as the source of truth.
- **Poor OCR** — use straighter, brighter photos; dark handwriting or blurry frames are
  the usual cause. Pasted text is the most reliable input.
