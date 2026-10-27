# Bluprint

Bluprint is a private revision workspace with two ways in. Choose your courses once and it
maps each specification into units and topics, then builds study material for any topic — or
upload photos of your notes, sample a video, paste text, or build from a mapped course topic
and compile a study set directly.
Every set gets a summary, flashcards, a multiple-choice quiz, and exam-style questions with
AI marking, plus an AI tutor that knows the material. Each course also keeps up to four
**saved practice papers**, written from the specification in that subject's real question
format — RS 3/4/5/12-mark parts, a single English Literature essay, maths calculations, and
so on — and marked question by question. Courses can be turned into a colour-coded weekly
revision timetable built from topics, from past papers only, or from a mix of the two.

Bluprint is small and independent, and built for real revision. Each person signs in
separately and gets their own tutor home containing only their courses and study sets.

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

The visual direction is **chrome metal in light and dark, high contrast**. In light mode
the page is a brushed steel sheet (`--chrome-1`), cards are bright white with a hard 1px
edge and a crisp 2px offset shadow, and body copy is graphite ink (`--chrome-8`). In dark
mode the same system is read as gunmetal: near-black steel page, raised graphite cards,
off-white type and a lit top edge on every plate. Nothing is left translucent enough to
blur into what is behind it. The only colour is a chrome-blue action accent
(`--brand-pink`, `--brand-pink-deep`) plus five anodised metal tints used for subject
tags and active navigation. Headings are Space Grotesk and body copy is Inter. The
backdrop is a fine engineering grid under three broad specular ribbons that travel across
the screen at different speeds, with soft white and steel-blue reflections behind them.
The landing hero and every signed-in screen carry an **ink-in-water** canvas: pigment
plumes are pulled around a travelling vortex and carried by a curl field, so the ink
visibly crosses the glass rather than sitting still. It is rendered from pre-built sprites
so the effect stays on the compositor budget, and the app-wide layer sits above the chrome
backdrop but below all content. Both motion layers pause when off-screen or when the tab
is hidden, and fall back to a still frame under `prefers-reduced-motion`. The little mascot
is drawn in SVG, so the app still needs no image assets.

**Motion rules.** Every animation follows three rules, shared by the Framer helpers and
the CSS tokens (`--ease-entrance`, `--ease-exit`, `--ease-ui`): entrances start fast and
settle slowly, exits hold a beat and then accelerate away, and interface moves overshoot
their target slightly before settling. Overlay openings, nav pills, hover lifts and the
staggered card rises all draw from that same vocabulary.

**Light / dark switch.** The first visit follows the operating system. The switch in the
sidebar, mobile header, landing header and sign-in screen stores the choice in
`localStorage` under `bluprint.theme`; an inline script in `index.html` applies it before
React mounts so there is no light flash. Both modes use the same token names, so screens
do not need `dark:` variants. `ThemeProvider` owns the state and the toaster and WebGPU
shader follow it.

The metal shades live in `src/index.css` as `--chrome-0` to `--chrome-8` and are exposed
to Tailwind as `bg-chrome-*`, `text-chrome-*`, and `border-chrome-*`:

| Token | Value | Role |
| --- | --- | --- |
| `--chrome-0` | `#ffffff` | polished highlight |
| `--chrome-1` | `#eef2f6` | page base |
| `--chrome-2` | `#e0e6ed` | raised panel |
| `--chrome-3` | `#c8d1db` | soft rule |
| `--chrome-4` | `#a3b0be` | strong rule |
| `--chrome-5` | `#6f7d8c` | quiet icons |
| `--chrome-6` | `#4b5866` | secondary copy |
| `--chrome-7` | `#2c3641` | strong secondary copy |
| `--chrome-8` | `#0a0f15` | graphite ink / primary |

The `.dark` block re-points the same ramp for gunmetal (0 is the raised highlight, 8 is
off-white ink) instead of introducing a second set of class names.

`--border` is `#7e8c9b` and `--input` is `#5c6a7a`, deliberately dark enough that a card
or a field can be seen against the steel page. The old Gizmo accent class names are kept
so existing screens did not need rewriting, but their values are now anodised metal tints
(ice, pearl, steel blue, bronze, verdigris) exposed as `bg-gizmo-lime`, `bg-gizmo-lilac`,
`bg-gizmo-sky`, `bg-gizmo-peach`, `bg-gizmo-mint` and `bg-gizmo-cream`. Semantic red,
green and amber are kept only for errors, correct answers and warnings.

