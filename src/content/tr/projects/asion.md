---
title: Asion
shortDescription: Ekran başında zamanın nereye gittiğini gösteren bir üretkenlik aracı. macOS, Linux ve Windows’ta, bilgisayarı yormadan arka planda çalışıyor. Veriler sizde kalsın diye kendi sunucunuza kurulabilecek şekilde tasarlandı.
---

## Nedir?

Asion, bilgisayarda o an hangi uygulamada ve hangi pencerede çalıştığınızı kaydediyor. Bu
kayıtlardan da zamanınızın gerçekte nereye gittiğini gösteren bir tablo çıkarıyor.

Rize.io gibi araçlar böyle bir tablonun ne kadar işe yaradığını gösterdi. Ama bence bu kadar
kişisel bir veri, sahibinin elinde kalmalı. Bu yüzden Asion’u gizliliği ön planda tutarak ve
kendi sunucunuza kurabileceğiniz şekilde tasarladım.

Kimler için mi? İş gününü olduğu gibi görmek isteyenler, yazılım ekipleri ve bir projeye kaç
saat harcadığını kaydetmek isteyen araştırmacılar ile öğrenciler için. 2024’ten beri üzerinde
çalışıyorum. Hâlâ geliştiriliyor; erken erişim [asion.app](https://asion.app) üzerinden açık.
Kaynak kodu kapalı.

## Bilgisayarı yormadan nasıl izliyor?

Böyle bir program bütün gün açık kalıyor, o yüzden bilgisayarı neredeyse hiç yormamalı. Asion,
işletim sistemine “Pencere değişince bana haber ver.” diyor ve bekliyor. Başka bir pencereye
geçtiğiniz anda da sistem haber veriyor. Veriyi arka planda çalışan hafif bir program (daemon)
topluyor. İşletim sistemine özel parçaları C/C++ ve Objective-C ile yazdım; yanında Go da
kullanıyorum.

## Hangi parçalardan oluşuyor?

Asion, her biri tek bir iş yapan birkaç programdan oluşuyor:

- **`asion-agent`**: Arka planda çalışan takipçi. Hangi pencerede olduğunuzu işletim
  sisteminden öğrenip kaydediyor.
- **`asion-runner`**: Takipçinin yanında, zamanı gelen ve uzun süren işleri üstleniyor.
- **`asion-ui`**: Toplanan verilere baktığınız ekran.
- **`asion-native-host`**: Tarayıcı eklentilerini takipçiye bağlayan köprü.

Programlar birbiriyle **gRPC** üzerinden konuşuyor: Biri istek gönderiyor, öteki cevap veriyor.
Mesajların biçimi **Protobuf** ile baştan tanımlı. Kimin ne gönderip ne alacağı belli olduğu için
iletişim hızlı kalıyor, programların sınırları da net oluyor.

Veriler bilgisayarınızda, şifreli bir veri tabanında (**SQLCipher**) duruyor. Anahtar olmadan
diskteki kayıtlar okunamıyor.

## Tarayıcıyla nasıl konuşuyor?

Tarayıcılar, bir eklentinin bilgisayardaki bir programla konuşmasına tek bir yoldan izin
veriyor: native messaging. Bu yolda her mesaj JSON biçiminde bir metin. Başına da mesajın kaç
bayt olduğunu söyleyen 4 baytlık bir sayı ekleniyor; bu sayı en düşük baytından başlanarak
yazılıyor (little-endian). Bu kısmı `asion-native-host` içinde **C++** ile yazdım. Böylece
eklenti ile takipçi, arada bir ağ servisi olmadan mesajlaşıyor.

## Otomatik derleme, test ve yayın

Asion’un her işletim sistemine özel parçaları var. Bu yüzden her değişiklikten sonra üç sistemde
de yeniden derlenmesi, test edilmesi ve paketlenmesi gerekiyor. Bu işleri kendiliğinden yapan
iş akışlarını (CI/CD) **GitHub Actions** üzerinde kurdum:

- **Çapraz derleme**: İşleri yürüten makineler (runner’lar), bir sistemde başka sistemler için
  de derleme yaparak her platformun kendi sürümünü çıkarıyor.
- **Kendi betiklerim**: Bash, Batch ve Python ile yazdığım betikler adımları birbirine bağlıyor.
- **Tek tıkla test ve paketleme**: Testler çalışıyor, parçalar paketleniyor ve her platform için
  derlenmiş dosyalar hazırlanıyor.
- **Dağıtım**: Başka iş akışları da bu dosyaları alıp yeni bir sürüm olarak yayımlıyor.
