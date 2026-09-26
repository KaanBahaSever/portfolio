---
title: i18n-cpp
shortDescription: Çoklu dil desteği için hafif, tek başlık dosyasından oluşan bir C++ kütüphanesi. Çeviriler her dil için düz bir .properties dosyasında durur ve anahtarla bulunur. İsimli yer tutucular çalışma zamanında doldurulur.
---

## Nedir?

i18n-cpp, C++ için küçük bir uluslararasılaştırma (i18n) kütüphanesi. Bir uygulamanın
metinlerini kullanıcının dilinde göstermesine yarar. Tek bir başlık dosyasından oluştuğu için
ayrıca derlemeniz ya da bağlamanız gereken bir şey yok: Dosyayı `#include` ile ekliyor, bir
dil yüklüyor ve metinleri anahtarlarıyla buluyorsunuz. MIT Lisansı ile yayımlandı.

Kütüphaneyi bilerek küçük tuttum. Az yer kaplamanın önemli olduğu küçük ve orta ölçekli
uygulamalar için yazdım. Çok büyük çeviri dosyaları ya da karmaşık yerelleştirme
ihtiyaçları için ICU veya gettext gibi köklü araçlar daha uygun. README dosyası da bunu açıkça
söylüyor.

## Nasıl çalışır?

Çeviriler düz `.properties` dosyalarında durur. Her dilin kendi klasörü vardır:

```text
locales/
├── en/messages.properties
├── es/messages.properties
└── fr/messages.properties
```

Her satır bir anahtarı bir metne bağlar (`greeting=Hello, World!`). `#` ile başlayan satırlar
yorum sayılır. Anahtarların ve değerlerin başındaki ve sonundaki boşluklar atılır.

- **`I18n::loadLocale("en")`** bir dilin dosyasını okur ve dosyanın açılıp açılamadığını
  bildirir.
- **`I18n::translate(key)`** bir anahtarın metnini döndürür. Anahtar yoksa boş bir dize
  döndürür.
- **`I18n::interpolate(key, values)`**, `{name}` gibi isimli yer tutucuları çalışma zamanında
  bir map’teki değerlerle doldurur. Böylece `Welcome to our application {name}.` metni
  `Welcome to our application John.` olur.
- **Kısa makrolar**: `_t(key)` ve `_f(key, values)` makroları (ya da daha uzun adlarıyla
  `I18N_T` ve `I18N_F`) çağrıları kısa tutar.

```cpp
#include "i18n/i18n.hpp"

I18n::loadLocale("en");
std::cout << _t("greeting") << '\n';  // Hello, World!
std::cout << _f("personalized_greeting", {{"name", "John"}}) << '\n';
```

API, tek bir sınıfın statik metotlarından oluşur. Bu yüzden oluşturmanız ya da oradan oraya
taşımanız gereken bir nesne yoktur.

## Gereksinimler

Başlık dosyası, C++ standart kütüphanesi dışında hiçbir şey gerektirmez. Depoda bir de örnek
program var. Program İngilizce, İspanyolca ve Fransızca örnek dosyalarla birlikte geliyor ve
CMake ile C++11 olarak derleniyor.
