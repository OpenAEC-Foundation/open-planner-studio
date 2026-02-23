import 'i18next';

import common from './locales/nl/common.json';
import task from './locales/nl/task.json';
import report from './locales/nl/report.json';
import menu from './locales/nl/menu.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      task: typeof task;
      report: typeof report;
      menu: typeof menu;
    };
  }
}
