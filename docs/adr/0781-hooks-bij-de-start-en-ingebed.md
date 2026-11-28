# Hooks bij de start en ingebed: keuzes die verrassen

Een paar opstarthooks in `src/hooks/` maken een keuze die een collega zonder uitleg zou terugdraaien. De volgorde van
herstel, welkomst en host staat verder in de regel `settings-autosave`, in `docs/platformbouw.md` en in de ADR's over
herstel (0190 tot en met 0193, 0475).

## Gevolgen

- `useSiteInitialFile` en `useSiteHostPreferences` luisteren ook op een same-origin parent (`siteHostWindows`). Zo'n
  luisteraar verdwijnt niet met het iframe: de pagina van de site leeft door (Frappe desk is een single-page-app) en
  houdt via de closure de hele app vast. Daarom melden ze zich ook af bij `pagehide` van het eigen venster, niet alleen
  bij de cleanup van React, en staat het afmelden in een `try` omdat de parent intussen weg kan zijn.
- `useSettingsBootstrap` roept geen `saveWelcomeSeen` aan als het welkomstvenster wordt overgeslagen
  (`skipWelcomeReason`): de host beslist per start, en zonder host hoort het venster nog één keer te komen.
- `useSettingsBootstrap` initialiseert de taakgridvoorkeuren pas na de herstelkeuze. Bij de mount staat nog het lege
  startdocument in de store; lezen op dat moment legt de standaardkolommen en een oude actieve `view.columns` vast uit
  het verkeerde document.
- `useRecoveryRestore` zet de poort van Automatisch opslaan (`finish()`) ook open als herstellen mislukt. De poort
  dichthouden betekent dat er vanaf dan niets meer wordt weggeschreven, een groter risico dan het verlies van die ene
  snapshotgeneratie; de snapshots worden vastgehouden (`holdRecoveryForLater`) en de fout gaat naar het meldingenkanaal.
