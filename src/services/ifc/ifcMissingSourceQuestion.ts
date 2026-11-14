// Alleen Opslaan als stelt deze vraag. Zonder UI of expliciet antwoord wordt niets geschreven.
export type IfcMissingSourceAsker = () => Promise<boolean>;
const cancel: IfcMissingSourceAsker = () => Promise.resolve(false);
let asker = cancel;

export function setIfcMissingSourceAsker(fn: IfcMissingSourceAsker): void { asker = fn; }
export function resetIfcMissingSourceAsker(): void { asker = cancel; }
export function askIfcMissingSourceSaveAs(): Promise<boolean> { return asker(); }
