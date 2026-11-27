export interface CjkFontProvider {
  id: string;
  covers(codepoint: number): boolean;
  getRegularBytes(): Promise<Uint8Array>;
  getBoldBytes?(): Promise<Uint8Array>;
}

const providers = new Map<string, CjkFontProvider>();

export function registerCjkFontProvider(provider: CjkFontProvider): () => void {
  providers.set(provider.id, provider);
  return () => {
    if (providers.get(provider.id) === provider) providers.delete(provider.id);
  };
}

export function getCjkFontProviders(): CjkFontProvider[] {
  return [...providers.values()];
}

export function clearCjkFontProviders(): void {
  providers.clear();
}
