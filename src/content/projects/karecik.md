---
title: Karecik
shortDescription: A multi-tenant QR menu platform for cafés and restaurants, with a drag-and-drop menu editor, multilingual menus, branding themes and QR code export.
isOpenSource: true
repositoryUrl: https://github.com/KaanBahaSever/karecik
techStack: [Go, Fiber, PostgreSQL, React, Vite, Tailwind CSS, dnd-kit]
featured: true
order: 2
date: 2026-08-24
---

## What it is

Karecik lets cafés and restaurants publish their menus behind a QR code. Owners manage
their menus in a dashboard, and customers open them on their phones from the business's
own subdomain.

## Features

- **Menu editor**: categories and products with drag-and-drop ordering, inline price
  editing and bulk percentage price updates with rounding rules.
- **Branches and menus**: several branches per business, with menus shared across
  branches or scoped to one, and per-branch price and availability overrides.
- **Six menu languages**: Turkish, English, German, Russian, Arabic and French.
- **Product details**: images, ingredients, allergen warnings, calorie counts and
  custom badges.
- **Branding**: themes, typefaces, accent colours, backgrounds and a configurable splash
  screen, checked in a live mobile preview inside the dashboard.
- **QR codes**: download as PNG, print, or copy the menu address.
- **Customer menu**: served on the business's subdomain (with a path-based fallback),
  with search, language switching and Wi-Fi details.

## Architecture

| Layer    | Stack                                                               |
| -------- | ------------------------------------------------------------------- |
| API      | Go 1.22, Fiber v2, pgx; in-memory sessions with an HttpOnly cookie  |
| Database | PostgreSQL with embedded SQL migrations applied on startup          |
| Frontend | React 18, Vite, Tailwind CSS, dnd-kit                               |
| Tenancy  | Wildcard subdomain resolution with a path-based fallback            |

The code is written in English; the product itself ships in Turkish.

## License

Karecik is free software under the GNU General Public License v3.0.
[View the source on GitHub](https://github.com/KaanBahaSever/karecik).
