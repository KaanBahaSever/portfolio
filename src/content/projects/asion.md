---
title: Asion
shortDescription: Privacy-first productivity and workstation activity tracking for macOS, Linux and Windows, built on native OS event hooks and a lightweight daemon, with self-hosting in mind.
isOpenSource: false
liveUrl: https://asion.app
techStack: ['C++', 'Objective-C', 'Go', 'gRPC']
stage: early-access
since: 2024
featured: true
order: 1
date: 2026-09-16
---

## What it is

Asion is a cross-platform productivity and workstation activity tracker for macOS, Linux and
Windows. It records which application and window have focus and turns that raw activity into a
picture of how time is actually spent. Tools such as Rize.io showed how useful that picture can
be; Asion is built on the view that data this personal should stay under its owner's control,
so it is designed privacy-first and with self-hosting in mind.

It is meant for individuals who want an honest record of their working day, for engineering
teams, and for academic time tracking, where researchers and students account for the hours
spent on a project. I have been building it since 2024; it is in development, with early access
through [asion.app](https://asion.app). The source code is private.

## How it watches without getting in the way

An activity tracker runs all day, so its cost has to be close to zero. Asion listens to
**native OS event hooks**, so each platform reports focus changes as they happen, and a
**lightweight daemon** does the collecting in the background. The native layers are written in
C/C++ and Objective-C, alongside Go.

## Architecture

Asion is split into several processes, each with one job:

- **`asion-agent`**: the background agent. It watches the active window through the
  operating system's hooks and collects activity.
- **`asion-runner`**: runs the scheduled and long-running work behind the agent.
- **`asion-ui`**: the interface where the collected activity is reviewed.
- **`asion-native-host`**: the native messaging host that connects browser extensions to the
  agent.

The components talk to each other over **gRPC** with **Protobuf** messages: typed contracts
keep inter-process communication efficient and the boundaries between processes explicit.
Activity is stored locally in an encrypted **SQLCipher** database, so the record on disk is
unreadable without its key.

## Browser integration

Browsers only let an extension reach a local program through native messaging, which frames
every message with a 4-byte little-endian length prefix in front of a JSON payload. Asion
implements that framing in **C++** inside `asion-native-host`, so the extension and the
background agent exchange messages without a network service in between.
