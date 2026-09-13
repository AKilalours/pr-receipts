import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Analysis, PullRequest, Verdict } from './core/types'
import { extractClaims } from './core/extract'
import { verifyClaims } from './core/verify'
import { ClaimList } from './ui/ClaimList'
import { DiffPane, Empty } from './ui/DiffPane'
import { VERDICT_LABEL, VERDICT_RANK, VERDICT_STYLE } from './ui/verdict'

// Chosen because it exercises all three states: two claims supported by lines
// added under a test path, and one the diff says nothing about.
const EXAMPLE = 'https://github.com/vitejs/vite/pull/23157'

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; analysis: Analysis; truncated: boolean }

export default function App() {
  const [url, setUrl] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const analyse = useCallback(async (target: string) => {
    setState({ kind: 'loading' })
    setSelectedId(null)
    try {
      const res = await fetch(`/api/pr?url=${encodeURIComponent(target)}`)
      const data = await res.json()
      if (!res.ok) return setState({ kind: 'error', message: data.error ?? `Request failed (${res.status})` })

      const pr = data as PullRequest & { truncated: boolean }
      const claims = extractClaims(pr)
      setState({
        kind: 'ready',
        truncated: pr.truncated,
        analysis: { pr, claims, evidence: verifyClaims(pr, claims) },
      })
    } catch {
      // A thrown fetch is a transport problem, not an API response. Saying
      // "check your connection" for a 500 sends people to the wrong place, so
      // the two cases get different sentences.
      setState({ kind: 'error', message: 'Could not reach the server. Check your connection and try again.' })
    }
  }, [])

  const ordered = useMemo(() => {
    if (state.kind !== 'ready') return []
    const { claims, evidence } = state.analysis
    return [...claims].sort(
      (a, b) => VERDICT_RANK[evidence[a.id]?.verdict ?? 'pending'] - VERDICT_RANK[evidence[b.id]?.verdict ?? 'pending'],
    )
  }, [state])

  // Keyboard. A reviewer moving through twenty claims should not have to reach
  // for the mouse twenty times, and j/k is the motion anyone who reviews code
  // already has in their fingers.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = document.activeElement === input.current
      if (e.key === '/' && !typing) { e.preventDefault(); input.current?.focus(); return }
      if (e.key === 'Escape' && typing) { input.current?.blur(); return }
      if (typing || !ordered.length) return
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); move(1) }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    }
    const move = (d: number) => {
      const i = ordered.findIndex((c) => c.id === selectedId)
      const next = i === -1 ? (d > 0 ? 0 : ordered.length - 1) : Math.min(Math.max(i + d, 0), ordered.length - 1)
      setSelectedId(ordered[next].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ordered, selectedId])

  const anchors = state.kind === 'ready' && selectedId ? state.analysis.evidence[selectedId]?.anchors ?? [] : []

  return (
    <div className="flex h-dvh flex-col bg-canvas text-ink">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <h1 className="text-[13px] font-semibold tracking-tight">
          pr<span className="text-ink-faint">-</span>receipts
        </h1>
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); if (url.trim()) analyse(url.trim()) }}
        >
          <input
            ref={input}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo/pull/123"
            aria-label="GitHub pull request URL"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-1.5 text-[13px] placeholder:text-ink-faint focus:border-ink-faint focus:outline-none"
          />
          <button
            type="submit"
            disabled={!url.trim() || state.kind === 'loading'}
            className="shrink-0 rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-medium text-canvas disabled:opacity-40"
          >
            {state.kind === 'loading' ? 'Checking' : 'Check'}
          </button>
        </form>
      </header>

      {state.kind === 'idle' && (
        <Landing onExample={() => { setUrl(EXAMPLE); analyse(EXAMPLE) }} />
      )}

      {state.kind === 'loading' && <Skeleton />}

      {state.kind === 'error' && (
        <Empty>
          <span className="text-contradicted">{state.message}</span>
        </Empty>
      )}

      {state.kind === 'ready' && (
        <>
          {state.truncated && (
            <p className="shrink-0 border-b border-line bg-unsupported-bg px-4 py-2 text-[12px] text-unsupported">
              GitHub returned only the first 300 changed files. Claims about anything outside them cannot be checked here.
            </p>
          )}
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <aside className="flex min-h-0 shrink-0 flex-col border-line md:w-[400px] md:border-r">
              <Summary analysis={state.analysis} />
              {state.analysis.claims.length ? (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <ClaimList
                    claims={state.analysis.claims}
                    evidence={state.analysis.evidence}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                </div>
              ) : (
                <Empty>
                  No checkable claims found. This pull request describes what it does without asserting anything a diff could confirm or deny.
                </Empty>
              )}
            </aside>

            <main className="min-h-0 flex-1 overflow-y-auto bg-surface">
              {selectedId ? (
                <DiffPane files={state.analysis.pr.files} anchors={anchors} />
              ) : (
                <Empty>Select a claim to see what the diff says about it. Use j and k to move, / to search another pull request.</Empty>
              )}
            </main>
          </div>
        </>
      )}
    </div>
  )
}

function Summary({ analysis }: { analysis: Analysis }) {
  const counts = { contradicted: 0, unsupported: 0, supported: 0, pending: 0 } as Record<Verdict, number>
  for (const e of Object.values(analysis.evidence)) counts[e.verdict]++

  return (
    <div className="shrink-0 border-b border-line px-4 py-3">
      <a
        href={analysis.pr.url}
        target="_blank"
        rel="noreferrer"
        className="line-clamp-2 text-[13px] font-medium leading-snug underline-offset-2 hover:underline"
      >
        {analysis.pr.title}
      </a>
      <p className="mt-0.5 text-[11.5px] text-ink-faint">
        {analysis.pr.owner}/{analysis.pr.repo} #{analysis.pr.number}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px]">
        {(['contradicted', 'unsupported', 'supported'] as const).map((v) =>
          counts[v] ? (
            <span key={v} className={`flex items-center gap-1.5 ${VERDICT_STYLE[v].text}`}>
              <span className={`size-1.5 rounded-full ${VERDICT_STYLE[v].dot}`} aria-hidden />
              {counts[v]} {VERDICT_LABEL[v].toLowerCase()}
            </span>
          ) : null,
        )}
      </div>
    </div>
  )
}

function Landing({ onExample }: { onExample: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-[15px] leading-relaxed text-ink">
          Paste a pull request. See every claim it makes, and what the diff actually shows.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
          Claims start as <span className="text-unsupported">unsupported</span> and have to earn their way off it.
          Nothing is marked supported without a line you can go and read.
        </p>
        <button
          type="button"
          onClick={onExample}
          className="mt-5 rounded-md border border-line px-3 py-1.5 text-[12.5px] text-ink-soft hover:bg-surface-sunk"
        >
          Try an example
        </button>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="flex min-h-0 flex-1 animate-pulse flex-col md:flex-row" aria-busy>
      <div className="shrink-0 space-y-3 border-line p-4 md:w-[400px] md:border-r">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-full rounded bg-surface-sunk" />
            <div className="h-3 w-2/3 rounded bg-surface-sunk" />
          </div>
        ))}
      </div>
      <div className="flex-1 bg-surface" />
    </div>
  )
}
