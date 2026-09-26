---
title: i18n-cpp
shortDescription: C++ için küçük, tek dosyalık bir çoklu dil kütüphanesi. Her dilin çevirileri düz bir .properties dosyasında duruyor ve her metin kendi adıyla bulunuyor. Metinde boş bırakılan yerler program çalışırken dolduruluyor.
---

## Nedir?

i18n-cpp, C++ için yazdığım küçük bir çoklu dil (i18n) kütüphanesi: Programınızdaki yazıları
kullanıcının dilinde göstermenizi sağlıyor. MIT Lisansı ile yayımladım.

Kütüphanenin tamamı tek bir başlık dosyası; ayrıca derleyip bağlamanız gereken bir şey yok.
Dosyayı `#include` ile ekliyor, bir dil yüklüyor ve metinleri anahtarlarıyla, yani her metne
verdiğiniz adla buluyorsunuz.

Kütüphaneyi bilerek küçük tuttum; az yer kaplamanın önemli olduğu küçük ve orta boy programlar
için yazdım. Çeviri dosyalarınız çok büyükse ya da işiniz daha karmaşıksa ICU veya gettext gibi
köklü araçlar daha uygun. README dosyasında da bunu açıkça yazıyorum.

## Nasıl çalışıyor?

Çeviriler düz metin dosyalarında (`.properties`) duruyor. Her dilin kendi klasörü var:

```text
locales/
├── en/messages.properties
├── es/messages.properties
└── fr/messages.properties
```

Her satır, `greeting=Hello, World!` gibi bir anahtar ve metninden oluşuyor. `#` ile
başlayan satırlar açıklama sayılıp atlanıyor; anahtarların ve metinlerin başındaki ya da
sonundaki boşluklar siliniyor.

- **`I18n::loadLocale("en")`** bir dilin dosyasını okuyor ve açılıp açılamadığını söylüyor.
- **`I18n::translate(key)`** anahtarın metnini, anahtar yoksa boş bir metin veriyor.
- **`I18n::interpolate(key, values)`** metinde `{name}` gibi boş bırakılan yerleri, program
  çalışırken verdiğiniz değerlerle dolduruyor. Böylece `Welcome to our application {name}.`
  metni `Welcome to our application John.` oluyor.
- **Kısayollar**: `_t(key)` ve `_f(key, values)` makroları (uzun adlarıyla `I18N_T` ve
  `I18N_F`) kodu kısa tutuyor.

```cpp
#include "i18n/i18n.hpp"

I18n::loadLocale("en");
std::cout << _t("greeting") << '\n';  // Hello, World!
std::cout << _f("personalized_greeting", {{"name", "John"}}) << '\n';
```

Bu işlevlerin hepsi tek bir sınıfta duruyor ve doğrudan çağrılıyor. Oluşturup oradan oraya
taşımanız gereken bir nesne yok.

## Ne gerekiyor?

C++’ın standart kütüphanesi dışında hiçbir şey gerekmiyor. Projede bir de örnek program var:
İngilizce, İspanyolca ve Fransızca çeviri dosyalarıyla geliyor ve CMake ile C++11 olarak
derleniyor.
