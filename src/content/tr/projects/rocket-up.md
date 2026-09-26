---
title: Rocket-Up — Yüksek Güçlü Roket Simülasyonu
shortDescription: Yüksek güçlü roketler için bir uçuş simülasyonu. 2020’de tek bir iş için yazdığım Python prototipiyle başladı. Şimdi onu modern C++ ile, açık kaynak bir simülasyon motoru olarak baştan yazıyorum.
---

## Nedir?

Rocket-Up, yüksek güçlü roketler için yazdığım bir uçuş simülasyonu. 2020’de bir Python
prototipi olarak başladı. Şimdi onu modern C++ ile, bir aerodinamik simülasyon motoru olarak
baştan yazıyorum. Yani iki ayrı proje yok; zamanla şekil değiştiren tek bir proje var. Yeni sürüm
açık kaynak, MIT Lisansı ile yayımlanıyor.

## Ne değişti?

2020’deki prototip tek bir iş için yazılmıştı; genel amaçlı bir araç değildi.

Yeni sürümde tersinden başladım: Tek ve sabit bir model yok, her şey parçalardan kuruluyor. Roket
bileşenlerinden birleştiriliyor ve bir gezegenin ortamında uçuyor. Uçuşun ayrıntıları koda gömülü
değil, ayar olarak veriliyor. Fizik hesaplarının hızlı olması gerekiyor; bunu C++ sağlıyor.
Fiziğin her parçası da kendi yerinde duruyor. Böylece bir parçayı, gerisine dokunmadan test
edebiliyor, iyileştirebiliyor ya da değiştirebiliyorum.

## Şu an neler var?

Yeni sürüm daha yolun başında ama herkese açık depoda şunlar şimdiden hazır:

- **Ayrı parçalar**: roketin kendisi, motoru ve paraşüt gibi kurtarma donanımları.
- **Motor modeli**: yakıt kütlesi, özgül itki (yakıtın ne kadar verimli kullanıldığı),
  ayarlanabilir bir itki eğrisi, motoru kısabilme ve havanın basıncına göre düzeltilen itki.
- **Ortamlar ve gezegenler**: Dünya modeli, yükseldikçe havanın sıcaklığının ve basıncının nasıl
  değiştiğini 1976 ABD Standart Atmosfer modelinin katmanlarına göre hesaplıyor. Gezegen kodu da
  yeni gezegenler eklenebilecek şekilde yazıldı.
- **Ayarlanabilir uçuş değerleri**, bir de vektör ve matris hesapları için küçük yardımcılar.

Projeyi derlemek için CMake kullanıyorum.

## Sırada ne var?

- Daha fazla roket parçası: kanatçıklar, gövde tüpleri ve burun konileri.
- Daha doğru sonuçlar için fizik kütüphaneleriyle birlikte çalışmak.
- Birden çok gezegen ortamı.
- Daha hızlı çalışma; hesapları ekran kartına (GPU) yaptırmak da buna dâhil.

## Nereden geliyor?

Bu simülasyon, roketlerle uğraştığım yılların devamı. 2019–2022 arasında İstanbul Üniversitesi
Roket Kulübünün başkan yardımcısıydım. Ekibimizle üç roket tasarlayıp ürettik: bir alçak irtifa
roketi (5.000 ft) ve iki yüksek irtifa roketi (10.000 ft). Bu roketlerde uçuş elektroniğinin
(aviyonik) yazılımını ve paraşütü açan kontrol sistemini tek başıma geliştirdim. Roketlerden bu
simülasyona uzanan hikâyeyi [Hakkımda sayfasında](/about/#journey) anlatıyorum.
