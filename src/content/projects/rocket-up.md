---
title: Rocket-Up — High-Power Rocket Simulation
shortDescription: A high-power rocket flight simulation that began in 2020 as a narrow Python prototype and is now being rewritten from scratch as an open-source aerodynamic simulation engine in modern C++.
isOpenSource: true
repositoryUrl: https://github.com/KaanBahaSever/Rocket-Up
techStack: ['C++']
stage: in-development
since: 2020
featured: false
order: 5
date: 2024-12-14
---

## What it is

Rocket-Up is my high-power rocket flight simulation. It is one project that has changed shape
over time, not two separate ones: it began in 2020 as a Python prototype, and I am now
rewriting it completely as a dynamic, modern C++ aerodynamic simulation engine. The new engine
is open source under the MIT License.

## From prototype to engine

The 2020 prototype was narrow and purpose-built: it was written for one job, not as a general
tool.

The rewrite starts from the other end. Instead of one fixed model, a simulation is put together
from parts: a rocket is assembled from components, it flies through the environment of a
planet, and the flight is described by parameters rather than written into the code. C++ gives
the physics loop the performance it needs, and a clean architecture keeps each part of the
physics in its own place, so it can be tested, improved or replaced without touching the rest.

## What is in the repository

The rewrite is at an early stage. The public repository already has:

- **Modular rocket components**: separate classes for the rocket, its engine and recovery
  hardware such as a parachute.
- **Engine model**: specific impulse, propellant mass, a configurable thrust curve, throttling
  and thrust corrected for atmospheric pressure.
- **Environments and planets**: an Earth model computes temperature and pressure by altitude
  from the layers of the 1976 US Standard Atmosphere, and the planet classes are built to be
  extended.
- **Configurable flight parameters**, plus small vector and matrix math helpers.

It builds with CMake.

## Roadmap

- More rocket components: fins, body tubes and nose cones.
- Integration with physics libraries for more accurate simulations.
- Multiple planetary environments.
- Better performance, including GPU acceleration.

## Background

The simulation belongs to the same thread as my rocketry work. From 2019 to 2022 I was Vice
President of the Istanbul University Rocket Club, where our team designed and built three
rockets: one low-altitude rocket (5,000 ft) and two high-altitude rockets (10,000 ft). I was
the sole author of their flight avionics firmware and of the parachute deployment control
system. The [About page](/about/#journey) tells that story, from the avionics to this
simulation.
