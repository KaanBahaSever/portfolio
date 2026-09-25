---
title: Abel–Ruffini Teoremine Sezgisel Bir Rehber
description: 'Genel beşinci derece denklemi radikallerle çözen bir formül neden yok? Köklerin simetrileri ve Galois teorisi üzerinden sezgisel bir anlatım.'
pubDate: 2026-09-25
lang: tr
translationKey: abel-ruffini
tags: [matematik, cebir, galois-teorisi]
---

İkinci dereceden denklemlerin kök formülünü hepimiz okulda öğreniriz:

$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}.
$$

Daha kalın bir kitapta her derece için benzer bir formül bulunduğunu düşünmek doğaldır. Üçüncü ve dördüncü derece için gerçekten de vardır. Beşinci derece için ise yoktur ve hiçbir kitapta da olmayacaktır: Her beşinci derece denklemin köklerini katsayılarından yalnızca toplama, çıkarma, çarpma, bölme ve her dereceden kök alma işlemleriyle veren bir formül yoktur. Abel–Ruffini teoremi tam olarak bunu söyler.

Bu hâliyle teorem, insan zekâsının sınırları hakkında verilmiş bir hüküm gibi görünür; oysa asıl söylediği şey simetriyle ilgilidir. Bu yazıda o fikrin izini süreceğiz: Klasik formüllerin neden işe yaradığını, beşinci derecede neyin değiştiğini ve engelin, köklerin bulunmasının zorluğuyla neden hiçbir ilgisi olmadığını göreceğiz.

## Eksik bir formülün kısa tarihi

Babilli kâtipler ikinci dereceden problemleri neredeyse dört bin yıl önce çözüyordu; tam kareye tamamlama yöntemi ise 9. yüzyılda Harezmî'nin elinde sistematik bir biçim kazandı. Sonraki adım çok daha uzun sürdü: 16. yüzyıl İtalya'sında önce Scipione del Ferro, ardından Niccolò Tartaglia üçüncü dereceden denklemleri çözmeyi başardı. Gerolamo Cardano bu yöntemi 1545'te <cite lang="la">Ars Magna</cite> adlı kitabında, öğrencisi Lodovico Ferrari'nin dördüncü derece için bulduğu çözümle birlikte yayımladı.

Ardından beşinci derece için iki buçuk yüzyıl süren sonuçsuz denemeler geldi. 1770–71'de Joseph-Louis Lagrange soruyu değiştirdi: Eski yöntemlerin *neden* işe yaradığını sordu ve hepsinin köklerin permütasyonları üzerine kurulu olduğunu gördü. Paolo Ruffini bu fikirden yola çıkarak 1799'da genel beşinci derece denklemin radikallerle çözülemeyeceğini savundu. Kanıtı özünde doğruydu, ancak bir çözümde görünen her radikalin köklerin rasyonel bir fonksiyonu olduğunu kanıtlamadan kabul ediyordu. Niels Henrik Abel bu boşluğu 1824'te, basım masrafını kendi cebinden karşıladığı kısa bir risaleyle kapattı. Birkaç yıl sonra, 1832'de henüz yirmi yaşındayken ölen Évariste Galois daha keskin bir soruyu yanıtladı: Hangi denklemler radikallerle çözülebilir? Ancak 1846'da yayımlanabilen çalışmaları, bugün onun adını taşıyan teoriye dönüştü.

## Dördüncü dereceye kadar neden formül var?

### 2. derece: bir karekök, bir simetri

$x^2 + px + q = (x - r_1)(x - r_2)$ olsun. Tam kareye tamamlarsak

$$
x^2 + px + q = \Bigl(x + \frac{p}{2}\Bigr)^2 - \frac{p^2 - 4q}{4}
$$

olur ve formül buradan çıkar. Ama aynı hesabı bir kez de başka bir gözle okumak daha öğreticidir. $r_1 + r_2 = -p$ toplamı ve $r_1 r_2 = q$ çarpımı *simetriktir*: Kökler yer değiştirince değişmezler ve doğrudan katsayılardan okunurlar. $r_1 - r_2$ farkı ise simetrik değildir, çünkü yer değiştirme onun işaretini değiştirir; ama karesi simetriktir:

