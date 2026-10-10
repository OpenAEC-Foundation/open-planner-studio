# Rozdělení úkolu

Cíl: přerušit úkol tak, aby práce zastavila a později pokračovala, bez toho, aby z úkolu vznikly dva úkoly.

## Kdy to potřebujete

Položení výztuže trvá osm pracovních dnů. Po čtyřech dnech ale musí jeřáb odjet na jinou zakázku a práce pokračuje o dva dny později. Dva samostatné úkoly znamenají, že musíte závislosti a přiřazení udržovat dvakrát. S **přerušením práce** zůstane jeden úkol s jedním pruhem, který má mezeru. Aplikace tomu také říká *pauza*.

Práce zůstane stejně dlouhá, ale úkol na kalendáři trvá déle. Příklad: úkol o 8 pracovních dnech, který začíná v úterý 29. září 2026, skončí ve čtvrtek 8. října. Když dáte po 4 pracovních dnech přerušení práce o délce 2 pracovních dnů, skončí úkol v pondělí 12. října. Doba trvání zůstane 8 pracovních dnů. Posune se jen dokončení, a to o dva pracovní dny.

## Kroky

### Rozdělení v diagramu Gantt

1. Zvolte na kartě *Domů › Úkoly › Rozdělit úkol* (nebo na kartě *Plán › Závislosti › Rozdělit úkol*). Nad plánem se objeví upozornění *Klikněte na pruh v den, kdy přerušení práce začíná, a táhněte doprava pro jeho délku. Esc režim ukončí*. Tlačítko je také na kartě *Tabulka › Úkoly › Rozdělit úkol*, ale na kartě *Tabulka* je nedostupné.
2. Přesuňte myš nad pruh. Čárkovaná čára a popisek s datem ukážou, kde by přerušení práce začalo. Na pruhu v den, kdy přerušení práce začíná, stiskněte tlačítko myši.
3. Táhněte doprava. Popisek ukáže délku, například *2 pracovní dny přerušení práce*: vzdálenost v pracovních dnech ke dni pod myší. Uvolněte tlačítko myši.

Když jen klepnete, bez tažení, bude pauza jeden pracovní den. Tažení zpět doleva pauzu zkrátí, nejméně na jeden pracovní den. U úkolu v hodinách se vše počítá v hodinách.

Režim zůstane zapnutý, takže můžete rozdělit další úkoly. Ukončíte ho klávesou Esc nebo tlačítkem *Zastavit* v upozornění. Když stisknete Esc během tažení, aplikace pauzu zruší a režim se ukončí. Každé gesto je jeden krok, který lze vrátit příkazem *Vrátit zpět*.

Po rozdělení už plán není aktuální. Stiskněte **Přepočítat** (F5) pro konečná data.

### Tažení existujícího přerušení práce v diagramu Gantt

To funguje bez režimu rozdělení, přímo na pruhu, který má přerušení práce.

- Táhněte část **za** pauzou doprava nebo doleva. Pauza se prodlouží nebo zkrátí, s popiskem *3 pracovní dny přerušení práce*. Když ji táhnete zpět, dokud pauza není 0, popisek ukáže *Sloučit* a obě části se zase spojí v jednu.
- Táhněte pravou hranu části **před** pauzou. Tato část se prodlouží nebo zkrátí, s popiskem *Část: 5 pracovních dnů*. Doba trvání úkolu se tím změní.
- Když táhnete první část, posunete celý úkol, stejně jako u každého pruhu.

### Rozdělení a úprava v panelu vlastností

Vyberte úkol. V panelu *Vlastnosti* je blok *Přerušení práce* za blokem *Závislosti* a před blokem *Přiřazení*. Když je to nutné, posuňte se k němu.

- *Přidat přerušení práce* vloží pauzu v délce jednoho pracovního dne doprostřed nejdelší části.
- Každá pauza má dvě pole: *po* (kolik pracovních dnů práce je před pauzou) a *pauza* (délka pauzy). Vedle nich jsou data části za pauzou. U hodinového úkolu ukazují hodiny.
- Když nastavíte pole *pauza* na 0, přerušení práce zmizí. Malé tlačítko s popelnicí (*Odstranit přerušení práce*) dělá totéž.

Dávejte pozor na pole *po*. Prodlouží nebo zkrátí část práce před pauzou a s ní i dobu trvání celého úkolu. Pole *pauza* mění jen dokončení.

### Odstranění přerušení práce

