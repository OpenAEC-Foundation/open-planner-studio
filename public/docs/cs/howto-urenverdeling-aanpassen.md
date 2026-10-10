# Úprava rozložení práce v čase

Cíl: u jednoho přiřazení určíte sami, kolik zdroj pracuje v každém pracovním dni úkolu, místo standardní průběhové křivky.

## Kdy to potřebujete

Průběhová křivka, například *Zvonovitý tvar*, je pevný tvar. Někdy víte lépe. Zedník začíná na vnější vrstvě dutinové zdi s polovičním výkonem, protože se ještě staví lešení, a potom pracuje na plný úvazek. Nebo chcete, aby špička zůstala těsně pod kapacitou. Pak upravíte **rozložení práce v čase**.

Pracujete s **fázemi**: po sobě jdoucí pracovní dny, ve kterých zdroj pracuje se stejnými jednotkami přiřazení. Rozložení práce mění jen hodiny za den u tohoto jednoho přiřazení. Data úkolu se nemění.

## Postup

Příklad je vnější vrstva dutinové zdi: 6 pracovních dnů, jeden zedník, 48 hodin.

1. Vyberte úkol. Panel *Vlastnosti* je vpravo. Pokud ho nevidíte, zapněte ho na kartě *Zobrazení › Panely › Vlastnosti*.
2. V části *Přiřazení* klikněte na ikonu grafu *Rozložení práce v čase…* vedle zedníka. Otevře se okno *Rozložení hodin do fází*. Začínáte od toho, co aplikace právě eviduje: u této vnější vrstvy dutinové zdi je to jedna fáze o 6 dnech s jednotkami přiřazení 1.
3. Pokud je to potřeba, zvolte výchozí bod v poli *Použít tvar:*. Při volbě *Zvonovitý tvar* aplikace vytvoří pět fází: 0,18 jednotky přiřazení v prvním a posledním dni, 0,84 v druhém a pátém dni a 1,98 ve dvou prostředních dnech. Celkem zůstává 48 hodin.

### Úprava fází

Můžete pracovat v tabulce nebo v pásu nad ní.

- Zadejte jiné *Jednotky přiřazení (jedn./den)* u fáze. Sloupce *Hodiny/den* a *Hodiny* se vypočítají spolu s ním.
- Změňte počet dnů u fáze v poli *Dny*. Poslední fáze vždy trvá až do konce úkolu a dostane zbylé dny.
- Zvolte *Rozdělit*, když chcete fázi rozdělit na dvě, například 6 dnů na 3 a 3. Zvolte *Sloučit*, když chcete fázi sloučit s další.
- V pásu přetáhnete hranici a fázi tak prodloužíte nebo zkrátíte. Horní hranu přetáhnete, abyste nastavili jednotky přiřazení, a dvojklikem na den fázi rozdělíte.

### Použití

Zvolte *Použít*. Tlačítko *Zrušit* zavře okno bez změny.

Příklad. Zvolíte *Rozdělit*, nastavíte *Dny* první fáze na 2 a jednotky přiřazení této fáze na 0,5. Druhá fáze pak trvá 4 dny s jednotkami přiřazení 1. Celkem je to 2 × 0,5 × 8 + 4 × 1 × 8 = 40 hodin.

Po kliknutí na *Použít* se průběhová křivka přiřazení nastaví na *Průběhová křivka*, která je neaktivní. *Jedn./den* zůstane beze změny. Histogram a přetížení se hned řídí novým rozložením práce. Přepočítání není potřeba, protože se žádné datum nepohne.

### Uvolnění rozložení

Pokud má přiřazení vlastní rozložení práce, okno má navíc tlačítko *Uvolnit rozložení*. To odstraní vaše vlastní rozložení práce a aplikace se vrátí k *Jedn./den* a ke křivce. Zvolte to také tehdy, když chcete změnit křivku, protože rozbalovací seznam *Křivka* je neaktivní, dokud existuje vlastní rozložení práce.

## Úskalí a co aplikace udělá

**Celkový součet se mění spolu s tím.** Hodiny nerozdělujete, sami je určujete. Když nastavíte fázi na 0,5 místo 0,18, celkový součet vzroste. Celkový součet v hodinách je ve spodní části okna. Než kliknete na *Použít*, zkontrolujte jej.

**Co udělají jednotky přiřazení potom, to řídí pravidlo pevné veličiny.** Při pravidle *Pevné trvání a jednotky* jiná *Jedn./den* nic nezmění na rozložení práce. Při pravidle *Pevné trvání a práce* aplikace přepočítá hodiny za den spolu s novými jednotkami přiřazení. Při jednotkách přiřazení 2 místo 1 se každý den zdvojnásobí a zdvojnásobí se i celkový součet (z 32 na 64 hodin). Doba trvání zůstane stejná. Při pravidle *Pevná práce* jednotky mění dobu trvání úkolu. Rozložení práce se pak stlačí nebo protáhne na novou dobu trvání, se stejným celkovým součtem. Při pravidle *Pevné jednotky* jednotky mění i dobu trvání. Celkový součet ve spodní části okna pak zkontrolujte.

**Když změníte dobu trvání úkolu, rozložení práce se s ní protáhne.** Tvar zůstane stejný. Při pravidle *Pevné trvání a jednotky* a při pravidle *Pevné jednotky* celkový součet roste úměrně době trvání. Když se doba trvání úkolu s vlastním rozložením práce zdvojnásobí ze 4 na 8 pracovních dnů, zdvojnásobí se i celkový součet, z 32 na 64 hodin. Při pravidle *Pevné trvání a práce* a při pravidle *Pevná práce* celkový součet zůstane stejný (32 hodin zůstane 32 hodin) a jednotky přiřazení klesnou.

**Práce se řídí rozložením práce.** *Práce (zbývá)* se stane součtem vašich fází, a to i při pravidle *Pevná práce*. Doba trvání úkolu se kvůli tomu nemění.

**Neplatné jednotky.** Prázdné nebo záporné jednotky přiřazení dostanou červený rámeček a *Použít* je pak neaktivní. Fáze s jednotkami přiřazení 0 je povolená. Taková fáze zůstane v rámci doby trvání úkolu.

**Všechno platí jen pro toto přiřazení.** Aplikace to říká sama: *Rozložení práce mění jen hodiny za den u tohoto přiřazení; data úkolu a jeho rozdělení zůstanou beze změny.* Ostatní zdroje u stejného úkolu si ponechají vlastní rozložení práce.

**Vyrovnání se řídí rozložením práce.** Funkce vyrovnání počítá stejné hodiny za den jako histogram.

**Vrácení změn.** Každé z tlačítek *Použít* a *Uvolnit rozložení* je jeden krok pro *Vrátit zpět* (Ctrl+Z).

## Viz také

- [Přiřazení zdrojů s průběhovou křivkou](docs://howto-resource-toewijzen): přiřazení zdroje k úkolu a volba průběhové křivky.
- [Řešení přetížení](docs://howto-overbezetting-oplossen): co dělat, když má zdroj v jednom dni příliš mnoho práce.