$$
\begin{aligned}
(r_1 - r_2)^2 &= (r_1 + r_2)^2 - 4r_1 r_2 \\
&= p^2 - 4q.
\end{aligned}
$$

Tek bir karekök, $r_1 - r_2$ farkını bu işaret belirsizliği dışında geri verir; ardından $r_{1,2} = \tfrac12\bigl((r_1 + r_2) \pm (r_1 - r_2)\bigr)$ bulunur. Karekök tek bir iş görür: İki kökün sahip olduğu tek simetriyi kırar.

### 3. derece: Cardano yöntemi

$ax^3 + bx^2 + cx + d$ polinomunda $x = y - \frac{b}{3a}$ dönüşümünü yapıp $a$'ya bölünce ikinci dereceden terim yok olur; bu yüzden $x^3 + px + q = 0$ biçimindeki *indirgenmiş* kübiği çözmek yeterlidir. Cardano kökü $x = u + v$ biçiminde arar. $(u + v)^3 = u^3 + v^3 + 3uv(u + v)$ olduğundan denklem

$$
u^3 + v^3 + q + (3uv + p)(u + v) = 0
$$

hâline gelir. İki bilinmeyene karşılık tek denklem olduğundan ikinci bir koşul koyabiliriz: $3uv = -p$. O zaman $u^3 + v^3 = -q$ ve $u^3 v^3 = -p^3/27$ olur; yani $u^3$ ve $v^3$ sayıları

$$
t^2 + qt - \frac{p^3}{27} = 0
$$

*çözücü ikinci derece denkleminin* kökleridir. Bu denklemi çözüp küpkök alınca Cardano formülü elde edilir:

$$
\begin{gathered}
x = \sqrt[3]{-\frac{q}{2} + \sqrt{D}} + \sqrt[3]{-\frac{q}{2} - \sqrt{D}}, \\
D = \frac{q^2}{4} + \frac{p^3}{27}.
\end{gathered}
$$

Burada iki küpkök, çarpımları $-p/3$ olacak biçimde seçilir. Önce bir karekök, sonra bir küpkök: Bu sırayı aklınızda tutun.

### 4. derece: Ferrari'nin çözücü kübiği

Benzer bir kaydırmayla dördüncü derece bir denklem $x^4 + px^2 + qx + r = 0$ biçimine getirilir. Ferrari'nin fikri, sol tarafı tam kare yapacak yardımcı bir $y$ bilinmeyeni eklemektir:

$$
\begin{aligned}
(x^2 + y)^2 &= (2y - p)\,x^2 - qx \\
&\quad + (y^2 - r).
\end{aligned}
$$

Sağ taraf $x$'e göre ikinci derecedendir ve tam olarak diskriminantı sıfır olduğunda, yani $q^2 = 4(2y - p)(y^2 - r)$ iken tam karedir. Bu, $y$ için üçüncü dereceden bir denklemdir ve *çözücü kübik* adını alır:

$$
8y^3 - 4py^2 - 8ry + 4pr - q^2 = 0.
$$

Bu denklemi Cardano formülüyle çözelim. $q \ne 0$ ise her $y$ kökü $2y \ne p$ koşulunu sağlar ($q = 0$ ise denklem zaten $x^2$'ye göre ikinci derecedendir); dolayısıyla iki taraf da tam karedir ve $s = \sqrt{2y - p}$ dersek denklem iki ikinci derece denkleme ayrılır:

$$
x^2 + y = \pm\Bigl(s\,x - \frac{q}{2s}\Bigr).
$$

### Lagrange çözücüleri

Lagrange, bu yardımcı niceliklerin kökler cinsinden *ne olduğunu* sordu. Kökleri $r_1, r_2, r_3$ olan bir kübik için $\omega = e^{2\pi i/3}$ alalım ve

$$
\begin{aligned}
L &= r_1 + \omega r_2 + \omega^2 r_3, \\
L' &= r_1 + \omega^2 r_2 + \omega r_3
\end{aligned}
$$

tanımlayalım. $r_1 \mapsto r_2 \mapsto r_3 \mapsto r_1$ devirli permütasyonu $L$ sayısını $\omega^2 L$ sayısına götürür, dolayısıyla $L^3$ bu permütasyon altında değişmez; $r_2 \leftrightarrow r_3$ gibi bir transpozisyon ise $L$ ile $L'$ sayılarının yerini değiştirir. Demek ki altı permütasyonun hepsi altında $L^3$ yalnızca iki değer alır: $L^3$ ve $(L')^3$. Bu iki değerin toplamı ve çarpımı simetriktir, dolayısıyla bilinir. Yani $L^3$ katsayıları bilinen bir ikinci derece denklemi sağlar ve bu denklem, kılık değiştirmiş Cardano çözücüsüdür: $x^3 + px + q$ için $u = L/3$ ve $v = L'/3$ alınabilir.

