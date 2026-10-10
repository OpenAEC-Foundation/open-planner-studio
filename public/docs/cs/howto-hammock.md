# Vytvoření překlenovacího úkolu

Cíl: vytvořit úkol, který nezná svou vlastní dobu trvání, ale běží od zahájení jednoho úkolu do dokončení jiného, například zřízení staveniště, dozor nebo pronájem stavební buňky.

## Kdy to potřebujete

Site cabin stojí na stavbě tak dlouho, jak dlouho stavba trvá, od prvních zemních prací až po předání. Když tomuto úkolu zadáte pevné trvání 13 pracovních dnů, nepřizpůsobí se, když zdivo nabere zpoždění, a plán přestane být správný. **Překlenovací úkol** (také zvaný *level of effort*) následuje práci, na kterou ho zavěsíte: jeho zahájení vychází ze závislosti na zahájení, jeho dokončení ze závislosti na dokončení a jeho doba trvání je rozdíl mezi nimi.

## Postup

1. Vytvořte úkol, například *Site cabin*, nebo vyberte existující úkol. Milník a souhrnný úkol (fáze) nemohou být překlenovací úkol. V panelu *Vlastnosti* a v okně *Upravit úkol* u takového úkolu chybí zaškrtávací políčko a ve sloupci tabulky ho nelze změnit.
2. Zaškrtněte *Překlenovací úkol (odvozená doba trvání)* v panelu *Vlastnosti*, v okně *Upravit úkol* (klepněte pravým tlačítkem na úkol a zvolte *Upravit...*) nebo ve sloupci tabulky *Překlenovací úkol (odvozená doba trvání)* v kategorii *Plánování*. Pole *Doba trvání* potom nelze upravit.
3. Přidejte závislost od úkolu, se kterým překlenovací úkol začíná, k překlenovacímu úkolu, typu **SS** (překlenovací úkol začíná spolu s tímto úkolem) nebo **FS** (překlenovací úkol začíná po tomto úkolu). Vyberte překlenovací úkol, klepněte na *Přidat závislost* v části *Závislosti*, nechte směr na *Předchůdce*, vyberte úkol a vyberte typ. Postup je popsán v [Přidání závislostí](docs://howto-relaties-leggen).
4. Přidejte závislost od úkolu, kterým překlenovací úkol končí, k překlenovacímu úkolu, typu **FF** (překlenovací úkol končí spolu s tímto úkolem) nebo **SF**.
5. Podívejte se do panelu *Vlastnosti* v části *Překlenovací úkol (odvozená doba trvání)*: tam vidíte položku *Hnací vazba zahájení* s úkolem a typem a položku *Hnací vazba dokončení* s úkolem a typem. Hnací vazba je úkol, od kterého překlenovací úkol přebírá zahájení nebo dokončení.
6. Stiskněte **Přepočítat** (F5), například přes *Domů › Plán › Přepočítat*. Překlenovací úkol nyní běží od zahájení úkolu, který určuje zahájení, do dokončení úkolu, který určuje dokončení. *Doba trvání* ukazuje odvozenou dobu trvání.

V diagramu Gantt je překlenovací úkol tenký tyrkysový pruh se háčkem na obou koncích.

Příklad: *Site cabin* dostane SS od *Groundwork* (pondělí 7. června 2027) a FF od *Roofing* (hotovo ve středu 23. června). Po přepočítání (**Přepočítat**) běží překlenovací úkol od pondělí 7. do středy 23. června: 13 pracovních dnů. Když zdivo nabere zpoždění 2 pracovních dnů, dokončení úkolu *Roofing* připadne na pátek 25. června a překlenovací úkol se prodlouží na 15 pracovních dnů.

## Co aplikace s překlenovacím úkolem dělá

- Překlenovací úkol není nikdy kritický a nemá časovou rezervu. Neomezuje ani úkoly, od kterých přebírá zahájení a dokončení: kvůli překlenovacímu úkolu nedostanou žádný pozdní termín.
- Prodleva se počítá. Při SS s prodlevou `1d` začne překlenovací úkol o jeden pracovní den po hnací vazbě zahájení, při FF s prodlevou `2d` skončí o dva pracovní dny po hnací vazbě dokončení.

## Úskalí a co aplikace dělá

**Žádná hnací vazba dokončení.** Když překlenovací úkol nemá závislost FF ani SF, aplikace nedokáže odvodit jeho dokončení. Panel *Vlastnosti* ukazuje *Žádná hnací vazba dokončení (FF/SF) – rozpětí se nastaví na nulovou délku.* a panel *Varování* ukazuje *Překlenovací úkol bez hnací vazby dokončení (žádný předchůdce FF/SF): doba trvání klesne na nulu*. Překlenovací úkol pak začíná a končí ve stejný den. Přidejte závislost FF nebo SF.

**Překlenovací úkol, který končí po posledním úkolu.** Když překlenovací úkol pokračuje až po posledním úkolu, například s FF a prodlevou 2 pracovních dnů, datum dokončení projektu se posune spolu s ním. Úkoly, které skutečně provádíte, pak dostanou časovou rezervu; žádný z nich už není kritický.

**Úkoly čekající na překlenovací úkol.** Když přidáte závislost od překlenovacího úkolu k jinému úkolu, ten úkol začne až po konci překlenovacího úkolu. Celý řetězec před překlenovacím úkolem, včetně úkolů, od kterých překlenovací úkol přebírá zahájení a dokončení, pak dostane časovou rezervu a přestane být kritický, protože překlenovací úkol nevrací žádný tlak zpět. Nechte proto úkoly nečekat na překlenovací úkol; navažte je raději na hnací vazbu dokončení překlenovacího úkolu.

**Zadání doby trvání.** Pole *Doba trvání* překlenovacího úkolu je odvozené a nelze ho upravit. Doba trvání, kterou jste zadali před zaškrtnutím políčka, se už nepočítá.

## Viz také

- [Přidání závislostí](docs://howto-relaties-leggen): postup pro přidání závislosti typu SS nebo FF.
- [Závislosti a prodleva](docs://uitleg-relaties): co znamenají SS a FF a jak se počítá prodleva.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): co znamená kritický a jak funguje časová rezerva.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): obsahuje překlenovací úkol *Structural works tower A (LOE)*.
