import type { Claim, PullRequest } from './types'

/**
 * YOUR IMPLEMENTATION. Pull the factual claims out of a pull request.
 *
 * A claim is a statement that could be checked against the repository and found
 * true or false. "Adds a regression test for the empty case" is a claim.
 * "Refactors the parser" is not: there is no state of the world that makes it
 * false. Getting this boundary right is the whole product, because a tool that
 * lists twenty non-claims is worse than no tool.
 *
 * Contract:
 *   - `text` is verbatim from the PR. Never paraphrase, or a reviewer cannot
 *     find the words you are judging and now has to audit the tool as well.
 *   - `id` is stable for the same input, so re-running does not reshuffle the
 *     list under the reviewer's cursor.
 *   - Order is reading order: title, then body, then code comments by file.
 *
 * The test suite in extract.test.ts defines the behaviour. Make it pass.
 */
export function extractClaims(_pr: PullRequest): Claim[] {
  throw new Error('extractClaims is not implemented yet')
}
