# Pravidla pevné veličiny: doba trvání, jednotky a práce

Na plastering nasadíte jednoho omítače. Úkol pak trvá čtyři dny. Když přidáte druhého omítače, práci zvládnete za dva dny. Úkol může trvat i čtyři dny, ale pak je v něm dvakrát tolik práce. Obě možnosti dávají smysl. Která z nich se použije, závisí na **pravidle pevné veličiny** úkolu. V tomto článku se dozvíte, jak aplikace spojuje dobu trvání, jednotky přiřazení a práci. Dozvíte se také, co každé pravidlo drží pevné.

## Pojem

Tři veličiny jsou navzájem svázány:

- **Doba trvání**: jak dlouho úkol běží, v pracovních dnech nebo v hodinách.
- **Jednotky přiřazení**: kolik zdroje pracuje na úkolu za pracovní den. V aplikaci se tomu říká *Jedn./den*. Jednotka 1 znamená jednoho omítače na celý den, 2 znamená dva omítače a 0,5 znamená půl dne.
- **Práce**: celkový počet hodin, které zdroj věnuje úkolu.

Vztah je: práce = doba trvání × jednotky × hodiny za pracovní den. Hodiny za pracovní den pocházejí z kalendáře úkolu. Plastering na čtyři pracovní dny jedním omítačem má při pracovním dni o 8 hodinách 4 × 1 × 8 = 32 hodin práce.

