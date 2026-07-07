# Snel starten

**PLACEHOLDER-INHOUD (golf 1).** Dit artikel bestaat alleen om de help-viewer end-to-end te
testen — koppen, opmaak, lijsten, links en een afbeelding — vóórdat de echte quick-start-gids in
een latere golf wordt geschreven. Negeer de inhoud hieronder als planning-instructie.

Deze pagina toont *alle* ondersteunde opmaakvormen van de mini-markdown-parser in één oogopslag,
zodat het renderpad aantoonbaar werkt: **vetgedrukte tekst**, *cursieve tekst*, inline code zoals
`runCPM()`, codeblokken, geordende en ongeordende lijsten, een interne link en een
voorbeeld-link.

## Opmaakvoorbeelden

Een gewone paragraaf met wat **vet**, wat *cursief*, en een stukje `inline code` er middenin.
Meerdere paragrafen worden gescheiden door een lege regel, precies zoals in gewone markdown.

Dit is de tweede paragraaf van dezelfde sectie, puur om te bevestigen dat paragraaf-scheiding
werkt.

### Codeblok

```
function voorbeeld() {
  return "dit is een codeblok — wordt letterlijk weergegeven, zonder opmaak-parsing";
}
```

### Ongeordende lijst

- Eerste punt
- Tweede punt met **vet** erin
- Derde punt met `inline code` erin

### Geordende lijst

1. Open het menu Bestand
2. Kies Voorbeelden
3. Klik op een voorbeeldproject om te openen

## Verwijzingen

Lees ook de gids [Plannen & WBS](docs://gids-plannen-wbs) — dit is een interne `docs://`-link
die binnen de viewer navigeert, niet naar een externe pagina.

Volg de stappen hierboven mee in een echt project: open het voorbeeld
[Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) — dit
is een `examples://`-link die hetzelfde openpad gebruikt als Bestand → Voorbeelden.

![Schermafbeelding: Gantt-diagram met berekende planning (PLACEHOLDER, wordt in golf 2+ een echte
screenshot)](screenshots/placeholder-gantt.png)
