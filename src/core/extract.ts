import type { Claim, ClaimSource, PullRequest } from './types'
import { parsePatch } from './diff'

/**
 * Pull the checkable claims out of a pull request.
 *
 * A claim is a statement that some state of the repository could make false.
 * "Adds a regression test for the empty case" is a claim: either such a test is
 * in the diff or it is not. "Refactors the parser for clarity" is not: no state
 * of the world makes it false, so listing it would waste the reviewer's
 * attention on something they cannot check.
 *
 * The rule, deliberately simple: a sentence is a claim when it contains at
 * least one VERIFIABLE ANCHOR, which is a number, a code identifier, or one of
 * a closed list of concrete engineering nouns.
 *
 * Why a rule and not a model. Two reasons, and both are the point of the
 * project rather than a shortcut:
 *
 *   1. It is a baseline. A model pass can be added later, but without a
 *      deterministic control there is no way to say whether the model improved
 *      anything. Adding the clever thing first and never measuring it is the
 *      habit this whole tool exists to argue against.
 *   2. It is inspectable. A reviewer who disagrees with an extraction can read
 *      the rule that produced it. "The model said so" is not reviewable, and a
 *      tool for checking claims cannot itself make unfalsifiable ones.
 *
 * Known cost: this under-extracts. A claim phrased entirely in prose ("the
 * empty case is now handled") has no anchor and is missed. That is the right
 * direction to fail, because a missed claim leaves the reviewer where they
 * already were, while a false claim sends them hunting for evidence of
 * something nobody asserted.
 */

/** Concrete nouns that name something a diff can contain. Closed on purpose:
 *  every addition widens what counts as a claim and should be argued for. */
const MECHANISM = [
  'test', 'tests', 'timeout', 'retry', 'retries', 'backoff', 'cache', 'caching',
  'index', 'endpoint', 'route', 'migration', 'flag', 'log', 'logging', 'metric',
  'metrics', 'lock', 'queue', 'schema', 'validation', 'validator', 'fallback',
  'limit', 'checkpoint', 'guard', 'assertion', 'fixture', 'benchmark', 'latency',
  'throughput', 'regression',
]

const NUMBER = /\b\d+(?:\.\d+)?\s?(?:%|ms|s\b|x\b|gb|mb|kb)?/i
const BACKTICKED = /`[^`]+`/
const PATHLIKE = /\b[\w./-]+\.(?:ts|tsx|js|jsx|py|go|rs|java|rb|md|json|ya?ml|toml|sql)\b/i
const SNAKE_OR_CALL = /\b\w+_\w+\b|\b\w+\(\)/

function hasAnchor(sentence: string): boolean {
  const s = sentence.toLowerCase()
  if (NUMBER.test(sentence)) return true
  if (BACKTICKED.test(sentence)) return true
  if (PATHLIKE.test(sentence)) return true
  if (SNAKE_OR_CALL.test(sentence)) return true
  return MECHANISM.some((w) => new RegExp(`\\b${w}\\b`).test(s))
}

/** Split prose into sentences, keeping terminal punctuation so a claim can be
 *  quoted back exactly as written. Markdown list items and line breaks are
 *  sentence boundaries too: PR bodies are written as bullets far more often
 *  than as paragraphs. */
function sentences(text: string): string[] {
  const prose: string[] = []
  let inFence = false

  for (const raw of text.split('\n')) {
    // Fence state has to be tracked, not just detected. Skipping lines that
    // START with ``` leaves every line BETWEEN the fences looking like prose,
    // and a line of code is full of identifiers, so it sails through the
    // anchor test and arrives in the reviewer's list as a claim.
    if (raw.trimStart().startsWith('```')) { inFence = !inFence; continue }
    if (inFence) continue

    const line = raw.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').trim()
    if (!line || line.startsWith('#') || line.startsWith('>')) continue
    // An indented block is code in Markdown, for the same reason as a fence.
    if (/^ {4}|^\t/.test(raw)) continue
    prose.push(line)
  }

  return prose
    .flatMap((l) => l.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter(Boolean)
}

/** FNV-1a. Stable across runs and processes, which `Math.random` and object
 *  identity are not, so re-running does not reshuffle the list under the
 *  reviewer's cursor mid-review. */
function id(source: string, text: string): string {
  let h = 0x811c9dc5
  for (const ch of `${source}:${text}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** A comment line in a diff, with its marker stripped. */
const COMMENT = /^\s*(?:\/\/+|#|\*|--)\s?(.*)$/

export function extractClaims(pr: PullRequest): Claim[] {
  const claims: Claim[] = []
  const seen = new Set<string>()

  const push = (text: string, source: ClaimSource, location: Claim['location'] = {}) => {
    if (!hasAnchor(text)) return
    const key = id(source, text)
    if (seen.has(key)) return // the same sentence in title and body is one claim
    seen.add(key)
    claims.push({ id: key, text, source, location })
  }

  // Reading order: title, then body, then code comments file by file. The order
  // is part of the contract because the UI renders the list in it, and a
  // reviewer reads a PR top to bottom.
  for (const s of sentences(pr.title)) push(s, 'pr_title')
  for (const s of sentences(pr.body)) push(s, 'pr_body')

  for (const file of pr.files) {
    const isDoc = /\.(md|mdx|rst|txt)$/i.test(file.path)
    for (const line of parsePatch(file)) {
      if (line.kind !== 'add') continue
      if (isDoc) {
        for (const s of sentences(line.text)) push(s, 'doc_change', { file: file.path, line: line.line })
      } else {
        const m = COMMENT.exec(line.text)
        if (!m?.[1]) continue
        for (const s of sentences(m[1])) push(s, 'code_comment', { file: file.path, line: line.line })
      }
    }
  }

  return claims
}
