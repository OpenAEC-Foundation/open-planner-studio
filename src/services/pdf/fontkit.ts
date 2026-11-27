// @ts-expect-error -- fontkit 3 heeft geen typedeclaratie; de vorm staat hieronder vast.
import * as fontkitModule from 'fontkit';
import type { Fontkit } from 'pdf-lib/cjs/types/fontkit';

export const fontkit: Fontkit = fontkitModule as Fontkit;
