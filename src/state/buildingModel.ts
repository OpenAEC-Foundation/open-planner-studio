// Heeft dit document een gebouwmodel (#804, review van #1002)? De enige plek voor die vraag bij de download na een
// geweigerde schrijftoestemming (knownbug 1768) en de zin na een export naar een ander formaat (knownbug 1740). Vreemde
// inhoud is niet genoeg: een planning met alleen een eigenschappenset van een ander programma heeft geen gebouwmodel en
// doet daar wat main doet. De uitkomst komt van de bestaande modelherkenning (`scanTargetBytes`, dezelfde typen als de
// modelweigering bij openen en de doelbescherming), in de scanworker. De bronbytes veranderen nooit, dus het antwoord
// geldt zolang de bron hetzelfde object is.
import { hasForeignContent, type IfcSource } from '@/services/ifc/foreign/ifcSource';
import { scanTargetModelBytesAsync } from '@/services/ifc/foreign/targetForeignScan';
import { ifcForeignContentEnabled, type FeatureFlagValues } from '@/utils/featureFlags';

const answers = new WeakMap<IfcSource, Promise<boolean>>();

/** Met de flag uit of zonder vreemde inhoud: nee, zonder scan. Een fout van de scan telt als nee (de gewone route). */
export function documentHasBuildingModel(s: {
  readonly ifcSource: IfcSource | null;
  readonly ui: { readonly featureFlags: Readonly<FeatureFlagValues> };
}): Promise<boolean> {
  const source = s.ifcSource;
  if (!source || !hasForeignContent(source) || !ifcForeignContentEnabled(s.ui.featureFlags)) return Promise.resolve(false);
  let answer = answers.get(source);
  if (!answer) {
    answer = scanTargetModelBytesAsync(source.bytes).then(result => result === 'model', () => {
      answers.delete(source);
      return false;
    });
    answers.set(source, answer);
  }
  return answer;
}