Dördüncü derecede

$$
\begin{gathered}
r_1 r_2 + r_3 r_4, \\
r_1 r_3 + r_2 r_4, \\
r_1 r_4 + r_2 r_3
\end{gathered}
$$

nicelikleri, köklerin 24 permütasyonu altında yalnızca kendi aralarında yer değiştirir; dolayısıyla katsayıları bilinen bir kübiğin kökleridir. Bu niceliklerin yarıları da tam olarak Ferrari'nin çözücü kübiğinin kökleridir. Üçünü birden sabit bırakan permütasyonlar *Klein dörtlü grubunu* oluşturur: $V_4 = \{e, (1\,2)(3\,4), (1\,3)(2\,4), (1\,4)(2\,3)\}$.

Lagrange'ın dersi şudur: Her klasik formül, kökler cinsinden bir ifadeler zinciri hesaplar; zincirin her halkası bir öncekinden daha az permütasyonla sabit kalır ve öncekilerden basit bir denklem çözülerek elde edilir.

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

olur. Bunlar, işaret dışında, temel simetrik polinomlardır. Simetrik polinomların temel teoremine göre kökler cinsinden yazılmış ve köklerin $n!$ permütasyonunun hepsi altında, yani $S_n$ simetrik grubunun tamamı altında değişmeyen her polinom, katsayıların bir polinomudur. Demek ki simetrik ifadeler doğrudan katsayılardan hesaplanır; zorluk, daha az simetriye sahip ifadelerdedir. En uç örnek, yalnızca özdeşlik permütasyonunun sabit bıraktığı kök listesinin kendisidir.

### Radikallerle çözüm bir cisim kulesidir

Bundan sonra $\mathbb{Q}$ gibi karakteristiği 0 olan bir $F$ cismi üzerinde çalışıyoruz. Radikallerle yazılmış bir formül sonlu bir tariftir: Önce $\alpha_1^{m_1} \in F$ olacak şekilde bir $\alpha_1$ sayısı eklenir, sonra $\alpha_2^{m_2} \in F(\alpha_1)$ olacak şekilde bir $\alpha_2$ sayısı ve böyle devam edilir. Tarif bir cisim genişlemeleri kulesi kurar:

$$
\begin{gathered}
F = F_0 \subset F_1 \subset \dots \subset F_k, \\
F_i = F_{i-1}(\alpha_i), \quad \alpha_i^{m_i} \in F_{i-1}.
\end{gathered}
$$

Bir $f \in F[x]$ polinomunun bütün köklerini içeren bir cisimde son bulan böyle bir kule varsa, $f$ polinomuna *radikallerle çözülebilir* denir.

Birimin yeterince kökü mevcutsa her adım basittir. Birimin köklerini eklemek zararsızdır, çünkü $F(\zeta)/F$ genişlemesinin Galois grubu değişmeli bir gruptur. Bu yüzden, $N$ her $m_i$ sayısına bölünecek şekilde, birimin ilkel bir $N$'inci kökü olan $\zeta$ kulenin en altına eklenebilir. O zaman $F_{i-1}$ cismini sabit bırakan her $F_i$ otomorfizması, $\alpha_i$ elemanını $x^{m_i} - \alpha_i^{m_i}$ polinomunun başka bir köküne, yani $\eta^{m_i} = 1$ olmak üzere $\eta\,\alpha_i$ biçiminde bir elemana götürmek zorundadır; otomorfizmaları bileştirmek de birimin bu köklerini çarpmaya karşılık gelir. Demek ki her radikal adım *devirli*, özel olarak da değişmeli bir genişlemedir.

