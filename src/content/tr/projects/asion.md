---
title: Asion
shortDescription: Ekran başında vaktinizin nereye gittiğini gösteren bir üretkenlik aracı. macOS, Linux ve Windows’ta bilgisayarı yormadan arka planda çalışıyor. Veriler sizde kalsın diye kendi sunucunuza kurulabilecek şekilde tasarladım.
---

## Nedir?

Asion, bilgisayarda o an hangi uygulamada ve hangi pencerede çalıştığınızı kaydediyor. Bu
kayıtlardan da zamanınızın gerçekte nereye gittiğini gösteren bir tablo çıkarıyor.

Rize.io gibi araçlar böyle bir tablonun ne kadar işe yaradığını gösterdi. Ama bence bu kadar
kişisel bir veri, sahibinin elinde kalmalı. Bu yüzden Asion’u tasarlarken gizliliği en başa
koydum, kendi sunucunuza kurabilmenizi de baştan düşündüm.

Kimler için mi? İş gününü olduğu gibi görmek isteyenler, yazılım ekipleri ve bir projeye kaç
saat harcadıklarını kaydetmek isteyen araştırmacılarla öğrenciler için. 2024’ten beri üzerinde
çalışıyorum; erken erişim [asion.app](https://asion.app) üzerinden açık. Kaynak kodu kapalı.

## Bilgisayarı yormadan nasıl izliyor?

Böyle bir program bütün gün açık kalıyor, o yüzden bilgisayarı neredeyse hiç yormamalı. Asion,
işletim sistemine “Pencere değişince bana haber ver.” diyor ve bekliyor. Siz başka bir pencereye
geçer geçmez sistem haber veriyor. Veriyi arka planda çalışan hafif bir program (daemon)
topluyor. İşletim sistemine özel parçaları C/C++ ve Objective-C ile yazdım, bunların yanında Go
da kullanıyorum.

## Hangi parçalardan oluşuyor?

Asion, her biri tek bir iş yapan birkaç programdan oluşuyor:

- **`asion-agent`**: Arka planda çalışan takipçi. Hangi pencerede olduğunuzu işletim sisteminden
  öğrenip kaydediyor.
- **`asion-runner`**: Takipçinin yanında, zamanı gelen ve uzun süren işleri üstleniyor.
- **`asion-ui`**: Toplanan verilere baktığınız ekran.
- **`asion-native-host`**: Tarayıcı eklentilerini takipçiye bağlayan köprü.

Programlar birbiriyle **gRPC** üzerinden konuşuyor: Biri istek gönderiyor, öteki cevap veriyor.
Mesajların biçimini de **Protobuf** ile önceden belirledim. Kimin ne gönderip ne alacağı belli
olduğu için iletişim verimli oluyor, programların sınırları da net kalıyor.

Veriler bilgisayarınızda, şifreli bir veri tabanında (**SQLCipher**) duruyor. Anahtar olmadan
diskteki kayıtlar okunamıyor.

## Tarayıcıyla nasıl konuşuyor?

Tarayıcılar, bir eklentinin bilgisayardaki bir programla konuşmasına tek bir yoldan izin
veriyor: native messaging. Bu yöntemde her mesaj JSON biçiminde bir metin. Başına da mesajın kaç
bayt olduğunu söyleyen 4 baytlık bir sayı ekleniyor. Bu sayı en küçük basamağından başlanarak
yazılıyor (little-endian). Bu kısmı `asion-native-host` içinde **C++** ile yazdım. Böylece
eklenti ile takipçi, arada bir ağ servisi olmadan mesajlaşıyor.

## Yeni sürümler nasıl çıkıyor?

Asion’un her işletim sistemine özel parçaları var. Bu yüzden her değişiklikten sonra üç sistemde
de yeniden derlenmesi, test edilmesi ve paketlenmesi gerekiyor. Bunları kendiliğinden yapan iş
akışlarını (CI/CD) **GitHub Actions** üzerinde kurdum:

- **Çapraz derleme**: İşleri yürüten makineler (runner’lar), başka sistemler için de derleme
  yapıp her platformun kendi sürümünü çıkarıyor.
- **Kendi betiklerim**: Bash, Batch ve Python ile yazdığım bu küçük programlar adımları
  birbirine bağlıyor.
- **Tek tıkla test ve paketleme**: Testler çalışıyor, parçalar paketleniyor ve her platform için
  derlenmiş dosyalar hazırlanıyor.
- **Dağıtım**: Başka iş akışları da bu dosyaları alıp yeni bir sürüm olarak yayımlıyor.
