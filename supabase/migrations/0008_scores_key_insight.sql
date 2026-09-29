-- One sentence, generated alongside the scores, that explicitly weighs the
-- candidate's raw JD/experience fit against the pattern-based signal the
-- rubric is actually tuned on (Section 1: JD fit did not separate Exceeds
-- from Meets/Below -- the patterns did). Surfaced as a highlight on the
-- candidate card, distinct from the longer "why ranked here" reason text.
alter table scores add column key_insight text not null default '';
