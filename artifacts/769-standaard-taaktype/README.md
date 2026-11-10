# Standaardtaaktype in Projectinstellingen

`projectinstellingen.png` komt uit de echte browserhandeling in
`tests/browser/work-rule.spec.ts`: Projectinstellingen openen, de vier opties
bekijken en **Fixed work** kiezen. De keuze is op dit beeld nog niet toegepast.
Het beeld toont de Engelse interface, inclusief de uitleg over taken die de
projectstandaard volgen en taken met een eigen type.

Herkomst: [CI-run 42402896213](https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/42402896213),
commit `f90807f09731075cb55ee529fc168125cc08f776`, bijlage
`standaardtaaktype-in-projectinstellingen`. Die run faalde later doordat de test
de Nederlandse tabnaam Start zocht in de Engelse interface. De test gebruikt nu
ook Home. De applicatiecode op het beeld is gelijk aan die van de daaropvolgende
[groene browserrun 42405498277](https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/42405498277)
op `66c5dccb715a67ffd28b6e52d902dde0a049efa8`; alle vier browserdelen slaagden.

De afbeelding is niet bewerkt.
