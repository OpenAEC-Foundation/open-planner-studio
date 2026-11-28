import { l, type Check, type Snap, type TutorialScript } from './dsl';

const statusBar = { anchor: 'status-bar' } as const;
const report = { anchor: 'report-panel' } as const;
const notStale: Check = { state: (s: Snap) => (s.stale ? ['planning nog verouderd'] : []) };
const status = (nl: string, en: string): Check => ({ see: statusBar, text: l(nl, en) });
const reportType = { css: '[aria-haspopup="listbox"]', within: report } as const;
const see = (nl: string, en: string): Check => ({ see: report, text: l(nl, en) });

export const TUTORIAL_7: TutorialScript = {
  id: 'tut-7-rapport',
  start: 'na-tut-6',
  end: 'na-tut-7',
  steps: [
    {
      id: 'startpunt',
      do: [],
      expect: [notStale, status('Einde: 31-08-2027', 'End: 31-08-2027'), status('Kritiek pad: 11 taken, 47 werkdagen', 'Critical path: 11 tasks, 47 work days')],
    },
    {
      id: 'rapport-openen',
      do: [{ tab: 'report', label: l('Rapport', 'Report') }],
      expect: [
        { visible: report },
        see('Taken', 'Tasks'),
      ],
    },
    {
      id: 'variance',
      do: [{ select: reportType, option: l('Variance', 'Variance') }],
      expect: [see('Projecteinde: +1 werkdagen', 'Project end: +1 work days')],
      shots: [{ name: 'tut-7-variance', of: report, pad: 0, maxHeight: 660, viewport: { width: 1000, height: 1050 } }],
    },
    {
      id: 'voortgangsrapport',
      do: [{ select: reportType, option: l('Voortgangsrapport', 'Progress report') }],
      expect: [see('28-06-2027', '28-06-2027'), see('30-08-2027', '30-08-2027'), see('31-08-2027', '31-08-2027')],
      shots: [{ name: 'tut-7-voortgangsrapport', of: report, pad: 0, maxHeight: 600, viewport: { width: 1000, height: 1050 } }],
    },
    {
      id: 'papier',
      do: [{ select: { field: l('Papier:', 'Paper:'), within: report }, option: l('A4', 'A4') }],
      expect: [
        { see: { field: l('Papier:', 'Paper:'), within: report }, text: 'A4' },
        { see: { field: l('Oriëntatie:', 'Orientation:'), within: report }, text: l('Liggend', 'Landscape') },
      ],
    },
    {
      id: 'pdf',
      do: [{
        download: { click: { button: l('Exporteer PDF', 'Export PDF'), within: report } },
        filename: l('Aanbouw woning-voortgang.pdf', 'House extension-progress.pdf'),
      }],
      expect: [],
    },
    {
      id: 'delen',
      do: [
        { tab: 'file', label: l('Bestand', 'File') },
        { click: { button: l('Exporteren', 'Export') } },
        { download: { click: { text: l('MS Project XML', 'MS Project XML') } }, filename: l('Aanbouw woning.xml', 'House extension.xml') },
      ],
      expect: [],
    },
  ],
};
