import type { Claim, Evidence } from '../core/types'
import { VERDICT_LABEL, VERDICT_RANK, VERDICT_STYLE, SOURCE_LABEL, band } from './verdict'

interface Props {
  claims: Claim[]
  evidence: Record<string, Evidence>
  selectedId: string | null
  onSelect: (id: string) => void
}

export function ClaimList({ claims, evidence, selectedId, onSelect }: Props) {
  // Worst first. The reading order the extractor preserved is the PR's order;
  // this is the reviewer's order, and they are not the same thing. A reviewer
  // with ten minutes should spend them on the claims with nothing behind them.
  const sorted = [...claims].sort(
    (a, b) => VERDICT_RANK[evidence[a.id]?.verdict ?? 'pending'] - VERDICT_RANK[evidence[b.id]?.verdict ?? 'pending'],
  )

  return (
    <ul className="divide-y divide-line" role="listbox" aria-label="Claims">
      {sorted.map((claim) => {
        const ev = evidence[claim.id]
        const verdict = ev?.verdict ?? 'pending'
        const style = VERDICT_STYLE[verdict]
        const selected = claim.id === selectedId

        return (
          <li key={claim.id}>
            <button
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(claim.id)}
              className={`w-full px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-faint ${
                selected ? 'bg-surface-sunk' : 'hover:bg-surface-sunk/60'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${style.dot}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  {/* Verbatim, and styled as a quotation so it reads as the PR
                      speaking rather than the tool. */}
                  <p className="text-[13px] leading-snug text-ink">{claim.text}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-faint">
                    <span className={`rounded px-1.5 py-0.5 font-medium ${style.chip}`}>
                      {VERDICT_LABEL[verdict]}
                    </span>
                    <span>{SOURCE_LABEL[claim.source]}</span>
                    {ev && verdict !== 'unsupported' && <span>{band(ev.confidence)} confidence</span>}
                    {ev?.anchors.length ? (
                      <span>
                        {ev.anchors.length} place{ev.anchors.length === 1 ? '' : 's'} to look
                      </span>
                    ) : null}
                  </div>
                  {ev && (
                    <p className="mt-1.5 text-[11.5px] leading-snug text-ink-soft">{ev.reason}</p>
                  )}
                </div>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
