---
title: Rocket-Up (Rocket Flight Simulation)
shortDescription: An early-stage, modular C++ library for simulating rocket flight, from engine thrust to atmospheric conditions.
isOpenSource: true
repositoryUrl: https://github.com/KaanBahaSever/Rocket-Up
techStack: [C++, CMake]
featured: true
order: 5
date: 2024-12-14
---

## What it is

Rocket-Up is a C++ library for modelling the different parts of a rocket flight, from
engine thrust to the atmosphere the rocket flies through. It is built with CMake
(C++17) and released under the MIT License.

## Features

- **Modular rocket components**: separate classes for the rocket, its engine and
  recovery hardware such as a parachute.
- **Engine model**: specific impulse, propellant mass, a configurable thrust curve,
  throttling and thrust corrected for atmospheric pressure.
- **Expandable environments and planets**: an Earth model computes temperature and
  pressure by altitude using the layers of the 1976 US Standard Atmosphere.
- **Configurable flight parameters**, plus small vector and matrix math helpers.

## Roadmap

The project is at an early stage. Planned next steps:

- More rocket components: fins, body tubes and nose cones.
- Integration with physics libraries for more accurate simulations.
- Multiple planetary environments.
- Better performance, including GPU acceleration.

## Background

From 2019 to 2022 I was Vice President of the Istanbul University Rocket Club, whose team
built a medium-altitude rocket with custom guidance and control software.
