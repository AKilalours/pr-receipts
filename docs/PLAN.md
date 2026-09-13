# Two-week plan

Rule for the whole fortnight: **one screen, finished**, beats five screens
sketched. Every time you are tempted to add a feature, add polish instead.

## Week 1 — make it work

| Day | Build | Done when |
|---|---|---|
| 1 | Wire `/api/pr` to a local dev handler. Paste a PR URL, log the JSON. | A real PR's title, body and file list appear in the console. |
| 2 | Parse patches with `parse-diff`. Render one file's hunks with add/delete colouring and line numbers. | A real diff renders and is readable. |
| 3 | `extractClaims`. Make `extract.test.ts` pass. | 5 of 5 green. |
| 4 | Claim list UI. Verdict chip, source label, count by verdict. | Claims from a real PR list on the left. |
| 5 | `verifyClaims`. Make `verify.test.ts` pass. Click a claim, its anchor hunk scrolls into view and highlights. | 3 of 3 green, and clicking works. |

End of week 1 you have a working tool that looks unfinished. That is correct.

## Week 2 — make it good

| Day | Build | Done when |
|---|---|---|
| 6 | Widen the test suites. Add the cases that broke on real PRs during week 1. | Tests encode every bug you hit. |
| 7 | Every non-happy state: loading, empty, network error, rate limited, truncated file list, binary file, PR with no claims. | You cannot reach a blank screen by any path. |
| 8 | **Design pass one**: type scale, spacing rhythm, alignment, density. Nothing new, only what is there made right. | A screenshot you would show someone. |
| 9 | **Design pass two**: keyboard navigation (j/k through claims, enter to jump), focus states, dark mode check, 400px width check. | Usable without a mouse, correct in both themes. |
| 10 | Deploy to Vercel. README with the design rationale. Short demo GIF. | A stranger can use it from the link alone. |

## What is deliberately not in scope

Accounts. A database. Multi-PR history. Inline commenting. GitHub App
installation. Every one of these is a week and none of them demonstrate
anything the two passes above do not.
