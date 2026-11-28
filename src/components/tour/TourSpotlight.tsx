export function TourSpotlight({ rect, dimOpacity, zIndex }: {
  rect: DOMRect;
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
