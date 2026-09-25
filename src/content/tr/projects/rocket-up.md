---
title: Rocket-Up
shortDescription: Roket uçuşunu, motor itkisinden roketin içinden geçtiği atmosfere kadar modelleyen, erken aşamadaki modüler bir C++ kütüphanesi.
---

## Nedir?

Rocket-Up, bir roket uçuşunun farklı parçalarını, motor itkisinden roketin içinden geçtiği
atmosfere kadar modellemek için yazılmış bir C++ kütüphanesi. CMake ile (C++17) derleniyor ve
MIT Lisansı ile yayımlanıyor.

## Özellikler

- **Modüler roket bileşenleri**: roket, motoru ve paraşüt gibi kurtarma donanımı için ayrı
  sınıflar.
- **Motor modeli**: özgül itki, yakıt kütlesi, ayarlanabilir bir itki eğrisi, kısma
  (throttling) ve atmosfer basıncına göre düzeltilmiş itki.
- **Genişletilebilir ortamlar ve gezegenler**: Dünya modeli, 1976 ABD Standart Atmosferi'nin
  katmanlarını kullanarak irtifaya göre sıcaklığı ve basıncı hesaplar.
- **Ayarlanabilir uçuş parametreleri**, ayrıca küçük vektör ve matris hesaplama yardımcıları.

## Yol haritası

Proje henüz erken aşamada. Planlanan sonraki adımlar:

- Daha fazla roket bileşeni: kanatçıklar, gövde tüpleri ve burun konileri.
- Daha isabetli simülasyonlar için fizik kütüphaneleriyle entegrasyon.
- Birden çok gezegen ortamı.
- GPU hızlandırma da dahil olmak üzere daha iyi performans.

## Arka plan

Rocket-Up, uzun süredir sürdürdüğüm uçuş çalışmalarının bir parçası. 2019–2022 yılları arasında
İstanbul Üniversitesi Roket Kulübü'nün başkan yardımcısıydım; üç roketin tasarımına ve başarılı
yüksek güçlü atışlarına katkıda bulundum, uçuş aviyoniği yazılımını (firmware) ve paraşüt
açma kontrol sistemini tek başıma geliştirdim.

Rocket-Up, güncel simülasyon çalışmamdan ayrı bir kod tabanı. O çalışma, önce Python ile
yazdığım ve şimdi modern C++23 ile yeniden tasarladığım, üç boyutlu sayısal bir yörünge
simülasyonu. Hikâyesini [Hakkımda sayfasında](/about/#journey) anlatıyorum.
