import { describe, it, expect } from 'vitest'
import { verifyClaims, enforceAnchorInvariant } from './verify'
import type { Claim, PullRequest } from './types'

const claim = (text: string): Claim => ({
  id: 'c1', text, source: 'pr_body', location: {},
})

const pr = (patch?: string): PullRequest => ({
  owner: 'acme', repo: 'widget', number: 1, title: '', body: '',
  url: 'https://github.com/acme/widget/pull/1',
  files: patch
    ? [{ path: 'src/parse.test.ts', status: 'added', additions: 9, deletions: 0, patch }]
    : [],
})

describe('verifyClaims', () => {
  it('defaults to unsupported when the diff is empty', () => {
    const ev = verifyClaims(pr(), [claim('Adds a regression test for the empty case.')])
    expect(ev.c1.verdict).toBe('unsupported')
  })

  it('never returns a non-unsupported verdict without an anchor', () => {
    // The invariant. A verdict the reviewer cannot go and look at is an opinion,
    // and this tool does not trade in opinions.
    const ev = verifyClaims(
      pr('@@ -0,0 +1,3 @@\n+it("handles empty input", () => {\n+  expect(parse("")).toEqual([])\n+})'),
      [claim('Adds a regression test for the empty case.')],
    )
    for (const e of Object.values(ev)) {
      if (e.verdict !== 'unsupported' && e.verdict !== 'pending') {
        expect(e.anchors.length).toBeGreaterThan(0)
      }
    }
  })

  it('returns one evidence entry per claim, keyed by claim id', () => {
    const claims = [claim('Adds a test.'), { ...claim('Removes the retry.'), id: 'c2' }]
    const ev = verifyClaims(pr(), claims)
    expect(Object.keys(ev).sort()).toEqual(['c1', 'c2'])
  })
})

describe('enforceAnchorInvariant', () => {
  const base = { claimId: 'c1', reason: '', anchors: [], confidence: 0.9 }

  it('demotes a supported verdict that has no anchor', () => {
    expect(enforceAnchorInvariant({ ...base, verdict: 'supported' }).verdict).toBe('unsupported')
  })

  it('demotes a contradicted verdict that has no anchor', () => {
    expect(enforceAnchorInvariant({ ...base, verdict: 'contradicted' }).verdict).toBe('unsupported')
  })

  it('leaves an anchored verdict alone', () => {
    const anchored = {
      ...base, verdict: 'supported' as const,
      anchors: [{ file: 'a.ts', startLine: 1, endLine: 2, side: 'new' as const }],
    }
    expect(enforceAnchorInvariant(anchored)).toEqual(anchored)
  })

  it('zeroes the confidence it demotes, so the UI cannot show high confidence in nothing', () => {
    expect(enforceAnchorInvariant({ ...base, verdict: 'supported' }).confidence).toBe(0)
  })
})

describe('co-occurrence is a lead, not evidence', () => {
  it('does not mark a claim supported just because a word it names appears in the diff', () => {
    const p: PullRequest = {
      owner: 'a', repo: 'b', number: 1, title: '', body: '',
      url: 'https://github.com/a/b/pull/1',
      files: [{
        path: 'src/hooks.ts', status: 'modified', additions: 1, deletions: 0,
        patch: '@@ -10,0 +11 @@\n+  const pendingState: boolean = false',
      }],
    }
    const c: Claim = {
      id: 'c1', source: 'pr_body', location: {},
      text: 'This simplifies the type definition of `pendingState` and improves maintainability.',
    }
    const ev = verifyClaims(p, [c])
    expect(ev.c1.verdict).toBe('unsupported')
    // But the reviewer still gets somewhere to look.
    expect(ev.c1.anchors.length).toBeGreaterThan(0)
  })
})

describe('numbers that are references, not measurements', () => {
  const withText = (text: string) => verifyClaims(pr(), [{ ...claim(text) }])

  it('does not treat an issue reference as an asserted figure', () => {
    const ev = withText('Fixes the regression from #22304.')
    expect(ev.c1.reason).not.toMatch(/figure/i)
  })

  it('does not treat a number inside a URL as an asserted figure', () => {
    const ev = withText('This is fixed in https://github.com/vitejs/vite/pull/22888 already.')
    expect(ev.c1.reason).not.toMatch(/figure/i)
  })

  it('still treats a real measurement as one', () => {
    expect(withText('Cuts p99 latency by 40%.').c1.reason).toMatch(/figure/i)
  })
})
