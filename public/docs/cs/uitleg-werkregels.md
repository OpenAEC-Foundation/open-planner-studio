# Typy úkolů: doba trvání, jednotky přiřazení a práce

Na omítání nasadíte jednoho omítače. Úkol pak trvá čtyři dny. Když přidáte druhého omítače, práce se dá udělat za dva dny. Úkol může trvat i čtyři dny, ale pak je v něm dvakrát tolik práce. Obě možnosti dávají smysl. Která z nich se použije, závisí na **typu úkolu**. V tomto článku se dozvíte, jak aplikace spojuje dobu trvání, jednotky přiřazení a práci. A také co každý typ úkolu drží pevné.

## Pojem

Tři veličiny jsou navzájem svázány:

- **Doba trvání**: jak dlouho úkol běží, v pracovních dnech nebo v hodinách.
- **Jednotky přiřazení**: kolik zdroje pracuje na úkolu za pracovní den. V panelu *Vlastnosti* se tomu říká *Jednotky přiřazení*, v jiných oknech *Jedn./den*. Jednotka 1 znamená jednoho omítače na celý den, 2 znamená dva omítače a 0,5 znamená půl dne.
- **Práce**: celkový počet hodin, které zdroj na úkolu stráví.

Vztah je: práce = doba trvání × jednotky × hodiny za pracovní den. Hodiny za pracovní den pocházejí z kalendáře úkolu. Omítání čtyř pracovních dnů jedním omítačem je při pracovním dni o 8 hodinách 4 × 1 × 8 = 32 hodin práce.

