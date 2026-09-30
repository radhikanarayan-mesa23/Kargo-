# Kargo Hiring Dashboard — Build Prompt

Paste this into Claude Code, from the root of a GitHub repo connected to Vercel
(or an empty folder — Claude Code can scaffold Next.js and create the repo).

This document is the original spec **plus every real-world fix and gotcha
discovered while actually building and deploying it once already** — a
fresh rebuild starting from just the original spec (see Appendix A) would
hit the same bugs; this version should not.

---

## Context

Kargo is a 40-person Series A logistics SaaS company. The founder, Arjun, is
the hiring manager for every role. Two roles, Product Manager (PM) and
Senior Product Manager (SPM), have been open for 11 weeks. There have been
60 applications and zero offers, and there is no record of why anyone was
shortlisted or passed over.

Build a hiring dashboard. **The system recommends and Arjun decides. His
click is the last thing he touches.** Nothing is sent to a candidate unless
Arjun has made a recorded decision.

## Components map (build exactly this flow)

| Lane | Step |
|---|---|
| Founder: Trigger | Uploads one or more CVs and selects the role applied for (PM/SPM) |
| Founder: Input | CV files (.pdf / .docx) + selected role |
| System: Context | Extracts text and contact details, redacts personal details before anything reaches the AI, stores the original privately |
| AI: Scoring | Scores the redacted CV against the rubric, **for both the PM and SPM variants**, returning JSON with evidence quotes |
| System: Processing | Verifies quotes and computes totals, bands, gates and routing **in code** |
| AI: Drafting | Generates the interview brief and an email draft (invite or decline) using a `{{first_name}}` placeholder |
| Output | Dashboard with ranked candidates, scores, interview brief, draft emails, and a pipeline stats overview |
| Email (Resend) | Sends **only when Arjun clicks**. The decision is recorded first, then the email is sent |
| Record | Every decision and send is logged permanently |

## Stack

- **Next.js** (App Router, TypeScript), deployed on **Vercel**.
- **Supabase:** Postgres for data and a **private** Storage bucket `cvs` for
  the original files. Service-role key server-side only, never exposed to
  the browser.
- **AI provider for scoring + drafting: decide this explicitly up front**
  (see "AI provider decision" below) — do not default silently to one and
  discover the mismatch later.
- **Resend** (`resend` npm package) for email.
- **CV parsing:** `pdf-parse` (wraps `pdfjs-dist`) for PDF, `mammoth` for
  DOCX, both server-side. **See "PDF parsing on Vercel" below before
  writing this code — it will silently fail in production otherwise.**
- **Quote verification:** `fuzzball` (fuzzy string matching), threshold 0.9.
- Vercel functions have no persistent disk. All state lives in Supabase,
  never in local files.
- Vitest for unit tests.

### AI provider decision

Ask the user directly, before writing any scoring code: **which AI
provider and model** (Anthropic/Claude, Google/Gemini, OpenAI, etc.), and
get the actual API key before building the client wrapper. Whichever is
chosen, isolate it behind one thin module (e.g. `lib/scoring/model-client.ts`
exporting a single `generateText(systemPrompt, userContent, model)`
function) so the rest of the scoring/drafting code has zero
provider-specific imports and swapping providers later is a one-file change.
If using Gemini: model IDs move fast — confirm the exact current model
string works with a live one-line smoke-test call before wiring it into
the full scoring flow, rather than assuming a model name from training
data is still valid.

### PDF parsing on Vercel — read this before writing `lib/extraction/pdf.ts`

`pdf-parse` v2 wraps `pdfjs-dist`, which loads its own worker script
(`pdf.worker.mjs`) and other runtime assets (cmaps, standard fonts) via
**dynamically-computed file paths at runtime**, not static imports. This
causes two distinct, sequential failures if not handled up front:

1. **Next.js's bundler (webpack/Turbopack) mangles the dynamic path**,
   producing `Setting up fake worker failed: Cannot find module
   '.../pdf.worker.mjs'` — reproducible locally in `next dev`.
   **Fix:** add to `next.config.ts`:
   ```ts
   const nextConfig: NextConfig = {
     serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
   };
   ```
   This stops the bundler from touching the package at all, so Node
   resolves the file directly from `node_modules` — this alone is enough
   to fix it **locally**.

