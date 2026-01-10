#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Rendering Play Store assets with ImageMagick…"

# App icon (512×512)
magick -density 256 icon.svg -resize 512x512 -alpha off -strip organizel-icon-512.png

# Feature graphic (1024×500)
magick -density 192 feature-graphic.svg -resize 1024x500 -alpha off -strip organizel-feature-graphic-1024x500.png

echo "Done:"
ls -lh organizel-icon-512.png organizel-feature-graphic-1024x500.png


