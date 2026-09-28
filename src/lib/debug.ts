/** Debug tools: `?debug=true`, only in dev builds unless explicitly enabled at build time. */
export const DEBUG_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('debug') === 'true' &&
  (import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG === 'true');
