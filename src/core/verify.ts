import type { Claim, Evidence, PullRequest, Verdict } from './types'
import { parseAll, toAnchors, isTestPath, type DiffLine } from './diff'

/**
 * Decide what the diff says about each claim.
 *
 * THE RULE THIS TOOL IS BUILT ON. Every claim starts at `unsupported` with no
 * anchors, and only moves when a specific line in the diff justifies moving it.
 * Not the other way round.
 *
 * A verifier that starts at "probably fine" and hunts for reasons to doubt will
 * agree with the pull request nearly every time, because agreement is the cheap
 * path and confident prose is persuasive. That is precisely the failure mode of
 * reviewing machine-written code, so the tool has to be built against it rather
 * than reproduce it.
 *
 * The consequence, asserted in verify.test.ts: no verdict other than
 * `unsupported` or `pending` may be returned with an empty anchor list. A
 * verdict a reviewer cannot go and look at is an opinion, and this tool does
 * not deal in opinions.
 */

const MECHANISM = [
  'test', 'tests', 'timeout', 'retry', 'retries', 'backoff', 'cache', 'caching',
  'index', 'endpoint', 'route', 'migration', 'flag', 'log', 'logging', 'metric',
  'metrics', 'lock', 'queue', 'schema', 'validation', 'validator', 'fallback',
  'limit', 'checkpoint', 'guard', 'assertion', 'fixture', 'benchmark',
]

const ADDITIVE = /\b(add|adds|added|adding|introduce[sd]?|implement(s|ed)?|create[sd]?)\b/i
const SUBTRACTIVE = /\b(remove[sd]?|delete[sd]?|drop(s|ped)?|deprecate[sd]?|strip(s|ped)?)\b/i

/** Literal tokens a reviewer could grep for. Ordered strongest first: an
 *  identifier the author typed in backticks is a far better search key than a
 *  common noun like "cache". */
