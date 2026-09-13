import { describe, it, expect } from 'vitest'
import { extractClaims } from './extract'
import type { PullRequest } from './types'

const pr = (over: Partial<PullRequest> = {}): PullRequest => ({
  owner: 'acme', repo: 'widget', number: 1,
  title: 'Fix the parser', body: '', url: 'https://github.com/acme/widget/pull/1',
  files: [], ...over,
})

describe('extractClaims', () => {
  it('keeps checkable statements', () => {
    const claims = extractClaims(pr({ body: 'Adds a regression test for the empty input case.' }))
    expect(claims).toHaveLength(1)
    expect(claims[0].source).toBe('pr_body')
  })

  it('drops statements nothing could falsify', () => {
    // "Refactors for clarity" has no state of the world that makes it false.
    expect(extractClaims(pr({ body: 'Refactors the parser for clarity.' }))).toHaveLength(0)
  })

  it('quotes the claim verbatim', () => {
    const body = 'Cuts p99 latency by 40%.'
    expect(extractClaims(pr({ body }))[0].text).toBe(body)
  })

  it('is stable across runs', () => {
    const input = pr({ body: 'Adds a retry with a hard timeout.' })
    expect(extractClaims(input).map((c) => c.id)).toEqual(extractClaims(input).map((c) => c.id))
  })

  it('returns claims in reading order: title before body', () => {
    const claims = extractClaims(pr({
      title: 'Adds bounded retries to the client',
      body: 'Also adds a hard result timeout.',
    }))
    expect(claims.map((c) => c.source)).toEqual(['pr_title', 'pr_body'])
  })
})

describe('extractClaims, markdown handling', () => {
  it('ignores lines inside a fenced code block', () => {
    // A line of code is dense with identifiers, so it passes the anchor test
    // and arrives as a claim unless fence state is tracked across lines.
    const body = [
      'Adds a hard timeout.',
      '```ts',
      'const queue: UpdateQueue<boolean> = get_queue()',
      '```',
    ].join('\n')
    const claims = extractClaims(pr({ body }))
    expect(claims).toHaveLength(1)
    expect(claims[0].text).toBe('Adds a hard timeout.')
  })

  it('ignores indented code blocks', () => {
    const body = 'Adds a retry.\n\n    const x = foo_bar()\n'
    expect(extractClaims(pr({ body }))).toHaveLength(1)
  })
})
