export function AppLogo({ size, className }: { size: number; className?: string }) {
  const base = import.meta.env.BASE_URL;
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
