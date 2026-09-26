---
title: i18n-cpp
shortDescription: C++ için hafif, tek başlık dosyasından oluşan bir uluslararasılaştırma kütüphanesi. Çeviriler dil başına bir .properties dosyasında durur ve anahtarla bulunur; adlandırılmış yer tutucular çalışma zamanında doldurulur.
---

## Nedir?

i18n-cpp, C++ için küçük bir uluslararasılaştırma (i18n) kütüphanesi: bir uygulamanın
metinlerini kullanıcının dilinde göstermesini sağlar. Tek bir başlık dosyasından oluştuğu için
derlenecek ya da bağlanacak (link) bir şey yoktur: dosyayı projeye eklersiniz, bir dil
yüklersiniz ve metinleri anahtarlarıyla çağırırsınız. MIT Lisansı ile yayımlanıyor.

Bilerek küçük tutuldu: az yer kaplamanın önemli olduğu küçük ve orta ölçekli uygulamalar için
tasarlandı. Çok büyük çeviri dosyaları ya da karmaşık yerelleştirme ihtiyaçları için ICU veya
gettext gibi yerleşik araçlar daha uygun; README de bunu açıkça belirtiyor.

## Nasıl çalışır?

Çeviriler, her dil için ayrı bir klasörde duran düz `.properties` dosyalarında tutulur:

```text
locales/
├── en/messages.properties
├── es/messages.properties
└── fr/messages.properties
```

Her satır bir anahtarı metnine eşler (`greeting=Hello, World!`). `#` ile başlayan satırlar
yorum sayılır; anahtarların ve değerlerin başındaki ve sonundaki boşluklar kırpılır.

- **`I18n::loadLocale("en")`** bir dilin dosyasını okur ve dosyanın açılıp açılamadığını
  bildirir.
- **`I18n::translate(key)`** bir anahtarın metnini döndürür; anahtar yoksa boş bir dize döner.
- **`I18n::interpolate(key, values)`**, `{name}` gibi adlandırılmış yer tutucuları çalışma
  zamanında bir değer eşlemesinden (map) doldurur. Böylece
  `Welcome to our application {name}.` metni `Welcome to our application John.` olur.
- **Kısa makrolar**: `_t(key)` ve `_f(key, values)` ya da daha uzun `I18N_T` ve `I18N_F`,
  çağrıların yapıldığı yerleri kısa tutar.

```cpp
#include "i18n/i18n.hpp"

I18n::loadLocale("en");
std::cout << _t("greeting") << '\n';  // Hello, World!
std::cout << _f("personalized_greeting", {{"name", "John"}}) << '\n';
```

API, tek bir sınıfın statik metotlarından oluşur; oluşturulacak ya da bir yerden bir yere
aktarılacak bir nesne yoktur.

## Gereksinimler

Başlık dosyası, C++ standart kütüphanesi dışında hiçbir şeye ihtiyaç duymaz. Depoda İngilizce,
İspanyolca ve Fransızca örnek dosyalarla birlikte bir örnek program bulunur; örnek program CMake
ile C++11 olarak derlenir.
