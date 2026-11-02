/**
 * Het project-ID dat een OPS-export zelf maakt als het project geen eigen P6 Project-ID heeft:
 * `OPS:` + het interne project-id (`p6ProjectIdentity` in `services/p6/p6xmlWriter.ts`, ook gebruikt
 * door de XER-schrijver). Een lezer bewaart zo'n ID niet als code van de gebruiker. Een eigen,
 * afhankelijkheidsloze module: zowel de P6-schrijver als `xerDocumentName.ts` gebruiken hem, en een
 * import van de schrijver in `utils/` zou een kringverwijzing geven.
 */
export const OPS_INTERNAL_PROJECT_ID_PREFIX = 'OPS:';

/** Een project-Id dat de OPS-writer zelf maakte (geen code van de gebruiker). */
export function isOpsInternalProjectId(id: string): boolean {
  return id.startsWith(OPS_INTERNAL_PROJECT_ID_PREFIX);
}
