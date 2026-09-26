---
title: Abel–Ruffini Teoremini Sezgiyle Anlamak
description: 'Beşinci dereceden her denklemi radikallerle çözen bir formül neden yok? Çünkü cebirin neyi çözebileceğine köklerin simetrileri karar veriyor. Bu simetrilere Galois teorisiyle bakıyoruz.'
pubDate: 2026-09-25
lang: tr
translationKey: abel-ruffini
tags: [matematik, cebir, galois-teorisi]
---

İkinci dereceden denklemlerin kök formülünü okulda hepimiz öğreniriz:

$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}.
$$

Daha kalın bir kitapta her derece için böyle bir formül olduğunu düşünmek çok doğal. Üçüncü ve dördüncü derece için gerçekten de var. Beşinci derece için ise yok ve hiçbir kitapta da olmayacak. Beşinci dereceden bütün denklemlerin köklerini katsayılardan yalnızca dört işlemle ve istediğimiz dereceden kök alarak, kısacası *radikallerle* bulan bir formül yoktur. Abel–Ruffini teoremi tam olarak bunu söyler.

Böyle söyleyince teorem, insan zekâsının bir sınırını gösteriyormuş gibi duruyor. Oysa asıl anlattığı şey simetri. Bu yazıda bu fikrin peşinden gideceğiz. Klasik formüller neden işe yarıyor? Beşinci derecede ne değişiyor? Engelin, kökleri bulmanın zor olmasıyla neden hiçbir ilgisi yok?

## Bulunamayan bir formülün kısa tarihi

Babilli kâtipler ikinci dereceden problemleri neredeyse dört bin yıl önce çözüyordu. Tam kareye tamamlama yöntemini 9. yüzyılda Harezmî sistemli bir hâle getirdi. Sonraki adım çok daha uzun sürdü. İtalya’da, 16. yüzyılda önce Scipione del Ferro, sonra Niccolò Tartaglia üçüncü dereceden denklemleri çözmeyi başardı. Gerolamo Cardano bu yöntemi, öğrencisi Lodovico Ferrari’nin dördüncü derece için bulduğu çözümle birlikte 1545’te <cite lang="la">Ars Magna</cite> adlı kitabında yayımladı.

Ardından iki buçuk yüzyıl boyunca beşinci derece için formül arandı ama bulunamadı. Joseph-Louis Lagrange 1770–71’de soruyu değiştirdi. Eski yöntemlerin *neden* işe yaradığını sordu ve hepsinin aslında köklerin permütasyonlarıyla, yani yerlerini değiştirmekle uğraştığını gördü. Paolo Ruffini bu fikirden yola çıkarak 1799’da genel beşinci dereceden denklemin radikallerle çözülemeyeceğini savundu. Kanıtı özünde doğruydu ama bir boşluğu vardı: Ruffini, çözümde geçen her radikalin köklerin rasyonel bir fonksiyonu olduğunu kanıtlamadan kabul etmişti. Niels Henrik Abel bu boşluğu 1824’te, kendi parasıyla bastırdığı kısa bir kitapçıkla kapattı. Birkaç yıl sonra Évariste Galois soruyu bir adım öteye taşıdı ve *hangi* denklemlerin radikallerle çözülebildiğini buldu. Galois 1832’de, yirmi yaşında öldü. Çalışmaları ancak 1846’da yayımlandı ve bugün onun adını taşıyan teoriye dönüştü.

## Dördüncü dereceye kadar neden formül var?

### İkinci derece: bir karekök, bir simetri

$x^2 + px + q = (x - r_1)(x - r_2)$ olsun. Tam kareye tamamlarsak

$$
x^2 + px + q = \Bigl(x + \frac{p}{2}\Bigr)^2 - \frac{p^2 - 4q}{4}
$$

olur ve kök formülü buradan çıkar. Ama aynı hesaba bir de başka açıdan bakmak daha öğretici. Köklerin toplamı $r_1 + r_2 = -p$ ve çarpımı $r_1 r_2 = q$ *simetriktir*: Kökler yer değiştirse de değişmezler ve doğrudan katsayılardan okunurlar. $r_1 - r_2$ farkı ise simetrik değildir, çünkü kökler yer değiştirince işareti değişir. Ama karesi simetriktir:

$$
\begin{aligned}
(r_1 - r_2)^2 &= (r_1 + r_2)^2 - 4r_1 r_2 \\
&= p^2 - 4q.
\end{aligned}
$$

Karekök alınca $r_1 - r_2$ farkını işareti dışında geri buluruz; sonra da $r_{1,2} = \tfrac12\bigl((r_1 + r_2) \pm (r_1 - r_2)\bigr)$ olur. Karekökün tek bir işi var: İki kök arasındaki tek simetriyi, yani yer değiştirmeyi kırmak.

