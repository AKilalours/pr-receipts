# pr-receipts

**Where are the receipts?** A reviewer's view of an AI-generated pull request
that separates what the PR *claims* from what the diff actually *shows*.

Paste a GitHub pull request URL. The tool pulls out every checkable claim the PR
makes, in the PR's own words, and for each one tells you whether anything in the
diff backs it up, contradicts it, or says nothing at all.

## Why

Reviewing machine-written pull requests is a different job from reviewing
human-written ones. The prose is fluent and confident whether or not the code
does what it says, so the usual reviewer's instinct, which is to skim the
description and spot-check the diff, fails in a specific way: you end up
agreeing with the summary.

I hit the same failure in my own work. A retrieval project of mine published a
recall figure that was mathematically unable to exceed another metric it was
supposed to dominate. The number had been computed, written into a README, and
read by me several times. Nobody had checked it against its own definition. The
fix was a four-line change; the lesson was that a claim and its evidence have to
sit next to each other or the claim wins by default.

That is the whole design brief here.

## The one rule

**`unsupported` is the default and every other verdict has to earn its way off
it.** A verifier that starts from "probably fine" and looks for reasons to doubt
will agree with the PR nearly every time, which is the exact failure this tool
exists to prevent. So no claim is marked supported or contradicted without an
anchor: a file and line range the reviewer can go and look at. That invariant is
asserted in `src/core/verify.test.ts`.

## Design decisions

- **Claims are quoted verbatim, never paraphrased.** If the tool rewords a
  claim, a reviewer has to audit the tool as well as the PR.
- **Supported is the only quiet colour in the palette.** A claim that checks out
  needs nothing from the reader. The two verdicts that need attention are warm,
  and unsupported is amber rather than red because it is the default state of an
  unreviewed claim, not an error: colour the common case red and people learn to
  ignore red.
- **Confidence renders as a band, not a number.** A decimal implies a precision
  this does not have.
- **`Claim` and `Evidence` are separate types joined by id.** Extraction and
  verification are separate passes with separate failure modes, so when
  verification times out the UI can still show the claims it found.
- **The GitHub token lives in a serverless function.** A token in client code is
  a token in the bundle. The PR URL is parsed and validated to three fields
  before anything reaches GitHub, so the endpoint cannot be used as a fetch
  proxy for an arbitrary host.
- **Truncation is shown, not swallowed.** GitHub caps the files endpoint at 300.
  A reviewer shown 300 of 900 files without being told will trust a verdict the
  tool could not reach.

## Run it

Node 20.19 or newer. Vite 8 builds with rolldown, which uses `styleText` from
`node:util`, added in Node 20.12, so Node 18 fails at startup with a
`SyntaxError` about a missing export rather than a version message. `.nvmrc`
and the `engines` field are there so the requirement is stated rather than
discovered.

```bash
nvm use                # reads .nvmrc
npm install
npm run dev            # http://localhost:5173
npm test               # vitest
```

`GITHUB_TOKEN` is optional. Without it you get GitHub's anonymous limit of 60
requests an hour; with it, 5000. It is read only on the server.

## What a verdict means

| Verdict | Requires | Example |
|---|---|---|
| **Supported** | A structural signal, plus at least one anchor | Lines added under a test path, for a claim about a test. A figure that literally appears in a committed line. |
| **Contradicted** | The diff moving opposite to the claim | "Removes the retry" while the diff only adds lines containing it. |
| **Unsupported** | The default. No structural signal found. | Everything else, including claims whose subject the diff merely *mentions*. |

That last row is the important one. If a claim names `pendingState` and the diff
touches `pendingState`, the tool shows you those lines and still says
unsupported, because a word appearing in a changed line says nothing about
whether the sentence around it is true. Treating co-occurrence as proof is the
error this tool exists to catch, so it must not commit it itself.

## Status

Working end to end. 18 tests. Verified against real pull requests in
`facebook/react` and `vitejs/vite`.

Open: an optional model-backed extraction pass, to be measured against the
deterministic baseline rather than assumed better than it. See `docs/PLAN.md`.
