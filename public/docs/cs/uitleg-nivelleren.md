# Vyrovnání zdrojů

Máte jednoho zedníka a dvě zdi, které se musí stavět ve stejných dnech. Na papíře plán funguje, ale v praxi může být zedník jen na jednom místě. Vyrovnání je způsob, jak aplikace takové kolize řeší: posouvá začátky úkolů později, dokud zdroj práci zvládne. V tomto článku se dozvíte přesně, co vyrovnání posouvá, kdy se posune datum dokončení a co za vás nevyřeší.

## Pojem

Zdroj je na pracovním dni **přetížen**, když od něj plán na ten den chce víc, než dokáže dodat. Co dokáže dodat, je jeho kapacita: *Maximální počet jednotek* v pracovních dnech jeho kalendáře. Pokud podle svého kalendáře daný den nepracuje, je jeho kapacita 0.

**Vyrovnání** to řeší tak, že úkoly začnou později. Nedělá nic víc. Úkol nezkracuje ani nerozděluje, nemění jednotky přiřazení ani závislosti a nepřidává další zdroj. Pro každý úkol aplikace hledá první místo, kde jsou zdroje volné, a úkol tam posune.

V okně *Vyrovnání zdrojů* jsou dva způsoby:

- Ve výchozím nastavení se může datum dokončení projektu posunout. To je vyrovnání v pravém smyslu.
- Když zapnete políčko *Vyrovnat jen v rámci časové rezervy — datum dokončení projektu zůstane pevné*, aplikace posune úkoly jen v rámci jejich časové rezervy. Datum dokončení pak zůstane stejné. Pokud to nejde, úkol zůstane tam, kde je, a aplikace hlásí konflikt. Co je časová rezerva, se dozvíte v článku [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad).

## Jak aplikace počítá

### Kolik úkol žádá

Aplikace počítá pro každý pracovní den, kolik jednotek každý úkol od zdroje žádá. Jde o jednotky přiřazení podle křivky nebo podle vašeho vlastního rozložení práce, tedy o stejné hodiny za den, jaké ukazuje histogram. Kapacita zdroje je *Maximální počet jednotek*, nebo hodnota kroku v kapacitě rozložené v čase, která platí pro ten den. Den je přetížen, když je poptávka vyšší než kapacita.

### V jakém pořadí

Aplikace umísťuje úkoly jeden po druhém v tomto pořadí: nejdřív nejvyšší priorita, potom úkol s nejmenší celkovou časovou rezervou, potom nejdřívější zahájení a nakonec pořadí v tabulce úkolů. Úkol přijde na řadu teprve až jeho předchůdci mají své místo.

Priorita je číslo od 0 do 1000, které nastavujete u každého úkolu. Výchozí hodnota je 500. V nabídce pravého tlačítka na pruhu úkolu se nazývá *Priorita*, s volbami *Nízká* (100), *Normální* (500) a *Vysoká* (900). Úkol, který přijde na řadu dřív, dostane místo, které chce. Úkoly, které přijdou potom, se musí přizpůsobit. Priorita tak rozhoduje, který úkol zůstane a který ustoupí. Hodnota 1000 je zvláštní: takový úkol se kvůli kapacitě nikdy neposune. Je to „Do Not Level“ z MS Project.

### Kam se úkol posune

Pro každý úkol aplikace začíná u nejdřívějšího zahájení, které závislosti dovolují. Bere přitom v úvahu, že předchůdci se možná už sami posunuli. Pokud se úkol tam vejde, zůstane. Pokud se nevejde, aplikace zkusí další pracovní den úkolu, a tak dál. Úkol se vejde, když má každý zdroj na každý den úkolu dost volné kapacity. Když má úkol více zdrojů, musí být všechny na ty dny volné. Úkol se tedy vždy posune později, nikdy dřív.

Aplikace zapíše posun jako **zpoždění vyrovnání**: počet pracovních dnů v kalendáři úkolu, o které úkol začne později, než vyžadují jeho závislosti. Vidíte ho ve sloupci *Zpoždění vyrovnání* pod skupinou *Vypočítané*. Zpoždění se uloží do souboru projektu. Přepočítat (F5) zohlední zpoždění jako dodatečnou čekací dobu před zahájením. Úkoly, které na něj navazují, se posunou přes své závislosti.

