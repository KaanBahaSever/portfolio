---
title: i18n-cpp
shortDescription: C++ için küçük, tek dosyalık bir çoklu dil kütüphanesi. Her dilin çevirileri düz bir .properties dosyasında duruyor. Metinler kısa adlarıyla bulunuyor; isim gibi değerler program çalışırken yerine konuyor.
---

## Nedir?

i18n-cpp, C++ için yazdığım küçük bir çoklu dil (i18n) kütüphanesi. Programınızın yazılarını
kullanıcının dilinde göstermenizi sağlıyor. MIT Lisansı ile yayımladım.

Tek bir başlık dosyasından ibaret; ayrıca derlenecek ya da bağlanacak bir şey yok. Dosyayı
`#include` ile ekliyor, bir dil yüklüyor ve metinleri anahtarlarıyla, yani onlara verdiğiniz kısa
adlarla buluyorsunuz.

Kütüphaneyi bilerek küçük tuttum; az yer kaplamanın önemli olduğu küçük ve orta boy programlar
için yazdım. Çeviri dosyalarınız çok büyükse ya da işiniz daha karmaşıksa ICU veya gettext gibi
köklü araçlar daha uygun. README’de de bunu açıkça yazıyorum.

## Nasıl çalışıyor?

Çeviriler düz `.properties` dosyalarında duruyor. Her dilin kendi klasörü var:

```text
locales/
├── en/messages.properties
├── es/messages.properties
└── fr/messages.properties
```

Her satırda bir anahtar ve metni var: `greeting=Hello, World!`. `#` ile başlayan satırlar
açıklama sayılıp atlanıyor; anahtarların ve metinlerin başındaki ya da sonundaki boşluklar
siliniyor.

- **`I18n::loadLocale("en")`** bir dilin dosyasını okuyor ve dosyanın açılıp açılamadığını
  söylüyor.
- **`I18n::translate(key)`** anahtarın metnini, anahtar yoksa boş bir metin veriyor.
- **`I18n::interpolate(key, values)`**, metinde `{name}` gibi boş bırakılan yerleri program
  çalışırken verdiğiniz değerlerle dolduruyor. Böylece `Welcome to our application {name}.`
  metni `Welcome to our application John.` oluyor.
- **Kısa adlar**: `_t(key)` ve `_f(key, values)` makroları (uzun adlarıyla `I18N_T` ve
  `I18N_F`) çağrıları kısa tutuyor.

```cpp
#include "i18n/i18n.hpp"

I18n::loadLocale("en");
std::cout << _t("greeting") << '\n';  // Hello, World!
std::cout << _f("personalized_greeting", {{"name", "John"}}) << '\n';
```

Bu işlevlerin hepsi tek bir sınıfta duruyor ve doğrudan çağrılıyor. Oluşturup oradan oraya
taşımanız gereken bir nesne yok.

## Ne gerekiyor?

C++’ın standart kütüphanesi dışında hiçbir şey gerekmiyor. Depoda bir de örnek program var.
İngilizce, İspanyolca ve Fransızca çeviri dosyalarıyla geliyor; CMake ile C++11 olarak derleniyor.
