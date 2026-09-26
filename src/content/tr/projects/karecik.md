---
title: Karecik
shortDescription: Yerel kafe ve restoranların QR menü, müşteri etkileşimi, menü ve sipariş yönetimi için kullandığı, canlıda çalışan bir SaaS. Kesintisiz ve düşük gecikmeyle çalışacak şekilde tasarlandı.
---

## Nedir?

Karecik, yerel kafe ve restoranların müşterileriyle etkileşim kurmak, menülerini ve
siparişlerini yönetmek için kullandığı bir SaaS. Şu anda canlıda. Müşteri işletmenin QR kodunu
okuttuğunda, menü telefonunda açılır. Menü, işletmenin kendi alt alan adından gelir. İşletme
sahipleri de her şeyi bir yönetim panelinden ayarlar. Menü, kod okutulduğu anda açılmalı. Bu
yüzden servis kesintisiz ve düşük gecikmeyle çalışacak şekilde tasarlandı.

Fikir aslında üründen eski. Konsept ve ilk deneysel prototipler 2021’e dayanıyor. Proje o
dönemde başka adlarla anılıyordu. 2026’da bu çalışmayı toparlayıp Karecik adıyla canlıya
aldım.

## Özellikler

- **Menü düzenleyici**: Kategoriler ve ürünler sürükle-bırak ile sıralanır, fiyatlar listede
  doğrudan düzenlenir. Fiyatlar yüzdeyle toplu olarak da güncellenebilir; bu sırada yuvarlama
  kuralları uygulanır.
- **Şubeler ve menüler**: Bir işletmenin birden çok şubesi olabilir. Bir menü bütün şubelerde
  ortak kullanılabilir ya da tek bir şubeye özel olabilir. Her şube, fiyatları ve hangi
  ürünlerin satışta olduğunu kendine göre değiştirebilir.
- **Altı dilde menü**: Türkçe, İngilizce, Almanca, Rusça, Arapça ve Fransızca.
- **Ürün ayrıntıları**: fotoğraflar, içindekiler, alerjen uyarıları, kalori bilgisi ve özel
  rozetler.
- **Marka görünümü**: temalar, yazı tipleri, vurgu renkleri, arka planlar ve ayarlanabilir bir
  açılış ekranı. Hepsi panelin içindeki canlı mobil önizlemede kontrol edilebilir.
- **QR kodlar**: PNG olarak indirilebilir ya da yazdırılabilir. Menü adresi de kopyalanabilir.
- **Müşteri menüsü**: İşletmenin alt alan adında açılır; yedek olarak yol tabanlı bir adres de
  var. Müşteriler menüde arama yapabilir, dili değiştirebilir ve Wi-Fi bilgilerini görebilir.

## Mimari

Bütün işletmeler aynı kurulumu paylaşır; her işletme bu kurulumun bir kiracısıdır (tenant).
Gelen isteğin hangi işletmeye ait olduğu alt alan adından anlaşılır. Bu yüzden yeni bir
işletme için yeni bir altyapı kurmak gerekmez.

| Katman        | Teknoloji                                                            |
| ------------- | -------------------------------------------------------------------- |
| API           | Go 1.22, Fiber v2, pgx; HttpOnly çerezli, bellekte tutulan oturumlar |
| Veritabanı    | PostgreSQL; gömülü SQL migration’ları uygulama açılırken çalışır     |
| Ön yüz        | React 18, Vite, Tailwind CSS, dnd-kit                                |
| Kiracı yapısı | Wildcard alt alan adı çözümlemesi; yedek olarak yol tabanlı adres    |
| Altyapı       | Cloudflare                                                           |

Kodu İngilizce yazdım; ürün ise Türkçe.

## Lisans

Karecik özgür bir yazılım. GNU Genel Kamu Lisansı v3.0 ile yayımlanıyor.
[Kaynak kodunu GitHub’da görebilirsiniz](https://github.com/KaanBahaSever/karecik).
