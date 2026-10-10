# Výběr pravidla pevné veličiny

Cíl: u každého úkolu určit, co aplikace upraví, když změníte dobu trvání, jednotky přiřazení nebo práci: tedy samotnou dobu trvání, jednotky přiřazení, nebo práci.

## Kdy to potřebujete

Na úkol jste přidali zdroje a chcete, aby aplikace počítala tak, jak vy počítáte. Jeden příklad: jeřáb je najatý na jeden den a ten den je pevný. Jiný příklad: víte, že v úkolu je 160 hodin zdicích prací, a chcete vidět, jak dlouho to potrvá se třemi lidmi místo dvou. Tyto dvě situace potřebují jiné pravidlo pevné veličiny.

Pravidlo rozhodne, která ze tří veličin (doba trvání, jednotky přiřazení a práce) se změní, když změníte jinou. Pozadí a propočítané příklady najdete v článku [Pravidla pevné veličiny: doba trvání, jednotky přiřazení a práce](docs://uitleg-werkregels).

## Postup

### Zobrazení pravidla pevné veličiny

Pravidlo pevné veličiny se ve výchozím stavu nezobrazuje. Zapněte ho jednou:

1. Zvolte *Nastavení › Projekt › Nastavení*, na kartě *Plán*.
2. Pod nadpisem *Přepočítání* zaškrtněte *Zobrazit pravidla pevné veličiny a práci*.
3. Okno zavřete tlačítkem *Zavřít*.

Toto je nastavení aplikace, ne nastavení souboru projektu. Pokud soubor už obsahuje pravidla pevné veličiny nebo uloženou práci, například soubor z programu MS Project nebo Primavera P6, aplikace pravidlo zobrazí i bez tohoto nastavení. Totéž platí, jakmile v souboru sami zvolíte pravidlo. Zobrazení pak zůstane zapnuté pro tento soubor, i když nastavení potom vypnete. Zůstane zapnuté, dokud je soubor otevřený. Po novém otevření zůstane zapnuté, dokud soubor obsahuje pravidlo nebo uloženou práci.

### Volba pravidla

1. Vyberte úkol. Panel *Vlastnosti* je vpravo. Pokud ho nevidíte, zapněte ho na kartě *Zobrazení › Panely › Vlastnosti*.
2. U pole *Pravidlo pevné veličiny* vyberte jednu z pěti možností: *Výchozí pro projekt (Pevné trvání a jednotky)*, *Pevné trvání a jednotky*, *Pevné trvání a práce*, *Pevná práce* nebo *Pevné jednotky*. Při možnosti *Výchozí pro projekt* úkol sleduje výchozí nastavení projektu.
3. Pod rozbalovacím seznamem aplikace ukáže, co pravidlo chrání, například *Chráněno: práce (doba trvání sleduje jednotky přiřazení)*.

*Výchozí pro projekt* je první volba a úkol ji má ve výchozím stavu. Pravidlo v závorce je to, které má projekt nyní jako výchozí. Aplikace nemá tlačítko, kterým se výchozí pravidlo projektu změní. Pochází z importu, například z programu MS Project nebo Primavera P6, nebo z připojení MCP. Chcete-li pro jeden úkol jiné pravidlo, zvolte ho zde.

Pravidlo můžete zvolit i v tabulce. Klikněte na **+** vpravo v záhlaví tabulky úkolů (*Přidat sloupec*). Pod *Plánování* zvolte sloupec *Pravidlo pevné veličiny*.

Úkol bez přiřazení nemá nic, co by pravidlo spojovalo, takže pravidlo tam nic nedělá. Nejprve přiřaďte zdroj (viz [Přiřazení zdrojů s křivkou](docs://howto-resource-toewijzen)).

### Zobrazení a změna práce

U úkolu s přiřazeními se v části *Přiřazení* panelu *Vlastnosti* objeví sloupec *Práce (zbývá)*, vedle *Jedn./den*. Ten sloupec ukazuje zbývající práci daného zdroje v hodinách. Malý zámek nad sloupcem ukazuje, co pravidlo drží. U *Jedn./den* je to při možnosti *Pevné trvání a jednotky* a při možnosti *Pevné jednotky*. U *Práce (zbývá)* je to při možnosti *Pevné trvání a práce* a při možnosti *Pevná práce*.

Chcete-li práci změnit sami, napište hodiny do pole a stiskněte Enter. Aplikace nepřijme hodnotu 0 nebo nižší. Pole se vrátí na předchozí hodnotu.

### Co se stane

Když zvolíte pravidlo, zatím se žádné číslo nezmění. Pravidlo, které chrání práci, jen zafixuje aktuální práci. *Práce (zbývá)* pak má uloženou hodnotu. Pravidlo rozhodne, co se posune, až při příští změně. Změňte například *Jedn./den* a sledujte, co se stane s dobou trvání a s prací.

Změní-li se tím doba trvání úkolu, ve stavovém řádku se objeví *Zastaralé — přepočítejte (F5)*. Stiskněte **Přepočítat** (F5), například na kartě *Domů › Plán › Přepočítat*, a uvidíte nové termíny. Je-li zapnuto *Automaticky přepočítat* (na stejné kartě *Plán*, pod nadpisem *Přepočítání*), aplikace to udělá sama.

## Které pravidlo se hodí

- **Pevné trvání a jednotky** se hodí, když je doba trvání dohodnutá a jednotky přiřazení zadáváte vy. Práce z nich vyplyne. Toto je výchozí volba. Jeřáb najatý na jeden den patří sem: den je pevný a vy určíte, kolik jeřábů na něm bude.
- **Pevné trvání a práce** se hodí, když musí úkol skončit v pevném období a víte, kolik práce v něm je. Změní-li se doba trvání, aplikace upraví jednotky.
- **Pevná práce** se hodí, když víte, kolik hodin práce je v úkolu, a chcete vidět, jak se doba trvání mění s počtem lidí. Zdicí práce 160 hodin se třemi lidmi místo dvou patří sem. Omítky v cvičném projektu dostávají toto pravidlo.
- **Pevné jednotky** se hodí, když jsou jednotky pevné, například jeden jeřáb, a práce určí dobu trvání.

## Úskalí a co aplikace udělá

**Pole *Pravidlo pevné veličiny* chybí.** Pak je nastavení *Zobrazit pravidla pevné veličiny a práci* vypnuté a soubor zatím žádná pravidla nemá, nebo jste vybrali milník, fázi, překlenovací úkol nebo úkol s typem doby trvání *Uplynulá doba trvání*. Tam pravidlo není. Vyberte běžný úkol.

**Doba trvání se změní, aniž jste ji změnili.** U pravidel *Pevná práce* a *Pevné jednotky* vyplyne doba trvání z jednotek a práce. Když jednu z nich nebo počet zdrojů změníte, aplikace dobu trvání upraví a zaokrouhlí ji nahoru na celé pracovní dny. U úkolu v hodinách zaokrouhlí aplikace nahoru na celé minuty.

**Práce přesně neodpovídá jednotkám přiřazení × době trvání.** Může to způsobit zaokrouhlení. Vedle *Práce (zbývá)* se pak objeví varovná značka *Liší se od jednotek přiřazení × doby trvání*. Histogram sleduje uloženou práci.

**Materiál se nepočítá.** U materiálového zdroje ukazuje *Práce (zbývá)* pomlčku. Materiál nikdy neurčuje dobu trvání.

**Úkol s průběhem.** Pravidlo pracuje se zbývající částí. *Práce (zbývá)* proto ukazuje jen to, co ještě zbývá udělat.

**Vrácení zpět.** Zvolení pravidla a každá změna, kterou pravidlo vypočítá, je jeden krok pro *Vrátit zpět* (Ctrl+Z). Pravidlo pak zmizí. Pole *Pravidlo pevné veličiny* zůstane viditelné.

## Viz také

- [Pravidla pevné veličiny: doba trvání, jednotky přiřazení a práce](docs://uitleg-werkregels): jak aplikace spojuje dobu trvání, jednotky přiřazení a práci, s propočítanými příklady.
- [Přiřazení zdrojů s křivkou](docs://howto-resource-toewijzen): přidání zdroje na úkol.