### Üçüncü derece: Cardano yöntemi

$ax^3 + bx^2 + cx + d$ polinomunda $x = y - \frac{b}{3a}$ koyup her şeyi $a$’ya bölersek ikinci dereceden terim kaybolur. Bu yüzden $x^3 + px + q = 0$ biçimindeki *indirgenmiş* denklemi çözmek yeter. Cardano kökü $x = u + v$ biçiminde arar. $(u + v)^3 = u^3 + v^3 + 3uv(u + v)$ olduğu için denklem

$$
u^3 + v^3 + q + (3uv + p)(u + v) = 0
$$

hâline gelir. Bilinmeyen iki, denklem bir; bu yüzden ikinci bir koşul koymakta serbestiz: $3uv = -p$ diyelim. O zaman $u^3 + v^3 = -q$ ve $u^3 v^3 = -p^3/27$ olur. Toplamı ve çarpımı belli olan $u^3$ ile $v^3$, şu ikinci dereceden *çözücü denklemin* kökleridir:

$$
t^2 + qt - \frac{p^3}{27} = 0.
$$

Bu denklemi çözüp küpkök alınca Cardano formülünü buluruz:

$$
\begin{gathered}
x = \sqrt[3]{-\frac{q}{2} + \sqrt{D}} + \sqrt[3]{-\frac{q}{2} - \sqrt{D}}, \\
D = \frac{q^2}{4} + \frac{p^3}{27}.
\end{gathered}
$$

İki küpkökü, çarpımları $-p/3$ olacak şekilde seçeriz. Önce bir karekök, sonra bir küpkök: Bu sırayı aklınızda tutun.

### Dördüncü derece: Ferrari’nin çözücü kübiği

Aynı türden bir kaydırmayla dördüncü dereceden bir denklemi $x^4 + px^2 + qx + r = 0$ biçimine getirebiliriz. Ferrari’nin fikri, yardımcı bir $y$ bilinmeyeni ekleyip sol tarafı tam kare yapmak:

$$
\begin{aligned}
(x^2 + y)^2 &= (2y - p)\,x^2 - qx \\
&\quad + (y^2 - r).
\end{aligned}
$$

Sağ taraf $x$’e göre ikinci derecedendir ve tam da diskriminantı sıfır olduğunda, yani $q^2 = 4(2y - p)(y^2 - r)$ iken tam kare olur. Bu, $y$ için üçüncü dereceden bir denklemdir; adı *çözücü kübik*:

$$
8y^3 - 4py^2 - 8ry + 4pr - q^2 = 0.
$$

Bu denklemi Cardano formülüyle çözelim. $q \ne 0$ ise her $y$ kökü için $2y \ne p$ olur. ($q = 0$ ise denklem zaten $x^2$’ye göre ikinci derecedendir.) O zaman iki taraf da tam karedir ve $s = \sqrt{2y - p}$ dersek denklem iki ikinci dereceden denkleme ayrılır:

$$
x^2 + y = \pm\Bigl(s\,x - \frac{q}{2s}\Bigr).
$$

### Lagrange çözücüleri

Lagrange, bu yardımcı sayıların kökler cinsinden aslında *ne olduğunu* sordu. Kökleri $r_1, r_2, r_3$ olan üçüncü dereceden bir denklem için $\omega = e^{2\pi i/3}$ (küpü 1 olan bir karmaşık sayı) alalım ve şu iki sayıyı tanımlayalım:

$$
\begin{aligned}
L &= r_1 + \omega r_2 + \omega^2 r_3, \\
L' &= r_1 + \omega^2 r_2 + \omega r_3.
\end{aligned}
$$

Kökleri sırayla kaydıran $r_1 \mapsto r_2 \mapsto r_3 \mapsto r_1$ permütasyonu $L$ sayısını $\omega^2 L$ sayısına götürür; bu yüzden $L^3$ bu permütasyonla değişmez. $r_2 \leftrightarrow r_3$ gibi, yalnızca iki kökün yerini değiştiren bir permütasyon ise (buna *transpozisyon* denir) $L$ ile $L'$ sayılarını birbirine dönüştürür. Demek ki altı permütasyon uygulandığında $L^3$ yalnızca iki değer alır: $L^3$ ve $(L')^3$. Bu iki değerin toplamı ve çarpımı simetrik, dolayısıyla bilinir. Yani $L^3$ katsayıları bilinen ikinci dereceden bir denklemi sağlar; bu denklem de kılık değiştirmiş Cardano çözücüsüdür: $x^3 + px + q$ için $u = L/3$ ve $v = L'/3$ alınabilir.

Dördüncü derecede ise

$$
\begin{gathered}
r_1 r_2 + r_3 r_4, \\
r_1 r_3 + r_2 r_4, \\
r_1 r_4 + r_2 r_3
\end{gathered}
$$

