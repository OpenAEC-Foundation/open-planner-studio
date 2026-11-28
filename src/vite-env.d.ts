/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __OPS_DEV_INSTANCE__: string;

interface ImportMetaEnv {
  readonly VITE_OPS_PLATFORM?: string;
}
