/** In the browser-only app a "server function" is already a plain async function. */
export function useServerFn<F>(fn: F): F {
  return fn;
}
