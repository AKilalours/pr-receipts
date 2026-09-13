import type { Verdict } from '../core/types'

export const VERDICT_LABEL: Record<Verdict, string> = {
  contradicted: 'Contradicted',
  unsupported: 'Unsupported',
  supported: 'Supported',
  pending: 'Checking',
}

/** Worst first. A contradiction is rarer and more serious than an absence, so
 *  it outranks it, but unsupported still sits above supported: the whole point
 *  is that the reviewer's attention goes to what has nothing behind it. */
export const VERDICT_RANK: Record<Verdict, number> = {
  contradicted: 0, unsupported: 1, pending: 2, supported: 3,
}

export const VERDICT_STYLE: Record<Verdict, { dot: string; chip: string; text: string }> = {
  contradicted: { dot: 'bg-contradicted', chip: 'bg-contradicted-bg text-contradicted', text: 'text-contradicted' },
  unsupported:  { dot: 'bg-unsupported',  chip: 'bg-unsupported-bg text-unsupported',   text: 'text-unsupported' },
  supported:    { dot: 'bg-supported',    chip: 'bg-supported-bg text-supported',       text: 'text-supported' },
  pending:      { dot: 'bg-ink-faint',    chip: 'bg-surface-sunk text-ink-soft',        text: 'text-ink-soft' },
}

export const SOURCE_LABEL = {
  pr_title: 'title', pr_body: 'description', code_comment: 'code comment', doc_change: 'docs',
} as const

/** Confidence as one of three bands, never as a number. A decimal implies a
 *  precision these rules do not have, and a reviewer who sees 0.55 will reason
 *  about the second digit. */
export function band(c: number): 'low' | 'medium' | 'high' {
  return c >= 0.8 ? 'high' : c >= 0.6 ? 'medium' : 'low'
}
