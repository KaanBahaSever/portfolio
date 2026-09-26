---
title: Karecik
shortDescription: Yerel kafe ve restoranların kullandığı bir QR menü hizmeti. İşletmeler menülerini ve siparişlerini buradan yönetiyor, müşterileriyle de buradan iletişim kuruyor. Kesintisiz ve hızlı çalışsın diye tasarladım.
---

## Nedir?

Müşteri, işletmenin QR kodunu okutuyor ve menü telefonunda açılıyor. Her işletmenin kendine ait
bir adresi (alt alan adı) var; menü o adreste. İşletme sahibi de her şeyi bir yönetim panelinden
ayarlıyor. Kodu okutan kimse beklemek istemez. Bu yüzden hıza ve kesintisiz çalışmaya çok önem
verdim.

Aslında fikir de ilk deneme sürümleri de 2021’e dayanıyor; projeye o zamanlar başka adlar
vermiştim. 2026’da bu çalışmayı toparladım ve Karecik adıyla yayına aldım.

## Neler var?

- **Menü düzenleme**: Kategorileri ve ürünleri sürükleyip bırakarak sıralıyorsunuz, fiyatları da
  doğrudan listede değiştiriyorsunuz. Fiyatları yüzde olarak topluca artırıp azaltmak da mümkün;
  yeni tutarlar belli kurallara göre yuvarlanıyor.
- **Şubeler**: Bir işletmenin birden çok şubesi olabiliyor. Bir menüyü bütün şubelerde
  kullanabilir ya da tek bir şubeye ayırabilirsiniz. Her şube kendi fiyatlarını belirleyebiliyor,
  hangi ürünleri satacağını da kendisi seçebiliyor.
- **Altı dil**: Menüler Türkçe, İngilizce, Almanca, Rusça, Arapça ve Fransızca olabiliyor.
- **Ürün ayrıntıları**: fotoğraflar, içindekiler, alerjen uyarıları, kalori bilgisi ve özel
  rozetler.
- **İşletmeye özel görünüm**: Tema, yazı tipi, vurgu rengi ve arka planı seçebilir, menü açılırken
  çıkan karşılama ekranını da ayarlayabilirsiniz. Sonucu paneldeki canlı telefon önizlemesinde
  hemen görürsünüz.
- **QR kodlar**: Kodu PNG olarak indirebilir, yazdırabilir ya da menünün adresini
  kopyalayabilirsiniz.
- **Müşterinin gördüğü menü**: İşletmenin kendi adresinde açılıyor, yedek bir adresi de var.
  Müşteriler menüde arama yapabiliyor, dili değiştirebiliyor ve Wi-Fi bilgilerini görebiliyor.

## Nasıl kurdum?

Bütün işletmeler aynı sistemi kullanıyor. Sunucu, gelen her isteğin hangi işletmeye ait olduğunu
alt alan adından anlıyor. Bu yüzden yeni bir işletme eklendiğinde ayrıca bir şey kurmam
gerekmiyor.

| Kısım          | Kullandıklarım                                                                                |
| -------------- | --------------------------------------------------------------------------------------------- |
| Sunucu (API)   | Go 1.22, Fiber v2, pgx; oturumlar bellekte tutuluyor, tarayıcı HttpOnly bir çerezle tanınıyor |
| Veri tabanı    | PostgreSQL; tablo değişiklikleri (SQL migration’ları) programın içinde, açılışta uygulanıyor  |
| Arayüz         | React 18, Vite, Tailwind CSS; sürükle-bırak için dnd-kit                                      |
| İşletme ayrımı | Alt alan adına göre (wildcard); yedek olarak adres yoluna göre                                |
| Altyapı        | Cloudflare                                                                                    |

Kodu İngilizce yazdım, uygulamanın kendisi ise Türkçe.

## Lisans

Karecik özgür bir yazılım; GNU Genel Kamu Lisansı v3.0 ile yayımlanıyor.
[Kaynak kodunu GitHub’da görebilirsiniz](https://github.com/KaanBahaSever/karecik).
