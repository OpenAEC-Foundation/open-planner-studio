# Releasescript: twee omwegen om `gh`

Het releasescript (`scripts/release/stappen.mjs`) gaat op twee plekken niet de korte weg via `gh`, omdat die weg
op de server of bij een lang issue fout uitkomt.

`wachtOpReparatie` vraagt de laatste reactie van elk open reparatie-issue met een eigen GraphQL-vraag
(`comments(last: 1)`) en niet met `gh issue list --json comments`. Het veld `comments` van `gh` vraagt in zijn bron
`comments(first: 100)` op (`api/query_builder.go`); bij een issue met meer dan honderd reacties ziet het script dan
een melding `REPARATIE GEBLOKKEERD` in de laatste reactie niet.

`jobLog` vraagt de log van een job eerst met `--allow-escape-sequences` en zonder die vlag opnieuw als dat faalt.
Nieuwere versies van `gh` weigeren een antwoord dat geen JSON is en terminal-escapesequenties bevat, als die vlag
ontbreekt (`pkg/cmd/api/api.go` en `pkg/iostreams/content.go` in de bron van `gh`); `gh` 2.45 op aia09-mp50 kent de
vlag niet. Alleen de vlag of alleen zonder vlag breekt dus op een van de twee versies.
