/**
 * GET /api/pr?url=<github pull request url>
 *
 * Fetches a pull request and its changed files. This runs on the server for one
 * reason: the GitHub token. A token in client code is a token in the bundle, in
 * the browser devtools, and in anyone's cache. There is no client-side way to
 * hold a credential, so the credential stays here and the browser only ever
 * sees the result.
 *
 * The url is parsed rather than pattern-matched and then interpolated. Building
 * an upstream request out of a user-supplied string is how a fetch proxy turns
 * into a request-forgery primitive, so nothing from the caller reaches the
 * upstream URL except three values this file has already validated: owner, repo
 * and a positive integer.
 */

const GITHUB_API = 'https://api.github.com'
const MAX_FILES = 300 // GitHub's own per-PR cap on the files endpoint.

interface ParsedRef { owner: string; repo: string; number: number }

/** Accepts only https://github.com/<owner>/<repo>/pull/<n>. Anything else,
 *  including api.github.com and any other host, is refused. */
export function parsePullRequestUrl(raw: string): ParsedRef | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  if (u.hostname !== 'github.com' && u.hostname !== 'www.github.com') return null

  const parts = u.pathname.split('/').filter(Boolean)
  if (parts.length < 4 || parts[2] !== 'pull') return null

  const [owner, repo, , numRaw] = parts
  // Segment shapes GitHub itself allows. Anything else is not a repo we could
  // have been given honestly, so refuse rather than pass it upstream.
  const seg = /^[A-Za-z0-9._-]{1,100}$/
  if (!seg.test(owner) || !seg.test(repo)) return null

  const number = Number(numRaw)
  if (!Number.isInteger(number) || number <= 0) return null

  return { owner, repo, number }
}

async function gh(path: string) {
  const token = process.env.GITHUB_TOKEN
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'pr-receipts',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    // Rate limiting is the failure users will actually hit, and "403" alone
    // sends them looking for a permissions problem they do not have. Say which
    // one it is and when it clears.
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
      const reset = Number(res.headers.get('x-ratelimit-reset') ?? 0) * 1000
      const err = new Error(
        `GitHub rate limit reached. It resets at ${new Date(reset).toLocaleTimeString()}.` +
          (token ? '' : ' Setting GITHUB_TOKEN raises the limit from 60 to 5000 requests an hour.'),
      )
      ;(err as Error & { status?: number }).status = 429
      throw err
    }
    const err = new Error(`GitHub responded ${res.status} for ${path}`)
    ;(err as Error & { status?: number }).status = res.status === 404 ? 404 : 502
    throw err
  }
  return res.json()
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url).searchParams.get('url')
  if (!url) return json({ error: 'Pass a GitHub pull request URL as ?url=' }, 400)

  const ref = parsePullRequestUrl(url)
  if (!ref) {
    return json(
      { error: 'That is not a GitHub pull request URL. Expected https://github.com/<owner>/<repo>/pull/<number>.' },
      400,
    )
  }

  try {
    const base = `/repos/${ref.owner}/${ref.repo}/pulls/${ref.number}`
    const [pr, files] = await Promise.all([
      gh(base),
      gh(`${base}/files?per_page=${MAX_FILES}`),
    ])

    return json({
      owner: ref.owner,
      repo: ref.repo,
      number: ref.number,
      title: pr.title ?? '',
      body: pr.body ?? '',
      url: pr.html_url,
      // truncated is surfaced, not swallowed. A reviewer who is shown 300 of
      // 900 files and not told will trust a verdict the tool could not reach.
      truncated: Array.isArray(files) && files.length >= MAX_FILES,
      files: (files as Array<Record<string, unknown>>).map((f) => ({
        path: f.filename as string,
        status: f.status as string,
        additions: f.additions as number,
        deletions: f.deletions as number,
        patch: f.patch as string | undefined,
      })),
    })
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500
    return json({ error: (e as Error).message }, status)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
