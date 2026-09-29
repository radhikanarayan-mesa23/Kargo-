# Previously-contacted seed

`previously_contacted.csv` seeds the pinned "previously contacted" list at
the top of the dashboard -- the 2 August candidates who got a "let's chat"
reply and should be flagged so Arjun doesn't lose track of them across the
new pipeline.

Fill in one row per person: `name,email,note` (note is optional -- free text
like "let's chat reply, 2 Aug"). The header row must stay as the first line.
The list only ever reads this file; nothing in the app writes to it.
