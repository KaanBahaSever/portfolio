---
title: Karecik
shortDescription: Yerel kafe ve restoranların QR menü, müşteri etkileşimi ile menü ve sipariş yönetimi için kullandığı, kesintisiz ve düşük gecikmeli çalışacak şekilde tasarlanmış canlı bir SaaS.
---

## Nedir?

Karecik, yerel kafe ve restoranların müşterileriyle etkileşim kurmak, menülerini ve
siparişlerini yönetmek için kullandığı, canlıda çalışan bir SaaS. Müşteri işletmenin QR kodunu
okuttuğunda menü telefonunda açılır; menü, işletmenin kendi alt alan adından sunulur. İşletme
sahipleri her şeyi bir yönetim panelinden yönetir. Menünün, kod okutulduğu anda açılması
gerekir; bu yüzden servis kesintisiz (zero downtime) ve düşük gecikmeyle çalışacak şekilde
tasarlandı.

## Özellikler

- **Menü düzenleyici**: sürükleyip bırakarak sıralanan kategoriler ve ürünler, satır içi fiyat
  düzenleme ve yuvarlama kurallarıyla toplu, yüzdelik fiyat güncelleme.
- **Şubeler ve menüler**: işletme başına birden çok şube; tüm şubelerle paylaşılan ya da tek
  bir şubeye özel menüler, şube bazında fiyat ve satış durumu ayarları.
- **Altı menü dili**: Türkçe, İngilizce, Almanca, Rusça, Arapça ve Fransızca.
- **Ürün ayrıntıları**: görseller, içindekiler, alerjen uyarıları, kalori bilgisi ve özel
  rozetler.
- **Marka kimliği**: temalar, yazı tipleri, vurgu renkleri, arka planlar ve ayarlanabilir bir
  açılış ekranı; hepsi panelin içindeki canlı mobil önizlemede kontrol edilir.
- **QR kodlar**: PNG olarak indirme, yazdırma ya da menü adresini kopyalama.
- **Müşteri menüsü**: işletmenin alt alan adında (yol tabanlı bir yedekle) sunulur; arama, dil
  değiştirme ve Wi-Fi bilgileri içerir.

## Mimari

Her işletme, tek bir kurulumun kiracısıdır (multi-tenant): gelen istek, alt alan adına göre
ilgili işletmeye eşlenir. Dolayısıyla yeni bir işletme için yeni bir altyapı gerekmez.

| Katman        | Teknoloji                                                        |
| ------------- | ---------------------------------------------------------------- |
| API           | Go 1.22, Fiber v2, pgx; HttpOnly çerezle bellek içi oturumlar    |
| Veritabanı    | Açılışta uygulanan gömülü SQL migration'larıyla PostgreSQL       |
| Ön yüz        | React 18, Vite, Tailwind CSS, dnd-kit                            |
| Kiracılık     | Joker (wildcard) alt alan adı çözümleme, yol tabanlı yedekle     |
| Uç katman     | Cloudflare                                                       |

Kod İngilizce yazıldı; ürünün kendisi Türkçe.

## Lisans

Karecik, GNU Genel Kamu Lisansı v3.0 (GPL-3.0) altında yayımlanan özgür bir yazılım.
[Kaynak kodu GitHub'da](https://github.com/KaanBahaSever/karecik).
