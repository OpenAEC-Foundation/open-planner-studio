// Minimale DOM-stubs voor de headless batterijen.
//
// Waarom een eigen MODULE en niet een paar regels bovenin het check-script: ES-imports worden
// gehoist. Zet je de stub als losse statements boven je imports, dan draait hij tóch pas nádat elke
// geïmporteerde module zijn body heeft uitgevoerd — en `@/i18n/config` raakt `document` meteen bij
// het laden (leesrichting instellen). Als eerste import staan werkt wél: imports worden op volgorde
// geëvalueerd.
//
// Gebruik: zet `import './domStub';` als ALLEREERSTE import in het check-script.
const g = globalThis as unknown as Record<string, unknown>;
if (!g.document) g.document = { documentElement: {} };
if (!g.getComputedStyle) g.getComputedStyle = () => ({ getPropertyValue: () => '' });

// Minimale localStorage: `settingsStore.setSetting` schrijft er rechtstreeks naartoe, en zonder
// deze stub gooit elke instelling-persistentie in Node. Bewust een echte Map en geen no-op, zodat
// een batterij kan TOETSEN dat er iets is weggeschreven.
if (!g.localStorage) {
  const mem = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v); },
    removeItem: (k: string) => { mem.delete(k); },
    clear: () => { mem.clear(); },
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() { return mem.size; },
  };
}
