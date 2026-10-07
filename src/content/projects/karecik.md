---
title: Karecik
shortDescription: A QR menu service for local cafés and restaurants. Customers scan a code and the menu opens on their phone; owners keep it up to date from a dashboard. It began with a menu for a friend’s café.
isOpenSource: true
repositoryUrl: https://github.com/KaanBahaSever/karecik
liveUrl: https://karecik.com
techStack: [Go, PostgreSQL]
stage: production
since: 2021
featured: true
order: 3
date: 2026-08-24
---

## Where it came from

Karecik started when a friend of mine from middle school opened a café. At first I made him a
QR menu, but it was a static page. Then, at his request, I set out to build a full point-of-sale
(POS) system. I could not finish it in time, so instead we released a much more detailed,
dynamic QR menu application. My friend has used it for years now. He has since opened two more
branches, and today he uses Karecik in all three of them.

The first versions date from 2021 and went by earlier working titles. In 2026 I polished that
work and shipped it to production as Karecik.

## What it is

Karecik is a production SaaS for QR menus, used by local cafés and restaurants. Customers scan
the business's QR code and its menu opens on their phone, served from the business's own
subdomain; owners manage their menus from a dashboard. A menu has to open the moment someone
scans it, so the service is built for zero downtime and low latency.

## Features

- **Menu editor**: categories and products with drag-and-drop ordering, inline price editing
  and bulk percentage price updates with rounding rules.
- **Branches and menus**: several branches per business, with menus shared across branches or
  scoped to one, and per-branch price and availability overrides.
- **Six menu languages**: Turkish, English, German, Russian, Arabic and French.
- **Product details**: images, ingredients, allergen warnings, calorie counts and custom badges.
- **Branding**: themes, typefaces, accent colours, backgrounds and a configurable splash screen,
  checked in a live mobile preview inside the dashboard.
- **QR codes**: download as PNG, print, or copy the menu address.
- **Customer menu**: served on the business's subdomain (with a path-based fallback), with
  search, language switching and Wi-Fi details.

## Architecture

Every business is a tenant of one deployment: a request is resolved to its business by
subdomain, so a new business needs no new infrastructure.

| Layer          | Stack                                                              |
| -------------- | ------------------------------------------------------------------ |
| API            | Go 1.22, Fiber v2, pgx; in-memory sessions with an HttpOnly cookie |
| Database       | PostgreSQL with embedded SQL migrations applied on startup         |
| Frontend       | React 18, Vite, Tailwind CSS, dnd-kit                              |
| Tenancy        | Wildcard subdomain resolution with a path-based fallback           |
| Infrastructure | Cloudflare                                                         |

The code is written in English; the product itself ships in Turkish.

## License

Karecik is free software under the GNU General Public License v3.0.
[View the source on GitHub](https://github.com/KaanBahaSever/karecik).
