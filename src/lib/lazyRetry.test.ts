import { describe, expect, it, vi } from 'vitest'
import { isChunkError, loadWithRetry } from './lazyRetry'

/* A screen file that fails to download: one retry, then one guarded reload, never a loop. */

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}
const chunkError = () => new TypeError('Failed to fetch dynamically imported module: /assets/UnitsMonitorPage-abc.js')

describe('loading a screen', () => {
  it('retries once and succeeds without reloading', async () => {
    const load = vi.fn().mockRejectedValueOnce(chunkError()).mockResolvedValueOnce('screen')
    const reload = vi.fn()
    await expect(loadWithRetry(load, { delayMs: 0, reload, storage: memory() })).resolves.toBe('screen')
    expect(load).toHaveBeenCalledTimes(2)
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads the page once after a second failure, and never again in the same session', async () => {
    const storage = memory()
    const reload = vi.fn()
    const failing = () => Promise.reject(chunkError())
    void loadWithRetry(failing, { delayMs: 0, reload, storage })
    await new Promise((r) => setTimeout(r, 10))
    expect(reload).toHaveBeenCalledTimes(1)
    // After the reload it still fails: the error is shown instead of reloading forever.
    await expect(loadWithRetry(failing, { delayMs: 0, reload, storage })).rejects.toThrow(/dynamically imported/)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not retry errors that are not downloads', async () => {
    const load = vi.fn().mockRejectedValue(new Error('x is undefined'))
    await expect(loadWithRetry(load, { delayMs: 0, reload: vi.fn(), storage: memory() })).rejects.toThrow('x is undefined')
    expect(load).toHaveBeenCalledTimes(1)
    expect(isChunkError(new Error('x is undefined'))).toBe(false)
  })
})
