const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const BUSINESS_ID = 'cmoqb6gtw0ymsu21qq0y5om26'

const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

async function main() {
  const articles = [
    {
      title: "Cum să alegi mașina rulată potrivită în 2026",
      excerpt: "Achiziționarea unei mașini rulate poate fi o decizie excelentă dacă știi la ce să fii atent. Iată cele mai importante aspecte de verificat înainte de a semna contractul.",
      content: "<h2>1. Verifică istoricul mașinii</h2><p>Primul pas înainte de orice achiziție este verificarea istoricului vehiculului. Solicită un raport CarVertical sau RAR pentru a vedea dacă mașina a fost implicată în accidente.</p><h2>2. Inspecția tehnică independentă</h2><p>Nu te baza doar pe cuvântul vânzătorului. Du mașina la un service independent pentru o inspecție completă. Costul de 150-200 lei poate economisi mii de euro.</p><h2>3. Test drive în condiții variate</h2><p>Testează mașina atât în oraș cât și pe șosea. Ascultă zgomotele, verifică frânele și comportamentul la accelerare bruscă.</p>",
      category: "Ghid cumpărare",
      categoryKey: "ghid",
      readTime: "4 min"
    },
    {
      title: "Top 5 mașini SUV rulate sub 15.000€ în Cluj",
      excerpt: "SUV-urile sunt cele mai căutate mașini pe piața second-hand. Am selectat cele mai bune 5 opțiuni disponibile în Cluj sub 15.000 euro.",
      content: "<h2>1. Dacia Duster (2018-2021)</h2><p>Cel mai accesibil SUV de pe piață. Fiabilitate excelentă, costuri minime de întreținere și teren ridicat. Prețuri între 8.000-13.000€.</p><h2>2. Skoda Karoq (2018-2020)</h2><p>Alternativa premium la prețuri accesibile. Interior spațios, motor TSI fiabil și dotări bogate. Prețuri între 12.000-15.000€.</p><h2>3. Volkswagen T-Roc (2018-2020)</h2><p>Design modern și calitate germană. Motor TSI 1.0 sau 1.5 economic. Prețuri între 11.000-15.000€.</p>",
      category: "Top & Recomandări",
      categoryKey: "top",
      readTime: "5 min"
    },
    {
      title: "Finanțare auto în 2026 — Ce variantă ți se potrivește?",
      excerpt: "Rate, leasing sau credit bancar? Explorăm toate opțiunile de finanțare pentru achiziția unei mașini rulate și te ajutăm să alegi cea mai avantajoasă.",
      content: "<h2>Credit bancar — pentru persoane fizice</h2><p>Dacă ai venituri stabile și un scoring bun, creditul bancar auto oferă cele mai mici dobânzi. DAE mediu în 2026: 8-12%. Avantaj: mașina e a ta din prima zi.</p><h2>Leasing financiar — pentru firme</h2><p>Ideal pentru PFA și SRL. TVA-ul se deduce, rata e cheltuială deductibilă. DAE leasing: 9-14%, dar avantajele fiscale compensează diferența.</p><h2>Rate prin dealer</h2><p>La AlfaCars Cluj oferim aprobare rapidă prin parteneri bancari, uneori chiar în aceeași zi. Avans minim 20%, perioadă 12-60 luni.</p>",
      category: "Legal & Financiar",
      categoryKey: "legal",
      readTime: "4 min"
    }
  ]

  for (const a of articles) {
    const slug = generateSlug(a.title)
    await prisma.blogPost.upsert({
      where: { slug_businessId: { slug, businessId: BUSINESS_ID } },
      update: {
        ...a,
        isPublished: true,
        publishedAt: new Date()
      },
      create: {
        ...a,
        slug,
        isPublished: true,
        businessId: BUSINESS_ID,
        publishedAt: new Date()
      }
    })
    console.log(`Saved: ${a.title}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