2. **This is not enough on Vercel.** Vercel's build performs a separate
   "output file tracing" pass (`@vercel/nft`) that decides which
   `node_modules` files actually get shipped with each deployed
   serverless function. It only includes files it can *statically*
   detect a route imports — a dynamically-computed path like pdfjs-dist's
   worker loader is invisible to it. The result: the fix above makes it
   work in local dev (full `node_modules` on disk, no tracing happens),
   passes a local `next build` (same reason — the build output isn't what
   actually gets pruned/deployed), and then **still crashes silently in
   production** with an empty-body 500, because `pdf.worker.mjs` and the
   `cmaps`/`standard_fonts` directories are simply missing from what
   Vercel deployed. Verify this yourself before assuming it's fixed:
   ```bash
   cat .next/server/app/api/upload/route.js.nft.json | \
     node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j.files.filter(f=>f.includes('pdfjs')))})"
   ```
   If that list doesn't include `pdf.worker.mjs`, add this to
   `next.config.ts` alongside `serverExternalPackages`:
   ```ts
   outputFileTracingIncludes: {
     "/api/upload": ["./node_modules/pdfjs-dist/**"],
   },
   ```
   Re-run the check above to confirm the worker file is now present, and
   only then treat PDF upload as working — testing with **real PDF files**
   is required here; synthetic `.docx` test fixtures never exercise this
   path at all and will pass while production PDF upload is completely
   broken.

3. Also set `export const maxDuration = 60;` on the upload route — PDF
   extraction plus a Storage upload can exceed Vercel's platform default
   function duration, which otherwise cuts the request off mid-extraction
   and returns an empty body the client fails to parse.

## Source of truth

`rubric/kargo_hiring_rubric.txt` is in the repo (get this from the user —
it's specific to Kargo's actual past hires and JD language, not something
to invent).

- Read it in full before planning.
- Every weight, anchor, gate, band, fairness rule and output field comes
  from it. Do not invent criteria.
- Import it as a string and use it as the scoring system prompt.

## Data model (Supabase migrations)

- `candidates`: id, created_at, role_applied (pm|spm), name, email
  (unique), phone, cv_path, cv_text_redacted, status (uploaded | scoring |
  scored | needs_review | advanced | held | declined)
- `scores`: candidate_id, rubric_variant (pm|spm), c1–c5 (int 0–4),
  confidence (jsonb), quotes (jsonb), gates (jsonb — see note below), total
  (numeric), band, hidden_value (jsonb), probes (jsonb), risks (jsonb),
  **key_insight (text)**, model, created_at. Primary key: (candidate_id,
  rubric_variant).
  - `key_insight`: one AI-generated sentence per candidate that explicitly
    weighs their raw JD/experience fit against the pattern-based signal
    the rubric is actually tuned on (the rubric's own Section 1 shows
    these often diverge — a textbook JD match can rate Meets while a
    less-experienced candidate rates Exceeds). Surface this as a
    highlighted callout on the candidate card, distinct from the longer
    "why ranked here" reason text.
  - The `gates` jsonb column should also carry the raw experience facts
    the AI extracted (years of ops experience, etc.), not just the gate
    pass/fail results — the dashboard's Section 8 tie-breakers need this
    data (specifically "more recent hands-on ops exposure") and there's
    nowhere else to persist it without an extra migration.
- `drafts`: candidate_id, type (invite|decline), subject, body_template,
  brief_md, created_at
- `decisions`: **append-only**. id, candidate_id, decision
  (advance|hold|decline), note, decided_at. No update or delete policies —
  **and add a `BEFORE UPDATE OR DELETE` trigger that unconditionally
  raises**, not just an RLS policy. The service-role key used server-side
  bypasses RLS entirely, so RLS alone cannot guarantee append-only; a
  trigger is the only thing that holds regardless of which Postgres role
  attempts the mutation. (This was tested for real: a careless ad-hoc
  cleanup script attempted to delete a candidate with a recorded decision,
  and the trigger correctly blocked it while the softer `scores`/`drafts`/
  `emails` rows — which have no such trigger — got deleted. That's
  expected: only `decisions` needs to be truly immutable.)
- `emails`: id, candidate_id, type, mode (dry|live), resend_id, status,
  error, sent_at. Add a **UNIQUE (candidate_id, type)** constraint so the
  same email can never go out twice.

RLS: enable it on all 5 tables with **zero policies for anon/authenticated**
(default-deny). This is safe and sufficient because the app never calls
Supabase from the browser — every read/write goes through server-only
route handlers or server components using the service-role key.

