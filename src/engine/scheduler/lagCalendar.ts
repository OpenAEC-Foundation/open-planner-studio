/**
 * P6-default: "Calendar for scheduling Relationship Lag" = predecessor-kalender (fase 2.8a, §5.2).
 * De instelbare scheduling option is bewust fase 2.9 (TODO.md r217).
 *
 * Bron-onzekerheid (§12.1): het research-rapport vond tegenstrijdige bronnen over de fabrieksdefault
 * (Ten Six + planner-fora: predecessor; één zoekresultaat: successor). Beste inschatting = predecessor;
 * hier als constante vastgelegd, in 2.9 te ontsluiten als keuze. De CPM-testbatterij legt de gekozen
 * tak vast met de counterfactual ernaast (cases-kalenders.json, scenario 2).
 */
export const LAG_CALENDAR: 'predecessor' | 'successor' = 'predecessor';
