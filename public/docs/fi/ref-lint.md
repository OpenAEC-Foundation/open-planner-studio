# Valintanauha, välilehti kerrallaan

Valintanauhassa yläreunassa on välilehdet. Jokaisella välilehdellä on painikeryhmiä. Tässä artikkelissa kerrotaan jokaisen painikkeen toiminta. Siinä kerrotaan myös, missä tulos näkyy. Vaiheittaiset työohjeet ovat käyttöohjeissa. Tästä selviää, mitä painike tekee. Painikkeen ehto on kirjoitettu painikkeen viereen.

## Valintanauhan toiminta

- **Välilehdet** — *Tiedosto* on vasemmalla. Sen jälkeen tulevat *Aloitus*, *Aikataulu*, *Resurssit*, *Näkymä*, *Asetukset*, *Taulukko*, *IFC*, *Raportti* ja vain AI-tilan ollessa päällä *AI*.
- **Kapea ikkuna** — kun valintanauha ei mahdu, painikkeet pienenevät kuvakkeiksi oikealta vasemmalle. Painikkeen nimi on silloin sen työkaluvihje. Jokainen painike ilman omaa työkaluvihjettä näyttää nimensä.
- **Tiivistä valintanauha** — pieni nuoli valintanauhan oikeassa alakulmassa muuttaa sen tasaiseksi riviksi, jossa on vain kuvakkeet. Ryhmät *Perustasot ja edistyminen* ja *Yhteys* AI-välilehdellä katoavat silloin yhden painikkeen taakse, jolla on ponnahdusikkuna. Oletus: auki. Valinta muistetaan.
- **Laajennuspainikkeet** — laajennus voi lisätä oman ryhmänsä välilehden loppuun. Tällainen painike tekee sen, mitä laajennus sille antoi.

## Tiedosto

Kun *Tiedosto* valitaan, oma näkymä (Backstage) ottaa työtilan haltuunsa. Sillä ei ole valintanauhaa. *Takaisin* sulkee sen. Jos kohdassa *Projektin asetukset* muutetaan jotakin eikä muutosta oteta käyttöön, sovellus kysyy ensin, mitä muutokselle tehdään.