sayıları, köklerin 24 permütasyonuyla yalnızca kendi aralarında yer değiştirir. Bu yüzden katsayıları bilinen üçüncü dereceden bir denklemin kökleridir; yarıları da tam olarak Ferrari’nin çözücü kübiğinin kökleri. Üçünü birden yerinde bırakan permütasyonlar *Klein dörtlü grubunu* oluşturur: $V_4 = \{e, (1\,2)(3\,4), (1\,3)(2\,4), (1\,4)(2\,3)\}$. ($e$ hiçbir kökü oynatmaz; $(1\,2)(3\,4)$ ise 1. ile 2. kökün, 3. ile 4. kökün yerini değiştirir.)

Lagrange’ın dersi şu: Her klasik formül, kökler cinsinden yazılmış bir ifade zinciri hesaplar. Zincirdeki her ifade bir öncekinden daha az simetriktir, yani onu değiştirmeyen permütasyonlar daha azdır. Her ifade de öncekilerden basit bir denklem çözülerek bulunur.

## Kökler, permütasyonlar ve cisimler

### Simetrik ifadeler katsayılardan hesaplanır

Vieta formüllerine göre $x^n + a_{n-1}x^{n-1} + \dots + a_1 x + a_0 = (x - r_1)\cdots(x - r_n)$ ise

$$
\begin{aligned}
a_{n-1} &= -(r_1 + r_2 + \dots + r_n), \\
a_{n-2} &= \textstyle\sum_{i<j} r_i r_j, \quad \dots, \\
a_0 &= (-1)^n\, r_1 r_2 \cdots r_n
\end{aligned}
$$

olur. Bunlar, işaretleri bir yana, temel simetrik polinomlardır. Simetrik polinomların temel teoremi de şunu söyler: Kökler cinsinden yazılan bir polinom, köklerin $n!$ permütasyonunun hiçbiriyle (yani $S_n$ simetrik grubunun hiçbir elemanıyla) değişmiyorsa katsayıların bir polinomudur. Demek ki simetrik ifadeler bedava: Doğrudan katsayılardan hesaplanırlar. Zorluk, daha az simetrik ifadelerde. En uç örnek kök listesinin kendisi: Onu yalnızca özdeşlik permütasyonu değiştirmeden bırakır.

### Radikallerle çözüm bir cisim kulesidir

Bundan sonra rasyonel sayılar $\mathbb{Q}$ gibi, karakteristiği 0 olan bir $F$ cismi üzerinde çalışacağız. (Cisim, dört işlemi rahatça yapabildiğimiz bir sayı sistemidir.) Radikallerle yazılmış bir formül sonlu bir tariftir. Önce $F$’deki bir sayının kökü olan bir $\alpha_1$ ekleriz ($\alpha_1^{m_1} \in F$). Sonra yeni cisim $F(\alpha_1)$’deki bir sayının kökü olan bir $\alpha_2$ ekleriz ($\alpha_2^{m_2} \in F(\alpha_1)$) ve böyle devam ederiz. Bu tarif, iç içe cisimlerden bir kule kurar:

$$
\begin{gathered}
F = F_0 \subset F_1 \subset \dots \subset F_k, \\
F_i = F_{i-1}(\alpha_i), \quad \alpha_i^{m_i} \in F_{i-1}.
\end{gathered}
$$

Katsayıları $F$’de olan bir $f \in F[x]$ polinomu için böyle kulelerden biri $f$ polinomunun bütün köklerini içeren bir cisimde bitiyorsa, $f$ polinomuna *radikallerle çözülebilir* denir.

Birimin kökleri (bir kuvveti 1 olan sayılar) elimizde yeterince varsa her adım basittir. Birimin köklerini eklemek zararsızdır, çünkü $F(\zeta)/F$ genişlemesinin Galois grubu değişmelidir, yani elemanlarının sırası fark etmez. Bu yüzden kulenin en altına birimin ilkel bir $N$’inci kökü olan $\zeta$ sayısını koyarız; $N$ sayısını da her $m_i$’ye bölünecek şekilde seçeriz. O zaman $F_i$ cisminin, $F_{i-1}$’in her elemanını yerinde bırakan bir otomorfizması (cismi, dört işlemi bozmadan kendine eşleyen bir dönüşüm), $\alpha_i$ sayısını $x^{m_i} - \alpha_i^{m_i}$ polinomunun başka bir köküne götürmek zorundadır. Bu kök de $\eta^{m_i} = 1$ olan bir $\eta$ için $\eta\,\alpha_i$ biçimindedir. Otomorfizmaları art arda uygulamak, birimin bu köklerini çarpmak demektir. Demek ki her radikal adım *devirli*, dolayısıyla değişmeli bir genişlemedir.