The stylesheet also lifts hand-written opacity steps such as `text-brand-ink/55` to fixed
accessible greys and gives pale literal tints (`bg-[#FFF6E5]`, `bg-[#E9FBF3]`) a hairline,
so older screens cannot fade into grey or melt into the white card behind them.

## Two ways to start

### 1. Choose your courses (course pathway)

Open **Choose courses** from the course library and choose your qualification first — GCSE, KS3,
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

Each course gets its own workspace in the course library, with topic-level progress. Open any
topic and **Study this topic** asks how many sections of the pathway the set should cover
(one topic, or a run of up to twelve), then creates a normal study set from those topics'
summaries, key points, and exam skills — a long summary, 20 detail-heavy cards, a
ten-question quiz, and four exam questions — linked back to the course. Ticking topics off
tracks course progress; the next unrevised topic is always offered at the top of the course
page.

Every unit and topic has its own **remove** control. Removing something edits only the
pathway: study sets already built from it stay in the library, and a rebuild brings the
full published outline back. That is how a student keeps one poetry cluster, drops an
optional unit, or skips a paper their school does not enter them for.

The mapping is deterministic: the published outline is read from source, then each topic's
summary and key points are assembled from its own subtopics. No model is consulted, so a
slow or rate-limited AI provider can never leave a course half-mapped or invent a topic. A
course never lands in a "needs a retry" state.

### 2. Build a set, from a course or your own material

**Add material** opens four sources on one dialog. **Course** builds from a topic you have
already mapped, defaulting to the next unfinished topic and using that topic's specification
notes, so the set is grounded without another upload; building the same topic twice opens
the set you already have instead of duplicating it. When courses are ready this is the tab
the dialog opens on. **Photos** takes up to eight pages, **Video** samples six frames in the
browser, and **Paste** takes up to 20,000 characters of notes — the right path for a single
handout or material that does not follow a specification. For those three, the dialog asks
for the material and how much to build: three sliders choose flashcards, quiz questions and
exam-style questions separately, each from 1 to 100. A course set takes its size from the
pathway instead. Uploaded sets are named after the source file or the first line of the
notes, and any set can be renamed afterwards. If notes cannot realistically support the
number asked for, Bluprint builds the maximum it can and says so on the set page; it never
silently pretends the request was met.

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
3. **Study** — recall cards by **speaking the answer** (the browser's own dictation
   engine turns speech into text; typing works too), which is marked on meaning rather
   than wording before you rate it: the model is asked whether the answer carries the
   same fact, so a paraphrase, a synonym or a number said as a word ("six" for "6")
   is credited. An answer that matches word for word is marked instantly without a
   call, and if the meaning check cannot be reached the answer is marked on words with
   a note saying so. Dictation survives an engine dropping out mid-answer and says so
   when the microphone cannot start. A **Self-mark** switch skips the comparison for
   when speaking is not possible. The quiz mixes multiple choice, cloze (fill the gap)
   and short typed answers, all marked on key words with explanations, the same number
   and accent folding included. Exam questions are marked against the guide with
   feedback and a model answer.
4. **Tag the exam context afterwards** — a set opens with its settings button, where it can
   be renamed and tagged with a course, an exam board (AQA, Pearson Edexcel, OCR, WJEC /
   Eduqas, Cambridge International, IB, SQA, College Board AP), and a level (GCSE, A-Level,
   IB, AP, Undergraduate). Board and level steer the summary's exam focus, the phrasing of
   exam questions, and how written answers are marked. Course, board, and level are
   filterable and searchable on the tutor home. Tagging is not part of the upload because a
   student pasting notes usually wants the set, not a form.
5. **Review on a full FSRS schedule** — every card carries an FSRS memory state
   (stability and difficulty). Each review is rated **Again / Hard / Good / Easy**; a
   missed card returns in ten minutes, a recalled one is scheduled from its predicted
   recall at the moment you answered. The review queue is ordered by due date, so today's
   work is what the scheduler asks for rather than a fixed deck order. Each set shows how
   many cards are due.
