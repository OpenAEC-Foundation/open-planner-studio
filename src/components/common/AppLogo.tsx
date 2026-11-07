/**
 * Het goedgekeurde Open Planner Studio-logo (docs/branding/README.md). Eén plek voor alle
 * app-eigen logo's in de interface, zodat de bestanden uit `scripts/generate-approved-icons.py`
 * het enige beeld zijn. Niet voor documentlogo's of het bedrijfslogo van de gebruiker.
 */
export function AppLogo({ size, className }: { size: number; className?: string }) {
  const base = import.meta.env.BASE_URL;
  // Kleine weergave: 32 px met 64 px voor scherpe schermen. Groter: 64 px met 128 px.
  const [x1, x2] = size <= 32 ? ['icon.png', 'icon-64.png'] : ['icon-64.png', 'icon-128.png'];
  return (
    <img
      src={`${base}${x1}`}
      srcSet={`${base}${x1} 1x, ${base}${x2} 2x`}
      width={size}
      height={size}
      className={className}
      alt="Open Planner Studio"
      draggable={false}
    />
  );
}
