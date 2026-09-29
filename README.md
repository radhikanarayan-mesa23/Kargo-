# Kargo Hiring Dashboard

Internal dashboard for Kargo's PM/SPM hiring pipeline. Arjun uploads CVs; an
AI scorer applies `rubric/kargo_hiring_rubric.txt`, plain code computes
gates/bands/routing, and an AI drafts an interview brief and one email --
but nothing is ever sent to a candidate until Arjun clicks a decision
button on the dashboard.

## Stack

Next.js (App Router, TypeScript) &middot; Supabase (Postgres + private
Storage) &middot; Gemini via `@google/genai` for scoring/drafting &middot;
Resend for email &middot; `pdf-parse` / `mammoth` for CV text extraction.

> The original spec targets the Anthropic SDK (`ANTHROPIC_API_KEY`,
> `SCORING_MODEL` defaulting to `claude-sonnet-5`). This build currently
> runs on Gemini as an interim provider decision -- see
> `lib/scoring/model-client.ts` if switching back.

## Supabase setup

The schema lives in `supabase/migrations/*.sql`, applied in order to a
Supabase project:

1. Create (or pick) a Supabase project.
2. Apply each migration in `supabase/migrations/` in filename order (via the
   Supabase SQL editor, the CLI, or the Supabase MCP `apply_migration` tool).
   This creates `candidates`, `scores`, `drafts`, `decisions` (append-only --
   a trigger blocks `UPDATE`/`DELETE` even for the service role),
   `emails` (unique per `(candidate_id, type)`, so the same email can never
   go out twice), the private `cvs` Storage bucket, and locks down RLS with
   zero anon/authenticated policies. Nothing in the app ever calls Supabase
   from the browser -- every read/write goes through server-only code using
   the service-role key.
3. Grab the project URL and the **service_role** secret key (Project
   Settings &rarr; API &rarr; API Keys) for the env vars below. The MCP
   tooling deliberately does not expose the service-role key, so this step
   is manual.

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Var | Purpose |
|---|---|
| `GEMINI_API_KEY` / `SCORING_MODEL` | AI scoring + drafting |
| `RESEND_API_KEY` / `RESEND_FROM` | Email sending |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Database + Storage (server-only) |
| `DASHBOARD_PASSWORD` | Shared password gating the whole dashboard |
| `SESSION_SECRET` | Signs the login session cookie -- generate with `openssl rand -base64 32` |
| `EMAIL_MODE` | Unset (or anything but `live`) = dry-run: every send is redirected to `TEST_RECIPIENT` with the real recipient shown in the subject. Set to `live` to actually email candidates. |
| `TEST_RECIPIENT` | Where dry-run sends land |
| `SCHEDULING_URL` | Interview scheduling link inserted into invite emails |

Never commit `.env.local` -- only `.env.example` (names, no values) is
tracked.

## Running it

```bash
npm install
npm run dev       # http://localhost:3000
npm run test      # unit tests (redaction, gates/bands/tie-breakers, quote
                   # verification, send-guard, duplicate-send rejection)
npm run calibrate # Section 10 calibration check, see below
```

## Calibration check

`scripts/calibrate.ts` scores the 8 synthetic past-hire fixtures in `hires/`
(reconstructed solely from facts the rubric's own Section 1 already
discloses -- never a real resume) and prints the Section 10 table. It
passes only if every Exceeds-rated hire outscores every Meets/Below-rated
one on the role-agnostic (C1/C2/C3/C5) scale; if it fails, it says exactly
which pair violates the ordering and exits non-zero. Run it after any
change to the rubric or the scoring prompt:

```bash
npm run calibrate
```

## Data flow (what to trust where)

- **Redaction is the only thing between a CV and the AI.** Name, email,
  phone, URLs, address, DOB, gender markers, and education-section
  institution names are stripped in `lib/redaction/` before
  `cv_text_redacted` is ever sent to the model. The original file goes only
  to the private `cvs` Storage bucket.
- **Every AI-cited quote is fuzzy-verified** against `cv_text_redacted`
  (`lib/quote-verify/fuzzy-match.ts`); an unverified quote zeroes that
  criterion and flags it, per rubric Section 7.
- **Gates, weighted totals, bands, and tie-breakers are plain code**
  (`lib/processing/`), not the AI -- unit-tested independently of any model
  call, and exercised end-to-end by `npm run calibrate`.
- **No decision row, no email.** `lib/actions/decide-and-send.ts` inserts
  and verifies a `decisions` row before ever calling Resend, and refuses a
  second send for the same `(candidate, type)` -- both enforced in code, not
  only via disabled buttons in the UI. Covered by
  `tests/unit/decide-and-send.test.ts`.

## Switching to live mode

1. Confirm a full dry-run send end to end (upload &rarr; score &rarr; draft
   &rarr; Advance & send invite) and check the email actually lands at
   `TEST_RECIPIENT` with the real recipient's address in the subject line.
2. Set `EMAIL_MODE=live` in the environment (Vercel project settings, or
   `.env.local` for local testing) and redeploy/restart.
3. The dashboard's top banner reflects the current mode on every page load
   -- confirm it reads **LIVE** before trusting a send to reach a real
   candidate.

## Deploying

Push this repo to GitHub, connect it as a Vercel project, and set the env
vars above in the Vercel project settings (never commit real values).
Deploy to a **preview** first and test a dry-run send there before
promoting to production.