### Galois grubu ve temel teorem

$K$, $f$ polinomunun $F$ üzerindeki ayrışım cismi, yani bütün kökleri tarafından üretilen cisim olsun. *Galois grubu* $\mathrm{Gal}(f) = \mathrm{Gal}(K/F)$, $K$ cisminin $F$ cismini noktasal olarak sabit bırakan otomorfizmalarından oluşur. Bu otomorfizmaların her biri $f$ polinomunun köklerini permüte eder ve bu permütasyonla tamamen belirlenir; bu yüzden $\mathrm{Gal}(f)$, $S_n$ grubunun bir altgrubudur: Kökler arasındaki her cebirsel bağıntıyı koruyan permütasyonlardan oluşur. Katsayıları birbirinden bağımsız değişkenler olan *genel* polinomda özel bir bağıntı yoktur ve Galois grubu $S_n$ grubunun tamamıdır.

Galois teorisinin temel teoremi, cisimlerle gruplar arasında bir sözlüktür. $F \subseteq E \subseteq K$ ara cisimleri, $G = \mathrm{Gal}(K/F)$ grubunun $H$ altgruplarıyla birebir eşlenir: Bir cisme, onu noktasal olarak sabit bırakan otomorfizmaların altgrubu; bir altgruba da sabit bıraktığı elemanların cismi karşılık gelir. Büyük cisimler küçük gruplarla eşleşir. Ayrıca $E/F$ genişlemesinin kendisi, tam olarak $H$ altgrubu $G$ içinde *normal altgrup* olduğunda bir Galois genişlemesidir ve bu durumda $\mathrm{Gal}(E/F) \cong G/H$ olur.

Şimdi bir radikaller kulesini bu sözlükle okuyalım. $F$ cisminden $K$ cismine radikal radikal tırmanmak, $G$ grubundan aşikâr gruba her adımda bir normal altgruba inerek ilerlemek demektir; üstelik her adımın bölüm grubu değişmeli bir gruptur. (Daha kesin söylemek gerekirse, kule $K$ cismini aşabilir; o zaman kulenin, yine radikallerle kurulmuş olan Galois kapanışına geçilir ve $\mathrm{Gal}(f)$ grubunun bu büyük grubun bir bölüm grubu olduğu kullanılır.)

## Çözülebilir gruplar ve teorem

Bu yapı, grup teorisinde çözülebilirlik denen özelliğin ta kendisidir. Sonlu bir $G$ grubunun

$$
G = G_0 \trianglerighteq G_1 \trianglerighteq \dots \trianglerighteq G_k = \{e\}
$$

biçiminde, her $G_{i+1}$ grubunun $G_i$ içinde normal olduğu (ama $G$ içinde normal olmak zorunda olmadığı) ve her $G_i/G_{i+1}$ bölüm grubunun değişmeli olduğu bir altnormal serisi varsa, $G$ grubuna *çözülebilir grup* denir. Sözlük radikal kulelerini bu tür serilere çevirir; bir fikir daha eklenince de serileri kulelere.

<div class="my-8 rounded-xl border border-zinc-200 bg-white px-5 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900">

**Teorem (Galois).** $F$ karakteristiği 0 olan bir cisim (örneğin $\mathbb{Q}$) ve $f \in F[x]$ olsun. $f(x) = 0$ denkleminin $F$ üzerinde radikallerle çözülebilir olması için gerek ve yeter koşul, $\mathrm{Gal}(f)$ grubunun çözülebilir olmasıdır.

</div>

