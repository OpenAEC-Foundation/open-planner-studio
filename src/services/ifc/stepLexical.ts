/** Gedeelde lexicale grenzen van STEP, voor tekst en een stroom bytes. */
export const enum StepStringState { Text, Quote, Back, BackS, Shift, End }
export const isStepControl = (c: number): boolean => c < 0x20 || c === 0x7f;

/** Eén teken ná de openingsquote. End: dit teken hoort alweer bij de code buiten de string.
 * De regels komen uit de bestandsgrammatica: '' en \\ zijn ontsnapt; \S\ verbruikt één teken,
 * ook een apostrof. Onbekende backslashes blijven letterlijk voor oude eigen JSON-velden.
 */
export function stepString(state: StepStringState, c: number, literal = false): StepStringState {
  if (literal) return state === StepStringState.Quote
    ? (c === 0x27 ? StepStringState.Text : StepStringState.End)
    : (c === 0x27 ? StepStringState.Quote : StepStringState.Text);
  if (isStepControl(c)) return state;
  switch (state) {
    case StepStringState.Text:
      return c === 0x27 ? StepStringState.Quote : c === 0x5c ? StepStringState.Back : state;
    case StepStringState.Quote:
      return c === 0x27 ? StepStringState.Text : StepStringState.End;
    case StepStringState.Back:
      if (c === 0x5c) return StepStringState.Text;
      if (c === 0x53) return StepStringState.BackS;
      return stepString(StepStringState.Text, c);
    case StepStringState.BackS:
      return c === 0x5c ? StepStringState.Shift : stepString(StepStringState.Text, c);
    case StepStringState.Shift:
      return StepStringState.Text;
    case StepStringState.End:
      return state;
  }
}

/** Index van de sluitquote, of -1 bij een ongesloten literal. */
export function stepStringEnd(text: string, at: number, literal = false): number {
  let state = StepStringState.Text;
  let quote = -1;
  for (let i = at + 1; i < text.length; i++) {
    const next = stepString(state, text.charCodeAt(i), literal);
    if (next === StepStringState.End) return quote;
    if (state !== StepStringState.Quote && next === StepStringState.Quote) quote = i;
    state = next;
  }
  return state === StepStringState.Quote ? quote : -1;
}

/** Na commentaar; -1 als hier geen commentaar begint. Stuurtekens splitsen de markeringen niet. */
export function skipStepComment(text: string, at: number): number {
  if (text.charCodeAt(at) !== 0x2f) return -1;
  let star = at + 1;
  while (isStepControl(text.charCodeAt(star))) star++;
  if (text.charCodeAt(star) !== 0x2a) return -1;
  for (let i = star + 1; i < text.length; i++) {
    if (text.charCodeAt(i) !== 0x2a) continue;
    let slash = i + 1;
    while (isStepControl(text.charCodeAt(slash))) slash++;
    if (text.charCodeAt(slash) === 0x2f) return slash + 1;
  }
  return text.length;
}

/** Verdubbelde quotes samenvoegen zonder een quote na \S\ met de volgende quote te verwarren. */
export function unescapeStepQuotes(body: string, literal = false): string {
  let out = '';
  let state = StepStringState.Text;
  for (const ch of body) {
    const c = ch.charCodeAt(0);
    if (!(state === StepStringState.Quote && c === 0x27)) out += ch;
    state = stepString(state, c, literal);
  }
  return out;
}