6. **Keep a habit** — the streak is **tiered by question count**: a day keeps the streak
   once it reaches the **Starter** tier (10 questions), with **Builder** (25) and **Deep**
   (50) as higher badges for that day. Card reviews and quiz answers both count. The daily
   goal is **derived from your nearest exam date**: Bluprint divides the material still to
   cover by the days left (clamped to 10–80 questions), so it tightens as a real paper
   approaches. Without an exam date it falls back to 20.
7. **Home is the tutor** — signing in opens the full tutor panel, not a link to one:
   model tiers, the effort bar, dictation, **Web** search and streamed answers all work
   inline. An **About** chip in the panel header defaults to the most recent set, so the
   first question works without a second chooser. Below the panel are **Continue** (the
   last set and the most due), the searchable **study sets** library, and compact
   **Courses** rows with a *Practise* link per course. The header keeps the day's streak
   and due count in one line. The full **Today** screen holds the due queue, one session
   button with a length control, and the sets that need work. A session takes the most
   useful cards first: everything overdue, then the shakiest memories.
8. **Mastery is exam readiness** — the percentage on each set is no longer "cards known".
   It weighs **card recall** (from FSRS) at 60%, **last quiz accuracy** at 25% and **written
   exam marks** at 15%, dropping any part the set does not have. It also projects readiness
   forward to exam day, so a high score with a distant exam date reads honestly. On a set,
   the four headline numbers sit in one strip and the full breakdown is one expansion away.
9. **Pace the exam** — add an exam date in **Edit set** and the set gets a per-day pace
   plan: days left, cards per day, quiz questions per week, an on-track / tight / behind
   status, and projected readiness on the day. The daily goal uses the nearest exam across
   all ready sets.
10. **Needs work** — a dedicated session per set collects cards that were rated Again, have
   lapsed, or never reached a stable memory, plus the quiz questions you keep missing. It
   starts with the worst material rather than replaying the whole deck.
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
   The **level picker** under the prompt chooses how much work the tutor does: **Fast**
   (a quick, short answer), **Balanced** (the default everyday answer) and **Deep** (the
   longest answer budget and a worked explanation, for a full derivation or a marked essay
   plan). Levels are named by feel rather than by model — each one maps to a different
   NVIDIA model on the server, so the browser never sees a model id.
11. **Edit and rebuild** — **Edit set** in the set's `⋯` menu changes its name, course,
   board, level, or exam date, and its three build sliders (1–100 flashcards, quiz questions
   and exam-style questions). "Save and rebuild" regenerates the summary, cards, quiz, and
   exam questions with those counts and the new board conventions; your notes and uploads
   are kept. The exam date saves without a rebuild.
12. **Persist** — study sets, extracted notes, uploads, FSRS card state, daily counts, quiz
   scores, and tutor conversations stay saved between sessions, scoped to the account that
   created them.
13. **Plan your revision** — **Build revision timetable** asks which subjects to revise,
    which **study method** the plan uses (topics, past papers only, or a mix of both), the
    **longest** a topic session can be, one paper choice for the whole plan, how long a
    school day and a day off should be, how many days a week you can work, and when your
    first exam is. Sessions are spread across the day with 10-minute breaks and lunch and
    dinner kept free, nothing runs past 8:00 pm, and if the topics will not fit the date you
    chose, the plan starts earlier rather than dropping topics.
    The schedule is saved to your account and appears in the sidebar as a colour-coded weekly
    timetable; clicking a topic session opens (or builds) its study set, and clicking a past
    paper session opens the saved paper.
14. **Practise a paper** — every ready course keeps up to four saved practice papers,
    written from its specification in that subject's real question format (RS 3/4/5/12,
    English essays, maths calculations, and so on) and marked question by question against
    their own mark schemes. Progress and marks per paper are kept alongside the course.
15. **Start on Home** — signing in, and opening `/`, both land on `/tutor`, the tab
    labelled **Home**. The screen leads with **Add material**, then the full tutor panel
    (the *About* chip in its header defaults to your most recent set), then **Continue**,
    your **study sets**, and compact **Courses** rows with practice links. `/dashboard`
    still redirects here, carrying `?new=1` with it, so old links keep working.

