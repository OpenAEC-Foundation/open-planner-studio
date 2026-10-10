# Otváranie a ukladanie súboru

Cieľ: otvoriť projekt zo súboru a uchovať vaše zmeny.

## Kedy to potrebujete

Deň začnete s projektom z predchádzajúceho dňa. Súbor dostanete od kolegu alebo z iného balíka. Alebo chcete pred veľkou zmenou uložiť medzistav. Čo aplikácia uchováva v súbore a prečo len IFC uchováva celý projekt, vysvetľuje [Súbory a formáty](docs://uitleg-bestanden).

## Postup

### Otvorenie súboru

1. Vyberte *Domov › Súbor › Otvoriť*, alebo *Súbor › Otvoriť*, alebo stlačte Ctrl+O (⌘+O na Macu). *Otvoriť* je aj na paneli úplne hore. Skupina *Súbor* je aj na karte *Tabuľka*.
2. Vyberte súbor. Naraz otvoríte jeden súbor. V desktopovej aplikácii a v prehliadačoch s prístupom k súborom, ako sú Chrome a Edge, okno zobrazí zoznam typov súborov: *Všetky podporované*, *Súbory IFC*, *Súbory CSV*, *Súbory XML*, *Súbory MS Project* a *Súbory Primavera XER*.
3. Projekt sa otvorí na novej karte. Ak bola aktuálna karta ešte prázdna a nezmenená, projekt sa otvorí na nej.

Karta dostane názov súboru IFC. Projekt z iného formátu dostane svoj názov projektu.

Aplikácia otvorí súbory `.ifc`, `.csv`, `.xml` (MS Project XML alebo Primavera P6 XML), `.mpp` a `.xer`. Pre posledné dva formáty sú osobitné postupy v [Otvorenie súboru MS Project (.mpp)](docs://howto-mpp-openen) a [Otvorenie súboru Primavera P6 (.xer)](docs://howto-xer-openen).

### Otvorenie nedávneho projektu

Vyberte *Domov › Súbor › Nedávne* a kliknite na súbor v zozname, alebo vyberte *Súbor › Nedávne*. Zoznam uchováva posledných desať súborov, ktoré ste otvorili, uložili alebo exportovali. Desktopová aplikácia zobrazí cestu ku každému súboru, prehliadač len názov.

Ak aplikácia už nemôže čítať súbor v zozname, napríklad preto, že ste ho presunuli, zmizne zo zoznamu bez správy. V prehliadačoch bez prístupu k súborom, ako je Firefox, zostane *Nedávne* prázdne.

### Otvorenie príkladu

Vyberte *Súbor › Príklady* a kliknite na príkladový projekt. Otvorí sa na karte bez súboru. *Uložiť* sa preto opýta, kam ho chcete uložiť.

### Ukladanie

Vyberte *Domov › Súbor › Uložiť* alebo *Súbor › Uložiť*, alebo stlačte Ctrl+S. Čo sa potom stane, závisí od projektu:

1. Ak projekt už má súbor, lebo ste otvorili súbor IFC alebo ste ho predtým uložili, aplikácia zapíše do tohto súboru. Okno sa nezobrazí.
2. Ak projekt ešte nemá súbor, aplikácia sa opýta, kam ho má uložiť. Navrhne názov projektu s príponou `.ifc`. Potom je tento súbor súborom projektu.
3. Ak váš prehliadač ukladá len sťahovaním (ako Firefox), súbor sa uloží do priečinka pre sťahovanie a každé uloženie vytvorí nové stiahnutie. Prvýkrát v relácii uvidíte správu *Uložené ako stiahnutie: „name.ifc“ je v priečinku pre sťahovanie. Tento prehliadač neumožňuje aplikácii zapisovať na vlastné miesto, preto každé uloženie vytvorí nové stiahnutie. V Chrome, Edge alebo v desktopovej aplikácii Uložiť len aktualizuje ten istý súbor.*
4. Ak prehliadač nemôže zapisovať späť do súboru projektu, aplikácia sa pri každom uložení znova opýta, kam súbor uložiť. Vyzerá to ako *Uložiť ako*, ale je to obmedzenie prehliadača. Prvýkrát v relácii to vysvetlí správa *Tento prehliadač neumožňuje aplikácii zapisovať späť do „name.ifc“.* s odkazom na [Súbory](docs://uitleg-bestanden).

Po uložení zmizne značka *Neuložené*: bodka na karte, hviezdička pred názvom projektu hore a text *Neuložené* vpravo dole na stavovom riadku.

### Uloženie pod iným názvom

Vyberte *Domov › Súbor › Uložiť ako* alebo *Súbor › Uložiť ako*, alebo stlačte Ctrl+Shift+S. Vyberte názov a miesto (vo Firefoxe aplikácia namiesto toho stiahne nový súbor). Potom projekt pracuje s týmto novým súborom: ďalšie *Uložiť* zapíše do neho. Starý súbor zostane taký, aký bol, keď ste ho naposledy uložili.

### Zatvorenie projektu

Kliknite na krížik na karte, alebo vyberte *Súbor › Zavrieť projekt*. Ak má projekt zmeny, ktoré ste neuložili, aplikácia sa opýta: *Neuložené zmeny: „name“ má zmeny, ktoré ešte nie sú uložené.* Vyberte *Zrušiť* (projekt zostane otvorený), *Neukladať* (projekt sa zatvorí a vaše zmeny sa stratia) alebo *Uložiť* (najprv uložte, potom zatvorte). Ak zatvoríte celú desktopovú aplikáciu (tlačidlom zatvorenia, klávesami Alt+F4 alebo cez ponuku operačného systému), pýta sa to pri každom projekte so zmenami. *Zrušiť* alebo uloženie, ktoré zlyhá, zastaví zatváranie. Po takomto bežnom zatvorení aplikácia vymaže záložné kópie obnovenia tejto relácie, takže okno obnovenia sa zobrazí až po skutočnom páde. Ak má projekt zmeny a zatvoríte kartu alebo okno prehliadača, prehliadač požiada o potvrdenie.

## Úskalia a čo aplikácia potom robí

**Otvorený súbor IFC je hneď súborom vášho projektu.** *Uložiť* prepíše tento súbor, aj keď pochádza z iného programu. Ak chcete pôvodný súbor zachovať, najprv vyberte *Uložiť ako*.

**Iné formáty sa nikdy neprepíšu.** Projekt z `.csv`, `.xml`, `.mpp` alebo `.xer` nemá po otvorení žiadny súbor. *Uložiť* zapíše nový súbor IFC a pôvodný súbor nechá nedotknutý.

**Vo Firefoxe každé uloženie vytvorí nový súbor.** Aplikácia tam nemôže zapisovať do vášho súboru. Pri každom uložení stiahne nový súbor s názvom projektu ako názvom súboru, nie s názvom súboru, ktorý ste otvorili.

**Chrome a Edge žiadajú o povolenie.** Pri prvom *Uložiť* otvoreného súboru sa prehliadač opýta, či môže aplikácia do neho zapisovať. Ak odmietnete, aplikácia otvorí okno, v ktorom vyberiete nový súbor. V Chrome a Edge sa toto okno zobrazí aj vtedy, ak zápis do existujúceho súboru zlyhá, napríklad preto, že súbor zmizol alebo je zamknutý.

**Uloženie môže zlyhať.** Ak samotné uloženie vráti chybu, aplikácia zobrazí *Uloženie zlyhalo* s dôvodom. Váš projekt zostane otvorený a stále bude označený ako *Neuložené*.

## Pozri aj

- [Súbory a formáty](docs://uitleg-bestanden): čo je v súbore IFC a ako aplikácia spracúva formáty.
- [Zapnutie automatického ukladania](docs://howto-automatisch-opslaan): aplikácia sama aktualizuje váš súbor.
- [Exportovanie](docs://howto-exporteren): vytvorenie kópie v inom formáte.
- [Obnovenie po páde](docs://howto-herstellen-na-een-crash): čo urobíte, ak sa aplikácia nezatvorila správne.
- [Formáty importu a exportu](docs://ref-import-exportformaten): pre každý formát, čo sa prenesie a čo nie.
