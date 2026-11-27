#!/usr/bin/env bash
set -uo pipefail

if [ "$#" -lt 2 ]; then
  echo "gebruik: bash scripts/ifcx/eis-afgekeurd.sh <verwachte reden> <opdracht> [argumenten...]" >&2
  exit 2
fi

verwacht="$1"
shift
uitvoer="$("$@" 2>&1)"
status=$?
printf '%s\n' "$uitvoer"

if [ "$status" -ne 1 ]; then
  echo "::error::De controle moest afkeuren (uitgang 1), maar gaf uitgang $status: $*"
  exit 1
fi
if ! grep -qF -- "$verwacht" <<<"$uitvoer"; then
  echo "::error::De controle keurde af, maar niet om \"$verwacht\": $*"
  exit 1
fi
echo "Afgekeurd zoals verwacht, om \"$verwacht\"."
