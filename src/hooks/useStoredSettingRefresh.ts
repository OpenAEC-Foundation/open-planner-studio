import { useEffect, useRef } from 'react';

/**
 * Roep `reload` aan als een andere bron de `localStorage`-sleutel `key` veranderde: een ander tabblad,
 * of de instellingen van de host die pas na de start binnenkwamen (#818, `siteHostSettings.ts` stuurt
 * dan een `StorageEvent`). Voor een component dat een instelling één keer in zijn eigen state laadt en
 * later de hele waarde terugschrijft; zonder verversing zou die schrijfactie de nieuwere waarde wissen.
 */
export function useStoredSettingRefresh(key: string, reload: () => void): void {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) reloadRef.current(); // `null`: de opslag is gewist
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);
}