The sidebar has four destinations — **Home**, **Courses**, **Today** and **Timetable** —
plus your four most recent sets, a compact theme switch beside the account, and no
separate goal card. Opening a set or a course and choosing **Ask the tutor** scopes the
same tutor to that material, with a question carried in the prompt.

Home opens with a **Getting started** guide that names the four moves in the order they
build on each other — set up courses, build a study set, explore the tutor, build a
timetable — and ticks each one off as it is done. It removes itself when all four are
complete, and **Hide this guide** dismisses it early. Every screen then ends with the next
step: Courses offers *Build a study set*, a set offers *Add these cards to today's
session*, Today offers *See what's planned next*, and the timetable offers *Start today's
session*, so the loop closes without going back to the menu. All top-level screens share
one header frame (eyebrow, title, one-line description, single primary action), and each
route's content rises into place with the same short entrance.

Each course has four sections: **Pathway**, **Notes**, **Practice** (past papers and topic
papers behind one toggle) and **Study sets**. **Notes** reads each topic's notes in place,
and it is the one place a course cannot be missing: where the subject publishes notes they
are shown as published, and where it does not — Edexcel GCSE Religious Studies, AQA GCSE
Spanish, and any topic whose note pages do not line up — Bluprint writes detailed notes
from the specification and the panel says so. A study set opens on its **Overview**, with tabs for
**Flashcards**, **Quiz**, **Exam practice** and **Needs work** (when there is any). A
single **Continue studying** button picks the recommended mode — due cards first, then the
quiz if it has never been taken — and *Edit set* and *Ask the tutor* sit in the `⋯` menu.
Sets built from a course topic link back to that course.

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
- **Ten questions a day starts the streak; the goal itself follows the exam date.** The
  goal is a display target, not a hard limit: any number of questions counts and nothing is
  blocked. A day only keeps the streak at the Starter tier, so one stray card cannot fake a
  day; Builder and Deep are badges, not extra streak multipliers.
- **A card you mark "Again" comes back in ten minutes**, not the next day, so a study
  session can repair a gap immediately. FSRS then carries the lapse into the next
  interval; there is no separate "learning steps" screen.
- **Dictation uses the browser's speech engine.** Chrome, Edge and Safari expose one, so
  recall needs no extra key or upload; Firefox does not, and the typed box plus Self-mark
  cover that case. Audio is never sent to NVIDIA for card recall.
- **Exam readiness is a heuristic, not a predicted grade.** The 60/25/15 split and the
  projected-at-exam figure exist to steer revision; the bands are labels, not guarantees.
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

The Vite dev server is managed by the platform. `src/main.tsx` pins the Convex client to the
deployment that holds this project's courses and server environment, so no terminal process
needs to be started. Add the NVIDIA keys (below) and open the preview.

### Locally

```bash
bun install

# 1. Start the Convex dev deployment (creates or links a deployment and regenerates types)
bunx convex dev

# 2. In a second terminal, start Vite
bun dev
```

`bunx convex dev` writes the deployment URL into the project's environment. Convex Auth is
already configured; a fresh deployment needs the auth environment keys generated by the
first `convex dev` run. The client URL is pinned in `src/main.tsx`, so change `CONVEX_URL`
there if you want the app to talk to a different deployment.

Open the printed local URL (usually `http://localhost:5173`).

### Checks

```bash
bunx convex dev --once  # push functions and regenerate types
bun tsc -b --noEmit     # frontend + Convex types
bun test                # unit tests, including the summary generator→validator fixture
bun run lint            # ESLint (the template's UI primitives have pre-existing findings)
```

### Deploy to GitHub Pages

The frontend is static, so GitHub Pages can host it. Convex keeps running the backend,
file storage, auth and NVIDIA calls — Pages only serves the built files, and
`NVIDIA_API_KEY` stays on the Convex deployment (never in a Pages secret or the bundle).