### Galois grubu ve temel teorem

$K$, $f$ polinomunun $F$ üzerindeki ayrışım cismi, yani $F$’ye bu polinomun bütün kökleri eklenince oluşan cisim olsun. *Galois grubu* $\mathrm{Gal}(f) = \mathrm{Gal}(K/F)$, $K$ cisminin, $F$’nin her elemanını yerinde bırakan otomorfizmalarından oluşur. Bu otomorfizmaların her biri $f$ polinomunun köklerinin yerini değiştirir ve bu permütasyon onu tamamen belirler. Bu yüzden $\mathrm{Gal}(f)$, $S_n$ grubunun bir altgrubudur: Kökler arasındaki her cebirsel bağıntıyı koruyan permütasyonlardan oluşur. Katsayıları bağımsız değişkenler olan *genel* polinomda kökler arasında özel bir bağıntı yoktur ve Galois grubu $S_n$ grubunun tamamıdır.

Galois teorisinin temel teoremi, cisimlerle gruplar arasında bir sözlük gibidir. $F \subseteq E \subseteq K$ olan her $E$ ara cismi, $G = \mathrm{Gal}(K/F)$ grubunun bir $H$ altgrubuyla birebir eşleşir. Bir cisme, onun her elemanını yerinde bırakan otomorfizmalar karşılık gelir; bir altgruba da yerinde bıraktığı elemanların cismi. Büyük cisimler küçük gruplarla eşleşir. Ayrıca $E/F$ genişlemesi, tam da $H$ altgrubu $G$ içinde *normal* olduğunda bir Galois genişlemesidir ve o zaman bu genişlemenin Galois grubu yapıca $G/H$ bölüm grubunun aynısıdır: $\mathrm{Gal}(E/F) \cong G/H$.

Şimdi bir radikal kulesini bu sözlükle okuyalım. $F$ cisminden $K$ cismine radikal radikal tırmanmak, $G$ grubundan tek elemanlı $\{e\}$ grubuna her adımda bir normal altgruba inmek demektir; üstelik her adımda bölüm grubu değişmelidir. (İşin aslı, kule $K$ cismini aşabilir. O zaman kulenin, yine radikallerle kurulan Galois kapanışına geçer ve $\mathrm{Gal}(f)$ grubunun bu büyük grubun bir bölüm grubu olduğunu kullanırız.)

## Çözülebilir gruplar ve teorem

Grup teorisinde bu yapının bir adı var: çözülebilirlik. Sonlu bir $G$ grubunun şöyle bir altnormal serisi varsa, $G$ grubuna *çözülebilir grup* denir:

$$
G = G_0 \trianglerighteq G_1 \trianglerighteq \dots \trianglerighteq G_k = \{e\}.
$$

Burada her $G_{i+1}$, bir üstündeki $G_i$ içinde normaldir (ama $G$ içinde normal olmak zorunda değildir) ve her $G_i/G_{i+1}$ bölüm grubu değişmelidir. Sözlük, radikal kulelerini bu tür serilere çevirir. Bir fikir daha eklersek serileri de kulelere çevirebiliriz.

<div class="my-8 rounded-xl border border-zinc-200 bg-white px-5 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900">

**Teorem (Galois).** $F$ karakteristiği 0 olan bir cisim (örneğin $\mathbb{Q}$) ve $f \in F[x]$ olsun. $f(x) = 0$ denkleminin $F$ üzerinde radikallerle çözülebilmesi için $\mathrm{Gal}(f)$ grubunun çözülebilir olması gerekir ve yeter.

</div>

Eksik fikir yine Lagrange’dan geliyor. Ters yönde gitmek için seriyi, her bölüm grubu asal $p$ sayıda elemanı olan devirli bir grup olana kadar inceltir ve birimin gereken köklerini ekleriz. Böyle bir adımın Galois grubu tek bir $\sigma$ elemanının kuvvetlerinden oluşsun. $\theta$ büyük cisimden bir eleman, $\zeta$ da birimin ilkel bir $p$’inci kökü olsun. O zaman

$$
\ell = \sum_{j=0}^{p-1} \zeta^{-j}\,\sigma^{j}(\theta)
$$

Lagrange çözücüsü $\sigma(\ell) = \zeta\ell$ eşitliğini sağlar; bu yüzden $\ell^p$ küçük cisimdedir. $\theta$ uygun seçilirse $\ell \ne 0$ olur ve büyük cisim, küçük cisme $\ell$ eklenerek elde edilir; yani bu adım $\ell^p$ sayısının $p$’inci kökünü almaktan ibarettir. Üçüncü derecedeki $L$ tam olarak bu yapıdır.

Genel polinomun Galois grubu $S_n$ olduğu için $n$’inci dereceden genel denklem ancak ve ancak $S_n$ çözülebilir bir grupsa radikallerle çözülebilir. Böylece formül sorusu bir permütasyon sorusuna dönüştü.

