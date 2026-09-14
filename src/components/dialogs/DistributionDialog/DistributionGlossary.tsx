// De begrippenlijst van de verdeeldialoog (eigenaarsvraag 2026-09-14: "wat wordt er bedoeld met
// 'taken passen niet'?").
//
// WAAROM UITKLAPBAAR EN NIET ALTIJD ZICHTBAAR. De dialoog is bedieningsoppervlak: balken, greep,
// pin. Negen definities permanent tussen de legenda en het histogram duwen precies dát oppervlak
// weg. Uitgeklapt is het een gebruikershandeling en mag de hoogte dus veranderen — spec §7 verbiedt
// alleen dat een REKENtoestand (bezig, stale, gedegradeerd, tekort) de maat verspringt, want dan
// beweegt de balk onder de muis tijdens het slepen.
//
// ALLEEN NIET-VANZELFSPREKENDE TERMEN. Gewone app-begrippen (resource, capaciteit, project,
// bibliotheek) staan er bewust NIET in: wie die niet kent, heeft aan deze dialoog sowieso niets.
// Wat er wél in staat is het vocabulaire dat alléén hier voorkomt en dat je nergens anders in het
// programma tegenkomt — speling, plafond, benut, vaste last, pauzedag, "past niet", de
// einddatum-verschuiving, vastzetten en het besparingsprijskaartje.
//
// LOKALE STATE, GEEN STOREVELD. Of de lijst open staat is geen documentdata en geen instelling;
// het hoort niet in `ui.levelingDistribution` (die state wordt gefingerprint voor het
// herrekenen — een uitgeklapte lijst zou dan een rekenronde uitlokken).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';

/** De termen in leesvolgorde van de dialoog: eerst wat er op een balk staat (speling → plafond →
 *  benut), dan wat er omheen speelt (vaste last, pauzedag, tekort), dan de uitkomst en de knoppen. */
const TERMS = [
  'slack',
  'ceiling',
  'used',
  'fixedLoad',
  'pauseDay',
  'shortfall',
  'endShift',
  'pin',
  'savings',
] as const;

export function DistributionGlossary() {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-[10px] text-text-secondary hover:text-text-primary"
        data-ops-distribution-glossary-toggle
      >
        <ChevronRight
          size={11}
          className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          aria-hidden
        />
        {t('resource.distribution.glossary.toggle')}
      </button>

      {open && (
        <dl
          className="mt-1 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 text-[10px] leading-snug"
          data-ops-distribution-glossary
        >
          {TERMS.map(key => (
            <div key={key} className="contents">
              <dt className="font-medium text-text-primary">
                {t(`resource.distribution.glossary.${key}.term`)}
              </dt>
              <dd className="text-text-secondary min-w-0">
                {t(`resource.distribution.glossary.${key}.text`)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
