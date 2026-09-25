---
title: Novacast
shortDescription: Go ile yazılmış, düşük gecikmeli MQTT publish/subscribe boru hatları (pipeline) üzerine kurulu, gerçek zamanlı bir mesaj yayını ve cihaz orkestrasyonu platformu.
---

## Nedir?

Novacast, mesajları gerçek zamanlı olarak yayınlamak ve bu mesajları alan cihazları yönetmek
(orkestrasyon) için tasarlanmış, yüksek hacimli (high-throughput) bir platform. Düşük
gecikmeli publish/subscribe boru hatları üzerine kuruldu: bir kez yayımlanan mesaj, ona
ihtiyaç duyan her cihaza hızla ulaşmalı; bir cihaz filosu da tek bir yerden yönetilebilmeli.
Ayrıntılar: [novacast.app](https://novacast.app).

## Neden publish/subscribe, neden MQTT?

Publish/subscribe (pub/sub) sisteminde gönderenler alıcıları doğrudan adreslemez. Yayıncı
mesajını bir **konuya** (topic) gönderir; broker, hangi konuya kimin abone olduğunu takip eder
ve mesajı her birine iletir. Dolayısıyla yeni bir cihaz eklemek için göndericilere dokunmak
gerekmez; yeni bir abonelik yeterlidir. Yayın ve cihaz orkestrasyonunun ihtiyaç duyduğu da tam
olarak bu ayrışmadır: tek bir komut çok sayıda alıcıya dağılır, cihaz grupları da dinledikleri
konular üzerinden adreslenebilir.

**MQTT**, tam da bu durum için tasarlanmış bir pub/sub protokolü. İstemciler broker ile uzun
ömürlü bir bağlantıyı açık tutar ve her mesaj yalnızca küçük, ikili (binary) bir başlık taşır;
böylece her teslimatta yeni bir bağlantının ya da hantal bir zarfın bedeli ödenmez. Protokol
ayrıca her mesajın kendi teslim garantisini seçmesine izin verir; seçenekler “en fazla bir
kez” ile “tam olarak bir kez” arasında değişir. Bir boru hattı, hızlı yolları hızlı, güvenilir
yolları güvenilir tutmayı böyle başarır.

## Neden Go?

Broker merkezli bir sistem, zamanının çoğunu aynı anda birçok bağlantıyı bekleyerek geçirir.
Go'nun goroutine'leri, her bağlantıya ve boru hattının her aşamasına kendi akışını verecek kadar
ucuzdur; channel'lar da mesajları, koda dağılmış kilitlere gerek kalmadan bir aşamadan
ötekine aktarabilir. Eşzamanlı kod sıralı kod gibi okunmaya devam eder; Go da bu kodu
dağıtımı kolay, tek bir çalıştırılabilir dosyaya derler.

Kaynak kodu kapalı.
