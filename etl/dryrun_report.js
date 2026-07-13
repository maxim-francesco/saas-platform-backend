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

const DRY_RUN = true;

async function main() {
  console.log('Starting ETL Dry-Run Report...');

  if (!DRY_RUN) {
    console.error('CRITICAL ERROR: DRY_RUN is false! This script must run in DRY_RUN mode.');
    process.exit(1);
  }

  // 1. Initialize DB clients
  const prismaClone = new PrismaClient({
    datasources: { db: { url: process.env.SOURCE_DATABASE_URL } }
  });
  const prismaV2 = new PrismaClient();

  // 2. Load Makes and Models cache from saasv2
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
  console.log(`Loaded ${dbMakes.length} makes and ${dbModels.length} models into cache.`);

  // 3. Fetch Whitelisted Business IDs
  const whitelistedBusinessIds = mappingsData.tenantWhitelist.map(t => t.businessId);
  const tenantIdToName = {};
  for (const t of mappingsData.tenantWhitelist) {
    tenantIdToName[t.businessId] = t.name;
  }

  // 4. Fetch EAV data from saasclone
  console.log('Fetching listings from saasclone...');
  const listingsQuery = `
    SELECT * FROM "Listing"
    WHERE "businessId" IN (${whitelistedBusinessIds.map(id => `'${id}'`).join(',')})
  `;
  const dbListings = await prismaClone.$queryRawUnsafe(listingsQuery);
  console.log(`Loaded ${dbListings.length} listings from saasclone.`);

  console.log('Fetching EAV attributes from saasclone...');
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
    WHERE l."businessId" IN (${whitelistedBusinessIds.map(id => `'${id}'`).join(',')})
  `;
  const dbAttrs = await prismaClone.$queryRawUnsafe(attrsQuery);
  console.log(`Loaded ${dbAttrs.length} EAV attribute value rows.`);

  // Group attributes by listingId with normalized keys and a separate originalNames map
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

  // Initialize stats
  const stats = {
    totalProcessed: 0,
    processedPerTenant: {},
    fixedFieldCoverage: {
      year: 0,
      fuelType: 0,
      gearbox: 0,
      drivetrain: 0,
      bodyType: 0,
      pollutionNorm: 0,
      color: 0,
      mileage: 0,
      price: 0,
      powerHp: 0,
      engineCapacity: 0,
      vin: 0,
      doors: 0,
      seats: 0,
      vatDeductible: 0,
      noAccidents: 0,
      serviceBook: 0,
      firstOwner: 0,
      ownerCount: 0,
      warrantyMonths: 0,
      countryOfOrigin: 0,
      firstRegistrationAt: 0,
      registeredInRo: 0
    },
    enumStats: {},
    numericRejections: {},
    makeResolution: {
      resolved: 0,
      resolvedEav: 0,
      resolvedTitle: 0,
      unresolved: 0,
      unresolvedRaws: {}
    },
    modelResolution: {
      resolved: 0,
      unresolved: 0,
      unresolvedRaws: {}
    },
    extraSpecsCount: 0,
    extraSpecsAttrs: {},
    featureLinksCreated: 0,
    featuresUnmatchedAttrs: {}
  };

  const enumConcepts = ['fuelType', 'gearbox', 'drivetrain', 'bodyType', 'pollutionNorm', 'color', 'upholstery', 'airConditioning', 'countryOfOrigin'];
  for (const concept of enumConcepts) {
    stats.enumStats[concept] = { mapped: 0, unmapped: 0, unmappedRaws: {} };
  }

  const allReconciliationLogs = [];

  // 5. In-Memory ETL Loop
  for (const l of dbListings) {
    const rawAttrs = listingAttrsMap[l.id] || {};
    const rawAttrTypes = listingAttrTypesMap[l.id] || {};
    const originalNames = listingOriginalNamesMap[l.id] || {};
    
    // Construct rawListing object
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

    // Determine status.INCOMING
    let statusValue = l.status;
    const incomingFields = mappingsData.fieldSources['status.INCOMING'] || [];
    for (const f of incomingFields) {
      const normF = normalize(f);
      const val = rawAttrs[normF];
      if (val === true || normalize(val) === 'da' || normalize(val) === 'true') {
        statusValue = 'INCOMING';
      }
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
      autovitId: typeof l.autovitId === 'bigint' ? l.autovitId.toString() : l.autovitId,
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

    // Make & Model resolution from EAV
    const rawMarca = rawAttrs['marca'];
    const rawModel = rawAttrs['model'];
    let makeSlugResolved = null;

    if (rawMarca) {
      const makeRes = mapMake(rawMarca);
      if (makeRes.value && makeSlugToId[makeRes.value]) {
        transformedRecord.makeId = makeSlugToId[makeRes.value];
        makeSlugResolved = makeRes.value;
        mappedAttributes.add('marca');
        stats.makeResolution.resolved++;
        stats.makeResolution.resolvedEav = (stats.makeResolution.resolvedEav || 0) + 1;
      } else {
        stats.makeResolution.unresolved++;
        const originalMarca = originalNames['marca'] || rawMarca;
        stats.makeResolution.unresolvedRaws[originalMarca] = (stats.makeResolution.unresolvedRaws[originalMarca] || 0) + 1;
      }
    }

    if (!makeSlugResolved) {
      // Fallback to title matching
      const makeFromTitleSlug = mapMakeFromTitle(l.title, dbMakes);
      if (makeFromTitleSlug && makeSlugToId[makeFromTitleSlug]) {
        transformedRecord.makeId = makeSlugToId[makeFromTitleSlug];
        makeSlugResolved = makeFromTitleSlug;
        stats.makeResolution.resolved++;
        stats.makeResolution.resolvedTitle = (stats.makeResolution.resolvedTitle || 0) + 1;
      }
    }

    if (rawModel) {
      if (makeSlugResolved) {
        const modelRes = mapModel(makeSlugResolved, rawModel, modelCache);
        if (modelRes.value) {
          transformedRecord.modelId = modelRes.value.id;
          mappedAttributes.add('model');
          stats.modelResolution.resolved++;
        } else {
          stats.modelResolution.unresolved++;
          const originalModel = originalNames['model'] || rawModel;
          stats.modelResolution.unresolvedRaws[originalModel] = (stats.modelResolution.unresolvedRaws[originalModel] || 0) + 1;
        }
      } else {
        stats.modelResolution.unresolved++;
        const originalModel = originalNames['model'] || rawModel;
        stats.modelResolution.unresolvedRaws[originalModel] = (stats.modelResolution.unresolvedRaws[originalModel] || 0) + 1;
      }
    }

    // Run Cross-Field Fixups BEFORE the main EAV loop to handle complex and boolean assignments
    const { reconciliationLogs } = crossFieldFixups(rawListing, transformedRecord, featureSlugs, mappedAttributes);
    if (reconciliationLogs.length > 0) {
      allReconciliationLogs.push(...reconciliationLogs);
    }

    // Accumulate enum stats for boolean-to-enum concept drivers mapped in crossFieldFixups
    const booleanEnumConcepts = ['airConditioning', 'drivetrain', 'gearbox'];
    for (const concept of booleanEnumConcepts) {
      const sources = mappingsData.fieldSources[concept] || [];
      for (const source of sources) {
        const normSource = normalize(source);
        if (normSource in rawAttrs) {
          const val = rawAttrs[normSource];
          const type = rawAttrTypes[normSource];
          const isBool = type === 'BOOLEAN' || typeof val === 'boolean';
          if (isBool && isBooleanTrue(val)) {
            stats.enumStats[concept].mapped++;
          }
        }
      }
    }

    // Process EAV attributes
    for (const [normName, rawVal] of Object.entries(rawAttrs)) {
      if (normName === 'marca' || normName === 'model') {
        continue;
      }

      if (mappedAttributes.has(normName)) {
        continue;
      }

      // Skip false boolean values entirely
      const attrType = rawAttrTypes[normName];
      const isBool = attrType === 'BOOLEAN' || typeof rawVal === 'boolean';
      if (isBool && !isBooleanTrue(rawVal)) {
        continue;
      }

      // Try mapping to fixed numeric fields
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
          } else if (res.rejected) {
            if (!stats.numericRejections[field]) stats.numericRejections[field] = {};
            stats.numericRejections[field][rawVal] = (stats.numericRejections[field][rawVal] || 0) + 1;
          }
        }
      }

      if (handledNumeric) continue;

      // Handle price/mileage fallback if they are null
      if (normName === 'pret') {
        const res = mapNumeric('price', rawVal);
        if (res.value !== null) {
          if (transformedRecord.price === null) {
            transformedRecord.price = res.value;
          }
          mappedAttributes.add(normName);
        } else if (res.rejected) {
          if (!stats.numericRejections['price']) stats.numericRejections['price'] = {};
          stats.numericRejections['price'][rawVal] = (stats.numericRejections['price'][rawVal] || 0) + 1;
        }
        continue;
      }
      if (normName === 'kilometraj') {
        const res = mapNumeric('mileage', rawVal);
        if (res.value !== null) {
          if (transformedRecord.mileage === null) {
            transformedRecord.mileage = res.value;
          }
          mappedAttributes.add(normName);
        } else if (res.rejected) {
          if (!stats.numericRejections['mileage']) stats.numericRejections['mileage'] = {};
          stats.numericRejections['mileage'][rawVal] = (stats.numericRejections['mileage'][rawVal] || 0) + 1;
        }
        continue;
      }

      // Try mapping to enum fields
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
            stats.enumStats[concept].mapped++;
          } else if (res.unmapped) {
            stats.enumStats[concept].unmapped++;
            stats.enumStats[concept].unmappedRaws[rawVal] = (stats.enumStats[concept].unmappedRaws[rawVal] || 0) + 1;
          }
          if (concept === 'color' && rawVal) {
            transformedRecord.colorDetail = rawVal.toString().trim();
          }
        }
      }

      if (handledEnum) continue;

      if (['vin', 'serie sasiu (vin)', 'serie sasiu', 'serie vin'].includes(normName)) {
        if (rawVal) {
          transformedRecord.vin = rawVal.toString().trim();
          mappedAttributes.add(normName);
        }
        continue;
      }
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

      // Feature matching
      const matched = mapFeatures(normName, rawVal, attrType);
      if (matched.length > 0) {
        for (const f of matched) {
          if (!featureSlugs.includes(f)) featureSlugs.push(f);
        }
        mappedAttributes.add(normName);
      }
    }

    // Populate extraSpecs for unmapped attributes
    for (const [normName, rawVal] of Object.entries(rawAttrs)) {
      if (normName === 'marca' || normName === 'model') {
        continue;
      }

      if (mappedAttributes.has(normName)) {
        continue;
      }

      // Skip false boolean values and empty/null values
      const attrType = rawAttrTypes[normName];
      const isBool = attrType === 'BOOLEAN' || typeof rawVal === 'boolean';
      if (isBool && !isBooleanTrue(rawVal)) {
        continue;
      }
      if (rawVal === null || rawVal === undefined || rawVal === '') {
        continue;
      }

      const attrName = originalNames[normName] || normName;

      // Check if it's explicitly routed to extraSpecs
      const explicitExtra = mappingsData.fieldSources['extraSpecs.explicit'] || [];
      const normExplicitExtra = explicitExtra.map(normalize);
      if (normExplicitExtra.includes(normName)) {
        transformedRecord.extraSpecs[attrName] = rawVal;
      } else {
        // Unmapped attribute
        transformedRecord.extraSpecs[attrName] = rawVal;
        stats.extraSpecsAttrs[attrName] = (stats.extraSpecsAttrs[attrName] || 0) + 1;

        // If it looks active, log as featuresUnmatchedAttrs
        if (rawVal === true || normalize(rawVal) === 'da' || normalize(rawVal) === 'true' || normalize(rawVal) === 't') {
          stats.featuresUnmatchedAttrs[attrName] = (stats.featuresUnmatchedAttrs[attrName] || 0) + 1;
        }
      }
    }

    // Update stats for this listing
    const tenantName = tenantIdToName[l.businessId] || l.businessId;
    stats.processedPerTenant[tenantName] = (stats.processedPerTenant[tenantName] || 0) + 1;
    stats.totalProcessed++;

    // Calculate fixed field coverage
    for (const field of Object.keys(stats.fixedFieldCoverage)) {
      if (transformedRecord[field] !== null && transformedRecord[field] !== undefined) {
        stats.fixedFieldCoverage[field]++;
      }
    }

    if (Object.keys(transformedRecord.extraSpecs).length > 0) {
      stats.extraSpecsCount++;
    }

    stats.featureLinksCreated += featureSlugs.length;
  }

  // 6. Generate Reports
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportsDir = path.join(__dirname, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, `dryrun_${timestamp}.md`);

  let mdContent = `# ETL Dry-Run Report\n\n`;
  mdContent += `Generated: ${new Date().toLocaleString()}\n`;
  mdContent += `DRY_RUN: ${DRY_RUN}\n\n`;

  mdContent += `## Executive Summary\n`;
  mdContent += `- **Total Listings Processed**: ${stats.totalProcessed}\n`;
  mdContent += `- **Database Writes Executed**: None (DRY-RUN mode only)\n\n`;

  mdContent += `## Processing Counts per Tenant (Business)\n`;
  mdContent += `| Tenant Name | Listings Processed |\n`;
  mdContent += `| :--- | :--- |\n`;
  for (const [tenantName, count] of Object.entries(stats.processedPerTenant)) {
    mdContent += `| ${tenantName} | ${count} |\n`;
  }
  mdContent += `\n`;

  mdContent += `## Fixed Field Mapping Coverage\n`;
  mdContent += `| Field Name | Mapped Count | Coverage % |\n`;
  mdContent += `| :--- | :--- | :--- |\n`;
  for (const [field, count] of Object.entries(stats.fixedFieldCoverage)) {
    const percentage = ((count / stats.totalProcessed) * 100).toFixed(2);
    mdContent += `| ${field} | ${count} | ${percentage}% |\n`;
  }
  mdContent += `\n`;

  mdContent += `## Make & Model Resolution Stats\n`;
  mdContent += `- **Makes**: Resolved: ${stats.makeResolution.resolved} (EAV: ${stats.makeResolution.resolvedEav || 0}, Title: ${stats.makeResolution.resolvedTitle || 0}), Unresolved: ${stats.makeResolution.unresolved}\n`;
  mdContent += `- **Models**: Resolved: ${stats.modelResolution.resolved}, Unresolved: ${stats.modelResolution.unresolved}\n\n`;

  if (Object.keys(stats.makeResolution.unresolvedRaws).length > 0) {
    mdContent += `### Unresolved Makes with Counts\n`;
    mdContent += `| Raw Make Value | Count |\n`;
    mdContent += `| :--- | :--- |\n`;
    for (const [raw, count] of Object.entries(stats.makeResolution.unresolvedRaws)) {
      mdContent += `| ${raw} | ${count} |\n`;
    }
    mdContent += `\n`;
  }

  if (Object.keys(stats.modelResolution.unresolvedRaws).length > 0) {
    mdContent += `### Top Unresolved Models with Counts (Max 50)\n`;
    mdContent += `| Raw Model Value | Count |\n`;
    mdContent += `| :--- | :--- |\n`;
    const sortedUnresolvedModels = Object.entries(stats.modelResolution.unresolvedRaws)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50);
    for (const [raw, count] of sortedUnresolvedModels) {
      mdContent += `| ${raw} | ${count} |\n`;
    }
    mdContent += `\n`;
  }

  mdContent += `## Enum Mapping Stats\n`;
  mdContent += `| Enum Concept | Mapped | Unmapped | Total |\n`;
  mdContent += `| :--- | :--- | :--- | :--- |\n`;
  for (const [concept, s] of Object.entries(stats.enumStats)) {
    const total = s.mapped + s.unmapped;
    mdContent += `| ${concept} | ${s.mapped} | ${s.unmapped} | ${total} |\n`;
  }
  mdContent += `\n`;

  mdContent += `### Complete List of Unmapped Enum Raw Values\n`;
  for (const concept of enumConcepts) {
    const s = stats.enumStats[concept];
    const unmappedEntries = Object.entries(s.unmappedRaws).sort((a, b) => b[1] - a[1]);
    if (unmappedEntries.length > 0) {
      mdContent += `#### Unmapped \`${concept}\` values:\n`;
      mdContent += `| Raw Value | Count |\n`;
      mdContent += `| :--- | :--- |\n`;
      for (const [raw, count] of unmappedEntries) {
        mdContent += `| ${raw} | ${count} |\n`;
      }
      mdContent += `\n`;
    }
  }

  mdContent += `## Numeric Guard Rejections\n`;
  let hasRejections = false;
  for (const [field, raws] of Object.entries(stats.numericRejections)) {
    const entries = Object.entries(raws);
    if (entries.length > 0) {
      hasRejections = true;
      mdContent += `### Rejected values for field \`${field}\`:\n`;
      mdContent += `| Raw Value | Rejection Count |\n`;
      mdContent += `| :--- | :--- |\n`;
      for (const [raw, count] of entries) {
        mdContent += `| ${raw} | ${count} |\n`;
      }
      mdContent += `\n`;
    }
  }
  if (!hasRejections) {
    mdContent += `No numeric values were rejected by guards.\n\n`;
  }

  mdContent += `## Extra Specs Analysis\n`;
  mdContent += `- Listings with non-empty \`extraSpecs\`: ${stats.extraSpecsCount} (${((stats.extraSpecsCount / stats.totalProcessed) * 100).toFixed(2)}%)\n\n`;

  mdContent += `### Top 30 Attributes Landing in Extra Specs\n`;
  mdContent += `| Attribute Name | Occurrences |\n`;
  mdContent += `| :--- | :--- |\n`;
  const sortedExtraSpecsAttrs = Object.entries(stats.extraSpecsAttrs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);
  for (const [attrName, count] of sortedExtraSpecsAttrs) {
    mdContent += `| ${attrName} | ${count} |\n`;
  }
  mdContent += `\n`;

  mdContent += `## Feature Mapping Analysis\n`;
  mdContent += `- Total feature links that would be created: ${stats.featureLinksCreated}\n\n`;

  mdContent += `### Active Attributes Not Mapped to Features\n`;
  mdContent += `| Attribute Name | Occurrences |\n`;
  mdContent += `| :--- | :--- |\n`;
  const sortedUnmatchedFeats = Object.entries(stats.featuresUnmatchedAttrs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);
  for (const [attrName, count] of sortedUnmatchedFeats) {
    mdContent += `| ${attrName} | ${count} |\n`;
  }
  mdContent += `\n`;

  mdContent += `## Price Reconciliation Logs\n`;
  mdContent += `Listings where fixed price and EAV price differed (fixed price wins):\n\n`;
  if (allReconciliationLogs.length > 0) {
    mdContent += `| Listing ID | Fixed Price | EAV Price | Difference |\n`;
    mdContent += `| :--- | :--- | :--- | :--- |\n`;
    for (const log of allReconciliationLogs) {
      const diff = Math.abs(log.fixedPrice - log.eavPrice);
      mdContent += `| ${log.listingId} | ${log.fixedPrice} | ${log.eavPrice} | ${diff.toFixed(2)} |\n`;
    }
  } else {
    mdContent += `No price discrepancies found.\n`;
  }
  mdContent += `\n`;

  fs.writeFileSync(reportPath, mdContent, 'utf8');
  console.log(`Report successfully written to: ${reportPath}`);

  // Print Summary to Stdout
  console.log('\n================================================================================');
  console.log('                            ETL DRY-RUN SUMMARY REPORT');
  console.log('================================================================================');
  console.log(`Total Listings Processed: ${stats.totalProcessed}`);
  console.log('Listings Processed per Tenant:');
  for (const [tenantName, count] of Object.entries(stats.processedPerTenant)) {
    console.log(`  - ${tenantName.padEnd(28)}: ${count}`);
  }
  console.log('\nFixed Field Coverage:');
  for (const [field, count] of Object.entries(stats.fixedFieldCoverage)) {
    const percentage = ((count / stats.totalProcessed) * 100).toFixed(1);
    console.log(`  - ${field.padEnd(20)}: ${String(count).padStart(4)} / ${stats.totalProcessed} (${percentage}%)`);
  }
  console.log('\nMake/Model Resolution:');
  console.log(`  - Makes resolved  : ${stats.makeResolution.resolved} (EAV: ${stats.makeResolution.resolvedEav || 0}, Title: ${stats.makeResolution.resolvedTitle || 0}) / Unresolved: ${stats.makeResolution.unresolved}`);
  console.log(`  - Models resolved : ${stats.modelResolution.resolved} / Unresolved: ${stats.modelResolution.unresolved}`);
  
  if (Object.keys(stats.makeResolution.unresolvedRaws).length > 0) {
    console.log('  - Unresolved Makes:', stats.makeResolution.unresolvedRaws);
  }
  if (Object.keys(stats.modelResolution.unresolvedRaws).length > 0) {
    console.log('  - Top Unresolved Models (raws):', Object.entries(stats.modelResolution.unresolvedRaws).sort((a,b)=>b[1]-a[1]).slice(0, 10));
  }

  console.log('\nEnum Mappings:');
  for (const [concept, s] of Object.entries(stats.enumStats)) {
    console.log(`  - ${concept.padEnd(20)}: Mapped: ${s.mapped} | Unmapped: ${s.unmapped}`);
  }

  console.log('\nComplete List of Unmapped Enum Raw Values:');
  let hasAnyUnmappedEnum = false;
  for (const concept of enumConcepts) {
    const s = stats.enumStats[concept];
    const unmappedEntries = Object.entries(s.unmappedRaws).sort((a, b) => b[1] - a[1]);
    if (unmappedEntries.length > 0) {
      hasAnyUnmappedEnum = true;
      console.log(`  * Concept: ${concept}`);
      for (const [raw, count] of unmappedEntries) {
        console.log(`    - "${raw}" (${count} times)`);
      }
    }
  }
  if (!hasAnyUnmappedEnum) {
    console.log('  (None)');
  }

  console.log('\nNumeric Guard Rejections:');
  let hasAnyRejections = false;
  for (const [field, raws] of Object.entries(stats.numericRejections)) {
    const entries = Object.entries(raws);
    if (entries.length > 0) {
      hasAnyRejections = true;
      console.log(`  * Field: ${field}`);
      for (const [raw, count] of entries) {
        console.log(`    - "${raw}" (${count} rejections)`);
      }
    }
  }
  if (!hasAnyRejections) {
    console.log('  (None)');
  }

  console.log(`\nExtra Specs:`);
  console.log(`  - Listings carrying extraSpecs: ${stats.extraSpecsCount} (${((stats.extraSpecsCount / stats.totalProcessed) * 100).toFixed(1)}%)`);
  console.log(`  - Top 5 Attributes Landing in Extra Specs:`);
  const top5Extra = Object.entries(stats.extraSpecsAttrs).sort((a, b) => b[1] - a[1]).slice(0, 5);
  for (const [attrName, count] of top5Extra) {
    console.log(`    - "${attrName}": ${count}`);
  }

  console.log(`\nFeatures:`);
  console.log(`  - Total Feature Links: ${stats.featureLinksCreated}`);
  console.log(`  - Top 5 Unmatched Active Attributes:`);
  const top5UnmatchedFeat = Object.entries(stats.featuresUnmatchedAttrs).sort((a, b) => b[1] - a[1]).slice(0, 5);
  for (const [attrName, count] of top5UnmatchedFeat) {
    console.log(`    - "${attrName}": ${count}`);
  }

  console.log('\n================================================================================');
  console.log('DRY-RUN ONLY — no rows written.');
  console.log('================================================================================');

  await prismaClone.$disconnect();
  await prismaV2.$disconnect();
}

main().catch((e) => {
  console.error('Error during dry-run report:', e);
  process.exit(1);
});
