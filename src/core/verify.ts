import type { Claim, Evidence, PullRequest } from './types'

/**
 * YOUR IMPLEMENTATION. Decide what the diff says about each claim.
 *
 * The rule that defines this tool: `unsupported` is the default and you must
 * justify moving off it. Not the other way round. A verifier that starts from
 * "probably fine" and looks for reasons to doubt will agree with the PR almost
 * every time, which is exactly the failure this tool exists to prevent.
 *
 * So: start every claim at `unsupported` with an empty `anchors` array, and
 * only move it when you can name the hunk that justifies the move. If you
 * cannot point at a hunk, the verdict does not change. That invariant is
 * asserted in verify.test.ts and it is the first thing an interviewer will
 * press you on, so be ready to defend it.
 */
export function verifyClaims(_pr: PullRequest, _claims: Claim[]): Record<string, Evidence> {
  throw new Error('verifyClaims is not implemented yet')
}
