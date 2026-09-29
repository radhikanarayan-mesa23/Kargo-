# Calibration fixtures

`scripts/calibrate.ts` scores the 8 files in this folder and checks that
every Exceeds-rated past hire outscores every Meets/Below-rated one on the
rubric's role-agnostic (C1/C2/C3/C5) scale, per the plan's Checkpoint B.

The 8 `.txt` files here are **synthetic** — short CV-style snippets
reconstructed solely from the bullet points the rubric itself discloses in
Section 1 ("What the past hires actually show"). They are not real CVs and
were never uploaded through the dashboard; nothing beyond what Section 1
already states is invented.

If you have the actual 8 past-hire CVs (or de-identified profiles) and want
a tighter calibration, replace these files with real ones — named the same
way (`<name>.txt`) so `scripts/calibrate.ts` picks them up automatically.
Do **not** put a real candidate's uploaded resume here; this folder is only
for the historical calibration set.
