#!/usr/bin/env bash
# Guard (acceptance #18): Wreathlight must contain no Verse Arcade code, data or assets.
#  1. No Verse Arcade identifiers anywhere except README.md and the exact
#     keep-going link in src/shared/links.ts.
#  2. No file names matching known Verse Arcade asset names.
#  3. No file whose sha256 matches a non-trivial file from the Verse Arcade repo.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

ALLOWED_LINK='https://versearcade.org/?ref=wreathlight'
LINK_FILE='src/shared/links.ts'
SELF='scripts/check-no-verse-arcade.sh'
HASHES='scripts/va-hashes.txt'

IDENT_RE='church_verses|church-draft|lamplight|verse[ _-]?arcade'
ASSET_RE='skins-(advent|crusades|lamplight|lantern|live|patron|porchlight|refit)|tiktok-(cast|chalkboard|exchanges|faces|listeners|myths)|arcade-(covers|scenes)|churchyard|prayer-wall|starter-pilot|exchange-pilot|streak-badges|church-statues|leader-looks|roundup-scenes|road-scenes|baloo2|caveat-[67]00'

fail=0

# Tracked + untracked (not ignored) files; node_modules etc. are excluded via .gitignore.
mapfile -d '' FILES < <(git ls-files -z --cached --others --exclude-standard)

for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  case "$f" in
    README.md|"$SELF"|"$HASHES") continue ;;
  esac

  # 2. asset names
  if printf '%s' "$f" | grep -Eiq "$ASSET_RE"; then
    echo "FAIL: file name matches a Verse Arcade asset name: $f"; fail=1
  fi

  # 1. identifiers in content (binary files skipped by grep -I). The guard's own name
  #    ("no-verse-arcade") is allowed everywhere; the exact link only in $LINK_FILE.
  hits=""
  if grep -Iq . "$f" 2>/dev/null; then
    content=$(cat "$f")
    content=${content//no-verse-arcade/}
    if [ "$f" = "$LINK_FILE" ]; then
      content=${content//"$ALLOWED_LINK"/}
    fi
    hits=$(printf '%s\n' "$content" | grep -inE "$IDENT_RE" || true)
  fi
  if [ -n "$hits" ]; then
    echo "FAIL: Verse Arcade identifier in $f:"; printf '%s\n' "$hits" | sed 's/^/    /'; fail=1
  fi

  # 3. content hash match (trivial files skipped)
  size=$(wc -c < "$f")
  if [ "$size" -ge 64 ]; then
    h=$(sha256sum "$f" | cut -d' ' -f1)
    if grep -qx "$h" "$HASHES"; then
      echo "FAIL: $f is byte-identical to a Verse Arcade file (sha256 $h)"; fail=1
    fi
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "no-verse-arcade guard FAILED"; exit 1
fi
echo "no-verse-arcade guard passed (${#FILES[@]} files checked)"
