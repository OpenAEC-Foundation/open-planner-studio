# Raporttityypit

Jokainen raportti on *Raportti*-välilehdellä, ja sen valinnat: mitä ne tekevät, alkuarvo, mikä muuttuu raportissa ja mistä ne löytyvät. Raportin tekeminen ja tallentaminen PDF-tiedostona on kohdassa [Raportin tekeminen ja tulostaminen](docs://howto-rapport-maken-en-afdrukken).

## Raporttiikkunan toiminta

Avaa *Raportti*-välilehti (tai paina Ctrl+P). Vasemmalla on *Raportti*-sarake. Siinä ovat pudotusvalikko *Raporttityyppi*, osio *Yhteenveto* laskureineen, osio *Asetukset* tai *Raporttivalinnat* ja alareunassa painike *Vie PDF*. Oikealla on esikatselu. Se, mitä esikatselussa näkyy, menee PDF:ään.

**Raporttityyppi** — mikä raportti näkyy. Valittavana on yksitoista raporttia. Oletus: *Gantt-tulostus*. Sijainti: *Raportti*-sarakkeen yläosassa.

**Vie PDF** — luo PDF-tiedoston. Vaikutus: tulos on vain PDF-tiedosto. Sovellus ei lähetä mitään tulostimelle. Jos aikataulu ei ole ajan tasalla, sovellus laskee sen ensin. Jos laskenta antaa virheen, esimerkiksi riippuvuuksien silmukan takia, painike ei luo tiedostoa, vaan näyttää virheen. Sijainti: *Raportti*-sarakkeen alareunassa.

**Muistetaan.** Sovellus muistaa kaikki raporttivalinnat tällä laitteella, kaikille projekteille. Ne eivät kuulu projektitiedostoon. Vain Gantt-tulostuksen kenttää *Yritys:* ei muisteta.

**Nykyinen aikataulu.** Raportit käyttävät viimeisintä laskentaa. Jos aikataulua on muutettu sen jälkeen, taulukkoraporttien yläosassa näkyy *Aikataulua on muutettu viimeisen laskennan jälkeen — paina Laske (F5) ajantasaisten arvojen saamiseksi*. Jos mitään ei ole koskaan laskettu, näkyy *Ei vielä laskettu — paina Laske (F5) päivämääriä ja pelivaraa varten*. Jos projekti on näkymässä *Päivämäärät sellaisina kuin ne on tallennettu*, raportit näyttävät päivämäärät lähdetiedostosta, ja rivi kertoo siitä.

**Lyhenteet.** *tp* tarkoittaa työpäiviä. *TF* on kokonaispelivara, *FF* on vapaa pelivara.

## Paperi ja suunta

**Paperi:** — PDF:n paperikoko. Valittavana ovat A4, A3, A2 ja A1. Oletus: A3. Vaikutus: sivut asetellaan tälle koolle. Kaikille raporteille on yksi valinta: se, joka valitaan yhdelle raportille, pätee myös muihin. Pystysuuntaisella A4:llä leveä taulukko pienenee, koska taulukko skaalataan sivun leveyteen. Sijainti: *Asetukset* (Gantt-tulostus ja Resurssikaavio) tai *Raporttivalinnat* (seitsemän taulukkoraporttia). Välitavoitteiden yleiskatsauksessa ja Erossa ei ole valintoja.

**Suunta:** — vaaka tai pysty. Valittavana ovat *Vaaka* ja *Pysty*. Oletus: *Vaaka*. Vaikutus: kuten *Paperi:*. Sijainti: sama paikka kuin *Paperi:*.

## Gantt-tulostus

Aikataulu palkkikaaviona, taulukko vasemmalla ja aikajana oikealla. Tarvittaessa kaavio jakautuu useammalle sivulle. Esikatselussa näkyvät paperi, sivun ylätunniste, taulukko, aikajana ja selite. Osio *Yhteenveto* laskee *Tehtävät:*, *Lehtitehtävät:*, *Kriittinen:* ja *Riippuvuudet:*. Kaikki valinnat ovat kohdassa *Asetukset*.

**Yritys:** — yritys sivun ylätunnisteessa. Oletus: yritys projektin asetuksista. Vaikutus: vain raportin ylätunniste. Sitä, mitä tähän kirjoitetaan, ei tallenneta. Muuta yritys kohdassa *Asetukset › Projekti › Projektin asetukset*, kentässä *Tilaaja/organisaatio*, ja vahvista painikkeella *Käytä*.

**Tekijä:** — tekijä sivun ylätunnisteessa. Vain luku: sovellus ottaa sen projektin asetuksista.

**Fonttikoko:** — tekstin ja taulukon koko raportissa. Valittavana ovat 90%, 100%, 110% ja 125%. Oletus: 100%. Vaikutus: suuremmalla fontilla teksti, rivit ja taulukko kasvavat, ja aikajanan leveys pienenee. Ei riipu *Tekstikoko*-asetuksesta.

**Palkkien värit:** — mistä palkin väri riippuu. Valittavana ovat *Kriittinen polku*, *Tehtäväkohtainen — automaattinen* ja *Luokittain*. Pudotusvalikko *Luokkakenttä* näkyy valinnalla *Luokittain*. Oletus: *Kriittinen polku*. Vaikutus: sama valinta kuin *Näkymä*-välilehden kohdassa *Palkkien värit*. Jos sitä muutetaan tässä, myös ruudulla oleva Gantt-näkymä muuttuu. Jos valittua kenttää ei ole tässä projektissa, näkyy *Tätä kenttää ei ole tässä projektissa. Työlajia käytetään väliaikaisesti*.

**Tilarivi:** — viiva raportointipäivällä. Valittavana ovat *Ei mitään*, *Raportointipäivän viiva* ja *Edistymisviiva*. Oletus: *Ei mitään*. Vaikutus: *Raportointipäivän viiva* piirtää viivan raportointipäivälle. *Edistymisviiva* piirtää siksak-viivan, joka näyttää kunkin tehtävän edistymisen. Jos projektissa ei ole raportointipäivää, näkyy *Aseta ensin raportointipäivä*, eikä raportti piirrä mitään.

**Seuraa näkymää (suodatin, ryhmittely, järjestys)** — vain Gantt-tulostuksessa. Oletus: pois. Vaikutus: pois: tulostuu koko tehtäväpuu. Päällä: tulostuvat täsmälleen ruudun rivit, suodattimen, ryhmittelyn, järjestyksen ja supistettujen vaiheiden mukaan.

**Automaattinen sovitus** — skaalaa aikajanan sivun leveyteen. Oletus: päällä. Vaikutus: päällä aikajana skaalataan sivun leveyteen. Sivujen määrä riippuu korkeudesta. Pois: käytetään kiinteää mittakaavaa (*Zoomaus:*), ja aikajana jakautuu myös leveyssuunnassa useammalle sivulle, mikä antaa nopeasti monta sivua.

**Zoomaus:** — kiinteä mittakaava aikajanalle. Näkyy vain, kun *Automaattinen sovitus* on pois. Liukusäätimen alue: 1–40. Oletus: 22. Vaikutus: suurempi arvo tekee aikajanasta leveämmän, joten leveyssuunnassa tulee enemmän sivuja.

**Aikajana yli:** — jakaa aikajanan useammalle sivunleveydelle. Valinta: 1–8 sivua. Oletus: 1 sivu. Vaikutus: vain kun *Automaattinen sovitus* on päällä. Muuten valinta on pois käytöstä ja näkyy *Vain automaattisella sovituksella*. Hyödyllinen pitkälle aikataululle, joka tulostetaan luettavassa koossa.

**Toista ylätunniste joka sivulla** — Oletus: päällä. Vaikutus: päällä sijoittaa sivun ylätunnisteen joka sivulle. Pois: vain ensimmäiselle sivulle.

**Toista alatunniste joka sivulla** — Oletus: päällä. Vaikutus: päällä sijoittaa alatunnisteen (projektin nimi, tulostuspäivä ja selite) joka sivulle. Pois: vain viimeiselle sivulle. Jakomateriaali ilman selitettä on lukukelvoton, siksi oletus on päällä.

**Tehtävien nimet palkeilla** — Oletus: päällä. Vaikutus: tehtävän nimi palkin päällä, missä on tilaa.

**Näytä valmiusaste** — Oletus: päällä. Vaikutus: valmis osa palkista muuttuu harmaaksi kuten Gantt-näkymässä, ja taulukkoon tulee sarake *Valm*. Valmiilla tehtävällä ei ole pelivaran nauhaa.

**Katkaise tehtävien nimet** — Oletus: päällä. Vaikutus: päällä nimet katkaistaan taulukossa sarakkeen *Nimisarake:* leveyden mukaan. Pois: sarake kasvaa pisimmän nimen mukaan, ja silloin näkyy *Nimisarake mukautuu pisimpään tehtävän nimeen*.

**Nimisarake:** — nimisarakkeen leveys. Näkyy vain, kun *Katkaise tehtävien nimet* on päällä. Liukusäädin 60–400. Oletus: 130.

**Näytä perustason kerros** — aktiivinen perustaso palkkien vieressä. Oletus: pois. Vaikutus: ohut palkki perustason värillä tehtäväpalkin alapuolella, vain tehtäville, jotka kuuluvat perustasoon.

**Kriittinen polku** — Oletus: päällä. Vaikutus: ohjaa vain punaisia riippuvuusviivoja kahden kriittisen tehtävän välillä ja selitteen riviä. Palkit itse noudattavat kohtaa *Palkkien värit:*, tästä valintaruudusta riippumatta.

**Näytä pelivara** — Oletus: päällä. Vaikutus: pelivara nauhana ei-kriittisten palkkien takana.

**Riippuvuudet** — riippuvuusviivat. Oletus: päällä. Vaikutus: piirtää nuolet palkkien välille.

**Näytä vain työpäivät** — tiivistää aikajanan akselin tässä raportissa. Oletus: pois. Vaikutus: viikonloput ja vapaapäivät jätetään pois, ja viikkonauhat korvaavat viikonloppuvarjostuksen. Ei riipu ruudulla olevan Gantt-näkymän samasta asetuksesta.

**Viikonloput** — Oletus: päällä. Vaikutus: varjostaa viikonloput ja vapaapäivät aikajanalla, niin kauan kuin mittakaava erottaa päivät toisistaan. Tiivistetyllä akselilla (*Näytä vain työpäivät*) tällä valintaruudulla ei ole vaikutusta.

**Selite** — Oletus: päällä. Vaikutus: selite alatunnisteessa.

**Esikatselun laatu** — kuinka terävä esikatselu on. Valittavana ovat *Normaali*, *Korkea* ja *Suurin*. Oletus: *Korkea*. Vaikutus: vain esikatselun terävyys ruudulla. PDF ei muutu. Sijainti: *Raportti*, esikatselun yläpuolella.

## Resurssikaavio

Samat palkit kuin Gantt-tulostuksessa, ryhmiteltynä resurssin mukaan: kuka tekee mitä ja milloin. Osio *Yhteenveto* laskee *Resurssit:*, *Resurssikohdistukset:* ja *Ilman resurssia:* (jaksolla myös *Aikajakson ulkopuolella:*). Kaaviossa ovat kaikki Gantt-tulostuksen valinnat, paitsi *Seuraa näkymää (suodatin, ryhmittely, järjestys)*, *Kriittinen polku* ja *Riippuvuudet*: rivit eivät tule ruudulta, tehtävä voi näkyä useamman resurssin alla, eikä riippuvuuksia piirretä. Valintaruutu *Kriittinen polku* on piilotettu ja päällä. Nämä tulevat Gantt-tulostuksen valintojen mukana kohdassa *Asetukset*, ja niihin kuuluvat nämä neljä valintaruutua ja aikajakso:

**Jokainen resurssi omalle sivulle** — Oletus: pois. Vaikutus: jokainen resurssi alkaa uudelta sivulta, jolloin arkki voidaan jakaa jokaiselle työryhmälle tai henkilölle. Pois: yksi yhtenäinen asiakirja.

**Sisällytä tehtävät ilman resurssia** — Oletus: pois. Vaikutus: tehtävät ilman resurssia tulevat kaavion viimeiseksi nauhaksi, jotta nähdään, mitä kukaan ei vielä hoida.

**Ryhmittele resurssityypin mukaan** — Oletus: pois. Vaikutus: ylimpänä on kerros: ensin nauha kutakin resurssityyppiä kohti (työvoima, työryhmä, aliurakoitsija, kalusto, materiaali), ja sen sisällä kukin resurssi.

**Näytä kuormitusaste/pv ja jakautumiskäyrä** — Oletus: päällä. Vaikutus: kaksi saraketta tehtävän nimen jälkeen, joissa ovat kuormitusaste päivää kohti ja kyseisen nauhan resurssin jakautumiskäyrä. Jos aikajanalle on liian vähän tilaa, raportti jättää sarakkeet pois ja näyttää *Sarakkeet Kuormitusaste/pv ja Käyrä jätettiin pois: …*. Lisää tilaa saadaan suuremmalla paperikoolla tai vaakasuunnalla, pienemmällä fonttikoolla tai kapeammalla taulukolla.

**Aikajakso:** — vain tehtävät, jotka osuvat jaksoon. Oletus: *Koko projekti*. Vaikutus: aikaakseli kulkee tarkalleen jakson yli. Jos jaksossa ei ole mitään, näkyy *Ei tehtäviä aikajaksolla — valitse toinen aikajakso tai Koko projekti*. Katso alla: *Aikajakso*.

## Välitavoitteiden yleiskatsaus

Kaikki projektin välitavoitteet taulukossa. Sillä ei ole omia valintoja. Osio *Yhteenveto* laskee *Välitavoitteet*, *Pakolliset* ja *Myöhässä*. Sarakkeet ovat *WBS*, *Nimi*, *Laji* (*Automaattinen*, *Alku* tai *Loppu*), *Päivämäärä*, *Rajoite/tavoitepäivä*, *Pelivara*, *Pakollinen* ja *Tila*. Tila on *Myöhässä*, jos rajoite on rikottu, tavoitepäivä on ohitettu tai kokonaispelivara on negatiivinen. Muuten tila on *Kriittinen*, jos välitavoite on kriittinen projektin kriittisen määritelmän mukaan. Muuten tila on *Aikataulussa*. Ilman välitavoitteita näkyy *Tässä projektissa ei ole välitavoitteita.* PDF:ssä käytetään paperia ja suuntaa, joka on viimeksi valittu toiselle raportille.

## Ero

Nykyinen aikataulu aktiivisen perustason vieressä, lehtitehtäville. Sillä ei ole omia valintoja. Osio *Yhteenveto* laskee *Tehtävät*, *Myöhässä* ja *Etuajassa* ja näyttää *Projektin päättymispäivä: +3 työpäivää* (työpäivien ero perustason lopun ja nykyisen lopun välillä). Sarakkeet ovat *WBS*, *Nimi*, *Perustason alku*, *Perustason loppu*, *Nykyinen alku*, *Nykyinen valmistumispäivä*, *Δ alku (tp)*, *Δ loppu (tp)* ja *Tila*. Tila seuraa loppua: *Myöhässä*, jos loppu on myöhemmin kuin perustasossa, *Etuajassa*, jos se on aiemmin, muuten *Aikataulussa*. *Uusi* on tehtävä, jota ei ole perustasossa. *Poistunut* on tehtävä, joka on perustasossa mutta ei enää aikataulussa. Ilman aktiivista perustasoa näkyy *Ei aktiivista perustasoa — tallenna perustaso tai aseta yksi aktiiviseksi.* PDF:ssä käytetään paperia ja suuntaa, joka on viimeksi valittu toiselle raportille.

## Ennakkonäkymä

Mitä jaksolla on käynnissä tai alkaa: lista viikkokokoukseen. Valinnat kohdassa *Raporttivalinnat*.

**Aikajakso:** — raportin aikaikkuna. Oletus: *Seuraava kuukausi*. Vaikutus: raportti sisältää keskeneräiset tehtävät, jotka koskettavat jaksoa, vaikka ne kattaisivat koko jakson, sekä myöhässä olevat tehtävät ennen vertailupäivää, kunhan jakson loppu ei ole ennen vertailupäivää.

**Lähes kriittinen ≤ (tp):** — kynnysarvo *Lähes kriittinen* -tehtäville. Luku 0–60. Oletus: 5. Vaikutus: tehtävä, jonka kokonaispelivara on yli 0 ja enintään niin monta työpäivää, lasketaan lähes kriittiseksi. Arvolla 0 lasketaan vain se, minkä projektin laskentavaihtoehto *Merkitse lähes kriittiset* merkitsee.

Osio *Yhteenveto* laskee *Tehtävät*, *Myöhässä*, *Käynnissä*, *Olisi pitänyt alkaa*, *Alkaa*, *Kriittinen* ja *Lähes kriittinen*. Rivin tila on aina suhteessa vertailupäivään: *Myöhässä* (ei suoritettu, ja loppu on ennen vertailupäivää), *Olisi pitänyt alkaa* (ei aloitettu, vaikka alku oli ennen vertailupäivää), *Käynnissä*, *Alkaa* (ei vielä aloitettu, alkaa aikaikkunassa). Sarakkeet ovat *WBS*, *Nimi*, *Alku*, *Loppu*, *Jäljellä (tp)*, *Valm*, *TF (tp)*, *Kriittinen*, *Resurssit* ja *Tila*.

## Kriittinen ja lähes kriittinen

Tehtävät, jotka määrittävät projektin lopun, ja ne, jotka ovat sen lähellä. Valinta kohdassa *Raporttivalinnat*.

**Lähes kriittinen ≤ (tp):** — Oletus: 5. Luku 0–60. Vaikutus ja merkitys kuten Ennakkonäkymässä. Alaotsikko kertoo valitun kynnysarvon.

Raportti sisältää keskeneräiset tehtävät, jotka ovat kriittisiä (ratkaisijan ja projektin kriittisen määritelmän mukaan) tai lähes kriittisiä. Ne on lajiteltu pelivarapolun, sitten kokonaispelivaran ja sitten alun mukaan. Osio *Yhteenveto* laskee *Kriittinen*, *Lähes kriittinen*, *Kriittiset ketjut* ja *Lehtitehtävät*. Sarakkeet ovat *WBS*, *Nimi*, *Alku*, *Loppu*, *Jäljellä (tp)*, *TF (tp)*, *FF (tp)*, *Polku* ja *Tila*. Sarake *Polku* näyttää pelivarapolun, jos laskentavaihtoehto *Useita pelivarapolkuja* on päällä. Muuten näkyy viiva.

## Edistymisraportti

Projektin tila raportointipäivänä. Valinnat kohdassa *Raporttivalinnat*.

**Aikajakso:** — Oletus: *Edellinen kuukausi*. Vaikutus: *Valmistunut edellisellä aikajaksolla* lasketaan jakson sisällä. *Alkaa seuraavalla aikajaksolla* katsoo eteenpäin raportointipäivästä, enintään kohtaan *Ennakkonäkymä asti*. Kun jakso on *Edellinen kuukausi*, ennakoidaan yhtä pitkälle kuin jakso ulottuu taaksepäin.

**Lähes kriittinen ≤ (tp):** — Oletus: 5. Kuten Ennakkonäkymässä.

Osio *Yhteenveto* näyttää *Raportointipäivä*, *Aikajakso*, *Ennakkonäkymä asti*, *Perustason loppu*, *Ennustettu valmistumispäivä*, *Δ loppu (tp)*, *Suunniteltu* (jossa *(perustaso)* tai *(nykyinen aikataulu)*), *Todellinen* sekä laskurit *Suoritettu*, *Käynnissä*, *Ei aloitettu*, *Myöhässä* ja *Kriittinen*. Suunniteltu ja todellinen painotetaan tehtävien kestolla. Suunniteltu mitataan perustasoa vastaan, jos aktiivinen perustaso on, muuten nykyistä aikataulua vastaan. Osiot ovat *Valmistunut edellisellä aikajaksolla*, *Käynnissä*, *Alkaa seuraavalla aikajaksolla*, *Myöhässä* ja *Avoimet kriittiset tehtävät*. Tehtävä voi kuulua useampaan osioon. Jokaisessa osiossa ovat samat sarakkeet: *WBS*, *Nimi*, *Perustason loppu*, *Ennustettu valmistumispäivä*, *Valm*, *Jäljellä (tp)*, *TF (tp)*, *Kriittinen* ja *Tila*. Rivin tila on *Suoritettu*, *Käynnissä*, *Ei aloitettu*, *Olisi pitänyt alkaa* tai *Olisi pitänyt päättyä*.

## Aikataulun kunto

Tarkistus aikataulun itsensä virheiden ja epätavallisten arvojen varalta. Ylimpänä on DCMA 14 kohdan arviointi. Asetukset kohdassa *Raporttivalinnat*.

**Korkea pelivara > (tp):** — Luku väliltä 1–365. Oletus: 44. Vaikutus: keskeneräinen tehtävä, jonka kokonaispelivara on tätä suurempi, kuuluu kohtaan *Korkea pelivara*.

**Pitkä kesto > (wd):** — Luku väliltä 1–365. Oletus: 44. Vaikutus: keskeneräinen tehtävä, joka ei ole välitavoite ja jonka kesto on pidempi, kuuluu kohtaan *Pitkä kesto*.

**Viive > (wd):** — Luku väliltä 0–365. Oletus: 10. Vaikutus: riippuvuus, jonka viive on suurempi, kuuluu kohtaan *Pitkä viive*. Viive, jonka arvo on alle nolla (limitys), ilmoitetaan aina.

**Lähes kriittinen ≤ (wd):** — Luku väliltä 0–60. Oletus: 5. Vaikutus: määrittää tarkistuksen *Lähes kriittinen*.

Osio *DCMA 14 kohdan arviointi* tulee ensin. Se seuraa Yhdysvaltain puolustuksen sopimushallintaviraston (US Defense Contract Management Agency) neljääntoista tarkistusta. Kaavat ja kynnysarvot ovat julkaisusta *EVMS Program Analysis Pamphlet* (DCMA-EA PAM 200.1, lokakuu 2012). Kustakin kohdasta näkyvät *Määrä*, *Perusjoukko* (kokonaismäärä, johon laskenta perustuu), *Arvo*, *Kynnysarvo*, *Tulos* ja *Tiedot*. Tulos on *Hyväksytty*, *Merkintä* tai *Ei sovellu*. Kohdalla *Ei sovellu* syy on tiedoissa. Merkintä ei ole virhe. Julkaisu pitää sitä syynä tarkastella asiaa lähemmin. Kohdassa *Raporttivalinnat* olevat kynnysarvot eivät koske tätä osiota. Se käyttää aina julkaisun kynnysarvoja.

Se laskee keskeneräiset lehtitehtävät, ilman välitavoitteita ja riippumattoja, sekä niihin kohdistuvat riippuvuudet. Raportin yläpuolella oleva huomautus antaa molemmat luvut. Neljätoista kohtaa:

- *Logiikka*: tehtävät ilman edeltäjää tai seuraajaa. Kynnysarvo: enintään 5%.
- *Limitykset*: riippuvuudet, joissa viive on negatiivinen. Kynnysarvo: ei ole.
- *Viiveet*: riippuvuudet, joissa viive on positiivinen, olipa se kuinka lyhyt tahansa. Kynnysarvo: enintään 5%.
- *Riippuvuustyypit*: FS-riippuvuuksien osuus. Kynnysarvo: vähintään 90%.
- *Kovat rajoitteet*: tehtävät, joilla on pakollinen rajoite tai MSO, MFO, SNLT tai FNLT. Kynnysarvo: enintään 5%.
- *Korkea pelivara*: tehtävät, joiden kokonaispelivara on yli 44 työpäivää. Kynnysarvo: enintään 5%. Vaatii laskennan.
- *Negatiivinen pelivara*: tehtävät, joiden kokonaispelivara on alle 0. Kynnysarvo: ei ole. Vaatii laskennan.
- *Korkea kesto*: tehtävät, jotka ovat yli 44 työpäivää pitkiä. Käytetään perustason kestoa, jos tehtävä on aktiivisessa perustasossa, muuten nykyistä kestoa. Kynnysarvo: enintään 5%.
- *Virheelliset päivämäärät*: toteutunut alkamispäivä tai toteutunut valmistumispäivä on raportointipäivän jälkeen, tai ennustettu alkamispäivä tai ennustettu valmistumispäivä on ennen raportointipäivää. Kynnysarvo: ei ole. Vaatii raportointipäivän.
- *Resurssit*: tehtävät ilman resurssia. Kynnysarvo: ei ole. Vain, jos projektissa käytetään resursseja. Muuten *Ei sovellu*.
- *Myöhästyneet tehtävät*: niiden tehtävien osuus, jotka perustason mukaan pitää valmistua raportointipäivään mennessä ja jotka valmistuvat myöhemmin tai joiden ennustettu valmistumispäivä on myöhemmin. Kynnysarvo: enintään 5%. Vaatii raportointipäivän ja aktiivisen perustason.
- *Kriittisen polun testi*: sovellus pidentää kriittistä, keskeneräistä tehtävää 100 työpäivällä ja laskee uudelleen kopiolla, joten projekti ei muutu. Testi on hyväksytty, jos projektin viimeinen tehtävä ei sen jälkeen valmistu ennen tätä tehtävää. Testi koskee keskeneräistä kriittistä tehtävää, jonka alkamispäivä on aikaisin. Tiedoissa mainitaan tehtävä ja se, kuinka monta työpäivää valmistumispäivä siirtyi. Näkymässä *Tallennetut päivämäärät* tämä testi on *Ei sovellu* (*ei laskettu*): testi laskee, ja raportti näyttää silloin lähdetiedoston päivämäärät. Paina Laske (F5), jolloin testi suoritetaan uudelleen.
- *CPLI*: (kriittisen polun pituus + pelivara) / kriittisen polun pituus. Pituus lasketaan työpäivinä raportointipäivästä viimeisen tehtävän loppuun. Pelivara on ero tehtävän perustason loppuun. Jos tehtävä ei ole perustasossa, käytetään lasketun pelivaran arvoa. Kynnysarvo: vähintään 0,95. Vaatii raportointipäivän.
- *BEI*: raportointipäivänä valmiiden tehtävien määrä, jaettuna sillä määrällä, joka perustason mukaan pitää olla tehty siihen mennessä, plus tehtävät ilman perustasoa. Kynnysarvo: vähintään 0,95. Vaatii raportointipäivän ja aktiivisen perustason.

Kaksi kohtaa poikkeaa julkaisusta, koska sovelluksessa ei ole kyseistä käsitettä: *Korkea kesto* laskee jokaisen keskeneräisen tehtävän, kun julkaisu rajaa sen yksityiskohtaiseen suunnitteluvaiheeseen (rolling wave). *Resurssit* katsoo vain kohdistettuja resursseja, ei kustannuksia. Julkaisussa ei ole lukua kriittisen polun testille. 100 työpäivää on sovelluksen oma valinta.

Tarkistukset ovat tässä järjestyksessä, ja niillä on vakavuus. Virhe: *Negatiivinen pelivara*, *Ohitettu tavoitepäivä*, *Rikottu rajoite* ja *Epäjohdonmukainen edistyminen* (toteutunut alkamispäivä tai toteutunut valmistumispäivä raportointipäivän jälkeen, ennustettu alkamispäivä tai ennustettu valmistumispäivä ennen raportointipäivää, 100% ilman toteutunutta valmistumispäivää, toteutunut valmistumispäivä mutta ei 100%, edistyminen ilman toteutunutta alkamispäivää). Varoitus: *Ilman edeltäjää (avoin alku)* ja *Ilman seuraajaa (avoin loppu)* (ei koske välitavoitteita), *Pitkä kesto*, *Limitys*, *Kova rajoite* (pakollinen rajoite tai MSO, MFO, SNLT tai FNLT), *Järjestyksestä poikkeava edistyminen* ja *Myöhästynyt tehtävä (perustasoon suunnitelmaan nähden)*. Tiedoksi: *Lähes kriittinen*, *Korkea pelivara*, *Pitkä viive*, *Muu riippuvuus kuin FS* ja *Ilman resurssia* (vain, jos projektissa käytetään resursseja). Raportti tarkastelee vain lehtitehtäviä, jotka eivät ole riippumattoja. Ruutu *Yhteenveto* laskee *DCMA-merkinnät*, *Virheet*, *Varoitukset*, *Tiedoksi*, *Lehtitehtävät* ja *Riippuvuudet*. DCMA-osion alapuolella ovat osio *Yhteenveto* (kunkin tarkistuksen vakavuus ja määrä) ja osio *Havainnot* (jokainen tehtävä tai riippuvuus). Ilman laskentaa puuttuvat ne tarkistukset, jotka tarvitsevat pelivaraa.

## Resurssikuormitus

Kullekin resurssille viikoittain tai kuukausittain: mitä tarvitaan verrattuna siihen, mitä on käytettävissä. Asetukset kohdassa *Raporttivalinnat*.

**Aikajakso:** — Oletus: *Koko projekti*. Vaikutus: jokainen viikko tai kuukausi, joka osuu jaksoon, sisältyy kokonaan. Näin rivi näyttää saman luvun kuin histogrammi.

**Ryhmittely:** — Valitse *Viikoittain* tai *Kuukausittain*. Oletus: *Viikoittain*. Vaikutus: yksi rivi kalenteriviikkoa kohden (sarake *Viikon alku*, maanantai) tai kalenterikuukautta kohden (sarake *Kuukausi*).

**Vain ylikuormitetut aikajaksot** — Oletus: pois päältä. Vaikutus: päällä näytetään vain viikot tai kuukaudet, joissa on vähintään yksi ylikuormitettu päivä.

Sarakkeet ovat *Resurssi*, *Tyyppi*, *Viikon alku* tai *Kuukausi*, *Vaadittu*, *Käytettävissä*, *Ero* (käytettävissä miinus vaadittu; negatiivinen luku tarkoittaa pulaa), *Huippu/pv* ja *Ylikuormitettu*. *Vaadittu* on kuormitusaste-päivien summa. Mukana ovat vain viikot tai kuukaudet, joilla on kysyntää. Ruutu *Yhteenveto* laskee *Resurssit*, *Viikot* tai *Kuukaudet*, *Ylikuormitetut viikot* tai *Ylikuormitetut kuukaudet* ja *Ylikuormitetut resurssit*.

## Resurssikohdistukset

Kullekin resurssille sen tehtävät: mitä tämä työryhmä tai nosturi tekee? Asetukset kohdassa *Raporttivalinnat*.

**Aikajakso:** — Oletus: *Koko projekti*. Vaikutus: kun jakso on valittu, mukana ovat vain sellaisten tehtävien resurssikohdistukset, jotka osuvat jaksoon, ja lisäksi myöhässä oleva työ ennen raportointipäivää. *Koko projekti* ei suodata päivämäärän mukaan.

**Sisällytä valmiit tehtävät** — Oletus: pois päältä. Vaikutus: päällä mukana ovat myös valmiiden tehtävien resurssikohdistukset.

Rivit ovat resursseittain, ja resurssin sisällä alkamispäivän mukaan. Ruutu *Yhteenveto* laskee *Resurssit*, *Resurssikohdistukset* ja *Tehtävät ilman resurssia*. Sarakkeet ovat *Resurssi*, *Tyyppi*, *WBS*, *Nimi*, *Alku*, *Loppu*, *Jäljellä (tp)*, *Kuorm./päivä*, *Valm*, *Kriittinen* ja *Tila*. *Resurssi* ja *Tyyppi* näkyvät vain resurssin ensimmäisellä rivillä. Tila kullakin rivillä on sama kuin edistymisraportissa: *Suoritettu*, *Käynnissä*, *Ei aloitettu*, *Olisi pitänyt alkaa* tai *Olisi pitänyt päättyä*.

## WBS-yhteenveto

Aikataulu koottuna WBS-elementeittäin: johdon yleiskuva. Asetukset kohdassa *Raporttivalinnat*.

**Taso:** — mihin tasoon asti WBS näytetään. Valitse *Koko WBS* tai tasot 1–8. Oletus: taso 2. Vaikutus: alaotsikko sanoo *Enintään taso 2*.

**Näytä tehtävät** — Oletus: pois päältä. Vaikutus: päällä näytetään lisäksi kunkin elementin alla lehtitehtävät itse.

Sarakkeisiin kuuluvat *WBS*, *Nimi*, *Alku*, *Loppu*, *Perustason alku*, *Perustason loppu*, *Kesto (wd)*, *Valm*, *Δ loppu (tp)*, *Min. TF*, *Teht* (tehtävien määrä), *Krit*, *Aktiivinen* ja *Tehty*. Yhteenvetotehtävän alku ja loppu tulevat viimeisestä laskennasta. Edistyminen painotetaan keston mukaan lehtitehtävien yli. *Min. TF* ja määrät koskevat alla olevia lehtitehtäviä. Ruutu *Yhteenveto* laskee *WBS-elementit* ja *Tehtävät*.

## Aikajakso

Neljä taulukkoraporttia ja *Resurssikaavio* käyttävät asetusta *Aikajakso:* seuraavasti: *Look-ahead*, *Edistymisraportti*, *Resurssikuormitus*, *Resurssikohdistukset* ja *Resurssikaavio*. Kukin raportti muistaa oman aikajaksonsa. Pudotusvalikon alla ovat *Alkaen* ja *Asti*. Niissä näkyvät päivämäärät, jotka valinta tuottaa.

**Viitepäivä.** Jakso *Seuraava* tai *Edellinen* lasketaan projektin raportointipäivästä, tai tänään, jos raportointipäivää ei ole asetettu. Taulukkoraportit kertovat silloin: *Raportointipäivää ei ole asetettu — raportti laskee tänään (…).* Kun raportointipäivää siirretään, ikkuna siirtyy mukana. Molemmat päivät sisältyvät jaksoon.

**Seuraava viikko, Seuraavat 2 viikkoa, Seuraavat 4 viikkoa, Seuraavat 6 viikkoa, Seuraavat 8 viikkoa, Seuraavat 12 viikkoa** — viitepäivästä alkaen, 7 päivää viikossa. Kun raportointipäivä on torstai 20. toukokuuta, *Seuraava viikko* kestää 20.–26. toukokuuta ja *Seuraavat 4 viikkoa* 20. toukokuuta – 16. kesäkuuta.

**Edellinen viikko, Edelliset 2 viikkoa, Edelliset 4 viikkoa, Edelliset 6 viikkoa, Edelliset 8 viikkoa, Edelliset 12 viikkoa** — samat kuusi, mutta laskettuna taaksepäin: 7 päivää viikossa, viitepäivään asti. *Edelliset 2 viikkoa* kestää 7.–20. toukokuuta, kun viitepäivä on 20. toukokuuta.

**Seuraava kuukausi, Edellinen kuukausi** — yksi kalenterikuukausi eteen- tai taaksepäin. Jakso päättyy päivää ennen samaa päivämäärää toisessa kuukaudessa. *Seuraava kuukausi* kestää 20. toukokuuta – 19. kesäkuuta. *Edellinen kuukausi* kestää 21. huhtikuuta – 20. toukokuuta.

**Koko projekti** — ensimmäisestä alkamisesta aikataulun viimeiseen loppuun.

**Mukautettu** — oma jakso. Vaikutus: *Alkaen* ja *Asti* muuttuvat kahdeksi päivämääräkentäksi. Ne alkavat juuri valitun vaihtoehdon päivämääristä. Loppupäivä ei voi olla ennen alkamispäivää (*Loppupäivä on ennen alkamispäivää.*). Molemmat kentät on täytettävä (*Täytä molemmat päivämäärät.*). Jos syöte ei ole oikea, raportti pysyy viimeisessä kelvollisessa jaksossa.

## Katso myös

- [Raportin tekeminen ja tulostaminen](docs://howto-rapport-maken-en-afdrukken): koko vaihe raporttityypistä PDF:ään.
- [Aikajakson valitseminen](docs://howto-rapportageperiode-kiezen): vaiheet ja esimerkit.
- [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad): mitä kriittinen ja lähes kriittinen tarkoittavat.
- [Edistyminen, raportointipäivä ja perustaso](docs://uitleg-voortgang): raportointipäivä ja perustaso, joita raportit käyttävät.
- [Ylikuormituksen ratkaiseminen](docs://howto-overbezetting-oplossen): mitä tehdä Resurssikuormituksen ylikuormitetuille viikoille.
- [Tuonti- ja vientimuodot](docs://ref-import-exportformaten): PDF muiden muotojen rinnalla.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): kaksi perustasoa, edistyminen ja raportointipäivä, joilla eroraporttia voi tarkastella.
