/**
 * Which build of the app this is — set by installer/build.mjs (VITE_VERTEX_BUILD,
 * e.g. 2026.09.26.1405). 'dev' when run from source. The installed server reports
 * its own build in /api/health, so an open window can tell when it is out of date.
 */
export const APP_BUILD: string = (import.meta.env.VITE_VERTEX_BUILD as string | undefined) || 'dev'
