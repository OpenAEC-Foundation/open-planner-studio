#!/usr/bin/env bash
# Boekhouding voor .github/workflows/release-verify.yml (issue #429).
# Elke job draait ALLE controles; een controle die faalt stopt de job niet.
# Pas `finish` beslist: tabel naar $GITHUB_STEP_SUMMARY en exit 1 als er een
# controle FOUT is en RELEASE_VERIFY_STRICT=1 (release/dispatch). Bij een PR
# (rapportmodus, STRICT=0) blijft de job dan groen. Een crash of ontbrekende
# tool hoort NIET via deze helper te lopen maar als gewone stap te falen.
#
#   release-check.sh run    "<naam>" <cmd...>          OK als cmd exit 0 geeft
#   release-check.sh alive  "<naam>" <sec> <cmd...>    start cmd, OK als het na <sec> s nog leeft
#   release-check.sh record OK|FOUT|INFO "<naam>" "<detail>"
#   release-check.sh finish "<titel>"
#   release-check.sh valid-tag "<tag>"                  exit 0 als de HELE waarde een geldige tag is
#
# Exitcodes van de helper: 0 = controle vastgelegd (ook als die FOUT is);
# 2 = verkeerd gebruik; 3 = infrastructuur stuk (commando ontbreekt, exit
# 126/127, syntaxfout in een shellbestand of `bash -c`-script). Aanroepers met
# `set +e` geven een exitcode ≠ 0 door (`|| exit $?`), zodat rapportmodus
# een kapotte controle nooit als gewone FOUT verbergt.
set -uo pipefail

LOG="${RELEASE_CHECKS:-${RUNNER_TEMP:-/tmp}/release-checks.tsv}"

clean() { tr '\t\r\n|' '    ' | cut -c1-240; }

record() {
  local status="$1" name="$2" detail="${3:-}"
  printf '%s\t%s\t%s\n' "$status" "$(printf '%s' "$name" | clean)" "$(printf '%s' "$detail" | clean)" >> "$LOG"
  echo "[$status] $name${detail:+ — $detail}"
}

last_line() { grep -v '^[[:space:]]*$' "$1" | tail -n 1; }

infra() { echo "::error::release-check: $*" >&2; exit 3; }

# Vooraf: bestaat het commando, en is het shellscript dat het draait syntactisch in orde?
# Een syntaxfout in een shellbestand geeft anders gewoon exit 2, wat er hetzelfde uitziet
# als een controle die FOUT geeft (review #438, ronde 2).
preflight() {
  [ "$#" -ge 1 ] || infra "geen commando opgegeven"
  command -v "$1" >/dev/null 2>&1 || infra "commando '$1' ontbreekt"
  case "$(basename "$1")" in
    bash|sh)
      local shell="$1"; shift
      # Sla opties over tot het eerste argument dat geen optie is; -c heeft een scriptstring.
      while [ "$#" -gt 0 ]; do
        case "$1" in
          -c) "$shell" -n -c "${2:-}" 2>/dev/null || infra "syntaxfout in het $shell -c-script"; return 0 ;;
          -*) shift ;;
          *) break ;;
        esac
      done
      if [ "$#" -gt 0 ]; then
        [ -f "$1" ] || infra "shellbestand '$1' ontbreekt"
        "$shell" -n "$1" 2>/dev/null || infra "syntaxfout in shellbestand $1"
      fi
      ;;
    *.sh)
      bash -n "$1" 2>/dev/null || infra "syntaxfout in shellbestand $1"
      ;;
  esac
}

# Na afloop: exit 126/127 betekent dat de shell het commando niet kon starten.
postflight() {
  case "$1" in 126|127) infra "commando kon niet starten (exit $1): $2" ;; esac
}

cmd="${1:?subcommando ontbreekt}"; shift
case "$cmd" in
  record)
    [ "$#" -ge 2 ] || { echo "gebruik: record STATUS NAAM [DETAIL]" >&2; exit 2; }
    case "$1" in OK|FOUT|INFO) ;; *) echo "onbekende status '$1'" >&2; exit 2 ;; esac
    record "$@"
    ;;
  valid-tag)
    # Bash-=~ ankert ^ en $ aan de hele waarde; een regeleinde valt buiten de klasse.
    [ "$#" -eq 1 ] && [[ "$1" =~ ^v[0-9][0-9A-Za-z.-]*$ ]]
    ;;
  run)
    [ "$#" -ge 2 ] || { echo "gebruik: run NAAM CMD..." >&2; exit 2; }
    name="$1"; shift
    preflight "$@"
    out="$(mktemp)"
    "$@" >"$out" 2>&1; rc=$?
    echo "::group::$name"; cat "$out"; echo "::endgroup::"
    postflight "$rc" "$name"
    if [ "$rc" -eq 0 ]; then record OK "$name" "$(last_line "$out")"
    else record FOUT "$name" "exit $rc: $(last_line "$out")"; fi
    ;;
  alive)
    [ "$#" -ge 3 ] || { echo "gebruik: alive NAAM SEC CMD..." >&2; exit 2; }
    name="$1"; secs="$2"; shift 2
    preflight "$@"
    out="$(mktemp)"
    "$@" >"$out" 2>&1 &
    pid=$!
    sleep "$secs"
    if kill -0 "$pid" 2>/dev/null; then
      record OK "$name" "proces leeft na ${secs} s"
      pkill -TERM -P "$pid" 2>/dev/null; kill -TERM "$pid" 2>/dev/null
      sleep 3
      pkill -KILL -P "$pid" 2>/dev/null; kill -KILL "$pid" 2>/dev/null
    else
      # Geen postflight: exit 127 is hier ook een app die een bibliotheek mist (echte FOUT);
      # dat het commando zelf bestaat, controleerde preflight al.
      wait "$pid"; rc=$?
      record FOUT "$name" "proces stopte binnen ${secs} s (exit $rc): $(last_line "$out")"
    fi
    echo "::group::$name (uitvoer)"; cat "$out"; echo "::endgroup::"
    ;;
  finish)
    title="${1:-Releaseverificatie}"
    if [ ! -s "$LOG" ]; then
      echo "::error::geen enkele controle vastgelegd in $LOG" >&2
      exit 2
    fi
    if tr -d '\r' < "$LOG" | grep -qvE '^(OK|FOUT|INFO)'$'\t'; then
      echo "::error::onbekende regel in $LOG" >&2
      exit 3
    fi
    fails="$(tr -d '\r' < "$LOG" | grep -c '^FOUT' || true)"
    {
      echo "## $title"
      echo
      if [ "$fails" -eq 0 ]; then echo "**Oordeel: OK**"; else echo "**Oordeel: FOUT** — $fails controle(s) faalden."; fi
      if [ "${RELEASE_VERIFY_STRICT:-1}" != "1" ]; then echo; echo "_Rapportmodus (pull_request): een FOUT maakt deze job niet rood._"; fi
      echo
      echo "| controle | uitkomst | detail |"
      echo "|---|---|---|"
      while IFS=$'\t' read -r status name detail; do
        echo "| $name | $status | $detail |"
      done < <(tr -d '\r' < "$LOG")
      echo
    } | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
    if [ "$fails" -gt 0 ] && [ "${RELEASE_VERIFY_STRICT:-1}" = "1" ]; then exit 1; fi
    ;;
  *)
    echo "onbekend subcommando: $cmd" >&2; exit 2
    ;;
esac
