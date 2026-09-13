import { describe, it, expect } from 'vitest'
import { verifyClaims } from './verify'
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
