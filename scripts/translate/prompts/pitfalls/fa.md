# Known pitfalls: Persian (fa)

- **Zero-width non-joiner (ZWNJ, U+200C).** Required after the prefix می (می‌کند), before the plural
  ها (وظیفه‌ها), before ای and ام after a final ه, and inside compounds (پیش‌نیاز، پس‌نیاز، به‌روز).
  Wrong: "میکند", "می کند", "وظیفه ها".
- **Persian letters.** ی and ک, never the Arabic ي and ك; no ة.
- **Ezafe after a silent h.** One way in the whole article, as in `style.docs`: "برنامهٔ شما",
  "پنجرهٔ"; not mixed with "برنامه‌ی".
- **را after a definite object.** "*ذخیره* را انتخاب کنید", "نرم‌افزار وظیفه را جابه‌جا می‌کند"; do not
  drop it.
- **Verb at the end.** Do not copy the English word order: "نرم‌افزار پس‌نیاز را به روز کاری بعدی منتقل
  می‌کند", not "نرم‌افزار منتقل می‌کند پس‌نیاز را".
- **Persian punctuation.** ، ؛ ؟ instead of , ; ?; quotation marks «…», as in the UI.
- **Dates.** Keep the Gregorian date of the source with digits 0-9: "دوشنبه 7 ژوئن 2027"; never convert
  it to the Persian calendar.
- **Word senses.** تأخیر is the lag on a relation; a late task "یک روز دیرتر تمام می‌شود". A house
  extension is "توسعهٔ خانه", not افزونه. The break in the working day is استراحت (`terms`), not وقفه.
- **Calques.** "به اصطلاح" means "so-called", not "as it were" (→ "به عبارتی"); "در جای خود" (in
  place) → "تعیین‌شده"; "دیر می‌دود" (runs late) → "دیرتر تمام می‌شود".
