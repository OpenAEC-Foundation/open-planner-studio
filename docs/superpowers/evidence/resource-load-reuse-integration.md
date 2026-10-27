# Resourcebelasting na de main-integratie

De oude dagen-cache uit #646 is vervallen. `ResourceLoad.ts` is bytegelijk aan de
geïntegreerde main: `assignmentDaily`, `taskPlacementCache`, de maatconventie,
contourverdeling en histogrambegrenzing blijven de huidige productiecode. Main
deelt de plaatsing al per taak. Deze PR bevat daardoor geen nieuwe productoptimalisatie.

De regressie gebruikt alle zes argumenten van `computeResourceLoad`, inclusief de
effectieve `schedulingOptions`; de histogramfixture draagt dezelfde opties. Een
expliciete urentaak van acht uur vanaf maandag 11:00 op blokken 07:00–15:00 moet
0,5 op maandag en 0,5 op dinsdag boeken. Volledige belasting en histogrammen worden
ook vergeleken met afzonderlijke taakvoorkomens per toewijzing. De schaalpoort telt
`effectiveBandsOn`, de kalenderroute die de huidige plaatsing daadwerkelijk gebruikt.

De workflow krijgt de actuele basis expliciet uit het PR-event. De broncontrole
eist geen productdiff en gelijke dependencies. De basis moet de regressie eveneens
doorstaan; een verwachte rode oude dagenroute hoort niet meer bij deze vergelijking.
De tijden zijn controles van dezelfde huidige code, geen nieuwe snelheidsclaim.
CI moet de geïntegreerde head en de gewone volledige poort bevestigen.