Eksik fikir yine Lagrange'dan gelir. Ters yönde ilerlemek için seriyi, her bölüm asal $p$ mertebeli devirli bir grup olana kadar inceltir ve birimin gereken köklerini ekleriz. $\sigma$ böyle bir adımın Galois grubunu üretiyorsa, $\theta$ büyük cismin bir elemanıysa ve $\zeta$ birimin ilkel bir $p$'inci köküyse,

$$
\ell = \sum_{j=0}^{p-1} \zeta^{-j}\,\sigma^{j}(\theta)
$$

Lagrange çözücüsü $\sigma(\ell) = \zeta\ell$ eşitliğini sağlar; dolayısıyla $\ell^p$ küçük cisimdedir. $\theta$ uygun seçilirse $\ell \ne 0$ olur; o zaman büyük cisim, küçük cisme $\ell$ eklenerek elde edilir ve bu adım, $\ell^p$ elemanının $p$'inci kökünü almaktan ibarettir. Kübikteki $L$ tam olarak bu yapıdır.

Genel polinomun Galois grubu $S_n$ olduğundan, $n$'inci dereceden genel denklem ancak ve ancak $S_n$ çözülebilir bir grupsa radikallerle çözülebilir. Formüllerle ilgili bir soru, permütasyonlarla ilgili bir soruya dönüşmüştür.

### Merdiven olarak klasik formüller

$n = 3$ için merdivenin iki basamağı vardır:

$$
\begin{gathered}
S_3 \;\triangleright\; A_3 \;\triangleright\; \{e\}, \\
S_3/A_3 \cong C_2, \qquad A_3 \cong C_3 .
\end{gathered}
$$

Burada $A_n$ çift permütasyonlardan oluşan alterne grubu, $C_m$ ise $m$ mertebeli devirli grubu gösterir. $C_2$ basamağı, çift permütasyonları tek permütasyonlardan ayıran bir kareköktür. Cardano formülünde bu, $\sqrt{D}$ kareköküdür: Gerçekten de $\Delta = \prod_{i<j}(r_i - r_j)^2 = -4p^3 - 27q^2$ diskriminant olmak üzere $D = -\Delta/108$ olur ve $\sqrt{\Delta} = \prod_{i<j}(r_i - r_j)$ her transpozisyonda işaret değiştirir. $C_3$ basamağı ise küpköktür.

$n = 4$ için merdivenin dört basamağı vardır:

$$
S_4 \;\triangleright\; A_4 \;\triangleright\; V_4 \;\triangleright\; C_2 \;\triangleright\; \{e\}.
$$

Mertebeler sırasıyla $24, 12, 4, 2, 1$, bölüm grupları ise $C_2, C_3, C_2, C_2$ olur; burada $C_2 = \{e, (1\,2)(3\,4)\}$ alınmıştır. Bu $C_2$ altgrubu $V_4$ içinde normaldir ama $S_4$ içinde değildir. Bunda bir sakınca yoktur, çünkü altnormal seri her grubun yalnızca bir üstündeki grup içinde normal olmasını ister. Merdiven, Ferrari yönteminin ta kendisidir. İlk iki basamak, kökleri tam olarak $V_4$ tarafından sabit bırakılan çözücü kübiği bir karekök ve bir küpkökle çözer; son iki basamak da kareköklerdir: $s = \sqrt{2y - p}$ karekökü denklemi iki ikinci derece denkleme ayırır, ikinci derece kök formülü de işi bitirir.

## Beşte kırılan merdiven: 60 elemanlı basit bir grup

$n = 5$ için ilk basamak hâlâ yerindedir. $A_5$ alterne grubunun $S_5$ içindeki indeksi 2'dir; dolayısıyla normaldir ve $S_5/A_5 \cong C_2$ olur: Diskriminantın karekökü yine elimizdedir. Sorun bir sonraki basamaktadır: Merdiveni sürdürmek için $A_5$ grubunun ya değişmeli olması (ki değildir) ya da $\{e\} \ne N \ne A_5$ koşulunu sağlayan bir $N$ normal altgrubu içermesi gerekir.

Normal bir altgrup eşlenik sınıflarının birleşimidir; bu yüzden sınıfları bilmek işe yarar. $A_5$ grubunun 60 elemanı beş eşlenik sınıfına ayrılır:

