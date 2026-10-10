# Používání více projektů najednou

Cíl: mít otevřeno více plánů, přepínat mezi nimi a zavírat je samostatně.

## Kdy to potřebujete

Pracujete na bytové výstavbě v sousedství, ale na schůzce na stavbě se mluví také o rekonstrukci klubovny. Nebo chcete vedle původní verze držet variantu. Každý projekt je na vlastní kartě, s vlastními úkoly, výpočtem a časovým oknem. Přepnutí trvá jedno kliknutí a nic neztratíte.

## Postup

### Otevření druhého projektu

1. Klikněte na plus vpravo od karet (*Začít projekt*). Otevře se okno *Začít projekt*.
2. Zvolte *Nový projekt* pro prázdný plán, nebo *Otevřít existující projekt*, pokud chcete vybrat soubor. *Zrušit* okno zavře.
3. Při volbě *Nový projekt* vyplňte okno *Nový projekt* a klikněte na *Vytvořit*.

Projekt se zobrazí na vlastní kartě a je hned aktivní. Také *Nový* a *Otevřít* na pásu karet, Ctrl+O a příklady na kartě *Soubor › Příklady* otevřou projekt na nové kartě. Místo přidání karty se použije jen čerstvý, prázdný plán, který jste ještě neupravili.

### Přepínání mezi projekty

- Klikněte na kartu projektu.
- Stiskněte Ctrl+1 až Ctrl+9 (na macOS ⌘ místo Ctrl) pro projekt na dané pozici v řadě, počítáno zleva doprava.
- Klikněte na ikonu nabídky vlevo od karet (*Všechny projekty*). Přehled *Otevřené projekty* ukazuje pro každý projekt dlaždici s názvem, názvem souboru (pokud má projekt soubor), náhledem plánu, počtem úkolů, počtem kritických úkolů a datem konce. Kliknutím na dlaždici tam přejdete. Klávesa Esc přehled zavře.

Každá karta má barevnou tečku, která patří k projektu. Karta, za kterou je malá tečka, má neuložené změny.

### Zavření projektu

Klikněte na křížek vedle názvu na kartě (*Zavřít*) nebo na křížek na dlaždici v přehledu. Projekt bez změn se zavře hned. Pokud má neuložené změny, aplikace se zeptá v dialogu *Neuložené změny* a nabídne tři volby:

- *Uložit* uloží projekt a potom ho zavře.
- *Neukládat* zavře projekt a změny zahodí.
- *Zrušit* ponechá projekt otevřený.

Když uložení zrušíte, například zavřením dialogu pro uložení, projekt zůstane otevřený.

Když zavřete poslední projekt, zůstane prázdný plán s názvem *Nový plán*.

### Volba stylu přepínání

Podobu karet můžete zvolit. Otevřete okno nastavení přes ozubené kolečko v záhlaví okna, přejděte na kartu *Zobrazení* a v položce *Styl přepínání dokumentů* zvolte:

- *Vodorovné karty*: výchozí volba. Řada karet pod pásem karet.
- *Svislé karty*: úzký panel vlevo s tlačítkem pro každý projekt (prvními písmeny názvu) a s plusem. Když nad tlačítkem najedete myší, uvidíte název, název souboru, počet úkolů, počet kritických úkolů a datum konce. Tlačítko nahoře otevře přehled.
- *Pilulka*: jedna pilulka v záhlaví okna s názvem aktivního projektu a počítadlem, například *2 otevřené*. Kliknutím na ni otevřete přehled a přepnete se v něm.

Všechny tři styly otevřou stejný přehled a Ctrl+1 až Ctrl+9 funguje ve všech stylech.

## Úskalí a co aplikace dělá

**Co patří projektu a co je sdílené.** Každý projekt má vlastní pohled: přiblížení a polohu, aktivní rozložení s filtrem, seskupením nebo řazením, rozdělené zobrazení, čáry závislostí a sbalené fáze. Když přepnete na jiný projekt, uvidíte tam jeho vlastní pohled. Sdílené pro všechny projekty jsou vybraná karta na pásu karet, minimapa, překryvné vrstvy (překryv směrného plánu, čára průběhu a další), váš výběr sloupců, vaše rozložení a volby sestav.

**S otevřeným dialogem nelze přepínat.** Dokud je otevřený dialog, například okno nastavení nebo okno úkolu, Ctrl+1 až Ctrl+9 v aplikaci nic neudělají. V prohlížeči pak přepínají karty prohlížeče. Nejprve dialog zavřete. Také neuplatněná změna v *Info o projektu* v Backstage blokuje přepínání.

**Ctrl+1 až Ctrl+9 počítají podle pořadí.** Zkratka vede na projekt na dané pozici v řadě. Když zavřete projekt, ostatní pozice se posunou nahoru. Když máte otevřeno více než devět projektů, k zbylým se dostanete jen přes karty nebo přehled.

**Přepočítat a sestavy se týkají aktivního projektu.** Přepočítat (F5), *Exportovat PDF* a sestavy se týkají projektu, který je právě aktivní.

## Viz také

- [Vytvoření a použití rozložení](docs://howto-layouts-gebruiken): nastavení pohledu pro každý projekt.
- [Tvorba a tisk sestavy](docs://howto-rapport-maken-en-afdrukken): sestava aktivního projektu.
