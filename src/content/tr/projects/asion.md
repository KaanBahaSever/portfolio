---
title: Asion
shortDescription: macOS, Linux ve Windows için gizliliği önceleyen bir üretkenlik ve iş istasyonu etkinlik takip sistemi. Yerel olay kancaları ve hafif bir daemon üzerine, kendi sunucunuzda barındırılabilecek şekilde kurgulandı.
---

## Nedir?

Asion; macOS, Linux ve Windows için geliştirdiğim, platformlar arası bir üretkenlik ve iş
istasyonu etkinlik takip sistemi. Hangi uygulamanın ve pencerenin odakta olduğunu kaydediyor,
bu ham veriyi de zamanın gerçekte nasıl harcandığını gösteren bir tabloya dönüştürüyor. Rize.io
gibi araçlar böyle bir tablonun ne kadar işe yarayabileceğini gösterdi; Asion ise bu kadar
kişisel bir verinin sahibinin denetiminde kalması gerektiği fikriyle yola çıkıyor. Bu yüzden
gizliliği önceleyen, kendi sunucunuzda barındırılabilecek (self-hosting) bir yapıyla tasarlandı.

İş gününün dürüst bir kaydını tutmak isteyen bireyler, mühendislik ekipleri ve bir projeye
harcanan saatleri takip etmesi gereken araştırmacılar ile öğrenciler için düşünüldü; akademik
zaman takibi de hedeflerinden biri. 2024'ten beri geliştiriyorum. Proje hâlâ geliştirme
aşamasında; erken erişim [asion.app](https://asion.app) üzerinden yürütülüyor. Kaynak kodu
kapalı.

## Araya girmeden izlemek

Bir etkinlik takipçisi bütün gün çalışır; bu yüzden sisteme getirdiği yük sıfıra yakın olmalı.
Asion **yerel işletim sistemi olay kancalarını** (native OS event hooks) dinler; böylece her
platform odak değişikliklerini gerçekleştikleri anda bildirir. Toplama işini arka planda
**hafif bir daemon** üstlenir. Yerel katmanlarda C/C++ ve Objective-C, bunların yanında da Go
kullanılıyor.

## Mimari

Asion, her biri tek bir işten sorumlu birkaç süreçten oluşur:

- **`asion-agent`**: arka plan ajanı. Etkin pencereyi işletim sisteminin kancaları üzerinden
  izler ve etkinliği toplar.
- **`asion-runner`**: ajanın arkasındaki zamanlanmış ve uzun süren işleri yürütür.
- **`asion-ui`**: toplanan etkinliğin incelendiği arayüz.
- **`asion-native-host`**: tarayıcı eklentilerini ajana bağlayan native messaging host.

Bileşenler birbirleriyle **gRPC** üzerinden, **Protobuf** mesajlarıyla konuşur: tipli
sözleşmeler süreçler arası iletişimi verimli, süreçler arasındaki sınırları da net tutar.
Etkinlik verisi yerelde, şifreli bir **SQLCipher** veritabanında saklanır; diskteki kayıt,
anahtarı olmadan okunamaz.

## Tarayıcı entegrasyonu

Tarayıcılar, bir eklentinin yerel bir programa yalnızca native messaging üzerinden ulaşmasına
izin verir. Bu yöntemde her mesaj, JSON yükünün önüne eklenen 4 baytlık, little-endian bir
uzunluk önekiyle çerçevelenir. Asion bu çerçevelemeyi `asion-native-host` içinde **C++** ile
uygular; böylece eklenti ile arka plandaki ajan, arada bir ağ servisi olmadan mesajlaşır.

## Derleme, test ve sürüm otomasyonu

Üç işletim sisteminde yerel bileşenleri olan bir yazılımın, her değişiklikte bu sistemlerin her
birinde derlenmesi, test edilmesi ve paketlenmesi gerekir. Asion ekosistemi için **GitHub
Actions** üzerinde çok platformlu CI/CD boru hatları kurdum:

- **Çok platformlu iş akışları** (workflow) ve yerel derlemeleri üreten çapraz derleme
  (cross-compilation) runner'ları.
- Adımları birbirine bağlayan, Bash, Batch ve Python ile yazılmış **özel otomasyon betikleri**.
- **Tek tıkla test ve paketleme**: tek bir tıklama testleri çalıştırır, bileşenleri paketler ve
  her platform için derleme çıktılarını (artifact) üretir.
- Bu çok platformlu derleme çıktılarını sürüme kadar taşıyan **dağıtım boru hatları**.
