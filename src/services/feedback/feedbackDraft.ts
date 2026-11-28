export interface AnnotationPoint { x: number; y: number; }

export interface AnnotationArrow { kind: 'arrow'; from: AnnotationPoint; to: AnnotationPoint; color: string; }
export interface AnnotationRect  { kind: 'rect';  from: AnnotationPoint; to: AnnotationPoint; color: string; }
export interface AnnotationMask  { kind: 'mask';  from: AnnotationPoint; to: AnnotationPoint; }
export interface AnnotationPen   { kind: 'pen';   points: AnnotationPoint[]; color: string; }
export interface AnnotationText  { kind: 'text';  pos: AnnotationPoint; text: string; color: string; }

export type AnnotationShape = AnnotationArrow | AnnotationRect | AnnotationMask | AnnotationPen | AnnotationText;

export type FeedbackType = 'bug' | 'feature' | 'general';

export interface FeedbackDraft {
  type: FeedbackType;
  title: string;
  description: string;
  email: string;
  attachScreenshot: boolean;
  hadUncertain: boolean;
  screenshotDataUrl: string | null;
  annotatedDataUrl: string | null;
  shapes: AnnotationShape[];
}
