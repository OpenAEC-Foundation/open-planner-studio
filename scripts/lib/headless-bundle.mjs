export const STUBBED = [
  /^react$/, /^react-dom(\/.*)?$/, /^react-i18next$/, /^@tauri-apps\//, /^@\/i18n\/config$/,
];

export const FORBIDDEN_INPUTS = [
  'src/state/appStore.ts',
  'src/components/',
  'src/i18n/config.ts',
  'src/i18n/locales/',
  'node_modules/react/',
  'node_modules/react-dom/',
  'node_modules/@tauri-apps/',
];

export function zustandWithoutReactSource(label) {
  return `
          import { createStore } from 'zustand/vanilla';
          const bind = (api) => Object.assign(() => {
            throw new Error(${JSON.stringify(`React hooks are not available in ${label}`)});
          }, api);
          export const create = (init) => (init ? bind(createStore(init)) : (i) => bind(createStore(i)));
          export { createStore };`;
}

export function stubModuleSource(path, label) {
  return `
          const fail = () => { throw new Error(${JSON.stringify(`"${path}" is not available in ${label}`)}); };
          const stub = new Proxy(function () {}, { get: (_t, k) => (k === '__esModule' ? true : k === 'then' ? undefined : fail()), apply: fail, construct: fail });
          export default stub;`;
}

export function headlessStubPlugin(root, label) {
  return {
    name: 'ops-headless-stubs',
    setup(build) {
      build.onResolve({ filter: /^zustand$/ }, () => ({ path: 'zustand', namespace: 'ops-core-zustand' }));
      build.onLoad({ filter: /.*/, namespace: 'ops-core-zustand' }, () => ({
        resolveDir: root,
        contents: zustandWithoutReactSource(label),
      }));
      for (const filter of STUBBED) {
        build.onResolve({ filter }, (args) => ({ path: args.path, namespace: 'ops-core-stub' }));
      }
      build.onLoad({ filter: /.*/, namespace: 'ops-core-stub' }, (args) => ({
        contents: stubModuleSource(args.path, label),
      }));
    },
  };
}

export function metafileInputs(metafile) {
  return Object.keys(metafile.inputs).map((p) => p.replace(/\\/g, '/'));
}

export function forbiddenInputs(inputs, extra = []) {
  const list = [...FORBIDDEN_INPUTS, ...extra];
  return inputs.filter((p) => list.some((f) => p.includes(f)));
}
