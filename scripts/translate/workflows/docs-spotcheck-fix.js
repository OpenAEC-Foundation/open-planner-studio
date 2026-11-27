export const meta = {
  name: 'vertaalstraat-docs-steekproef-herstel',
  description: 'Haiku past de bevindingen uit de steekproef toe in de vertaalde Help-artikelen',
  phases: [{ title: 'Herstel', model: 'haiku' }],
}
const R = args.repo
const res = await parallel(args.langs.map((l) => () => agent(
`# Task: apply reviewed corrections to translated guides (language "${l}")
The corrections are in ${args.fixdir}/${l}.json: a list of {article, severity, quote, problem, fix}.
Each correction belongs to the file ${R}/public/docs/${l}/<article>.md.
Read the correction list, then for each correction open that file and edit it with the Edit tool.
Rules:
1. Find the passage the quote means. The quote can differ slightly from the file. Find the real passage.
2. Change only what the problem describes. Put the text of "fix" in place of the passage. Do not rewrite other text.
3. Never change text in *italics* (UI labels), inline \`code\`, link targets (docs://... and examples://...), headings, list structure, or numbers. Link text in [square brackets] stays as it is.
4. If the fix is already present, or you cannot find the passage, skip that correction.
5. Edit only files in ${R}/public/docs/${l}/. Do not run git. Do not edit other files.
Finish with one short line: "applied N, skipped M" and per skipped item the article and the reason.`,
  { label: `herstel:${l}`, phase: 'Herstel', model: 'haiku' },
).then((r) => ({ lang: l, r: typeof r === 'string' ? r.slice(-400) : r }))))
return res
