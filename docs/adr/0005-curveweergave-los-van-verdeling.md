# De getoonde curve van een toewijzing volgt een eigen regel

Paneel en resourcediagram tonen de curve van een toewijzing volgens één regel (`assignmentCurveState`): een
gekoppelde contour geeft `'contoured'`, anders geven geïmporteerde curvewaarden zonder eigen vorm `'imported'`,
anders geldt de eigen vorm. De belasting (`assignmentDayUnits`) verdeelt anders: die gebruikt de exacte curvewaarden
zodra ze er zijn, ook naast een vormnaam, en negeert een contour zonder periodes. Het scherm kan dus *Vooraan belast*
tonen terwijl het histogram de exacte 21 waarden van P6 volgt. Vastgelegd is dat alle weergaven onderling gelijk
zijn; de verdeelregel gelijktrekken gebeurt in `assignmentDayUnits`.
