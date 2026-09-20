---
title: Building an images-to-PDF tool that never uploads your files
description: How the Images to PDF tool on this site works entirely in the browser, with pdf-lib in a Web Worker, lossless JPEG embedding and touch-friendly reordering.
pubDate: 2026-09-10
tags: [typescript, pdf, privacy, web-workers]
relatedProject: images-to-pdf
---

Most online converters ask you to upload your photos first. I wanted an
[Images to PDF](/tools/images-to-pdf/) tool that does the whole job on the device, so
the files never leave it. This site is fully static, with no backend, so that was also
the only option.

## The pipeline

1. **Import.** The format is detected from the first bytes of each file, because
   `File.type` only reflects the file extension (and is empty on some mobile pickers).
   For JPEGs, a small parser reads the frame header and the EXIF orientation. Each image
   then gets a 400-pixel thumbnail.
2. **Arrange.** Pages sit in a grid you can reorder with drag and drop.
3. **Build.** The PDF is assembled with [pdf-lib](https://pdf-lib.js.org/) inside a Web
   Worker.
4. **Download.** The finished bytes become a `Blob` that the browser saves as a file.

## Keeping pdf-lib out of the page

pdf-lib is about 200 kB gzipped, and it decodes PNGs and compresses data synchronously.
Running it on the main thread would freeze the progress bar and the Cancel button, so
it lives in a module worker that is only created when you click Generate:

```ts
const worker = new Worker(new URL('./pdf-worker.ts', import.meta.url), { type: 'module' });
```

Vite bundles the worker separately, so visiting the page never downloads pdf-lib. The
worker asks the page for images one at a time, and the page transfers each image's
`ArrayBuffer` instead of copying it. Cancelling is just `worker.terminate()`, which stops
pdf-lib immediately, even in the middle of saving.

## Lossless JPEGs

PDF can store JPEG data as-is (the `DCTDecode` filter), so in *Original quality* mode
baseline and progressive JPEGs are embedded without re-encoding. Before that, the tool
removes what a PDF does not need: Exif (including GPS location), XMP, IPTC, comments,
and anything after the image data, such as the short videos some phones append to
photos. The compressed image data itself is copied unchanged.

Two details keep the photos looking right:

- **Orientation.** Phone cameras store pixels sideways and record the rotation in EXIF.
  Instead of rotating pixels, which would mean re-encoding, the tool draws the image with
  a PDF transformation matrix:

  ```ts
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(a, b, c, d, e, f),
    drawObject(name),
    popGraphicsState(),
  );
  ```

- **Colour.** If a photo carries an ICC profile, for example Display P3, it becomes the
  image's `ICCBased` colour space, so wide-gamut colours are not flattened. Identical
  profiles are stored once.

PNGs that pdf-lib can decode safely are embedded directly as well. Everything else
(WebP, GIF, very large PNGs and so on) is drawn on a canvas and encoded as JPEG, or as
PNG when it has transparency. If pdf-lib still fails to read an image, the worker asks
the page for a canvas-rendered fallback instead of giving up.

## Lessons from phones

- **Canvas limits are real.** iOS Safari refuses canvases above 16.7 million pixels, so
  every canvas is sized to fit, and its memory is released right after encoding.
- **Long-press to drag.** Pages are reordered with SortableJS. On touch screens a card
  only picks up after a 250 ms press, so a normal swipe still scrolls the page, and arrow
  buttons on every card move it one place without dragging at all.
- **Offer a smaller mode.** *Smaller file* resizes images to at most 2000 pixels and
  re-compresses them, which helps with email attachments and with phones that run out
  of memory on many large photos. It keeps the original JPEG data when that is already
  smaller.
- **Announce what happens.** Adding, moving and removing images, progress and errors are
  announced to screen readers.

## Testing

The page layout maths, EXIF orientation matrices, JPEG and PNG parsing, ICC profile
checks and the PDF builder are plain TypeScript modules without DOM access. They run
under Node's built-in test runner (`node --test`), which executes TypeScript directly.

## What's next

The other tools on this site, such as Split PDF and Compress PDF, follow the same rule:
everything runs locally in your browser, and nothing is uploaded.
