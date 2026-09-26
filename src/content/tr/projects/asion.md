---
title: Asion
shortDescription: macOS, Linux ve Windows için gizliliği ön planda tutan bir üretkenlik ve bilgisayar etkinliği takip aracı. İşletim sisteminin olay kancaları ve hafif bir daemon ile çalışıyor; kendi sunucunuza kurulmak üzere tasarlandı.
---

## Nedir?

Asion bir üretkenlik ve bilgisayar etkinliği takip aracı; macOS, Linux ve Windows’ta çalışıyor.
O an hangi uygulamanın ve hangi pencerenin etkin olduğunu kaydediyor, bu ham veriden de zamanın
gerçekte nereye gittiğini gösteren bir tablo çıkarıyor. Rize.io gibi araçlar böyle bir tablonun
ne kadar işe yarayabileceğini gösterdi. Asion ise şu düşünceden yola çıkıyor: Bu kadar kişisel
bir veri, sahibinin elinde kalmalı. Bu yüzden onu gizliliği ön planda tutarak ve kendi
sunucunuza kurabileceğiniz şekilde tasarladım.

Asion kimin için? İş gününü olduğu gibi kaydetmek isteyenler ve yazılım ekipleri için.
Akademik zaman takibi de hedeflerden biri: Araştırmacılar ve öğrenciler, bir projeye kaç saat
harcadıklarını kaydedebilir. 2024’ten beri üzerinde çalışıyorum. Asion hâlâ
geliştiriliyor; erken erişim [asion.app](https://asion.app) üzerinden açık. Kaynak kodu kapalı.

## Bilgisayarı yormadan izlemek

Bir etkinlik takipçisi bütün gün açık kalır. Bu yüzden bilgisayara getirdiği yük neredeyse
sıfır olmalı. Asion, **işletim sisteminin kendi olay kancalarını** dinler. Böylece etkin pencere
değiştiği anda her platform bunu kendisi bildirir. Veriyi arka planda **hafif bir daemon**
toplar. Platforma özel katmanlarda C/C++ ve Objective-C, bunların yanında da Go kullanıyorum.

## Mimari

Asion, her biri tek bir iş yapan birkaç süreçten oluşur:

- **`asion-agent`**: arka planda çalışan ajan. Etkin pencereyi işletim sisteminin kancalarıyla
  izler ve etkinlik verisini toplar.
- **`asion-runner`**: ajanın yanında zamanlanmış ve uzun süren işleri çalıştıran süreç.
- **`asion-ui`**: toplanan verileri incelediğiniz arayüz.
- **`asion-native-host`**: tarayıcı eklentilerini ajana bağlayan program (native messaging
  host).

Bileşenler birbiriyle **gRPC** üzerinden, **Protobuf** mesajlarıyla konuşur. Mesajların yapısı
ve alan tipleri önceden tanımlı olduğu için süreçler arasındaki iletişim verimli kalır, her
sürecin sınırı da net olur. Veriler bilgisayarda, şifreli bir **SQLCipher** veri tabanında
saklanır. Anahtarı olmayan biri diskteki kaydı okuyamaz.

## Tarayıcıyla bağlantı

Tarayıcılar, bir eklentinin bilgisayardaki bir programla konuşmasına yalnızca native messaging
üzerinden izin verir. Bu yöntemde her mesaj JSON olarak gönderilir. Mesajın başına da
uzunluğunu bildiren 4 baytlık, little-endian bir önek eklenir. Asion bu mesaj biçimini
`asion-native-host` içinde **C++** ile uygular. Böylece eklenti ile arka plandaki ajan, arada
bir ağ servisi olmadan mesajlaşır.

## Otomatik derleme, test ve yayın

Üç işletim sisteminde platforma özel parçaları olan bir yazılım, her değişiklikte bu sistemlerin
her birinde yeniden derlenmeli, test edilmeli ve paketlenmeli. Bu yüzden Asion ekosistemi için
**GitHub Actions** üzerinde çok platformlu CI/CD iş akışları kurdum:

- **Çapraz derleme**: Runner’lar her platform için yerel derlemeyi üretir.
- **Özel otomasyon betikleri**: Bash, Batch ve Python ile yazılan bu betikler adımları
  birbirine bağlar.
- **Tek tıkla test ve paketleme**: Testler çalışır, bileşenler paketlenir ve her platform için
  derleme çıktıları üretilir.
- **Dağıtım iş akışları**: Her platformun derleme çıktılarını alır ve yeni bir sürüm olarak
  yayımlar.
