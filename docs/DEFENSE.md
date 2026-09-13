# Defense sheet

This repository invites specific questions. If you cannot answer one in your
own words, that part is not yours yet, and we rebuild it together until it is.

## Product

1. What is a claim, and what is not? Give an example of each from a real PR.
2. Why is `unsupported` the default rather than `supported`? What goes wrong in
   the other design?
3. Why does the tool quote claims verbatim instead of paraphrasing them?
4. Who is this for, and what do they do today instead?
5. What is the worst failure mode of this tool, and why is it that one?

## Architecture

6. Why are `Claim` and `Evidence` separate types joined by id, rather than a
   claim holding its evidence?
7. What happens when extraction succeeds and verification times out? Why does
   the UI still have something to show?
8. Why does `/api/pr` exist at all, rather than the browser calling GitHub?
9. What specifically stops a caller passing an arbitrary URL to your server and
   having it fetched?
10. Why is `truncated` surfaced to the user rather than handled silently?

## Verification

11. What is the invariant in `verify.test.ts` and why does it matter more than
    the other two tests?
12. Why is confidence rendered as a band rather than a number?
13. How do you know your verifier is not just agreeing with the PR? What would
    you measure to find out?

## Design

14. Why is `unsupported` the only warm colour in the palette?
15. Why are the tokens defined once and referenced by role instead of per
    component?
16. Show the keyboard path through the whole tool. Why those keys?
17. What did you cut, and why?

## The one they will actually ask

18. Tell me about a time you found a mistake in your own work.

You have the best possible answer to this and it is not this repository. It is
StreamLens: you published figures with no committed artifact behind them, found
that recall@100 was mathematically unable to exceed recall@10, wrote a
regression test that fails against the original code, and reconciled every
published number to a committed file. This tool exists because of that. Say it
in that order: the mistake, how you found it, the test, and then the tool.