## Flow details

### 1. Upload (Trigger + Input)
- **Multi-file upload.** Arjun can drop in 60 CVs at once and pick a role
  for the whole batch or per file.
- Process files one per request, with a status indicator for each file
  that tracks stage-by-stage progress (uploading → scoring → drafting →
  done/error), not just a single pending/done binary — scoring and
  drafting are separate AI calls with separate failure modes and the UI
  should say which stage failed.
- Set `maxDuration` on the upload and scoring routes so a slow extraction
  or AI call doesn't get cut off mid-request (see "PDF parsing on Vercel").
- Client-side: never assume a fetch response is JSON. Read the response
  body as text first, then attempt to parse it, and surface the raw
  status code plus a snippet of whatever came back on parse failure. A
  bare `res.json()` call throws an opaque "Unexpected end of JSON input"
  on an empty body (timeout, platform error page, or an uncaught server
  exception), which is useless for diagnosing what actually went wrong —
  this happened during real testing and the better error message was the
  difference between diagnosing it in minutes vs. guessing blind.

### 2. Context: extract and redact (no AI in this step)
- Extract the text from each CV.
- Pull out contact details using regex/heuristics, but **do not rely on
  "first non-empty line = name."** Real resume PDFs extract text in an
  order that frequently does *not* match the visual/reading layout
  (multi-column layouts, sidebars, headers get extracted out of visual
  order) — this is not an edge case, it happened on the very first real
  PDF tested. Concretely:
  - Many resume templates render the candidate's name **twice** near the
    contact block: once stylized (e.g. all-caps) and once in plain
    title-case, for accessibility/searchability — e.g.
    `"ISHAAN ROY\tIshaan Roy"`. Scan the **entire extracted text** (not
    just near the top) for this all-caps-echoed-by-title-case pattern,
    and when found, prefer it as the canonical name over any "first line"
    guess, since it's a far more reliable signal.
  - Collect **every** name-shaped string found (the naive first-line
    guess *and* both forms of an echoed header, if present) into a
    `nameCandidates` list, and redact **all of them**, not just the one
    chosen as the display name. A wrong "first line" guess like
    `"Bangalore, India | Remote"` being redacted too is harmless
    over-redaction (arguably desirable — stripping an inferred city name
    is in the spirit of the fairness rule against inferring location);
    silently failing to redact the *actual* name because a different,
    wrong string was chosen is a real, serious PII leak. This was caught
    on the very first real PDF test: the actual candidate's name reached
    the point where it would have gone straight to the AI, completely
    unredacted, because the naive heuristic latched onto an unrelated
    header line and no fallback ever found the real name at all.
  - Similarly, don't assume the *first* email-shaped string found is the
    right one — some resume sources embed a placeholder/watermark email
    (seen in real test data: a course-platform-injected address
    unrelated to the candidate) that a naive `text.match(EMAIL_PATTERN)`
    can pick up ahead of the candidate's real one. This is a lower-severity
    issue than the name leak (it doesn't leak PII, it just risks
    contacting the wrong address) but worth a validation/confirmation
    step before actually sending to a captured email address, especially
    early on.
  - The education-section institution-blanking step has the same
    ordering fragility: if it only activates *between* a detected
    "Education" heading and the next section heading, an institution
    name that extracts *before* the heading text (again, extraction-order
    scrambling) slips through unredacted. Consider also running the
    keyword-based institution-name matcher (University/College/Institute/
    IIT/IIM/etc.) globally across the document, not only inside the
    detected section window, as a second pass.
- Redact the following from the text sent to the AI: the name (all
  candidate forms) and every later occurrence of it, email, phone, URLs
  and street addresses, dates of birth and gender markers, and college/
  school names on education-section lines (keep the degree field).
- **Redaction order matters:** run precise structural patterns (email,
  phone, URL) *before* stripping name tokens. A name is often a substring
  of its own email's local part (e.g. "verma" inside
  "asha.verma@..."); redacting the name first fractures the email match
  into orphaned name-tag fragments instead of one clean
  `[REDACTED-EMAIL]`. Institution-name blanking should run last.
- Save the result as `cv_text_redacted`. Store the original file in the
  private `cvs` bucket. Deduplicate on email (update the existing
  candidate row on re-upload instead of creating a new one) — but note
  this means a candidate row with a recorded decision can never actually
  be deleted end-to-end (the `decisions` append-only trigger blocks the
  cascade), which is intentional, not a bug to work around.