| Devir tipi | Örnek | Sınıf büyüklüğü |
| --- | --- | ---: |
| özdeşlik | $e$ | 1 |
| 3-devirler | $(1\,2\,3)$ | 20 |
| iki ayrık transpozisyon | $(1\,2)(3\,4)$ | 15 |
| 5-devirler | $(1\,2\,3\,4\,5)$ | 12 |
| 5-devirler | $(1\,3\,5\,2\,4)$ | 12 |

$S_5$ grubundaki 24 tane 5-devir, $A_5$ içinde on ikişer elemanlı iki sınıfa ayrılır: Bir 5-devir ile karesi (tablodaki iki örnek gibi) birbirine ancak tek permütasyonlarla eşleniktir.

Şimdi $N$, $A_5$ grubunun bir normal altgrubu olsun. $N$ birim elemanı içerir, tam sınıfların birleşimidir ve Lagrange teoremine göre mertebesi 60'ı böler. Dolayısıyla $|N|$ sayısı, 1'in ve 12, 12, 15, 20 sayılarından bazılarının toplamıdır. Olası değerler

$$
\begin{gathered}
1, 13, 16, 21, 25, 28, \\
33, 36, 40, 45, 48, 60
\end{gathered}
$$

olup bunlardan 60'ı bölenler yalnızca 1 ve 60'tır. Demek ki $A_5$ grubunun $\{e\}$ ve kendisi dışında normal altgrubu yoktur; yani $A_5$ *basit* bir gruptur. Üstelik kesinlikle değişmeli değildir, çünkü değişmeli bir grupta her eşlenik sınıfı tek elemanlıdır.

Sonuç olarak $S_5$ için merdiven

$$
S_5 \;\triangleright\; A_5 \;\triangleright\; \{e\}
$$

serisinin ötesinde inceltilemez. Bu, $S_5$ grubunun tek bileşim serisidir (bölümleri basit gruplar olan altnormal seri) ve Jordan–Hölder teoremine göre bir grubun bütün bileşim serileri aynı bölüm gruplarına sahiptir. Çözülebilir bir grubun bileşim serisindeki bölümler asal mertebeli devirli gruplardır; oysa buradaki bölümlerden biri $A_5$ grubudur. O hâlde $S_5$ çözülebilir değildir. Aynı şekilde, her $n \ge 5$ için $A_n$ basit ve değişmeli olmayan bir grup olduğundan, $n \ge 5$ için hiçbir $S_n$ grubu çözülebilir değildir.

<div class="my-8 rounded-xl border border-zinc-200 bg-white px-5 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900">

**Teorem (Abel–Ruffini).** Her $n \ge 5$ için $n$'inci dereceden genel polinom denklemi radikallerle çözülemez.

</div>

<figure class="not-prose my-10">
<div class="relative overflow-hidden rounded-xl border border-zinc-200 bg-white px-3 py-6 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900">
<div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-graph mask-fade-b"></div>
<svg class="relative mx-auto block h-auto w-full max-w-xs text-zinc-900 dark:text-zinc-100" viewBox="48 0 288 316" role="img" aria-label="Ortak bir logaritmik ölçekte çizilmiş iki merdiven. 4. derece: S4, A4, V4, C2 ve aşikâr grup; bölüm grupları C2, C3, C2 ve C2, hepsi değişmeli. 5. derece: S5, A5 ve aşikâr grup; bölüm grupları C2 ve A5. Son ve uzun basamak olan A5 değişmeli değildir." xmlns="http://www.w3.org/2000/svg">
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
<figcaption class="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"><span class="label-mono mr-2 text-zinc-500 dark:text-zinc-400">Şekil 1</span>Merdiven olarak çizilmiş bileşim serileri. Her basamağın yanında bölüm grubu yazılıdır; her grup, mertebesinin logaritmasıyla orantılı bir yükseklikte durur, dolayısıyla bir basamağın uzunluğu bölüm grubunun mertebesini ölçer. <i>S</i><sub>4</sub> dört küçük değişmeli basamağa ayrılır; <i>S</i><sub>5</sub> grubunda ise kısa bir basamaktan sonra tek ve uzun bir basamak gelir: bölünemeyen basit grup <i>A</i><sub>5</sub>.</figcaption>
</figure>

