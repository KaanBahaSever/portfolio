---
title: Karecik
shortDescription: Yerel kafe ve restoranlar için bir QR menü hizmeti. Müşteri kodu okutuyor, menü telefonunda açılıyor; işletme sahibi de menüyü bir panelden güncel tutuyor. Bir arkadaşımın kafesi için yaptığım menüyle başladı.
---

## Nasıl başladı?

Karecik, ortaokuldan bir arkadaşım kafe açınca başladı. Önce ona bir QR menü yaptım ama bu menü
sabit bir sayfaydı. Sonra onun isteğiyle eksiksiz bir adisyon sistemi (POS) yapmaya giriştim.
Ama zamanında yetiştiremedim. Biz de onun yerine çok daha ayrıntılı, dinamik bir QR menü
uygulamasını yayına aldık. Arkadaşım yıllardır bu uygulamayı kullanıyor. Bu sürede iki şube daha açtı; artık üç
şubesinde de Karecik var.

İlk sürümler 2021’e dayanıyor; projeye o zamanlar başka adlar vermiştim. 2026’da bu çalışmayı
toparladım ve Karecik adıyla yayına aldım.

## Nedir?

Karecik, yerel kafe ve restoranların kullandığı bir QR menü hizmeti. Müşteri, işletmenin QR
kodunu okutuyor ve menü telefonunda açılıyor. Her işletmenin kendine ait bir adresi (alt alan
adı) var; menü o adreste. İşletme sahibi de menülerini bir yönetim panelinden düzenliyor. Kodu
okutan kimse beklemek istemez. Bu yüzden hıza ve kesintisiz çalışmaya çok önem verdim.

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
