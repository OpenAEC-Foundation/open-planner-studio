/**
 * De markering rond een anker, gedeeld door de rondleiding (`TourOverlay`) en het
 * begeleidingspaneel van extensies (`GuidePanel`).
 *
 * Eén klein element ter grootte van het anker met een `box-shadow`-truc (`0 0 0 9999px …`) die de
 * rest van het scherm dimt, plus een accentrand. Puur visueel en `pointer-events: none`: box-shadow
 * buiten de elementgrenzen telt niet mee voor hit-testing, dus klikken gaan gewoon naar de UI eronder.
 * Of de laag modaal is, bepaalt de aanroeper (de rondleiding legt er een eigen klik-onderscheppende
 * laag onder; de begeleiding bewust niet — de gebruiker moet het aangewezen element kunnen gebruiken).
 */
export function TourSpotlight({ rect, dimOpacity, zIndex }: {
  rect: DOMRect;
  /** Dekking van de dimlaag buiten het anker (0 = geen dim). */
  dimOpacity: number;
  zIndex: number;
}) {
  return (
    <div
      aria-hidden
      data-ops-tour-spotlight
      style={{
        position: 'fixed',
        left: rect.left - 6,
        top: rect.top - 6,
        width: rect.width + 12,
        height: rect.height + 12,
        borderRadius: 10,
        boxShadow: `0 0 0 9999px rgba(0,0,0,${dimOpacity}), 0 0 0 2px var(--accent, #D97706)`,
        pointerEvents: 'none',
        zIndex,
        transition: 'left 0.15s ease, top 0.15s ease, width 0.15s ease, height 0.15s ease',
      }}
    />
  );
}
