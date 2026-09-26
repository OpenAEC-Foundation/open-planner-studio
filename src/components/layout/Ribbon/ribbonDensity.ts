import { createContext, useContext } from 'react';

/**
 * Ribbon-dichtheid: `full` (grote knoppen, 94px-lint) of `compact` (platte 40px-strip met kleine
 * knoppen mét label). Dit is puur de HANDMATIGE keuze van de gebruiker
 * (`ui.ribbonCompact`, de inklap-pijl rechtsonder). De automatische aanpassing aan de beschikbare
 * breedte loopt niet via deze waarde — die degradeert per knop van rechts naar links tot een
 * icoon binnen dezelfde lint-hoogte (zie `useRibbonAutoFit` in Ribbon.tsx).
 *
 * De waarde gaat via context naar de groep-componenten die zelf een compacte vorm renderen
 * (TimeScale/Layout/Baselines/AI). Zo lezen de container-klasse én de inhoud in dezelfde render
 * dezelfde waarde — geen desync van één render zoals bij een losse store-vlag.
 */
export type RibbonDensity = 'full' | 'compact';

export const RibbonDensityContext = createContext<RibbonDensity>('full');

export const useRibbonDensity = (): RibbonDensity => useContext(RibbonDensityContext);
