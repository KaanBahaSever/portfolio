---
title: NeoSMBIOS
shortDescription: C++23 için tek başlık dosyasından oluşan, veriyi kopyalamadan çalışan bir SMBIOS/DMI ayrıştırıcısı. Firmware tablolarını WMI ya da işletim sistemi başlık dosyaları olmadan okur.
---

## Nedir?

NeoSMBIOS, firmware’in sunduğu SMBIOS/DMI tablolarını okur. Bu tablolarda anakart üreticisi,
seri numaraları, BIOS sürümü, işlemci ve bellek modülleri gibi bilgiler bulunur. Kütüphane bu
bilgileri tipi belli, sınır kontrolü yapılmış view’lar olarak döndürür. MIT Lisansı ile yayımlanan
tek bir başlık dosyasıdır.

NeoSMBIOS yalnızca veriyi çözer; firmware’in kendisine hiç dokunmaz. Ona bir
`std::span<const std::uint8_t>` verirsiniz; baytlar Win32’den, sysfs’ten, bir bellek
eşlemesinden ya da kaydedilmiş bir dosyadan gelebilir. Bu yüzden Windows’ta WMI bağımlılığı
olmaz, hiçbir yerde de işletim sistemi başlık dosyası gerekmez.

## Özellikler

- **Tek başlık dosyası, bağımlılık yok, bellek ayırma yok**: girdi `std::span`, çıktı
  `std::string_view`.
- **Donanım olmadan test edilebilir**: Makineden hiçbir şey okunmadığı için ayrıştırıcı,
  kaydedilmiş tablolarla birim testinden geçirilebilir. Root ya da yönetici yetkisi de
  gerekmez.
- **Sürüm farklarına dayanıklı**: Her alan okunmadan önce kaydın kendi uzunluk baytıyla
  karşılaştırılır. Eski bir BIOS’tan yeni bir alan istendiğinde kaydın sonu aşılmaz;
  `std::nullopt` döner.
- **İstisna fırlatmaz**: Ayrıştırmada `std::expected`, firmware’in vermeyebileceği alanlarda
  `std::optional` kullanılır.
- Yaygın yapı türleri için **sade bir `.get_xxx()` API’si**, tabloyu dolaşmak için de
  `std::ranges` desteği.

## Gereksinimler

C++23 gerekir: GCC 14, Clang 18 ya da MSVC 19.40 (Visual Studio 2022 17.10) ve sonrası. Daha
eski bir standartla derlerseniz başlık dosyası anlaşılır bir hata verip derlemeyi durdurur.
