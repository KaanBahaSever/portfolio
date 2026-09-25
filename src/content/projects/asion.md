---
title: Asion
shortDescription: A cross-platform productivity and active window tracking system.
isOpenSource: false
techStack: ['C++', 'Objective-C', 'Go', 'gRPC']
featured: true
order: 3
date: 2026-09-16
---

## What it is

Asion is a cross-platform productivity and active window tracking system. It records which
application and window are in focus and turns that raw activity into a picture of how time is
actually spent. The source code is private.

## Architecture

Asion is split into several binaries, each with one job:

- **`asion-agent`** — the background agent: it watches the active window through operating-system
  hooks and collects activity.
- **`asion-runner`** — runs the scheduled and long-running work behind the agent.
- **`asion-ui`** — the interface where the collected activity is reviewed.
- **`asion-native-host`** — the native messaging host that connects browser extensions to the
  agent.

The components talk to each other over **gRPC** with **Protobuf** messages, and activity is stored
locally in an encrypted **SQLCipher** database.

## Browser integration

Browsers only let an extension reach a local program through native messaging, which frames every
message with a 4-byte little-endian length prefix in front of a JSON payload. Asion implements that
framing in **C++** inside `asion-native-host`, so the extension and the background agent exchange
messages without a network service in between.