- **Uusi** — avaa ikkunan *Luo uusi projekti* ja sulkee Backstage-näkymän. Kentät kuvataan kohdassa [Uusi projekti ja projektin asetukset](docs://ref-projectinfo).
- **Avaa** — valitsee tiedoston ja avaa sen asiakirjana. Sulkee Backstage-näkymän.
- **Viimeisimmät** — luettelo äsken avatuista projekteista. Yksi napsautus avaa projektin. Näkyy vain, kun ympäristö voi avata tiedostoja uudelleen: työpöytäsovelluksessa ja selaimissa, jotka tarjoavat tiedostopääsyn, kuten Chrome ja Edge. Muissa selaimissa painike on näkyvissä, mutta sivu jää tyhjäksi.
- **Esimerkit** — mukana toimitetut esimerkkiaikataulut. Ne on jaettu osioihin *Täydet esittelyaikataulut* (merkki *Kaikki toiminnot*) ja *Yksinkertaiset esimerkit*. Yksi napsautus avaa esimerkin uudessa välilehdessä.
- **Tallenna** — kirjoittaa projektin tämän asiakirjan tiedostoon. Jos asiakirjalla ei ole vielä tiedostoa, valitaan ensin nimi ja paikka. Tiedostoa, joka on avattu muussa muodossa kuin IFC, ei korvata koskaan. Silloin *Tallenna* kysyy IFC-tiedostolle nimen ja paikan.
- **Tallenna nimellä** — valitsee uuden nimen tai paikan ja tallentaa siihen IFC-muodossa.
- **Vienti** — kortit kullekin vientimuodolle, kuvauksineen. Yksi napsautus muuntaa projektin ja tallentaa sen. Sen jälkeen palataan välilehdelle *Aloitus*. Jos aikataulussa on kehä, virhe näkyy Backstage-näkymässä ja näkymä jää auki. Jos projekti on linkitetty kirjastoon, alle ilmestyy valintaruutu *Tallenna kirjastotiedosto rinnalle*. Se toimii vain IFC-kortilla.
- **Tuonti** — ylhäällä kortti *Tuo edistyminen taulukosta*, joka ei ole käytössä ilman tehtäviä. Sen alla ovat tuojat, jotka laajennukset lisäävät.
- **Tulostus** — painike *Avaa tulostuksen esikatselu* vie välilehdelle *Raportti*.
- **Projektin asetukset** — projektin metatiedot ja laskentaprofiili. Muutokset tulevat voimaan vasta, kun *Käytä*-painiketta painetaan. Katso [Uusi projekti ja projektin asetukset](docs://ref-projectinfo) ja [Laskentaprofiilit ja laskentasäännöt](docs://uitleg-rekenprofielen).
- **Asetukset** — samat asetukset kuin ikkunassa *Asetukset*.
- **Laajennukset** — laajennusten hallinta ja asennus. Katso [Laajennuksen asentaminen ja hallinta](docs://howto-extensie-installeren).
- **Kirjasto** — resurssikirjastojen hallinta. Katso [Resurssikirjastojen hallinta ja jakaminen](docs://howto-bibliotheken-beheren).
- **Ohje** — sisäänrakennettu dokumentaatio, myös näppäimellä F1. Hakukenttä etsii otsikoista, väliotsikoista ja itse tekstistä. Artikkelit ovat neljässä osiossa: *Opetusohjelmat*, *Käyttöohjeet*, *Selitys* ja *Viiteaineisto*. Kohdassa *Dokumentaation kieli* valitaan *Seuraa sovelluksen kieltä* tai jokin listan kielistä. Hollanti ja englanti ovat lähdekielet. Muilla kielillä on jo käännetyt artikkelit. Jos artikkeli puuttuu omalla kielellä, luetaan englanninkielinen versio ja siitä näytetään ilmoitus. Valinta säilyy tällä laitteella erillään sovelluksen kielestä. Ohjeen voi avata myös ikkunasta tai paneelista. Monissa ikkunoissa ja paneeleissa *Ominaisuudet*, *Resurssit* ja *Varoitukset* on oikeassa yläkulmassa kysymysmerkki (*Ohje tähän aiheeseen*). Se avaa ohjeen kyseisen ikkunan tai paneelin artikkelista. Jos ikkunaan on kirjoitettu jotakin, mitä ei ole vielä tallennettu, sovellus kysyy ensin *Tallenna*, *Peruuta* (hylkää kirjoitettu) tai *Takaisin* (pysy ikkunassa). Sen jälkeen ikkuna sulkeutuu ja ohje aukeaa. Muutamat ikkunat, kuten *Muokkaa tehtävää* ja *Tasaa resurssit*, kysyvät aina. Ilman syötettyä tietoa ohje aukeaa heti.
- **Aloita kierros** — sulkee Backstage-näkymän ja aloittaa kierroksen vaiheesta 1.
- **Sulje projekti** — sulkee aktiivisen asiakirjan. Jos siinä on tallentamattomia muutoksia, sovellus pyytää vahvistuksen.

## Aloitus

### Aloitus › Tiedosto

- **Uusi**, **Tallenna**, **Avaa** ja **Tallenna nimellä** — samat toiminnot kuin edellisessä osiossa.
- **Viimeisimmät** — pudotusvalikko viimeisimpien projektien kanssa. Yksi napsautus avaa projektin. Näkyy samalla ehdolla kuin *Tiedosto › Viimeisimmät*. Ilman viimeisimpiä tiedostoja se sanoo *Ei viimeaikaisia tiedostoja*.
- **Vienti** — pudotusvalikko vientimuodoilla (lyhyet nimet). Yksi napsautus muuntaa projektin ja tallentaa sen.

### Aloitus › Muokkaus

- **Kumoa** — kumoaa viimeisen muutoksen. Ei käytössä, kun kumottavaa ei ole.
- **Tee uudelleen** — palauttaa viimeisimmän kumotun muutoksen. Ei käytössä, kun uudelleen tehtävää ei ole.
- **Poista** — poistaa valitut tehtävät alitehtävineen yhdellä vaiheella. Ei käytössä ilman valintaa.

### Aloitus › Tehtävät

- **Tehtävä** — lisää tehtävän nimeltä *Uusi tehtävä*. Sen kesto on 5 työpäivää ja se alkaa projektin aloituspäivänä. Jos *Ota tuntisuunnittelu käyttöön* on päällä ja *Oletusmitta uusille tehtäville* kohdassa *Projektin asetukset* on tunnit, kesto on 5 tuntia. Jos tehtävä on valittuna ja näkymä on tavallinen puu, uusi tehtävä tulee heti alimman valitun tehtävän alle (työkaluvihje *Uusi tehtävä heti valinnan alle*). Ilman valintaa se tulee listan alaosaan (työkaluvihje *Uusi tehtävä listan alaosaan*). Jos jotakin on valittuna mutta tehtäviä suodatetaan, ryhmitellään tai lajitellaan, se tulee myös alaosaan. Sovellus näyttää silloin punaisen ilmoituksen: se ei voi sijoittaa tehtävää valintasi alle. Ilmoituksessa on painike *Tyhjennä*. Uusi tehtävä on ainoa valinta. Gantt siirtyy siihen, ja nimen voi kirjoittaa heti paneelissa *Ominaisuudet*.
- **Välitavoite ▾** — pudotusvalikko, joka lisää välitavoitteen (kesto 0) samaan paikkaan kuin *Tehtävä*. *Aloitusvälitavoite* ja *Loppuvälitavoite* asettavat välitavoitteen tyypin. Uusi välitavoite saa nimen *Uusi välitavoite* ja työlajiksi *Muu*. *Tarkastushetki (pakollinen)* luo loppuvälitavoitteen, jonka työlaji on *Tarkastus* ja lippu *Pakollinen (sopimuksellinen)*. Sen nimi on *Uusi tarkastuspiste*.
- **Linkitä ▾** — pudotusvalikko neljällä kiinteällä toiminnolla. Pääpainikkeen merkitys ei muutu koskaan. Katso neljä toimintoa kohdasta *Aikataulu › Riippuvuudet*.
- **Jaa tehtävä** — kytkee jaetun tehtävän tilan päälle tai pois. Päällä: valintanauhan alla oleva rivi kertoo, että palkkia napsautetaan siitä kohdasta, johon aukko alkaa, ja vedetään oikealle aukon pituuden verran. Ei käytössä, kun Gantt ei ole näkyvissä. Tämä koskee välilehtiä *Taulukko*, *IFC* ja *Raportti* sekä täyden resurssipaneelin alla olevaa aluetta. Työkaluvihje sanoo silloin *Käytettävissä vain, kun Gantt-kaavio on näkyvissä*. Katso [Tehtävän jakaminen](docs://howto-taak-splitsen).

### Aloitus › Aikataulu

- **Laske** — laskee aikataulun: päivät, pelivara, kriittinen polku ja resurssikuorma. Tämä ei tapahdu itsestään, ellei *Laske automaattisesti* ole päällä (*Asetukset*, välilehti *Aikataulu*, otsikko *Laskenta*). Kun aikataulu on vanhentunut, tilarivi sanoo *Vanhentunut — laske uudelleen (F5)*.

### Aloitus › Zoomaus

- **Zoom +** — lähentää aika-akselia 10 pikselillä päivää kohti.
- **Zoom -** — loitontaa aika-akselia 10 pikselillä päivää kohti.

## Aikataulu

### Aikataulu › Aikataulu

Painike *Laske* on sama kuin välilehdellä *Aloitus*.

- **Siirrä projekti…** — avaa ikkunan *Siirrä projekti*. Ei käytössä ilman projektin aloituspäivää. Katso [Projektin siirtäminen](docs://howto-project-verplaatsen).
- **Varoitukset** — näyttää tai piilottaa paneelin *Varoitukset* oikeassa sarakkeessa. Painike syttyy, kun paneeli on näkyvissä. Kun se kytketään päälle, tiivistetty sarake avautuu. Sisällöstä kerrotaan kohdassa [Ilmoitukset ja varoitukset](docs://ref-meldingen).

### Aikataulu › Riippuvuudet

Ryhmässä on painike *Linkitä ▾*, jossa on neljä toimintoa, ja painike *Jaa tehtävä* (sama kuin välilehdellä *Aloitus*). Neljä toimintoa ovat:

- **Piirrä riippuvuus** — kytkee linkkitilan päälle tai pois. Kun se on päällä, näkyy valintamerkki ja pääpainike syttyy. Päällä: palkista vedetään Gantt-kaaviossa toiseen palkkiin, jolloin syntyy riippuvuus. Valintanauhan alla oleva rivi kertoo, miten se lopetetaan (*Lopeta* tai Esc). Ei käytössä, kun Gantt ei ole näkyvissä.
- **Linkitä valitut tehtävät** — luo lopusta alkuun -riippuvuuden kahden tehtävän välille ilman viivettä. Ensin valittu tehtävä on edeltäjä. Käytettävissä vain, kun täsmälleen kaksi tehtävää on valittu. Muuten näkyy *Valitse täsmälleen kaksi tehtävää*. Kaksoisriippuvuus tai kehä hylätään, ja siitä näkyy ilmoitus.
- **Lisää ulkoinen riippuvuus…** — avaa ikkunan, jossa valittuun tehtävään lisätään ulkoinen edeltäjä tai seuraaja. Käytettävissä vain, kun täsmälleen yksi tehtävä on valittu. Muuten näkyy *Valitse täsmälleen yksi tehtävä*.
- **Päivitä kaikki ulkoiset riippuvuudet** — päivittää kaikkien ulkoisten riippuvuuksien ankkurit. Valikko kertoo, kuinka monta päivitettiin tai puuttuu. Käytettävissä vain, kun projektilla on ulkoisia riippuvuuksia. Muuten näkyy *Tässä projektissa ei ole ulkoisia riippuvuuksia*.

Taustatiedot ovat kohdissa [Riippuvuuksien luominen](docs://howto-relaties-leggen) ja [Riippuvuudet ja viive](docs://uitleg-relaties).

### Aikataulu › Polun jäljittäminen

- **Edeltäjät** — korostaa Gantt-kaaviossa valittujen tehtävien edeltäjät, ketju kerrallaan.
- **Seuraajat** — korostaa valittujen tehtävien seuraajat.

Molemmat voivat olla päällä yhtä aikaa. Toinen napsautus painikkeeseen kytkee sen puolen pois. Ohjaavat riippuvuudet saavat voimakkaamman sävyn. Katso [Polun jäljittäminen](docs://howto-pad-traceren).

### Aikataulu › Kalenteri

- **Kalenteri** — avaa ikkunan *Kalenterit* projektin kalenterikirjastoineen. Katso [Kalenteri-ikkunat](docs://ref-kalenders).

### Aikataulu › Rakenne

- **Koodit ja kentät** — avaa ikkunan *Koodit ja kentät* tehtäväkoodeille ja mukautetuille kentille. Katso [Koodit ja mukautetut kentät](docs://howto-codes-en-velden).
- **WBS auto** — kytkee WBS-koodien automaattisen numeroinnin päälle tai pois. Oletus: päällä uudessa projektissa. Avatussa tiedostossa, jossa ei ole tätä asetusta: päällä, jos tiedosto on tyhjä tai kaikki koodit vastaavat jo puun numerointia, muuten pois. Päällä: koko puu numeroidaan kerralla, koodit seuraavat sitten jokaista rakennemuutosta, ja kenttä *WBS-koodi* paneelissa ja ikkunassa ei ole käytössä.
- **Numeroi WBS uudelleen** — numeroi WBS-koodit kerran uudelleen puun sijainnin mukaan (1.2.3). Ei käytössä, kun *WBS auto* on päällä.
- **Mallipohjat** — pudotusvalikko tallennetuilla WBS-mallipohjilla. Kukin näyttää tehtävien ja riippuvuuksien määrän. Yksi napsautus lisää mallipohjan valitun tehtävän alle. Jos mitään ei ole valittu, se lisätään ylimmälle tasolle. Roskakorikuvake poistaa mallipohjan. Ilman mallipohjia valikko kertoo, miten mallipohja tallennetaan: napsauta yhteenvetotehtävää hiiren kakkospainikkeella ja valitse *Tallenna haara mallipohjana*. Katso [Mallipohjien tallentaminen ja lisääminen](docs://howto-wbs-sjablonen).
- **Sisennä** — tekee valituista tehtävistä edeltävän tehtävän alitehtäviä. Ei käytössä ilman valintaa, eikä kun tehtäviä suodatetaan, ryhmitellään tai lajitellaan. Työkaluvihje sanoo silloin *Ei käytettävissä suodatuksen, ryhmittelyn tai lajittelun aikana*.
- **Ulontaa** — siirtää valitut tehtävät yhden tason ylemmäs, heti nykyisen yläkohteen jälkeen. Samat ehdot kuin *Sisennä*.

### Aikataulu › Perustasot ja edistyminen

- **Hallitse perustasoja…** — avaa perustasoikkunan. Katso [Perustason tallentaminen ja hallinta](docs://howto-baseline-opslaan-en-beheren).
- **Raportointipäivä** — päivä, johon asti edistymistä mitataan. Kirjoita päivämäärä. Rasti (*Tyhjennä raportointipäivä*) poistaa sen. Jos projektin kalenterissa on työaikalohkoja, sovellus laskee tunneissa ja päivämäärän viereen tulee aikakenttä (MS Project tallentaa usein kellonajan 17:00). Aika lasketaan silloin mukaan: 12:00 17:00:n sijaan antaa puolen päivän erilaisen jäljellä olevan työn. Ilman työaikalohkoja sovellus laskee kokonaisina päivinä, eikä aikakenttää ole. Vaikutus: edistymistä mitataan siihen päivään asti. Raportointipäivän viiva ja edistymisviiva Gantt-kaaviossa ovat sillä kohdalla. Katso [Edistyminen, raportointipäivä ja perustaso](docs://uitleg-voortgang).
- **Edistymistapa** — valinta: *Retained Logic* tai *Progress Override*. Oletus: *Retained Logic*. Vaikutus: *Retained Logic* -tilassa aloitetun seuraajan jäljellä oleva työ seuraa riippuvuutta. *Progress Override* -tilassa jäljellä oleva työ alkaa raportointipäivänä, ilman odotusta edeltäjää. Katso [Edistymistavan valitseminen](docs://howto-voortgangsmodus-kiezen).

Tiivistetyssä valintanauhassa nämä kolme ovat yhden lippupainikkeen takana, jonka nimi on *Perustasot ja edistyminen*.

### Aikataulu › Edistyminen

- **Vie edistymistaulukko** — tekee `.xlsx`-taulukon tehtävistä, jotta edistymisen voi täyttää sovelluksen ulkopuolella. Ei käytössä ilman tehtäviä.
- **Tuo edistyminen taulukosta** — avaa tuontikkunan palautetulle taulukolle. Ei käytössä ilman tehtäviä. Katso [Edistymisen tuominen taulukosta](docs://howto-voortgang-importeren).

Tämä ryhmä on myös välilehdillä *Taulukko* ja *Raportti*.

## Resurssit

### Resurssit › Hallinta

- **Resurssit** — avaa koko resurssipaneelin, joka ottaa työtilan haltuunsa. Painike syttyy, kun näet tämän paneelin. Katso [Resurssipaneeli](docs://ref-resourcepaneel).
- **Resurssiteline** — kiinnittää kompaktin resurssipaneelin oikeaan sarakkeeseen Gantt-kaavion viereen. Painike syttyy, kun teline on näkyvissä. Toinen napsautus sulkee sen. Teline näyttää vain nimen, värin, varoituksen ylikuormituksesta ja *Enimmäismäärä*-arvon. Kun tehtävä on valittuna, näytetään vain niiden tehtävien resurssit.
- **Uusi resurssi** — avaa koko resurssipaneelin tyhjällä luonnosrivillä uudelle resurssille. Mitään ei luoda, ennen kuin nimi on kirjoitettu. Jos napsautetaan muualle, ei jää mitään. Resurssi siirtyy kirjastoon tai projektiin näkymästä riippuen.

### Resurssit › Resurssikohdistus

- **Kohdista ▾** — kohdistaa resurssin valittuun tehtävään. Käytettävissä vain, kun täsmälleen yksi tehtävä on valittu ja se on lehtitehtävä eikä välitavoite. Muuten painike on harmaa. Valikossa asetetaan ensin *Kuorm./päivä* (oletus 1) ja *Käyrä* (oletus *Tasainen*). Yksi napsautus resurssiin kohdistaa sen näillä arvoilla. Valikko listaa vain resurssit, joita ei ole vielä tehtävällä. Katso [Resurssien kohdistaminen käyrällä](docs://howto-resource-toewijzen).

### Resurssit › Histogrammi

- **Histogrammi** — näyttää tai piilottaa histogrammirivin Gantt-kaavion alla. Oletus: pois. Valinta muistetaan.
- **Edellinen** ja **Seuraava** — selaavat resursseja histogrammirivin valitsimessa. Kierroksessa on lisäksi vaihe *Kaikki resurssit*. Ei käytössä, kun histogrammi on pois päältä tai projektilla ei ole resursseja.

### Resurssit › Tasaaminen

- **Tasaa…** — avaa ikkunan *Tasaa resurssit*. Katso [Tasaaminen](docs://uitleg-nivelleren).
- **Tyhjennä tasaus** — poistaa tasauksen lisäämät lykkäykset ja tauot. Ei käytössä, kun yhdelläkään tehtävällä ei ole tasauksen tulosta.

### Resurssit › Ylikuormitus

- **Ylikuormitus** — ei painike vaan laskuri: resurssien määrä, joilla on vähintään yksi ylikuormitettu päivä, tai *Ei mitään*. Näkyy punaisena varoitusmerkin kanssa heti, kun niitä on. Luku päivittyy *Laske*-toiminnon jälkeen sekä resurssien ja kohdistusten muutosten jälkeen. Kun tehtävien päivämääriä muutetaan, luku lasketaan vasta *Laske*-toiminnon jälkeen.

## Näkymä

### Näkymä › Aikaskaala

- **Lähennä +** ja **Loitonna -** — lähentää tai loitontaa aika-akselia 10 pikseliä päivää kohti.
- **Palauta** — palauttaa zoomauksen oletusarvoon, 30 pikseliin päivää kohti.
- **Sovita projektiin** — zoomaa ja vierittää niin, että koko projekti näkyy.
- **Aikaskaalan valinta** — luettelo, jossa ovat *Vuosi*, *Neljännes*, *Kuukausi*, *Viikko*, *Päivä* ja, vain kun *Ota tuntisuunnittelu käyttöön* on päällä, *Tunti*. Valinta asettaa kiinteän zoomin. Näytetty arvo seuraa nykyistä zoomia. Sen alapuolella näytetään tämä zoom pikseleinä päivää kohti.

### Näkymä › Näyttö

- **Sarakkeet…**, **Suodata…**, **Ryhmitä…** ja **Lajittele…** — näkyvät vain, kun *Näytä klassiset näkymäpainikkeet* on päällä (*Asetukset*, välilehti *Lisäasetukset*, otsikko *Vanhat toiminnot*). Oletus: pois. *Sarakkeet*… vie välilehdelle *Taulukko* ja avaa sarakevalitsimen siellä. *Suodata*… avaa suodatinikkunan heti, kun tallennettua suodatinta ei ole. Tallennettujen suodattimien kanssa se avaa valikon, jossa ovat *Suodata*…, *Tyhjennä* (vain kun suodatin on käytössä) ja tallennetut suodattimet. *Ryhmitä*… sallii kaksi tasoa. *Lajittele*… sallii useampia tasoja. Painike syttyy, kun tämä näkymäasetus on käytössä. Nykyisessä valintanauhassa tämä tehdään asettelupainikkeilla. Katso [Asettelun luominen ja käyttäminen](docs://howto-layouts-gebruiken).

### Näkymä › Jäsennys

- **Tiivistä** — tiivistää valitut yhteenvetotehtävät. Ilman valintaa tiivistetään kaikki. Ryhmitellyssä näkymässä tiivistetään kaikki ryhmät, eikä valinnalla ole vaikutusta.
- **Laajenna** — päinvastoin.

### Näkymä › Asettelu

- **Asettelupainikkeet** — jokainen asettelu on kytkin, jolla on kuvake ja nimi. Mukana on *Resurssikaavio*. Yksi napsautus kytkee asettelun päälle. Seuraava napsautus kytkee sen pois ja palauttaa näkymän, joka oli ennen napsautusta. Asettelut, joissa on eri osia, voivat olla päällä yhtä aikaa. Napsauta asettelua hiiren kakkospainikkeella: *Muokkaa*…, *Monista* ja *Poista* (vahvistuksen jälkeen). Valmiiksi mukana olevaa asettelua voi vain monistaa.
- **Uusi asettelu** — avaa asetteluikkunan uutta asettelua varten.

### Näkymä › Esitys

- **Esitys** — kytkee esitystilan päälle tai pois (lopetus: Esc, työpöytäsovelluksessa myös F11). Vain Gantt täyttää näytön. Katso [Esittäminen suurella näytöllä](docs://howto-presentatie).
- **Jaettu näkymä** — jakaa Ganttin kahteen aikaikkunaan, jotka alkavat molemmat nykyisellä zoomauksella ja sijainnilla (jako 50 prosenttia), tai yhdistää ne taas yhdeksi. Oletus: pois. Katso [Jaetun näkymän ja pienoiskartan käyttäminen](docs://howto-split-view-en-mini-map).
- **Pienoiskartta** — näyttää tai piilottaa pienoiskartan. Oletus: pois. Valinta muistetaan.

### Näkymä › Paneelit

- **Ominaisuudet** — näyttää tai piilottaa paneelin *Ominaisuudet* oikeanpuoleisessa sivupalkissa. Oletus: päällä. Katso [Tehtäväikkuna ja ominaisuuspaneeli](docs://ref-taak-eigenschappen).

Painikkeet *Resurssit*, *Resurssitelakka* ja *Histogrammi* ovat samat kuin ryhmässä *Resurssit*, ja *Varoitukset* on sama kuin ryhmässä *Aikataulu*.

**Oikeanpuoleinen sivupalkki.** Sivupalkki Ganttin oikealla puolella on näkyvissä heti, kun ainakin yksi paneeleista *Ominaisuudet*, *Resurssitelakka* tai *Varoitukset* on päällä. Jos mikään ei ole päällä, sivupalkkia ei ole. Jos koko paneeli vie työtilan, esimerkiksi koko resurssipaneeli, sivupalkki katoaa. Vain välilehdellä *Taulukko* se jää näkyviin.

- **Leveys** — vedä jakajaa työtilan ja sivupalkin välissä. Yksi leveys koskee kaikkia sivupalkin paneeleja.
- **Jako** — jos kaksi paneelia on päällä, vedä niiden välistä rajaa. Jos yksi on päällä, se paneeli täyttää koko sivupalkin.
- **Tiivistä** — painike *Tiivistä sivupalkki* otsikkorivillä piilottaa sivupalkin. Kapea reunus, jossa on painike *Laajenna sivupalkki*, tuo sen takaisin samoilla paneeleilla kuin ennen.
- **Sulje** — jokaisessa paneelissa on rasti otsikkorivillä. Se on sama kytkin kuin valintanauhan painike.
- **Koko paneeli** — resurssitelakassa painike *Koko paneeli* avaa koko resurssipaneelin.

### Näkymä › Perustasot ja edistyminen

Tällä ryhmällä on sama nimi kuin ryhmällä *Aikataulu*, mutta se sisältää Gantt-kaavion piirtoasetukset.

- **Perustason peitto** — näyttää aktiivisen perustason ohuena palkkina kunkin tehtäväpalkin alla. Oletus: päällä. Ilman aktiivista perustasoa ei ole mitään nähtävää.
- **Edistymisviiva** — piirtää viivan raportointipäivän kohdalle. Viiva pullistuu kunkin tehtävän kohdalla sen edistymisen mukaan. Oletus: päällä. Ilman raportointipäivää ei ole mitään nähtävää. Kun edistymisviiva on päällä, tämä viiva on myös raportointipäivän merkki.
- **Raportointipäivän viiva** — piirtää katkoviivan raportointipäivän kohdalle. Oletus: päällä. Viiva näkyy vain, kun edistymisviiva on pois päältä, koska muuten edistymisviiva ottaa sen paikan. Otsikon päivämääräteksti jää näkyviin, niin kauan kuin ainakin toinen näistä kahdesta on päällä. Teksti noudattaa päivämääräesitystä, esimerkiksi 20-09-2006. Jos sovellus laskee tunneissa, viiva ja teksti ovat kellonajan kohdalla, ja teksti näyttää myös kellonajan, esimerkiksi 20-09-2006 17:00.
- **Palkkien värit** — valitsee, miten palkit värjätään: *Kriittinen polku* (oletus), *Tehtäväkohtainen — automaattinen* tai *Luokittain* sekä kentän valinta. Jos kenttää ei ole tässä projektissa, valikko kertoo, että *Työlaji* käytetään väliaikaisesti. Kun *Kriittinen polku* ei ole valittu, punainen reunus merkitsee kriittisen polun. Valinta koskee myös raporttia.
- **Resurssikorostus** — piirtää ohuen nauhan resurssin värillä kunkin lehtipalkin alle. Nauha jakautuu suhteessa kuormitusasteeseen päivää kohti. Oletus: pois.
- **Pelivarakaista** — piirtää vihreän kaistan ei-kriittisen palkin jälkeen, tehtävän myöhäisimpään valmistumispäivään asti. Oletus: päällä.
- **Riippuvuusviivat** — näyttää tai piilottaa tehtävien väliset riippuvuusviivat. Oletus: päällä. Valinta kuuluu asiakirjaan ja asetteluun.

## Asetukset

### Asetukset › Projekti

- **Projektin asetukset** — avaa ikkunan *Projektin asetukset*: projektin metatiedot ja osiossa *Laskentaprofiili ja laskentavaihtoehdot* se, miten projekti lasketaan. Katso [Uusi projekti ja Projektin asetukset](docs://ref-projectinfo).
- **Asetukset** — avaa ikkunan *Asetukset* välilehdillä *Ulkonäkö*, *Aikataulu* ja *Lisäasetukset*. Samat asetukset ovat kohdassa *Tiedosto › Asetukset*.

### Asetukset › Kalenteri

Painike *Kalenteri* on sama kuin ryhmässä *Aikataulu*.

### Asetukset › Pikanäppäimet

- **Pikanäppäimet** — avaa ikkunan *Pikanäppäimet*.

## Taulukko

Välilehti *Taulukko* näyttää tehtävät täydellisenä taulukkona Ganttin sijasta. Ryhmät *Tiedosto*, *Muokkaa*, *Tehtävät*, *Aikataulu* ja *Polun jäljittäminen* ovat samat kuin kohdissa *Aloitus* ja *Aikataulu*, ja ne toimivat samalla valinnalla. Ryhmä *Zoomaus* puuttuu, koska zoomaus skaalaa vain Gantt-kaavion aika-akselia. Painikkeet *Jaa tehtävä* ja *Piirrä riippuvuus* ovat täällä pois käytöstä, koska Gantt-kaaviota ei ole.

### Taulukko › Sarakkeet

- **Sarakkeet…** — avaa tämän taulukon sarakevalitsimen. Sama valitsin avautuu taulukon otsikon plusmerkistä. Ohjeteksti sanoo *Valitse Taulukkonäkymän sarakkeet*. Katso [Taulukon sarakkeiden säätäminen](docs://howto-tabelkolommen-aanpassen) ja [Taulukon sarakkeet](docs://ref-tabelkolommen).

## IFC

Välilehti näyttää IFC-paneelin työtilassa. Valintanauhassa ei ole tässä painikkeita, vain tekstirivi *IFC - Industry Foundation Classes, projektin skeemassa (oletuksena IFC 4.3 ADD2)*.

## Raportti

### Raportti › Raportti

- **Tulosta** — vain tällä välilehdellä, jossa se ei tee mitään, koska *Raportti* on jo auki. Raportin valinnat ovat raporttinäkymässä.

## AI

Välilehti *AI* näkyy vain, kun *Ota AI-tila käyttöön* on päällä (*Asetukset*, välilehti *Lisäasetukset*, otsikko *AI-tila*). Oletus: pois. Kun se kytketään pois, välilehti poistuu ja silta pysähtyy. Tekoälyavustaja käyttää aikataulua MCP-sillan kautta, joka käynnistetään täällä. Katso [Tekoälyavustajan yhdistäminen (MCP)](docs://howto-ai-assistent-koppelen).

### AI › Palvelin

- **Käynnistä silta** ja **Pysäytä silta** — käynnistää tai pysäyttää MCP-sillan. Sen vieressä on tila: *Pois*, *Käynnissä portissa …*, *Portti … on varattu* (syy näkyy) tai *Virhe*. Verkkoversiossa painikkeet ovat pois käytöstä, ja ohjeteksti sanoo *Silta toimii vain työpöytäsovelluksessa.* Sama tila näkyy pisteenä, jonka vieressä on *AI*, tilarivillä.

### AI › Yhteys

- **Portti** — sillan portti. Oletus: 3877. Voi muuttaa vain, kun tila on *Pois* (ohjeteksti *Voi muuttaa vain, kun palvelin on pysäytetty.*).
- **Token** — sillan salasana, joka on oletuksena piilotettu. Pienet painikkeet *Näytä token*/*Piilota token*, *Kopioi* ja *Luo uusi token*. *Luo uusi token* kysyy ensin vahvistuksen, koska uusi token katkaisee kaikki nykyiset yhteydet. Jos silta on käynnissä, se käynnistyy uudelleen uudella tokenilla.
- **Yhdistä** — näyttää yhteystiedot: päätepisteen, tokenin, asetusotteen ja yhteyskehotteen, joka liitetään tekoälyagenttiin.

### AI › Turvallisuus

- **Keskeytä** / **Jatka** — hylkää tilapäisesti kaikki tekoälyn muutokset. Lukeminen on sallittu, ja silta pysyy käynnissä. Painike syttyy punaisena, kun keskeytys on päällä.
- **Vain luku** — hylkää kaikki muuttavat työkalut, kun tämä on päällä.
- **Automaattinen varmuuskopio: päällä** / **Automaattinen varmuuskopio: pois** — kirjoittaa IFC-varmuuskopion automaattisesti ennen ensimmäistä tekoälymuutosta kussakin asiakirjassa. Oletus: päällä.
- **Varmuuskopioi nyt** — kirjoittaa varmuuskopion heti ja näyttää tiedoston nimen. Vain työpöytäsovellus.
- **Avaa varmuuskopiokansio** — avaa kansion, jossa varmuuskopiot ovat. Vain työpöytäsovellus.

### AI › Toiminta

- **Toimintapaneeli** — näyttää tai piilottaa paneelin *AI-toiminta*, jossa ovat kutsut sillalle niiden argumentteineen ja vastauksineen.
