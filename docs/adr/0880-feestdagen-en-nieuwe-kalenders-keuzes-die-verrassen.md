# Feestdagen en nieuwe kalenders: keuzes die verrassen

Een paar keuzes in `src/engine/calendar/` lijken overbodig of te grof, maar hebben een reden die niet uit de code
blijkt. De dagregels van de tijdas (`workdayRules.ts`) staan niet hier: die beschrijft de spec
`docs/superpowers/specs/2026-10-20-alleen-uren-design.md` (§0, §4.2 en §8 onder B10).

## Gevolgen

- Een nieuwe kalender uit de kalenderdialoog, de resourcerij of MCP `update_calendar` met `create: true` krijgt
  dezelfde landenset feestdagen als een nieuw project (`createNewCalendar` in `defaultCalendar.ts`), dus in bouwmodus
  de NL-feestdagen, en geen lege lijst. Of er feestdagen in zitten, volgt de instelling Bouwmodus en niet de knop. De
  fouten zijn niet symmetrisch: een vergeten feestdag plant stil werk op Kerst, een ongewenste staat zichtbaar in de
  lijst en is in één handeling weg.
- De bouwvak komt uit een tabel per jaar met de adviesdatums van Bouwend Nederland (`NL_BOUWVAK` in `holidays.ts`) en
  niet uit een formule: de volgorde van de regio's Noord, Midden en Zuid wisselt elk jaar (te zien in de
  tabel: 2025 Zuid eerst, 2026 en 2027 Noord, 2028 Midden). De terugval voor jaren buiten de tabel (`bouwvakApprox`) kent die wisseling niet en is
  grof; de Help zegt dat. De bronnen per jaar:
  2025 businessgids.nl, hello-office.nl en shiftbase.com (andere sites verwarden Noord en Midden); 2026
  fnv.nl en vakantie-data.nl; 2027 vakantie-data.nl; 2028 beaks.nl en wanneerbouwvak.nl. Waar een bron zaterdag tot zondag noemt, is dat omgezet
  naar maandag tot vrijdag; beaks.nl noemt een startdatum die steeds twee dagen afwijkt, de einddatum klopt.
- Bolivia (`BO_SET` in `holidays.ts`) volgt DS 2750 art. 2–3, gewijzigd door DS 5019. De afwijkingen in 2026
  (`onlyYear`, `ruleByYear`) komen uit DS 5521 en de comunicados van het ministerie van Arbeid (MTEPS), de
  departementale feestdagen uit #992:
  `https://intranet.mineria.gob.bo/wp-content/uploads/2026/01/DS-5521.pdf`,
  `https://mintrabajo.gob.bo/index.php/nota_prensa/la-paz-12/` en
  `https://mintrabajo.gob.bo/index.php/lista-comunicados-page/page/2/`.
