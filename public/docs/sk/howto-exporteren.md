# Exportovanie

Cieľ: odovzdať váš plán ako súbor v inom formáte, pre niekoho, kto nečíta IFC, alebo pre iný balík.

## Kedy to potrebujete

Konzultant pracuje v MS Project, klient v Primavere, subdodávateľ chce úlohy v Exceli, alebo posielate plán balíku, ktorý nezvláda IFC. Export je kópia v inom formáte. Ak chcete uchovať samotný projekt, uložte ho: zapíše sa IFC a všetko sa uloží spolu s ním. Čo každý formát prenesie a čo nie, je v [Súbory a formáty](docs://uitleg-bestanden).

## Kroky

1. Vyberte *Domov › Súbor › Exportovať* a zvoľte formát zo zoznamu, alebo vyberte *Súbor › Exportovať*. Tam je každý formát zobrazený ako karta s krátkym popisom.
2. V okne zvoľte názov a miesto. Aplikácia navrhne názov projektu s koncovkou formátu. Hárky postupu sa volajú *projectname-voortgang* a otvoria sa, ak je to možné, v priečinku pre sťahovanie.
3. Potvrďte. Ak export prebehne, žiadna správa sa nezobrazí, okrem správ nižšie. Ak exportujete cez *Súbor › Exportovať*, potom sa vrátite na kartu *Domov*, aj keď okno zrušíte. Ak okno zrušíte pri exporte zo zoznamu na karte *Domov*, nestane sa nič.

Ak váš prehliadač ukladá len cez sťahovanie (napríklad Firefox), súbor je v priečinku pre sťahovanie hneď po kroku 1. Zobrazí sa správa *Uložené ako stiahnutý súbor: „name.xml“ je teraz v priečinku pre sťahovanie. Toto prostredie neumožňuje aplikácii zapisovať priamo na zvolené miesto.*

### Ktorý formát zvolíte?

Zoznam na karte *Domov* a karty v *Súbor › Exportovať* ponúkajú rovnaké formáty:

- *Postup (Excel)* a *Postup (CSV)*, na kartách *Hárok postupu (Excel)* a *Hárok postupu (CSV)*: štíhly hárok s ID, WBS, názvom, dátumami a percentom dokončenia, ktorý rozošlete tomu, kto doplní postup.
- *CSV (;)*, na karte *CSV (oddelené bodkočiarkou)*: zoznam úloh, ktorý otvoríte v tabuľkovom procesore.
- *MS Project XML*: dá sa otvoriť v Microsoft Project.
- *Primavera P6 XML*: pre Oracle Primavera P6.
- *IFC 4x3*: vlastný formát aplikácie, ktorý obsahuje všetko.

### IFC export so súborom knižnice

Ak je váš projekt prepojený s knižnicou, začiarkavacie políčko *Uložiť súbor knižnice vedľa* je pod kartami v *Súbor › Exportovať*. Ak ho začiarknete a zvolíte *IFC 4x3*, aplikácia dvakrát pýta miesto: najprv pre projekt, potom pre *projectname-bibliotheek.ifc*. Toto políčko je len v *Súbor › Exportovať*, nie v zozname na karte *Domov*.

### Obnovenie hárka postupu

Vyplnený hárok postupu načítate späť cez *Súbor › Importovať*. Pozrite si [Import postupu z tabuľkového hárka](docs://howto-voortgang-importeren).

## Úskalia a čo vtedy aplikácia urobí

**Váš projekt sa nezmení.** Súbor projektu zostane rovnaký a značka *Neuložené* zostane, ak tam bola.

**Zastaraný plán sa najprv prepočíta.** Dostanete teda aktuálne dátumy, aj keď ste zabudli stlačiť *Prepočítať*.

**Export je aj v zozname Nedávne.** To neplatí pre hárky postupu. Ak tam otvoríte export, otvorí sa ako import tohto formátu.

**Export neprenesie všetko.** Súbor CSV nemá zdroje ani obmedzenia, P6 XML nemá pôvodné plány ani termíny. Ani profil výpočtu sa neprenesie: znovu otvorený export sa počíta ako *Open Planner Studio*. Len IFC prenesie všetko. Príklad s číslami nájdete v [Súbory a formáty](docs://uitleg-bestanden).

**Dva formáty s rovnakou koncovkou.** MS Project XML aj Primavera P6 XML dostanú názov *projectname.xml*. Dajte im vlastné názvy, inak neskôr nebudete vedieť, ktorý súbor je ktorý formát.

**Plán s kruhovou závislosťou sa neexportuje.** Aplikácia najprv počíta plán a zastaví sa, ak je v ňom slučka. Na karte *Domov* dostanete správu *Plán sa nepodarilo prepočítať*, pod ňou napríklad *Kruhová závislosť medzi úlohami: Set up site → Demolish existing extension → Set up site*. V *Súbor › Exportovať* je na stránke len ten druhý text. Odstráňte slučku a exportujte znova.

**Projekt z Primavery stratí údaje o pôvode.** Ak takýto projekt exportujete do CSV, MS Project XML alebo P6 XML, aplikácia nahlási: *Pri exporte do CSV sa stratia údaje o pôvode XER.* Pre MS Project XML sa zobrazí *MSPDI*, pre P6 XML *P6*. Pozrite si [Otvorenie súboru Primavera P6 (.xer)](docs://howto-xer-openen).

**Rozdelené úlohy stratia svoje rozdelenie.** MS Project a Primavera poznajú rozdelenie len ako hodinové rozloženie práce. Ak váš projekt obsahuje rozdelené úlohy bez hodinového rozloženia práce, aplikácia po exporte do MS Project XML alebo P6 XML nahlási: *2 úlohy s prestávkami boli exportované bez prestávok: MS Project a P6 ich poznajú len ako rozloženie práce.* Pri jednej úlohe nahlási: *1 úloha s prestávkami bola exportovaná bez prestávok: MS Project a P6 ich poznajú len ako rozloženie práce.* Pozrite si [Rozdelenie úlohy](docs://howto-taak-splitsen).

**Plán v zobrazení *Dátumy podľa záznamu*.** Ak exportujete do CSV, keď vidíte dátumy z pôvodného súboru, aplikácia nechá prázdne polia `Critical` a `Total Float` pri úlohách, pri ktorých pôvodný súbor toto nezaznamenal. Pozrite si [Dátumy podľa záznamu](docs://uitleg-datums-zoals-opgeslagen).

## Pozri tiež

- [Súbory a formáty](docs://uitleg-bestanden): čo každý formát prenesie a čo nie.
- [Otvorenie a uloženie súboru](docs://howto-bestand-openen-en-opslaan): uchovanie samotného projektu ako IFC.
- [Import postupu z tabuľkového hárka](docs://howto-voortgang-importeren): načítanie vyplneného hárka postupu.
- [Formáty importu a exportu](docs://ref-import-exportformaten): pre každý formát, čo sa prenesie a čo nie.
