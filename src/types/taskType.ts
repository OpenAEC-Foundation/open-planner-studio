/** Een door de gebruiker benoemd taaktype. De id is de stabiele referentie die taken en
 * IFC-metadata gebruiken; de naam mag later zonder identiteitsbreuk veranderen. */
export interface CustomTaskType {
  id: string;
  name: string;
}
