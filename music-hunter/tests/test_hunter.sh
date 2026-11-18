#!/usr/bin/env bash
# Test sur données FICTIVES (vérifie le calcul, pas la réalité). Ne jamais publier ce rapport.
set -e; cd "$(dirname "$0")/.."; T=$(mktemp -d); trap 'rm -rf $T' EXIT
cp -r . $T/mh; mkdir -p $T/config; cp ../config/stories.json $T/config/
python3 $T/mh/hunter.py ingest tests/fixture_FICTIF.csv >/dev/null
python3 $T/mh/hunter.py ingest tests/fixture_FICTIF.csv | grep -q "+0" # dédup
R=$(python3 $T/mh/hunter.py report --date 2026-11-08)
grep -q "+60%" "$R"; grep -q "Swimming Pools" "$R"; grep -q "son original non identifié" "$R"
echo "test_hunter OK"
