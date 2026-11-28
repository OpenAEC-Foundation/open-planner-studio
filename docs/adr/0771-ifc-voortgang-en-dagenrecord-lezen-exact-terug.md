# Voortgang en het dagenrecord in IFC lezen exact terug, niet afgerond

Twee getallen in het IFC-bestand zien eruit alsof ze afgerond mogen worden, maar een afronding verandert de planning
na opslaan en heropenen. Daarom schrijft de writer ze zo dat ze exact terugkomen.

## Gevolgen

- `IfcTaskTime.Completion` gaat met twee decimalen als dat exact terugleest (hele procenten), anders in de kortste
  vorm die exact terugleest (`ifcCompletionReal` in `ifcTaskSlots.ts`, via `stepReal`). Afronden op twee decimalen
  maakt van 0,955 of meer `1.0`, en dat zet de taak in de voltooid-tak van de solver; de restduurregel
  (`runningDurationChange`) geeft bovendien percentages als 4/12 die exact moeten terugkomen. Een vaste notatie met
  veel decimalen rondt een kleine positieve waarde naar nul af. Een voortgang van 0 wordt `$`, omdat het schema
  `Completion > 0` eist.
- Het record `[dagen, minuten]` van een gebroken dag (`recordDayValue` in `dayMeasureIo.ts`) draagt de dagen op zes
  decimalen alleen als die dezelfde minuten geven als de bronwaarde; anders de bronwaarde zelf. Bij 5/6 dag op een
  werkdag van 465 minuten geeft de bron 388 minuten en 0,833333 dag 387: met die afronding wijst de leesregel het
  eigen record af en schrijft een tweede export 387.
