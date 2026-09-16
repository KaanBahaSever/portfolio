---
title: Building an images-to-PDF tool that never uploads your files
description: Notes on turning photos into a PDF entirely in the browser with pdf-lib, and what mobile devices taught me along the way.
pubDate: 2026-09-10
tags: [astro, typescript, pdf, privacy]
heroImage: ../../assets/blog/images-to-pdf-hero.png
heroImageAlt: Soft green and grey gradient placeholder image
relatedProject: images-to-pdf
---

<!-- Placeholder post: replace with your real development story. -->

Most online converters ask you to upload your photos first. I wanted a tool that
does the whole job on the device, so the files never leave it.

## The plan

1. Read the selected files with the File API.
2. Decode and downscale each image with a canvas.
3. Embed the result into a PDF page with `pdf-lib`.
4. Offer the finished file as a download.

## Fitting an image on a page

The core of the layout is a small, pure function that is easy to unit test:

```ts
interface Size {
  width: number;
  height: number;
}

export function fitInside(image: Size, box: Size): Size {
  const scale = Math.min(box.width / image.width, box.height / image.height, 1);
  return {
    width: Math.round(image.width * scale),
    height: Math.round(image.height * scale),
  };
}
```

## Lessons from phones

- Large photos can exhaust memory quickly, so images are processed one at a time.
- Drag and drop alone is not enough on touch screens; explicit move buttons help.
- Showing progress matters more than raw speed.

## What's next

Splitting and compressing PDFs, built the same way: small modules, no servers.
