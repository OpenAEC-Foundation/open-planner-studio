import { createContext, useContext } from 'react';

export type RibbonDensity = 'full' | 'compact';

export const RibbonDensityContext = createContext<RibbonDensity>('full');

export const useRibbonDensity = (): RibbonDensity => useContext(RibbonDensityContext);