### Klasik formüller birer merdiven

$n = 3$ için merdivenin iki basamağı var:

$$
\begin{gathered}
S_3 \;\triangleright\; A_3 \;\triangleright\; \{e\}, \\
S_3/A_3 \cong C_2, \qquad A_3 \cong C_3 .
\end{gathered}
$$

Burada $A_n$, çift permütasyonlardan (çift sayıda transpozisyonla elde edilenlerden) oluşan alterne grubu; $C_m$ de $m$ elemanlı devirli grubu gösterir. $C_2$ basamağı, çift permütasyonları tek olanlardan ayıran bir karekök. Cardano formülündeki $\sqrt{D}$ bu kareköktür: $\Delta = \prod_{i<j}(r_i - r_j)^2 = -4p^3 - 27q^2$ diskriminant olmak üzere $D = -\Delta/108$ olur. $\sqrt{\Delta} = \prod_{i<j}(r_i - r_j)$ ise köklerin ikili farklarının çarpımıdır ve her transpozisyonda işaret değiştirir. $C_3$ basamağı da küpkök.

$n = 4$ için merdivenin dört basamağı var:

$$
S_4 \;\triangleright\; A_4 \;\triangleright\; V_4 \;\triangleright\; C_2 \;\triangleright\; \{e\}.
$$

Grupların eleman sayıları sırasıyla $24, 12, 4, 2, 1$; bölüm grupları ise $C_2, C_3, C_2, C_2$. Burada $C_2 = \{e, (1\,2)(3\,4)\}$ alıyoruz. Bu grup $V_4$ içinde normal ama $S_4$ içinde değil; bunda sakınca yok, çünkü altnormal seri her grubun yalnızca bir üstündeki grup içinde normal olmasını ister. Bu merdiven, Ferrari yönteminin ta kendisi. İlk iki basamak, kökleri tam olarak $V_4$’ün yerinde bıraktığı çözücü kübiği bir karekök ve bir küpkökle çözer. Son iki basamak da karekök: $s = \sqrt{2y - p}$ denklemi iki ikinci dereceden denkleme ayırır, ikinci dereceden denklemin kök formülü de işi bitirir.

## Beşte kırılan merdiven: 60 elemanlı basit bir grup

$n = 5$ için ilk basamak hâlâ yerinde. $A_5$ alterne grubu, $S_5$’in elemanlarının tam yarısını içerir (indeksi 2’dir); bu yüzden normaldir ve $S_5/A_5 \cong C_2$ olur. Yani diskriminantın karekökü yine elimizde. Sorun bir sonraki basamakta. Merdiveni sürdürmek için $A_5$ ya değişmeli olmalı ya da $\{e\} \ne N \ne A_5$ olan bir $N$ normal altgrubu içermeli. $A_5$ değişmeli değil.

Normal bir altgrup, eşlenik sınıflarının birleşimidir; bu yüzden bu sınıfları bilmek işimize yarar. $A_5$’in 60 elemanı beş eşlenik sınıfına ayrılır:

| Devir tipi | Örnek | Sınıf büyüklüğü |
| --- | --- | ---: |
| özdeşlik | $e$ | 1 |
| 3-devirler | $(1\,2\,3)$ | 20 |
| iki ayrık transpozisyon | $(1\,2)(3\,4)$ | 15 |
| 5-devirler | $(1\,2\,3\,4\,5)$ | 12 |
| 5-devirler | $(1\,3\,5\,2\,4)$ | 12 |

$S_5$’teki 24 tane 5-devir, $A_5$ içinde on ikişer elemanlı iki sınıfa ayrılır: Bir 5-devir ile karesi (tablodaki iki örnek gibi) birbirine ancak tek permütasyonlarla eşleniktir.

Şimdi $N$, $A_5$’in bir normal altgrubu olsun. $N$ etkisiz eleman $e$’yi içerir, tam sınıfların birleşimidir ve Lagrange teoremine göre eleman sayısı $|N|$, 60’ı böler. Buna göre $|N|$, 1 ile 12, 12, 15 ve 20 sayılarından bazılarının toplamıdır. Olası değerler şunlar:

$$
\begin{gathered}
1, 13, 16, 21, 25, 28, \\
33, 36, 40, 45, 48, 60.
\end{gathered}
$$

Bunlardan 60’ı bölenler yalnızca 1 ve 60. Demek ki $A_5$’in $\{e\}$ ve kendisinden başka normal altgrubu yok; yani $A_5$ *basit* bir gruptur. Üstelik hiç de değişmeli değildir, çünkü değişmeli bir grupta her eşlenik sınıfı tek elemanlıdır.

Sonuç olarak $S_5$ için merdiven

