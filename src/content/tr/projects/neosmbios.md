---
title: NeoSMBIOS
shortDescription: Bilgisayarın donanım bilgilerini tutan SMBIOS/DMI tablolarını okuyan, C++23 ile yazılmış tek dosyalık bir kütüphane. Veriyi kopyalamadan çalışıyor; ne WMI ne de işletim sisteminin başlık dosyaları gerekiyor.
---

## Nedir?

NeoSMBIOS, bilgisayarın donanım bilgilerini okuyan bir C++ kütüphanesi. Anakarttaki gömülü
yazılım bu bilgileri SMBIOS/DMI tablolarında sunuyor: anakart üreticisi, seri numaraları, BIOS
sürümü, işlemci ve bellek modülleri gibi. Kütüphane bu tabloları çözüp her bilgiyi doğru türüyle
veriyor ve okurken tablonun dışına hiç taşmıyor. Tek bir başlık dosyası; MIT Lisansı ile
yayımladım.

Gömülü yazılıma hiç dokunmuyor, yalnızca veriyi çözüyor. Baytları ona siz veriyorsunuz
(`std::span<const std::uint8_t>`): Windows’ta Win32’den, Linux’ta sysfs’ten, bellekten ya da
kaydedilmiş bir dosyadan. Bu yüzden ne Windows’ta WMI gerekiyor ne de işletim sisteminin başlık
dosyaları.

## Neler sunuyor?

- **Tek dosya, başka kütüphane ya da ek bellek gerekmiyor**: `std::span` giriyor,
  `std::string_view` çıkıyor, hiçbir şey kopyalanmıyor.
- **Donanım olmadan test**: Makineden bir şey okumadığı için kaydedilmiş tablolarla, yönetici
  (root) yetkisi olmadan test edilebiliyor.
- **Sürüm farklarına dayanıklı**: Her alan okunmadan önce, kaydın kendi uzunluğunu söyleyen
  bayta bakılıyor. Eski bir BIOS’tan yeni bir alan istenirse kaydın sonu aşılmıyor,
  `std::nullopt` (“yok”) geliyor.
- **İstisna fırlatmıyor**: Hatalar programın akışını kesmiyor, dönen değerle bildiriliyor.
  Tablo çözülürken `std::expected`, gömülü yazılımın vermeyebileceği alanlarda `std::optional`
  kullanılıyor.
- Sık kullanılan kayıt türleri için **sade `.get_xxx()` işlevleri**, tabloyu gezmek için de
  `std::ranges` desteği.

## Ne gerekiyor?

C++23 gerekiyor: GCC 14, Clang 18, MSVC 19.40 (Visual Studio 2022 17.10) ya da daha yenisi. Daha
eski bir standartla derlerseniz başlık dosyası anlaşılır bir hata verip derlemeyi durduruyor.
