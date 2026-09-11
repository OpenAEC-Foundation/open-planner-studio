#!/usr/bin/env bash
# Publiceer een statistiekenbestand naar de `stats`-databranch — met git-plumbing,
# zonder checkout, zonder worktree.
#
# Waarom een databranch: de app (en iedereen) kan het bestand dan op één vaste,
# CORS-vrije URL lezen, net zoals de extensiecatalogus nu al van GitHub-raw komt:
#
#   https://raw.githubusercontent.com/<owner>/<repo>/stats/downloads.json
#
# Een push naar deze branch triggert géén CI en géén deploy: ci.yml en live.yml
# luisteren uitsluitend naar `main` (gecontroleerd 2026-09-07). De branch bevat
# nooit code, alleen `downloads.json` en een README die zegt waar het vandaan komt.
#
# Waarom plumbing: `hash-object` → `mktree` → `commit-tree` → `push` raakt de
# werkboom en de index niet, werkt op elke git-versie, en een gewone (niet-force)
# push met de huidige branchtop als parent is race-veilig. Het commit-tree-pad
# is aanvullend geen `set -e`-valkuil: alles is een expliciete pipeline.
#
# Gebruik:  scripts/publish-stats-branch.sh <pad/naar/download-stats.json>
# Env:      STATS_REMOTE (default origin), STATS_BRANCH (default stats)
#
# Aangeroepen door .github/workflows/download-stats.yml. Regressietest:
# tests/dev-server/publish-stats-branch.test.mjs (tegen een tijdelijke bare repo).

set -euo pipefail

JSON="${1:?gebruik: publish-stats-branch.sh <download-stats.json>}"
REMOTE="${STATS_REMOTE:-origin}"
BRANCH="${STATS_BRANCH:-stats}"
FILE="downloads.json"

[ -s "$JSON" ] || { echo "XX  $JSON ontbreekt of is leeg" >&2; exit 1; }
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$JSON" \
  || { echo "XX  $JSON is geen geldige JSON" >&2; exit 1; }

# Bestaande branchtop als parent (leeg bij de allereerste publicatie).
parent=""
if git fetch -q "$REMOTE" "refs/heads/$BRANCH" 2>/dev/null; then
  parent="$(git rev-parse FETCH_HEAD)"
fi

readme="$(cat <<EOF
# stats

Databranch, geschreven door \`.github/workflows/download-stats.yml\` (wekelijks en op verzoek).
Nooit met de hand bewerken; elke run overschrijft de inhoud.

- \`$FILE\` — downloads per besturingssysteem en per release uit de GitHub Releases-API,
  gegenereerd door \`scripts/download-stats.mjs --format=json\`. Zie de kop van dat script
  voor wat de cijfers wel en niet betekenen (Linux is install+update samen; de Snap Store
  zit er niet in).

Vaste leeslocatie:
https://raw.githubusercontent.com/${GITHUB_REPOSITORY:-OpenAEC-Foundation/open-planner-studio}/$BRANCH/$FILE
EOF
)"

blob="$(git hash-object -w "$JSON")"
readme_blob="$(printf '%s\n' "$readme" | git hash-object -w --stdin)"
tree="$(printf '100644 blob %s\t%s\n100644 blob %s\tREADME.md\n' "$blob" "$FILE" "$readme_blob" | git mktree)"

if [ -n "$parent" ] && [ "$(git rev-parse "$parent^{tree}")" = "$tree" ]; then
  echo "OK  $REMOTE/$BRANCH is al actueel ($parent)"
  exit 0
fi

msg="stats: $FILE bijgewerkt $(date -u +%Y-%m-%dT%H:%MZ)"
commit="$(git -c user.name='github-actions[bot]' \
             -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
             commit-tree "$tree" ${parent:+-p "$parent"} -m "$msg")"

git push -q "$REMOTE" "$commit:refs/heads/$BRANCH"
echo "OK  gepubliceerd: $commit → $REMOTE/$BRANCH/$FILE"
