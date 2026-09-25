---
title: NeoSMBIOS
shortDescription: A header-only, zero-copy SMBIOS/DMI parser for C++23 that reads firmware tables without WMI or any OS headers.
isOpenSource: true
repositoryUrl: https://github.com/KaanBahaSever/NeoSMBIOS
techStack: ['C++']
featured: false
order: 6
date: 2026-08-11
---

## What it is

NeoSMBIOS reads the SMBIOS/DMI tables that firmware exposes — board manufacturer, serial
numbers, BIOS version, CPU and memory modules — and hands back typed, bounds-checked views of
them. It is a single header released under the MIT License.

It is a pure decoder: it never touches the firmware itself. You give it a
`std::span<const std::uint8_t>`, so the bytes can come from Win32, sysfs, a memory mapping or a
capture file. That also means no WMI dependency on Windows, and no OS headers anywhere.

## Features

- **One header, no dependencies, no allocations** — `std::span` in, `std::string_view` out.
- **Testable without hardware** — because nothing is read from the machine, the parser can be
  unit-tested against captured tables, with no root or administrator rights.
- **Version-safe** — every field is checked against the record's own length byte first, so asking
  an old BIOS for a newer field returns `std::nullopt` instead of reading past the end.
- **No exceptions** — `std::expected` for parsing, `std::optional` for fields firmware may omit.
- **A plain `.get_xxx()` API** for the common structure types, and `std::ranges` support for
  walking the table.

## Requirements

C++23: GCC 14, Clang 18 or MSVC 19.40 (Visual Studio 2022 17.10) and newer. The header stops the
build with a clear error on older standards.
