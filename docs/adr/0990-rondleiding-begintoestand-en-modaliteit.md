# Rondleiding: begintoestand in de store, modaal via een eigen laag

De rondleiding (`TourOverlay` in `src/components/tour/`) zet voor haar stappen UI-velden om (lint-tab, Backstage,
histogram, rechterkolom, eigenschappenpaneel) en zet ze bij elke sluitroute terug naar de stand van vóór de start.
Die begintoestand staat in de store (`ui.tourSnapshot`), niet in component-state of een ref: in presentatiemodus
rendert `App.tsx` een andere boom zonder `TourOverlay`, dus de overlay verdwijnt en komt terug, en lokale state
overleeft dat niet. Het effect dat haar vastlegt, doet niets als `ui.tourSnapshot` al gezet is; anders zou de
terugkomst de door de rondleiding veranderde stand als begin vastleggen.

## Gevolgen

- De rondleiding is modaal door een aparte onzichtbare laag over de hele pagina, los van de markering
  (`TourSpotlight`, `pointer-events: none`). De dimming is een `box-shadow` rond een element ter grootte van het
  anker, en die schaduw vangt geen klikken (uit het weggehaalde commentaar, niet nagegaan). De laag heeft bewust
  geen `onClick`: een klik naast de kaart sluit de rondleiding niet per ongeluk.
