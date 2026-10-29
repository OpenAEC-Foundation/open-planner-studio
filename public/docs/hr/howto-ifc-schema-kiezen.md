# Odabir IFC sheme

Cilj: spremite raspored u IFC shemi modela zgrade s kojim ga želite spojiti.

## Kada vam ovo treba

Aplikacija sprema projekt zadano kao IFC 4.3 ADD2. To je naziv za IFC 4.3 u datotekama koje stvaraju IfcOpenShell i Bonsai. Ako želite raspored spojiti s modelom zgrade u jednu 4D datoteku, na primjer s receptom *MergeProjects* iz alata IfcOpenShell (ifcpatch), obje datoteke moraju imati istu shemu. Ako je model zgrade datoteka IFC4, IfcOpenShell odbija spajanje s rasporedom IFC 4.3. Tada ovdje odaberite shemu modela.

## Koraci

1. Otvorite *Postavke projekta*: *Postavke › Projekt › Postavke projekta*, ili *Datoteka › Postavke projekta*.
2. Pod *IFC shema pri spremanju* odaberite shemu vašeg modela zgrade.
3. Kliknite *Primijeni*. Projekt je sada *Nije spremljeno*.
4. Spremite s *Spremi* (Ctrl+S) ili *Spremi kao*.

Tri mogućnosti:

- *IFC 4.3 ADD2 (zadano)* zapisuje `IFC4X3_ADD2` u zaglavlje datoteke.
- *IFC 4.3* zapisuje `IFC4X3`. Tako su starije verzije aplikacije zapisivale IFC 4.3.
- *IFC4* zapisuje `IFC4`, za model zgrade u IFC4.

## Zamke i što aplikacija radi

**Spajanje kao zadnji korak.** Ne otvarajte spojenu 4D datoteku (model zgrade i raspored) u aplikaciji da je ponovno spremite. Aplikacija zadržava samo raspored: zidovi i ostali dijelovi modela zgrade se gube, čak i ako zadržite shemu. Promijenite raspored u svojoj datoteci i zatim ga ponovno spojite.

**Aplikacija prvo pita kada otvorena datoteka ima drugu shemu.** Ako otvorite, na primjer, datoteku IFC4 ili datoteku IFC 4.3 iz starije verzije aplikacije, aplikacija ne mijenja vrstu datoteke jednostavno. Prvi put kad upotrijebite *Spremi* ili *Spremi kao*, najprije pita želite li zadržati shemu datoteke ili preći na IFC 4.3 ADD2. *Zadrži IFC4* (ili *Zadrži IFC 4.3*) je gumb koji se aktivira tipkom Enter. Ako pitanje zatvorite tipkom Esc ili gumbom za zatvaranje, aplikacija ništa ne sprema.

**Pita samo jednom po datoteci.** Vaš izbor se sprema u samoj datoteci. Kad je kasnije ponovno otvorite, aplikacija više ne pita. Ako sami odaberete shemu u *Postavke projekta* i kliknete *Primijeni*, aplikacija ni tada ne pita.

**Shema koju aplikacija ne može zapisati**, kao IFC2X3, otvara se u aplikaciji. Prvi put kad spremite, pitanje to kaže i vi odaberete jednu od tri sheme iznad.

**Automatsko spremanje i oporavak od pada ne pitaju ništa.** Oni zapisuju shemu datoteke i ostavljaju pitanje za prvi put kad sami spremite. Za shemu koju aplikacija ne može zapisati, *Automatsko spremanje* ne piše u datoteku dok ne odgovorite na pitanje.

**Novi projekt ne pita ništa.** Novi projekt i projekt iz drugog formata, kao XER, MPP ili CSV, počinje s *IFC 4.3 ADD2 (zadano)*.

**Sadržaj datoteke se ne mijenja.** Sve tri sheme poznaju podatke o rasporedu koje aplikacija na isti način zapisuje. Mijenja se samo redak `FILE_SCHEMA` u zaglavlju. Zato ništa ne gubite kad odaberete drugu shemu.

**Model IFC 4.3 iz IfcOpenShell ili Bonsai** obično ima `IFC4X3_ADD2` u zaglavlju, kao zadano u aplikaciji. IfcOpenShell ne spaja raspored s `IFC4X3` u taj model. Ako niste sigurni, pogledajte redak `FILE_SCHEMA` na vrhu datoteke modela.

**Poništavanje ne mijenja shemu.** Shema pripada datoteci, kao i mjesto na kojem je pohranjena. Izbor u *Postavke projekta* i odgovor na pitanje pri spremanju zato nisu korak u *Poništi*. Da se vratite, odaberite drugu shemu u *Postavke projekta*. Tako *Automatsko spremanje* nikad tiho ne zapiše drugu shemu nakon što poništite izmjenu.

## Vidi također

- [Novi projekt i Postavke projekta](docs://ref-projectinfo): sva polja obrasca.
- [Datoteke i formati](docs://uitleg-bestanden): zašto je IFC vlastiti format aplikacije.
- [Otvaranje i spremanje datoteke](docs://howto-bestand-openen-en-opslaan): spremanje i naredba *Spremi kao*.