Klikněte pravým tlačítkem na přerušení práce v diagramu Gantt, nebo na část za ním, a zvolte *Odstranit přerušení práce*. *Odstranit všechna přerušení práce* je v kontextové nabídce každého pruhu, který má přerušení práce. Nebo použijte blok *Přerušení práce* v panelu *Vlastnosti*, jak je uvedeno výše.

### S AI asistentem

Připojený AI asistent nastavuje přerušení práce nástrojem `planner_set_task_splits`, ve stejné podobě jako panel: po kolika pracovních dnech (nebo pracovních hodinách) práce a jak dlouhá pauza v pracovních dnech (nebo pracovních hodinách). Vždy předá celý seznam. Prázdný seznam odstraní všechna přerušení práce. Asistent je čte zpět pomocí `planner_get_task`. Platí stejná pravidla jako níže: úkol, který nelze rozdělit, nemůže rozdělit ani asistent. Na rozdíl od rozdělení, které uděláte sami, aplikace plán po změně přepočítá sama. Jak připojit asistenta, je popsáno v článku [Připojení AI asistenta (MCP)](docs://howto-ai-assistent-koppelen).

## Úskalí a co aplikace dělá

**Ne každý úkol lze rozdělit.** Rozdělit nelze milník, souhrnný úkol, úkol s volbou *Překlenovací úkol (odvozená doba trvání)* zapnutou (viz [Vytvoření překlenovacího úkolu](docs://howto-hammock)), úkol s typem doby trvání *Uplynulá doba trvání*, úkol, který je *Ručně plánováno*, nebo úkol kratší než dva pracovní dny. V režimu rozdělení ukáže myš zakázaný kurzor a nic se nestane. U takového úkolu v panelu *Vlastnosti* také chybí blok *Přerušení práce*.

**Na kartě *Tabulka* tlačítko nefunguje.** Tlačítko *Rozdělit úkol* je tam nedostupné, s bublinovou nápovědou *Dostupné jen tehdy, když je diagram Gantt vidět*. Gesto potřebuje pruh. Režim rozdělení a režim propojení se navzájem vypínají.

**Klepnutí bez účinku.** Přerušení práce nemůže začít prvním dnem úkolu ani uvnitř existující pauzy. Každá část práce musí mít také délku nejméně jeden pracovní den. Když klepnete na takové místo, nic se nestane a aplikace nic nehlásí.

**Úkol s průběhem.** Když má úkol průběh, může přerušení práce začít nejdříve po práci, která je už hotová. Při 50 % z 8 pracovních dnů je to nejdříve pátý pracovní den. Klepnutí v hotové části nic neudělá. Úkol, který je hotový na 100 %, už nelze rozdělit. V panelu je pak tlačítko *Přidat přerušení práce* nedostupné. Totéž platí, když střed nejdelší části spadá do hotové práce, například při 75 % z 8 pracovních dnů.

**Vyrovnání také vytváří přerušení práce.** Zobrazí se v bloku *Přerušení práce* s popiskem *vyrovnání*. Odstraní je příkaz na kartě *Zdroje › Vyrovnání › Zrušit vyrovnání*. Když sami upravíte přerušení práce takového úkolu, všechny jeho pauzy vyrovnání se stanou vaše a *Zrušit vyrovnání* je už neodstraní.

**Přerušení práce se do MS Project ani Primavera P6 nepřenášejí.** Když exportujete do *MS Project XML* nebo *Primavera P6 XML*, tento program zná přerušení jen jako rozložení práce v rámci přiřazení. Bez takového rozložení se úkol přenese bez přerušení práce a aplikace ohlásí, o kolik úkolů jde: *1 úkol s přerušeními práce byl exportován bez přerušení práce: MS Project a P6 znají přerušení pouze jako rozložení práce*. V souboru IFC se přerušení práce zachovají.

**Soubor s přerušeními práce, které aplikace nedokáže upravit.** Přerušení práce ze zdrojového souboru, která neodpovídají podobě aplikace, zobrazí v panelu hlášení *Tato přerušení práce pocházejí ze zdrojového souboru v podobě, kterou zde nelze upravit*. Panel pak nabízí jen *Odstranit všechna přerušení práce*.

## Viz také

- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): jak plán počítá v pracovních dnech a proč se dokončení posune.
- [Přidání závislostí](docs://howto-relaties-leggen): jiný režim v diagramu Gantt, ve kterém pracujete tažením pruhu.
- [Dialog úkolu a panel vlastností](docs://ref-taak-eigenschappen): oddíl Přerušení práce v panelu vlastností.
