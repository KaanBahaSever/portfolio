---
title: i18n-cpp
shortDescription: 'A lightweight, header-only C++ internationalization library: translations in plain .properties files, one per language, looked up by key, with named placeholders filled in at run time.'
isOpenSource: true
repositoryUrl: https://github.com/KaanBahaSever/i18n-cpp
techStack: ['C++']
featured: false
order: 7
# Only orders entries (newest first among equal `order` values); it is not shown anywhere.
date: 2025-06-09
---

## What it is

i18n-cpp is a small internationalization (i18n) library for C++: it lets an application show
its text in the user's language. It is a single header, so there is nothing to compile or link:
include it, load a language and look strings up by key. It is released under the MIT License.

It is small on purpose. It is meant for small and medium-sized applications where a minimal
footprint matters; for very large translation files or complex localization needs, established
tools such as ICU or gettext are the better fit, and the README says so.

## How it works

Translations live in plain `.properties` files, one folder per language:

```text
locales/
├── en/messages.properties
├── es/messages.properties
└── fr/messages.properties
```

Each line maps a key to its text (`greeting=Hello, World!`). Lines that start with `#` are
comments, and whitespace around keys and values is trimmed.

- **`I18n::loadLocale("en")`** reads a language's file and reports whether it could be opened.
- **`I18n::translate(key)`** returns the text for a key, or an empty string when the key is
  missing.
- **`I18n::interpolate(key, values)`** fills named placeholders such as `{name}` from a map of
  values at run time, so `Welcome to our application {name}.` becomes
  `Welcome to our application John.`
- **Short macros**: `_t(key)` and `_f(key, values)`, or the longer `I18N_T` and `I18N_F`, keep
  call sites short.

```cpp
#include "i18n/i18n.hpp"

I18n::loadLocale("en");
std::cout << _t("greeting") << '\n';  // Hello, World!
std::cout << _f("personalized_greeting", {{"name", "John"}}) << '\n';
```

The API is a set of static methods on one class, so there is no object to create or pass around.

## Requirements

The header needs nothing beyond the C++ standard library. The repository includes an example
program with English, Spanish and French sample files; the example builds with CMake as C++11.
