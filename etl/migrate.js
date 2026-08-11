const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const {
  normalize,
  isBooleanTrue,
  mapEnum,
  mapNumeric,
  mapMake,
  mapModel,
  mapFeatures,
  mapMakeFromTitle,
  crossFieldFixups,
  mappingsData
} = require('./transform');

const DRY_RUN = false;

async function main() {
  console.log('Starting SaaS Data Migration (saasclone -> saasv2)...');
  console.log(`DRY_RUN mode: ${DRY_RUN}`);

  const args = process.argv.slice(2);
  const resetFlag = args.includes('--reset');
  const onlyIdx = args.indexOf('--only');
  const onlyFlag = onlyIdx !== -1 ? args[onlyIdx + 1] : null;

  // Initialize DB clients
  const prismaClone = new PrismaClient({
    datasources: { db: { url: process.env.SOURCE_DATABASE_URL } }
  });
  const prismaV2 = new PrismaClient();

  try {
    // 1. Guard check / Reset check
    const existingListings = onlyFlag
      ? await prismaV2.listing.count({ where: { businessId: onlyFlag } })
      : await prismaV2.listing.count();
    const existingBiz = onlyFlag
      ? await prismaV2.business.count({ where: { id: onlyFlag } })
      : await prismaV2.business.count();

    if (existingListings > 0 || existingBiz > 0) {
      if (!resetFlag) {
        console.error('CRITICAL: saasv2 database is not empty. Please run with --reset to wipe migrated tables first.');
        process.exit(1);
      } else {
        console.log('Wiping migrated tables in saasv2 (FK-safe order)...');
        await prismaV2.$executeRawUnsafe('DELETE FROM "ListingImage";');
        await prismaV2.$executeRawUnsafe('DELETE FROM "View";');
        await prismaV2.$executeRawUnsafe('DELETE FROM "Review";');
        await prismaV2.$executeRawUnsafe('DELETE FROM "Message";');
        await prismaV2.$executeRawUnsafe('DELETE FROM "User";');
        await prismaV2.$executeRawUnsafe('DELETE FROM "_FeatureToListing";');
        await prismaV2.$executeRawUnsafe('DELETE FROM "Listing";');
        await prismaV2.$executeRawUnsafe('DELETE FROM "Business";');
        console.log('Wipe complete.');
      }
    } else {
      if (resetFlag) {
        console.log('saasv2 database is already empty. No wipe needed.');
      }
    }

    // 2. Load Makes, Models, and Features dictionary from saasv2
    console.log('Loading Makes and Models dictionary from saasv2...');
    const dbMakes = await prismaV2.make.findMany();
    const makeSlugToId = {};
    for (const m of dbMakes) {
      makeSlugToId[m.slug] = m.id;
    }

    const dbModels = await prismaV2.carModel.findMany({
      include: { make: true }
    });
    const modelCache = {};
    for (const m of dbModels) {
      const makeSlug = m.make.slug;
      if (!modelCache[makeSlug]) {
        modelCache[makeSlug] = new Map();
      }
      const normName = normalize(m.name);
      const mSlug = m.slug;
      modelCache[makeSlug].set(normName, { id: m.id, slug: m.slug, name: m.name });
      modelCache[makeSlug].set(mSlug, { id: m.id, slug: m.slug, name: m.name });
    }

    const dbFeatures = await prismaV2.feature.findMany();
    const featureSlugToId = {};
    for (const f of dbFeatures) {
      featureSlugToId[f.slug] = f.id;
    }
    console.log(`Loaded ${dbMakes.length} makes, ${dbModels.length} models, and ${dbFeatures.length} features into cache.`);

    // 3. Resolve Tenants to migrate
    let tenantsToMigrate = mappingsData.tenantWhitelist;
    if (onlyFlag) {
      tenantsToMigrate = tenantsToMigrate.filter(t => t.businessId === onlyFlag);
      if (tenantsToMigrate.length === 0) {
        console.error(`CRITICAL: Whitelisted business with ID "${onlyFlag}" not found in tenantWhitelist.`);
        process.exit(1);
      }
      console.log(`Rehearsal Run: Limited to tenant "${tenantsToMigrate[0].name}" (${onlyFlag})`);
    } else {
      console.log(`Full Migration Run: Migrating all ${tenantsToMigrate.length} whitelisted tenants.`);
    }
    const tenantIds = tenantsToMigrate.map(t => t.businessId);

    // 4. Fetch data in bulk from saasclone
    console.log('Fetching source data from saasclone...');
    const inClause = tenantIds.map(id => `'${id}'`).join(',');

    const businesses = await prismaClone.$queryRawUnsafe(
      `SELECT * FROM "Business" WHERE "id" IN (${inClause})`
    );
    const users = await prismaClone.$queryRawUnsafe(
      `SELECT * FROM "User" WHERE "businessId" IN (${inClause})`
    );
    const listings = await prismaClone.$queryRawUnsafe(
      `SELECT * FROM "Listing" WHERE "businessId" IN (${inClause})`
    );
    const listingIds = listings.map(l => l.id);

    let images = [];
    if (listingIds.length > 0) {
      images = await prismaClone.$queryRawUnsafe(
        `SELECT * FROM "ListingImage" WHERE "listingId" IN (${listingIds.map(id => `'${id}'`).join(',')})`
      );
    }

    const messages = await prismaClone.$queryRawUnsafe(
      `SELECT * FROM "Message" WHERE "businessId" IN (${inClause})`
    );
    const reviews = await prismaClone.$queryRawUnsafe(
      `SELECT * FROM "Review" WHERE "businessId" IN (${inClause})`
    );
    const views = await prismaClone.$queryRawUnsafe(
      `SELECT * FROM "View" WHERE "businessId" IN (${inClause})`
    );

    let dbAttrs = [];
    if (listingIds.length > 0) {
      const attrsQuery = `
        SELECT 
          av."listingId",
          a.name AS "attrName",
          a.type AS "attrType",
          av."stringValue",
          av."numberValue",
          av."booleanValue"
        FROM "AttributeValue" av
        JOIN "Attribute" a ON av."attributeId" = a.id
        JOIN "Listing" l ON av."listingId" = l.id
        WHERE l."businessId" IN (${inClause})
      `;
      dbAttrs = await prismaClone.$queryRawUnsafe(attrsQuery);
    }

    console.log(`Loaded from saasclone: ${businesses.length} businesses, ${users.length} users, ${listings.length} listings, ${images.length} images, ${messages.length} messages, ${reviews.length} reviews, ${views.length} views, ${dbAttrs.length} attribute values.`);

    // Grouping by businessId
    const usersByBusiness = {};
    const listingsByBusiness = {};
    const messagesByBusiness = {};
    const reviewsByBusiness = {};
    const viewsByBusiness = {};

    for (const b of businesses) {
      usersByBusiness[b.id] = [];
      listingsByBusiness[b.id] = [];
      messagesByBusiness[b.id] = [];
      reviewsByBusiness[b.id] = [];
      viewsByBusiness[b.id] = [];
    }

    for (const u of users) {
      if (usersByBusiness[u.businessId]) usersByBusiness[u.businessId].push(u);
    }
    for (const l of listings) {
      if (listingsByBusiness[l.businessId]) listingsByBusiness[l.businessId].push(l);
    }
    for (const m of messages) {
      if (messagesByBusiness[m.businessId]) messagesByBusiness[m.businessId].push(m);
    }
    for (const r of reviews) {
      if (reviewsByBusiness[r.businessId]) reviewsByBusiness[r.businessId].push(r);
    }
    for (const v of views) {
      if (viewsByBusiness[v.businessId]) viewsByBusiness[v.businessId].push(v);
    }

    const imagesByListing = {};
    for (const img of images) {
      if (!imagesByListing[img.listingId]) {
        imagesByListing[img.listingId] = [];
      }
      imagesByListing[img.listingId].push(img);
    }

    const listingAttrsMap = {};
    const listingAttrTypesMap = {};
    const listingOriginalNamesMap = {};
    for (const row of dbAttrs) {
      if (!listingAttrsMap[row.listingId]) {
        listingAttrsMap[row.listingId] = {};
        listingAttrTypesMap[row.listingId] = {};
        listingOriginalNamesMap[row.listingId] = {};
      }
      let val = null;
      if (row.booleanValue !== null) val = row.booleanValue;
      else if (row.numberValue !== null) val = row.numberValue;
      else if (row.stringValue !== null) val = row.stringValue;

      const normName = normalize(row.attrName);
      listingAttrsMap[row.listingId][normName] = val;
      listingAttrTypesMap[row.listingId][normName] = row.attrType;
      listingOriginalNamesMap[row.listingId][normName] = row.attrName;
    }

    const enumConcepts = ['fuelType', 'gearbox', 'drivetrain', 'bodyType', 'pollutionNorm', 'color', 'upholstery', 'airConditioning', 'countryOfOrigin'];

    const failures = [];
    const totals = {
      businesses: 0,
      users: 0,
      listings: 0,
      images: 0,
      messages: 0,
      reviews: 0,
      views: 0
    };

    // 5. Run Migration Tenant by Tenant
    for (const b of businesses) {
      const tenantName = b.name;
      const tenantId = b.id;
      console.log(`Migrating tenant: "${tenantName}" (${tenantId})...`);

      const tenantUsers = usersByBusiness[tenantId] || [];
      const tenantListings = listingsByBusiness[tenantId] || [];
      const tenantMessages = messagesByBusiness[tenantId] || [];
      const tenantReviews = reviewsByBusiness[tenantId] || [];
      const tenantViews = viewsByBusiness[tenantId] || [];
      const migratedListingIds = new Set(tenantListings.map(l => l.id));

      try {
        await prismaV2.$transaction(async (tx) => {
          // Create Business
          await tx.business.create({
            data: {
              id: b.id,
              name: b.name,
              createdAt: b.createdAt,
              bannerUrl: b.bannerUrl,
              listingUrlPattern: b.listingUrlPattern,
              bestAutoApiKey: b.bestAutoApiKey,
              autovitClientId: b.autovitClientId,
              autovitClientSecret: b.autovitClientSecret,
              autovitUsername: b.autovitUsername,
              autovitPassword: b.autovitPassword
            }
          });

          // Create Users
          if (tenantUsers.length > 0) {
            await tx.user.createMany({
              data: tenantUsers.map(u => ({
                id: u.id,
                email: u.email,
                password: u.password,
                tokenVersion: u.tokenVersion,
                role: u.role,
                createdAt: u.createdAt,
                businessId: u.businessId
              }))
            });
          }

          // Create Listings & children
          for (const l of tenantListings) {
            const rawAttrs = listingAttrsMap[l.id] || {};
            const rawAttrTypes = listingAttrTypesMap[l.id] || {};
            const originalNames = listingOriginalNamesMap[l.id] || {};

            const rawListing = {
              id: l.id,
              businessId: l.businessId,
              price: l.price,
              mileage: l.mileage,
              youtubeVideoId: l.youtubeVideoId,
              autovitId: l.autovitId,
              status: l.status,
              purchasePrice: l.purchasePrice,
              sellingPrice: l.sellingPrice,
              otherCosts: l.otherCosts,
              soldAt: l.soldAt,
              internalNotes: l.internalNotes,
              slug: l.slug,
              title: l.title,
              description: l.description,
              attributes: rawAttrs,
              attributeTypes: rawAttrTypes,
              originalNames: originalNames
            };

            // Map v1 status to v2 ListingStatus
            let statusValue = l.status;
            const incomingFields = mappingsData.fieldSources['status.INCOMING'] || [];
            for (const f of incomingFields) {
              const normF = normalize(f);
              const val = rawAttrs[normF];
              if (val === true || normalize(val) === 'da' || normalize(val) === 'true') {
                statusValue = 'INCOMING';
              }
            }

            // Ensure statusValue is an allowed enum value
            if (statusValue !== 'SOLD' && statusValue !== 'INCOMING' && statusValue !== 'AVAILABLE' && statusValue !== 'RESERVED') {
              statusValue = 'AVAILABLE';
            }

            const transformedRecord = {
              id: l.id,
              businessId: l.businessId,
              createdAt: l.createdAt,
              updatedAt: l.updatedAt,
              status: statusValue,
              title: l.title,
              slug: l.slug,
              description: l.description,
              youtubeVideoId: l.youtubeVideoId,
              autovitId: l.autovitId !== null ? BigInt(l.autovitId.toString()) : null,
              autovitStatus: l.autovitStatus,

              makeId: null,
              modelId: null,
              variant: null,
              year: null,
              vin: null,
              firstRegistrationAt: null,
              countryOfOrigin: null,
              registeredInRo: null,
              mileage: l.mileage !== null ? l.mileage : null,
              fuelType: null,
              gearbox: null,
              drivetrain: null,
              bodyType: null,
              engineCapacity: null,
              powerHp: null,
              pollutionNorm: null,
              co2Emissions: null,
              color: null,
              colorDetail: null,
              upholstery: null,
              airConditioning: null,
              doors: null,
              seats: null,
              vatDeductible: null,
              noAccidents: null,
              serviceBook: null,
              firstOwner: null,
              ownerCount: null,
              warrantyMonths: null,
              price: l.price !== null ? l.price : null,
              purchasePrice: l.purchasePrice,
              sellingPrice: l.sellingPrice,
              otherCosts: l.otherCosts,
              soldAt: l.soldAt,
              internalNotes: l.internalNotes,
              extraSpecs: {}
            };

            const mappedAttributes = new Set();
            const featureSlugs = [];

            // Make & Model
            const rawMarca = rawAttrs['marca'];
            const rawModel = rawAttrs['model'];
            let makeSlugResolved = null;

            if (rawMarca) {
              const makeRes = mapMake(rawMarca);
              if (makeRes.value && makeSlugToId[makeRes.value]) {
                transformedRecord.makeId = makeSlugToId[makeRes.value];
                makeSlugResolved = makeRes.value;
                mappedAttributes.add('marca');
              }
            }

            if (!makeSlugResolved) {
              const makeFromTitleSlug = mapMakeFromTitle(l.title, dbMakes);
              if (makeFromTitleSlug && makeSlugToId[makeFromTitleSlug]) {
                transformedRecord.makeId = makeSlugToId[makeFromTitleSlug];
                makeSlugResolved = makeFromTitleSlug;
              }
            }

            if (rawModel) {
              if (makeSlugResolved) {
                const modelRes = mapModel(makeSlugResolved, rawModel, modelCache);
                if (modelRes.value) {
                  transformedRecord.modelId = modelRes.value.id;
                  mappedAttributes.add('model');
                }
              }
            }

            // Cross-Field Fixups
            crossFieldFixups(rawListing, transformedRecord, featureSlugs, mappedAttributes);

            // EAV Attribute mapping
            for (const [normName, rawVal] of Object.entries(rawAttrs)) {
              if (normName === 'marca' || normName === 'model') continue;
              if (mappedAttributes.has(normName)) continue;

              const attrType = rawAttrTypes[normName];
              const isBool = attrType === 'BOOLEAN' || typeof rawVal === 'boolean';
              if (isBool && !isBooleanTrue(rawVal)) continue;

              // Numeric
              const numericFields = ['year', 'engineCapacity', 'powerHp', 'doors', 'seats', 'co2Emissions', 'ownerCount'];
              let handledNumeric = false;
              for (const field of numericFields) {
                const sources = mappingsData.fieldSources[field] || [];
                const normSources = sources.map(normalize);
                if (normSources.includes(normName)) {
                  handledNumeric = true;
                  const res = mapNumeric(field, rawVal);
                  if (res.value !== null) {
                    transformedRecord[field] = res.value;
                    mappedAttributes.add(normName);
                  }
                }
              }
              if (handledNumeric) continue;

              // Fallbacks
              if (normName === 'pret') {
                const res = mapNumeric('price', rawVal);
                if (res.value !== null) {
                  if (transformedRecord.price === null) transformedRecord.price = res.value;
                  mappedAttributes.add(normName);
                }
                continue;
              }
              if (normName === 'kilometraj') {
                const res = mapNumeric('mileage', rawVal);
                if (res.value !== null) {
                  if (transformedRecord.mileage === null) transformedRecord.mileage = res.value;
                  mappedAttributes.add(normName);
                }
                continue;
              }

              // Enum
              let handledEnum = false;
              for (const concept of enumConcepts) {
                const sources = mappingsData.fieldSources[concept] || [];
                const normSources = sources.map(normalize);
                if (normSources.includes(normName)) {
                  handledEnum = true;
                  const res = mapEnum(concept, rawVal);
                  if (res.value !== null) {
                    transformedRecord[concept] = res.value;
                    mappedAttributes.add(normName);
                  }
                  if (concept === 'color' && rawVal) {
                    transformedRecord.colorDetail = rawVal.toString().trim();
                  }
                }
              }
              if (handledEnum) continue;

              // VIN
              if (['vin', 'serie sasiu (vin)', 'serie sasiu', 'serie vin'].includes(normName)) {
                if (rawVal) {
                  transformedRecord.vin = rawVal.toString().trim();
                  mappedAttributes.add(normName);
                }
                continue;
              }

              // Registration
              if (normName === 'prima inmatriculare') {
                if (rawVal) {
                  const parsedDate = new Date(rawVal);
                  if (!isNaN(parsedDate.getTime())) {
                    transformedRecord.firstRegistrationAt = parsedDate;
                    mappedAttributes.add(normName);
                  }
                }
                continue;
              }

              // Features
              const matched = mapFeatures(normName, rawVal, attrType);
              if (matched.length > 0) {
                for (const f of matched) {
                  if (!featureSlugs.includes(f)) featureSlugs.push(f);
                }
                mappedAttributes.add(normName);
              }
            }

            // Unmapped Attributes to extraSpecs
            for (const [normName, rawVal] of Object.entries(rawAttrs)) {
              if (normName === 'marca' || normName === 'model') continue;
              if (mappedAttributes.has(normName)) continue;

              const attrType = rawAttrTypes[normName];
              const isBool = attrType === 'BOOLEAN' || typeof rawVal === 'boolean';
              if (isBool && !isBooleanTrue(rawVal)) continue;
              if (rawVal === null || rawVal === undefined || rawVal === '') continue;

              const attrName = originalNames[normName] || normName;
              transformedRecord.extraSpecs[attrName] = rawVal;
            }

            // Filter to valid features
            const validFeatureSlugs = featureSlugs.filter(slug => featureSlugToId[slug]);
            const listingImages = imagesByListing[l.id] || [];

            await tx.listing.create({
              data: {
                ...transformedRecord,
                images: {
                  createMany: {
                    data: listingImages.map(img => ({
                      id: img.id,
                      url: img.url,
                      order: img.order
                    }))
                  }
                },
                features: {
                  connect: validFeatureSlugs.map(slug => ({ slug }))
                }
              }
            });
          }

          // Create Messages
          if (tenantMessages.length > 0) {
            await tx.message.createMany({
              data: tenantMessages.map(msg => ({
                id: msg.id,
                name: msg.name,
                email: msg.email,
                phone: msg.phone,
                message: msg.message,
                isRead: msg.isRead,
                createdAt: msg.createdAt,
                businessId: msg.businessId
              }))
            });
          }

          // Create Reviews
          if (tenantReviews.length > 0) {
            await tx.review.createMany({
              data: tenantReviews.map(rev => ({
                id: rev.id,
                name: rev.name,
                rating: rev.rating,
                text: rev.text,
                isApproved: rev.isApproved,
                createdAt: rev.createdAt,
                businessId: rev.businessId
              }))
            });
          }

          // Create Views
          if (tenantViews.length > 0) {
            await tx.view.createMany({
              data: tenantViews.map(view => ({
                id: view.id,
                viewedAt: view.viewedAt,
                businessId: view.businessId,
                listingId: view.listingId !== null && migratedListingIds.has(view.listingId) ? view.listingId : null
              }))
            });
          }
        }, {
          maxWait: 15000,
          timeout: 60000
        });

        // Increment Success totals
        const tenantUsersCount = (usersByBusiness[tenantId] || []).length;
        const tenantListingsCount = (listingsByBusiness[tenantId] || []).length;
        const tenantImagesCount = tenantListings.reduce((sum, l) => sum + (imagesByListing[l.id] || []).length, 0);
        const tenantMessagesCount = (messagesByBusiness[tenantId] || []).length;
        const tenantReviewsCount = (reviewsByBusiness[tenantId] || []).length;
        const tenantViewsCount = (viewsByBusiness[tenantId] || []).length;

        totals.businesses++;
        totals.users += tenantUsersCount;
        totals.listings += tenantListingsCount;
        totals.images += tenantImagesCount;
        totals.messages += tenantMessagesCount;
        totals.reviews += tenantReviewsCount;
        totals.views += tenantViewsCount;

        console.log(`  [OK] "${tenantName}": listings=${tenantListingsCount}, images=${tenantImagesCount}, users=${tenantUsersCount}, messages=${tenantMessagesCount}, reviews=${tenantReviewsCount}, views=${tenantViewsCount}`);
      } catch (err) {
        console.error(`  [FAIL] "${tenantName}":`, err.message);
        failures.push({ name: tenantName, businessId: tenantId, error: err.message });
      }
    }

    console.log('\n================================================');
    console.log('Migration Completed.');
    console.log(`Successfully migrated:`);
    console.log(`  Businesses: ${totals.businesses}`);
    console.log(`  Users:      ${totals.users}`);
    console.log(`  Listings:   ${totals.listings}`);
    console.log(`  Images:     ${totals.images}`);
    console.log(`  Messages:   ${totals.messages}`);
    console.log(`  Reviews:    ${totals.reviews}`);
    console.log(`  Views:      ${totals.views}`);

    if (failures.length > 0) {
      console.log('\nFailures:');
      for (const f of failures) {
        console.log(`  - Tenant: "${f.name}" (${f.businessId}) -> ${f.error}`);
      }
    } else {
      console.log('\nAll tenants migrated successfully with zero failures.');
    }

  } catch (err) {
    console.error('CRITICAL ERROR DURING MIGRATION:', err);
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
