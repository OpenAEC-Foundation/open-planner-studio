# Plannen & WBS

**PLACEHOLDER-INHOUD (golf 1).** Ook dit artikel is een testartikel voor de help-viewer, geen
echte gids. De echte inhoud (WBS-hiërarchie, samenvattende taken, mijlpaal-soorten) komt in golf 3
(cluster A van laag 2, zie het bindend ontwerp).

## Wat komt hier straks te staan

Deze gids beschrijft normaal gesproken hoe je een taakstructuur opbouwt: fasering,
**samenvattende taken**, en de drie mijlpaal-soorten (start/finish/interim). Voor nu bevat de
pagina alleen representatieve opmaak om de tweede kant van de viewer te toetsen — met name de
navigatie tussen twee artikelen.

### Kernbegrippen (placeholder)

- WBS-code — hiërarchisch nummer per taak
- Indent/outdent — een taak dieper of ondieper in de boom zetten
- Mijlpaal — een taak zonder duur die een moment markeert

### Stappen (placeholder)

1. Maak de hoofdfasen aan als samenvattende taken
2. Voeg per fase de onderliggende taken toe met `indentTasks()`
3. Markeer op-/opleverpunten als mijlpaal

Een korte alinea met *cursieve* nadruk en een stukje `inline code` (`outdentTasks()`), gevolgd
door een codeblok ter illustratie:

```
outdentTasks(["task-1", "task-2"]);
```

## Verwijzingen

Terug naar [Snel starten](docs://quick-start) om de hele keten (manifest → fetch → render →
interne link) in beide richtingen te bevestigen.

Zie deze structuur in de praktijk in het voorbeeld
[Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc).

![Schermafbeelding: WBS-boomstructuur in de taaktabel (PLACEHOLDER, wordt in golf 3 een echte
screenshot)](screenshots/placeholder-wbs.png)
