// src/engine/calendar/holidays.ts
var utc = (y, month1, day) => new Date(Date.UTC(y, month1 - 1, day));
var iso = (d) => d.toISOString().slice(0, 10);
var addDays = (d, n) => new Date(d.getTime() + n * 864e5);
var dow = (d) => (d.getUTCDay() + 6) % 7 + 1;
var oneDay = (name, d) => ({ name, startDate: iso(d), endDate: iso(d) });
var range = (name, start, days) => ({ name, startDate: iso(start), endDate: iso(addDays(start, Math.max(1, days) - 1)) });
function easterSunday(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = (h + l - 7 * m + 114) % 31 + 1;
  return new Date(Date.UTC(y, month - 1, day));
}
function nthWeekday(y, month1, weekday, nth) {
  if (nth === "last") {
    let d2 = utc(y, month1 + 1, 1);
    d2 = addDays(d2, -1);
    while (dow(d2) !== weekday) d2 = addDays(d2, -1);
    return d2;
  }
  let d = utc(y, month1, 1);
  while (dow(d) !== weekday) d = addDays(d, 1);
  return addDays(d, (nth - 1) * 7);
}
function weekdayBefore(y, month1, day, weekday) {
  let d = addDays(utc(y, month1, day), -1);
  while (dow(d) !== weekday) d = addDays(d, -1);
  return d;
}
function materialize(def, y) {
  const r = def.rule;
  switch (r.kind) {
    case "fixed": {
      let d = utc(y, r.month, r.day);
      if (r.substitute === "nl-kingsday") {
        if (dow(d) === 7) d = utc(y, 4, 26);
      } else if (r.substitute === "uk-monday") {
        if (dow(d) === 6) d = addDays(d, 2);
        else if (dow(d) === 7) d = addDays(d, 1);
      }
      return range(def.name, d, r.days ?? 1);
    }
    case "easter":
      return range(def.name, addDays(easterSunday(y), r.offset), r.days ?? 1);
    case "nth-weekday":
      return oneDay(def.name, nthWeekday(y, r.month, r.weekday, r.nth));
    case "weekday-before":
      return oneDay(def.name, weekdayBefore(y, r.month, r.day, r.weekday));
  }
}
function ukChristmasBoxing(y) {
  const cdow = dow(utc(y, 12, 25));
  let xmas = utc(y, 12, 25);
  let boxing = utc(y, 12, 26);
  if (cdow === 6) {
    xmas = utc(y, 12, 27);
    boxing = utc(y, 12, 28);
  } else if (cdow === 7) {
    xmas = utc(y, 12, 27);
    boxing = utc(y, 12, 26);
  } else if (cdow === 5) {
    boxing = utc(y, 12, 28);
  }
  return [oneDay("Christmas Day", xmas), oneDay("Boxing Day", boxing)];
}
function generateHolidays(set, region, fromYear, toYear) {
  const out = [];
  for (let y = fromYear; y <= toYear; y++) {
    for (const def of set.defs) {
      if (def.regions && def.regions.length > 0) {
        if (!region || !def.regions.includes(region)) continue;
      }
      if (def.lustrumOnly && y % 5 !== 0) continue;
      const h = materialize(def, y);
      if (h) out.push(h);
    }
    if (set.country === "UK") out.push(...ukChristmasBoxing(y));
  }
  return out;
}
var NL_SET = {
  country: "NL",
  defs: [
    { id: "nl-nieuwjaar", name: "Nieuwjaar", rule: { kind: "fixed", month: 1, day: 1 } },
    { id: "nl-goede-vrijdag", name: "Goede Vrijdag", rule: { kind: "easter", offset: -2 }, optional: true },
    { id: "nl-pasen", name: "Pasen", rule: { kind: "easter", offset: 0, days: 2 } },
    { id: "nl-koningsdag", name: "Koningsdag", rule: { kind: "fixed", month: 4, day: 27, substitute: "nl-kingsday" } },
    // Bevrijdingsdag: alleen in lustrumjaren algemeen erkend vrij; overige jaren opt-in in de UI.
    { id: "nl-bevrijdingsdag", name: "Bevrijdingsdag", rule: { kind: "fixed", month: 5, day: 5 }, lustrumOnly: true, optional: true },
    { id: "nl-hemelvaart", name: "Hemelvaart", rule: { kind: "easter", offset: 39 } },
    { id: "nl-pinksteren", name: "Pinksteren", rule: { kind: "easter", offset: 49, days: 2 } },
    { id: "nl-kerst", name: "Kerst", rule: { kind: "fixed", month: 12, day: 25, days: 2 } }
  ]
};
var DE_SET = {
  country: "DE",
  regions: [
    { id: "BW", name: "Baden-W\xFCrttemberg" },
    { id: "BY", name: "Bayern" },
    { id: "BE", name: "Berlin" },
    { id: "BB", name: "Brandenburg" },
    { id: "HB", name: "Bremen" },
    { id: "HH", name: "Hamburg" },
    { id: "HE", name: "Hessen" },
    { id: "MV", name: "Mecklenburg-Vorpommern" },
    { id: "NI", name: "Niedersachsen" },
    { id: "NW", name: "Nordrhein-Westfalen" },
    { id: "RP", name: "Rheinland-Pfalz" },
    { id: "SL", name: "Saarland" },
    { id: "SN", name: "Sachsen" },
    { id: "ST", name: "Sachsen-Anhalt" },
    { id: "SH", name: "Schleswig-Holstein" },
    { id: "TH", name: "Th\xFCringen" }
  ],
  defs: [
    { id: "de-neujahr", name: "Neujahr", rule: { kind: "fixed", month: 1, day: 1 } },
    { id: "de-karfreitag", name: "Karfreitag", rule: { kind: "easter", offset: -2 } },
    { id: "de-ostermontag", name: "Ostermontag", rule: { kind: "easter", offset: 1 } },
    { id: "de-arbeit", name: "Tag der Arbeit", rule: { kind: "fixed", month: 5, day: 1 } },
    { id: "de-himmelfahrt", name: "Christi Himmelfahrt", rule: { kind: "easter", offset: 39 } },
    { id: "de-pfingstmontag", name: "Pfingstmontag", rule: { kind: "easter", offset: 50 } },
    { id: "de-einheit", name: "Tag der Deutschen Einheit", rule: { kind: "fixed", month: 10, day: 3 } },
    { id: "de-weihnachten", name: "Weihnachten", rule: { kind: "fixed", month: 12, day: 25, days: 2 } },
    // Regionaal:
    { id: "de-dreikoenige", name: "Heilige Drei K\xF6nige", rule: { kind: "fixed", month: 1, day: 6 }, regions: ["BW", "BY", "ST"] },
    { id: "de-frauentag", name: "Internationaler Frauentag", rule: { kind: "fixed", month: 3, day: 8 }, regions: ["BE", "MV"] },
    { id: "de-fronleichnam", name: "Fronleichnam", rule: { kind: "easter", offset: 60 }, regions: ["BW", "BY", "HE", "NW", "RP", "SL", "SN", "TH"] },
    { id: "de-mariae-himmelfahrt", name: "Mari\xE4 Himmelfahrt", rule: { kind: "fixed", month: 8, day: 15 }, regions: ["SL", "BY"] },
    { id: "de-weltkindertag", name: "Weltkindertag", rule: { kind: "fixed", month: 9, day: 20 }, regions: ["TH"] },
    { id: "de-reformationstag", name: "Reformationstag", rule: { kind: "fixed", month: 10, day: 31 }, regions: ["BB", "HB", "HH", "MV", "NI", "SN", "ST", "SH", "TH"] },
    { id: "de-allerheiligen", name: "Allerheiligen", rule: { kind: "fixed", month: 11, day: 1 }, regions: ["BW", "BY", "NW", "RP", "SL"] },
    { id: "de-buss-bettag", name: "Bu\xDF- und Bettag", rule: { kind: "weekday-before", month: 11, day: 23, weekday: 3 }, regions: ["SN"] }
  ]
};
var UK_SET = {
  // Christmas + Boxing Day worden landelijk toegevoegd door generateHolidays (gekoppelde substitutie).
  country: "UK",
  regions: [
    { id: "EAW", name: "England & Wales" },
    { id: "SCT", name: "Scotland" },
    { id: "NIR", name: "Northern Ireland" }
  ],
  defs: [
    { id: "uk-new-year", name: "New Year's Day", rule: { kind: "fixed", month: 1, day: 1, substitute: "uk-monday" } },
    { id: "uk-jan2", name: "2 January", rule: { kind: "fixed", month: 1, day: 2, substitute: "uk-monday" }, regions: ["SCT"] },
    { id: "uk-st-patrick", name: "St Patrick's Day", rule: { kind: "fixed", month: 3, day: 17, substitute: "uk-monday" }, regions: ["NIR"] },
    { id: "uk-good-friday", name: "Good Friday", rule: { kind: "easter", offset: -2 } },
    { id: "uk-easter-monday", name: "Easter Monday", rule: { kind: "easter", offset: 1 }, regions: ["EAW", "NIR"] },
    { id: "uk-early-may", name: "Early May bank holiday", rule: { kind: "nth-weekday", month: 5, weekday: 1, nth: 1 } },
    { id: "uk-spring", name: "Spring bank holiday", rule: { kind: "nth-weekday", month: 5, weekday: 1, nth: "last" } },
    { id: "uk-summer-eaw", name: "Summer bank holiday", rule: { kind: "nth-weekday", month: 8, weekday: 1, nth: "last" }, regions: ["EAW", "NIR"] },
    { id: "uk-summer-sct", name: "Summer bank holiday", rule: { kind: "nth-weekday", month: 8, weekday: 1, nth: 1 }, regions: ["SCT"] },
    { id: "uk-boyne", name: "Battle of the Boyne", rule: { kind: "fixed", month: 7, day: 12, substitute: "uk-monday" }, regions: ["NIR"] },
    { id: "uk-st-andrew", name: "St Andrew's Day", rule: { kind: "fixed", month: 11, day: 30, substitute: "uk-monday" }, regions: ["SCT"] }
  ]
};

