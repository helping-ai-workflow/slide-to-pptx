#!/usr/bin/env bash
set -euo pipefail
# Usage: scripts/render.sh <slide-dir>
# Builds <slide-dir>'s pptx via the CLI, copies it to a Windows-visible path,
# drives Windows PowerPoint COM via powershell.exe to export each slide to PNG,
# and prints where the PNGs live so they can be read back by an agent.

cd "$(dirname "$0")/.."

SLIDE_DIR="${1:-../my-slide/slides/mac-merge-tx-spec}"
SLIDE_NAME="$(basename "$SLIDE_DIR")"
WIN_DROP="/mnt/c/Users/Joe96/Downloads"
WIN_PPTX="$WIN_DROP/$SLIDE_NAME.pptx"
WIN_PNG_DIR="$WIN_DROP/$SLIDE_NAME-png"

echo "[1/3] build $SLIDE_DIR"
npm run -s build-pptx -- "$SLIDE_DIR" --all | tail -25

echo "[2/3] copy to $WIN_PPTX"
cp "out/$SLIDE_NAME.pptx" "$WIN_PPTX"

echo "[3/3] export PNGs to $WIN_PNG_DIR"
WIN_PPTX_DOS=$(wslpath -w "$WIN_PPTX")
WIN_PNG_DOS=$(wslpath -w "$WIN_PNG_DIR")
powershell.exe -NoProfile -Command "
\$ErrorActionPreference = 'Stop'
\$pp = New-Object -ComObject PowerPoint.Application
\$pres = \$pp.Presentations.Open('${WIN_PPTX_DOS//\\/\\\\}', \$true, \$true, \$false)
if (Test-Path '${WIN_PNG_DOS//\\/\\\\}') { Remove-Item -Recurse -Force '${WIN_PNG_DOS//\\/\\\\}' }
New-Item -ItemType Directory -Force -Path '${WIN_PNG_DOS//\\/\\\\}' | Out-Null
\$pres.SaveAs('${WIN_PNG_DOS//\\/\\\\}', 18)
\$pres.Close()
\$pp.Quit()
Write-Host 'done'
"
echo "PNGs: $WIN_PNG_DIR"
ls "$WIN_PNG_DIR" | sort -V | head
