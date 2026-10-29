/**
 * Typen voor het bewaarde feedbackconcept en de annotatievormen.
 *
 * Het concept leeft alleen in UI-state (`ui.feedbackDraft`, sessie): niet in het document, niet in
 * localStorage. Zo blijft wat de gebruiker schreef staan als hij het venster sluit en later
 * terugkomt; na een geslaagde verzending of *Leegmaken* is het weg.
 */

export interface AnnotationPoint { x: number; y: number; }

export interface AnnotationArrow { kind: 'arrow'; from: AnnotationPoint; to: AnnotationPoint; color: string; }
export interface AnnotationRect  { kind: 'rect';  from: AnnotationPoint; to: AnnotationPoint; color: string; }
/** Afdekken: een dicht, ondoorzichtig vlak. Na het flatten zijn de pixels eronder weg. */
export interface AnnotationMask  { kind: 'mask';  from: AnnotationPoint; to: AnnotationPoint; }
export interface AnnotationPen   { kind: 'pen';   points: AnnotationPoint[]; color: string; }
export interface AnnotationText  { kind: 'text';  pos: AnnotationPoint; text: string; color: string; }

export type AnnotationShape = AnnotationArrow | AnnotationRect | AnnotationMask | AnnotationPen | AnnotationText;

/** Soort melding; gelijk aan de `category` die de server krijgt. */
export type FeedbackType = 'bug' | 'feature' | 'general';

export interface FeedbackDraft {
  type: FeedbackType;
  title: string;
  description: string;
  email: string;
  attachScreenshot: boolean;
  /** Er is een onopgeloste onzekere poging (`uncertain`): dan nooit *Open op GitHub*. Weg na succes,
   *  na "al binnen" en na *Leegmaken*. */
  hadUncertain: boolean;
  /** Het rauwe screenshot (zonder annotaties), of null. */
  screenshotDataUrl: string | null;
  /** Screenshot + annotaties geflattend, of null zolang er niet geannoteerd is. */
  annotatedDataUrl: string | null;
  /** De vormen, zodat de gebruiker bij heropenen verder kan annoteren. */
  shapes: AnnotationShape[];
}
