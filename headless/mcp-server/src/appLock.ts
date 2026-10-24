// Slot-haak: staat dit bestand open in de desktop-app? (ontwerp "één plugin, drie situaties", #570)
//
// Draait de app met de MCP-koppeling uit, dan werkt de headless server op bestanden, maar mag hij geen
// bestand lezen of schrijven dat de gebruiker in de app open heeft: twee schrijvers op één IFC-bestand
// verliezen elkaars werk. De app gaat daarvoor een register van open bestanden bijhouden
// (`<appDataDir>/mcp/open-files.json`, apart werk). Tot dat register er is, staat er nooit iets open:
// deze functie geeft altijd `false`. `nodeFs.ts` roept hem aan vóór elke bestandsoperatie.

/** Krijgt het `realpath` van het bestand (of van wat er zou komen te staan). */
export type IsPathOpenInApp = (path: string) => Promise<boolean>;

/** Nu: geen register, dus nooit open. */
export const isPathOpenInApp: IsPathOpenInApp = async () => false;