$$
S_5 \;\triangleright\; A_5 \;\triangleright\; \{e\}
$$

serisinde kalır; araya yeni bir basamak koyamayız. Bu, $S_5$’in tek bileşim serisidir (bölümleri basit gruplar olan altnormal seri). Jordan–Hölder teoremine göre bir grubun bütün bileşim serilerinde aynı bölüm grupları çıkar. Çözülebilir bir grubun bileşim serisindeki bölümler, asal sayıda elemanı olan devirli gruplardır; burada ise bölümlerden biri $A_5$. O hâlde $S_5$ çözülebilir değildir. Aynı şekilde $A_n$ de her $n \ge 5$ için basit ve değişmeli olmayan bir gruptur; bu yüzden $n \ge 5$ iken hiçbir $S_n$ çözülebilir değildir.

<div class="my-8 rounded-xl border border-zinc-200 bg-white px-5 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900">

**Teorem (Abel–Ruffini).** Her $n \ge 5$ için $n$’inci dereceden genel polinom denklemi radikallerle çözülemez.

</div>

<figure class="not-prose my-10">
<div class="relative overflow-hidden rounded-xl border border-zinc-200 bg-white px-3 py-6 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900">
<div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-graph mask-fade-b"></div>
<svg class="relative mx-auto block h-auto w-full max-w-xs text-zinc-900 dark:text-zinc-100" viewBox="48 0 288 316" role="img" aria-label="Aynı logaritmik ölçekte çizilmiş iki merdiven. Dördüncü derece: S4, A4, V4, C2 ve tek elemanlı grup; bölüm grupları C2, C3, C2 ve C2, hepsi değişmeli. Beşinci derece: S5, A5 ve tek elemanlı grup; bölüm grupları C2 ve A5. Sondaki uzun basamak A5 değişmeli değil." xmlns="http://www.w3.org/2000/svg">
<!-- Math labels use KaTeX's fonts, which the formulas on this page already load: they match the text and cost no extra download. -->
<g class="text-zinc-600 dark:text-zinc-400" fill="currentColor" style="font-family: KaTeX_Main, var(--font-serif); font-size: 15px">
<text x="100" y="24" text-anchor="middle"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">n</tspan> = 4</text>
<text x="220" y="24" text-anchor="middle"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">n</tspan> = 5</text>
</g>
<g stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-opacity="0.6">
<line x1="100" y1="143.7" x2="100" y2="164.4"/>
<line x1="100" y1="178.4" x2="100" y2="219.5"/>
<line x1="100" y1="233.5" x2="100" y2="254.3"/>
<line x1="100" y1="268.3" x2="100" y2="289"/>
<line x1="220" y1="63" x2="220" y2="83.8"/>
</g>
<g fill="currentColor">
<circle cx="100" cy="136.7" r="3.5"/>
<circle cx="100" cy="171.4" r="3.5"/>
<circle cx="100" cy="226.5" r="3.5"/>
<circle cx="100" cy="261.3" r="3.5"/>
<circle cx="220" cy="56" r="3.5"/>
</g>
<g fill="none" stroke="currentColor" stroke-width="1.25">
<circle cx="100" cy="296" r="3.5"/>
<circle cx="220" cy="296" r="3.5"/>
</g>
<g fill="currentColor" text-anchor="end" style="font-family: KaTeX_Main, var(--font-serif); font-size: 17px">
<text x="86" y="142.2"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">S</tspan><tspan font-size="12" dy="4">4</tspan></text>
<text x="86" y="176.9"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">A</tspan><tspan font-size="12" dy="4">4</tspan></text>
<text x="86" y="232"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">V</tspan><tspan font-size="12" dy="4">4</tspan></text>
<text x="86" y="266.8"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">C</tspan><tspan font-size="12" dy="4">2</tspan></text>
<text x="86" y="301.5">{<tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">e</tspan>}</text>
<text x="206" y="61.5"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">S</tspan><tspan font-size="12" dy="4">5</tspan></text>
<text x="206" y="96.3"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">A</tspan><tspan font-size="12" dy="4">5</tspan></text>
<text x="206" y="301.5">{<tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">e</tspan>}</text>
</g>
<g class="text-zinc-600 dark:text-zinc-400" fill="currentColor" style="font-family: KaTeX_Main, var(--font-serif); font-size: 15px">
<text x="114" y="159"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">C</tspan><tspan font-size="12" dy="4">2</tspan></text>
<text x="114" y="204"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">C</tspan><tspan font-size="12" dy="4">3</tspan></text>
<text x="114" y="249"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">C</tspan><tspan font-size="12" dy="4">2</tspan></text>
<text x="114" y="283.6"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">C</tspan><tspan font-size="12" dy="4">2</tspan></text>
<text x="234" y="78.4"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">C</tspan><tspan font-size="12" dy="4">2</tspan></text>
</g>
<g class="text-accent-700 dark:text-accent-400" fill="currentColor">
<line x1="220" y1="97.8" x2="220" y2="289" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
<circle cx="220" cy="90.8" r="3.5"/>
<text x="234" y="192" style="font-family: KaTeX_Main, var(--font-serif); font-size: 17px"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">A</tspan><tspan font-size="12" dy="4">5</tspan></text>
<text x="234" y="212" style="font-family: var(--font-mono); font-size: 13px">değişmeli</text>
<text x="234" y="228" style="font-family: var(--font-mono); font-size: 13px">değil</text>
</g>
</svg>
</div>
<figcaption class="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">Merdiven biçiminde çizilmiş bileşim serileri. Her basamağın yanında bölüm grubu yazıyor. Her grup, eleman sayısının logaritmasıyla orantılı bir yükseklikte duruyor; bu yüzden bir basamağın uzunluğu, bölüm grubunun eleman sayısını gösteriyor. <i>S</i><sub>4</sub> dört küçük değişmeli basamağa ayrılıyor. <i>S</i><sub>5</sub>’te ise kısa bir basamaktan sonra tek ve uzun bir basamak geliyor: bölünemeyen basit grup <i>A</i><sub>5</sub>.</figcaption>
</figure>

## Radikallerle çözülemeyen bir beşinci dereceden denklem

Genel polinom, katsayıları değişken olan soyut bir nesne; ama teoremin somut sayılar için de sonuçları var. Şu polinoma bakalım:

$$
f(x) = x^5 - 4x + 2 .
$$

1. **İndirgenemez.** $p = 2$ için Eisenstein ölçütü işe yarar: 2, baş katsayı dışındaki bütün katsayıları böler; $2^2 = 4$ ise sabit terimi bölmez. Bu yüzden $f$ polinomu $\mathbb{Q}$ üzerinde indirgenemez, yani daha düşük dereceli rasyonel polinomların çarpımına ayrılamaz. Beş kökü de birbirinden farklıdır.
2. **Tam üç gerçel kökü var.** $f(-2) = -22 < 0 < 2 = f(0)$ ve $f(1) = -1 < 0 < 26 = f(2)$ olduğu için polinom $(-2, 0)$, $(0, 1)$ ve $(1, 2)$ aralıklarının her birinde işaret değiştirir, yani sıfırdan geçer; demek ki en az üç gerçel kök var. Türev $f'(x) = 5x^4 - 4$ yalnızca $x = \pm(4/5)^{1/4}$ noktalarında sıfır olur; bu yüzden Rolle teoremine göre en fazla üç gerçel kök olabilir. Kalan iki kök birbirinin karmaşık eşleniğidir.
3. **Galois grubunda bir transpozisyon var.** Karmaşık eşlenik alma işlemi $K \subset \mathbb{C}$ ayrışım cismini yine kendisine götürür ve $\mathbb{Q}$ cismini değiştirmez; bu yüzden $\mathrm{Gal}(f)$ grubunun bir elemanıdır. Bu eleman üç gerçel kökü yerinde bırakır, öbür ikisinin yerini değiştirir.
4. **Bir 5-devir de var.** $f$ indirgenemez olduğundan her $\alpha$ kökü için $[\mathbb{Q}(\alpha):\mathbb{Q}] = 5$ olur. Bu yüzden 5, $[K:\mathbb{Q}] = |\mathrm{Gal}(f)|$ sayısını böler. Cauchy teoremine göre grupta mertebesi 5 olan, yani beş kez uygulanınca başa dönen bir eleman vardır. $S_5$’te mertebesi 5 olan elemanlar da tam olarak 5-devirlerdir.
5. **Demek ki Galois grubu $S_5$’in tamamı.** Kökleri, transpozisyon $(1\,2)$ olacak şekilde numaralandıralım. 5-devrin bir kuvveti 1’i 2’ye götürür; 5 asal olduğu için bu kuvvet de bir 5-devirdir. Öbür üç kökü yeniden numaralandırırsak bu devir $(1\,2\,3\,4\,5)$ olur. $(1\,2)$ transpozisyonunun bu devirle eşleniğini art arda alırsak $(2\,3)$, $(3\,4)$ ve $(4\,5)$ çıkar. Ardışık iki sayının yerini değiştiren transpozisyonlar da $S_5$’in tamamını üretir.

Böylece $\mathrm{Gal}(x^5 - 4x + 2) = S_5$ olur. Bu grup çözülebilir değil; bu yüzden beş kökten hiçbiri tam sayılar, dört işlem ve radikallerle yazılamaz. (Tek bir kök bile yazılabilseydi, onun kulesinin Galois kapanışı beş kökün hepsini içerirdi.)

## Teoremin söylemedikleri

**Beşinci dereceden denklemlerin çözümü olmadığını söylemez.** Cebirin temel teoremine göre $x^5 - 4x + 2$ polinomunun beş karmaşık kökü vardır ve bunları hesaplamak kolaydır. Newton yönteminin $x_{k+1} = x_k - f(x_k)/f'(x_k)$ formülü burada

$$
x_{k+1} = x_k - \frac{x_k^5 - 4x_k + 2}{5x_k^4 - 4}
$$

hâlini alır. $x_0 = 0$’dan başlarsak sırasıyla $0{,}5$, $0{,}508474\ldots$, $0{,}508499484434\ldots$ ve $0{,}508499484657\ldots$ değerlerini buluruz: Doğru basamak sayısı her adımda kabaca ikiye katlanır. Öbür kökler yaklaşık olarak $-1{,}518512$, $1{,}243596$ ve $-0{,}116792 \pm 1{,}438448\,i$.

**Hiçbir beşinci dereceden denklemin radikallerle çözülemeyeceğini de söylemez.** Bazı özel denklemler çözülebilir. $\zeta = e^{2\pi i/5}$ olmak üzere $x^5 - 2$ polinomunun kökleri $k = 0, 1, \dots, 4$ için $\sqrt[5]{2}\,\zeta^k$ sayılarıdır. $\zeta$ da radikallerle yazılabilir; bunu örneğin $\cos(2\pi/5) = (\sqrt{5} - 1)/4$ eşitliğinden görebiliriz. $x^5 - 2$ polinomunun Galois grubu 20 elemanlı ve çözülebilir: 5 elemanlı devirli bir normal altgrubu var ve bölüm grubu 4 elemanlı devirli grup. Teoremin dışladığı şey, beşinci dereceden *her* denklemde işe yarayan tek bir formül. Hangi denklemlerin çözülebildiğine ise Galois ölçütü tek tek karar verir.

**Hiçbir kapalı biçim olmadığını da söylemez.** Dışlanan yalnızca radikaller. Radikallere tek bir yeni fonksiyon, *Bring radikali* eklenirse beşinci dereceden her denklem kapalı biçimde çözülebilir. Bring radikali, gerçel $a$ için $x^5 + x + a = 0$ denkleminin tek gerçel köküdür; $a$’nın fonksiyonu olarak düşünülür ve analitik devamla karmaşık $a$ değerlerine genişletilir. Üçüncü dereceden denklem nasıl trigonometrik fonksiyonlarla çözülebiliyorsa, Charles Hermite de 1858’de beşinci dereceden denklemi eliptik modüler fonksiyonlarla çözdü. Felix Klein da sonradan bütün tabloyu, dönme grubu tam olarak $A_5$ olan düzgün yirmi yüzlünün (ikosahedron) simetrileriyle açıkladı.

## Sonuç: Çözülebilirliğe simetri karar verir

Radikallerle yazılmış bir formül, simetriyi söken bir makine gibidir. Her radikal, kökler arasındaki simetriyi değişmeli bir adımla biraz daha kırar. Bir formülün var olması da simetri grubunun bu şekilde parçalara ayrılabilmesiyle aynı şeydir. İkinci, üçüncü ve dördüncü derecede simetrik grup değişmeli parçalara ayrılır: $C_2$; sonra $C_2, C_3$; sonra $C_2, C_3, C_2, C_2$. Beşinci dereceden başlayarak ise genel denklemin içinde, hiçbir radikalin bölemeyeceği basit ve değişmeli olmayan bir çekirdek vardır: $A_n$. Yani genel beşinci dereceden denklem çözülemeyecek kadar karmaşık değil; simetrisi, radikallerin sökemeyeceği türden.

## Okuma önerileri

- David S. Dummit ve Richard M. Foote, <cite lang="en">Abstract Algebra</cite>, 3. baskı (Wiley, 2004), 14. bölüm; 14.7. kısım çözülebilir genişlemeleri, radikal genişlemeleri ve beşinci dereceden denklemin neden çözülemediğini anlatıyor.
- Ian Stewart, <cite lang="en">Galois Theory</cite> (CRC Press): teoriyi tarihiyle birlikte anlatıyor.
- V. B. Alekseev, <cite lang="en">Abel's Theorem in Problems and Solutions</cite> (V. I. Arnold’un derslerine dayanıyor): gruplar, karmaşık fonksiyonlar ve Riemann yüzeyleri üzerinden, problem çözerek ilerleyen bir yol.
- Niels Henrik Abel, <cite lang="fr">Mémoire sur les équations algébriques où on démontre l'impossibilité de la résolution de l'équation générale du cinquième degré</cite> (Christiania, 1824): özgün kanıt; kısalığıyla ünlü bir kitapçık.
