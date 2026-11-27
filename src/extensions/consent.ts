export type ConsentSource = 'catalog' | 'zip' | 'js';

export type ConsentVerification =
  | 'checksum'
  | 'unverified'
  | 'local';

export interface ExtensionConsentRequest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  declared: string[];
  repository?: string;
  source: ConsentSource;
  verification: ConsentVerification;
  isDesktop: boolean;
}

export type ConsentAsker = (request: ExtensionConsentRequest) => Promise<boolean>;

const weigerAlles: ConsentAsker = () => Promise.resolve(false);

let asker: ConsentAsker = weigerAlles;

export function setConsentAsker(fn: ConsentAsker): void {
  asker = fn;
}

export function resetConsentAsker(): void {
  asker = weigerAlles;
}

export async function askExtensionConsent(request: ExtensionConsentRequest): Promise<boolean> {
  try {
    return await asker(request);
  } catch {
    return false;
  }
}