## Radikallerle çözülemeyen bir beşinci derece denklem

Genel polinom, değişken katsayılı biçimsel bir nesnedir; ama teorem somut sayılar için de geçerlidir. Şu polinoma bakalım:

$$
f(x) = x^5 - 4x + 2 .
$$

1. **İndirgenemezdir.** $p = 2$ için Eisenstein ölçütü uygulanır: 2 sayısı baş katsayı dışındaki bütün katsayıları böler, $2^2 = 4$ ise sabit terimi bölmez. Dolayısıyla $f$ polinomu $\mathbb{Q}$ üzerinde indirgenemezdir ve beş kökü birbirinden farklıdır.
2. **Tam olarak üç gerçel kökü vardır.** $f(-2) = -22 < 0 < 2 = f(0)$ ve $f(1) = -1 < 0 < 26 = f(2)$ olduğundan $(-2, 0)$, $(0, 1)$ ve $(1, 2)$ aralıklarının her birinde işaret değişir; demek ki en az üç gerçel kök vardır. $f'(x) = 5x^4 - 4$ türevi yalnızca $x = \pm(4/5)^{1/4}$ noktalarında sıfır olduğundan, Rolle teoremine göre en fazla üç gerçel kök olabilir. Kalan iki kök birbirinin karmaşık eşleniğidir.
3. **Galois grubu bir transpozisyon içerir.** Karmaşık eşlenik alma işlemi $K \subset \mathbb{C}$ ayrışım cismini kendisine götürür ve $\mathbb{Q}$ cismini sabit bırakır; dolayısıyla $\mathrm{Gal}(f)$ grubunun bir elemanıdır. Bu eleman üç gerçel kökü sabit bırakır, diğer ikisinin yerini değiştirir.
4. **Bir 5-devir içerir.** İndirgenemezlik her $\alpha$ kökü için $[\mathbb{Q}(\alpha):\mathbb{Q}] = 5$ verir; dolayısıyla 5 sayısı $[K:\mathbb{Q}] = |\mathrm{Gal}(f)|$ mertebesini böler. Cauchy teoremine göre grupta 5 mertebeli bir eleman vardır; $S_5$ içinde 5 mertebeli elemanlar ise tam olarak 5-devirlerdir.
5. **Demek ki Galois grubu $S_5$'in tamamıdır.** Kökleri, transpozisyon $(1\,2)$ olacak şekilde numaralandıralım. 5-devrin bir kuvveti 1'i 2'ye götürür ve 5 asal olduğundan bu kuvvet yine bir 5-devirdir; diğer üç kökü yeniden numaralandırırsak bu devir $(1\,2\,3\,4\,5)$ olur. $(1\,2)$ transpozisyonunun bu devirle art arda eşleniği alınırsa $(2\,3)$, $(3\,4)$ ve $(4\,5)$ elde edilir; komşu transpozisyonlar da $S_5$ grubunu üretir.

Bu nedenle $\mathrm{Gal}(x^5 - 4x + 2) = S_5$ olur. Bu grup çözülebilir değildir; dolayısıyla beş kökten hiçbiri tam sayılar, dört işlem ve radikaller kullanılarak yazılamaz. (Tek bir kök yazılabilseydi, onun kulesinin Galois kapanışı beş kökün hepsini içerirdi.)

## Teoremin söylemedikleri

**Beşinci derece denklemlerin çözümü olmadığını söylemez.** Cebirin temel teoremine göre $x^5 - 4x + 2$ polinomunun beş karmaşık kökü vardır ve bunlar kolayca hesaplanır. $x_{k+1} = x_k - f(x_k)/f'(x_k)$ biçimindeki Newton yöntemi burada

$$
x_{k+1} = x_k - \frac{x_k^5 - 4x_k + 2}{5x_k^4 - 4}
$$

