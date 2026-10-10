# Přiřazení zdrojů s průběhovou křivkou

Cíl: přiřaďte zdroj k úkolu, s jednotkami přiřazení za den a průběhovou křivkou. Ta určuje, jak se jednotky rozloží na dny úkolu.

## Kdy to potřebujete

Jakmile chcete vidět, kdo pracuje kde a kdy: zedník na outer cavity leaf, jeřáb na hollow-core floor slabs. Bez přiřazení zdroj nic nedělá, a tedy se nezobrazí ani histogram, ani přetížení.

Dva pojmy. **Jednotky přiřazení** (v aplikaci *Jedn./den*) říkají, kolik ze zdroje pracuje na úkolu za pracovní den: 1 je jeden zedník, 2 jsou dva z nich, 0,5 je půl dne. **Průběhová křivka** určuje, jak se celková práce (jednotky přiřazení krát doba trvání) rozloží na pracovní dny úkolu. Práce bývá jen zřídka rovnoměrná: u zdi je na začátku klid, uprostřed plno a na konci zase klid.

Práce na outer cavity leaf trvá 6 pracovních dnů. S jedním zedníkem a průběhovou křivkou *Rovnoměrné* je to 1 jednotka přiřazení na každý ze 6 dnů, dohromady 6. S průběhovou křivkou *Zvonovitý tvar* je to pořád 6 jednotek přiřazení dohromady, ale rozložení práce bude 0, 1, 2, 2, 1 a 0.

## Postup