### V rámci časové rezervy, nebo za ní

Bez možnosti *Vyrovnat jen v rámci časové rezervy — datum dokončení projektu zůstane pevné* aplikace hledá, dokud se úkol nevejde. Datum dokončení projektu se proto může posunout.

S možností *Vyrovnat jen v rámci časové rezervy — datum dokončení projektu zůstane pevné* nesmí úkol začít později než své pozdní zahájení. To je poslední den, kdy by mohl začít, aniž by se posunulo datum dokončení. Pokud se úkol do tohoto okna nevejde, zůstane na nejdřívějším místě. Úkol se pak objeví pod skupinou *Zbývající konflikty*.

### Co aplikace neposouvá

- Úkoly, které už začaly nebo jsou dokončeny. Jejich objem práce se počítá, ale nikdy nedostanou zpoždění vyrovnání.
- Úkoly s prioritou 1000. Řídí se podle svých předchůdců, ale kvůli kapacitě se neposouvají.
- Úkoly bez přiřazení k vybraným zdrojům, milníky a fáze. Posunou se jen tehdy, když se posune předchůdce.
- Materiál. Ten se nikdy nevyrovnává.

### Návrh a použití

*Přepočítat* vytvoří návrh: úkoly, které se posunou, se starým a novým začátkem a datum dokončení před a po posunu. Ve vašem plánu se nic nezmění, dokud nezvolíte *Použít*. Potom aplikace zapíše zpoždění k úkolům a plán hned přepočítá.

## Příklad: zedník na dvou zdech

