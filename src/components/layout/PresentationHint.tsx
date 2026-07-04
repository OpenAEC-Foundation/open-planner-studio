import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Kleine "F11 om te sluiten"-hint (fase 2.7, §9.3) die een paar seconden zichtbaar is bij het
 * betreden van presentation mode en daarna vervaagt (CSS-transitie op opacity). Puur decoratief —
 * geen interactie, `pointer-events: none` zodat hij nooit de Gantt-input blokkeert.
 */
export function PresentationHint() {
  const { t } = useTranslation('common');
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      aria-hidden={!visible}
      style={{
        position: 'fixed',
        bottom: 18,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '6px 14px',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(0,0,0,0.72)',
        color: '#fff',
        fontSize: 12,
        pointerEvents: 'none',
        zIndex: 10000,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.8s ease',
      }}
    >
      {t('view.presentation.hint')}
    </div>
  );
}
