const prisma = require("../config/prismaClient");

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPrice(n) {
  if (n === null || n === undefined || n === '') return '';
  return new Intl.NumberFormat('ro-RO').format(Number(n));
}

function formatDateRo(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ro-RO');
}

const FUEL_LABELS = {
  PETROL: "Benzină", DIESEL: "Diesel", PETROL_LPG: "Benzină + GPL", LPG: "GPL",
  HYBRID: "Hibrid", PLUGIN_HYBRID: "Plug-in Hibrid", MILD_HYBRID: "Mild Hibrid", ELECTRIC: "Electric"
};
const GEARBOX_LABELS = { MANUAL: "Manuală", AUTOMATIC: "Automată" };

function buildSpecsHtml(listing) {
  if (!listing) return '';
  const rows = [];
  if (listing.year) rows.push(["An", escapeHtml(String(listing.year))]);
  if (listing.mileage != null) rows.push(["Kilometraj", formatPrice(listing.mileage) + " km"]);
  if (listing.fuelType && FUEL_LABELS[listing.fuelType]) rows.push(["Combustibil", FUEL_LABELS[listing.fuelType]]);
  if (listing.gearbox && GEARBOX_LABELS[listing.gearbox]) rows.push(["Cutie", GEARBOX_LABELS[listing.gearbox]]);
  if (listing.powerHp) rows.push(["Putere", escapeHtml(String(listing.powerHp)) + " CP"]);
  if (rows.length === 0) return '';
  const cells = rows.map(([k, v]) =>
    `<div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;">
       <div style="font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.04em;color:#94a3b8;font-weight:700;">${k}</div>
       <div style="font-size:0.9375rem;color:#0f172a;font-weight:700;margin-top:2px;">${v}</div>
     </div>`
  ).join('');
  return `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:24px;">${cells}</div>`;
}

const notFoundHtml = () => {
  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ofertă negăsită</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f1f5f9;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
    }
    .card {
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      padding: 40px 24px;
      text-align: center;
      max-width: 400px;
      width: 100%;
    }
    .icon {
      color: #ef4444;
      font-size: 48px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 800;
      margin: 0 0 8px 0;
    }
    p {
      color: #64748b;
      margin: 0;
      font-size: 0.9375rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>Ofertă negăsită</h1>
    <p>Linkul accesat nu este valid, a expirat sau oferta a fost ștearsă.</p>
  </div>
</body>
</html>`;
};

const expiredHtml = (offer) => {
  const biz = offer.business || {};
  const bizName = escapeHtml(biz.name || "Dealership");
  const companyPhone = biz.companyPhone ? `<p style="margin: 16px 0 0 0; font-size: 0.875rem; color: #0f172a; font-weight: 600;">Contact dealer: ${escapeHtml(biz.companyPhone)}</p>` : '';
  
  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ofertă expirată</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f1f5f9;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
    }
    .card {
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      padding: 40px 24px;
      text-align: center;
      max-width: 400px;
      width: 100%;
    }
    .icon {
      color: #f97316;
      font-size: 48px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 800;
      margin: 0 0 8px 0;
    }
    p {
      color: #64748b;
      margin: 0;
      font-size: 0.9375rem;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⏳</div>
    <h1>Ofertă expirată</h1>
    <p>Această ofertă (emisă de <strong>${bizName}</strong>) a depășit perioada de valabilitate și nu mai este disponibilă.</p>
    ${companyPhone}
  </div>
</body>
</html>`;
};

