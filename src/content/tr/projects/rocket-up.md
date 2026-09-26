---
title: Rocket-Up — Yüksek Güçlü Roket Simülasyonu
shortDescription: Yüksek güçlü roketler için bir uçuş simülasyonu. 2020’de tek bir iş için yazdığım Python prototipiyle başladı. Şimdi onu modern C++ ile, açık kaynak bir aerodinamik simülasyon motoru olarak baştan yazıyorum.
---

## Nedir?

Rocket-Up, yüksek güçlü roketler için yazdığım bir uçuş simülasyonu. Ortada iki ayrı proje yok:
2020’deki Python prototipi de şimdi modern C++ ile baştan yazdığım aerodinamik simülasyon motoru
da aynı proje, sadece zamanla şekil değiştirdi. Yeni sürüm açık kaynak ve MIT Lisansı ile
yayımlanıyor.

## Ne değişti?

2020’deki prototip tek bir iş için yazılmıştı; genel amaçlı bir araç değildi.

Yeni sürümde işe tersinden başladım. Tek ve sabit bir model yok; simülasyon parçalardan
oluşuyor. Roket, bileşenleri birleştirilerek kuruluyor ve bir gezegenin ortamında uçuyor.
Uçuşun ayrıntıları koda yazılmıyor, ayar olarak veriliyor. Fizik hesaplarının hızlı olması
gerekiyor; bunu C++ sağlıyor. Bu hesapların her parçası da kodda ayrı bir yerde duruyor.
Böylece bir parçayı gerisine dokunmadan test edebiliyor, iyileştirebiliyor ya da
değiştirebiliyorum.

## Şu an neler var?

Yeni sürüm daha yolun başında ama herkese açık kodunda şimdiden şunlar var:

- **Ayrı roket parçaları**: roketin kendisi, motoru ve paraşüt gibi kurtarma donanımları.
- **Motor modeli**: yakıt kütlesi, özgül itki (yakıtın ne kadar verimli kullanıldığı),
  ayarlanabilir bir itki eğrisi, motoru kısabilme ve hava basıncına göre düzeltilen itki.
- **Ortamlar ve gezegenler**: Dünya için, yükseldikçe sıcaklığın ve basıncın nasıl değiştiği
  1976 ABD Standart Atmosfer modelinin katmanlarına göre hesaplanıyor. Gezegen kodunu da yeni
  gezegenler eklenebilecek şekilde yazdım.
- **Ayarlanabilir uçuş değerleri**, bir de vektör ve matris hesapları için küçük yardımcılar.

Projeyi CMake ile derliyorum.

## Sırada ne var?

- Daha fazla roket parçası: kanatçıklar, gövde tüpleri ve burun konileri.
- Daha doğru sonuçlar için fizik kütüphaneleri desteği.
- Birden çok gezegen ortamı.
- Daha hızlı çalışma; hesapları ekran kartına (GPU) yaptırmak da buna dâhil.

## Nereden geliyor?

Bu simülasyon, roketlerle uğraştığım yılların devamı. 2019–2022 arasında İstanbul Üniversitesi
Roket Kulübünün başkan yardımcısıydım. Ekibimizle üç roket tasarlayıp ürettik: bir alçak irtifa
roketi (5.000 ft) ve iki yüksek irtifa roketi (10.000 ft). Bu roketlerde uçuş elektroniğinin
(aviyonik) yazılımını ve paraşütü açan kontrol sistemini tek başıma geliştirdim. Roketlerden bu
simülasyona uzanan hikâyeyi [Hakkımda sayfasında](/about/#journey) anlatıyorum.
