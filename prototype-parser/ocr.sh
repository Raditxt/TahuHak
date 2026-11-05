#!/usr/bin/env bash
# PROTOTYPE — OCR ulang di laptop (ADR-0003: tidak di VPS).
# Prasyarat: Tesseract (winget UB-Mannheim.TesseractOCR), `pip install ocrmypdf`,
# ind.traineddata dari tessdata_best di ocr/tessdata (+ configs/ dan eng/osd dari instalasi Tesseract).
# Ghostscript tidak tersedia di winget; --rasterizer pypdfium + --output-type pdf menghindarinya.
set -euo pipefail
cd "$(dirname "$0")"
export PATH="/c/Program Files/Tesseract-OCR:$PATH"
export TESSDATA_PREFIX="$(cygpath -w "$PWD/ocr/tessdata")"
in="${1:-pdf/perda-mks-1983.pdf}"; out="ocr/$(basename "${in%.pdf}").ocr.pdf"
time python -m ocrmypdf --force-ocr -l ind --output-type pdf --rasterizer pypdfium "$in" "$out"
