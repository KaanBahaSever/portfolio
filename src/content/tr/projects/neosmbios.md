---
title: NeoSMBIOS
shortDescription: C++23 için tek başlık dosyasından oluşan, sıfır kopyalı bir SMBIOS/DMI ayrıştırıcısı. Firmware tablolarını WMI ya da herhangi bir işletim sistemi başlığı olmadan okur.
---

## Nedir?

NeoSMBIOS, firmware'in sunduğu SMBIOS/DMI tablolarını (anakart üreticisi, seri numaraları,
BIOS sürümü, işlemci ve bellek modülleri) okur ve bunların tipli, sınırları denetlenmiş
görünümlerini döndürür. MIT Lisansı ile yayımlanan tek bir başlık dosyasıdır.

Saf bir çözücüdür: firmware'e hiç dokunmaz. Ona bir `std::span<const std::uint8_t>`
verirsiniz; baytlar Win32'den, sysfs'ten, bir bellek eşlemesinden ya da kaydedilmiş bir
dosyadan gelebilir. Bu, Windows'ta WMI bağımlılığı olmadığı ve hiçbir yerde işletim sistemi
başlığı gerekmediği anlamına da gelir.

## Özellikler

- **Tek başlık dosyası, bağımlılık yok, bellek ayırma yok**: içeri `std::span`, dışarı
  `std::string_view`.
- **Donanım olmadan test edilebilir**: makineden hiçbir şey okunmadığı için ayrıştırıcı, root
  ya da yönetici yetkisi gerekmeden, kaydedilmiş tablolar üzerinde birim testleriyle
  sınanabilir.
- **Sürümden bağımsız güvenlik**: her alan önce kaydın kendi uzunluk baytıyla karşılaştırılır;
  eski bir BIOS'tan daha yeni bir alan istendiğinde kaydın sonunun ötesi okunmaz,
  `std::nullopt` döner.
- **İstisna yok**: ayrıştırma için `std::expected`, firmware'in atlayabileceği alanlar için
  `std::optional`.
- Yaygın yapı türleri için **sade bir `.get_xxx()` API'si** ve tabloyu dolaşmak için
  `std::ranges` desteği.

## Gereksinimler

C++23: GCC 14, Clang 18 ya da MSVC 19.40 (Visual Studio 2022 17.10) ve sonrası. Başlık
dosyası, daha eski standartlarda derlemeyi açık bir hata mesajıyla durdurur.
