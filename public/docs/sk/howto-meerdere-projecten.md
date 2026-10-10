# Používanie viacerých projektov naraz

Cieľ: mať otvorených viac plánov naraz, prepínať medzi nimi a každý zavrieť zvlášť.

## Kedy to potrebujete

Pracujete na bytovej výstavbe v susedstve, ale stretnutie na stavbe sa týka aj rekonštrukcie klubovej budovy. Alebo chcete mať variant vedľa pôvodnej verzie. Každý projekt je na vlastnej karte, s vlastnými úlohami, výpočtom a časovým oknom. Prepnutie trvá jedno kliknutie a nič nestratíte.

## Kroky

### Otvorenie druhého projektu

1. Kliknite na plus napravo od kariet (*Začať projekt*). Otvorí sa okno *Začať projekt*.
2. Vyberte *Nový projekt* pre prázdny plán, alebo *Otvoriť existujúci projekt*, ak chcete vybrať súbor. *Zrušiť* zavrie okno.
3. Pri voľbe *Nový projekt* vyplňte okno *Nový projekt* a kliknite na *Vytvoriť*.

Projekt sa zobrazí na vlastnej karte a je hneď aktívny. *Vytvoriť* a *Otvoriť* na páse s nástrojmi, Ctrl+O a príklady v *Súbor › Príklady* tiež otvoria projekt na novej karte. Namiesto pridania karty sa použije iba nový, prázdny plán, ktorého ste sa ešte nedotkli.

### Prepínanie medzi projektmi

- Kliknite na kartu projektu.
- Stlačte Ctrl+1 až Ctrl+9 (⌘ namiesto Ctrl na macOS) pre projekt na danom mieste v rade, počítané zľava doprava.
- Kliknite na ikonu ponuky naľavo od kariet (*Všetky projekty*). Prehľad *Otvorené projekty* zobrazuje dlaždicu ku každému projektu s jeho názvom, názvom súboru (ak má projekt súbor), náhľadom plánu, počtom úloh, počtom kritických úloh a dátumom ukončenia. Kliknutím na dlaždicu prejdete tam. Stlačte Esc a prehľad sa zavrie.

Každá karta má farebnú bodku, ktorá patrí projektu. Karta, za ktorou je malá bodka, má neuložené zmeny.

### Zavretie projektu

Kliknite na krížik vedľa názvu na karte (*Zavrieť*) alebo na krížik na dlaždici v prehľade. Projekt bez zmien sa zavrie hneď. Ak má neuložené zmeny, aplikácia zobrazí otázku *Neuložené zmeny* s tromi možnosťami:

- *Uložiť* uloží projekt a potom ho zavrie.
- *Neukladať* zavrie projekt a zmeny zahodí.
- *Zrušiť* nechá projekt otvorený.

Ak ukladanie zrušíte, napríklad zavretím dialógového okna na uloženie, projekt zostane otvorený.

Ak zavriete posledný projekt, ostane prázdny plán s názvom *Nový plán*.

### Výber štýlu prepínania

Štýl kariet si môžete zvoliť. Otvorte okno nastavení ozubeným kolieskom v titulnom riadku, prejdite na kartu *Vzhľad* a pri voľbe *Štýl prepínania dokumentov* vyberte:

- *Horizontálne karty*: predvolené nastavenie. Rad kariet pod pásom s nástrojmi.
- *Vertikálne karty*: úzky panel vľavo s tlačidlom pre každý projekt (prvé písmená názvu) a s plusom. Ak podržíte kurzor nad tlačidlom, uvidíte názov, názov súboru, počet úloh, počet kritických úloh a dátum ukončenia. Tlačidlo hore otvorí prehľad.
- *Pilulka*: jedna pilulka v titulnom riadku s názvom aktívneho projektu a počítadlom, napríklad *2 otvorené*. Kliknite na ňu, otvorte prehľad a prepnite sa tam.

Všetky tri štýly otvoria rovnaký prehľad a Ctrl+1 až Ctrl+9 funguje v každom štýle.

## Úskalia a čo aplikácia robí

**Čo patrí projektu a čo je spoločné.** Každý projekt má vlastné zobrazenie: priblíženie a polohu, aktívne rozloženie s filtrom, zoskupením alebo triedením, rozdelené zobrazenie, čiary závislostí a zbalené fázy. Ak prepnete na iný projekt, uvidíte tam jeho vlastné zobrazenie. Spoločné pre všetky projekty sú vybraná karta pása s nástrojmi, mini-mapa, prekrytia (prekrytie pôvodného plánu, čiara postupu a ďalšie), výber stĺpcov, vaše rozloženia a voľby zostáv.

**Pri otvorenom dialógovom okne nemôžete prepínať.** Kým je otvorené dialógové okno, napríklad okno nastavení alebo okno úlohy, Ctrl+1 až Ctrl+9 v aplikácii nič nerobia. V prehliadači potom prepínajú karty prehliadača. Najprv zavrite dialógové okno. Neuplatnená zmena v *Info o projekte* v Backstage tiež bráni prepínaniu.

**Ctrl+1 až Ctrl+9 počítajú podľa poradia.** Skratka prejde na projekt na danom mieste v rade. Ak zavriete projekt, ostatné miesta sa posunú nahor. Ak máte otvorených viac ako deväť projektov, na ostatné sa dostanete iba cez karty alebo prehľad.

**Prepočítať a zostavy pracujú s aktívnym projektom.** Prepočítať (F5), *Exportovať PDF* a zostavy sa týkajú projektu, ktorý je teraz aktívny.

## Pozri tiež

- [Vytvorenie a použitie rozloženia](docs://howto-layouts-gebruiken): nastavenie zobrazenia pre každý projekt.
- [Vytvorenie a tlač zostavy](docs://howto-rapport-maken-en-afdrukken): zostava aktívneho projektu.
