/**
 * Interface text of the weight-loss calculator (page, component and browser controller). Rich
 * prose with inline markup (the "How it is calculated" section and the tips) is written per
 * locale in the page itself.
 *
 * The library (src/lib/health/weight-plan.ts) returns numbers and codes; this catalogue gives
 * them words and src/scripts/tools/weight-loss/present.ts combines them with formatters(locale).
 * Interpolated values arrive formatted ("2,390 kcal" / "2.390 kcal", "80.0 kg" / "80,0 kg").
 * Turkish sentences are built so that a value needs no case suffix, or takes one that fits
 * every value it can hold (kcal is read "kilokalori": "kcal’den").
 */
import type { Localized } from '../config.ts';
import type {
  ActivityLevel,
  BmiCategory,
  BmrFormula,
  FieldError,
  FieldName,
  Granularity,
  PlanMode,
  Sex,
} from '../../lib/health/weight-plan.ts';

interface Choice {
  label: string;
  /** One plain line under the menu: what the choice means. */
  detail: string;
}

type FieldMessages = Partial<Record<FieldError, string>>;

const en = {
  meta: {
    title: 'Weight-loss calculator',
    description:
      'Estimate your BMR and maintenance calories, set a daily intake or deficit and a target weight, and see the day you reach it, as a chart and a day-by-day table. Runs in your browser.',
  },
  header: {
    eyebrow: 'Browser tool',
    lead: 'Enter your details and a target weight. The calculator estimates how many calories you burn, follows your weight day by day as your needs fall, and shows the date you reach the target as a chart and a table.',
  },
  toolLabel: 'Weight-loss calculator',
  noscript: 'This calculator needs JavaScript to work out a plan.',
  form: {
    heading: 'Your details',
    sex: 'Sex',
    sexes: { female: 'Female', male: 'Male' } satisfies Record<Sex, string>,
    age: 'Age',
    ageUnit: 'years',
    height: 'Height',
    weight: 'Current weight',
    target: 'Target weight',
    activity: 'Activity level',
    activities: {
      sedentary: { label: 'Sedentary', detail: 'Desk job, little or no exercise.' },
      light: { label: 'Lightly active', detail: 'Light exercise or sport 1–3 days a week.' },
      moderate: { label: 'Moderately active', detail: 'Moderate exercise or sport 3–5 days a week.' },
      very: { label: 'Very active', detail: 'Hard exercise or sport 6–7 days a week.' },
      extra: { label: 'Extra active', detail: 'A physical job and hard training, or training twice a day.' },
    } satisfies Record<ActivityLevel, Choice>,
    formula: 'BMR formula',
    formulas: {
      mifflin: { label: 'Mifflin–St Jeor', detail: 'The most widely used equation today (1990).' },
      harris: { label: 'Harris–Benedict (revised)', detail: 'The 1919 equation as revised by Roza and Shizgal in 1984.' },
      katch: {
        label: 'Katch–McArdle',
        detail: 'Uses your lean body mass, so it needs your body-fat percentage.',
      },
    } satisfies Record<BmrFormula, Choice>,
    /** Shown in the Katch–McArdle option while it is unavailable. */
    needsBodyFat: 'enter body fat first',
    bodyFat: 'Body fat',
    optional: 'optional',
    bodyFatHint: 'Only needed for Katch–McArdle.',
    planBy: 'Plan by',
    modes: { intake: 'Calories I eat', deficit: 'Daily deficit' } satisfies Record<PlanMode, string>,
    intake: 'Calories eaten per day',
    deficit: 'Daily deficit',
    perDay: 'kcal a day',
    /** Under the intake field: maintenance now and the deficit it makes. */
    intakeHint: (maintenance: string, deficit: string) =>
      `Your maintenance is ${maintenance} now, so this is a deficit of ${deficit} a day.`,
    intakeAtMaintenance: (maintenance: string) =>
      `Your maintenance is ${maintenance} now, so this intake would not lose weight.`,
    intakeAuto: 'Filled in as maintenance minus 500 kcal, until you change it.',
    deficitHint: (intake: string) => `You would eat ${intake} a day at first, and less as your weight falls.`,
    start: 'Start date',
    reset: 'Reset',
  },
  errors: {
    number: 'Enter a number, like 72.5.',
    fields: {
      age: { empty: 'Enter your age.', range: 'Age must be between 15 and 100.' },
      height: { empty: 'Enter your height.', range: 'Height must be between 120 and 230 cm.' },
      weight: { empty: 'Enter your current weight.', range: 'Weight must be between 30 and 300 kg.' },
      target: {
        empty: 'Enter a target weight.',
        range: 'The target must be between 30 and 300 kg.',
        notBelow: 'This calculator plans weight loss, so the target needs to be below your current weight.',
      },
      bodyFat: {
        empty: 'Enter your body-fat percentage for Katch–McArdle.',
        range: 'Body fat must be between 3% and 70%.',
      },
      intake: { empty: 'Enter how many calories you eat a day.', range: 'Enter between 500 and 6,000 kcal.' },
      deficit: {
        empty: 'Enter a daily deficit.',
        range: 'Enter a deficit between 50 and 2,500 kcal.',
        aboveMaintenance: 'This deficit is larger than your maintenance at the target weight. Choose a smaller one.',
      },
      start: {
        empty: 'Choose a start date.',
        number: 'This is not a valid date.',
        range: 'Choose a date between 2000 and 2100.',
      },
    } satisfies Record<FieldName, FieldMessages>,
  },
  result: {
    heading: 'Your plan',
    targetDate: 'Target date',
    /** "182 days · 26 weeks · about 6 months" */
    days: (count: number, formatted: string) => `${formatted} ${count === 1 ? 'day' : 'days'}`,
    weeks: (formatted: string) => `${formatted} weeks`,
    months: (formatted: string) => `about ${formatted} months`,
    years: (formatted: string) => `about ${formatted} years`,
    outcomes: {
      equilibrium: 'Not reached at this intake',
      tooSlow: 'More than five years',
      noDeficit: 'No weight lost',
    },
    equilibrium: (intake: string, level: string, target: string, needed: string) =>
      `Eating ${intake} a day, your weight levels off near ${level}, above your target of ${target}: as you lose weight, your maintenance falls until it equals what you eat. To reach the target, eat less than ${needed} a day (your maintenance at the target weight) or move more.`,
    tooSlow: (target: string, duration: string, date: string) =>
      `At this pace you would reach ${target} after ${duration}, on ${date}. The chart and the table show the first five years.`,
    noDeficit: (intake: string, maintenance: string) =>
      `Eating ${intake} a day is at or above your maintenance of ${maintenance}, so this plan does not lose weight.`,
    invalid: 'Correct the marked values to update the plan.',
    bmr: 'BMR',
    bmrNote: (formula: string) => `at rest · ${formula}`,
    maintenance: 'Maintenance (TDEE)',
    maintenanceNote: (factor: string) => `BMR × ${factor}`,
    deficit: 'Deficit on day 1',
    deficitNote: (intake: string) => `eating ${intake}`,
    firstWeek: 'First week',
    firstWeekNote: (percent: string) => `${percent} of your weight`,
    bmi: 'BMI',
    linear: 'Linear estimate',
    linearNote: 'if the first day’s deficit never shrank',
    endIntake: 'Eaten on the last day',
    endIntakeNote: 'maintenance minus the deficit',
    bmiCategories: {
      underweight: 'Underweight',
      normal: 'Normal weight',
      overweight: 'Overweight',
      obese1: 'Obesity class I',
      obese2: 'Obesity class II',
      obese3: 'Obesity class III',
    } satisfies Record<BmiCategory, string>,
    none: '—',
    warningsLabel: 'Things to keep in mind',
    warnings: {
      belowBmr:
        'You would eat less than your BMR, the energy your body uses at rest. Many people find that hard to keep up; a smaller deficit over a longer time is often easier.',
      lowIntake: (threshold: string) =>
        `Eating less than about ${threshold} a day is usually advised only with a doctor’s supervision.`,
      fastLoss: (percent: string) =>
        `This plan loses about ${percent} of your body weight a week at the start. The pace usually recommended is around 0.5–1% a week.`,
      lowTargetBmi: (value: string) => `At the target weight your BMI would be ${value}, which the WHO counts as underweight.`,
    },
    disclaimer:
      'An estimate, not medical advice. Real weight moves up and down with water and glycogen from day to day, and 7,700 kcal per kilogram is an approximation: static rules like it overestimate long-term loss (Hall et al., 2011). Recomputing BMR as your weight falls captures part of that, but not the further drop in energy use the body makes while dieting. Age, height and activity stay as entered.',
  },
  chart: {
    label: 'Fig. 1',
    title: 'Weight over time',
    weight: 'Projected weight',
    target: 'Target',
    linear: 'Linear estimate',
    level: 'Levels off',
    /** On the dashed target line. */
    targetLine: (kg: string) => `Target ${kg}`,
    /** On the dotted line where the curve levels off. */
    levelLine: (kg: string) => `Levels off near ${kg}`,
    readoutIdle: 'Point at the chart or touch it to read a day. The table below has every value.',
    readout: (date: string, day: string, weight: string) => `${date} · day ${day} · ${weight}`,
    aria: {
      reached: (start: string, target: string, date: string, days: string) =>
        `Line chart of projected weight from ${start} to ${target}, reached on ${date}, after ${days}.`,
      /** Added for a fixed intake, whose curve is not a straight line. */
      flattens: 'The curve flattens slightly as maintenance falls.',
      flat: (start: string, level: string, target: string) =>
        `Line chart of projected weight from ${start}, leveling off near ${level}, above the target of ${target}.`,
      long: (start: string, end: string, target: string) =>
        `Line chart of projected weight from ${start} to ${end} after five years, still above the target of ${target}.`,
    },
  },
  table: {
    heading: 'Plan table',
    show: 'Show',
    granularity: { weekly: 'Weekly', monthly: 'Monthly', daily: 'Daily' } satisfies Record<Granularity, string>,
    columns: {
      date: 'Date',
      day: 'Day',
      weight: 'Weight',
      lost: 'Lost',
      bmr: 'BMR',
      maintenance: 'Maintenance',
      intake: 'Eaten',
      deficit: 'Deficit',
      bmi: 'BMI',
    },
    caption: (rows: string) => `The plan, ${rows} rows. Weights in kg, energy in kcal a day.`,
    /** Screen-reader text in the highlighted last row. */
    targetRow: 'target reached',
    download: 'Download CSV',
    downloadHint: 'Every day of the plan, for Excel or any spreadsheet.',
    fileName: 'weight-plan.csv',
    csv: {
      date: 'Date',
      day: 'Day',
      weight: 'Weight (kg)',
      lost: 'Total lost (kg)',
      bmr: 'BMR (kcal)',
      maintenance: 'Maintenance (kcal)',
      intake: 'Eaten (kcal)',
      deficit: 'Deficit (kcal)',
      bmi: 'BMI',
    },
  },
  announce: {
    reached: (date: string, days: string) => `Target reached on ${date}, after ${days}.`,
    reset: 'The form is back to the defaults.',
  },
  privacy: {
    label: 'Privacy',
    title: 'Nothing leaves your device.',
    body: 'The plan is calculated in your browser, and nothing you enter is sent anywhere. Your values are kept only in this browser, so they are still here when you come back. Reset clears them.',
  },
  formulaTitle: 'How it is calculated',
  tips: 'Tips',
};

