# Volba režimu průběhu

Cíl: rozhodněte, jak aplikace plánuje zbývající práci úkolu, který už začal, zatímco jeho předchůdce ještě běží: podle závislosti (Retained Logic) nebo podle toho, co se skutečně děje (Progress Override).

## Kdy to potřebujete

Na stavbě se často pracuje dříve, než říká logika plánu. Malíř už začíná v místnostech, které jsou omítnuté, zatímco omítkař je ještě zaneprázdněn jinde. V plánu je to například závislost typu dokončení-zahájení, u které následník začne dřív, než je předchůdce dokončen. Aplikace tomu říká **průběh mimo posloupnost**. Pokud stavový řádek ukazuje *Závislosti mimo posloupnost: N*, máte takový případ. Režim průběhu pak určí, jak aplikace plánuje zbývající práci následníka. Co dělají oba režimy, je s praktickým příkladem v článku [Průběh, datum stavu a směrný plán](docs://uitleg-voortgang).

## Postup

1. Aktualizujte průběh a nastavte datum stavu, jak popisuje [Aktualizace průběhu](docs://howto-voortgang-bijwerken).
2. Přejděte na kartu *Plán › Směrné plány a průběh › Režim průběhu* a otevřete seznam.
3. Zvolte *Retained Logic* nebo *Progress Override*.
4. Stiskněte tlačítko **Přepočítat** (F5), například na kartě *Plán › Plán › Přepočítat*. Volba způsobí, že plán už není aktuální. Stavový řádek ukáže *Zastaralé — přepočítejte (F5)*. Pokud je zapnuté *Automaticky přepočítat*, aplikace to udělá sama.

Jak zvolíte?

- **Retained Logic** je výchozí režim. Závislost zůstává v platnosti: zbývající práce následníka začne až po dokončení předchůdce. Zvolte tento režim, pokud je pořadí opravdu pevné, nebo pokud chcete plánovat opatrně.
- **Progress Override** dává přednost skutečnosti. Zbývající práce následníka začne k datu stavu, bez čekání na předchůdce. Zvolte tento režim, pokud následník skutečně pokračuje v práci a datum dokončení nemá záviset na předchůdci, který ještě běží.

## Kontrola výsledku

- Klikněte na hlášení *Závislosti mimo posloupnost: N* na stavovém řádku. Otevře se panel *Varování*. Panel najdete také na kartě *Plán › Plán › Varování*. Každá závislost je v něm uvedena s textem *Mimo posloupnost: průběh následníka je v rozporu se závislostí*, například *4.2 Plastering → 4.5 Painting (FS)*.
- Podívejte se na pruh následníka. Při Retained Logic trvá až po dokončení předchůdce. Při Progress Override skončí dříve. V příkladu z vysvětlení je to úterý 27. července oproti čtvrtku 22. července.

## Úskalí a co aplikace dělá

**Žádný rozdíl.** Režim působí jen na úkoly, které už začaly, zatímco jejich předchůdce ještě není dokončen. Bez takového úkolu se nic nezmění.

**Hlášení zůstane.** Progress Override hlášení mimo posloupnost nevyřeší. Režim určuje, jak aplikace vypočítává. Rozpor mezi závislostí a průběhem zůstává. Pokud závislost už neplatí, změňte ji ([Přidání závislostí](docs://howto-relaties-leggen)).

**Patří k projektu.** Volba se uloží do souboru projektu, platí pro celý projekt a dá se vrátit zpět pomocí Ctrl+Z. Nový projekt je nastaven na Retained Logic.

**Soubor P6.** Když otevřete soubor Primavera P6 (.xer), aplikace převezme režim ze souboru. Kromě Retained Logic a Progress Override má P6 ještě Actual Dates. Aplikace tento třetí režim nezná. Takový soubor se proto vypočítává jako Retained Logic. Hlášení při importu to uvede jako *1 nastavení plánování P6 používá bezpečnou záložní hodnotu.*

**Profil výpočtu.** V profilu výpočtu Primavera P6 funguje Progress Override také zpětně, v pozdních termínech a volné časové rezervě předchůdce (konvence *Progress Override ignoruje zahájeného následníka i při výpočtu zpět*). V profilech výpočtu Open Planner Studio a Microsoft Project tomu tak není. Konvence najdete na kartě *Nastavení › Projekt › Info o projektu*, v bloku *Profil výpočtu a možnosti výpočtu*. V příkladu z vysvětlení se tento zpětný účinek neukáže.

## Viz také

- [Průběh, datum stavu a směrný plán](docs://uitleg-voortgang): rozdíl mezi oběma režimy, s čísly.
- [Aktualizace průběhu](docs://howto-voortgang-bijwerken): zadání průběhu, na který režim působí.
- [Přidání závislostí](docs://howto-relaties-leggen): změna závislosti, která už neplatí.
