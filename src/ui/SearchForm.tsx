import { forwardRef } from 'react'

interface Props {
  url: string
  onChange: (v: string) => void
  onSubmit: () => void
  busy: boolean
  /** 'hero' before a pull request is loaded, 'bar' afterwards.
   *
   *  Same control, two jobs. On an empty screen the input IS the product and
   *  should be the thing you land on. Once a review is on screen it is a
   *  utility you use occasionally, and a full-width field competing with the
   *  claims would be shouting about the least important thing in view. */
  variant: 'hero' | 'bar'
}

export const SearchForm = forwardRef<HTMLInputElement, Props>(function SearchForm(
  { url, onChange, onSubmit, busy, variant }, ref,
) {
  const hero = variant === 'hero'
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (url.trim()) onSubmit() }}
      // Capped rather than fluid. A URL is a known, bounded thing, and a field
      // that grows to 1900px on a wide monitor reads as nobody having decided.
      className={`flex items-center gap-2 ${hero ? 'w-full max-w-[520px]' : 'w-full max-w-[420px]'}`}
    >
      <input
        ref={ref}
        value={url}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://github.com/owner/repo/pull/123"
        aria-label="GitHub pull request URL"
        spellCheck={false}
        autoComplete="off"
        className={`min-w-0 flex-1 rounded-md border border-line bg-surface-sunk text-ink placeholder:text-ink-faint focus:border-ink-soft focus:outline-none ${
          hero ? 'px-3.5 py-2.5 text-[14px]' : 'px-3 py-1.5 text-[13px]'
        }`}
      />
      <button
        type="submit"
        disabled={!url.trim() || busy}
        className={`shrink-0 rounded-md bg-ink font-medium text-canvas transition-opacity disabled:opacity-30 ${
          hero ? 'px-4 py-2.5 text-[14px]' : 'px-3 py-1.5 text-[12.5px]'
        }`}
      >
        {busy ? 'Checking' : 'Check'}
      </button>
    </form>
  )
})
