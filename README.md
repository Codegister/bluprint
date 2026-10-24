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
- **Cognito (`cognito.org`, scraped)** — the published topic outline for each course. The
  pathway builder follows Cognito's qualification → subject → exam board → tier route, so
  the map matches the board's own specification headings exactly. No AI is used to build a
  pathway.
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
selects it and loads its settings into a panel beside the list (below it on a phone): exam
board, tier or route, and a shortcut to apply that board to every course already chosen.
Nothing expands inline, so a whole timetable of subjects can be scanned at a glance, and a
school that uses AQA for Biology and Edexcel for Maths is still handled in one pass (up to
12 courses). GCSE courses also show an explicit **Higher tier** / **Foundation tier**
choice, with Higher preselected. KS3 stores no board or tier and is scraped from Cognito's
KS3 subject pages. Combined Science is its own subject, so there is no separate
Triple/Combined toggle; IB adds HL/SL. Poetry is
not chosen in the picker: every anthology cluster the board publishes arrives as its own
unit, and the ones your school does not teach are removed from the pathway.

Bluprint queues each course immediately and maps the current specification server-side. It
starts from the published outline on [Cognito](https://cognito.org) for that exact level,
subject and board, so every paper, topic and subtopic in the specification reaches the map,
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

The mapping is deterministic: Cognito's published outline is scraped, then each topic's
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
8. **Edit and rebuild** — **Set settings** next to a set's title changes its name, course,
   board, or level, and its three build sliders (1–100 flashcards, quiz questions and
   exam-style questions). "Save and rebuild" regenerates the summary, cards, quiz, and exam
   questions with those counts and the new board conventions; your notes and uploads are
   kept.
9. **Persist** — study sets, extracted notes, uploads, card progress, due dates, quiz
   scores, and tutor conversations stay saved between sessions, scoped to the account that
   created them.
10. **Plan your revision** — **Build revision timetable** asks which subjects to revise, how
    long each study session should be, which paper to cover, how long a school day and a day off
    should be, how many days a week you can work, and when your first exam is. Sessions are
    separated by breaks as long as the session before them, nothing runs past 8:00 pm, and
    if the topics will not fit the date you chose, the plan starts earlier rather than
    dropping topics. The schedule is
    saved to your account and appears in the sidebar as a colour-coded weekly timetable;
    clicking a session opens (or builds) the study set for that topic.

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

- **Course pathways are scraped from Cognito, not written by a model.** The builder reads
  the published page for the exact qualification, subject, board and tier — including the
  specification page when the notes page is not server-rendered. If Cognito has no page for
  a course, Bluprint stores a small starter map instead of inventing topics. Always check
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

Pathways are scraped from Cognito's published pages, so they build with no AI key at all.
`NVIDIA_API_KEY` is used only to build study sets, mark exam answers and answer tutor
questions.

### Optional model overrides

NVIDIA retires models periodically. Defaults chosen from currently available hosted
endpoints:

| Purpose | Environment variable | Default |
| --- | --- | --- |
| Summaries, cards, quizzes, exams | `NVIDIA_TEXT_MODEL` | `nvidia/nemotron-3.5-lightning-30b-a3b` |
| Reading photos / video frames | `NVIDIA_VISION_MODEL` | `meta/llama-3.2-90b-vision-instruct` |
| Tutor answers with web access | `OPENROUTER_TUTOR_MODEL` | `meta-llama/llama-3.3-70b-instruct` |

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
  schedules one Convex action per course, 1.5 seconds apart. The browser is not held open.
- The builder walks Cognito's own route: qualification, subject, exam board, then tier. It
  fetches `/courses/<level>/<subject>/<board>/<tier>/notes`, lets Cognito redirect to its
  dated route (Biology → biology-triple) and reads the paper, module, topic and subtopic
  headings from the page. IB uses its `ibhl` / `ibsl` route instead of a board segment.
- Combined Science is the exception Cognito splits before the exam board: Biology,
  Chemistry and Physics are separate component routes. The scraper reads all three and
  merges them into one pathway with a unit per science, so a Combined Science course covers
  the whole qualification.
- If that notes page is a client-rendered shell, the specification page at
  `/specifications/<level>/<subject>/<board>` supplies the numbered topic list instead.
- The pathway is a direct mapping of those headings: summaries, key points and exam skills
  are assembled from the scraped subtopics. Nothing is invented, so the map covers the
  entire published specification and no unit needs a model call.
- If Cognito has no page for a course, the deterministic starter map keeps it usable, and
  a rebuild replaces it once Cognito publishes the course. Students are never asked to
  retry.
- **Study this topic** writes the topic's summary and key points into a study set and opens
  it. The existing compile pipeline takes over, so the topic set has the same summary,
  cards, quiz, exam marking, scheduling, and tutor as an uploaded set.
- Marking topics complete is manual. A topic's linked study set, card counts, and course
  scores are derived from the set, not duplicated.

## How a revision timetable is built

- The builder is four separate pages, each with its own URL and a **Next** button:
  subjects; **one session length for the whole timetable** (25, 45, 60, or 90 minutes) with
  a paper choice (Paper 1, Paper 2, or both) for each subject; a school-day study budget
  (30, 60, 90, or 120 minutes), a day-off study budget (1, 1½, 2, 3, or 4 hours), revision
  days per week (three, five, or seven) and a session start time; then the start date and
  first exam date. The four answers stay in place while paging, and the final page builds.
- The server fills each school day up to the chosen budget with interleaved subject
  sessions of that one length. A subject that no longer has time for a whole session waits
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
    CourseSetup.tsx      level, board, tier, and multi-subject course picker
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
    ai.ts                "use node" NVIDIA calls, key rotation, OCR, JSON validation, marking,
                         tutoring, study-set generation, and the Cognito pathway actions
    settings.ts          environment key-pool status for the UI
    lib/nvidiaConfig.ts  NVIDIA URL, model IDs, key parsing, notes limit
    lib/cognito.ts       scrapes the published outline for a course from cognito.org
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
  subject, because a study block is a habit rather than a per-subject setting. The paper
  label still varies by subject. A session that does not fit the day's remaining budget or
  would cross 8:00 pm moves to the next revision day.
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
- **A pathway is generic** — Cognito has no published page for that qualification yet, so
  the starter map is used. Rebuild the pathway later to pick up the published outline. The
  course page always links the current specification as the source of truth.
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
