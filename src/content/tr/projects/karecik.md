---
title: Karecik
shortDescription: Yerel kafe ve restoranların kullandığı bir QR menü hizmeti. İşletmeler menülerini ve siparişlerini buradan yönetiyor, müşterileriyle de buradan iletişim kuruyor. Kesintisiz ve hızlı çalışsın diye tasarladım.
---

## Nasıl çalışıyor?

Müşteri, işletmenin QR kodunu okutuyor ve menü telefonunda açılıyor. Menü, işletmenin kendi alt
alan adında, yani ona ayrılmış adreste duruyor. İşletme sahibi de her şeyi bir yönetim
panelinden ayarlıyor. Kodu okutan kimse beklemek istemez; hıza ve kesintisiz çalışmaya bu yüzden
çok önem verdim.

Fikir aslında üründen eski. İlk taslaklar ve deneme sürümleri 2021’e dayanıyor; o zamanlar proje
başka adlar taşıyordu. 2026’da bu çalışmayı toparladım ve Karecik adıyla yayına aldım.

## Neler yapılabiliyor?

- **Menü düzenleme**: Kategorileri ve ürünleri sürükleyip bırakarak sıralıyorsunuz, fiyatları da
  doğrudan listede değiştiriyorsunuz. Bütün fiyatları tek seferde bir yüzdeyle de
  güncelleyebilirsiniz; yeni fiyatlar belli kurallara göre yuvarlanıyor.
- **Şubeler**: Bir işletmenin birden çok şubesi olabiliyor. Bir menüyü bütün şubelerde
  kullanabilir ya da tek bir şubeye ayırabilirsiniz. Her şube kendi fiyatlarını belirleyebiliyor,
  hangi ürünlerin satışta olduğunu da kendisi seçebiliyor.
- **Altı dil**: Menüler Türkçe, İngilizce, Almanca, Rusça, Arapça ve Fransızca olabiliyor.
- **Ürün ayrıntıları**: fotoğraflar, içindekiler, alerjen uyarıları, kalori bilgisi ve özel
  rozetler.
- **İşletmeye özel görünüm**: Tema, yazı tipi, vurgu rengi ve arka plan seçilebiliyor; menü
  açılırken çıkan karşılama ekranı da ayarlanabiliyor. Sonucu paneldeki canlı telefon
  önizlemesinde hemen görüyorsunuz.
- **QR kodlar**: PNG olarak indirilebiliyor ya da yazdırılabiliyor. Menünün adresi de
  kopyalanabiliyor.
- **Müşterinin gördüğü menü**: İşletmenin alt alan adında açılıyor; o adres kullanılamazsa diye
  yedek bir adres de var. Müşteriler menüde arama yapabiliyor, dili değiştirebiliyor ve Wi-Fi
  bilgilerini görebiliyor.

## Nasıl kurdum?

Bütün işletmeler tek bir kurulumu paylaşıyor. Sunucu, gelen her isteğin hangi işletmeye ait
olduğunu alt alan adından anlıyor. Yeni bir işletme geldiğinde ayrıca bir şey kurmam gerekmiyor.

| Kısım          | Kullandıklarım                                                                     |
| -------------- | ---------------------------------------------------------------------------------- |
| Sunucu (API)   | Go 1.22, Fiber v2, pgx; oturumlar bellekte, tarayıcı HttpOnly bir çerezle tanınıyor |
| Veri tabanı    | PostgreSQL; tablo değişiklikleri (SQL migration’ları) programa gömülü, açılışta çalışıyor |
| Arayüz         | React 18, Vite, Tailwind CSS; sürükle-bırak için dnd-kit                           |
| İşletme ayrımı | Alt alan adına göre (wildcard); yedek olarak adres yoluna göre                     |
| Altyapı        | Cloudflare                                                                         |

Kodu İngilizce yazdım, uygulamanın kendisi ise Türkçe.

## Lisans

Karecik özgür bir yazılım; GNU Genel Kamu Lisansı v3.0 ile yayımlanıyor.
[Kaynak kodunu GitHub’da görebilirsiniz](https://github.com/KaanBahaSever/karecik).
