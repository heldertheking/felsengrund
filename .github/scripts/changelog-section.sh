#!/usr/bin/env bash
# Print the body of the `## [X.Y.Z]` section of a Keep a Changelog file.
#
# Usage: changelog-section.sh <version> [file]   (file defaults to CHANGELOG.md)
#
# The body is everything after the heading up to the next `## [` heading or EOF,
# with leading/trailing blank lines removed. Exits 1 if the heading is missing
# or the section has no content, 2 on bad usage. Only needs awk.
set -euo pipefail

version="${1:-}"
file="${2:-CHANGELOG.md}"

if [ -z "$version" ]; then
  echo "usage: $0 <version> [file]" >&2
  exit 2
fi
if [ ! -f "$file" ]; then
  echo "changelog file not found: $file" >&2
  exit 1
fi

section=$(
  awk -v ver="$version" '
    { sub(/\r$/, "") }
    /^## \[/ {
      if (found) exit
      head = "## [" ver "]"
      rest = substr($0, length(head) + 1)
      if (substr($0, 1, length(head)) == head && (rest == "" || rest ~ /^[ \t]/)) {
        found = 1
        next
      }
    }
    found {
      if (!started && $0 ~ /^[ \t]*$/) next
      started = 1
      lines[++n] = $0
    }
    END {
      while (n > 0 && lines[n] ~ /^[ \t]*$/) n--
      for (i = 1; i <= n; i++) print lines[i]
    }
  ' "$file"
)

if [ -z "$section" ]; then
  echo "no non-empty '## [$version]' section found in $file" >&2
  exit 1
fi

printf '%s\n' "$section"
