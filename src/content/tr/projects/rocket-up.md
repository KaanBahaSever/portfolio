---
title: Rocket-Up — Yüksek Güçlü Roket Simülasyonu
shortDescription: Yüksek güçlü roketler için bir uçuş simülasyonu. 2020’de dar kapsamlı bir Python prototipi olarak başladı; şimdi onu modern C++ ile, açık kaynak bir aerodinamik simülasyon motoru olarak baştan yazıyorum.
---

## Nedir?

Rocket-Up, yüksek güçlü roketler için yazdığım uçuş simülasyonu. Ortada iki ayrı proje yok;
zaman içinde şekil değiştiren tek bir proje var. 2020’de bir Python prototipi olarak başladı.
Şimdi onu modern C++ ile, dinamik bir aerodinamik simülasyon motoru olarak tamamen yeniden
yazıyorum. Yeni motor açık kaynak. MIT Lisansı ile yayımlanıyor.

## Prototipten simülasyon motoruna

2020’deki prototip dar kapsamlıydı: Genel bir araç olarak değil, tek bir iş için yazılmıştı.

Yeniden yazarken işe tam tersinden başladım. Artık tek ve sabit bir model yok; simülasyon
parçalardan kuruluyor: Roket bileşenlerden oluşuyor ve bir gezegenin ortamında uçuyor. Uçuşun
kendisi de koda gömülmüyor, parametrelerle tanımlanıyor. Fizik döngüsünün ihtiyaç duyduğu
performansı C++ veriyor. Temiz bir mimari de fizik hesaplarının her parçasını kendi yerinde
tutuyor. Böylece her parça, geri kalanına dokunmadan test edilebiliyor, geliştirilebiliyor ya
da değiştirilebiliyor.

## Depoda neler var?

Yeni sürüm henüz başlangıç aşamasında. Yine de herkese açık depoda şunlar şimdiden var:

- **Modüler roket bileşenleri**: roket, motoru ve paraşüt gibi kurtarma donanımları için ayrı
  sınıflar.
- **Motor modeli**: özgül itki, yakıt kütlesi, ayarlanabilir bir itki eğrisi, itkiyi kısma ve
  atmosfer basıncına göre düzeltilen itki.
- **Ortamlar ve gezegenler**: Dünya modeli, sıcaklığı ve basıncı irtifaya göre hesaplıyor.
  Bunun için 1976 ABD Standart Atmosfer modelinin katmanlarını kullanıyor. Gezegen sınıfları
  da genişletilebilecek şekilde yazıldı.
- **Ayarlanabilir uçuş parametreleri**, bir de küçük vektör ve matris hesap yardımcıları.

Proje CMake ile derleniyor.

## Yol haritası

- Daha fazla roket bileşeni: kanatçıklar, gövde tüpleri ve burun konileri.
- Daha doğru simülasyonlar için fizik kütüphaneleriyle entegrasyon.
- Birden çok gezegen ortamı.
- Daha iyi performans, GPU hızlandırma da dâhil.

## Arka plan

Bu simülasyon, roketçilik çalışmalarımın devamı. 2019–2022 yılları arasında İstanbul
Üniversitesi Roket Kulübünün başkan yardımcısıydım. Ekibimizle üç roket tasarlayıp ürettik:
bir alçak irtifa roketi (5.000 ft) ve iki yüksek irtifa roketi (10.000 ft). Bu roketlerde uçuş
aviyoniğinin gömülü yazılımını ve paraşüt açma kontrol sistemini tek başıma geliştirdim.
Aviyonikten bu simülasyona uzanan hikâyeyi [Hakkımda sayfasında](/about/#journey)
anlatıyorum.
