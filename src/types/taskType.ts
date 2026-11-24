/** Een door de gebruiker benoemd taaktype. De id is de stabiele referentie die taken en
 * IFC-metadata gebruiken; de naam mag later zonder identiteitsbreuk veranderen. De kleur krijgt het
 * type één keer (`withTaskTypeColors`) en houdt het daarna, ook in een ander document (#856). */
export interface CustomTaskType {
  id: string;
  name: string;
  /** `#RRGGBB`, de balkkleur bij kleuren per werkcategorie. */
  color: string;
}

/** Een taaktype zoals het van buiten binnenkomt (bestand, import, MCP, extensie): misschien zonder kleur. */
export type CustomTaskTypeDraft = Omit<CustomTaskType, 'color'> & { color?: string };