Když změníte jednu z těchto tří veličin, musí se aspoň jedna z dalších dvou přizpůsobit. Jinak vztah přestane platit. Která to bude, rozhoduje typ úkolu. Nastavujete ho pro každý úkol zvlášť v panelu *Vlastnosti*. Aplikace zobrazí typ úkolu a práci teprve tehdy, když je zapnete. Jak to funguje, je popsáno v článku [Výběr typu úkolu](docs://howto-werkregel-kiezen).

Typ úkolu funguje jen u běžných úkolů. Milníky, fáze (souhrnné úkoly), překlenovací úkoly a úkoly, jejichž *Typ doby trvání* je *Uplynulá doba trvání*, typ úkolu nemají. Pole *Typ úkolu* u nich není. Ani materiál, například beton nebo omítková malta, se nepočítá. Množství materiálu nikdy neurčuje dobu trvání a aplikace ji kvůli typu úkolu nikdy neupraví.

## Jak aplikace počítá

### Typ úkolu působí na to, co změníte

Aplikace přepočítá dobu trvání, jednotky a práci jen v okamžiku, kdy změníte jednu z nich: dobu trvání úkolu, jednotky přiřazení, práci, zdroj, který přidáte nebo odeberete, nebo hodiny za den v kalendáři. **Přepočítat** (F5) žádnou z nich nezmění. Klávesa F5 jen přepočítá termíny. Ani výběr typu úkolu nezmění žádné číslo. Typ úkolu se uplatní při vaší příští změně.

Když typ úkolu změní dobu trvání úkolu, plán je zastaralý. Stavový řádek pak ukáže *Zastaralé — přepočítejte (F5)*, pokud není zapnuto *Automaticky přepočítat*.

### Čtyři typy úkolů

V panelu *Vlastnosti* je vedle rozbalovací nabídky *Typ úkolu* ikona i. Najeďte na ni, klikněte na ni nebo na ni klepněte. Aplikace vysvětlí typ úkolu, který platí teď. V otevřené nabídce má každá volba také takovou ikonu i. Vysvětlení začíná tučnou větou. Čtyři typy úkolů s touto větou z aplikace:

- **Pevné trvání a jednotky** (*Práce vyplývá z doby trvání a jednotek přiřazení.*). Toto je výchozí typ. Aplikace nikdy sama nemění dobu trvání a práce se řídí dobou trvání a jednotkami. Když práci zadáte sami, aplikace upraví jednotky, protože doba trvání je pevná.
- **Pevné trvání a práce** (*Jednotky přiřazení vyplývají z doby trvání a práce.*). Aplikace nikdy sama nemění dobu trvání. Když dobu trvání změníte, práce zůstane a jednotky se upraví.
- **Pevná práce** (*Doba trvání vyplývá z práce a jednotek přiřazení.*). Práce je pevná a doba trvání se řídí prací a jednotkami.
- **Pevné jednotky** (*Doba trvání vyplývá z práce a jednotek přiřazení.*). Jednotky jsou pevné a doba trvání se řídí prací.

Dva typy úkolů tedy dobu trvání nechávají být. U zbylých dvou se doba trvání přizpůsobí, když změníte jednotky, práci nebo počet zdrojů. Při jednom zdroji dělají pevná práce a pevné jednotky totéž. Liší se, když dobu trvání změníte sami. U pevné práce se práce zachová a jednotky se upraví. U pevných jednotek se jednotky zachovají a práce poroste. Liší se také tehdy, když je na úkolu více zdrojů (viz níže).

Příklady níže ukazují, co každý typ úkolu dělá.

### Zaokrouhlení

Doba trvání, která vyjde ze vztahu, se aplikací zaokrouhlí nahoru. U úkolu v dnech na celé pracovní dny, u úkolu v hodinách na celé minuty. Práce a jednotky zůstanou tak, jak jste je zadali, nebo jak je aplikace vzala ze vztahu. Vztah proto někdy přestane přesně platit. Příklad níže ukazuje, co se pak stane.

### Více zdrojů

Pokud má úkol více zdrojů, platí dvě pravidla. U pevného trvání a práce, pevné práce a pevných jednotek zůstane celková práce stejná, když přidáte nebo odeberete zdroj. Aplikace ji pak rozdělí podle jednotek. U pevného trvání a jednotek přinese nový zdroj vlastní práci. U pevné práce a pevných jednotek rozhoduje o době trvání nejpomalejší zdroj. U každého zdroje je to práce vydělená jednotkami. Počítá se největší výsledek.

Příklad: dva zdroje mají každý 32 hodin práce a jednotky 1, dohromady 4 pracovní dny. Jednotky prvního nastavíte na 0,5. Doba trvání se pak změní na 8 pracovních dnů. U pevné práce si druhý zdroj ponechá 32 hodin práce a jeho jednotky klesnou na 0,5. U pevných jednotek si druhý zdroj ponechá jednotky 1 a jeho práce vzroste na 64 hodin.

### Průběh

Když už úkol má průběh, typ úkolu působí na zbývající část: na zbývající dobu trvání a zbývající práci. V panelu *Vlastnosti* je tato práce ve sloupci *Práce (h)*. Co je hotovo, zůstane.

### Úkoly v hodinách

Hodinový úkol, tedy úkol plánovaný v hodinách, se počítá stejně, jen v minutách. Když je na úkolu s dobou trvání 5 hodin jen crane, je to 5 hodin práce. U pevné práce se pak doba trvání při jednotkách 2 změní na 2,5 hodiny. Na úkolu hollow-core floor v cvičném projektu je také carpentry crew. Ten stále potřebuje 5 hodin práce, je nejpomalejší, a doba trvání proto zůstane 5 hodin. Jak spolu souvisí hodiny a dny, je vysvětleno v článku [Dny a hodiny](docs://uitleg-dagen-en-uren).

## Propracovaný příklad: omítání

Příklad pochází z cvičného projektu kurzů *House extension*. V kurzu 5 na to přijdete sami a čísla si zkontrolujete. Tady si přečtete, co každý typ úkolu dělá.

Omítání trvá 4 pracovní dny. Přiřazen je jeden omítač s jednotkami 1 a pracovní den má 8 hodin. Práce je tedy 32 hodin.

### Pevné trvání a jednotky

- Nastavíte dobu trvání na 6 pracovních dnů: práce vzroste na 48 hodin, jednotky zůstanou 1.
- Nastavíte jednotky na 2: doba trvání zůstane 4 pracovní dny, práce bude 64 hodin.
- Do pole *Práce (h)* napíšete 48 hodin: doba trvání zůstane 4 pracovní dny, jednotky budou 1,5.
- Přiřadíte druhý zdroj, například *Plasterer 2*, s jednotkami 1: doba trvání zůstane 4 pracovní dny a ten druhý přinese 32 hodin práce, dohromady 64 hodin.

### Pevné trvání a práce

- Nastavíte dobu trvání na 6 pracovních dnů: práce zůstane 32 hodin, jednotky klesnou na 0,67.
- Nastavíte jednotky na 2: doba trvání zůstane 4 pracovní dny. Protože je doba trvání pevná, práce s ní vzroste na 64 hodin.
- Do pole *Práce (h)* napíšete 16 hodin: doba trvání zůstane 4 pracovní dny, jednotky budou 0,5.
- Přiřadíte druhý zdroj, například *Plasterer 2*, s jednotkami 1: 32 hodin se rozdělí, po 16 hodinách, a jednotky budou u obou 0,5. Doba trvání zůstane 4 pracovní dny.

### Pevná práce

- Nastavíte dobu trvání na 6 pracovních dnů: práce zůstane 32 hodin, jednotky klesnou na 0,67.
- Nastavíte jednotky na 2: práce zůstane 32 hodin a doba trvání bude 2 pracovní dny. Tento krok uděláte v kurzu 5.
- Do pole *Práce (h)* napíšete 48 hodin: jednotky zůstanou 1 a doba trvání bude 6 pracovních dnů.
- Přiřadíte druhý zdroj, například *Plasterer 2*, s jednotkami 1: 32 hodin se rozdělí, po 16 hodinách, a doba trvání bude 2 pracovní dny. Když ten druhý zdroj zase odeberete, doba trvání bude opět 4 pracovní dny.

### Pevné jednotky

- Nastavíte dobu trvání na 6 pracovních dnů: jednotky zůstanou 1, práce vzroste na 48 hodin.
- Nastavíte jednotky na 2: práce zůstane 32 hodin a doba trvání bude 2 pracovní dny.
- Do pole *Práce (h)* napíšete 48 hodin: jednotky zůstanou 1 a doba trvání bude 6 pracovních dnů.
- Přiřadíte druhý zdroj, například *Plasterer 2*, s jednotkami 1: 32 hodin se rozdělí, po 16 hodinách, a doba trvání bude 2 pracovní dny.

### Když vztah nevyjde

U pevné práce nastavíte jednotky na 3. Práce je 32 hodin, takže doba trvání bude 32 ÷ (3 × 8) = 1,33 pracovního dne. Aplikace to zaokrouhlí nahoru na 2 pracovní dny. Práce (32 hodin) a jednotky (3) zůstanou, ale 2 × 3 × 8 je 48 hodin. Histogram proto rozloží 32 hodin na 2 pracovní dny: 2 jednotky za den, ne 3. V poli *Práce (h)* se objeví výstražná značka *Liší se od jednotek přiřazení × doby trvání*, aby na to upozornila.

U dvou zdrojů s různými jednotkami je to stejné. Když u pevné práce přidáte druhý zdroj, například *Plasterer 2*, s jednotkami 2 k omítači s jednotkami 1, aplikace rozdělí 32 hodin v poměru 1 : 2, tedy 10,7 a 21,3 hodiny. Oba pak potřebují 1,33 pracovního dne. Doba trvání bude 2 pracovní dny.

Soubor z P6 nebo z MS Project může mít také *Práce (zbývá)*, která se nerovná jednotkám × zbývající době trvání. Objeví se pak stejná výstražná značka. Aplikace tuto práci sama nemění. Když změníte dobu trvání takového úkolu, aplikace se řídí typem úkolu, i když zbývající práce přišla ze souboru. U typů úkolu *Pevné trvání a jednotky* a *Pevné jednotky* se zbývající práce změní na jednotky × novou zbývající dobu trvání. U typů úkolu *Pevné trvání a práce* a *Pevná práce* práce zůstane a jednotky se upraví. Pokud tím zbývající práce ze souboru zmizí, dostanete oznámení se starým a novým počtem hodin. Ctrl+Z vrátí starou hodnotu. Vysvětlení u výstražné značky vám u každého úkolu řekne, která z těchto dvou možností nastane.

### Jiný kalendář

U pevné práce se pracovní den v kalendáři zkrátí z 8 na 6 hodin. Práce zůstane 32 hodin, takže doba trvání bude 32 ÷ 6 = 5,33, zaokrouhleno nahoru na 6 pracovních dnů. Jak aplikace počítá pracovní dny a pracovní hodiny, je vysvětleno v článku [Kalendáře a pracovní dny](docs://uitleg-kalenders). Aplikace hlásí: *Typ úkolu po změně kalendáře upravil dobu trvání: 1 úkol (práce zůstává, hodiny za den se změnily)*.

### Úkol s průběhem

Úkol inner cavity leaf trvá 5 pracovních dnů a je hotový z 40 %: 2 pracovní dny jsou hotové a 3 pracovní dny (24 hodin) zbývají. U pevné práce nastavíte jednotky z 1 na 2. Zbývající práce zůstane 24 hodin a zbývající doba trvání bude 1,5, zaokrouhleno nahoru na 2 pracovní dny. Úkol teď trvá 2 + 2 = 4 pracovní dny a průběh je 50 %. Procento se posune, protože hotová část zůstane stejná a zbytek se zkrátí.

## Důsledky a mylné představy

**„Pevná práce znamená, že doba trvání je pevná.“** Ne, je to přesně naopak. U typů úkolu *Pevné trvání a jednotky* a *Pevné trvání a práce* je doba trvání pevná. U typů úkolu *Pevná práce* a *Pevné jednotky* se doba trvání řídí podle zbylých dvou.

**„Když zvolím typ úkolu, změní se můj plán.“** Ne. Volba nezmění žádné číslo. Teprve při vaší příští změně rozhodne typ úkolu, co se pohne. U typu úkolu, který chrání práci, aplikace práci v okamžiku volby zafixuje, aby bylo co chránit. Takový úkol pak má uloženou hodnotu *Práce (h)*.

**„Doba trvání se změnila, aniž bych ji upravil.“** To se může stát po změně jednotek přiřazení, práce, počtu zdrojů nebo hodin za den, u pevné práce nebo pevných jednotek. Stavový řádek pak ukáže, že plán je zastaralý. Stiskněte **Přepočítat** (F5), abyste viděli nové termíny.

**Bez přiřazení typ úkolu nic nedělá.** Nejsou pak žádné jednotky ani práce, na které by se vázala doba trvání.

**Soubory z MS Project nebo z Primavera P6 vždy ukazují typ úkolu.** U úkolu z MS Project si aplikace někdy ponechá nastavení *řízeno úsilím*. Toto uložené nastavení mění dva případy. U typu úkolu *Pevné trvání a práce* s nastavením *řízeno úsilím* se při změně doby trvání pohne práce, místo jednotek. U typu úkolu *Pevné jednotky* bez nastavení *řízeno úsilím* se při přidání nebo odebrání zdroje pohne práce a doba trvání zůstane. Úkoly, které vytvoříte v aplikaci, toto nastavení nemají. Vysvětlení za ikonou i s tímto nastavením počítá.

## Viz také

- [Výběr typu úkolu](docs://howto-werkregel-kiezen): postup pro nastavení typu úkolu.
- [Přiřazení zdrojů s křivkou](docs://howto-resource-toewijzen): přiřazení zdroje k úkolu, s jednotkami přiřazení a rozložením práce.
- [Dny a hodiny](docs://uitleg-dagen-en-uren): jak aplikace převádí dny a hodiny.
- [Kalendáře a pracovní dny](docs://uitleg-kalenders): jak aplikace počítá pracovní dny a pracovní hodiny.