export type WeightLossMessages = typeof en;

const tr: WeightLossMessages = {
  meta: {
    title: 'Kilo verme hesaplayıcı',
    description:
      'Bazal metabolizma hızınızı (BMR) ve günlük kalori ihtiyacınızı hesaplayın. Günde ne kadar yiyeceğinizi ya da ne kadar açık vereceğinizi ve hedef kilonuzu girin; hedefe hangi gün ulaşacağınızı grafik ve tabloyla görün. Araç tarayıcınızda çalışır.',
  },
  header: {
    eyebrow: 'Tarayıcı aracı',
    lead: 'Bilgilerinizi ve hedef kilonuzu girin. Hesaplayıcı günde kaç kalori harcadığınızı tahmin eder, kilo verdikçe azalan ihtiyacınızı hesaba katarak kilonuzu gün gün izler ve hedefe ulaşacağınız tarihi grafik ve tabloyla gösterir.',
  },
  toolLabel: 'Kilo verme hesaplayıcı',
  noscript: 'Bu hesaplayıcının plan çıkarabilmesi için JavaScript gerekir.',
  form: {
    heading: 'Bilgileriniz',
    sex: 'Cinsiyet',
    sexes: { female: 'Kadın', male: 'Erkek' },
    age: 'Yaş',
    ageUnit: 'yıl',
    height: 'Boy',
    weight: 'Şu anki kilo',
    target: 'Hedef kilo',
    activity: 'Hareket düzeyi',
    activities: {
      sedentary: { label: 'Hareketsiz', detail: 'Masa başı iş, az ya da hiç egzersiz yok.' },
      light: { label: 'Az hareketli', detail: 'Haftada 1–3 gün hafif egzersiz ya da spor.' },
      moderate: { label: 'Orta derecede hareketli', detail: 'Haftada 3–5 gün orta düzeyde egzersiz ya da spor.' },
      very: { label: 'Çok hareketli', detail: 'Haftada 6–7 gün yoğun egzersiz ya da spor.' },
      extra: {
        label: 'Son derece hareketli',
        detail: 'Bedenen ağır bir iş ve yoğun antrenman ya da günde iki antrenman.',
      },
    },
    formula: 'BMR formülü',
    formulas: {
      mifflin: { label: 'Mifflin–St Jeor', detail: 'Bugün en yaygın kullanılan denklem (1990).' },
      harris: {
        label: 'Harris–Benedict (revize)',
        detail: '1919 tarihli denklemin Roza ve Shizgal tarafından 1984’te güncellenmiş hâli.',
      },
      katch: {
        label: 'Katch–McArdle',
        detail: 'Yağsız vücut kütlenizi kullanır; bu yüzden vücut yağ oranınızı girmeniz gerekir.',
      },
    },
    needsBodyFat: 'önce vücut yağ oranını girin',
    bodyFat: 'Vücut yağ oranı',
    optional: 'isteğe bağlı',
    bodyFatHint: 'Yalnızca Katch–McArdle için gerekir.',
    planBy: 'Plan neye göre yapılsın?',
    modes: { intake: 'Yediğim kalori', deficit: 'Günlük açık' },
    intake: 'Günde yediğiniz kalori',
    deficit: 'Günlük kalori açığı',
    perDay: 'kcal/gün',
    intakeHint: (maintenance, deficit) =>
      `Şu anki günlük kalori ihtiyacınız ${maintenance}. Bu durumda günde ${deficit} açık vermiş olursunuz.`,
    intakeAtMaintenance: (maintenance) =>
      `Şu anki günlük kalori ihtiyacınız ${maintenance}. Bu kadar yerseniz kilo vermezsiniz.`,
    intakeAuto: 'Siz değiştirene kadar bu alana kalori ihtiyacınızın 500 kcal eksiği yazılır.',
    deficitHint: (intake) => `Başlangıçta günde ${intake} yersiniz; kilo verdikçe bu miktar azalır.`,
    start: 'Başlangıç tarihi',
    reset: 'Sıfırla',
  },
  errors: {
    number: 'Bir sayı girin, örneğin 72,5.',
    fields: {
      age: { empty: 'Yaşınızı girin.', range: 'Yaş 15 ile 100 arasında olmalıdır.' },
      height: { empty: 'Boyunuzu girin.', range: 'Boy 120 ile 230 cm arasında olmalıdır.' },
      weight: { empty: 'Şu anki kilonuzu girin.', range: 'Kilo 30 ile 300 kg arasında olmalıdır.' },
      target: {
        empty: 'Hedef kilonuzu girin.',
        range: 'Hedef 30 ile 300 kg arasında olmalıdır.',
        notBelow: 'Bu hesaplayıcı kilo vermek için plan yapar; hedefiniz şu anki kilonuzdan düşük olmalı.',
      },
      bodyFat: {
        empty: 'Katch–McArdle için vücut yağ oranınızı girin.',
        range: 'Vücut yağ oranı %3 ile %70 arasında olmalıdır.',
      },
      intake: { empty: 'Günde kaç kalori yediğinizi girin.', range: '500 ile 6.000 kcal arasında bir değer girin.' },
      deficit: {
        empty: 'Günlük açığı girin.',
        range: '50 ile 2.500 kcal arasında bir açık girin.',
        aboveMaintenance: 'Bu açık, hedef kilonuzdaki kalori ihtiyacınızdan büyük. Daha küçük bir açık seçin.',
      },
      start: {
        empty: 'Bir başlangıç tarihi seçin.',
        number: 'Bu geçerli bir tarih değil.',
        range: '2000 ile 2100 arasında bir tarih seçin.',
      },
    },
  },
  result: {
    heading: 'Planınız',
    targetDate: 'Hedef tarih',
    days: (_count, formatted) => `${formatted} gün`,
    weeks: (formatted) => `${formatted} hafta`,
    months: (formatted) => `yaklaşık ${formatted} ay`,
    years: (formatted) => `yaklaşık ${formatted} yıl`,
    outcomes: {
      equilibrium: 'Bu kaloriyle hedefe ulaşılmıyor',
      tooSlow: 'Beş yıldan uzun',
      noDeficit: 'Kilo kaybı yok',
    },
    equilibrium: (intake, level, target, needed) =>
      `Günde ${intake} yerseniz kilonuz ${level} civarında sabitlenir; bu, ${target} olan hedefinizin üstünde. Kilo verdikçe kalori ihtiyacınız da azalır ve sonunda yediğiniz miktara eşitlenir. Hedefe ulaşmak için günde ${needed} altında yemeniz (hedef kilonuzdaki kalori ihtiyacı) ya da daha çok hareket etmeniz gerekir.`,
    tooSlow: (target, duration, date) =>
      `Bu hızla ${target} hedefine ${duration} sonra, ${date} tarihinde ulaşırsınız. Grafik ve tablo ilk beş yılı gösterir.`,
    noDeficit: (intake, maintenance) =>
      `Günde ${intake} yemek, ${maintenance} olan kalori ihtiyacınıza eşit ya da ondan fazla; bu planla kilo vermezsiniz.`,
    invalid: 'Planı güncellemek için işaretli değerleri düzeltin.',
    bmr: 'BMR',
    bmrNote: (formula) => `dinlenirken · ${formula}`,
    maintenance: 'Kalori ihtiyacı (TDEE)',
    maintenanceNote: (factor) => `BMR × ${factor}`,
    deficit: 'İlk günkü açık',
    deficitNote: (intake) => `${intake} yiyerek`,
    firstWeek: 'İlk hafta',
    firstWeekNote: (percent) => `kilonuzun ${percent} kadarı`,
    bmi: 'VKİ',
    linear: 'Doğrusal tahmin',
    linearNote: 'ilk günkü açık hiç azalmasaydı',
    endIntake: 'Son gün yenen',
    endIntakeNote: 'kalori ihtiyacı eksi açık',
    bmiCategories: {
      underweight: 'Zayıf',
      normal: 'Normal kilolu',
      overweight: 'Fazla kilolu',
      obese1: '1. derece obez',
      obese2: '2. derece obez',
      obese3: '3. derece obez',
    },
    none: '—',
    warningsLabel: 'Göz önünde bulundurun',
    warnings: {
      belowBmr:
        'Vücudunuzun dinlenirken harcadığı enerjiden (BMR) daha az yemiş olursunuz. Bunu sürdürmek çoğu kişi için zordur; daha küçük bir açıkla daha uzun süre gitmek genellikle daha kolaydır.',
      lowIntake: (threshold) =>
        `Günde yaklaşık ${threshold} altında yemek genellikle yalnızca doktor gözetiminde önerilir.`,
      fastLoss: (percent) =>
        `Bu planla başlangıçta haftada vücut ağırlığınızın yaklaşık ${percent} kadarını kaybedersiniz. Genellikle önerilen hız haftada %0,5 ile %1 arasıdır.`,
      lowTargetBmi: (value) =>
        `Hedef kilonuzda vücut kitle indeksiniz ${value} olur. Dünya Sağlık Örgütü bu değeri zayıf olarak sınıflandırır.`,
    },
    disclaimer:
      'Bu bir tahmindir, tıbbi tavsiye değildir. Gerçek kilo, su ve glikojen yüzünden günden güne iner çıkar. Kilogram başına 7.700 kcal kuralı da yaklaşık bir değerdir: Bu tür sabit kurallar uzun vadede verilecek kiloyu olduğundan fazla gösterir (Hall ve ark., 2011). BMR’nin kilo düştükçe yeniden hesaplanması bu farkın bir kısmını karşılar; ama vücudun diyet sırasında enerji harcamasını ayrıca azaltmasını hesaba katmaz. Yaş, boy ve hareket düzeyi girdiğiniz gibi kalır.',
  },
  chart: {
    label: 'Şekil 1',
    title: 'Zaman içinde kilo',
    weight: 'Tahmini kilo',
    target: 'Hedef',
    linear: 'Doğrusal tahmin',
    level: 'Sabitlendiği kilo',
    targetLine: (kg) => `Hedef ${kg}`,
    levelLine: (kg) => `${kg} civarında sabitlenir`,
    readoutIdle: 'Bir günün değerlerini görmek için imleçle grafiğin üzerine gelin ya da grafiğe dokunun. Tüm değerler aşağıdaki tabloda.',
    readout: (date, day, weight) => `${date} · ${day}. gün · ${weight}`,
    aria: {
      reached: (start, target, date, days) =>
        `Tahmini kilonun çizgi grafiği: ${start} ile başlıyor, ${days} sonra, ${date} tarihinde ${target} hedefine ulaşıyor.`,
      flattens: 'Kalori ihtiyacı azaldıkça eğri biraz yatıklaşıyor.',
      flat: (start, level, target) =>
        `Tahmini kilonun çizgi grafiği: ${start} ile başlıyor ve ${level} civarında sabitleniyor; bu, ${target} olan hedefin üstünde.`,
      long: (start, end, target) =>
        `Tahmini kilonun çizgi grafiği: ${start} ile başlıyor, beş yıl sonra ${end} oluyor ve hâlâ ${target} olan hedefin üstünde kalıyor.`,
    },
  },
  table: {
    heading: 'Plan tablosu',
    show: 'Göster',
    granularity: { weekly: 'Haftalık', monthly: 'Aylık', daily: 'Günlük' },
    columns: {
      date: 'Tarih',
      day: 'Gün',
      weight: 'Kilo',
      lost: 'Verilen',
      bmr: 'BMR',
      maintenance: 'İhtiyaç',
      intake: 'Yenen',
      deficit: 'Açık',
      bmi: 'VKİ',
    },
    caption: (rows) => `Plan tablosu, ${rows} satır. Kilolar kg, enerji değerleri günlük kcal cinsindendir.`,
    targetRow: 'hedefe ulaşıldı',
    download: 'CSV indir',
    downloadHint: 'Planın her günü; Excel’de ya da herhangi bir tablo programında açabilirsiniz.',
    fileName: 'kilo-plani.csv',
    csv: {
      date: 'Tarih',
      day: 'Gün',
      weight: 'Kilo (kg)',
      lost: 'Toplam verilen (kg)',
      bmr: 'BMR (kcal)',
      maintenance: 'Kalori ihtiyacı (kcal)',
      intake: 'Yenen (kcal)',
      deficit: 'Açık (kcal)',
      bmi: 'VKİ',
    },
  },
  announce: {
    reached: (date, days) => `Hedefe ${days} sonra, ${date} tarihinde ulaşılıyor.`,
    reset: 'Form varsayılan değerlere döndü.',
  },
  privacy: {
    label: 'Gizlilik',
    title: 'Hiçbir şey cihazınızdan çıkmaz.',
    body: 'Plan tarayıcınızda hesaplanır; girdiğiniz hiçbir değer bir yere gönderilmez. Değerleriniz yalnızca bu tarayıcıda saklanır, böylece sayfaya geri döndüğünüzde de yerinde olur. Sıfırla düğmesi onları siler.',
  },
  formulaTitle: 'Nasıl hesaplanır?',
  tips: 'İpuçları',
};

export const weightLossMessages = { en, tr } as const satisfies Localized<WeightLossMessages>;
