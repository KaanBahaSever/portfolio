---
title: Açık Matematik
shortDescription: Open-source, interactive and ad-free Turkish lecture notes for undergraduate mathematics, typeset with LaTeX/MathJax and downloadable as PDF and EPUB.
isOpenSource: true
repositoryUrl: https://github.com/KaanBahaSever/acik-matematik
liveUrl: https://acik-matematik.com
techStack: [Quarto, Markdown, Python]
featured: true
order: 1
date: 2026-06-02
---

## What it is

Açık Matematik ("Open Mathematics") is an archive of Turkish lecture notes for
undergraduate mathematics courses. Turkish mathematics material is often scattered
and hard to read, so the project collects it into an accessible digital library:
cleanly typeset with LaTeX/MathJax instead of handwriting, open source and free of ads.

## Features

- **Readable, interactive notes** with theorem and definition boxes, proofs and
  solutions that open on demand, and interactive calculators on the web version.
- **Theme-aware figures**: SVG illustrations that look right in both light and dark mode.
- **PDF and EPUB downloads** of the written notes, per course, and per part for courses
  that span several terms (for example Algebra 1–3 or Analysis 1–4).
- Courses ranging from number theory and cryptography to stochastic processes.

## Architecture

- **Multi-project portal**: the root is a Quarto website that works as a catalogue,
  and every course is an independent, automatically numbered Quarto book. Each course
  builds in isolation, so a large curriculum stays manageable.
- **Shared configuration**: theme, typography, Turkish theorem labels and global CSS
  live in one shared metadata file instead of being repeated in every book.
- **Build and export**: Python scripts build the portal and all books into a single
  site and export each course to PDF (via Typst) and EPUB. Pandoc Lua filters turn
  proof and solution blocks into collapsible sections, convert embedded figures for
  the downloads and adapt LaTeX constructs to Typst.
- **CI/CD**: GitHub Actions builds and checks the site on every push to `main` and
  deploys it to Cloudflare Pages, with preview deployments for pull requests.

## Links

- Live site: [acik-matematik.com](https://acik-matematik.com)
- Source code: [github.com/KaanBahaSever/acik-matematik](https://github.com/KaanBahaSever/acik-matematik)
