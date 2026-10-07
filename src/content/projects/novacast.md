---
title: Novacast
shortDescription: Manages many screens of different makes from one web panel. It runs on Windows, macOS, Linux, Samsung TV, LG TV and Android TV, and a screen starts playing as soon as it is turned on.
isOpenSource: false
liveUrl: https://novacast.app
techStack: [Rust, Go, MQTT]
stage: production
since: 2025
featured: true
order: 2
# Only orders entries (newest first among equal `order` values); it is not shown anywhere.
date: 2026-01-01
---

## What it is

Novacast is software for controlling many screens from one place. The screens can be of
different makes and run different systems; all of them are managed through a web panel. This
kind of software is often called digital signage. More at [novacast.app](https://novacast.app).

It runs on Windows, macOS, Linux, Samsung TV, LG TV and Android TV. It is easy to install on
each of them, and once a screen is set up you can control it over the network from wherever
you are.

Companies typically use it to show advertising videos or photo galleries on all their screens,
and to manage those screens without fuss. When a screen is first turned on, Novacast starts
working right away.

## Where it came from

At a computer company where I worked, there was already software for this job. But it was
bloated, built on Electron, and it fell short of what we needed: it did not even list all the
screens connected to the system. In 2025 we built Novacast to replace it. We solved those
problems, put it on a much sturdier foundation and set up the infrastructure it needs
around it. It is in production today.

## How it works

- **A small player on each screen**: every screen runs a small player app written in Rust. One
  codebase covers all the platforms above.
- **One broker in the middle**: each player connects to an MQTT broker and keeps that
  connection open.
- **A server behind the panel**: the web panel is backed by a server written in Go. From the
  panel you send a command or content to one screen, to a group of screens, or to all of them
  at once.
- **Screens report in**: every player tells the server that it is there, so the panel lists
  every connected screen.
- **It starts on its own**: when a screen is turned on, the player starts with it and begins
  playing straight away.

## Why MQTT

MQTT is a publish/subscribe protocol. A sender does not address screens one by one: it sends a
message to a **topic**, and the broker delivers it to every client subscribed to that topic.
So one message to a group's topic reaches every screen in that group, and adding a screen
changes nothing on the sender's side; the new screen simply subscribes. Because each player
keeps one long-lived connection to the broker, a command does not have to open a new
connection to reach it.

## Why Rust and Go

The old software was built on Electron, which bundles a whole web browser into every app. Rust
compiles to one small native program instead, so the player stays light, and the same code
can be built for every platform it runs on.

The server has a different job: it spends most of its time handling many connections at once.
Go's goroutines are cheap enough that each connection can have its own, and Go compiles the server to
a single binary that is simple to deploy.

The source code is private.
