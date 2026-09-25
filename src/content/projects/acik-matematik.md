---
title: Açık Matematik
shortDescription: An open-source publishing platform and modern textbook initiative for undergraduate mathematics in Turkish, with reproducible numerical computing and free PDF and EPUB editions.
isOpenSource: true
repositoryUrl: https://github.com/KaanBahaSever/acik-matematik
liveUrl: https://acik-matematik.com
techStack: [Quarto, Markdown, Python]
featured: true
order: 4
date: 2026-06-02
---

## What it is

Açık Matematik ("Open Mathematics") is an open-source digital publishing platform and a modern
textbook initiative for undergraduate mathematics in Turkish. Turkish course material is often
scattered, handwritten or hard to read, so the project gathers it into one accessible library:
cleanly typeset notes, rigorous documentation, no ads, and all of the source open.

## Features

- **Readable, interactive notes** with theorem and definition boxes, proofs and solutions that
  open on demand, and interactive calculators on the web version.
- **Reproducible numerical computing**: notes are written in Markdown with Quarto, which can run
  Python code when a book is built, so numerical examples are recomputed from source instead of
  pasted in.
- **Theme-aware figures**: SVG illustrations that look right in both light and dark mode.
- **PDF and EPUB downloads** of the written notes, per course, and per part for courses that
  span several terms (for example Algebra 1–3 or Analysis 1–4).
- Courses ranging from number theory and cryptography to stochastic processes.

## Architecture

- **Multi-project portal**: the root is a Quarto website that works as a catalogue, and every
  course is an independent, automatically numbered Quarto book. Each course builds in
  isolation, so a large curriculum stays manageable.
- **Shared configuration**: theme, typography, Turkish theorem labels and global CSS live in one
  shared metadata file instead of being repeated in every book.
- **Build and export**: Python scripts build the portal and all books into a single site and
  export each course to PDF (via Typst) and EPUB. Pandoc Lua filters turn proof and solution
  blocks into collapsible sections, convert embedded figures for the downloads and adapt LaTeX
  constructs to Typst.
- **CI/CD**: GitHub Actions builds and checks the site on every push to `main` and deploys it to
  Cloudflare Pages, with preview deployments for pull requests.
