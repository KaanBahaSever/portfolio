---
title: Images to PDF
shortDescription: A privacy-friendly tool that turns photos into a single PDF entirely in the browser, keeping JPEG quality intact. No uploads, no accounts.
isOpenSource: true
repositoryUrl: https://github.com/KaanBahaSever/portfolio
liveUrl: /tools/images-to-pdf/
techStack: [Astro, TypeScript, pdf-lib, SortableJS, Web Workers]
featured: true
order: 4
date: 2026-09-01
---

## Why

Most "images to PDF" websites upload your photos to a server. This tool, part of this
site, does all the work on your own device: images are read, arranged and written into
the PDF in the browser, and nothing is uploaded.

## Features

- **Add images** by picking or dropping them: JPEG, PNG, WebP and other formats the
  browser can decode. Formats are detected from the file contents, not the extension.
- **Reorder pages** in a SortableJS grid. On touch screens a short long-press picks a
  card up, so a normal swipe still scrolls the page; arrow buttons move a page one place,
  and Sort A–Z and Reverse rearrange everything at once.
- **Page options**: A4, US Letter or fit to image; automatic, portrait or landscape
  orientation; no, small or large margins; and a custom file name.
- **Two quality modes**: *Original quality* keeps the compressed image data of JPEG
  photos unchanged, while *Smaller file* resizes images to at most 2000 pixels and
  re-compresses them (keeping the original JPEG data whenever that is already smaller).
- **Accessible**: progress and changes are announced to screen readers, and generation
  can be cancelled at any time.

## How it works

- **pdf-lib in a Web Worker**: the worker is created only when you click Generate, so
  pdf-lib never ships in the page JavaScript and the interface stays responsive while
  the PDF is built. Cancel terminates the worker instantly.
- **One image at a time**: the page prepares each image when the worker asks for it and
  transfers the bytes instead of copying them, which keeps memory use low on phones.
- **Lossless JPEG passthrough**: JPEG image data is embedded unchanged, with no
  re-encoding. EXIF orientation is applied with a PDF transformation matrix rather than
  by rotating pixels.
- **Metadata stripping**: camera metadata such as Exif (including GPS location), XMP and
  IPTC, plus trailing data such as embedded motion-photo videos, is left out of the PDF.
- **Colour accuracy**: the ICC profile of an image embedded without re-encoding becomes
  its PDF colour space, so wide-gamut photos (such as Display P3) keep their colours;
  identical profiles are stored only once.
- **Other formats**: PNGs are embedded directly when pdf-lib can decode them safely;
  everything else is drawn on a canvas within mobile size limits and encoded as JPEG,
  or as PNG when it contains transparency.

The layout maths, EXIF orientation matrices, JPEG and PNG parsing, ICC checks and the PDF
builder are pure TypeScript modules covered by unit tests that run with Node's built-in
test runner.