const offerHtml = (offer) => {
  const biz = offer.business || {};
  const listingTitle = escapeHtml(offer.listingTitleSnapshot);
  const clientName = escapeHtml(offer.clientName);
  const clientPhone = escapeHtml(offer.clientPhone);
  const bizName = escapeHtml(biz.name || "Dealership");
  
  const formattedOfferPrice = formatPrice(offer.offerPrice);
  const formattedListPrice = offer.listPrice ? formatPrice(offer.listPrice) : null;
  const isSpecialOffer = offer.listPrice && offer.listPrice > offer.offerPrice;
  const savings = isSpecialOffer ? offer.listPrice - offer.offerPrice : 0;
  const formattedSavings = savings > 0 ? formatPrice(savings) : null;
  
  const expiryDate = formatDateRo(offer.expiresAt);
  const issueDate = formatDateRo(offer.createdAt);

  const imageBand = offer.listingImageSnapshot
    ? `<div style="position: relative; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
         <img src="${escapeHtml(offer.listingImageSnapshot)}" style="width: 100%; height: 260px; object-fit: cover; display: block;" alt="${listingTitle}" />
         <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(15, 23, 42, 0.9)); padding: 24px 16px 16px 16px; color: #ffffff;">
           <h2 style="margin: 0; font-size: 1.25rem; font-weight: 700; line-height: 1.3;">${listingTitle}</h2>
         </div>
       </div>`
    : `<div style="background: linear-gradient(135deg, #0f172a, #1e293b); border-radius: 8px; padding: 32px 24px; margin-bottom: 24px; color: #ffffff; text-align: center;">
         <h2 style="margin: 0; font-size: 1.5rem; font-weight: 700; line-height: 1.3;">${listingTitle}</h2>
       </div>`;

  const priceSection = isSpecialOffer
    ? `<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
         <div style="color: #64748b; font-size: 0.875rem; text-decoration: line-through; margin-bottom: 4px;">Preț listă: ${formattedListPrice} €</div>
         <div style="color: #0f172a; font-size: 1.75rem; font-weight: 800; line-height: 1;">${formattedOfferPrice} €</div>
         <div style="color: #2563eb; font-size: 0.875rem; font-weight: 600; margin-top: 4px;">Preț ofertă specială</div>
         ${formattedSavings ? `<div style="display: inline-block; background-color: #dcfce7; color: #15803d; font-size: 0.75rem; font-weight: 700; padding: 4px 8px; border-radius: 9999px; margin-top: 8px;">Economisiți ${formattedSavings} €</div>` : ''}
       </div>`
    : `<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
         <div style="color: #0f172a; font-size: 1.75rem; font-weight: 800; line-height: 1;">${formattedOfferPrice} €</div>
         <div style="color: #64748b; font-size: 0.875rem; font-weight: 600; margin-top: 4px;">Preț ofertă</div>
       </div>`;

  const phoneSection = clientPhone ? `<p style="margin: 4px 0 0 0; color: #64748b; font-size: 0.875rem;">Tel: ${escapeHtml(clientPhone)}</p>` : '';

  const companyPhone = biz.companyPhone ? `<p style="margin: 4px 0;">Telefon: ${escapeHtml(biz.companyPhone)}</p>` : '';
  const companyEmail = biz.companyEmail ? `<p style="margin: 4px 0;">Email: <a href="mailto:${escapeHtml(biz.companyEmail)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(biz.companyEmail)}</a></p>` : '';
  const companyAddress = biz.companyAddress ? `<p style="margin: 4px 0;">Adresă: ${escapeHtml(biz.companyAddress)}</p>` : '';
  
  let companyIdentifiers = [];
  if (biz.companyCui) companyIdentifiers.push(`CUI: ${escapeHtml(biz.companyCui)}`);
  if (biz.companyRegCom) companyIdentifiers.push(`Reg. Com.: ${escapeHtml(biz.companyRegCom)}`);
  const companyIdentifiersRow = companyIdentifiers.length > 0
    ? `<p style="margin: 8px 0 0 0; font-size: 0.75rem; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 8px;">${companyIdentifiers.join(' · ')}</p>`
    : '';

  const specsSection = buildSpecsHtml(offer.listing);
  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Ofertă ${listingTitle}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f1f5f9;
      color: #0f172a;
      margin: 0;
      padding: 0;
      line-height: 1.5;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      padding: 0 16px;
    }
    .card {
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
      padding: 32px 24px;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .header .subtitle {
      color: #2563eb;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin: 0 0 4px 0;
    }
    .header .title {
      font-size: 1.5rem;
      font-weight: 800;
      margin: 0;
      color: #0f172a;
    }
    .section-title {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin: 0 0 8px 0;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    .btn-download {
      display: block;
      text-align: center;
      background-color: #2563eb;
      color: #ffffff;
      padding: 14px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 700;
      margin-top: 24px;
      transition: background-color 0.2s;
    }
    .btn-download:hover {
      background-color: #1d4ed8;
    }
    .validity {
      text-align: center;
      font-size: 0.875rem;
      color: #64748b;
      margin-top: 16px;
      font-style: italic;
    }
    .footer {
      margin-top: 32px;
      text-align: center;
      font-size: 0.8125rem;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      padding-top: 24px;
    }
    .btn-print {
      width: 100%;
      border: none;
      font-size: 1rem;
      font-family: inherit;
      cursor: pointer;
    }
    @media print {
      body { background-color: #ffffff !important; }
      .container { margin: 0 !important; max-width: 100% !important; padding: 0 !important; }
      .card { box-shadow: none !important; border: none !important; padding: 0 !important; }
      .btn-print { display: none !important; }
      .validity { margin-top: 8px; }
      a[href^="mailto:"] { color: #0f172a !important; text-decoration: none !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <p class="subtitle">${bizName}</p>
        <h1 class="title">OFERTĂ DE PREȚ</h1>
      </div>
      
      ${imageBand}
      
      ${specsSection}
      
      <div class="info-grid">
        <div>
          <h3 class="section-title">Destinatari</h3>
          <p style="margin: 0; font-weight: 700; font-size: 0.9375rem;">${clientName}</p>
          ${phoneSection}
        </div>
        <div>
          <h3 class="section-title">Detalii ofertă</h3>
          <p style="margin: 0; font-size: 0.875rem; color: #64748b;">Emisă la: <span style="color: #0f172a; font-weight: 600;">${issueDate}</span></p>
          <p style="margin: 4px 0 0 0; font-size: 0.875rem; color: #64748b;">Zile valabilitate: <span style="color: #0f172a; font-weight: 600;">${offer.validityDays}</span></p>
        </div>
      </div>
      
      ${priceSection}
      
      <button type="button" onclick="window.print()" class="btn-download btn-print">Descarcă / Printează PDF</button>
      <p class="validity">Ofertă valabilă până la ${expiryDate}</p>
      
      <div class="footer">
        <p style="margin: 0 0 8px 0; font-weight: 700; font-size: 0.875rem; color: #0f172a;">${bizName}</p>
        ${companyAddress}
        ${companyPhone}
        ${companyEmail}
        ${companyIdentifiersRow}
      </div>
    </div>
  </div>
</body>
</html>`;
};

const renderOfferPage = async (req, res) => {
  try {
    const { token } = req.params;
    const offer = await prisma.offer.findUnique({
      where: { token },
      include: {
        business: true,
        listing: { include: { make: true, model: true } }
      }
    });

    if (!offer) {
      return res.status(404).send(notFoundHtml());
    }

    if (new Date(offer.expiresAt) < new Date()) {
      return res.status(410).send(expiredHtml(offer));
    }

    if (!offer.viewedAt) {
      prisma.offer.update({
        where: { id: offer.id },
        data: { viewedAt: new Date() }
      }).catch((err) => console.error("Eroare la actualizarea viewedAt:", err));
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(offerHtml(offer));
  } catch (error) {
    console.error("Eroare la redarea paginii de ofertă:", error);
    return res.status(500).send("Eroare la redarea paginii de ofertă.");
  }
};

const extractCode = (offerSlug) => {
  if (!offerSlug) return "";
  const lastIndex = offerSlug.lastIndexOf('-');
  if (lastIndex === -1) return offerSlug;
  return offerSlug.substring(lastIndex + 1);
};

const renderOfferByCode = async (req, res) => {
  try {
    const { offerSlug } = req.params;
    const code = extractCode(offerSlug);

    const offer = await prisma.offer.findUnique({
      where: { code },
      include: {
        business: true,
        listing: { include: { make: true, model: true } }
      }
    });

    if (!offer) {
      return res.status(404).send(notFoundHtml());
    }

    if (new Date(offer.expiresAt) < new Date()) {
      return res.status(410).send(expiredHtml(offer));
    }

    if (!offer.viewedAt) {
      prisma.offer.update({
        where: { id: offer.id },
        data: { viewedAt: new Date() }
      }).catch((err) => console.error("Eroare la actualizarea viewedAt:", err));
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(offerHtml(offer));
  } catch (error) {
    console.error("Eroare la redarea paginii de ofertă după cod:", error);
    return res.status(500).send("Eroare la redarea paginii de ofertă.");
  }
};

module.exports = { renderOfferPage, renderOfferByCode };
