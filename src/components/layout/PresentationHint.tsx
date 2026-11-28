import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
      className="!text-large"
      style={{
        position: 'fixed',
        bottom: 18,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '6px 14px',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(0,0,0,0.72)',
        color: '#fff',
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
