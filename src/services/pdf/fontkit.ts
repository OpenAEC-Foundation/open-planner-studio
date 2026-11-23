// De ene ingang naar fontkit, de lettertypelezer onder pdf-lib en onder de tekstmeting van de rapporten.
//
// WAAROM fontkit 3 en niet `@pdf-lib/fontkit` (issue #1050): die fork (1.1.1) mist bij een GSUB-regel van type 8
// (reverse chaining contextual single substitution) een veld in de parser en de uitvoering. Een lettertype met zo'n
// regel (bijvoorbeeld Noto Sans Coptic) liet elke tekst stuklopen, en dan viel de hele PDF terug op raster. fontkit
// 3.0.0 leest en voert die regel uit (upstream foliojs/fontkit c08512de). pdf-lib 1.17 werkt ermee via
// `registerFontkit`: het gebruikt alleen `create`, `layout` en de lettertype- en glyphvelden die fontkit 3 ook heeft.
//
// fontkit 3 levert geen typen; deze module geeft het de vorm die pdf-lib verwacht (`Fontkit`), op één plek.
// @ts-expect-error -- fontkit 3 heeft geen typedeclaratie; de vorm staat hieronder vast.
import * as fontkitModule from 'fontkit';
import type { Fontkit } from 'pdf-lib/cjs/types/fontkit';

export const fontkit: Fontkit = fontkitModule as Fontkit;