### 3. AI scoring
- Make one call per rubric variant, PM and SPM (per gate routing below).
- Use the rubric as the system prompt and the redacted CV as the user
  message. Ask for strict JSON matching Section 9 of the rubric, **plus**:
  - Structured experience facts the gates need (years in a product-owner
    role, years of hands-on ops, founding-team product work, total years
    as PM, whether they owned an area without a senior PM above them) —
    the gates need these as data, and there's no other reliable way to
    get them without asking the model directly alongside the scores.
  - The `key_insight` sentence described above.
- **Quote verification:** in code, fuzzy-match each evidence quote against
  `cv_text_redacted` (similarity ≥ 0.9, via `fuzzball`'s
  `partial_ratio`/`token_set_ratio`, normalizing whitespace/quotes first,
  with an exact-substring fast path). If a quote isn't found, set that
  criterion to 0 and add `"unverified quote"` to its risks.
- Retry once on invalid JSON. On a second failure, set
  `status = needs_review`.
- G2 (location) needs no AI input at all: since street addresses are
  redacted before the CV ever reaches the model, "never infer location
  from the CV" is enforced structurally, not as a judgment call — this
  gate is a constant `{ flag: "CONFIRM IN FIRST REPLY" }` in every case.

### 4. Processing (plain code, no LLM)
- Calculate `total = Σ (score / 4) × weight`, using the weights from the
  rubric.
- Apply the bands, the G1 gates (including near-miss flags), G3 routing,
  and the Section 8 tie-breakers, as pure functions with no I/O — this
  makes them trivially unit-testable and reusable by the calibration
  script (below).
- Write a role-agnostic total function too (excluding the role-specific
  C4 criterion) if the rubric has a calibration section scored that way —
  check it reproduces the rubric's own worked numbers exactly before
  trusting anything downstream.
- Write unit tests for all of this, including a hand-computed example and
  (if the rubric provides one) every row of its own calibration table.

### 5. AI drafting
- A second call generates:
  - an interview brief in markdown (the probes, risks and hidden value)
  - one email draft of the recommended type:
    - **invite** for PRIORITY SHORTLIST or SHORTLIST
    - **decline** for DECLINE QUEUE (and HOLD, as a safe default, until
      Arjun picks a side)
- The model never sees the candidate's name. The code substitutes
  `{{first_name}}` just before sending.
- Decline emails are courteous and specific to the role. They **never**
  mention scores, criteria or reasons.
- If Arjun chooses the other decision, generate the other draft on
  demand — and if a decision route is invoked without a draft of the
  needed type existing yet (e.g. a batch action hits a candidate nobody's
  card was ever opened for), the send logic itself should generate it on
  demand rather than fail with "no draft exists." Card UI logic that
  edits a draft's subject/body before sending must be careful to always
  re-verify/re-fetch the *exact* draft type matching the button just
  clicked, and use that freshly-fetched content for the send — not
  whatever text happened to be sitting in the editor state, which may
  still hold a different type's draft if the user toggled between
  invite/decline preview without the send action re-checking. This was a
  real bug: clicking "Advance & send invite" while the editor displayed a
  decline draft could have sent stale decline text as if it were the
  invite.

### 6. Dashboard (Output)
- A pipeline stats overview at the top: total resumes, sent to interview,
  rejected, pending review, plus a compact band breakdown (priority
  shortlist / shortlist / hold / decline queue counts).
- Show one tab per role, sorted by band, then total, then the
  tie-breakers.
- Each candidate card shows:
  - name, band, total, and the "why ranked here" text
  - the **key insight** callout (see data model above), visually distinct
    from the "why ranked here" reason
  - the scores for C1–C5, each with its quote and confidence tag
  - the SPM/PM cross-score, when the candidate was routed to both
  - hidden value, the brief, and the email draft (editable)
- Each card has three buttons: **Advance & send invite**, **Hold**,
  **Decline & send**. Once an email of a given type has actually sent,
  disable/relabel that specific button (e.g. "Invite sent") rather than
  leaving it clickable — the backend's uniqueness guard would reject a
  second attempt anyway, but the UI shouldn't invite the click.
- Add a **"Send all queued declines"** button, scoped per role, that only
  acts on DECLINE_QUEUE candidates with **no decision recorded yet** —
  don't re-send to someone Arjun already explicitly decided on manually.
  Reuse the same guarded send function as the single-card buttons; don't
  duplicate the guard logic.