1. Push this repository to GitHub with the default branch named `main`.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main` (or run **Deploy to GitHub Pages** from the Actions tab).
   `.github/workflows/deploy.yml` typechecks, builds with the correct base path,
   copies `index.html` to `404.html` for client-side routes, and deploys `dist/`.
4. Set the site URL on the Convex deployment so auth links and redirects point at Pages:

   ```bash
   bunx convex env set SITE_URL "https://<user>.github.io/<repo>"
   ```

5. Sign in once from the deployed URL. Accounts, sets and NVIDIA usage are the same
   Convex data you see locally.

Notes:

- Project sites are served from `/<repo>/`; the workflow derives that base automatically and
  `BrowserRouter` reads `import.meta.env.BASE_URL` as its basename. A user site named
  `<user>.github.io` is detected and served from `/`.
- Deep links work through the copied `404.html`; no server rewrite is needed.
- GitHub's own Pages build cannot run Convex functions. The app needs the Convex deployment
  to be up, which is true for the pinned URL in `src/main.tsx`.
- To build the Pages bundle locally:

  ```bash
  bunx tsc -b && bunx vite build --base="/<repo>/"
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
| Reading photos / video frames | `NVIDIA_VISION_MODEL` | `nvidia/nemotron-3.5-super-vl-120b-a12b` |
| Tutor tier: Fast | `NVIDIA_TUTOR_FAST_MODEL` | `nvidia/nemotron-3.5-bolt-e4b` |
| Tutor tier: Balanced (default) | `NVIDIA_TUTOR_BALANCED_MODEL` | `NVIDIA_TEXT_MODEL`'s model |
| Tutor tier: Deep | `NVIDIA_TUTOR_DEEP_MODEL` | `nvidia/nemotron-3-ultra-550b-a55b` |
| Tutor answers with web access | `OPENROUTER_TUTOR_MODEL` | `meta-llama/llama-3.3-70b-instruct` |
| Tutor dictation through OpenRouter | `OPENROUTER_STT_MODELS` | `nvidia/parakeet-tdt-0.6b-v3`, then `openai/whisper-large-v3-turbo` |

The three tutor levels are Fast, Balanced and Deep; `NVIDIA_TUTOR_POWERFUL_MODEL` and the
older extra tier names are still read where present, but new deployments only need the
three above.

Set overrides on the Convex deployment the same way as `NVIDIA_API_KEY`. A retired model id
is skipped before a request is made: `/src/convex/lib/nvidiaConfig.ts` keeps a short list of
withdrawn ids and replaces them with a checked fallback. If NVIDIA withdraws a model that
is not on that list, the transport sees HTTP 404/410, logs the failing id, and retries the
same prompt on `nvidia/nemotron-3.5-bolt-e4b` and then
`nvidia/nemotron-3-ultra-550b-a55b`. The student sees a friendly "the tutor is having
trouble" message, never the provider's text.

### AI provider health alerts

Every failed NVIDIA call is recorded in `aiIncidents` (feature, model id, HTTP status —
never a key, prompt or answer). A scheduled sweep runs every ten minutes over a
thirty-minute window:

- A retired model (404/410), a rejected key (401/403) or an account with no credit (402)
  alerts on the **first** failure, because none of those fix themselves.
- Rate limits, network failures and 5xx replies alert after three in the window.
- One outage sends one message per hour, so the alert does not spam.

Set `ALERT_WEBHOOK_URL` on the deployment to a Slack, Discord or generic JSON webhook and
the alert is posted there. `ALERT_EMAIL` is included in the payload as a hint for a routing
service. With no webhook, the sweep writes a loud
`⚠️ AI PROVIDER ALERT — …` line to the deployment log, which is the alert for a log-based
monitor. To read the current health by hand:

```bash
npx convex run incidents:health
```

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
  notes to the set, then asks NVIDIA in sequence for the summary, flashcards, quiz (a mix
  of multiple choice, cloze and typed answers), and exam questions. Progress messages are
  written to the set so the page updates live.
- If anything fails, the set gets an **error** status, a readable message, and a retry
  button. Extracted notes and uploads are kept.
- Rate limits (HTTP 429) rotate to the next key in the pool. If the whole pool is
exhausted, the set is paused with a clear message so you can retry after the cooldown.
  Rejected keys are skipped automatically.

Convex actions can run for several minutes, so generation continues if the page is closed.
Reopening the set shows the saved result.

## How scheduling, streak and readiness work

- **FSRS on the server.** `convex/lib/fsrs.ts` holds the scheduler as a pure function.
  Every card stores `stability` (days until recall falls to 90%), `difficulty` (1–10), its
  learning state, reps and lapses. A review supplies one of four ratings; the scheduler
  computes the recall probability at that moment, then the next stability and interval.
  There is no client-side scheduling and no model call: a review is one database write.