Příklad je cvičný projekt kurzů *House extension* v tom stavu, v jakém je těsně před vyrovnáním v kurzu 5. V kurzu 5 to děláte sami a kontrolujete čísla. V tomto příkladu je omítání nastaveno jako *Pevná práce* a omítkář pracuje s jednotkami přiřazení 2, jak je popsáno v článku [Pravidla pevné veličiny: doba trvání, jednotky a práce](docs://uitleg-werkregels).

Po dutinovém stropu, který skončí v pondělí 28. června, začnou v úterý 29. června obě vrstvy: inner cavity leaf (5 pracovních dnů) a outer cavity leaf (6 pracovních dnů). Obě jsou přiřazeny zedníkovi, s jednotkami přiřazení 1 a hodnotou 1 v poli *Maximální počet jednotek*. Po inner leaf přijdou prvky střechy (práce jeřábu, 6 hodin) a krytina (2 pracovní dny). Rámy čekají na krytinu a na outer leaf. Předání je v pondělí 30. srpna.

### Přetížení

Inner leaf běží od 29. června do 5. července včetně, outer leaf od 29. června do 6. července včetně. Od 29. června do 5. července včetně, tedy 5 pracovních dnů, plán žádá 2 jednotky od zedníka s kapacitou 1. Zedník je na těch 5 dnech přetížen.

### Pořadí

Oba úkoly mají prioritu 500. Okenní rámy se dodají až 14. července (v kurzu 3 jste pro to nastavili omezení *Zahájit nejdříve (SNET)*). Inner leaf proto má 3 pracovní dny časové rezervy a outer leaf 5. Inner leaf má nejmenší časovou rezervu, proto jde první. Zůstane od 29. června do 5. července včetně.

### Posun

Outer leaf nemůže začít 29. června. První den, kdy je zedník zase volný, je úterý 6. července. To je o 5 pracovních dnů později než nejdřívější zahájení, takže zpoždění vyrovnání je 5. Outer leaf nyní běží od 6. do 13. července včetně. Rámy stejně začnou až 14. července, takže předání zůstane v pondělí 30. srpna. Okno hlásí *Datum dokončení projektu: beze změny (30-08-2027)* a ukazuje jeden řádek: *Build outer cavity leaf*, původní začátek 29-06-2027, nový začátek 06-07-2027, *5 d*.

Těchto 5 pracovních dnů posunu je přesně časová rezerva outer leaf. Proto zde možnost *Vyrovnat jen v rámci časové rezervy — datum dokončení projektu zůstane pevné* dá stejný výsledek. Outer leaf nyní nemá žádnou časovou rezervu a je kritický.

### Co když rámy nepřijdou 14. července

Bez tohoto omezení mohou rámy začít v pátek 9. července a předání je ve středu 25. srpna. Outer leaf pak má jen 2 pracovní dny časové rezervy.

- Bez možnosti *Vyrovnat jen v rámci časové rezervy — datum dokončení projektu zůstane pevné* se outer leaf stejně posune o 5 pracovních dnů. Rámy teď musí čekat: začnou 14. července, o 3 pracovní dny později. Vše, co na ně navazuje, se posune také a předání se změní z 25. srpna na 30. srpna, také o 3 pracovní dny později.
- S možností *Vyrovnat jen v rámci časové rezervy — datum dokončení projektu zůstane pevné* se nic neposune. Outer leaf se nevejde do svých 2 pracovních dnů časové rezervy. Okno ukazuje konflikt *Build outer cavity leaf*, 5 dní, s důvodem *V časové rezervě není dost volné kapacity, aby se tento konflikt vyřešil.*

### Co když má outer leaf přednost

Když nastavíte outer leaf prioritu *Vysoká* (900), přijde první. Zůstane od 29. června a inner leaf nyní ustoupí: o 6 pracovních dnů později, od 7. do 13. července včetně. Inner leaf má jen 3 pracovní dny časové rezervy, takže posun o 6 pracovních dnů je o 3 pracovní dny víc, než je jeho rezerva. Prvky střechy, rámy a vše za nimi se posunou také. Předání se změní z pondělí 30. srpna na čtvrtek 2. září. Stejné přetížení tedy dá jiné datum dokončení, podle toho, který úkol zůstane na místě.

### Co když přijde druhý zedník

Když nastavíte *Maximální počet jednotek* zedníka na 2, přetížení už není. *Přepočítat* hlásí *Žádné úkoly se nemusí posunout — plán je už bez konfliktů.*

## Důsledky a časté omyly

**„Vyrovnání najde nejkratší plán.“** Ne. Aplikace pracuje úkol po úkolu v pevném pořadí a nehledá nejlepší řešení celkově. Podívejte se na příklad s prioritou: jiná priorita dá jiné datum dokončení.

**„Vyrovnaný úkol je v bezpečí.“** Vyrovnání využívá časovou rezervu. Posunutý úkol pak má méně časové rezervy nebo žádnou a může se stát kritickým, jako outer leaf výše. Pokud pak nabere zpoždění, posune se i předání.

**„Vyrovnání sleduje moje pozdější změny.“** Ne. Zpoždění je pevný počet pracovních dnů. Když se inner leaf po vyrovnání zkrátí, outer leaf přesto začne o 5 pracovních dnů později, i když to už není potřeba. Vyrovnání pak proveďte znovu. Aplikace začne od začátku.

**Posunutím nelze vyřešit všechno.** Pokud zdroj nepracuje ve dnech, které úkol potřebuje, nebo úkol podle své křivky žádá v jeden den víc, než zdroj dokáže dodat, přetížení zůstane. Aplikace pak u úkolu uvede důvod.

**Materiál se nevyrovnává.** Pokud materiál žádá v jeden den víc, než je jeho kapacita, aplikace to hlásí jako přetížení, ale vyrovnání to nechá být.

**Připnuté úkoly.** Když všechny úkoly, které se střetávají, mají prioritu 1000, okno hlásí *Žádné úkoly se nemusí posunout — plán je už bez konfliktů.*, ale přetížení zůstane. Proto se po použití podívejte na hlášení *Přetížení* na pásu karet.

## Viz také

- [Řešení přetížení](docs://howto-overbezetting-oplossen): kroky k nalezení přetížení a k jeho vyrovnání.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): co je časová rezerva a proč se úkol stane kritickým.
- [Pravidla pevné veličiny: doba trvání, jednotky a práce](docs://uitleg-werkregels): jak se doba trvání úkolu mění spolu s jednotkami přiřazení.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): tři věže, které potřebují stejné čety a věžový jeřáb, a co s tím vyrovnání udělá.
