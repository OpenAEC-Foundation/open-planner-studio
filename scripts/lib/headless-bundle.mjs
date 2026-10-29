// Gedeelde bouwstenen voor de headless bundels: de kern (`scripts/build-core.mjs`) en de headless
// MCP-server (`scripts/build-mcp-server.mjs`). Beide bundelen app-code voor Node zonder React, Tauri,
// de app-singleton en de i18n-UI-config; deze module houdt die grens op één plek. De licenties van
// meegebundelde pakketten komen uit `third-party-notices.mjs` (gedeeld met `build-mcpb.mjs`).

// Modules die een headless bundel niet nodig heeft en die alleen bereikbaar zijn via een dynamische
// import of binnen een React-hook. De stub gooit pas bij GEBRUIK, niet bij het laden.
export const STUBBED = [
  /^react$/, /^react-dom(\/.*)?$/, /^react-i18next$/, /^@tauri-apps\//, /^@\/i18n\/config$/,
];

// Inputs die nooit in een headless bundel mogen landen (padfragmenten, relatief aan de metafile).
export const FORBIDDEN_INPUTS = [
  'src/state/appStore.ts',
  'src/components/',
  'src/i18n/config.ts',
  'src/i18n/locales/',
  'node_modules/react/',
  'node_modules/react-dom/',
  'node_modules/@tauri-apps/',
];

/** esbuild-plugin: zustand zonder React-hook, en een gooiende stub voor elke module uit `STUBBED`. */
export function headlessStubPlugin(root, label) {
  return {
    name: 'ops-headless-stubs',
    setup(build) {
      // zustand: alleen de vanilla store, zonder React-hook (`create` geeft een functie-object met de
      // store-API, net als zustand zelf, maar zonder `useSyncExternalStore`).
      build.onResolve({ filter: /^zustand$/ }, () => ({ path: 'zustand', namespace: 'ops-core-zustand' }));
      build.onLoad({ filter: /.*/, namespace: 'ops-core-zustand' }, () => ({
        resolveDir: root,
        contents: `
          import { createStore } from 'zustand/vanilla';
          const bind = (api) => Object.assign(() => {
            throw new Error(${JSON.stringify(`React hooks are not available in ${label}`)});
          }, api);
          export const create = (init) => (init ? bind(createStore(init)) : (i) => bind(createStore(i)));
          export { createStore };`,
      }));
      for (const filter of STUBBED) {
        build.onResolve({ filter }, (args) => ({ path: args.path, namespace: 'ops-core-stub' }));
      }
      build.onLoad({ filter: /.*/, namespace: 'ops-core-stub' }, (args) => ({
        contents: `
          const fail = () => { throw new Error(${JSON.stringify(`"${args.path}" is not available in ${label}`)}); };
          const stub = new Proxy(function () {}, { get: (_t, k) => (k === '__esModule' ? true : k === 'then' ? undefined : fail()), apply: fail, construct: fail });
          export default stub;`,
      }));
    },
  };
}

/** De inputpaden van een esbuild-metafile, met voorwaartse slashes. */
export function metafileInputs(metafile) {
  return Object.keys(metafile.inputs).map((p) => p.replace(/\\/g, '/'));
}

/** Inputs die op de verboden lijst staan (leeg = in orde). */
export function forbiddenInputs(inputs, extra = []) {
  const list = [...FORBIDDEN_INPUTS, ...extra];
  return inputs.filter((p) => list.some((f) => p.includes(f)));
}
