import type { ChangedFile, DiffAnchor } from './types'

/**
 * A minimal unified-diff parser.
 *
 * Why not a library. GitHub's per-file `patch` is a fragment: it starts at the
 * first `@@` with no `diff --git` or `---/+++` header, and most parsers expect
 * a whole diff and quietly return zero files for a fragment. The format we
 * actually receive is four line shapes, so parsing it here is about thirty
 * lines and removes a dependency whose failure mode is silence.
 */

export interface DiffLine {
  file: string
  /** Line number on the side this line exists on. */
  line: number
  side: 'new' | 'old'
  kind: 'add' | 'del' | 'context'
  /** Line content with the leading +, - or space removed. */
  text: string
}

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

export function parsePatch(file: ChangedFile): DiffLine[] {
  if (!file.patch) return []
  const out: DiffLine[] = []
  let oldLine = 0
  let newLine = 0

  for (const raw of file.patch.split('\n')) {
    const hunk = HUNK.exec(raw)
    if (hunk) {
      oldLine = Number(hunk[1])
      newLine = Number(hunk[2])
      continue
    }
    // "\ No newline at end of file" is metadata, not content, and counting it
    // as a line shifts every subsequent line number by one.
    if (raw.startsWith('\\')) continue

    const marker = raw[0]
    const text = raw.slice(1)
    if (marker === '+') {
      out.push({ file: file.path, line: newLine++, side: 'new', kind: 'add', text })
    } else if (marker === '-') {
      out.push({ file: file.path, line: oldLine++, side: 'old', kind: 'del', text })
    } else if (marker === ' ' || raw === '') {
      out.push({ file: file.path, line: newLine, side: 'new', kind: 'context', text })
      oldLine++
      newLine++
    }
  }
  return out
}

export function parseAll(files: ChangedFile[]): DiffLine[] {
  return files.flatMap(parsePatch)
}

/** Collapse adjacent matching lines in the same file into one anchor, so a
 *  reviewer gets one region to look at rather than nine consecutive links. */
export function toAnchors(lines: DiffLine[]): DiffAnchor[] {
  const anchors: DiffAnchor[] = []
  for (const l of lines) {
    const last = anchors[anchors.length - 1]
    if (last && last.file === l.file && last.side === l.side && l.line <= last.endLine + 2) {
      last.endLine = Math.max(last.endLine, l.line)
    } else {
      anchors.push({ file: l.file, startLine: l.line, endLine: l.line, side: l.side })
    }
  }
  return anchors
}

export const isTestPath = (p: string) =>
  /(^|\/)(tests?|__tests__|spec)\//i.test(p) || /\.(test|spec)\.[jt]sx?$|_test\.py$|test_.*\.py$/i.test(p)
