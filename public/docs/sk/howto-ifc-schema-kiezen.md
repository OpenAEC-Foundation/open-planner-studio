# Výber schémy IFC

Cieľ: uložte svoj plán v schéme IFC modelu budovy, s ktorým ho chcete spojiť.

## Kedy to potrebujete

Predvolené nastavenie je, že aplikácia ukladá projekt ako IFC 4.3 ADD2. Toto je názov IFC 4.3 v súboroch, ktoré vytvárajú IfcOpenShell a Bonsai. Ak chcete spojiť plán so stavebným modelom do jedného súboru 4D, napríklad pomocou receptu *MergeProjects* z IfcOpenShell (ifcpatch), musia mať oba súbory rovnakú schému. Ak je stavebný model súbor IFC4, IfcOpenShell odmietne spojiť ho s plánom v IFC 4.3. Vtedy tu vyberte schému modelu.

## Postup

1. Otvorte *Nastavenia projektu*: *Nastavenia › Projekt › Nastavenia projektu*, alebo *Súbor › Nastavenia projektu*.
2. V časti *Schéma IFC pri ukladaní* vyberte schému vášho modelu budovy.
3. Kliknite na *Použiť*. Projekt je teraz *Neuložené*.
4. Uložte pomocou *Uložiť* (Ctrl+S) alebo *Uložiť ako*.

Tri možnosti:

- *IFC 4.3 ADD2 (predvolené)* zapíše `IFC4X3_ADD2` do hlavičky súboru.
- *IFC 4.3* zapíše `IFC4X3`. Tak zapisovali IFC 4.3 staršie verzie aplikácie.
- *IFC4* zapíše `IFC4`, pre stavebný model v IFC4.

## Úskalia a čo aplikácia robí

**Spojenie ako posledný krok.** Neotvárajte spojený súbor 4D (stavebný model plus plán) v aplikácii, aby ste ho znova uložili. Aplikácia zachová len plán: steny a ostatné časti stavebného modelu sa stratia, aj keď zachováte schému. Zmeňte plán vo svojom vlastnom súbore a potom ho znova spojte.

**Aplikácia sa najprv opýta, ak otvorený súbor má inú schému.** Ak otvoríte napríklad súbor IFC4 alebo súbor IFC 4.3 zo staršej verzie aplikácie, aplikácia jednoducho nezmení typ súboru. Pri prvom uložení pomocou *Uložiť* alebo *Uložiť ako* sa najprv opýta, či chcete zachovať schému súboru, alebo prejsť na IFC 4.3 ADD2. *Zachovať IFC4* (alebo *Zachovať IFC 4.3*) je tlačidlo, ktoré vyberie Enter. Ak otázku zatvoríte klávesom Esc alebo krížikom, aplikácia nič neuloží.

**Aplikácia sa pýta len raz pre každý súbor.** Vaša voľba sa uloží priamo v súbore. Ak ho neskôr znova otvoríte, aplikácia sa znova nepýta. Ak sami vyberiete schému v okne *Nastavenia projektu* a kliknete na *Použiť*, aplikácia sa ani nepýta.

**Schéma, ktorú aplikácia nevie zapísať**, napríklad IFC2X3, sa v aplikácii otvorí. Pri prvom uložení otázka to povie a vy vyberiete jednu z troch schém uvedených vyššie.

**Automatické ukladanie a zotavenie zo zlyhania sa nepýtajú nič.** Zapisujú schému súboru a otázku nechávajú na prvé uloženie, ktoré urobíte sami. Pri schéme, ktorú aplikácia nevie zapísať, *Automatické ukladanie* nezapíše do súboru, kým neodpoviete na otázku.

**Nový projekt sa nepýta nič.** Nový projekt a projekt z iného formátu, napríklad XER, MPP alebo CSV, sa začne s *IFC 4.3 ADD2 (predvolené)*.

**Obsah súboru sa nemení.** Tri schémy poznajú údaje o plánovaní, ktoré aplikácia zapisuje rovnakým spôsobom. Líši sa len riadok `FILE_SCHEMA` v hlavičke. Pri výbere inej schémy teda nič nestratíte.

**Model IFC 4.3 z IfcOpenShell alebo Bonsai** má zvyčajne v hlavičke `IFC4X3_ADD2`, rovnako ako predvolené nastavenie aplikácie. IfcOpenShell do neho nespojí plán s `IFC4X3`. Ak si nie ste istí, pozrite sa na riadok `FILE_SCHEMA` na začiatku súboru modelu.

**Vrátiť späť nemení schému.** Schéma patrí k súboru, rovnako ako miesto, kde je uložený. Voľba v okne *Nastavenia projektu* a odpoveď na otázku pri ukladaní preto nie sú krokom v príkaze *Vrátiť späť*. Ak sa chcete vrátiť, vyberte inú schému v okne *Nastavenia projektu*. Tak *Automatické ukladanie* nikdy potichu nezapíše inú schému potom, ako vrátite späť úpravu.

## Pozri aj

- [Nový projekt a Nastavenia projektu](docs://ref-projectinfo): všetky polia formulára.
- [Súbory a formáty](docs://uitleg-bestanden): prečo je IFC vlastný formát aplikácie.
- [Otvorenie a uloženie súboru](docs://howto-bestand-openen-en-opslaan): uložiť a uložiť ako.
