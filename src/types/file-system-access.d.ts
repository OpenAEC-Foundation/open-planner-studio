// Ambient File System Access API-typen (spec §8).
//
// TypeScript 5.9.3's lib.dom.d.ts kent FileSystemHandle / FileSystemFileHandle /
// FileSystemWritableFileStream al, maar NIET:
//   - Window.showOpenFilePicker / showSaveFilePicker
//   - FileSystemHandle.queryPermission / requestPermission
//   - de picker-optietypes
// Zonder deze augmentatie faalt `npm run build`. We voegen uitsluitend de gebruikte
// leden toe; @types/wicg-file-system-access wordt bewust NIET als dependency gekozen
// (dep-lijst schoon houden). Geen `import`/`export` in dit bestand → globale merge.

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
}

// Permissie-descriptor voor de FSA-permissie-API (Chromium-only, optioneel).
interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

// Augmenteer de bestaande lib.dom-interface (merge, geen herdeclaratie van kind/name/isSameEntry).
interface FileSystemHandle {
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface Window {
  showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}
