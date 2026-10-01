-- Short AI-written "who this person is" summary of the CV, used as
-- interview notes on the Interviews tab. Generated from cv_text_redacted
-- like every other AI call, so the model still never sees the real name.
-- Per-candidate rather than per-rubric-variant: it describes the person,
-- not how they scored against a particular role.
alter table candidates add column resume_summary text;
