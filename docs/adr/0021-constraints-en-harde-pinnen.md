# Een harde MSO/MFO-pin is een barrière, een zachte constraint een grens

Een harde MSO- of MFO-pin zet de vroege en de late datums onvoorwaardelijk op de pin: ES = LS en EF = LF, totale
speling 0. Voorwaarts overschrijft de pin de druk van de voorgangers, achterwaarts de druk van de opvolgers, en een
strengere late constraint verder stroomafwaarts geeft zijn negatieve speling niet door de pin heen. Dat is de
barrière van P6. Zonder pin stapelen de primaire en de secundaire constraint: SNET, FNET, MSO en MFO als
ondergrenzen voorwaarts; SNLT, FNLT, MSO, MFO en de deadline als bovengrenzen achterwaarts. De vroege datums
bewegen daar nooit door; een overschrijding wordt negatieve speling.

## Gevolgen

- Een pin breekt de logica als de druk van de voorgangers later valt dan de pin. Dat wordt gemeld
  (`violatedConstraintTaskIds`), één keer per taak, ook als voorwaarts en achterwaarts allebei een schending vinden.
  Een externe voorganger na de pin of een externe opvolger vóór de pin is dezelfde schending. Elke koppeling wordt
  doorgerekend, ook na een eerste schending, omdat de berekening ook de melding van de lagkalender registreert en
  die niet van de volgorde mag afhangen.
- Uitzondering, bewust smal en alleen voor berekende interne voorgangerdruk: heeft een taak met MSO een werkelijke
  start, of met MFO een werkelijke finish, die na een snap vooruit in de eigen kalender op dezelfde kalenderdag valt
  als de pin (de vergelijking is op dag, niet op moment, `hardPinRespectedByActual`), dan is een later berekende
  voorgangerdruk (bijvoorbeeld een niet-afgemelde startmijlpaal die de statusdatumvloer omhoog schoof) geen
  schending. Een extern anker is een vaste datum van de bron, dus daar geldt de uitzondering niet.
- De harde finishpin wint van de SF-finishvloer. Anders duwt die vloer EF voorbij de pin terwijl LF op de pin blijft,
  met negatieve speling als gevolg (`msp-36`).
- Een constraintdatum zonder tijd is dag-verankerd: een startachtige constraint snapt naar het eerste werkmoment van
  die dag, een FNET, FNLT of MFO zonder tijd begrenst het laatste werkblok van die dag (D2). Een datum met tijd
  wordt tot op de minuut gevolgd.
- Een nulduurmijlpaal met een constraint mét tijd snapt voorwaarts niet: in MS Project houdt een wortelmijlpaal met
  SNET 07:15 op een blok van 08:00 haar 07:15. Een constraint zonder tijd snapt wel
  (`rr-fs-pred-startms` in `cases-hours-relations.json`). Die vrijstelling staat in de SNET/MSO- en FNET/MFO-tak,
  omdat een FNLT voorwaarts geen effect heeft en anders de mijlpaal naar de deadline zou duwen
  (`z19-milestone-fnlt-no-forward-push` in `cases-hours.json`).
- Een MSO of MFO op een nulduurmijlpaal legt één moment vast: de vroege grens. De late grens, de schendingstoets,
  B6 en de her-snap gebruiken dat moment, anders valt een grens op een blokbegin aan de late kant terug naar het
  vorige dageinde. Een SNLT op een nulduurmijlpaal krijgt aan de late kant hetzelfde moment als een SNET op die
  datum. Onder A20 (`p6PreserveZeroDurationConstraintInstants`) blijft een constraint met tijd op een nulduurmijlpaal
  ook aan de late kant exact.
- Een late startgrens (SNLT, MSO) op een blokbegin hoort bij die werkdag; de solver snapt hem daarom eerst vooruit
  voordat hij de duur optelt, behalve bij een kalendertijdtaak of een nulduurmijlpaal.
