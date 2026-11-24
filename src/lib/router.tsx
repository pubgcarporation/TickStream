import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react'

const EVENT = 'tickstream:navigate'

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  if (options.replace) window.history.replaceState(null, '', to)
  else window.history.pushState(null, '', to)
  window.dispatchEvent(new Event(EVENT))
  // Changing a filter in place keeps the reader where they are. A new page starts at the top.
  if (!options.replace) window.scrollTo({ top: 0 })
}

export function useLocation(): { path: string; search: URLSearchParams } {
  const read = () => ({ path: window.location.pathname, search: window.location.search })
  const [state, setState] = useState(read)
  useEffect(() => {
    const update = () => setState(read())
    window.addEventListener('popstate', update)
    window.addEventListener(EVENT, update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener(EVENT, update)
    }
  }, [])
  return { path: state.path, search: new URLSearchParams(state.search) }
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string
}

export function Link({ to, onClick, children, ...rest }: LinkProps) {
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    // Links that open elsewhere or download keep their normal browser behavior.
    if ((rest.target && rest.target !== '_self') || rest.download !== undefined) return
    event.preventDefault()
    navigate(to)
  }
  return (
    <a href={to} onClick={handle} {...rest}>
      {children}
    </a>
  )
}