function searchTerms(text: string): string[] {
  const terms: string[] = []
  for (const m of text.matchAll(/`([^`]+)`/g)) terms.push(m[1])
  for (const m of text.matchAll(/\b[\w./-]+\.(?:ts|tsx|js|jsx|py|go|rs|java|rb|md|json|ya?ml|toml|sql)\b/gi)) terms.push(m[0])
  for (const m of text.matchAll(/\b\w+_\w+\b|\b\w+(?=\(\))/g)) terms.push(m[0])
  const lower = text.toLowerCase()
  for (const w of MECHANISM) if (new RegExp(`\\b${w}\\b`).test(lower)) terms.push(w)
  return [...new Set(terms)]
}

/** Numbers are measurement assertions and get the strictest rule in the file.
 *  "Cuts p99 latency by 40%" is supported only if 40% is written into a file
 *  this diff commits. A number that exists solely in a pull request description
 *  is a number nobody can reproduce, which is the exact defect this tool was
 *  built after hitting. */
function numericTokens(text: string): string[] {
  // Strip the numbers that are identifiers rather than measurements: issue and
  // pull request references (#22304), and anything inside a URL. Calling those
  // "figures asserted here" is wrong in a way a reader will notice immediately,
  // and a tool about unwarranted claims cannot afford to make one in its own
  // explanation text.
  const prose = text
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/#\d+/g, ' ')
    .replace(/\bv?\d+(?:\.\d+){2,}\b/g, ' ') // semver
  return [...prose.matchAll(/\b\d+(?:\.\d+)?\s?(?:%|ms|s|x|gb|mb|kb)?\b/gi)].map((m) => m[0].trim())
}

const matches = (lines: DiffLine[], term: string, kind: 'add' | 'del') => {
  const needle = term.toLowerCase()
  return lines.filter((l) => l.kind === kind && l.text.toLowerCase().includes(needle))
}

export function verifyClaims(pr: PullRequest, claims: Claim[]): Record<string, Evidence> {
  const lines = parseAll(pr.files)
  const out: Record<string, Evidence> = {}

  for (const claim of claims) {
    // The starting position for every claim, without exception.
    let verdict: Verdict = 'unsupported'
    let reason = 'Nothing in this diff mentions it either way.'
    let anchors: Evidence['anchors'] = []
    let confidence = 0

    const numbers = numericTokens(claim.text)
    const terms = searchTerms(claim.text)

    // 1. Measurements. Strictest rule, checked first, and it can only ever
    //    support: a number absent from the diff proves nothing, it just leaves
    //    the claim where it started.
    if (numbers.length) {
      const hits = numbers.flatMap((n) => matches(lines, n, 'add'))
      if (hits.length) {
        verdict = 'supported'
        reason = `The figure ${numbers[0]} appears in a line this pull request adds.`
        anchors = toAnchors(hits)
        confidence = 0.9
      } else {
        reason = `The figure ${numbers[0]} is asserted here but is not written into any file this diff changes, so nothing committed reproduces it.`
        confidence = 0.8
      }
    }

    // 2. Tests. A claim about a test is checkable structurally: did any line
    //    get added under a test path?
    if (verdict === 'unsupported' && /\b(test|tests|regression|spec|coverage)\b/i.test(claim.text)) {
      const added = lines.filter((l) => l.kind === 'add' && isTestPath(l.file))
      if (added.length) {
        verdict = 'supported'
        reason = `${added.length} line${added.length === 1 ? '' : 's'} added under a test path.`
        anchors = toAnchors(added)
        confidence = 0.7
      } else {
        reason = 'Claims a test, but this diff adds no lines under any test path.'
        confidence = 0.75
      }
    }

    // 3. Named things. Direction matters: a claim that something was ADDED is
    //    contradicted when the term appears only on removed lines, and the
    //    reverse for removal claims. This is the only path to `contradicted`.
    if (verdict === 'unsupported' && terms.length) {
      for (const term of terms) {
        const added = matches(lines, term, 'add')
        const deleted = matches(lines, term, 'del')

        if (SUBTRACTIVE.test(claim.text) && added.length && !deleted.length) {
          verdict = 'contradicted'
          reason = `Claims ${term} was removed, but this diff adds lines containing it and removes none.`
          anchors = toAnchors(added)
          confidence = 0.6
          break
        }
        if (ADDITIVE.test(claim.text) && deleted.length && !added.length) {
          verdict = 'contradicted'
          reason = `Claims ${term} was added, but this diff only removes lines containing it.`
          anchors = toAnchors(deleted)
          confidence = 0.6
          break
        }
        if (added.length) {
          // A LEAD, NOT EVIDENCE. The diff touches something this claim names,
          // which is worth showing the reviewer, but the word appearing in a
          // changed line says nothing about whether the sentence around it is
          // true. Marking this 'supported' would be the tool committing the
          // exact error it exists to catch: treating co-occurrence as proof.
          // So the verdict stays where it started and the reviewer gets a
          // place to look rather than a conclusion to trust.
          reason = `This diff touches ${term}, but nothing here confirms what the claim says about it. Worth reading yourself.`
          anchors = toAnchors(added)
          confidence = 0.3
          break
        }
      }
    }

    out[claim.id] = enforceAnchorInvariant({
      claimId: claim.id, verdict, reason, anchors, confidence,
    })
  }

  return out
}

/**
 * The invariant, enforced rather than assumed.
 *
 * Every rule above is supposed to set anchors whenever it moves a verdict off
 * `unsupported`. This is the net under that: if any rule ever fails to, the
 * verdict goes back rather than shipping a conclusion the reviewer cannot go
 * and inspect. Exported so it can be tested on its own, because a safety net
 * nobody tests is a safety net nobody knows is there.
 */
export function enforceAnchorInvariant(e: Evidence): Evidence {
  const needsAnchor: Verdict[] = ['supported', 'contradicted']
  if (needsAnchor.includes(e.verdict) && e.anchors.length === 0) {
    return {
      ...e,
      verdict: 'unsupported',
      reason: 'A rule matched but produced no line to point at, so the claim stays unverified.',
      confidence: 0,
    }
  }
  return e
}