- The HOLD band is hidden unless a role has fewer than 5 shortlisted
  candidates.
- Pin a "previously contacted" list at the top, seeded from a small CSV
  (`name,email,note` — ship it as a header-only placeholder plus a short
  README telling Arjun how to fill it in; this covers candidates who got
  an informal reply before the dashboard existed).

### 7. Send (Resend)
Each send runs these steps in order, all on the server, in one function
shared by both the single-card buttons and the batch-decline button:
1. Check no row already exists in `emails` for this (candidate_id, type) —
   check this *before* recording a decision, so a duplicate-send attempt
   never writes a redundant decision row either.
2. Insert a row into `decisions`.
3. Re-read and verify the decision row that was just inserted actually
   exists and matches — don't just trust the insert call succeeded.
4. Ensure a draft of the needed type exists (generate on demand if not).
5. Send the email — dry-run by default (see below).
6. Write the result to `emails`, success or failure, never dropped
   silently.

A failed send is shown on the card and logged. Write both automated
tests *and* verify this manually end-to-end at least once: mock-based
tests for the guard ordering (no email call happens before a verified
decision row exists; a second send attempt for the same candidate+type is
rejected before either a decision or a send is attempted) catch logic
regressions, but only a real click-through against a real (dry-run) send
confirms the whole path actually works.

## Hard safety rules

1. **Protect the dashboard.** Add middleware that requires a password
   (`DASHBOARD_PASSWORD`), stored in a signed httpOnly cookie. Protect
   every page and API route except the login page. (Note: as of recent
   Next.js versions, the file-based convention is `proxy.ts`, not
   `middleware.ts` — check `node_modules/next/dist/docs/` for the current
   convention rather than assuming from training data; Next.js's own
   codemod, `npx @next/codemod@canary middleware-to-proxy .`, handles the
   rename cleanly if scaffolding starts with the old convention.)
2. **Dry-run by default.** Unless `EMAIL_MODE=live`, every email goes to
   `TEST_RECIPIENT`, with the intended recipient shown in the subject
   line. Show a banner with the current mode on every page — keep the
   banner copy short and left-aligned; a long centered sentence with an
   inline `<code>` email address wraps badly and looks broken on
   anything but a wide viewport.
3. No decision row means no email. This is enforced in code, not only in
   the UI.
