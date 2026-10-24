[English](README.md) · **Nederlands**

<div align="center">

# Open Planner Studio

**Open-source bouwplanning. Kritiek pad, MS Project- en Primavera P6-bestanden, IFC 4.3 als eigen formaat en een MCP-server.**

[![Versie](https://img.shields.io/github/package-json/v/OpenAEC-Foundation/open-planner-studio?label=versie&color=blue)](https://github.com/OpenAEC-Foundation/open-planner-studio/releases)
[![Downloads](https://img.shields.io/github/downloads/OpenAEC-Foundation/open-planner-studio/total?label=downloads&color=success)](https://github.com/OpenAEC-Foundation/open-planner-studio/releases)
[![CI](https://github.com/OpenAEC-Foundation/open-planner-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/OpenAEC-Foundation/open-planner-studio/actions/workflows/ci.yml)
[![Talen](https://img.shields.io/badge/talen-28-informational)](src/i18n/config.ts)
[![Licentie](https://img.shields.io/github/license/OpenAEC-Foundation/open-planner-studio)](#licentie)

### [Probeer in de browser](https://open-planner-studio.open-aec.com/) &nbsp;·&nbsp; [Download](https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest)

![Demo: relatie leggen, duur wijzigen, herberekenen, kritiek pad lezen](docs/images/readme/demo.gif)

</div>

Open Planner Studio (OPS) is een gratis planningsprogramma voor de bouw. Het rekent een planning door met de Critical Path Method, opent en schrijft de bestandsformaten die planners al gebruiken, en slaat op in IFC 4.3, de open standaard voor bouwinformatie.

Het draait in je browser zonder installatie, of als kleine native desktop-app op Windows, macOS en Linux.

## Probeer het

**[Open de browserversie](https://open-planner-studio.open-aec.com/)**. Hij start met een realistisch voorbeeldproject, dus je kunt meteen beginnen met klikken. Meer voorbeelden staan onder *Bestand › Voorbeelden*.

De ingebouwde Help heeft **78 gepubliceerde artikelen** in het Nederlands en Engels, met vertalingen in de andere UI-talen. Je kunt ook de [wiki](https://github.com/OpenAEC-Foundation/open-planner-studio/wiki) lezen of de [website](https://open-aec.com/open-planner-studio/) bezoeken.

## Download

Elke release staat op de [releasepagina](https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest).

| Platform | Installatiebestand |
|----------|--------------------|
| **Windows** | `.exe`-installer (x64) |
| **macOS** | `.dmg` (universeel: Apple silicon en Intel) |
| **Linux** | `.deb`, `.rpm`, `.AppImage`, of de [Snap Store](https://snapcraft.io/open-planner-studio) |

Geïnstalleerde apps werken zichzelf bij als er een nieuwe versie is (Windows, macOS, `.deb`, `.rpm` en AppImage). De Snap-versie werkt bij via de Snap Store.

## Waarom gebruiken?

- **Gratis en open.** LGPL-3.0. Geen licentiekosten, geen account, geen vendor lock-in.
- **Open formaten.** IFC 4.3 is het eigen projectformaat. Er is geen privé binair formaat.
- **Werkt met je bestaande bestanden.** Open Microsoft Project- (`.mpp`, `.xml`) en Primavera P6-bestanden (`.xer`, `.xml`) en exporteer naar MS Project XML, P6 XML en CSV.
- **Rekenregels naar keuze.** Reken per project met de conventies van Primavera P6, Microsoft Project of Open Planner Studio.
- **Gemaakt voor de bouw.** Feestdagen, bouwvak, werkkalenders, keuringsmomenten, fasering, resource-nivellering.
- **MCP.** Een ingebouwde MCP-server laat een AI-assistent je planning lezen en bewerken, met veiligheidsschakelaars die jij beheert.
- **Meertalig.** 28 talen, ook Arabisch en Perzisch (van rechts naar links).

## Schermafbeeldingen

| | |
|---|---|
| ![Kritiek pad](docs/images/readme/critical-path.png) **Kritiek pad en speling** | ![Tabel bewerken](docs/images/readme/table-editing.png) **Taaktabel als spreadsheet** |
| ![Resourcehistogram](docs/images/readme/resources-histogram.png) **Resourcehistogram en nivellering** | ![Kalender](docs/images/readme/calendar-dialog.png) **Kalenders en werktijd** |
| ![Rapportvoorbeeld](docs/images/readme/report-preview.png) **Rapporten met live voorbeeld** | ![AI-tab](docs/images/readme/ai-tab.png) **MCP** |
| ![Exportformaten](docs/images/readme/formats.png) **Exporteren naar andere formaten** | ![Help](docs/images/readme/help-viewer.png) **Help in de app** |

## Geavanceerd plannen

- **Critical Path Method** met totale, vrije en storende speling, negatieve speling, en een herberekening die je zelf start (of zet op automatisch).
- **Alle acht constrainttypen:** zo vroeg mogelijk, zo laat mogelijk, start/einde niet eerder dan, start/einde niet later dan, moet starten op, moet eindigen op (eventueel verplicht, "pin logic"), plus deadlines. Zie [Constraints](public/docs/nl/uitleg-constraints.md).
- **Alle vier de relatietypen** (FS, SS, FF, SF) met positieve en negatieve lag, in dagen of uren.
- **Hammocktaken** (level of effort) die het werk volgen waaraan ze hangen. Zie [Een hammock maken](public/docs/nl/howto-hammock.md).
- **Externe relaties (tussen projecten).** Een taak kan afhangen van een taak in een ander projectbestand via een vaste ankerdatum. De koppeling is niet live: het andere project wordt niet herberekend. Zie [Externe relaties](public/docs/nl/howto-externe-relaties.md).
- **Bijna-kritieke taken** met een drempel die je zelf instelt, en **meerdere speling-paden** (pad 1, 2, 3 ...) om meer te zien dan de ene langste keten.
- **Rekenprofielen.** Drie ingebouwde profielen: *Open Planner Studio*, *Primavera P6* en *Microsoft Project*. Een profiel is een set conventies voor de punten waar beide programma's anders rekenen. Zie [Rekenprofielen](public/docs/nl/uitleg-rekenprofielen.md).
- **Taaktypen (werkregels).** Kies per taak vaste duur en inzet, vaste duur en werk, vast werk of vaste inzet. Duur, resource-eenheden en werk worden bij bewerken op elkaar afgestemd. Toewijzingen hebben één regel per resource, met eenheden en resterend werk in uren. Zie [Taaktypen](public/docs/nl/uitleg-werkregels.md).
- **Dagen en uren.** Kies de duureenheid per taak; uren worden getoond als `10u` in het Nederlands (`10h` in het Engels).
- Werkstructuur (WBS), baselines, voortgang en statusdatum, taken splitsen in de Gantt, resource-nivellering en een bezettingsoverzicht over projecten heen.
- **Resourcebibliotheken.** Deel resources en kalenders tussen projecten, met herkomststempels per item.

## Interoperabiliteit

IFC 4.3 ADD2 is standaard het eigen formaat, geschreven als schemageldige IFC. Elk ander formaat is een adapter. Wat werkt per formaat (alle details in [Import- en exportformaten](public/docs/nl/ref-import-exportformaten.md)):

| Formaat | Openen | Opslaan / exporteren |
|---------|--------|----------------------|
| **IFC** (4 en 4.3) | Ja | Ja, het enige formaat waarin je opslaat. Bevat het hele project |
| **MS Project XML** (MSPDI) | Ja | Export |
| **MS Project `.mpp`** (2010 t/m 2021) | Ja, alleen lezen | Nee |
| **Primavera P6 XML** | Ja, meerdere projecten per bestand | Export |
| **Primavera P6 `.xer`** | Ja, alleen lezen; één tabblad per project | Nee |
| **CSV** | Ja | Export |

Het oorspronkelijke `.xer`-bestand blijft bewaard in de opgeslagen IFC. **Datums zoals opgeslagen** toont de datums die P6 of MS Project heeft bewaard, voordat je herberekent.

Voortgang kan ook via een spreadsheet: exporteer een voortgangsblad (`.xlsx` of `.csv`), vul het op de bouwplaats in en lees het terug in het open project.

Niet elk gegeven overleeft elk formaat, bijvoorbeeld baselines in `.mpp` of activiteitcodes in MS Project XML. De documentatie noemt precies wat meegaat en wat verandert. De `.mpp`-lezer is voor OPS geschreven en is afgeleid van de structuurkennis van [MPXJ](https://github.com/joniles/mpxj) (LGPL-2.1).

## Rapportage

Elf rapporttypen, met live voorbeeld, te exporteren naar PDF (A4 tot A1):

Gantt-diagram, Resourcediagram, Mijlpalenoverzicht, Afwijking, Vooruitblik, Kritiek en bijna-kritiek, Voortgangsrapport, Planningsgezondheid, Resourcebelasting, Resourcetoewijzingen, WBS-samenvatting.

Planningsgezondheid bevat een DCMA 14-puntencontrole. Rapporten kunnen een rapportageperiode beslaan, vergelijken met een baseline en het filter en de groepering van je scherm volgen (Gantt-diagram). Zie [Rapporttypen](public/docs/nl/ref-rapporttypes.md).

## MCP

OPS kan een lokale **MCP-server** (Model Context Protocol) draaien, zodat een AI-assistent werkt met de planning die je open hebt. Hij biedt 41 `planner_*`-tools om taken, relaties, resources, kalenders, baselines en documenten te lezen en te wijzigen. Jij bepaalt wat de assistent mag: pauze, alleen-lezen, automatische back-ups en een activiteitenlog staan op het tabblad *AI*. De server staat standaard uit en draait alleen in de desktop-app.

Zie [Een AI-assistent koppelen](public/docs/nl/howto-ai-assistent-koppelen.md) en de [toolreferentie](public/docs/nl/ref-ai-tools.md).

## Testen en betrouwbaarheid

**Getest met echte MS Project- en P6-planningen.** De getallen hieronder komen uit de code en vastgepinde testmanifesten in deze repository. Ze beschrijven de testdekking en zijn geen garantie voor elk bestand.

- **573 datagedreven planningscases** in 24 batterijen (`tests/planning/cases-*.json`). De verwachte waarden zijn met de hand uit de CPM-theorie berekend, niet overgenomen uit de uitvoer van de motor.
- **424 aanvullende contractcheck-bestanden** (`tests/planning/check-*.ts`), en een tijdzonematrix met vijf tijdzones.
- **Browsertests.** 135 Playwright-specbestanden bedienen echt Chromium met echte muis- en toetsenbordevents (`tests/browser/`).
- **MS Project-getrouwheid.** Een vastgepinde baseline van 216 `.mpp`-bestanden (3.413 taken) legt vast dat na herberekening elke start en elk einde gelijk is aan de datums die MS Project in het bestand bewaarde. De bestanden zelf staan niet in deze repository, dus deze poort draait alleen op een machine die ze heeft. De baseline staat in [`tests/planning/mpp-fidelity-baseline.json`](tests/planning/mpp-fidelity-baseline.json).
- **Primavera P6-vergelijking.** 93 openbare `.xer`-bestanden zijn op herkomst geclassificeerd. Negen daarvan, door P6 zelf doorgerekend, dienen als referentie ([`tests/planning/xer-corpus-manifest.json`](tests/planning/xer-corpus-manifest.json)).
- **Andere formaten.** MS Project XML (MSPDI), P6 XML, CSV en IFC hebben import-/export- en round-trip-contractchecks in `tests/planning/`; hiervoor noemen we geen vast aantal externe testbestanden.
- **Vijf suites** draaien achter `npm test`: `planning`, `library`, `mcp`, `dev-server` en `browser`.
- CI draait de hele poort (`npm run verify`) bij elke pull request. Een rode suite blokkeert de deploy en de release.

Bronnen van de aantallen: [`public/docs/manifest.json`](public/docs/manifest.json) (gepubliceerde artikelen; concepten tellen niet mee), [`src/i18n/locales.ts`](src/i18n/locales.ts) (28 talen), [`src/services/mcp/toolRegistry.ts`](src/services/mcp/toolRegistry.ts) en de geregistreerde modules (41 tools). Voor planning en browser tellen de bestandspatronen hierboven.

## Huidige beperkingen

OPS is jonge software. Ken deze punten voordat je erop vertrouwt:

- **`.mpp` en `.xer` zijn alleen-lezen.** Je kunt geen van beide schrijven. Opslaan gaat naar IFC. Exporteer naar MS Project XML of P6 XML om een planning terug te geven.
- **`.mpp` neemt geen baselines, kosten, tarieven, notities of eigen velden mee.** Bestanden van MS Project 2007 of ouder en met wachtwoord beveiligde bestanden worden geweigerd.
- **Geen kostenbeheer.** Resources kunnen een uurtarief hebben, maar OPS kent geen kostenrapporten of kostencurves. Het plant tijd en resources.
- **Relaties tussen projecten gebruiken een vaste ankerdatum.** Ze worden niet live herberekend met het andere project.
- **De P6 XML-export laat** baselines, deadlines, activiteitcodes, eigen velden en notities weg.
- **De MCP-server vraagt de desktop-app.** In de browser is het AI-tabblad zichtbaar, maar de bridge start niet.
- **4D BIM staat op de roadmap, is niet gebouwd.** Taken koppelen aan elementen van een IFC-gebouwmodel kan nog niet. Omdat de planning een standaard IFC 4.3-bestand is, kun je hem nu al samenvoegen met een gebouwmodel en taken aan elementen koppelen in andere IFC-tools, zoals IfcOpenShell of Bonsai. Zie [Het IFC-schema kiezen](public/docs/nl/howto-ifc-schema-kiezen.md). Over de werking van die tools geven we geen garanties.
- **Bekende problemen.** [`knownbugs.md`](knownbugs.md) noemt openstaande problemen, bijvoorbeeld rond enkele constraint-randgevallen en urenplanning van voortgang.
- **Rekenpariteit is gemeten, niet gegarandeerd.** OPS volgt de conventies van P6 en MS Project dicht, maar een bijzondere planning kan toch anders rekenen. Vergelijk kritieke uitkomsten voordat je iets overdraagt.

Iets gevonden? [Maak een issue aan](https://github.com/OpenAEC-Foundation/open-planner-studio/issues).

## Onder de motorkap

De desktop-app is gebouwd met Tauri 2, dus de installers zijn klein en gebruiken de webweergave van het systeem. Het Rust-deel is een dunne native schil met drie commando's. De rekenkern is geschreven in TypeScript. Het is dezelfde code in de browser en op de desktop. De interface is React 19 en de Gantt-tijdlijn wordt getekend op een Canvas 2D-vlak.

## Bijdragen

- **Probeer het op een echt project** en meld bugs of ontbrekende functies: gebruik de feedbackknop in de app, of [maak een GitHub-issue aan](https://github.com/OpenAEC-Foundation/open-planner-studio/issues/new).
- **Deel ideeën of stel vragen** in [GitHub Discussions](https://github.com/OpenAEC-Foundation/open-planner-studio/discussions).
- **Stuur testbestanden.** `.mpp`-, `.xer`- en P6 XML-bestanden helpen ons de import te verbeteren, en met veel testbestanden kunnen we in de toekomst misschien ook de export verbeteren. Zie [de discussie over testbestanden](https://github.com/OpenAEC-Foundation/open-planner-studio/discussions/71). Haal eerst vertrouwelijke gegevens weg.
- **Schrijf code.** Lees [CONTRIBUTING.md](CONTRIBUTING.md) en open een pull request.

## Snel starten (ontwikkelaars)

```bash
npm ci        # niet "install": de lockfile is bindend
npm run dev   # print zelf de poort
```

Vereist Node 22. Rust is alleen nodig voor `npm run tauri:dev` en `npm run tauri:build`.

Stack: Tauri 2, React 19 en TypeScript, Canvas 2D voor de Gantt-tijdlijn, Zustand en Immer, TailwindCSS 4, Vite, react-i18next.

Voor architectuur, de testpoort en conventies: lees [CONTRIBUTING.md](CONTRIBUTING.md) en [AGENTS.md](AGENTS.md). De roadmap staat in [PLAN.md](PLAN.md). Meld beveiligingsproblemen via [SECURITY.md](SECURITY.md), niet via een issue.

Open Planner Studio hoort bij de familie apps van de [OpenAEC Foundation](https://github.com/OpenAEC-Foundation).

## Licentie

LGPL-3.0. Zie [LICENSE](LICENSE).

## Handelsmerken

Microsoft Project is een handelsmerk van Microsoft Corporation. Oracle Primavera P6 is een handelsmerk van Oracle. Open Planner Studio is een onafhankelijk project en is niet verbonden aan, goedgekeurd door of gesponsord door Microsoft of Oracle. Deze namen staan er alleen om bestandscompatibiliteit te beschrijven.
