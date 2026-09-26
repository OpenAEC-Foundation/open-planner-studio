// De ENIGE plek in de app waar een extensie-geleverd icoon in de DOM belandt.
// Alle drie de aanroepplekken — de extensiekaart in
// Backstage → Extensies, de importer-kaart in Backstage → Importeren en de extensie-ribbonknop —
// lopen hierlangs, zodat het `dangerouslySetInnerHTML` op precies één regel staat en die regel
// aantoonbaar alleen door `sanitizeSvgIcon` herbouwde markup krijgt.
//
// Zie src/utils/sanitizeSvgIcon.ts voor het waarom van saniteren i.p.v. wegstrepen (het
// icoon-contract in docs/extensions.md schrijft inline SVG voor) en voor de allowlist zelf.
import { useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { sanitizeSvgIcon } from '@/utils/sanitizeSvgIcon';

interface ExtensionIconProps {
  /** Ruwe icoonstring uit extensiedata (manifest, importer-registratie, ribbonknop). Ongefilterd. */
  raw: string | null | undefined;
  /** Wat er getoond wordt als er geen veilig icoon overblijft (lucide-icoon van de aanroeper). */
  fallback: ReactNode;
  style?: CSSProperties;
}

export function ExtensionIcon({ raw, fallback, style }: ExtensionIconProps) {
  const icon = useMemo(() => sanitizeSvgIcon(raw), [raw]);

  // Niets veiligs overgebleven (of geen icoon opgegeven) → het eigen icoon van de aanroeper.
  if (!icon) return <>{fallback}</>;

  // Emoji/kort teken: gewone React-tekstknoop, dus door React geëscaped.
  if (icon.kind === 'text') return <span style={style}>{icon.text}</span>;

  // Inline SVG: `markup` is opnieuw opgebouwd uit de allowlist in sanitizeSvgIcon — geen enkel
  // fragment van de aangeleverde string komt hier letterlijk doorheen. Voed dit attribuut nooit
  // met iets anders dan een `SanitizedIcon`.
  return <span style={style} dangerouslySetInnerHTML={{ __html: icon.markup }} />;
}
