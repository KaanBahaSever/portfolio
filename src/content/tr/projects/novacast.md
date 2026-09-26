---
title: Novacast
shortDescription: Mesajları gerçek zamanlı olarak yayınlayan ve bu mesajları alan cihazları tek yerden yöneten bir platform. Go ile yazıldı ve düşük gecikmeli bir MQTT yayıncı/abone (pub/sub) modeli üzerine kuruldu.
---

## Nedir?

Novacast, yoğun mesaj trafiğini kaldırabilen bir platform. Mesajları gerçek zamanlı olarak
yayınlıyor ve bu mesajları alan cihazları yönetiyor. Temelinde düşük gecikmeli bir
yayıncı/abone (pub/sub) modeli var. Hedef şu: Bir kez gönderilen mesaj, ona ihtiyacı olan her
cihaza hızla ulaşmalı. Bir cihaz filosu da tek bir yerden yönetilebilmeli. Ayrıntılar
[novacast.app](https://novacast.app) adresinde.

## Nasıl ortaya çıktı?

Çalıştığım bir bilgisayar firmasında eski bir yazılım kullanılıyordu ve bu yazılım ihtiyaçları
karşılamıyordu. Novacast’i 2025’te onun yerini alsın diye geliştirdim. İlk sürüm Python ile
yazılmış bir prototipti. 2025’in sonlarında projeyi baştan tasarlayıp Go ile yeniden
yazdım. Yeni sürüm, MQTT üzerine kurulu, yüksek performanslı bir mikroservis. Bugün canlıda
çalışan da bu sürüm.

## Neden yayıncı/abone modeli, neden MQTT?

Yayıncı/abone modelinde gönderen, mesajı doğrudan alıcılara yollamaz. Yayıncı mesajını bir
**konuya** (topic) gönderir. Arada duran broker, hangi konuya kimin abone olduğunu takip eder ve
mesajı her birine iletir. Bu yüzden yeni bir cihaz eklendiğinde gönderenlerin hiçbirini
değiştirmek gerekmez; yalnızca yeni bir abonelik eklenir. Mesaj yayınında ve cihaz yönetiminde
de tam olarak bu bağımsızlık gerekir. Tek bir komut birçok alıcıya dağılır. Bir cihaz grubuna
ulaşmak için de o grubun dinlediği konuya mesaj göndermek yeter.

**MQTT**, tam da bu iş için tasarlanmış bir yayıncı/abone protokolü. İstemciler broker’la
bağlantılarını uzun süre açık tutar ve her mesaj yalnızca küçük bir ikili (binary) başlık
taşır. Böylece her gönderimde yeni bir bağlantı açmak ya da mesajı uzun başlıklarla sarmak
gerekmez. Protokol ayrıca teslim garantisini her mesaj için ayrı seçmeye izin verir. Seçenekler
“en fazla bir kez” ile “tam olarak bir kez” arasında değişir. Bu sayede hızlı gitmesi gereken
mesajlar hızlı, mutlaka ulaşması gereken mesajlar da güvenle gider.

## Neden Go?

Broker merkezli bir sistem, zamanının çoğunu aynı anda birçok bağlantıyı bekleyerek geçirir.
Go’da goroutine’ler o kadar ucuz ki her bağlantı ve mesajların geçtiği her aşama kendi
goroutine’inde çalışabilir. Channel’lar da mesajları bir aşamadan ötekine aktarır. Bunun için
kodun dört bir yanına kilit koymak gerekmez. Eşzamanlı kod bile sıralı kod gibi rahat okunur. Go bu kodu
dağıtması kolay, tek bir çalıştırılabilir dosyaya derler.

Kaynak kodu kapalı.
