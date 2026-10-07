---
title: Novacast
shortDescription: Farklı modellerdeki birçok ekranı tek bir web panelinden yönetmeye yarayan bir yazılım. Windows, macOS, Linux, Samsung TV, LG TV ve Android TV’de çalışıyor; ekran açılır açılmaz içerik göstermeye başlıyor.
---

## Nedir?

Novacast, birçok ekranı tek bir yerden kontrol etmeye yarayan bir yazılım. Ekranların modeli ve
işletim sistemi farklı olabilir; hepsi bir web paneli üzerinden yönetiliyor. İngilizcede bu tür
yazılımlara “digital signage” deniyor. Ayrıntılar [novacast.app](https://novacast.app)
adresinde.

Windows, macOS, Linux, Samsung TV, LG TV ve Android TV’de çalışıyor. Her birine kolayca
kurulabiliyor. Ekranı bir kez kurduktan sonra onu ağ üzerinden, istediğiniz yerden
yönetebiliyorsunuz.

Novacast’i genelde kurumsal şirketler kullanıyor. Şirketler onunla bütün ekranlarında reklam
videoları ya da fotoğraf galerileri gösteriyor ve bu ekranları kolayca yönetiyor. Ekran ilk
açıldığında Novacast hemen çalışmaya başlıyor.

## Nasıl ortaya çıktı?

Çalıştığım bir bilgisayar firmasında bu işi yapan bir yazılım zaten vardı. Ama hantaldı
(Electron ile yazılmıştı) ve ihtiyaçlarımıza yetmiyordu. Sisteme bağlı ekranların hepsini
listelemiyordu bile. 2025’te Novacast’i onun yerine geçsin diye geliştirdik. Bu sorunların
hepsini çözdük ve Novacast’i çok daha sağlam bir temel üzerine kurduk. Gereken altyapıyı da
hazırladık. Novacast bugün canlıda çalışıyor.

## Nasıl çalışıyor?

- **Her ekranda küçük bir oynatıcı**: Her ekranda Rust ile yazılmış küçük bir oynatıcı
  uygulaması çalışıyor. Yukarıdaki bütün platformlar için tek bir kod tabanı var.
- **Ortada bir aracı**: Her oynatıcı bir MQTT aracısına (broker) bağlanıyor ve bu bağlantıyı
  açık tutuyor.
- **Panelin arkasında bir sunucu**: Web paneli, Go ile yazılmış bir sunucuyla çalışıyor.
  Panelden tek bir ekrana, bir ekran grubuna ya da bütün ekranlara birden komut ve içerik
  gönderiyorsunuz.
- **Her ekran kendini bildiriyor**: Her oynatıcı sunucuya “buradayım” diyor. Panel de bu sayede
  bağlı ekranların hepsini listeliyor.
- **Kendiliğinden başlıyor**: Ekran açılınca oynatıcı da açılıyor ve hemen içeriği göstermeye
  başlıyor.

## Neden MQTT?

MQTT, yayıncı/abone (pub/sub) modeliyle çalışan bir mesajlaşma protokolü. Gönderen, mesajı
ekranlara tek tek yollamıyor; bir **konuya** bırakıyor. Aradaki aracı da mesajı o konuyu
dinleyen herkese iletiyor. Tıpkı radyo gibi: Yayın bir kez yapılıyor, o istasyonu açan herkes
duyuyor.

Bu model Novacast’in işine çok yarıyor. Bir grubun konusuna gönderilen tek bir mesaj, o
gruptaki bütün ekranlara ulaşıyor. Yeni bir ekran eklerken gönderen tarafta hiçbir şey
değişmiyor; yeni ekran doğru konuya abone oluyor, o kadar. Her oynatıcı aracıya bir kez
bağlanıp bağlantıyı açık tuttuğu için her komutta yeni bir bağlantı açmak da gerekmiyor.

## Neden Rust ve Go?

Eski yazılım Electron ile yazılmıştı. Electron her uygulamanın içine koca bir web tarayıcısı
koyuyor. Rust ise kodu, cihazda doğrudan çalışan tek ve küçük bir programa derliyor. Böylece
oynatıcı hafif kalıyor, aynı kod da çalıştığı her platform için derlenebiliyor.

Sunucunun işi farklı: Zamanının çoğunu aynı anda birçok bağlantıyla uğraşarak geçiriyor. Go’da
aynı anda çalışan küçük görevler (goroutine’ler) çok hafif, bu yüzden her bağlantıya ayrı bir
görev açmak sorun olmuyor. Go sunucuyu tek bir çalıştırılabilir dosyaya derliyor, bu da
kurulumu kolaylaştırıyor.

Kaynak kodu kapalı.