// src/utils/dateUtils.ts
function formatDate(d) {
  return d.toISOString().split("T")[0];
}

// tests/planning/check-holidays.ts
var diffs = [];
var eq = (label, got, want) => {
  if (got !== want) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
function startOf(list, name) {
  return list.find((h) => h.name === name)?.startDate ?? null;
}
function has(list, name) {
  return list.some((h) => h.name === name);
}
var easterTable = {
  2e3: "2000-04-23",
  2021: "2021-04-04",
  2024: "2024-03-31",
  2025: "2025-04-20",
  2026: "2026-04-05",
  2027: "2027-03-28"
};
for (const [y, want] of Object.entries(easterTable)) {
  eq(`easter ${y}`, formatDate(easterSunday(Number(y))), want);
}
eq("koningsdag 2025 (27/4=zo\u219226/4)", startOf(generateHolidays(NL_SET, void 0, 2025, 2025), "Koningsdag"), "2025-04-26");
eq("koningsdag 2026 (27/4=ma)", startOf(generateHolidays(NL_SET, void 0, 2026, 2026), "Koningsdag"), "2026-04-27");
eq("bevrijdingsdag 2025 aanwezig", has(generateHolidays(NL_SET, void 0, 2025, 2025), "Bevrijdingsdag"), true);
eq("bevrijdingsdag 2026 afwezig", has(generateHolidays(NL_SET, void 0, 2026, 2026), "Bevrijdingsdag"), false);
eq("bevrijdingsdag 2025 datum", startOf(generateHolidays(NL_SET, void 0, 2025, 2025), "Bevrijdingsdag"), "2025-05-05");
{
  const kerst = generateHolidays(NL_SET, void 0, 2026, 2026).find((h) => h.name === "Kerst");
  eq("kerst 2026 start", kerst?.startDate, "2026-12-25");
  eq("kerst 2026 eind (2-daags)", kerst?.endDate, "2026-12-26");
}
{
  const uk2022 = generateHolidays(UK_SET, "EAW", 2022, 2022);
  eq("new year 2022 (za\u2192ma)", startOf(uk2022, "New Year's Day"), "2022-01-03");
  const uk2021 = generateHolidays(UK_SET, "EAW", 2021, 2021);
  eq("christmas 2021 (za\u2192ma 27)", startOf(uk2021, "Christmas Day"), "2021-12-27");
  eq("boxing 2021 (zo\u2192di 28)", startOf(uk2021, "Boxing Day"), "2021-12-28");
}
eq("buss- und bettag 2026 (SN)", startOf(generateHolidays(DE_SET, "SN", 2026, 2026), "Bu\xDF- und Bettag"), "2026-11-18");
eq("buss- und bettag landelijk afwezig", has(generateHolidays(DE_SET, void 0, 2026, 2026), "Bu\xDF- und Bettag"), false);
{
  const uk = generateHolidays(UK_SET, "EAW", 2026, 2026);
  eq("early may bank 2026 (1e ma)", startOf(uk, "Early May bank holiday"), "2026-05-04");
  eq("spring bank 2026 (laatste ma)", startOf(uk, "Spring bank holiday"), "2026-05-25");
}
eq("fronleichnam BY aanwezig", has(generateHolidays(DE_SET, "BY", 2026, 2026), "Fronleichnam"), true);
eq("fronleichnam BE afwezig", has(generateHolidays(DE_SET, "BE", 2026, 2026), "Fronleichnam"), false);
if (diffs.length === 0) {
  console.log("OK  holidays-check: alle checks groen");
  process.exit(0);
} else {
  console.log(`XX  holidays-check: ${diffs.length} afwijking(en)`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
