---
title: Images to PDF
shortDescription: A privacy-friendly tool that turns photos into a single PDF, entirely in the browser. No uploads, no accounts.
isOpenSource: true
repositoryUrl: https://github.com/your-username/portfolio
liveUrl: /tools/images-to-pdf/
techStack: [Astro, TypeScript, pdf-lib, SortableJS]
featured: true
order: 1
date: 2026-09-01
---

<!-- Placeholder project write-up: replace with your own story. -->

## Why

Most "images to PDF" websites upload your files to a server. This one does not:
every image is decoded, resized and written into the PDF on your own device.

## How it works

- Pick or drop images (JPEG, PNG, WebP and more).
- Reorder pages with drag and drop, or with the move buttons on touch screens.
- Choose a page size and margins, then download the generated PDF.

## What I learned

Working within mobile memory limits, keeping the UI responsive while encoding
large photos, and writing small, testable modules around `pdf-lib`.
