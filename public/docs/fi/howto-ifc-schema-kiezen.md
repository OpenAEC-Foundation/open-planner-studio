# IFC-skeeman valinta

Tavoite: tallenna aikataulu sen rakennusmallin IFC-skeemassa, johon se halutaan yhdistää.

## Milloin tätä tarvitaan

Oletuksena sovellus tallentaa projektin muodossa IFC 4.3 ADD2. Tämä on IFC 4.3 -skeeman nimi tiedostoissa, joita IfcOpenShell ja Bonsai luovat. Jos aikataulu halutaan yhdistää rakennusmalliin yhdeksi 4D-tiedostoksi, esimerkiksi IfcOpenShellin (ifcpatch) *MergeProjects*-reseptillä, molempien tiedostojen skeeman on oltava sama. Jos rakennusmalli on IFC4-tiedosto, IfcOpenShell ei yhdistä sitä IFC 4.3 -aikatauluun. Silloin mallin skeema valitaan tässä.

## Vaiheet

1. Avaa *Projektin asetukset*: *Asetukset › Projekti › Projektin asetukset*, tai *Tiedosto › Projektin asetukset*.
2. Kohdassa *IFC-skeema tallennettaessa* valitse rakennusmallin skeema.
3. Valitse *Käytä*. Projekti on nyt *Tallentamaton*.
4. Valitse *Tallenna* (Ctrl+S) tai *Tallenna nimellä*.

Kolme vaihtoehtoa:

- *IFC 4.3 ADD2 (oletus)* kirjoittaa tiedoston otsikkoon `IFC4X3_ADD2`.
- *IFC 4.3* kirjoittaa `IFC4X3`. Näin sovelluksen vanhemmat versiot kirjoittivat IFC 4.3 -muodon.
- *IFC4* kirjoittaa `IFC4`, IFC4-muotoiselle rakennusmallille.

## Sudenkuopat ja sovelluksen toiminta

**Yhdistä viimeisenä vaiheena.** Yhdistettyä 4D-tiedostoa (rakennusmalli ja aikataulu) ei avata sovelluksessa, jotta sitä ei tallennettaisi uudelleen. Sovellus säilyttää vain aikataulun: seinät ja muut rakennusmallin osat katoavat, vaikka skeema säilyisi. Aikataulua muutetaan omassa tiedostossa, ja tiedosto yhdistetään sen jälkeen uudelleen.

**Sovellus kysyy ensin, kun avatulla tiedostolla on toinen skeema.** Jos avataan esimerkiksi IFC4-tiedosto tai IFC 4.3 -tiedosto vanhemmasta sovellusversiosta, tiedoston tyyppiä ei muuteta suoraan. Kun *Tallenna* tai *Tallenna nimellä* valitaan ensimmäisen kerran, sovellus kysyy, säilytetäänkö tiedoston skeema vai siirrytäänkö IFC 4.3 ADD2 -skeemaan. *Säilytä IFC4* (tai *Säilytä IFC 4.3*) on painike, jonka Enter valitsee. Jos kysymys suljetaan Esc-näppäimellä tai rastilla, sovellus ei tallenna mitään.

**Sovellus kysyy vain kerran tiedostoa kohden.** Valinta tallennetaan itse tiedostoon. Kun tiedosto avataan myöhemmin, sovellus ei kysy uudelleen. Jos skeema valitaan itse kohdassa *Projektin asetukset* ja valitaan *Käytä*, sovellus ei kysy silloinkaan.

**Skeema, jota sovellus ei voi kirjoittaa**, kuten IFC2X3, avautuu sovelluksessa. Kun tiedosto tallennetaan ensimmäisen kerran, kysymys kertoo tämän, ja valitaan yksi kolmesta yllä olevasta skeemasta.

**Automaattitallennus ja kaatumisen palautus eivät kysy mitään.** Ne kirjoittavat tiedoston skeeman mukaisesti ja jättävät kysymyksen siihen asti, kun tiedosto tallennetaan itse ensimmäisen kerran. Skeemaa, jota sovellus ei voi kirjoittaa, *Automaattitallennus* ei kirjoita tiedostoon ennen kuin kysymykseen on vastattu.

**Uusi projekti ei kysy mitään.** Uusi projekti ja projekti muusta muodosta, kuten XER, MPP tai CSV, alkaa asetuksella *IFC 4.3 ADD2 (oletus)*.

**Tiedoston sisältö ei muutu.** Kaikki kolme skeemaa tukevat aikatauluun liittyviä tietoja, jotka sovellus kirjoittaa samalla tavalla. Vain tiedoston otsikon `FILE_SCHEMA`-rivi on erilainen. Skeeman vaihtaminen ei siis aiheuta mitään menetystä.

**IFC 4.3 -malli IfcOpenShellista tai Bonsaista** on yleensä otsikossaan `IFC4X3_ADD2`, kuten sovelluksen oletus. IfcOpenShell ei yhdistä siihen aikataulua, jonka skeema on `IFC4X3`. Jos asia on epäselvä, mallitiedoston alussa oleva `FILE_SCHEMA`-rivi kertoo sen.

**Kumoaminen ei muuta skeemaa.** Skeema kuuluu tiedostoon, samoin kuin paikka, johon tiedosto on tallennettu. Valinta kohdassa *Projektin asetukset* ja vastaus kysymykseen tallennettaessa eivät siis ole *Kumoa*-komennon vaiheita. Palataksesi valitaan toinen skeema kohdassa *Projektin asetukset*. Näin *Automaattitallennus* ei koskaan kirjoita toista skeemaa hiljaa muutoksen kumoamisen jälkeen.

## Katso myös

- [Uusi projekti ja Projektin asetukset](docs://ref-projectinfo): kaikki lomakkeen kentät.
- [Tiedostot ja muodot](docs://uitleg-bestanden): miksi IFC on sovelluksen oma muoto.
- [Tiedoston avaaminen ja tallentaminen](docs://howto-bestand-openen-en-opslaan): tallentaminen ja tallentaminen nimellä.
