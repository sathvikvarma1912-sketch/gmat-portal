# GMAT Practice Room

A one-page, GMAT-style timed practice portal.

- Load a question set as JSON (upload a file or paste it in)
- Take the section with exam rules: one question at a time, a running clock, bookmarks, and a review screen that allows up to 3 answer edits
- Get a report: score, accuracy by difficulty and topic, and time and right/wrong for every question. Copy it as JSON to hand back to Claude.

Everything is in `index.html`; there's no build step. It deploys to Vercel on every push to `main`: https://gmat-portal.vercel.app

## Cloud history

`api/sync.js` stores tests, finished attempts and the one in-progress section in a private Vercel Blob store (`BLOB_READ_WRITE_TOKEN`), so you can start on one device and pick up on another. The site sits behind Vercel Authentication, so only you can reach the data. If the API isn't reachable, the page keeps everything on the device, and **Export history / Import** move it by file.

## Two test modes (set by the JSON)

**Fixed** (default): every question in the file is served in order, e.g. 23 questions in 45 minutes. Data Sufficiency is allowed.

**Adaptive** (matches GMAT Quant): add `"mode": "adaptive"` and `"questionCount": 21`, and supply a larger pool (46 is ideal: 8 Easy, 15 Medium, 15 Hard, 8 Very Hard). The section starts at Medium. After each answer, an item-response model (3-parameter logistic, with difficulty `b` taken from the label or an optional per-question `"b"`) updates an ability estimate and serves the most informative unused question. It avoids repeating a subtopic back to back and picks at random among the top three. Results show an **unofficial** 60–90 estimate with a range, and apply the unanswered penalty (30 × share unanswered). GMAC's real item parameters and score conversion are not public, so the estimate is for practice only.
