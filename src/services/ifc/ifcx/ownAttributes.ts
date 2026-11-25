import { enumOf, ISO_MOMENT, objectOf, TEXT, VERSION_TEXT, type IfcxValue } from './fieldTable';
import { isIdentityPath } from './identityPath';
import { IFCX_VERSION, OWN_HEADER_ID_PREFIX } from './profile';

export const HEADER_VALUE: IfcxValue = objectOf({
  id: {
    value: {
      dataType: 'String',
      form: {
        name: `${OWN_HEADER_ID_PREFIX}<pad van het project>`,
        pattern: /^urn:openaec:planner:\S+$/,
        accepts: value => isIdentityPath(value.slice(OWN_HEADER_ID_PREFIX.length)),
      },
    },
  },
  ifcxVersion: { value: enumOf([IFCX_VERSION]) },
  dataVersion: { value: VERSION_TEXT },
  author: { value: TEXT },
  timestamp: { value: ISO_MOMENT },
});