Zdroj můžete přiřadit dvěma způsoby. Zdroj musí už existovat (viz [Správa zdrojů](docs://howto-resources-beheren)).

### Přes pás karet

1. V tabulce úkolů vyberte jeden úkol. Musí jít o běžný úkol, ne o milník a ne o fázi.
2. Na kartě zvolte *Zdroje › Přiřazení › Přiřadit ▾*.
3. V okně vyplňte pole *Jedn./den* (výchozí 1). V poli *Křivka* (výchozí *Rovnoměrné*) zvolte požadovanou křivku. Hodnoty platí pro zdroj, který nyní vyberete.
4. Klikněte na zdroj. Okno se zavře a přiřazení je vytvořeno.

Pro druhý zdroj otevřete okno znovu. Zdroje, které už u úkolu jsou, v seznamu chybí.

### Přes panel vlastností

1. Vyberte úkol. Panel *Vlastnosti* je vpravo. Když ho nevidíte, zapněte ho na kartě *Zobrazení › Panely › Vlastnosti*.
2. V sekci *Přiřazení* úplně dole zvolte zdroj u položky *Přiřadit zdroj*. Přiřazení začne s jednotkami přiřazení 1 a s průběhovou křivkou *Rovnoměrné*.
3. U každého přiřazení změňte *Jedn./den* a v poli *Křivka* zvolte jinou křivku.

Tak změníte i stávající přiřazení. Ikonou koše vedle názvu (*Odstranit*) odeberete přiřazení z úkolu. Samotný zdroj zůstane. Tlačítkem *Přesunout na…* přesunete přiřazení na jiný úkol.

### Průběhové křivky

- *Rovnoměrné*: každý den stejně. Je to výchozí volba a hodí se na práci, která je každý den stejně náročná.
- *Vytížení na začátku*: začátek je náročnější než konec. Hodí se na práci, která začíná silným úsilím, například vytyčováním.
- *Vytížení na konci*: konec je náročnější než začátek. Hodí se na práci, která ke konci nabírá na intenzitě.
- *Zvonovitý tvar*: špička uprostřed, na začátku i na konci klid. Hodí se na zeď, která začíná pomalu, uprostřed je v plném provozu a pak ubývá.
- *Brzká špička*: špička před polovinou. Hodí se na práci, která se rychle rozjede.
- *Pozdní špička*: špička až za polovinou. Hodí se na práci, jejíž nejnáročnější období přijde až později.
- *Dvojitá špička*: dvě špičky. Hodí se na práci se dvěma náročnými momenty.
- *Želva*: na začátku a na konci klid, uprostřed široká špička. Hodí se na dlouhou práci, která se postupně rozjíždí a postupně doznívá.

Průběhová křivka mění jen rozložení práce. Doba trvání, termíny i celkový součet zůstanou stejné. Potom není nutné plán přepočítat. Histogram se přizpůsobí hned. Pro zobrazení ho na kartě zvolte *Zdroje › Histogram › Histogram*. Když vyberete úkol, histogram ukazuje jen zatížení tohoto úkolu.

## Úskalí a co pak aplikace dělá

**Průběhová křivka může vytvořit špičku nad vaše jednotky přiřazení.** Při celých číslech jako jednotkách přiřazení aplikace zaokrouhlí hodnotu na den na celé jednotky. Celková práce zůstane stejná. Zedník s jednotkami přiřazení 1 na outer cavity leaf a s křivkou *Zvonovitý tvar* dá 0, 1, 2, 2, 1, 0. Ve dvou prostředních dnech je to 2 jednotky, proti *Maximální počet jednotek* 1. Histogram ty dny vybarví červeně a zdroj má přetížení. Zvolte jinou křivku, nebo rozložte hodiny sami (viz [Úprava rozložení práce v čase](docs://howto-urenverdeling-aanpassen)). Při jednotkách přiřazení, jako je 0,5, aplikace zaokrouhluje na setiny. U krátkého úkolu s celými jednotkami přiřazení je rozložení práce proto hrubší: při 10 dnech dává *Želva* s jednotkami přiřazení 1 rozložení práce 0, 1, 1, 2, 2, 1, 1, 1, 1, 0, přesně stejně jako *Brzká špička*.

**Milník ani fáze.** Tlačítko *Přiřadit* je pak vypnuté a *Vlastnosti* zobrazí *Přiřazení nejsou u milníků možná.* nebo *Přiřazení nejsou u souhrnných úkolů možná.*

**Zdroj lze k úkolu přiřadit jen jednou.** Pokud je zdroj už u úkolu, v seznamu už není. Pokud jsou u úkolu už všechny zdroje, aplikace zobrazí *Všechny zdroje jsou už přiřazeny.* Pokud ještě žádný zdroj není, zobrazí *Nejprve vytvořte zdroje (karta Zdroje).*

**Jednotky přiřazení musí být větší než 0.** Aplikace nepřijme hodnotu 0 nebo menší.

**Materiál.** U materiálového zdroje jsou jednotky přiřazení množství za den v jednotce zdroje, například m³. Materiál se do doby trvání úkolu nepočítá.

**Pravidlo pevné veličiny může upravit dobu trvání.** Pokud má úkol pravidlo *Pevná práce* nebo *Pevné jednotky*, druhý zdroj změní dobu trvání úkolu. Plán pak není aktuální. Stiskněte **Přepočítat** (F5). Viz [Pravidla pevné veličiny: doba trvání, jednotky a práce](docs://uitleg-werkregels).

**Vlastní rozložení práce.** Pokud má přiřazení už vlastní rozložení práce v čase, je průběhová křivka vypnutá a zobrazuje *Průběhová křivka*. Nejprve toto rozložení uvolněte přes *Rozložení práce v čase…*.

**Vrácení změn.** Vytvoření, změnu i odstranění přiřazení můžete vrátit tlačítkem *Vrátit zpět* (Ctrl+Z).

## Viz také

- [Úprava rozložení práce v čase](docs://howto-urenverdeling-aanpassen): nastavení hodin za den ručně.
- [Řešení přetížení](docs://howto-overbezetting-oplossen): co dělat, když má zdroj v jeden den příliš mnoho práce.
- [Pravidla pevné veličiny: doba trvání, jednotky a práce](docs://uitleg-werkregels): co se stane s dobou trvání, když změníte jednotky přiřazení.
- [Panel zdrojů](docs://ref-resourcepaneel): všechna pole a tlačítka panelu zdrojů.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): všech pět typů zdrojů, všech šest průběhových křivek a věžový jeřáb s krokem kapacity od 30. srpna 2027.
