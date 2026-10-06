// Glossary texts shown as tooltips next to labels (GlossaryTip).

export const glossaryEntries = [
  {
    en: ["Dashboard", "Overview"],
    tr: ["Dashboard", "Genel Bakış"],
    infoEn: "The main workspace where readiness, risks, and module status are summarized.",
    infoTr: "Hazırlık, risk ve modül durumlarının özetlendiği ana çalışma alanı.",
  },
  {
    en: ["Product", "Product record", "Product definition", "Product to produce", "Product Name", "Product Code", "Product Group"],
    tr: ["Ürün", "Ürün kaydı", "Ürün tanımı", "Üretilecek ürün", "Ürün Adı", "Ürün Kodu", "Ürün Grubu"],
    infoEn: "The sellable item whose recipe, price, process, and demand drive feasibility.",
    infoTr: "Reçete, fiyat, süreç ve talep bilgileriyle fizibiliteyi belirleyen satılabilir kalem.",
  },
  {
    en: ["Recipe", "No recipe", "Recipe qty", "Materials & Components"],
    tr: ["Reçete", "Reçete yok", "Reçete miktarı", "Malzeme & Bileşenler"],
    infoEn: "The materials and quantities needed to make one unit of the product.",
    infoTr: "Ürünün bir birimini üretmek için gereken malzeme ve miktarlar.",
  },
  {
    en: ["Material", "Material Cost", "Material cost"],
    tr: ["Malzeme", "Malzeme Maliyeti", "Malzeme maliyeti"],
    infoEn: "An input consumed during production and included in unit or total cost.",
    infoTr: "Üretimde tüketilen ve birim ya da toplam maliyete giren girdi.",
  },
  {
    en: ["Machine", "Machine Pool", "Machine hours", "Machine Hours", "Machine Value", "Selected Machine Value"],
    tr: ["Makine", "Makine Havuzu", "Makine saati", "Makine Saati", "Makine Değeri", "Seçili Makine Değeri"],
    infoEn: "Production equipment used to calculate capacity, time, energy, and asset value.",
    infoTr: "Kapasite, süre, enerji ve varlık değerini hesaplamakta kullanılan üretim ekipmanı.",
  },
  {
    en: ["Equipment"],
    tr: ["Ekipman"],
    infoEn: "Supporting production asset or tool used by a process step.",
    infoTr: "Bir süreç adımında kullanılan destekleyici üretim varlığı veya araç.",
  },
  {
    en: ["Workforce", "Crew role", "People", "Crew hours", "Workforce Hours", "Workforce Cost"],
    tr: ["İşgücü", "Ekip rolü", "Kişi", "Ekip saati", "İşgücü Saati", "İşgücü Maliyeti"],
    infoEn: "Human labor capacity and cost assigned to production activities.",
    infoTr: "Üretim faaliyetlerine atanan insan emeği kapasitesi ve maliyeti.",
  },
  {
    en: ["Process", "Process name", "Process Definition", "Required processes", "Operation", "Operation Flow"],
    tr: ["Süreç", "Süreç adı", "Süreç Tanımlama", "Gerekli süreçler", "Operasyon", "Operasyon Akışı"],
    infoEn: "A production step or workflow used to turn inputs into finished output.",
    infoTr: "Girdileri bitmiş çıktıya dönüştüren üretim adımı veya iş akışı.",
  },
  {
    en: ["Capacity", "Production capacity", "Capacity gap", "Monthly capacity"],
    tr: ["Kapasite", "Üretim kapasitesi", "Kapasite açığı", "Aylık kapasite"],
    infoEn: "The amount that can be produced with available time, machines, and labor.",
    infoTr: "Mevcut zaman, makine ve işgücüyle üretilebilecek miktar.",
  },
  {
    en: ["Cycle", "Cycle Time", "Effective Cycle"],
    tr: ["Çevrim", "Çevrim Süresi", "Efektif çevrim"],
    infoEn: "Elapsed production time per unit or per completed flow after constraints are included.",
    infoTr: "Kısıtlar dahil edildiğinde birim veya tamamlanan akış başına geçen üretim süresi.",
  },
  {
    en: ["Bottleneck"],
    tr: ["Darboğaz"],
    infoEn: "The limiting operation that constrains output and is usually the first improvement target.",
    infoTr: "Çıktıyı sınırlayan ve genellikle ilk iyileştirme hedefi olan operasyon.",
  },
  {
    en: ["WIP", "Max WIP"],
    tr: ["WIP", "Maks WIP"],
    infoEn: "Work in progress: unfinished units waiting or moving between operations.",
    infoTr: "Yarı mamul: operasyonlar arasında bekleyen veya ilerleyen tamamlanmamış ürünler.",
  },
  {
    en: ["Setup", "Setup min"],
    tr: ["Setup", "Setup dk"],
    infoEn: "Preparation time before production can run at normal speed.",
    infoTr: "Üretimin normal hızda başlamasından önceki hazırlık süresi.",
  },
  {
    en: ["Speed"],
    tr: ["Hız"],
    infoEn: "The rate or multiplier that affects how quickly a process step is completed.",
    infoTr: "Bir süreç adımının ne kadar hızlı tamamlandığını etkileyen oran veya çarpan.",
  },
  {
    en: ["Batch", "Transfer Batch", "Best batch size"],
    tr: ["Toplu", "Transfer batch", "En iyi batch"],
    infoEn: "A group of units processed or transferred together during production.",
    infoTr: "Üretimde birlikte işlenen veya aktarılan ürün grubu.",
  },
  {
    en: ["Pull", "Pull system", "Kanban"],
    tr: ["Çekme", "Çekme sistemi", "Kanban"],
    infoEn: "Demand-driven production where downstream need triggers replenishment and safety stock prevents material starvation.",
    infoTr: "Sonraki proses ihtiyacının ikmali tetiklediği ve güvenli stokun malzeme beklemesini önlediği talep odaklı üretim.",
  },
  {
    en: ["Push", "Push system", "MRP"],
    tr: ["İtme", "İtme sistemi", "MRP"],
    infoEn: "Plan- or forecast-driven production sent to the next station without safety stock.",
    infoTr: "Güvenli stok kullanılmadan, plan veya tahmine göre üretilip sonraki istasyona gönderilen üretim.",
  },
  {
    en: ["Safety stock", "Minimum safety stock"],
    tr: ["Güvenli stok", "Minimum güvenli stok"],
    infoEn: "Intermediate stock reserved in Pull mode so downstream production does not stop while waiting for replenishment.",
    infoTr: "Çekme modunda sonraki prosesin ikmal beklerken durmaması için ayrılan ara stok.",
  },
  {
    en: ["Cost", "Daily Cost", "Monthly cost", "Estimated Cost", "Tracked Daily Cost", "Unit production cost"],
    tr: ["Maliyet", "Günlük Maliyet", "Aylık maliyet", "Tahmini Maliyet", "Takip Edilen Günlük Maliyet", "Birim üretim maliyeti"],
    infoEn: "Money spent to produce, operate, finance, or deliver the planned activity.",
    infoTr: "Planlanan faaliyeti üretmek, işletmek, finanse etmek veya teslim etmek için harcanan para.",
  },
  {
    en: ["Revenue", "Monthly revenue", "Estimated Revenue", "Income"],
    tr: ["Ciro", "Aylık ciro", "Tahmini Ciro", "Gelir"],
    infoEn: "Sales income generated from product demand and selling price.",
    infoTr: "Ürün talebi ve satış fiyatından oluşan satış geliri.",
  },
  {
    en: ["Margin", "Net margin", "Unit margin", "Profit Margin", "Net Profit Margin"],
    tr: ["Marj", "Net marj", "Birim marj", "Kâr Marjı", "Net Kâr Marjı"],
    infoEn: "The share of revenue left after related costs are deducted.",
    infoTr: "İlgili maliyetler düşüldükten sonra cirodan kalan pay.",
  },
  {
    en: ["Break-even", "Break-even point", "Break-even month"],
    tr: ["Başa baş", "Başa baş noktası", "Başa baş ayı"],
    infoEn: "The point where accumulated income covers accumulated costs.",
    infoTr: "Birikmiş gelirin birikmiş maliyeti karşıladığı nokta.",
  },
  {
    en: ["Working capital"],
    tr: ["İşletme sermayesi"],
    infoEn: "Cash needed to carry operations before customer collections arrive.",
    infoTr: "Müşteri tahsilatları gelmeden operasyonu taşımak için gereken nakit.",
  },
  {
    en: ["Cash runway"],
    tr: ["Nakit dayanma", "Kısa nakit dayanma"],
    infoEn: "How long available cash can support the plan before it runs out.",
    infoTr: "Mevcut nakdin planı tükenmeden ne kadar süre taşıyabileceği.",
  },
  {
    en: ["Net present value", "NPV"],
    tr: ["Net bugünkü değer", "NBD"],
    infoEn: "Today's value of the project's future cash flows, discounted at the discount rate, minus the investment. Positive means the project earns more than that rate.",
    infoTr: "Projenin gelecekteki nakit akışlarının iskonto oranıyla bugüne indirgenmiş değerinden yatırımın düşülmüş hali. Pozitifse proje bu orandan fazla kazandırır.",
  },
  {
    en: ["Internal rate of return", "IRR"],
    tr: ["İç verim oranı"],
    infoEn: "The yearly return at which net present value is zero. Compare it with the discount rate.",
    infoTr: "Net bugünkü değeri sıfır yapan yıllık getiri. İskonto oranıyla karşılaştırın.",
  },
  {
    en: ["Payback", "Payback month"],
    tr: ["Geri dönüş süresi", "Geri dönüş", "Geri dönüş ayı"],
    infoEn: "The month in which cumulative cash from operations covers the machine and equipment investment.",
    infoTr: "Faaliyetlerden gelen kümülatif nakdin makine ve ekipman yatırımını karşıladığı ay.",
  },
  {
    en: ["Lowest cash", "Lowest cash balance"],
    tr: ["En düşük nakit"],
    infoEn: "The lowest month-end cash balance over 5 years with the entered starting cash. Below zero means more funding is needed.",
    infoTr: "Girilen başlangıç nakdiyle 5 yıl içindeki en düşük ay sonu nakit. Sıfırın altındaysa ek finansman gerekir.",
  },
  {
    en: ["Capacity use"],
    tr: ["Kapasite kullanımı"],
    infoEn: "5-year sales demand divided by what the production plan can make. Over 100% means part of the demand cannot be produced.",
    infoTr: "5 yıllık satış talebinin üretim planının üretebileceği miktara oranı. %100'ün üstü, talebin bir kısmının üretilemeyeceği anlamına gelir.",
  },
  {
    en: ["Loan", "Loans", "Loan amount", "Total loan", "Loan records"],
    tr: ["Kredi", "Krediler", "Kredi tutarı", "Toplam kredi", "Kredi kayıtları"],
    infoEn: "Borrowed financing that affects cash inflow, repayment, interest, and runway.",
    infoTr: "Nakit girişi, geri ödeme, faiz ve nakit dayanmayı etkileyen borç finansmanı.",
  },
  {
    en: ["Term", "Loan term months", "Longest term", "Repayment term"],
    tr: ["Vade", "Kredi vadesi ay", "En uzun vade", "Ödeme vadesi"],
    infoEn: "The time period over which a loan or payment schedule runs.",
    infoTr: "Kredi veya ödeme planının geçerli olduğu süre.",
  },
  {
    en: ["Grace period", "Grace period months", "Longest grace"],
    tr: ["Ödemesiz", "Ödemesiz ay", "En uzun ödemesiz"],
    infoEn: "Months before cash repayment starts for a loan.",
    infoTr: "Bir kredide nakit geri ödemenin başlamasından önceki aylar.",
  },
  {
    en: ["Annual interest", "Annual interest %", "Estimated interest"],
    tr: ["Yıllık faiz", "Yıllık faiz %", "Tahmini faiz"],
    infoEn: "Financing cost charged yearly on borrowed money.",
    infoTr: "Borç alınan para üzerinden yıllık hesaplanan finansman maliyeti.",
  },
  {
    en: ["Currency", "FX", "Exchange rate"],
    tr: ["Döviz", "Kur", "Döviz kuru"],
    infoEn: "The money unit and conversion rate used for foreign-currency values.",
    infoTr: "Yabancı para değerlerini çevirmek için kullanılan para birimi ve dönüşüm oranı.",
  },
  {
    en: ["Demand", "Market demand", "Average monthly demand", "Unmet sales"],
    tr: ["Talep", "Pazar talebi", "Ortalama aylık talep", "Karşılanmayan satış"],
    infoEn: "Expected customer need used to calculate sales, capacity coverage, and stock risk.",
    infoTr: "Satış, kapasite karşılama ve stok riskini hesaplamakta kullanılan beklenen müşteri ihtiyacı.",
  },
  {
    en: ["Sales forecast", "Forecast", "Channel sales plan"],
    tr: ["Satış tahmini", "Tahmin", "Kanal satış planı"],
    infoEn: "Expected future sales by product, channel, timing, and volume.",
    infoTr: "Ürün, kanal, zamanlama ve hacme göre beklenen gelecek satışlar.",
  },
  {
    en: ["Inventory", "Inventory risk", "Unsold inventory", "Inventory Cost"],
    tr: ["Stok", "Stok riski", "Satılmayan stok", "Stok maliyeti"],
    infoEn: "Units held before sale and the risk or cost of carrying them.",
    infoTr: "Satış öncesi elde tutulan ürünler ve bunları taşımanın riski veya maliyeti.",
  },
  {
    en: ["Scenario", "Scenario test", "Simulation", "Variant"],
    tr: ["Senaryo", "Senaryo testi", "Simülasyon", "Varyant"],
    infoEn: "A test version of assumptions used to compare possible outcomes.",
    infoTr: "Olası sonuçları karşılaştırmak için kullanılan varsayım testi.",
  },
  {
    en: ["Risk", "Risk board", "Blocker", "High", "Medium", "Controlled"],
    tr: ["Risk", "Risk panosu", "Engel", "Yüksek", "Orta", "Kontrollü"],
    infoEn: "A condition that can reduce feasibility or require action before committing.",
    infoTr: "Fizibiliteyi düşürebilecek veya karar öncesi aksiyon gerektiren durum.",
  },
  {
    en: ["Report", "Report pack", "Report Downloads", "Export"],
    tr: ["Rapor", "Rapor paketi", "Rapor İndirme", "Export"],
    infoEn: "A packaged view of the current plan and evidence for review or sharing.",
    infoTr: "Mevcut planı ve dayanaklarını incelemek veya paylaşmak için paketlenmiş görünüm.",
  },
  {
    en: ["Permission", "Permissions", "Read", "Write", "Role", "User"],
    tr: ["İzin", "İzinler", "Okuma", "Yazma", "Yetki", "Kullanıcı"],
    infoEn: "Access control settings that determine who can view or change modules.",
    infoTr: "Modülleri kimin görüntüleyip değiştirebileceğini belirleyen erişim ayarları.",
  },
  {
    en: ["Status", "Ready", "Needed", "Needs input"],
    tr: ["Durum", "Hazır", "Gerekli", "Girdi gerekli"],
    infoEn: "A readiness signal showing whether the item can be used in the workflow.",
    infoTr: "Öğenin iş akışında kullanılabilir olup olmadığını gösteren hazırlık işareti.",
  },
  {
    en: ["Required", "Optional"],
    tr: ["Zorunlu", "Opsiyonel"],
    infoEn: "Shows whether the field must be filled before saving or calculation.",
    infoTr: "Alanının kayıt veya hesaplama öncesi doldurulmasının gerekip gerekmediğini gösterir.",
  },
];

export function normalizeGlossaryText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "")
    .replace(/[:：]+$/g, "")
    .trim()
    .toLocaleLowerCase("tr-TR");
}
