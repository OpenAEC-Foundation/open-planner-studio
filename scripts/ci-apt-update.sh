#!/usr/bin/env bash
set -euo pipefail

# Jammy op GitHub Actions: behoud suites, componenten, sleutelopties en externe bronnen.
# Bugs 184/191: Azure-downloads kunnen ook na een geslaagde update blijven hangen.
# Daarom eerst het officiële HTTPS-archief, de runner-mirrors alleen als terugval.
sources=/etc/apt/sources.list
if ! grep -Fq 'mirror+file:/etc/apt/apt-mirrors.txt' "$sources"; then
  echo "::error::Onverwachte APT-bronnen: de Jammy-mirrorlijst ontbreekt; geen veilige automatische bronwissel."
  exit 1
fi
backup=$(mktemp)
trap 'rm -f "$backup"' EXIT
cp "$sources" "$backup"
sudo sed -i 's|mirror+file:/etc/apt/apt-mirrors\.txt|https://archive.ubuntu.com/ubuntu/|g' "$sources"

# --error-on=any weigert ook gedeeltelijke updates met oude indexen.
# Timeout als root voor de hele procesgroep; na TERM nog 10 s tot KILL.
apt_options=(-o Acquire::Retries=1 -o Acquire::http::Timeout=15 -o Acquire::https::Timeout=15)
echo 'APT-route: officieel Ubuntu-archief (HTTPS).'
if sudo timeout --verbose --kill-after=10s 2m apt-get "${apt_options[@]}" --error-on=any update; then
  echo 'APT-route gekozen: officieel Ubuntu-archief (HTTPS).'
else
  echo '::warning::APT-update via officieel archief mislukt of timeout; herstel oorspronkelijke runner-mirrors en probeer eenmaal opnieuw.'
  sudo cp "$backup" "$sources"
  if ! sudo timeout --verbose --kill-after=10s 2m apt-get "${apt_options[@]}" --error-on=any update; then
    echo '::error::APT-update via oorspronkelijke runner-mirrors ook mislukt; installatie wordt niet gestart.'
    exit 1
  fi
  echo 'APT-route gekozen: oorspronkelijke runner-mirrors.'
fi