hâlini alır ve $x_0 = 0$ noktasından başlatıldığında sırasıyla $0{,}5$, $0{,}508474\ldots$, $0{,}508499484434\ldots$ ve $0{,}508499484657\ldots$ değerlerini verir: Doğru ondalık basamak sayısı her adımda kabaca ikiye katlanır. Diğer kökler yaklaşık olarak $-1{,}518512$, $1{,}243596$ ve $-0{,}116792 \pm 1{,}438448\,i$ sayılarıdır.

**Hiçbir beşinci derece denklemin radikallerle çözülemeyeceğini de söylemez.** Bazı özel denklemler çözülebilir. $\zeta = e^{2\pi i/5}$ olmak üzere $x^5 - 2$ polinomunun kökleri $k = 0, 1, \dots, 4$ için $\sqrt[5]{2}\,\zeta^k$ sayılarıdır ve $\zeta$ da radikallerle ifade edilebilir; bunu örneğin $\cos(2\pi/5) = (\sqrt{5} - 1)/4$ eşitliği gösterir. $x^5 - 2$ polinomunun Galois grubu 20 elemanlıdır ve çözülebilirdir: 5 mertebeli devirli bir normal altgrubu vardır ve bölüm grubu 4 mertebeli devirli gruptur. Teorem, *her* beşinci derece denklem için işleyen tek bir formülü dışlar; hangi denklemlerin çözülebilir olduğuna ise Galois ölçütü tek tek karar verir.

**Hiçbir kapalı biçim olmadığını da söylemez.** Dışlanan yalnızca radikallerdir. Radikallere tek bir yeni fonksiyon, *Bring radikali* eklenirse (gerçel $a$ için $x^5 + x + a = 0$ denkleminin tek gerçel kökü; $a$'nın fonksiyonu olarak düşünülür ve karmaşık $a$ değerlerine analitik devamla genişletilir) her beşinci derece denklem kapalı biçimde çözülebilir. Charles Hermite 1858'de beşinci derece denklemi, kübiğin trigonometrik fonksiyonlarla çözülebilmesine benzer biçimde, eliptik modüler fonksiyonlarla çözdü. Felix Klein da daha sonra bütün tabloyu, dönme grubu tam olarak $A_5$ olan düzgün yirmi yüzlünün (ikosahedron) simetrileriyle açıkladı.

## Sonuç: Simetri çözülebilirliği belirler

Radikallerle yazılmış bir formül, simetriyi söken bir makinedir. Her radikal, kökler arasındaki simetriyi değişmeli bir adımla biraz daha kırar ve bir formülün var olması, simetri grubunun bu şekilde parçalara ayrılabilmesine denktir. İkinci, üçüncü ve dördüncü derecede simetrik grup değişmeli parçalara ayrılır: $C_2$; sonra $C_2, C_3$; sonra $C_2, C_3, C_2, C_2$. Beşinci dereceden itibaren ise genel denklem, hiçbir radikalin bölemeyeceği basit ve değişmeli olmayan bir çekirdek taşır: $A_n$. Genel beşinci derece denklem, çözülemeyecek kadar karmaşık değildir; simetrisi, radikallerin sökemeyeceği türdendir.

## Okuma önerileri

- David S. Dummit ve Richard M. Foote, <cite lang="en">Abstract Algebra</cite>, 3. baskı (Wiley, 2004), 14. bölüm; 14.7. kısım çözülebilir ve radikal genişlemeleri ele alır ve beşinci derece denklemin çözülemezliğini kanıtlar.
- Ian Stewart, <cite lang="en">Galois Theory</cite> (CRC Press): Teoriyi tarihiyle birlikte geliştirir.
- V. B. Alekseev, <cite lang="en">Abel's Theorem in Problems and Solutions</cite> (V. I. Arnold'un derslerine dayanır): teoreme gruplar, karmaşık fonksiyonlar ve Riemann yüzeyleri üzerinden, problemlerle ilerleyen bir yol.
- Niels Henrik Abel, <cite lang="fr">Mémoire sur les équations algébriques où on démontre l'impossibilité de la résolution de l'équation générale du cinquième degré</cite> (Christiania, 1824): özgün kanıt; kısalığıyla ünlü bir risale.
