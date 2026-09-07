# stats

Databranch, geschreven door `.github/workflows/download-stats.yml` (wekelijks en op verzoek).
Nooit met de hand bewerken; elke run overschrijft de inhoud.

- `downloads.json` — downloads per besturingssysteem en per release uit de GitHub Releases-API,
  gegenereerd door `scripts/download-stats.mjs --format=json`. Zie de kop van dat script
  voor wat de cijfers wel en niet betekenen (Linux is install+update samen; de Snap Store
  zit er niet in).

Vaste leeslocatie:
https://raw.githubusercontent.com/OpenAEC-Foundation/open-planner-studio/stats/downloads.json
