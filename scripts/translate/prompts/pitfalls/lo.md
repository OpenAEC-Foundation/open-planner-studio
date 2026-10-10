# Known pitfalls: Lao (lo)

- **No spaces between words.** Lao is written without word spaces. A space marks a clause or phrase
  break, about where English has a comma. Wrong: "ກົດ ຄິດໄລ່ ເພື່ອ ກວດສອບ" → right:
  "ກົດ ຄິດໄລ່ເພື່ອກວດສອບ". Never put a space inside a term such as ໄລຍະເວລາ or ໜ້າວຽກ.
- **Digits 0-9, not Lao digits.** The app shows 0-9. Keep every number from the source as 0-9
  ("14 ຂໍ້", "5 ມື້"); never write ໑໒໓. Keep `{{count}}` and other placeholders unchanged.
- **Thai leaks into spelling.** Do not write Thai letters or Thai spellings (ผ, ก็, ที่ ...). Lao
  uses ຜ, ແມ່ນ, ທີ່; the Lao *ໜ/ໝ* stay as in the termbase (ໜ້າວຽກ, ມອບໝາຍ). A Thai-looking word is wrong.
- **Spelling pairs.** Lao ຫຼ (ຫລ) is written ຫຼ in this UI: ຫຼັກໝາຍ, ຫຼື. Keep ຄ່າ (value), not Thai ค่า.
  Keep ໄ and ໃ as in the termbase: ໃໝ່ (new), ໄລຍະ (period), ໃຊ້ (use).
- **Terms: one concept, one word.** Use the termbase term every time, also inside longer phrases:
  task = ໜ້າວຽກ, work = ປະລິມານວຽກ (not ໜ້າວຽກ), schedule = ແຜນງານ, relation = ສາຍສຳພັນ.
  Never swap in a Thai or English synonym; never use the `avoid` words.
- **Loanwords versus Lao terms.** Use the Lao term where the termbase has one (ໄຟລ໌, ປະຕິທິນ,
  ຊັບພະຍາກອນ, ເຊື່ອມໂຍງ). Keep Latin where the UI does: float, lag, WBS, SNET, Ribbon, AI, Undo,
  and file formats (IFC, XER, MSPDI). Do not transliterate them (not ຟລັອດ, ແລັກ).
- **Formal address.** Say ທ່ານ, never the casual ເຈົ້າ or ເຈົ້າຂອງ. Requests use ກະລຸນາ. Button labels and
  menu items are bare verbs without a subject: ບັນທຶກ, ເປີດ, ລຶບ, ຄິດໄລ່. Do not add ທ່ານ to a label.
- **Tone marks and vowels.** Missing or doubled tone marks (່ ້ ໊ ໋) and vowel signs change the word:
  ໄລຍະ not ໄຍະ, ເວລາ not ເວນາ. Reread each term letter by letter against the termbase.
- **Classifiers and plurals.** Lao has no plural endings. Do not add ໆ or a plural word just to
  mirror English. For `_one` / `_other` keys write both forms as the same grammar around `{{count}}`.
- **Quotes and labels.** Use “…” around UI labels and placeholders (“{{name}}”). Keep a UI label exactly
  as in the UI, without rewording it for grammar; Lao needs no case endings, so put a carrier word
  (ແຖບ, ປຸ່ມ, ກ່ອງໂຕ້ຕອບ, ຖັນ) before it.
- **Literal calques.** Do not translate English idioms word by word ("on time", "out of date", "in
  sync"). Say what happens: "ເກີນກຳນົດ", "ບໍ່ເປັນປັດຈຸບັນ", "ບໍ່ຊິ້ງກັນ".
