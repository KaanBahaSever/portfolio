---
title: Novacast
shortDescription: A real-time message broadcasting and device orchestration platform, written in Go and designed around low-latency MQTT publish/subscribe pipelines.
isOpenSource: false
liveUrl: https://novacast.app
techStack: [Go, MQTT]
stage: production
since: 2025
featured: true
order: 2
# Only orders entries (newest first among equal `order` values); it is not shown anywhere.
date: 2026-01-01
---

## What it is

Novacast is a high-throughput platform for broadcasting messages in real time and orchestrating
the devices that receive them. It is designed around low-latency publish/subscribe pipelines:
a message published once should reach every device that needs it, quickly, and a fleet of
devices should be steerable from one place. More at [novacast.app](https://novacast.app).

## Where it came from

I developed Novacast in 2025 to replace inadequate legacy software at a computer firm where I
worked. The first version was a prototype in Python. In late 2025 I re-architected it from the
ground up as a performant microservice in Go, built around MQTT; that is the version running in
production today.

## Why publish/subscribe, and why MQTT

In a publish/subscribe system, senders do not address receivers. A publisher sends a message to
a **topic**, a broker keeps track of who has subscribed to which topics, and it delivers the
message to each of them. Adding a device therefore means adding a subscription, not changing
every sender. That decoupling is what broadcasting and device orchestration need: one command
fans out to many receivers, and groups of devices can be addressed through the topics they
listen to.

**MQTT** is a publish/subscribe protocol built for exactly this situation. Clients keep a
long-lived connection to the broker, and every message carries only a small binary header, so
delivery does not pay for a new connection or a verbose envelope each time. The protocol also
lets each message choose its delivery guarantee, from "at most once" to "exactly once", which
is how a pipeline can keep fast paths fast and reliable paths reliable.

## Why Go

A broker-centred system spends most of its time waiting on many connections at once. Go's
goroutines are cheap enough that each connection and each pipeline stage can have its own flow
of control, and channels can hand messages from one stage to the next without locks scattered
through the code. Concurrent code keeps reading like sequential code, and Go compiles it to a
single binary that is simple to deploy.

The source code is private.