- **Typed recall with dictation.** The card is shown, the student speaks (or types) the
  answer, and the answer is marked on meaning: `ai.gradeRecallAnswer` asks the model
  whether the answer carries the same fact as the model answer, and returns a verdict plus
  a one-line note. An answer that matches the model answer word for word is marked without
  a call. If the meaning check cannot be reached, the same word-overlap rules as a typed
  quiz question (`convex/lib/recall.ts`) mark the answer and the note says that is what
  happened. Those rules fold number spellings and accents, so a dictated "six" matches an
  answer key of "6" in the quiz too. The student still chooses the FSRS rating once the
  answer is visible, because only they know how effortful the recall felt. With
  **Self-mark** on, the comparison is skipped and the answer is simply revealed.
- **Dictation that recovers.** `hooks/use-dictation.ts` keeps whatever was typed, retries a
  start the speech engine refused while the previous session was still ending (the usual
  reason the microphone appeared to do nothing between cards), resumes listening when a
  continuous session ends by itself, and reports every failure instead of swallowing it.
- **Daily counts.** `studyDays` holds one row per person per UTC day with cards reviewed
  and questions answered. Cards and quiz questions both increment `questionsAnswered`, so a
  quiz-only session still moves the tiered streak.
- **Readiness and pace.** `convex/lib/studyMetrics.ts` computes readiness at any timestamp
  from the cards' FSRS state plus quiz and written marks. Passing the exam timestamp gives
  the projected-at-exam number. `buildPacePlan` turns the exam date into cards/day and
  quizzes/week, and `goalFromExam` turns the remaining material and days left into the daily
  goal. All of it is server-side, so two devices see the same plan.

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
- **Study this topic** asks how many sections the set should cover, then writes those
  topics' summaries and key points into one study set and opens it. One section is a normal
  topic set; up to twelve consecutive sections can be combined, which is how a student
  revises a whole area without clicking through it topic by topic. The server clamps the
  count to what is left on the pathway, and a set that already covers exactly the chosen
  sections is reopened rather than rebuilt. The existing compile pipeline takes over, so a
  pathway set has the same summary, cards, quiz, exam marking, scheduling, and tutor as an
  uploaded set.
- A pathway set is built from a syllabus outline, not from teaching text. Generation is told
  to write the subject content that outline calls for — facts, examples, vocabulary, worked
  rules — and never material about the specification, assessment objectives, paper structure
  or mark schemes, so an AQA GCSE Spanish set is about Spanish rather than about the exam.
  The brief omits a topic's exam-skill line for the same reason.
- English Literature poetry clusters are completed from the saved AQA anthology lists, so
  every poem appears once in anthology order even when the scraped page only lists the ones
  with notes. Scraped poetry units and starter "Poetry anthology" units are replaced, not
  kept alongside. A saved pathway that shows the anthology twice is repaired in place the
  next time it is opened; poem topic ids are reused, so linked study sets and tick-offs
  survive.
- Marking topics complete is manual. A topic's linked study set, card counts, and course
  scores are derived from the set, not duplicated.

## How a revision timetable is built

