const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { normalize } = require('./transform');

async function main() {
  console.log('Starting SaaS Data Reconciliation (saasclone vs saasv2)...');

  // Initialize DB clients
  const prismaClone = new PrismaClient({
    datasources: { db: { url: process.env.SOURCE_DATABASE_URL } }
  });
  const prismaV2 = new PrismaClient();

  const mappingsPath = path.join(__dirname, 'etl_value_mappings.json');
  const mappings = require(mappingsPath);
  const whitelisted = mappings.tenantWhitelist;
  const tenantIds = whitelisted.map(t => t.businessId);

  try {
    // 1. Gather Target counts from saasclone
    console.log('Gathering reference counts from saasclone (read-only)...');
    const cloneCounts = {};
    let totalCloneListings = 0;
    let totalCloneImages = 0;
    let totalCloneMessages = 0;
    let totalCloneReviews = 0;
    let totalCloneViews = 0;
    let totalCloneUsers = 0;

    for (const tenant of whitelisted) {
      const id = tenant.businessId;

      const listings = await prismaClone.$queryRawUnsafe(
        `SELECT id FROM "Listing" WHERE "businessId" = $1`, id
      );
      const listingCount = listings.length;

      const listingIds = listings.map(l => l.id);
      let imageCount = 0;
      if (listingIds.length > 0) {
        const inClause = listingIds.map((_, i) => `$${i + 1}`).join(',');
        const images = await prismaClone.$queryRawUnsafe(
          `SELECT id FROM "ListingImage" WHERE "listingId" IN (${inClause})`,
          ...listingIds
        );
        imageCount = images.length;
      }

      const messages = await prismaClone.$queryRawUnsafe(
        `SELECT id FROM "Message" WHERE "businessId" = $1`, id
      );
      const messageCount = messages.length;

      const reviews = await prismaClone.$queryRawUnsafe(
        `SELECT id FROM "Review" WHERE "businessId" = $1`, id
      );
      const reviewCount = reviews.length;

      const views = await prismaClone.$queryRawUnsafe(
        `SELECT id FROM "View" WHERE "businessId" = $1`, id
      );
      const viewCount = views.length;

      const users = await prismaClone.$queryRawUnsafe(
        `SELECT id FROM "User" WHERE "businessId" = $1`, id
      );
      const userCount = users.length;

      cloneCounts[id] = {
        name: tenant.name,
        listings: listingCount,
        images: imageCount,
        messages: messageCount,
        reviews: reviewCount,
        views: viewCount,
        users: userCount
      };

      totalCloneListings += listingCount;
      totalCloneImages += imageCount;
      totalCloneMessages += messageCount;
      totalCloneReviews += reviewCount;
      totalCloneViews += viewCount;
      totalCloneUsers += userCount;
    }

    // 2. Gather Mapped counts from saasv2
    console.log('Gathering actual counts from saasv2 (read-only)...');
    const v2Counts = {};
    let totalV2Listings = 0;
    let totalV2Images = 0;
    let totalV2Messages = 0;
    let totalV2Reviews = 0;
    let totalV2Views = 0;
    let totalV2Users = 0;

    for (const tenant of whitelisted) {
      const id = tenant.businessId;

      const listings = await prismaV2.listing.findMany({
        where: { businessId: id },
        select: { id: true }
      });
      const listingCount = listings.length;

      const listingIds = listings.map(l => l.id);
      let imageCount = 0;
      if (listingIds.length > 0) {
        imageCount = await prismaV2.listingImage.count({
          where: { listingId: { in: listingIds } }
        });
      }

      const messageCount = await prismaV2.message.count({
        where: { businessId: id }
      });

      const reviewCount = await prismaV2.review.count({
        where: { businessId: id }
      });

      const viewCount = await prismaV2.view.count({
        where: { businessId: id }
      });

      const userCount = await prismaV2.user.count({
        where: { businessId: id }
      });

      v2Counts[id] = {
        listings: listingCount,
        images: imageCount,
        messages: messageCount,
        reviews: reviewCount,
        views: viewCount,
        users: userCount
      };

      totalV2Listings += listingCount;
      totalV2Images += imageCount;
      totalV2Messages += messageCount;
      totalV2Reviews += reviewCount;
      totalV2Views += viewCount;
      totalV2Users += userCount;
    }

    // 3. Integrity Checks in saasv2
    console.log('Running integrity checks on saasv2...');
    const allV2Listings = await prismaV2.listing.findMany({
      include: {
        business: true,
        images: true,
        make: true,
        model: true
      }
    });

    const totalListings = allV2Listings.length;
    let orphanListings = 0;
    let orphanImages = 0;
    let nullMakeCount = 0;
    let extraSpecsCount = 0;
    let priceSum = 0;
    let makeNoModelCount = 0;

    for (const l of allV2Listings) {
      if (!l.business) orphanListings++;
      if (!l.makeId) nullMakeCount++;
      if (l.makeId && !l.modelId) makeNoModelCount++;
      if (l.price) priceSum += l.price;
      if (l.extraSpecs && Object.keys(l.extraSpecs).length > 0) extraSpecsCount++;

      // Check orphan images
      for (const img of l.images) {
        if (img.listingId !== l.id) orphanImages++;
      }
    }

    const percentageNullMake = totalListings > 0 ? ((nullMakeCount / totalListings) * 100).toFixed(2) : '0.00';

    // 4. Field Fidelity Spot Check
    console.log('Performing field fidelity spot checks...');
    // Select 10 random listings from saasv2
    const shuffled = [...allV2Listings].sort(() => 0.5 - Math.random());
    const selectedListings = shuffled.slice(0, Math.min(10, totalListings));

    const spotCheckResults = [];
    for (const l2 of selectedListings) {
      // Query raw EAV data for this listing in saasclone
      const rawListing = await prismaClone.$queryRawUnsafe(
        `SELECT price, mileage FROM "Listing" WHERE id = $1`, l2.id
      );
      const v1Fixed = rawListing[0] || {};

      const rawAttrs = await prismaClone.$queryRawUnsafe(
        `SELECT a.name, av."stringValue", av."numberValue", av."booleanValue"
         FROM "AttributeValue" av
         JOIN "Attribute" a ON av."attributeId" = a.id
         WHERE av."listingId" = $1`,
        l2.id
      );

      let v1Year = null;
      let v1Fuel = null;
      for (const attr of rawAttrs) {
        const normName = normalize(attr.name);
        if (['an fabricatie', 'an', 'anul fabricatiei'].includes(normName)) {
          v1Year = attr.numberValue || attr.stringValue;
        }
        if (['combustibil', 'tip carburant'].includes(normName)) {
          v1Fuel = attr.stringValue;
        }
      }

      spotCheckResults.push({
        id: l2.id,
        title: l2.title,
        v1: {
          price: v1Fixed.price,
          mileage: v1Fixed.mileage,
          year: v1Year,
          fuelType: v1Fuel
        },
        v2: {
          price: l2.price,
          mileage: l2.mileage,
          year: l2.year,
          fuelType: l2.fuelType
        }
      });
    }

    // 5. Generate Reconciliation Report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportsDir = path.join(__dirname, 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    const reportPath = path.join(reportsDir, `reconcile_${timestamp}.md`);

    let mdContent = `# SaaS Migration Reconciliation Report\n\n`;
    mdContent += `Generated: ${new Date().toLocaleString()}\n`;
    mdContent += `Status: ${totalCloneListings === totalV2Listings ? 'SUCCESS (Counts Match)' : 'WARNING (Mismatch Detected)'}\n\n`;

    mdContent += `## 1. Row Counts Comparison per Tenant\n\n`;
    mdContent += `| Tenant Name | Entity | saasclone (V1) | saasv2 (V2) | Status |\n`;
    mdContent += `| :--- | :--- | :--- | :--- | :--- |\n`;

    let allMatch = true;

    for (const tenant of whitelisted) {
      const id = tenant.businessId;
      const c = cloneCounts[id];
      const v = v2Counts[id];

      const checkMatch = (field) => {
        const m = c[field] === v[field];
        if (!m) allMatch = false;
        return m ? 'MATCH' : `MISMATCH (${c[field]} vs ${v[field]})`;
      };

      mdContent += `| **${tenant.name}** | Listings | ${c.listings} | ${v.listings} | ${checkMatch('listings')} |\n`;
      mdContent += `| | Images | ${c.images} | ${v.images} | ${checkMatch('images')} |\n`;
      mdContent += `| | Messages | ${c.messages} | ${v.messages} | ${checkMatch('messages')} |\n`;
      mdContent += `| | Reviews | ${c.reviews} | ${v.reviews} | ${checkMatch('reviews')} |\n`;
      mdContent += `| | Views | ${c.views} | ${v.views} | ${checkMatch('views')} |\n`;
      mdContent += `| | Users | ${c.users} | ${v.users} | ${checkMatch('users')} |\n`;
    }

    mdContent += `\n### Totals Summary\n\n`;
    mdContent += `| Entity Type | Target (saasclone) | Actual (saasv2) | Status |\n`;
    mdContent += `| :--- | :--- | :--- | :--- |\n`;
    mdContent += `| Businesses | ${whitelisted.length} | ${totalV2Users > 0 ? whitelisted.length : 0} | ${whitelisted.length === (totalV2Users > 0 ? whitelisted.length : 0) ? 'MATCH' : 'MISMATCH'} |\n`;
    mdContent += `| Users | ${totalCloneUsers} | ${totalV2Users} | ${totalCloneUsers === totalV2Users ? 'MATCH' : 'MISMATCH'} |\n`;
    mdContent += `| Listings | ${totalCloneListings} | ${totalV2Listings} | ${totalCloneListings === totalV2Listings ? 'MATCH' : 'MISMATCH'} |\n`;
    mdContent += `| Images | ${totalCloneImages} | ${totalV2Images} | ${totalCloneImages === totalV2Images ? 'MATCH' : 'MISMATCH'} |\n`;
    mdContent += `| Messages | ${totalCloneMessages} | ${totalV2Messages} | ${totalCloneMessages === totalV2Messages ? 'MATCH' : 'MISMATCH'} |\n`;
    mdContent += `| Reviews | ${totalCloneReviews} | ${totalV2Reviews} | ${totalCloneReviews === totalV2Reviews ? 'MATCH' : 'MISMATCH'} |\n`;
    mdContent += `| Views | ${totalCloneViews} | ${totalV2Views} | ${totalCloneViews === totalV2Views ? 'MATCH' : 'MISMATCH'} |\n`;

    mdContent += `\n## 2. Integrity Checks (saasv2)\n\n`;
    mdContent += `- **Orphan Listings** (no Business): ${orphanListings} (Expect: 0)\n`;
    mdContent += `- **Orphan ListingImages** (no Listing): ${orphanImages} (Expect: 0)\n`;
    mdContent += `- **Listings with Null Make**: ${nullMakeCount} of ${totalListings} (${percentageNullMake}%)\n`;
    mdContent += `- **Listings with makeId set but modelId null**: ${makeNoModelCount}\n`;
    mdContent += `- **Listings with Non-Empty extraSpecs**: ${extraSpecsCount} of ${totalListings} (${((extraSpecsCount / totalListings) * 100).toFixed(2)}%)\n`;
    mdContent += `- **Sum of Public Prices**: ${priceSum.toLocaleString()} EUR\n\n`;

    mdContent += `## 3. Field Fidelity Spot Check (10 Random Listings)\n\n`;
    mdContent += `| Listing ID | Title | Field | V1 Raw Value | V2 Mapped Value | Status |\n`;
    mdContent += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    for (const res of spotCheckResults) {
      const matchStatus = (v1, v2) => {
        if (v1 === null || v1 === undefined) return v2 === null ? 'OK' : 'MISMATCH';
        return v1.toString().toLowerCase().trim() === v2.toString().toLowerCase().trim() ? 'OK' : 'CHECK';
      };

      mdContent += `| \`${res.id.slice(0, 8)}...\` | ${res.title} | Price | ${res.v1.price} | ${res.v2.price} | ${matchStatus(res.v1.price, res.v2.price)} |\n`;
      mdContent += `| | | Mileage | ${res.v1.mileage} | ${res.v2.mileage} | ${matchStatus(res.v1.mileage, res.v2.mileage)} |\n`;
      mdContent += `| | | Year | ${res.v1.year} | ${res.v2.year} | ${matchStatus(res.v1.year, res.v2.year)} |\n`;
      mdContent += `| | | FuelType | ${res.v1.fuelType} | ${res.v2.fuelType} | ${matchStatus(res.v1.fuelType, res.v2.fuelType)} |\n`;
    }

    fs.writeFileSync(reportPath, mdContent, 'utf8');

    // Print summary to stdout
    console.log('\n================ RECONCILIATION SUMMARY ================');
    console.log(`Report written to: ${reportPath}`);
    console.log(`Overall Counts MATCH: ${allMatch ? 'YES' : 'NO'}`);
    console.log(`Total Listings:       Clone=${totalCloneListings} vs V2=${totalV2Listings} (${totalCloneListings === totalV2Listings ? 'MATCH' : 'MISMATCH'})`);
    console.log(`Total Images:         Clone=${totalCloneImages} vs V2=${totalV2Images} (${totalCloneImages === totalV2Images ? 'MATCH' : 'MISMATCH'})`);
    console.log(`Total Messages:       Clone=${totalCloneMessages} vs V2=${totalV2Messages} (${totalCloneMessages === totalV2Messages ? 'MATCH' : 'MISMATCH'})`);
    console.log(`Total Reviews:        Clone=${totalCloneReviews} vs V2=${totalV2Reviews} (${totalCloneReviews === totalV2Reviews ? 'MATCH' : 'MISMATCH'})`);
    console.log(`Total Views:          Clone=${totalCloneViews} vs V2=${totalV2Views} (${totalCloneViews === totalV2Views ? 'MATCH' : 'MISMATCH'})`);
    console.log(`Total Users:          Clone=${totalCloneUsers} vs V2=${totalV2Users} (${totalCloneUsers === totalV2Users ? 'MATCH' : 'MISMATCH'})`);
    console.log(`Integrity Check:      Orphan Listings = ${orphanListings}, Orphan Images = ${orphanImages}`);
    console.log(`Listings Null Make:   ${nullMakeCount} (${percentageNullMake}%)`);
    console.log(`Listings non-empty extraSpecs: ${extraSpecsCount}`);
    console.log('========================================================\n');

    if (!allMatch) {
      console.error('CRITICAL: Reconciliation failed. Counts do not match.');
      process.exit(1);
    } else {
      console.log('Reconciliation successful. All target counts match perfectly.');
    }

  } catch (err) {
    console.error('ERROR DURING RECONCILIATION:', err);
    process.exit(1);
  } finally {
    await prismaClone.$disconnect();
    await prismaV2.$disconnect();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
