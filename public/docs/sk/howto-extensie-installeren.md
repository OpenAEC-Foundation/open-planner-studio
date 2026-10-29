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

**Návody.** Návody sú rozšírenie. Ak vidíte tlačidlo *Nainštalovať návody* v časti *Návody* v okne *Pomocník*, otvorí sa *Súbor › Rozšírenia* na karte *Prehľadávať*. Otázka po prvej prehliadke tiež nainštaluje toto rozšírenie. Obe cesty zobrazia rovnakú otázku na povolenie; môžete ju odmietnuť.

### Inštalácia rozšírenia zo súboru

Ak ste dostali rozšírenie ako súbor, nainštalujte ho takto.

1. Vyberte *Súbor › Rozšírenia*.
2. Vpravo hore kliknite na *ZIP* pre súbor ZIP alebo na *JS* pre samostatný súbor JavaScript.
3. Vyberte súbor. Otvorí sa okno *Nainštalovať rozšírenie?*, ako je uvedené vyššie.

Súbor ZIP musí obsahovať `manifest.json` a hlavný súbor rozšírenia. Ak nainštalujete rozšírenie, ktoré je už nainštalované, nová verzia nahradí predchádzajúcu. Ak aplikácia súbor nedokáže nainštalovať, napríklad preto, že súbor ZIP je poškodený, nestane sa nič: aplikácia pri ZIP a JS nezobrazí žiadne chybové hlásenie a rozšírenie sa v zozname neobjaví. Dôvod však nájdete v ladiacom termináli. Zapnite ho v *Nastavenia › Projekt › Nastavenia aplikácie*, na karte *Rozšírené*, cez *Zapnúť ladiaci terminál*. Otvoríte ho tlačidlom *Zobraziť ladiaci terminál* v stavovom riadku. Tam sa zobrazí napríklad text *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (aplikácia tento technický text píše po holandsky).

### Prečítajte si otázku na povolenie

Otázka ukazuje, čo musíte rozhodnúť.

- *Autor* a *Repozitár* uvádzajú, kto rozšírenie vytvoril a kde je zdrojový kód.
- *Pôvod* uvádza, odkiaľ súbor pochádza a či bol overený. Ak sa červeným písmom uvedie, že stiahnutie nebolo overené, nainštalujte ho iba vtedy, ak poznáte zdroj.
- *Na čo súhlasíte* opakuje, že rozšírenie je programový kód, ktorý beží s rovnakými právami ako samotná aplikácia, a čo to znamená na vašej platforme. Inštalujte iba rozšírenia, ktorých autorovi dôverujete.
- *Čo toto rozšírenie uvádza, že používa* zobrazuje oprávnenia, ktoré autor uviedol, ako malé štítky. Ide o vyhlásenie, nie o obmedzenie. Ak sa zobrazí *Nič nebolo uvedené.*, rozšírenie môže aj tak čítať a meniť údaje vášho plánu.

Čo znamená každý štítok a presné znenie okna nájdete v článku [Oprávnenia rozšírení](docs://ref-extensiepermissies).

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
