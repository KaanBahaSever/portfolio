---
title: NeoSMBIOS
shortDescription: BIOS’un sunduğu donanım bilgilerini (SMBIOS/DMI tablolarını) okuyan, C++23 ile yazılmış tek dosyalık bir kütüphane. Veriyi kopyalamadan çalışıyor; ne WMI ne de işletim sisteminin başlık dosyaları gerekiyor.
---

## Nedir?

NeoSMBIOS, bilgisayarın donanım bilgilerini okuyan bir C++ kütüphanesi. Anakarttaki gömülü
yazılım (BIOS) bu bilgileri SMBIOS/DMI tabloları hâlinde sunuyor: anakart üreticisi, seri
numaraları, BIOS sürümü, işlemci ve bellek modülleri gibi. Kütüphane bu tabloları çözüp her
bilgiyi türü belli ve sınırları kontrol edilmiş olarak veriyor. MIT Lisansı ile yayımlanan tek
bir başlık dosyası.

Yalnızca veriyi çözüyor, gömülü yazılıma hiç dokunmuyor. Baytları ona siz veriyorsunuz
(`std::span<const std::uint8_t>`); Windows’ta Win32’den, Linux’ta sysfs’ten, bellekten ya da
kaydedilmiş bir dosyadan gelebilirler. Bu yüzden ne Windows’ta WMI gerekiyor ne de işletim sisteminin
başlık dosyaları.

## Neler sunuyor?

- **Tek dosya, başka kütüphane yok, ek bellek yok**: `std::span` giriyor, `std::string_view`
  çıkıyor; hiçbir şey kopyalanmıyor.
- **Donanım olmadan test**: Makineden hiçbir şey okunmadığı için kaydedilmiş tablolarla, yönetici
  (root) yetkisi olmadan test edilebiliyor.
- **Sürüm farklarına dayanıklı**: Her alan önce kaydın kendi uzunluk baytıyla karşılaştırılıyor.
  Eski bir BIOS’tan yeni bir alan istenirse kaydın sonu aşılmıyor, `std::nullopt` (“yok”) geliyor.
- **İstisna fırlatmıyor**, yani sorunlar programın akışını kesmiyor: Tablo çözülürken
  `std::expected`, BIOS’un vermeyebileceği alanlarda `std::optional` kullanılıyor.
- Sık kullanılan kayıt türleri için **sade `.get_xxx()` işlevleri**, tabloyu dolaşmak için de
  `std::ranges` desteği.

## Ne gerekiyor?

C++23 gerekiyor: GCC 14, Clang 18, MSVC 19.40 (Visual Studio 2022 17.10) ya da daha yenisi. Daha
eski bir standartla derlerseniz başlık dosyası, anlaşılır bir hatayla derlemeyi durduruyor.
