import type { HolidayDef, HolidayRule, HolidaySet } from './holidays';

const thirdMondayInFebruary = { kind: 'nth-weekday', month: 2, weekday: 1, nth: 3 } as const;
const firstMondayInAugust = { kind: 'nth-weekday', month: 8, weekday: 1, nth: 1 } as const;
const mondayBeforeMay25 = { kind: 'weekday-before', month: 5, day: 25, weekday: 1 } as const;

const newYear = { id: 'ca-new-year', name: "New Year's Day", rule: { kind: 'fixed', month: 1, day: 1 } } as const;
const goodFriday = { id: 'ca-good-friday', name: 'Good Friday', rule: { kind: 'easter', offset: -2 } } as const;
const victoriaDay = { id: 'ca-victoria', name: 'Victoria Day', rule: mondayBeforeMay25 } as const;
const canadaDay = { id: 'ca-canada', name: 'Canada Day', rule: { kind: 'fixed', month: 7, day: 1, substitute: 'sunday-to-monday' } } as const;
const labourDay = { id: 'ca-labour', name: 'Labour Day', rule: { kind: 'nth-weekday', month: 9, weekday: 1, nth: 1 } } as const;
const truthAndReconciliation = { id: 'ca-truth', name: 'National Day for Truth and Reconciliation', rule: { kind: 'fixed', month: 9, day: 30 } } as const;
const thanksgiving = { id: 'ca-thanksgiving', name: 'Thanksgiving Day', rule: { kind: 'nth-weekday', month: 10, weekday: 1, nth: 2 } } as const;
const remembrance = { id: 'ca-remembrance', name: 'Remembrance Day', rule: { kind: 'fixed', month: 11, day: 11 } } as const;
const christmas = { id: 'ca-christmas', name: 'Christmas Day', rule: { kind: 'fixed', month: 12, day: 25 } } as const;
const boxing = { id: 'ca-boxing', name: 'Boxing Day', rule: { kind: 'fixed', month: 12, day: 26 } } as const;

function observeOnMonday(def: HolidayDef & { rule: Extract<HolidayRule, { kind: 'fixed' }> }): HolidayDef {
  return { ...def, rule: { ...def.rule, substitute: 'weekend-to-monday' } };
}

