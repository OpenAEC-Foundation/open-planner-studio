import { ifcForeignContentEnabled, type FeatureFlagValues } from '@/utils/featureFlags';
import type { DocumentFileFormat } from './documentContract';

export function versionGuarded(featureFlags: Readonly<FeatureFlagValues>, format: DocumentFileFormat): boolean {
  return format === 'ifcx' || ifcForeignContentEnabled(featureFlags);
}
