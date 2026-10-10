# Nastavenie pracovného času

Cieľ: pre každý deň v týždni zaznamenajte, v akých časoch kalendár pracuje. Úlohy v hodinách potom bežia v správnych časoch.

## Kedy to potrebujete

Piatok popoludní je voľný. Posádka pracuje od 06:00 do 22:00 v dvoch pracovných zmenách. Je tu nočná posádka. Prestávka je kratšia ako hodina. Pokiaľ plánujete len v dňoch, na nastavenie stačia *Začiatok (hodina)*, *Dokončenie (hodina)* a prestávka ([Vytvorenie a priradenie kalendára](docs://howto-kalender-maken-en-toewijzen)). Ak plánujete úlohy v hodinách, aplikácia počíta pracovné minúty v rámci **blokov pracovného času** kalendára. V aplikácii sa tieto bloky nazývajú *blok*: blok je súvislý úsek pracovného času v jeden deň v týždni a medzera medzi dvoma blokmi je prestávka. Čo to znamená pre váš plán, je opísané v [Dni a hodiny](docs://uitleg-dagen-en-uren).

Na to potrebujete *Zapnúť plánovanie v hodinách* ([Zapnutie plánovania v hodinách](docs://howto-urenplanning-aanzetten)). Bez plánovania v hodinách nevidíte blok *Pracovná doba*.

## Kroky

### Výber predvoľby pracovnej zmeny

1. Vyberte *Plán › Kalendár › Kalendár* a na ľavej strane vyberte kalendár.
2. V bloku *Pracovná doba* kliknite na predvoľbu. Predvoľba nahradí pracovné dni a pracovné časy kalendára.
3. Kliknite na *Použiť*.

Každá predvoľba urobí toto:

- *Denná pracovná zmena*: pondelok až piatok od 08:00 do 16:00 bez prestávky. Kalendár sa tým vráti na bežný kalendár bez blokov pracovného času.
- *2 pracovné zmeny*: pondelok až piatok od 06:00 do 14:00 a od 14:00 do 22:00, spolu 16 hodín.
- *3 pracovné zmeny*: pondelok až piatok tri zmeny: od 06:00 do 14:00, od 14:00 do 22:00 a od 22:00 do 06:00 nasledujúceho dňa, spolu 24 hodín.
- *Nočná pracovná zmena*: pondelok až piatok od 22:00 do 06:00 nasledujúceho dňa, 8 hodín.
- *24/7*: všetkých sedem dní od 00:00 do 24:00.

### Nastavenie pracovného času podľa dní

1. V bloku *Pracovná doba* kliknite na *Nastaviť podľa dní…*. Pod tlačidlami sa objaví riadok pre každý deň s jeho pracovným časom. Kalendár teraz má bloky pracovného času pre jednotlivé dni. Ak ich kalendár už má, je tento prehľad hneď otvorený. Tlačidlo sa potom volá *Skryť pracovnú dobu* a prehľad zloží.
2. Upravte čas začiatku a konca každého bloku v dvoch poliach času.
3. Ak chcete zaradiť prestávku, kliknite pri danom dni na **+** (*Pridať blok*) a upravte časy blokov tak, aby medzi nimi bola medzera. Nový blok začína o 08:00 a končí o 16:00.
4. Blok, ktorý prechádza cez polnoc, zaškrtnite možnosťou *nasledujúci deň*. Blok sa započíta do dňa, v ktorom začína.
5. Kliknite na kôš za blokom a blok odstráňte. Deň bez blokov sa zobrazí ako *Nepracovný deň*.
6. Pri dni od pondelka do piatka kliknite na symbol kopírovania (*Kopírovať na pracovné dni*). Bloky tohto dňa sa tým skopírujú na pondelok až piatok.
7. Dole je *Odvodené hodiny/deň:* s čistými hodinami na deň, ktoré aplikácia z toho odvodí. Kliknite na *Použiť*.

**Príklad: voľné popoludnie v piatok.** Kliknite na *Nastaviť podľa dní…*. Pri *Pi* odstráňte druhý blok (13:00 až 16:00). Piatok má teraz 5 hodín, ostatné dni 8. Odvodené hodiny na deň zostanú 8.

### Uloženie vlastnej predvoľby

1. Kliknite na *Uložiť ako predvoľbu…* a do poľa *Názov vlastnej predvoľby* napíšte názov.
2. Kliknite na *Uložiť*. Predvoľba je teraz medzi ostatnými a môžete ju použiť v ľubovoľnom projekte. Krížikom vedľa nej ju opäť odstránite.

Vlastná predvoľba sa ukladá na tomto zariadení, nie v súbore projektu.

## Úskalia a čo aplikácia vtedy urobí

**Predvoľba nahradí všetko.** Ak zvolíte predvoľbu, pracovné dni a pracovné časy, ktoré ste nastavili predtým, zmiznú. Sviatky zostanú.

**Tlačidlá dní a bloky sú dve rôzne veci.** Tlačidlá pod *Pracovné dni* bloky nemenia. Deň získa pracovný čas, keď pre ten deň kliknete na *Pridať blok*. Ak deň zapnete len tlačidlom, počíta sa pre úlohy v dňoch, ale nie pre úlohy v hodinách. Pri kalendári s pracovnými časmi použite riadky podľa dní.

**Úprava pracovného času pri vypnutom plánovaní v hodinách.** Ak plánovanie v hodinách znovu vypnete, vrátia sa polia *Začiatok (hodina)*, *Dokončenie (hodina)* a prestávka. Pri kalendári s blokmi pracovného času na bloky nemajú vplyv. Pracovný čas preto vždy upravujte, keď je plánovanie v hodinách zapnuté.

**Žiadny použiteľný pracovný čas.** Kalendár bez blokov alebo bez pracovných dní nemôže niesť úlohu v hodinách. Aplikácia vtedy zobrazí *Tento kalendár nemá platné pracovné časy. Skontrolujte pracovné dni a pracovné časy*.

## Pozri aj

- [Dni a hodiny](docs://uitleg-dagen-en-uren): ako aplikácia počíta pracovnú dobu a odvodzuje čisté hodiny na deň.
- [Zapnutie plánovania v hodinách](docs://howto-urenplanning-aanzetten): plánovanie úlohy v hodinách.
- [Kalendáre a pracovné dni](docs://uitleg-kalenders): ktorý kalendár platí pre ktorú úlohu.
- [Okná kalendára](docs://ref-kalenders): všetky polia okien kalendára.
