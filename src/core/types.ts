/**
 * The domain, in one file.
 *
 * Design note. A Claim and its Evidence are separate types joined by id rather
 * than a Claim owning an Evidence array. Two reasons that matter later:
 *
 *   1. Extraction and verification are different passes with different failure
 *      modes. Extraction can succeed while verification times out, and the UI
 *      should still be able to show the claims it found, marked pending.
 *   2. One piece of evidence can bear on several claims. Nesting would force a
 *      copy per claim and there would be no single place to correct it.
 */

/** Where a claim came from. Kept because provenance changes how much a reader
 *  should trust it: a claim in a PR title is an assertion by the author; a
 *  claim inside a code comment was likely written by the model itself. */
export type ClaimSource = 'pr_title' | 'pr_body' | 'code_comment' | 'doc_change'

export type Verdict =
  /** Something in this diff or repo demonstrably backs the claim. */
  | 'supported'
  /** Something in this diff or repo demonstrably conflicts with it. */
  | 'contradicted'
  /** Nothing found either way. THE DEFAULT. Absence of evidence is the normal
   *  state of an unreviewed claim, and the UI must not let it read as "fine". */
  | 'unsupported'
  /** Verification has not finished for this claim yet. */
  | 'pending'

export interface Claim {
  id: string
  /** The claim exactly as written, never paraphrased. A reviewer has to be able
   *  to find these words in the PR, or the tool has added a layer to audit. */
  text: string
  source: ClaimSource
  /** Where in the PR the text sits, for the "jump to source" affordance. */
  location: { file?: string; line?: number }
}

export interface Evidence {
  claimId: string
  verdict: Verdict
  /** Why the verdict is what it is, in one sentence a reviewer can check. */
  reason: string
  /** Places in the diff worth reading. For 'supported' and 'contradicted'
   *  these are the evidence and at least one is required. For 'unsupported'
   *  they are LEADS: lines that touch what the claim names without settling
   *  it. Anchors are where to look, never proof on their own. */
  anchors: DiffAnchor[]
  /** 0 to 1. Rendered as a coarse band, never as a number, because a decimal
   *  implies a precision this does not have. */
  confidence: number
}

/** A pointer into the parsed diff. Line numbers are post-image (the "new" side)
 *  except on pure deletions, where only the pre-image exists. */
export interface DiffAnchor {
  file: string
  startLine: number
  endLine: number
  side: 'new' | 'old'
}

export interface PullRequest {
  owner: string
  repo: string
  number: number
  title: string
  body: string
  url: string
  files: ChangedFile[]
}

export interface ChangedFile {
  path: string
  status: 'added' | 'modified' | 'removed' | 'renamed'
  additions: number
  deletions: number
  /** Unified diff text for this file. Absent for binary files and for files
   *  GitHub truncates on very large PRs, which is a case the UI must show
   *  rather than silently treat as "no changes". */
  patch?: string
}

export interface Analysis {
  pr: PullRequest
  claims: Claim[]
  evidence: Record<string, Evidence>
}