4. The unique constraint on `emails` enforces idempotency.
5. Keep all keys in Vercel environment variables (name them for whichever
   AI provider was actually chosen — see "AI provider decision"):
   `<PROVIDER>_API_KEY`, `SCORING_MODEL`, `RESEND_API_KEY`, `RESEND_FROM`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DASHBOARD_PASSWORD`,
   `SESSION_SECRET`, `EMAIL_MODE`, `TEST_RECIPIENT`, `SCHEDULING_URL`.
   - Commit a `.env.example` file with these names.
   - Never commit or log the actual values.
   - The Supabase **service-role** secret key is deliberately not exposed
     by Supabase MCP tooling — get it manually from the dashboard
     (Project Settings → API → service_role) and paste it directly into
     `.env.local` / Vercel's env var settings.
   - For a shared sandbox `RESEND_FROM` (no verified domain yet),
     Resend's `onboarding@resend.dev` works immediately with zero setup —
     but it can only send to the email address the Resend account itself
     is registered under, so `TEST_RECIPIENT` must be that same address
     while using it.
6. Scoring never triggers an email. Only Arjun's click does.

## Build order

1. Read the rubric, one JD and two sample CVs. **Show me a plan (file
   tree, migrations, routes) and wait for my approval.**
2. Before creating any cloud resources (Supabase project, Vercel project),
   check what already exists rather than assuming a clean slate — list
   existing Supabase projects and Vercel projects first. If reusing an
   existing "empty-looking" Supabase project, actually inspect its tables
   before trusting it's unused; project metadata alone doesn't show
   contents.
3. Write the Supabase migrations and the auth middleware.
4. Build upload, extraction and redaction.
   - Show me the redacted output of one CV before continuing — and when
     doing this checkpoint, use a synthetic fixture, not a real uploaded
     resume (see the note on real-PDF testing below for why this
     checkpoint alone isn't sufficient).
5. Build AI scoring, quote verification, and the processing code, with
   unit tests.
6. **Calibration gate:** add `scripts/calibrate.ts`, which scores the
   rubric's own past-hire examples (reconstruct minimal synthetic
   profiles solely from facts the rubric document itself already
   discloses about them — never a real uploaded resume) and prints
   whatever calibration table the rubric defines.
   - **Stop and report** if the calibration ordering the rubric expects
     (e.g. every "Exceeds" example outscoring every lower-rated one) does
     not hold.
7. Build the dashboard, then drafting, then sending (in dry-run), then
   the batch declines.
   - **Before writing dashboard UI code, pause and ask for design
     direction** — palette, typography, density, tone — rather than
     shipping a generic layout. If given a reference image/doc, distinguish
     between "match this exact visual system" and "borrow this structural
     idea" (e.g. a dark neon dashboard's *layout pattern* of prominent
     stat tiles can be adopted while keeping an already-established, more
     minimal light color system) — ask if genuinely ambiguous.
8. **Test with real files, not only synthetic fixtures, before considering
   any part of the pipeline done.** Synthetic `.docx` fixtures never
   exercise `pdf-parse`'s actual runtime behavior at all, and every bug
   listed under "PDF parsing on Vercel" and the redaction-ordering notes
   above was only ever found by uploading real PDF resumes — get a
   handful of real (or realistic) sample PDFs early and run the full
   upload → score → draft path against them, both locally and on the
   actual Vercel deployment, before reporting the feature complete.
9. Write tests for:
   - redaction (the name — in every form it appears — email, and college
     must not appear in the redacted text; also test the
     echoed-header-name and extraction-order-scrambling scenarios
     directly, with a fixture built for that, not just the happy path)
   - arithmetic and bands against a hand-computed example
   - the gate logic
   - the no-decision-no-send guard (mock the DB/email layer and assert
     call ordering, not just end states)
   - duplicate-send rejection (call the guarded send function twice for
     the same candidate+type and assert the second attempt is rejected
     without a second email call)
10. Write a `README.md` covering: Supabase setup, the Vercel env vars,
    running the calibration script, and switching to live mode.
11. Push to GitHub and connect Vercel **last**, once everything above is
    validated locally — but see "Git push without terminal access" below
    if the environment can't type a token into a terminal itself.
12. After the first deploy succeeds, **retest the full upload path against
    the live production URL specifically**, not just locally — Vercel's
    actual deployed function environment (traced/pruned files, cold
    starts, platform timeouts) is not fully equivalent to a local dev
    server or even a local production build, and this is exactly how the
    pdf-worker tracing bug above surfaced: invisible locally, broken only
    in the real deployment.

Deploy to a Vercel **preview** first. Don't promote to production until a
dry-run send has been tested end to end, against the live deployment.

## Git push without terminal/coding access

If the person driving this doesn't want to (or can't) use a terminal:
avoid a scenario where an agent has to type a raw GitHub token directly
into a shell command — some environments' safety layers will flag and
block that pattern outright, repeatedly, regardless of which tool
constructs the command. It also just isn't necessary. Set up a
dedicated SSH deploy key instead:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/<project>_deploy_ed25519 -N "" -C "<project>-deploy"
```
Then have the person paste the **public** key (safe to share, not a
secret) into GitHub → Settings → SSH and GPG keys → New SSH key — a
simple two-click, no-terminal action. Push using:
```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/<project>_deploy_ed25519 -o IdentitiesOnly=yes" \
  git push git@github.com:<owner>/<repo>.git HEAD:main
```
No secret ever appears in a command this way, since key material is read
from disk, not typed inline.

---

## Appendix A: Original spec, verbatim

(Preserved for reference — see the body above for what actually changed
in practice.)

### Context
Kargo is a 40-person Series A logistics SaaS company. The founder, Arjun,
is the hiring manager for every role. Two roles, Product Manager (PM) and
Senior Product Manager (SPM), have been open for 11 weeks. There have been
60 applications and zero offers, and there is no record of why anyone was
shortlisted or passed over.

Build a hiring dashboard. The system recommends and Arjun decides. His
click is the last thing he touches. Nothing is sent to a candidate unless
Arjun has made a recorded decision.

*(The rest of the original spec — components map, stack, data model, flow
details, hard safety rules, and build order — is identical to the body of
this document above the "AI provider decision" and other callout sections;
those callouts mark exactly where real implementation experience added
detail the original spec didn't have.)*
