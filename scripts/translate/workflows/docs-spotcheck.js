export const meta = {
  name: 'vertaalstraat-docs-steekproef',
  description: 'Steekproef: een sterker model leest vertaalde Help-artikelen na tegen de Engelse bron',
  phases: [{ title: 'Steekproef' }],
}
const SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['goed', 'redelijk', 'zwak'] },
    errorsPer1000Words: { type: 'number' },
    findings: { type: 'array', items: { type: 'object', properties: {
      article: { type: 'string' }, severity: { type: 'string', enum: ['fout', 'matig'] }, kind: { type: 'string' },
      quote: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } },
      required: ['article', 'severity', 'kind', 'quote', 'problem', 'fix'] } },
    patterns: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'errorsPer1000Words', 'findings', 'patterns'],
}
const R = args.repo
const res = await parallel(args.langs.map((l) => () => agent(
`You are a senior technical translator and native-level reviewer for language "${l}", with knowledge of construction scheduling (CPM, MS Project, Primavera P6).
Compare each translated guide with its English source. Files (read only these):
${args.ids.map((id) => `- ${R}/public/docs/en/${id}.md  and  ${R}/public/docs/${l}/${id}.md`).join('\n')}
Also read ${R}/i18n/termbase/${l}.json only to look up the agreed terms and the _style rules (docs, address, quotes); do not review it.
Judge: meaning faithful to the English (nothing added or dropped), correct professional terms (as in the termbase), natural and clear prose for a planner, consistent form of address, UI labels in italics left as the app shows them (do not judge their wording, they come from the UI), numbers and inline code unchanged, readable step lists. Only names (products, file formats, example task names that the app shows) stay English; ordinary words such as "the file" or "the bricklayer" must be translated.
Report only real problems. severity "fout" = wrong or misleading meaning, wrong term, broken grammar; "matig" = understandable but unnatural or inconsistent. quote = the exact translated passage (short, copied letter for letter, no "..."), fix = ONLY the literal replacement text for that quote, ready to paste (no alternatives, no "/", no notes, no instructions; put any advice in problem).
errorsPer1000Words = number of "fout" findings per 1000 English words. patterns = systematic problems likely to repeat in other guides. verdict: goed (<1 fout per 1000 words), redelijk (1-3), zwak (>3).`,
  { label: `steekproef:${l}`, phase: 'Steekproef', schema: SCHEMA, effort: 'medium', model: args.model || 'sonnet' },
).then((r) => ({ lang: l, ...r }))))
return res.filter(Boolean)
