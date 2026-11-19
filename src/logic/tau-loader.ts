import type Tau from 'tau-prolog';

export type TauProlog = typeof Tau;

let loading: Promise<TauProlog> | null = null;

/**
 * Loads Tau Prolog once. Tau Prolog 0.3.4 is written as a sloppy-mode script
 * (it assigns to undeclared names), so it cannot run inside a strict ES module
 * bundle. In the browser it is loaded as a classic script and read from
 * window.pl; under Node (unit tests) it is loaded as the CommonJS package.
 */
export function loadTau(): Promise<TauProlog> {
  loading ??= typeof document !== 'undefined' ? loadInBrowser() : loadInNode();
  return loading;
}

async function loadInBrowser(): Promise<TauProlog> {
  const { default: src } = await import('tau-prolog/modules/core.js?url');
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('could not load the Prolog engine'));
    document.head.appendChild(script);
  });
  const pl = (window as unknown as { pl?: TauProlog }).pl;
  if (!pl) throw new Error('the Prolog engine did not start');
  return pl;
}

async function loadInNode(): Promise<TauProlog> {
  const specifier = 'tau-prolog';
  const mod = (await import(/* @vite-ignore */ specifier)) as { default: TauProlog };
  return mod.default;
}
