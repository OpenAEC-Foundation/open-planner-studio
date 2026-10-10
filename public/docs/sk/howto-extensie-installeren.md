# Inštalácia a správa rozšírenia

Cieľ: nainštalovať rozšírenie, prečítať otázku na povolenie a neskôr rozšírenie zakázať alebo odstrániť.

## Kedy to potrebujete

Rozšírenie pridá aplikácii niečo bez toho, aby ste čakali na novú verziu. Rozšírenie môže napríklad pridať formát importu, ktorý sa objaví v *Súbor › Importovať*, umiestniť tlačidlo v páse s nástrojmi alebo dodať písmo pre export do PDF. Oficiálny katalóg ich delí do kategórií: *Import/Export*, *Plánovanie*, *Zostavy*, *Nástroje*, *Písma* a *Iné*.

Pred inštaláciou rozšírenia dobre zvážte, či ho chcete nainštalovať. Rozšírenie je programový kód, ktorý beží s rovnakými právami ako samotná aplikácia, a aplikácia to nemôže obmedziť. Preto aplikácia pri každej inštalácii pýta povolenie. Čo v tejto otázke vidíte, je vysvetlené nižšie.

## Kroky

### Inštalácia rozšírenia z katalógu

1. Vyberte *Súbor › Rozšírenia*.
2. Vyberte kartu *Prehľadávať*. Aplikácia načíta katalóg, kým zobrazuje *Načítavanie katalógu...*. O obsahu katalógu rozhoduje OpenAEC Foundation, ktorá ho spravuje. Tento obsah sa môže zmeniť.
3. Vyhľadajte rozšírenie pomocou poľa *Hľadať rozšírenia...*. Hľadá v názve, popise, autorovi a značkách.
4. Na karte každého rozšírenia vidíte názov, verziu, kategóriu, popis a autora. Kliknite na *Nainštalovať*.
5. Otvorí sa okno *Nainštalovať rozšírenie?*. Prečítajte si ho. Pozrite si ďalší krok.
6. Na pokračovanie kliknite na *Nainštalovať*. Ak kliknete na *Neinštalovať*, nič sa nestane. Stlačenie klávesu Esc alebo kliknutie vedľa okna sa tiež považuje za odmietnutie. Aplikácia potom nezobrazí žiadne chybové hlásenie.

Po inštalácii je rozšírenie hneď zapnuté. V karte *Prehľadávať* teraz pri rozšírení vidíte *Nainštalované*. Čo rozšírenie pridá, uvidíte priamo v aplikácii: nové tlačidlo v páse s nástrojmi alebo formát importu v *Súbor › Importovať*. Niektoré rozšírenia zobrazia aj hlásenie. Spoznáte ho podľa predpony *Extension* a názvu rozšírenia.

### Inštalácia rozšírenia zo súboru

Ak ste dostali rozšírenie ako súbor, nainštalujte ho takto.

1. Vyberte *Súbor › Rozšírenia*.
2. Vpravo hore kliknite na *ZIP* pre súbor ZIP alebo na *JS* pre samostatný súbor JavaScript.
3. Vyberte súbor. Otvorí sa okno *Nainštalovať rozšírenie?*, ako je uvedené vyššie.

Súbor ZIP musí obsahovať `manifest.json` a hlavný súbor rozšírenia. Ak nainštalujete rozšírenie, ktoré je už nainštalované, nová verzia nahradí predchádzajúcu. Ak aplikácia súbor nedokáže nainštalovať, napríklad preto, že súbor ZIP je poškodený, nestane sa nič: aplikácia pri ZIP a JS nezobrazí žiadne chybové hlásenie a rozšírenie sa v zozname neobjaví. Dôvod však nájdete v ladiacom termináli. Zapnite ho v *Nastavenia › Projekt › Nastavenia*, na karte *Rozšírené*, cez *Zapnúť ladiaci terminál*. Otvoríte ho tlačidlom *Zobraziť ladiaci terminál* v stavovom riadku. Tam sa zobrazí napríklad text *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (aplikácia tento technický text píše po holandsky).

### Prečítajte si otázku na povolenie

Otázka ukazuje, čo musíte rozhodnúť.

- *Autor* a *Repozitár* uvádzajú, kto rozšírenie vytvoril a kde je zdrojový kód.
- *Pôvod* uvádza, odkiaľ súbor pochádza: *Z online katalógu rozšírení*, *Zo súboru ZIP v tomto počítači* alebo *Zo súboru JavaScript v tomto počítači*. Pod ním je uvedené, či bol súbor overený. Pri katalógu sa zobrazí *Stiahnutie overené pomocou kontrolného súčtu z katalógu*. Ak katalóg kontrolný súčet neposkytuje, zobrazí sa červeným písmom *Katalóg neposkytuje kontrolný súčet. Toto stiahnutie nebolo overené*. Pri súbore, ktorý ste vybrali sami, sa zobrazí *Tento súbor ste vybrali sami. Nie je k dispozícii žiadny externý zdroj na overenie*.
- *Na čo súhlasíte* uvádza: *Rozšírenie je programový kód, ktorý beží s rovnakými právami ako samotná aplikácia Open Planner Studio. Nič ho neobmedzuje. Inštalujte iba rozšírenia, ktorých autorovi dôverujete*. Pod ním sa uvádza, čo to znamená na vašej platforme. V desktopovej aplikácii sa zobrazí *V desktopovej aplikácii to znamená najmä: čítanie a zápis súborov v celom používateľskom priečinku a prístup k vašim projektom, nastaveniam a schránke*. V prehliadači sa zobrazí *V prehliadači to znamená: prístup k uloženým projektom a nastaveniam, k súborom, ku ktorým ste udelili prístup, a k sieti*.
- *Čo toto rozšírenie uvádza, že používa* zobrazuje oprávnenia, ktoré autor uviedol, ako malé štítky. Ide o vyhlásenie autora, nie o obmedzenie. *Toto je vyhlásenie autora, nie obmedzenie. Kód môže aj tak robiť viac*. Ak štítok nie je, zobrazí sa *Nič nebolo uvedené*. To neznamená, že rozšírenie nemôže nič robiť. Aj bez štítkov môže rozšírenie čítať a meniť údaje vášho plánu a zobrazovať hlásenia.