export const CA_SET: HolidaySet = {
  country: 'CA',
  regions: [
    { id: 'AB', name: 'Alberta' },
    { id: 'BC', name: 'British Columbia' },
    { id: 'MB', name: 'Manitoba' },
    { id: 'NB', name: 'New Brunswick' },
    { id: 'NL', name: 'Newfoundland and Labrador' },
    { id: 'NS', name: 'Nova Scotia' },
    { id: 'NT', name: 'Northwest Territories' },
    { id: 'NU', name: 'Nunavut' },
    { id: 'ON', name: 'Ontario' },
    { id: 'PE', name: 'Prince Edward Island' },
    { id: 'QC', name: 'Québec' },
    { id: 'SK', name: 'Saskatchewan' },
    { id: 'YT', name: 'Yukon' },
  ],
  nationalDefs: [
    observeOnMonday(newYear), goodFriday, victoriaDay, observeOnMonday(canadaDay), labourDay,
    observeOnMonday({ ...truthAndReconciliation, fromYear: 2021 }), thanksgiving,
    observeOnMonday(remembrance), observeOnMonday(christmas),
    { ...boxing, rule: { ...boxing.rule, substitute: 'ca-boxing-day' } },
  ],
  defs: [
    newYear, goodFriday, labourDay, christmas,
    { ...canadaDay, regions: ['AB', 'BC', 'MB', 'NB', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'] },
    { ...canadaDay, regions: ['NS'], untilYear: 2017 },
    { ...canadaDay, rule: { kind: 'fixed', month: 7, day: 1 }, regions: ['NS'], fromYear: 2018 },
    { ...canadaDay, name: 'Memorial Day (Canada Day)', rule: { kind: 'fixed', month: 7, day: 1 }, regions: ['NL'] },
    { ...victoriaDay, regions: ['AB', 'BC', 'MB', 'NT', 'NU', 'ON', 'SK', 'YT'] },
    { ...victoriaDay, name: 'Journée nationale des patriotes', regions: ['QC'] },
    { ...thanksgiving, regions: ['AB', 'BC', 'MB', 'NT', 'NU', 'ON', 'QC', 'SK', 'YT'] },
    { ...remembrance, regions: ['AB', 'BC', 'NB', 'NL', 'NT', 'NU', 'PE', 'SK', 'YT'] },
    { ...boxing, regions: ['ON'] },
    { id: 'ca-family', name: 'Family Day', rule: thirdMondayInFebruary, regions: ['AB'], fromYear: 1990 },
    { id: 'ca-family', name: 'Family Day', rule: thirdMondayInFebruary, regions: ['SK'], fromYear: 2007 },
    { id: 'ca-family', name: 'Family Day', rule: thirdMondayInFebruary, regions: ['ON'], fromYear: 2008 },
    { id: 'ca-family', name: 'Family Day', rule: { ...thirdMondayInFebruary, nth: 2 }, regions: ['BC'], fromYear: 2013, untilYear: 2018 },
    { id: 'ca-family', name: 'Family Day', rule: thirdMondayInFebruary, regions: ['BC'], fromYear: 2019 },
    { id: 'ca-family', name: 'Family Day', rule: thirdMondayInFebruary, regions: ['NB'], fromYear: 2018 },
    { id: 'ca-islander', name: 'Islander Day', rule: thirdMondayInFebruary, ruleByYear: {
      2009: { ...thirdMondayInFebruary, nth: 2 },
    }, regions: ['PE'], fromYear: 2009 },
    { id: 'ca-louis-riel', name: 'Louis Riel Day', rule: thirdMondayInFebruary, regions: ['MB'], fromYear: 2008 },
    { id: 'ca-ns-heritage', name: 'Nova Scotia Heritage Day', rule: thirdMondayInFebruary, regions: ['NS'], fromYear: 2015 },
    { id: 'ca-indigenous', name: 'National Indigenous Peoples Day', rule: { kind: 'fixed', month: 6, day: 21 }, regions: ['NT'], fromYear: 2002 },
    { id: 'ca-indigenous', name: 'National Indigenous Peoples Day', rule: { kind: 'fixed', month: 6, day: 21 }, regions: ['YT'], fromYear: 2017 },
    { id: 'ca-quebec', name: 'Fête nationale du Québec', rule: { kind: 'fixed', month: 6, day: 24 }, regions: ['QC'] },
    { id: 'ca-nunavut', name: 'Nunavut Day', rule: { kind: 'fixed', month: 7, day: 9 }, regions: ['NU'], fromYear: 2020 },
    { id: 'ca-bc-day', name: 'British Columbia Day', rule: firstMondayInAugust, regions: ['BC'] },
    { id: 'ca-nb-day', name: 'New Brunswick Day', rule: firstMondayInAugust, regions: ['NB'] },
    { id: 'ca-sk-day', name: 'Saskatchewan Day', rule: firstMondayInAugust, regions: ['SK'] },
    { id: 'ca-civic', name: 'Civic Holiday', rule: firstMondayInAugust, regions: ['NT', 'NU'] },
    { id: 'ca-discovery', name: 'Discovery Day', rule: { kind: 'nth-weekday', month: 8, weekday: 1, nth: 3 }, regions: ['YT'] },
    { ...truthAndReconciliation, regions: ['NT', 'NU', 'PE'], fromYear: 2022 },
    { ...truthAndReconciliation, regions: ['BC', 'YT'], fromYear: 2023 },
    { ...truthAndReconciliation, name: 'Orange Shirt Day', regions: ['MB'], fromYear: 2024 },
  ],
};