Když změníte jednu z těchto tří veličin, musí se přizpůsobit aspoň jedna z dalších dvou. Jinak vztah neplatí. Pravidlo pevné veličiny rozhodne, která to bude. Nastavujete je pro každý úkol v panelu *Vlastnosti*. Aplikace zobrazí pravidlo a práci až poté, co je zapnete. Jak to funguje, je popsáno v článku [Výběr pravidla pevné veličiny](docs://howto-werkregel-kiezen).

Pravidlo pevné veličiny funguje jen u běžných úkolů. Na milníky, fáze (souhrnné úkoly), překlenovací úkoly a úkoly, jejichž *Typ doby trvání* je *Uplynulá doba trvání*, pravidlo pevné veličiny nepůsobí. Pole *Pravidlo pevné veličiny* tam není. Materiál, například beton nebo omítková malta, se také nepočítá. Množství materiálu nikdy neřídí dobu trvání. Aplikace ji kvůli pravidlu nikdy neupraví.

## Jak aplikace počítá

### Pravidlo pevné veličiny působí na to, co změníte

Aplikace přepočítá dobu trvání, jednotky a práci jen v okamžiku, kdy změníte jednu z nich. Jde o dobu trvání úkolu, jednotky přiřazení, práci, zdroj, který přidáte nebo odeberete, a hodiny za den v kalendáři. **Přepočítat** (F5) nic z toho nezmění. Klávesa F5 jen určí termíny. Samotný výběr pravidla pevné veličiny také nezmění ani jedno číslo. Pravidlo pevné veličiny se uplatní při vaší příští změně.

Když pravidlo pevné veličiny změní dobu trvání úkolu, plán je zastaralý. Stavový řádek pak zobrazí *Zastaralé — přepočítejte (F5)*, pokud není zapnuto *Automaticky přepočítat*.

### Čtyři pravidla pevné veličiny

V panelu *Vlastnosti* pod rozbalovací nabídkou aplikace ukáže, co zvolené pravidlo pevné veličiny chrání. Čtyři pravidla pevné veličiny s vlastním textem aplikace:

- **Pevné trvání a jednotky** (*Chráněno: doba trvání a jednotky (práce se řídí)*). Toto je výchozí hodnota. Aplikace nikdy nemění dobu trvání sama. Práce se řídí dobou trvání a jednotkami. Když práci zadáte sami, aplikace upraví jednotky, protože doba trvání je pevná.
- **Pevné trvání a práce** (*Chráněno: doba trvání a práce (jednotky se řídí)*). Aplikace nikdy nemění dobu trvání sama. Když dobu trvání změníte, práce zůstane a jednotky se upraví.
- **Pevná práce** (*Chráněno: práce (doba trvání se řídí jednotkami)*). Práce je pevná a doba trvání se řídí prací a jednotkami.
- **Pevné jednotky** (*Chráněno: jednotky (doba trvání se řídí prací)*). Jednotky jsou pevné a doba trvání se řídí prací.

Dvě z pravidel pevné veličiny tedy dobu trvání nechávají být. U zbylých dvou se doba trvání přizpůsobí, když změníte jednotky, práci nebo počet zdrojů. Při jednom zdroji dělají pevná práce a pevné jednotky tam totéž. Liší se, když dobu trvání změníte sami. Pevná práce: práce zůstane a jednotky se upraví. Pevné jednotky: jednotky zůstanou a práce s dobou trvání poroste. Liší se také tehdy, když je na úkolu víc zdrojů (viz níže).

Příklady níže ukazují, co každé pravidlo dělá.

### Zaokrouhlení

Aplikace zaokrouhlí dobu trvání, která vyjde ze vztahu, nahoru. U úkolu v dnech je to na celé pracovní dny. U úkolu v hodinách je to na celé minuty. Práce a jednotky zůstanou tak, jak jste je zadali, nebo jak je aplikace převzala ze vztahu. Vztah proto někdy přestane přesně platit. Příklad níže ukazuje, co se pak stane.

### Více zdrojů

Pokud má úkol více zdrojů, platí dvě dohody. U pevné práce, pevného trvání a práce a pevných jednotek zůstane celková práce stejná, když přidáte nebo odeberete zdroj. Aplikace ji pak rozdělí podle jednotek. U pevného trvání a jednotek přinese nový zdroj vlastní práci. U pevné práce a pevných jednotek rozhoduje o době trvání nejpomalejší zdroj. U každého zdroje je to práce vydělená jednotkami. Počítá se největší výsledek.

Příklad: dva zdroje mají každý 32 hodin práce a jednotky 1, dohromady 4 pracovní dny. Jednotky prvního nastavíte na 0,5. Doba trvání se pak změní na 8 pracovních dnů. U pevné práce si druhý zdroj ponechá 32 hodin práce a jeho jednotky klesnou na 0,5. U pevných jednotek si druhý zdroj ponechá jednotky 1 a jeho práce vzroste na 64 hodin.

### Průběh

Když úkol už má průběh, pravidlo pevné veličiny se týká zbývající doby trvání a zbývající práce. V aplikaci se ta práce jmenuje *Práce (zbývá)*. Co je hotovo, zůstane.

### Úkoly v hodinách

Hodinový úkol se počítá stejně, jen v minutách. Když na úkolu s dobou trvání 5 hodin pracuje jen crane, je to 5 hodin práce. U pevné práce se pak doba trvání při jednotkách 2 změní na 2,5 hodiny. Na úkolu hollow-core floor v cvičném projektu je také carpentry crew. Ten stále potřebuje 5 hodin práce a je nejpomalejší, takže doba trvání zůstane 5 hodin. Jak spolu souvisí hodiny a dny, je vysvětleno v článku [Dny a hodiny](docs://uitleg-dagen-en-uren).

## Propracovaný příklad: plastering

Příklad pochází z cvičného projektu kurzů *House extension*. V kurzu 5 na to přijdete sami a čísla si zkontrolujete. Tady si přečtete, co každé pravidlo dělá.

Na plastering připadají 4 pracovní dny. Přiřazen je jeden omítač s jednotkami 1 a pracovní den má 8 hodin. Práce je tedy 32 hodin.

### Pevné trvání a jednotky

- Nastavíte dobu trvání na 6 pracovních dnů: práce vzroste na 48 hodin, jednotky zůstanou 1.
- Nastavíte jednotky na 2: doba trvání zůstane 4 pracovní dny, práce bude 64 hodin.
- Do pole *Práce (zbývá)* napíšete 48 hodin: doba trvání zůstane 4 pracovní dny, jednotky budou 1,5.
- Přiřadíte druhý zdroj, například *Plasterer 2*, s jednotkami 1: doba trvání zůstane 4 pracovní dny a ten druhý přinese 32 hodin práce, dohromady 64 hodin.

### Pevné trvání a práce

- Nastavíte dobu trvání na 6 pracovních dnů: práce zůstane 32 hodin, jednotky klesnou na 0.67.
- Nastavíte jednotky na 2: doba trvání zůstane 4 pracovní dny. Protože je doba trvání pevná, s ní práce vzroste na 64 hodin.
- Do pole *Práce (zbývá)* napíšete 16 hodin: doba trvání zůstane 4 pracovní dny, jednotky budou 0,5.
- Přiřadíte druhý zdroj, například *Plasterer 2*, s jednotkami 1: 32 hodin se rozdělí, 16 hodin každému, a jednotky budou 0,5 u obou. Doba trvání zůstane 4 pracovní dny.

### Pevná práce

- Nastavíte dobu trvání na 6 pracovních dnů: práce zůstane 32 hodin, jednotky klesnou na 0.67.
- Nastavíte jednotky na 2: práce zůstane 32 hodin a doba trvání bude 2 pracovní dny. Tento krok uděláte v kurzu 5.
- Do pole *Práce (zbývá)* napíšete 48 hodin: jednotky zůstanou 1 a doba trvání bude 6 pracovních dnů.
- Přiřadíte druhý zdroj, například *Plasterer 2*, s jednotkami 1: 32 hodin se rozdělí, 16 hodin každému, a doba trvání bude 2 pracovní dny. Ten druhý zdroj odeberete a doba trvání bude opět 4 pracovní dny.

### Pevné jednotky

- Nastavíte dobu trvání na 6 pracovních dnů: jednotky zůstanou 1, práce vzroste na 48 hodin.
- Nastavíte jednotky na 2: práce zůstane 32 hodin a doba trvání bude 2 pracovní dny.
- Do pole *Práce (zbývá)* napíšete 48 hodin: jednotky zůstanou 1 a doba trvání bude 6 pracovních dnů.
- Přiřadíte druhý zdroj, například *Plasterer 2*, s jednotkami 1: 32 hodin se rozdělí, 16 hodin každému, a doba trvání bude 2 pracovní dny.

### Když vztah nevyjde

U pevné práce nastavíte jednotky na 3. Práce je 32 hodin, takže doba trvání bude 32 ÷ (3 × 8) = 1,33 pracovního dne. Aplikace to zaokrouhlí nahoru na 2 pracovní dny. Práce (32 hodin) a jednotky (3) zůstanou, ale 2 × 3 × 8 je 48 hodin. Histogram proto rozloží 32 hodin na 2 pracovní dny: 2 jednotky za den, ne 3. Vedle *Práce (zbývá)* se objeví výstražná značka *Liší se od jednotek přiřazení × doby trvání*, aby to ukázala.

Se dvěma zdroji s různými jednotkami je to stejné. Když u pevné práce přidáte druhý zdroj, například *Plasterer 2*, s jednotkami 2 k omítači s jednotkami 1, aplikace rozdělí 32 hodin v poměru 1 : 2, tedy 10,7 a 21,3 hodiny. Oba pak potřebují 1,33 pracovního dne. Doba trvání bude 2 pracovní dny.

### Jiný kalendář

U pevné práce se pracovní den v kalendáři zkrátí z 8 na 6 hodin. Práce zůstane 32 hodin, takže doba trvání bude 32 ÷ 6 = 5,33, zaokrouhleno nahoru na 6 pracovních dnů. Jak aplikace počítá pracovní dny a pracovní hodiny, je vysvětleno v článku [Kalendáře a pracovní dny](docs://uitleg-kalenders). Aplikace hlásí: *Pravidlo pevné veličiny po změně kalendáře upravilo dobu trvání: 1 úkol (práce zůstává, hodiny za den se změnily).*

### Úkol s průběhem

Úkol inner cavity leaf trvá 5 pracovních dnů a je hotový z 40%: 2 pracovní dny jsou hotové a 3 pracovní dny (24 hodin) zbývají. U pevné práce nastavíte jednotky z 1 na 2. Zbývající práce zůstane 24 hodin a zbývající doba trvání bude 1,5, zaokrouhleno nahoru na 2 pracovní dny. Úkol teď trvá 2 + 2 = 4 pracovní dny a průběh je 50%. Procento se posune, protože hotová část zůstane stejná a zbytek se zkrátí.

## Důsledky a mylné představy

**„Pevná práce znamená, že doba trvání je pevná.“** Ne, je to přesně naopak. U pravidel *Pevné trvání a jednotky* a *Pevné trvání a práce* je doba trvání pevná. U pravidel *Pevná práce* a *Pevné jednotky* se doba trvání řídí podle zbylých dvou.

**„Když zvolím pravidlo, změní se můj plán.“** Ne. Volba nezmění žádné číslo. Teprve při vaší příští změně rozhodne pravidlo, co se pohne. U pravidla, které chrání práci, aplikace práci v okamžiku volby zafixuje, aby existovalo číslo k ochraně. Takový úkol pak má uloženou hodnotu *Práce (zbývá)*.

**„Doba trvání se změnila, aniž bych ji sám upravil.“** Může se to stát po změně jednotek přiřazení, práce, počtu zdrojů nebo hodin za den u pevné práce nebo pevných jednotek. Stavový řádek pak ukáže, že plán je zastaralý. Stiskněte **Přepočítat** (F5), abyste viděli nové termíny.

**Bez přiřazení nic nedělá pravidlo pevné veličiny.** Nejsou pak žádné jednotky ani práce, na které by se vázala doba trvání.

**Soubory z MS Project nebo z Primavera P6 vždy ukazují pravidlo pevné veličiny.** U úkolu z MS Project se pod pravidlem někdy objeví text *Z MS Project: řízeno úsilím* nebo *Z MS Project: neřízeno úsilím*. Toto uložené nastavení mění dva případy. Pokud je úkol řízený úsilím a jeho pravidlo je *Pevné trvání a práce*, pohne se při změně doby trvání práce, místo jednotek. Pokud je úkol neřízený úsilím a jeho pravidlo je *Pevné jednotky*, pohne se při přidání nebo odebrání zdroje práce a doba trvání zůstane. Úkoly, které vytvoříte v aplikaci, toto nastavení nemají.

## Viz také

- [Výběr pravidla pevné veličiny](docs://howto-werkregel-kiezen): postup pro nastavení pravidla pevné veličiny úkolu.
- [Přiřazení zdrojů s křivkou](docs://howto-resource-toewijzen): přiřazení zdroje k úkolu, s jednotkami přiřazení a rozložením práce.
- [Dny a hodiny](docs://uitleg-dagen-en-uren): jak aplikace převádí dny a hodiny.
- [Kalendáře a pracovní dny](docs://uitleg-kalenders): jak aplikace počítá pracovní dny a pracovní hodiny.
