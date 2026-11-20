# De projectstart begrenst taken met voorganger, niet het eigen anker van een wortel

Een taak zonder voorganger start op haar eigen geplande start (`ownAnchor`), ook als die vóór de ingestelde
projectstartdatum ligt: een ingelezen anker wordt nooit door de vloer overruled. Zo meet MS Project het, en de
minuutgetrouwheid tegen het corpus eist dat het eigen anker wint. Voor taken mét voorganger en voor hammocks is de
projectstart wel een ondergrens, en niet alleen tegen een lead: ook een gewone FS- of FF-relatie zonder lag uit een
vroege wortel wordt gevloerd. Zo loopt een verouderde `scheduleStart` (van vóór een wijziging van de
projectstartdatum) niet stil vóór het projectbegin door. Relatiegrenzen zijn ondergrenzen ("niet eerder dan"),
dus een niet-bindende FF of SF laat de opvolger gewoon op de vloer staan.

## Gevolgen

- De vloer (`forwardProjectStart`) is het minimum over alle wortels van `rootFloor`: het maximum van de gesnapte
  eigen start en de ingestelde projectstart. Hij wordt vooraf bepaald, zodat de topologische volgorde de uitkomst
  niet raakt. Zonder bruikbare projectstartdatum is de vloer het minimum van de wortels onderling.
- De ingestelde projectstart blijft ongesnapt bewaard (`projectStartRaw`); elke taak snapt hem in haar eigen
  kalender. Een taak met een afwijkende werkweek kan de vloer dus op een andere dag krijgen dan de projectkalender.
  Een datum zonder tijd wordt eerst het dagbegin van de projectklok.
- Een kalendertijdtaak als wortel draagt haar rauwe anker bij aan de vloer. Een gesnapt zaterdaganker zou de vloer
  naar maandag duwen en via de vloer andere taken dichttrekken. De vergelijking met de ingestelde projectstart blijft
  gesnapt: een opgelegde grens is geen relatie-afgeleid moment.
- Een nulduurmijlpaal op een kalender zonder eigen werkblokken draagt het dagbegin van haar ankerdag bij aan de
  vloer. Haar eigen moment is een eindmoment (D7 in het ontwerp "alleen uren"); dat normaliseren zou alle opvolgers
  een werkdag opschuiven.
- Een nulduurmijlpaal met een anker mét tijd houdt dat anker, behalve op een vrije dag van een kalender zonder eigen
  werkblokken bij een taak in dagen: daar is het anker een genormaliseerd daganker (D4), geen ingevoerd uuranker,
  en het snapt.
- Een harde MSO/MFO-pin wint ook bij een wortel.
- Een lead telt als afgekapt (`truncatedLeadSequenceIds`) alleen als ook de strengste relatiegrens de taak nog vóór
  de projectstart wilde trekken, en dan voor elke relatie met een negatieve lag (in dezelfde lagresolutie als de
  relatiewiskunde, ook een lag die alleen in minuten bestaat) waarvan de grens op dezelfde kalenderdag valt als die
  strengste grens. De vergelijking is op dag (`formatDate`), niet op moment.
- `snapWorkInstantOnOrAfter` is de ene snapregel voor het anker, gedeeld met `projectStartAnchorClamp.ts`. Een kale
  datum zonder kalendersnap landt in een urenkalender op middernacht in plaats van op het eerste werkblok.
