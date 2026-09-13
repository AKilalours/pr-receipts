import { useEffect, useRef } from 'react'
import type { ChangedFile, DiffAnchor } from '../core/types'
import { parsePatch } from '../core/diff'

interface Props {
  files: ChangedFile[]
  anchors: DiffAnchor[]
  /** Changes when the reader presses enter, to re-scroll to the same claim. */
  jump?: number
  /** Ring colour for the highlighted lines, from the verdict being shown.
   *  Hardcoding amber here meant evidence FOR a supported claim was ringed in
   *  the unsupported colour, which tells the reader the opposite of the truth
   *  in the one place they are looking hardest. */
  ring?: string
}

const inAnchor = (anchors: DiffAnchor[], file: string, line: number, side: string) =>
  anchors.some((a) => a.file === file && a.side === side && line >= a.startLine && line <= a.endLine)

export function DiffPane({ files, anchors, jump, ring = 'ring-ink-faint/70' }: Props) {
  const firstHit = useRef<HTMLDivElement>(null)

  // Move the reader to the evidence rather than making them find it. 'center'
  // rather than 'start' so the surrounding lines come with it: a highlighted
  // line pinned to the top of the pane has lost the context that makes it
  // mean anything.
  useEffect(() => {
    firstHit.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [anchors, jump])

  const anchored = new Set(anchors.map((a) => a.file))
  const shown = anchors.length ? files.filter((f) => anchored.has(f.path)) : files
  let seenFirst = false

  if (!shown.length) {
    return <Empty>This pull request changes no files with readable text.</Empty>
  }

  return (
    <div className="font-mono text-[12px] leading-[1.55]">
      {/* Say it, rather than showing an unhighlighted diff and letting the
          reader assume it is the evidence. A claim with nothing to point at is
          the tool's most common answer, and silently rendering the whole diff
          underneath it invites exactly the inference the tool exists to
          prevent. */}
      {!anchors.length && (
        <p className="border-b border-line bg-surface-sunk px-4 py-2.5 font-sans text-[12.5px] text-ink-soft">
          Nothing in this diff points at that claim. Showing every changed file, unmarked.
        </p>
      )}
      {shown.map((file) => {
        const lines = parsePatch(file)
        return (
          <section key={file.path} className="mb-5">
            <header className="sticky top-0 z-10 flex items-baseline gap-2 border-y border-line bg-surface-sunk px-4 py-2 font-sans">
              <span className="truncate text-[12.5px] text-ink">{file.path}</span>
              <span className="shrink-0 text-[11px] text-supported">+{file.additions}</span>
              <span className="shrink-0 text-[11px] text-contradicted">&minus;{file.deletions}</span>
            </header>

            {!file.patch ? (
              <p className="px-4 py-3 font-sans text-[12.5px] text-ink-soft">
                No text diff. GitHub omits patches for binary files and for very large ones.
              </p>
            ) : (
              lines.map((l, i) => {
                const hit = inAnchor(anchors, l.file, l.line, l.side)
                const isFirst = hit && !seenFirst
                if (isFirst) seenFirst = true
                return (
                  <div
                    key={i}
                    ref={isFirst ? firstHit : undefined}
                    className={`flex ${
                      l.kind === 'add' ? 'bg-add-bg' : l.kind === 'del' ? 'bg-del-bg' : ''
                    } ${hit ? `ring-1 ring-inset ${ring}` : ''}`}
                  >
                    <span className="w-12 shrink-0 select-none pr-2 text-right text-ink-faint tabular-nums">
                      {l.line}
                    </span>
                    <span className="w-3 shrink-0 select-none text-ink-faint">
                      {l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' '}
                    </span>
                    <code className="whitespace-pre-wrap break-all pr-4">{l.text || ' '}</code>
                  </div>
                )
              })
            )}
          </section>
        )
      })}
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <p className="max-w-sm text-center text-[13px] leading-relaxed text-ink-soft">{children}</p>
    </div>
  )
}
