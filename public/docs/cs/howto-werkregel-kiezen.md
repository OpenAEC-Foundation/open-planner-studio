# Výběr typu úkolu

Cíl: u každého úkolu nastavit, co aplikace upraví, když změníte dobu trvání, jednotky přiřazení nebo práci: tedy samotnou dobu trvání, jednotky přiřazení nebo práci.

## Kdy to potřebujete

Na úkol jste přidali zdroje a chcete, aby aplikace počítala tak, jak počítáte vy. Jeden příklad: jeřáb je najatý na jeden den a ten den je pevný. Jiný příklad: víte, že v úkolu je 160 hodin zdicích prací, a chcete vidět, jak dlouho to potrvá se třemi lidmi místo dvou. Tyto dvě situace potřebují jiný typ úkolu.

Typ úkolu rozhodne, která ze tří veličin (doba trvání, jednotky přiřazení a práce) se změní, když změníte jinou. Pozadí a propočítané příklady najdete v článku [Typy úkolů: doba trvání, jednotky přiřazení a práce](docs://uitleg-werkregels).

## Postup

### Zobrazení typu úkolu

Typ úkolu se ve výchozím stavu nezobrazuje. Zapněte ho jednou:

1. Zvolte *Nastavení › Projekt › Nastavení aplikace*, na kartě *Plán*.
2. Pod nadpisem *Přepočítání* zaškrtněte *Používat typy úkolů*.
3. Okno zavřete tlačítkem *Zavřít*.

Toto je nastavení aplikace, ne nastavení souboru projektu. Pokud soubor už obsahuje typy úkolů nebo uloženou práci, například soubor z programu MS Project nebo Primavera P6, aplikace typ úkolu zobrazí i bez tohoto nastavení. Totéž platí, jakmile v souboru sami zvolíte typ úkolu. Zobrazení pak zůstane zapnuté pro tento soubor, i když nastavení potom vypnete. Zůstane zapnuté, dokud je soubor otevřený. Po novém otevření zůstane zapnuté, dokud soubor obsahuje typ úkolu nebo uloženou práci.

### Nastavení typu úkolu u úkolu

1. Vyberte úkol. Panel *Vlastnosti* je vpravo. Pokud ho nevidíte, zapněte ho na kartě *Zobrazení › Panely › Vlastnosti*.
2. U pole *Typ úkolu* vyberte jednu z pěti možností: *Výchozí pro projekt (Pevné trvání a jednotky)*, *Pevné trvání a jednotky*, *Pevné trvání a práce*, *Pevná práce* nebo *Pevné jednotky*. Při možnosti *Výchozí pro projekt* úkol sleduje výchozí nastavení projektu.
3. Chcete vědět, co která možnost dělá? V otevřeném rozbalovacím seznamu má každá možnost ikonu i. Najeďte na ni ukazatelem, klikněte nebo klepněte a zobrazí se vysvětlení. Kliknutí na ikonu i tento typ úkolu ještě nevybere.
4. Vedle uzavřeného pole je také ikona i. Vysvětluje typ úkolu, který platí právě teď, například *Doba trvání vyplývá z práce a jednotek přiřazení.* Při možnosti *Výchozí pro projekt* je to typ úkolu v závorce.

*Výchozí pro projekt* je první možnost a úkol ji má ve výchozím stavu. Typ úkolu v závorce je ten, který má projekt nyní jako výchozí. Aplikace nemá tlačítko, kterým se výchozí typ úkolu projektu změní. Ten pochází z importu, například z programu MS Project nebo Primavera P6, nebo z připojení MCP. Chcete-li pro jeden úkol jiný typ úkolu, zvolte ho zde.

Typ úkolu můžete zvolit i v tabulce úkolů. Klikněte na **+** vpravo v záhlaví tabulky úkolů (*Přidat sloupec*) a pod nadpisem *Plánování* zvolte sloupec *Typ úkolu*.

Úkol bez přiřazení nemá nic, co by se spojovalo, takže typ úkolu tam nic nedělá. Nejprve přiřaďte zdroj (viz [Přiřazení zdrojů s křivkou](docs://howto-resource-toewijzen)).

### Zobrazení a změna práce

U úkolu s přiřazeními se v části *Přiřazení* panelu *Vlastnosti* objeví sloupec *Práce (h)*, vedle sloupce *Jednotky přiřazení*. Ten sloupec ukazuje zbývající práci daného zdroje v hodinách. Malý zámek nad sloupcem ukazuje, co typ úkolu chrání. U sloupce *Jednotky přiřazení* je to při možnosti *Pevné trvání a jednotky* a při možnosti *Pevné jednotky*. U sloupce *Práce (h)* je to při možnosti *Pevné trvání a práce* a při možnosti *Pevná práce*.

Chcete-li práci změnit sami, napište hodiny do pole a stiskněte Enter. Aplikace nepřijme hodnotu 0 nebo nižší. Pole se vrátí na předchozí hodnotu.

### Co se stane

Když zvolíte typ úkolu, zatím se žádné číslo nezmění. Typ úkolu, který chrání práci, jen zafixuje aktuální práci. *Práce (h)* pak má uloženou hodnotu. Typ úkolu rozhodne, co se posune, až při příští změně. Změňte například *Jednotky přiřazení* a sledujte, co se stane s dobou trvání a s prací.

Změní-li se tím doba trvání úkolu, ve stavovém řádku se objeví *Zastaralé — přepočítejte (F5)*. Stiskněte **Přepočítat** (F5), například přes *Domů › Plán › Přepočítat*, a uvidíte nové termíny. Je-li zapnuto *Automaticky přepočítat* (na stejné kartě *Plán*, pod nadpisem *Přepočítání*), aplikace to udělá sama.

## Který typ úkolu se hodí

- **Pevné trvání a jednotky** se hodí, když je doba trvání dohodnutá a jednotky přiřazení zadáváte vy. Práce z nich vyplyne. Toto je výchozí volba. Jeřáb najatý na jeden den patří sem: den je pevný a vy určíte, kolik jeřábů na něm bude.
- **Pevné trvání a práce** se hodí, když musí být úkol dokončen v pevném období a víte, kolik práce v něm je. Změní-li se doba trvání, aplikace upraví jednotky.
- **Pevná práce** se hodí, když víte, kolik hodin práce je v úkolu, a chcete vidět, jak se doba trvání mění s počtem lidí. Zdicí práce 160 hodin se třemi lidmi místo dvou patří sem. Omítky v cvičném projektu dostávají tento typ úkolu.
- **Pevné jednotky** se hodí, když jsou jednotky přiřazení pevné, například jeden jeřáb, a práce určí dobu trvání.

## Úskalí a co aplikace potom udělá

**Pole *Typ úkolu* chybí.** Pak je nastavení *Používat typy úkolů* vypnuté a soubor zatím žádné typy úkolů nemá, nebo jste vybrali milník, fázi, překlenovací úkol nebo úkol s typem doby trvání *Uplynulá doba trvání*. Tam typ úkolu není. Vyberte běžný úkol.

**Doba trvání se změní, aniž jste ji změnili.** U typů úkolu *Pevná práce* a *Pevné jednotky* vyplyne doba trvání z jednotek a práce. Když jednu z nich nebo počet zdrojů změníte, aplikace dobu trvání upraví a zaokrouhlí ji nahoru na celé pracovní dny. U úkolu v hodinách zaokrouhlí aplikace nahoru na celé minuty.

**Práce přesně neodpovídá jednotkám přiřazení × době trvání.** Může to způsobit zaokrouhlení. V poli *Práce (h)* se pak objeví varovná značka *Liší se od jednotek přiřazení × doby trvání*. Histogram sleduje uloženou práci.

**Materiál se nepočítá.** U materiálového zdroje ukazuje *Práce (h)* pomlčku. Materiál nikdy neurčuje dobu trvání.

**Úkol s průběhem.** Typ úkolu pracuje se zbývající částí. *Práce (h)* proto ukazuje jen to, co ještě zbývá udělat.

**Vrácení zpět.** Zvolení typu úkolu a každá změna, kterou typ úkolu vypočítá, je jeden krok pro *Vrátit zpět* (Ctrl+Z). Vybraný typ úkolu pak zmizí, ale pole *Typ úkolu* zůstane vidět.

## Viz také

- [Typy úkolů: doba trvání, jednotky přiřazení a práce](docs://uitleg-werkregels): jak aplikace spojuje dobu trvání, jednotky přiřazení a práci, s propočítanými příklady.
- [Přiřazení zdrojů s křivkou](docs://howto-resource-toewijzen): přidání zdroje na úkol.