- The builder is four separate pages, each with its own URL and a **Next** button:
  subjects; **one study method for the whole timetable** (topics, past papers only, or a mix
  of both) plus a maximum session length (25, 45, 60, or 90 minutes) and **one paper
  choice** for every subject (Paper 1, Paper 2, or both); a school-day study budget (30, 60, 90, or 120
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
- Days are generated **one at a time**, the first time a day is opened. The builder only
  stores the settings; it does not pre-fill a whole calendar. Each generated day continues
  from the topics used by earlier generated days, so the plan still runs in a sensible
  sequence.
- The day is filled up to the chosen budget with sessions that rotate between the chosen
  subjects, so consecutive blocks are not usually the same subject and a different subject
  starts each day. A ten-minute break follows every session. The block that closes a day is
  the leftover time rather than a fresh topic, so it may be shorter than the 20-minute topic
  minimum (a 60-minute day with 45-minute sessions is 45 + 15, not 45 and a quarter of the
  day left empty). On a papers-only plan the minutes that cannot fill a whole hour go to a
  short topic block, so a 90-minute day is a paper plus 30 minutes of revision rather than
  an hour and a half-long gap. Only blocked time, the 8:00 pm cutoff and a remainder below
  ten minutes leave part of a day unused.
- **Session length follows the topic.** The builder's session length is a ceiling, not a
  fixed block: a topic is sized from the material it covers (its key points and summary),
  with a **20-minute minimum** for a short topic and the chosen length for a full section.
  This is why one day can hold a 20-minute definition, a 45-minute section and a paper,
  instead of every topic taking the same time.
- **The day is spread out, not stacked.** Spare time in the day is shared between sessions
  as longer gaps (up to two hours), so four hours on a day off is not four hours back to
  back. If the day has no spare room the planner packs it tightly instead, so no work is
  lost. Starts land on the hour, quarter past, half past or quarter to, so a break or a
  meal never leaves a session beginning at an odd minute.
- **Meals are kept free automatically.** Lunch (12:30–13:15) and dinner (18:00–18:45) are
  removed from the study window when there is real study time on both sides of them, and
  the timetable screen shows them as breaks. If keeping a meal free would drop a session,
  the session wins and that meal is not listed for the day.
- **Nothing is scheduled to end after 8:00 pm.** A session that would cross that line is
  left out. The cutoff plus any blocked periods decide how many sessions fit; the builder
  disables start times too late for your session length, and the server rejects a plan whose
  sessions would run past the cutoff.
- **Blocked time is skipped.** Any day can have periods blocked out (a match, a shift,
  weekend plans). Enter the start and end as typed times such as `18:00` (or `6:30pm`) in
  the Block time dialog. Saving the blocks rebuilds that day immediately and keeps any
  sessions already ticked done. Up to eight blocked periods are accepted per day.
- **Sessions are ticked done one at a time.** An unticked session on a past generated day
  is missed work. The next day takes one or two of the oldest missed sessions as
  **Catch-up** blocks, and the rest follow on later days, so catch-up never becomes one long
  block. At most two extra sessions are added to any day.
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
- The plan runs from the start date up to the day before the first exam. If the estimated
  number of sessions is not enough for every topic, the planner moves the start back a day
  at a time (up to twelve weeks, never before today) and reports when it did this. Because
  days are generated lazily, this is a capacity estimate rather than a guarantee.
- A plan is deterministic and does not call an AI model, so it builds instantly and cannot
  fail on a model rate limit.
- The timetable screen shows **one day at a time**, not a week grid. A seven-day strip
  selects which day to open; a day is generated and saved the first time it is opened. The
  default is today, so the screen leads with the work in front of you rather than a whole
  week of it.
- Sessions show their start and end time, duration, subject colour, paper and topic, plus a
  **Mark done** toggle. Blocked periods appear inline at their time. Topic blocks call the
  same topic-to-study-set mutation as the course page, reusing an existing set for that
  topic or creating one and opening it. A past paper block opens its saved paper, or the
  course page when no paper exists yet.
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
- The award is reconciled against the guide's own ledger. A generated guide that carries
  fewer marks than the question is worth is scaled onto the question, every bullet credited
  is full marks, and an answer that reproduces the model answer is awarded full marks. A
  thin guide therefore cannot cap a perfect answer below the paper's total.
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
    Tutor.tsx            the home screen: full tutor chat, continue cards,
                         saved study sets library, course rows, upload dialog
    Today.tsx            due queue, quick sprint picker, streak and daily goal
    Courses.tsx          course library with pathway progress
    CourseSetup.tsx      level, board, tier, and multi-subject course picker
    Course.tsx           course pathway, practice (past and topic papers), and sets
    PastPaper.tsx        one saved practice paper: its cover, build progress, and
                         AI-marked questions
    StudySet.tsx         set overview and summary, plus flashcards, quiz and exam
                         practice as separate screens
    TimetableBuilder.tsx subjects, session length, one paper answer, budgets, exam dates
    Timetable.tsx        one day at a time: blocked periods, done ticks, catch-up
  components/
    AppShell.tsx         sidebar / mobile navigation for signed-in pages
    ThemeProvider.tsx    persisted light / dark theme, following the OS until chosen
    ThemeToggle.tsx      the light / dark switch used in the shell and public pages
    CreateSetDialog.tsx  course, photo, video and pasted-text sources for a study set
    Brand.tsx            Bluprint wordmark
    BlueprintMark.tsx    geometric mark and drafting-grid hero glyph
    ChromeBackdrop.tsx   steel sheet, dot grid, moving specular ribbons and reflections
    InkInWater.tsx       canvas ink-in-water plumes for the landing hero
    study/               flashcard review (dictation + FSRS), quiz runner, exam practice,
                         practice papers, readiness/pacing panel, needs-work session,
                         set library, tutor chat, edit-set dialog
  convex/
    schema.ts            users, courses, studySets, cards, quiz, exam, practice papers,
                         tutor, study days, plans
    courses.ts           pathway CRUD, topic progress, topic-to-set creation, schedulers
    pastPapers.ts        saved practice papers, build queue, progress and marked answers
    timetable.ts         per-day plan generation, blocked periods, catch-up, completion
    studySets.ts         ownership-checked queries/mutations + internal compile writes
    tutor.ts             saved tutor threads and the context the action reads
    ai.ts                "use node" NVIDIA calls, key rotation, OCR, JSON validation, marking,
                         tutoring, study-set generation, and the course-outline pathway actions
    settings.ts          environment key-pool status for the UI
    lib/fsrs.ts          pure FSRS scheduler (stability, difficulty, four ratings)
    lib/studyMetrics.ts  exam readiness, projected readiness, pace plan, daily goal
    lib/recall.ts        shared word-overlap marking for typed and cloze answers, with
                         number spellings and accents folded; fallback for flashcard
                         meaning checks
    lib/poetryAnthologies.ts  saved AQA clusters and duplicate-free anthologised units
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
  plan and its generated days. Each day is generated on demand, holds as many subject
  sessions as the daily budget and blocked periods allow, and cycles back through topics if
  there are more revision days than topics. Because plans are lazy, days you never opened
  were never assigned work, so there is no hidden backlog for them.
- **Timetable holidays cover England and Wales.** Scotland and Northern Ireland have
  different bank holiday dates; supporting those would need a region choice, which version 1
  leaves out to keep the setup short.
- **School-break dates are typical England term dates, not an official local-authority
  calendar.** The planner uses the common Monday-to-Friday windows for autumn, Christmas,
  February, Easter, May, and summer breaks. Local authorities can differ by a week; the
  table labels the break it used, and rebuilding after checking your school calendar is the
  simplest adjustment. Weekends, bank holidays and these break weekdays all use the
  day-off budget the student chose in the builder; nothing is multiplied or assumed.
- **Gaps count as time, not study time.** The budget the student picks is study time.
  Bluprint leaves a ten-minute gap between sessions rather than a break as long as the
  session before it, so a short evening still fits its blocks. The day's start and end
  times include those gaps; the study total does not.
- **One session length for the whole plan.** Sessions are the same length for every
  subject, because a study block is a habit rather than a per-subject setting. **One paper
  answer covers the whole timetable** instead of a paper per subject, since friends revise
  the same paper across their subjects. A session that does not fit the day's remaining
  budget, the blocked periods, or the 8:00 pm cutoff is left out of that day.
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
- **English prompts and defaults**, with at most 20,000 characters of pasted notes stored
  and generated from (12,000 characters of the longest notes are sent per model call, with
  a note saying the material was shortened).


## Troubleshooting

- **"NVIDIA_API_KEY is not set"** — add it to the Convex deployment environment.
- **401 / 403** — every key in the pool was rejected. Replace `NVIDIA_API_KEY` on the
  deployment.
- **429** — the whole pool is cooling down. Wait about a minute, then retry the set.
- **AI says it is having trouble** — the provider failed after every key and fallback was
  tried. Details are in the deployment log and in `aiIncidents`; the health sweep posts an
  alert on the first retired model, rejected key or empty-credit account. If the cause is a
  retired model, set `NVIDIA_TEXT_MODEL` / `NVIDIA_VISION_MODEL` to a model currently
  listed on NVIDIA Build.
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
- **A session is missing from the timetable** — it would have run past 8:00 pm or into a
  blocked period, so it was left out of that day. Remove a block, start earlier, or shorten
  the session to fit more in.