Štítky znamenajú toto:

- *ribbon*: rozšírenie umiestni tlačidlá do pásu s nástrojmi.
- *events*: rozšírenie sleduje udalosti v aplikácii.
- *backstage*: rozšírenie pridá formáty importu do *Súbor › Importovať*.
- *pdf-fonts*: rozšírenie dodá písmo pre export do PDF.
- *importSource*: rozšírenie môže čítať celé pôvodné bajty každého súboru, ktorý importujete, napríklad surový súbor Primavera, vrátane polí, ktoré sa nedostanú do vášho projektu. Aj samotné okno to vysvetľuje.
- *help*: rozšírenie môže pridať články nápovedy, otvoriť priložené projekty ako nový dokument a zobraziť sprievodcu, ktorý ukazuje na časti aplikácie. Aj samotné okno to vysvetľuje.
- *filesystem* a *network*: ide iba o naznačenie, čo autor zamýšľa. Aplikácia pre ne nemá žiadnu funkciu.

### Zakázanie, opätovné povolenie alebo odstránenie rozšírenia

1. Vyberte *Súbor › Rozšírenia* a kartu *Nainštalované*. Každé rozšírenie má kartu s názvom, verziou, kategóriou, popisom a autorom.
2. Prepínačom na karte rozšírenia ho vypnete (*Zakázať*) alebo znova zapnete (*Povoliť*). Ak je rozšírenie zakázané, tlačidlá a formáty importu, ktoré pridalo, zmiznú, ale rozšírenie zostane nainštalované. Ostane vypnuté aj po reštarte aplikácie. Zapnuté rozšírenie sa spustí samo pri štarte aplikácie.
3. Kliknite na *Odstrániť*. Tlačidlo sa zmení na *Potvrdiť* s vysvetlením *Kliknite znova na trvalé odstránenie*. Kliknite ešte raz, aby ste rozšírenie odstránili. Aplikácia tiež vymaže nastavenia, ktoré si rozšírenie uložilo.

## Úskalia a čo vtedy aplikácia robí

**Katalóg sa nenačíta.** Zobrazí sa *Katalóg sa nepodarilo načítať:* s technickým dôvodom za ním a tlačidlo *Skúsiť znova*. Môže to byť preto, že nemáte pripojenie na internet.

**Pod kartou v katalógu sa zobrazí *Inštalácia zlyhala.***  Sťahovanie alebo inštalácia zlyhala, napríklad preto, že kontrolný súčet nesedel. Nič sa vtedy nenainštalovalo. To sa líši od odmietnutia otázky. Vtedy sa žiadne chybové hlásenie nezobrazí.

**Nad zoznamom sa zobrazí *Preskočené položky katalógu: 1*.** Katalóg obsahoval položku, ktorú aplikácia nedokáže použiť. Ostatné rozšírenia môžete nainštalovať ako obvykle.

**Rozšírenie sa nespustí.** Na karte sa vtedy zobrazí chybové hlásenie, napríklad že rozšírenie potrebuje novšiu verziu Open Planner Studio. Zobrazí sa aj vaša aktuálna verzia. Prípadne sa zobrazí chyba, ktorú nahlásilo samo rozšírenie. Rozšírenie vtedy nie je aktívne. Aktualizujte aplikáciu alebo rozšírenie odstráňte.

**Karta s označením *Karanténa*.** Aplikácia nemohla použiť uložené rozšírenie. Pod názvom je uvedené *Dôvod:* a príčina. Tlačidlom *Odstrániť z úložiska* ho odstránite.

**Rozšírenie napíšete sami.** Príručka pre autorov rozšírení (manifest, API, oprávnenia) je v repozitári `OpenAEC-Foundation/open-planner-studio` na GitHube, v súbore `docs/extensions.md`.

**Rozšírenie nepatrí k jednému projektu.** Rozšírenia sa ukladajú v aplikácii: v desktopovej aplikácii na tomto počítači a v prehliadači v úložisku tohto prehliadača. Platia pre všetky vaše projekty a nie sú súčasťou súboru projektu. Ak v prehliadači vymažete údaje webovej stránky, rozšírenia zmiznú.

## Pozrite tiež

- [Aktualizácia aplikácie](docs://howto-app-bijwerken): rozšírenie môže vyžadovať novšiu verziu aplikácie.
- [Oprávnenia rozšírení](docs://ref-extensiepermissies): čo znamená každé oprávnenie v otázke na inštaláciu.
