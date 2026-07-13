const fs = require('fs');
const path = require('path');

// Load mappings once
const mappingsPath = path.join(__dirname, 'etl_value_mappings.json');
const mappingsData = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));

const CONCEPT_KEYS = {
  fuelType: ['PLUGIN_HYBRID', 'MILD_HYBRID', 'HYBRID', 'PETROL_LPG', 'DIESEL', 'PETROL', 'LPG', 'ELECTRIC'],
  gearbox: ['AUTOMATIC', 'MANUAL'],
  drivetrain: ['AWD', 'RWD', 'FWD'],
  bodyType: ['SUV', 'SEDAN', 'HATCHBACK', 'BREAK', 'MONOVOLUM', 'COUPE', 'CABRIO', 'VAN'],
  pollutionNorm: ['EURO_6D', 'EURO_6', 'EURO_5', 'EURO_4', 'EURO_3'],
  color: ['BLACK', 'GREY', 'BLUE', 'WHITE', 'RED', 'BROWN', 'SILVER', 'ORANGE', 'GREEN', 'PURPLE', 'GOLD', 'BEIGE', 'YELLOW'],
  upholstery: ['ALCANTARA', 'PARTIAL_LEATHER', 'LEATHER', 'VELOUR', 'FABRIC'],
  airConditioning: ['QUAD_ZONE', 'TRI_ZONE', 'DUAL_ZONE', 'AUTOMATIC', 'MANUAL'],
  countryOfOrigin: ['FR', 'DE', 'RO', 'IT', 'BE', 'FI']
};

function normalize(str) {
  if (str === null || str === undefined) return '';
  return str
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function isBooleanTrue(v) {
  if (v === true) return true;
  if (v === false || v === null || v === undefined) return false;
  const norm = normalize(v);
  return ['true', 't', 'da', 'yes', '1'].includes(norm);
}

function matchSynonym(targetStr, synonym) {
  if (synonym.startsWith('prefix:')) {
    return targetStr.startsWith(synonym.slice(7));
  } else if (synonym.startsWith('contains:')) {
    return targetStr.includes(synonym.slice(9));
  } else {
    return targetStr === synonym;
  }
}

function mapEnum(concept, rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return { value: null, unmapped: false };
  }
  const normVal = normalize(rawValue);
  const mappings = mappingsData.enumMappings[concept];
  if (!mappings) {
    return { value: null, unmapped: true };
  }

  const keys = CONCEPT_KEYS[concept] || Object.keys(mappings);

  for (const key of keys) {
    const patterns = mappings[key];
    if (!patterns) continue;

    const positivePatterns = patterns.filter(p => !p.startsWith('not:'));
    const negativePatterns = patterns.filter(p => p.startsWith('not:'));

    let positiveMatches = false;
    if (positivePatterns.length === 0) {
      positiveMatches = true;
    } else {
      positiveMatches = positivePatterns.some(p => {
        if (p.startsWith('contains:')) return normVal.includes(p.slice(9));
        if (p.startsWith('prefix:')) return normVal.startsWith(p.slice(7));
        return normVal === p;
      });
    }

    if (!positiveMatches) continue;

    const negativeMatches = negativePatterns.some(p => {
      const val = p.slice(4);
      return normVal.includes(val);
    });

    if (!negativeMatches) {
      return { value: key, unmapped: false };
    }
  }

  return { value: null, unmapped: true };
}

function mapNumeric(field, rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { value: null, rejected: false, unmapped: false };
  }
  let valStr = rawValue.toString().trim();
  const match = valStr.match(/^-?\d+(?:\.\d+)?/);
  if (!match) {
    return { value: null, rejected: false, unmapped: true };
  }
  const parsed = parseFloat(match[0]);
  const guard = mappingsData.numericGuards[field];
  if (!guard) {
    return { value: parsed, rejected: false, unmapped: false };
  }
  const [min, max] = guard;
  if (parsed >= min && parsed <= max) {
    return { value: Math.round(parsed), rejected: false, unmapped: false };
  } else {
    return { value: null, rejected: true, unmapped: false };
  }
}

function mapMake(raw) {
  if (raw === null || raw === undefined || raw === '') {
    return { value: null, unmapped: false };
  }
  const normalized = normalize(raw);
  const makeSlug = mappingsData.makeNormalization[normalized];
  if (makeSlug) {
    return { value: makeSlug, unmapped: false };
  }
  return { value: null, unmapped: true };
}

function mapModel(makeSlug, raw, modelCache) {
  if (raw === null || raw === undefined || raw === '') {
    return { value: null, unmapped: false };
  }
  if (!makeSlug || !modelCache) {
    return { value: null, unmapped: true };
  }
  const normalizedRaw = normalize(raw);
  const makeModels = modelCache[makeSlug];
  if (!makeModels) {
    return { value: null, unmapped: true };
  }

  if (makeModels.has(normalizedRaw)) {
    return { value: makeModels.get(normalizedRaw), unmapped: false };
  }

  const clean = cleanModelName(raw);
  const slug = slugify(clean);
  if (makeModels.has(slug)) {
    return { value: makeModels.get(slug), unmapped: false };
  }

  return { value: null, unmapped: true };
}

function cleanModelName(str) {
  if (!str) return '';
  let cleaned = str.replace(/\s+/g, ' ').trim();
  const hasLetters = /[a-zA-Z]/.test(cleaned);
  const isAllCaps = hasLetters && cleaned === cleaned.toUpperCase();
  if (isAllCaps) {
    cleaned = cleaned.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
  }
  return cleaned;
}

function slugify(str) {
  if (!str) return '';
  return str
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function mapFeatures(attrName, rawValue, attrType) {
  const isBool = attrType === 'BOOLEAN' || typeof rawValue === 'boolean';
  const normName = normalize(attrName);
  
  if (isBool) {
    if (!isBooleanTrue(rawValue)) {
      return [];
    }
    const matchedSlugs = [];
    const featureDictionary = mappingsData.featureDictionary || [];
    for (const feat of featureDictionary) {
      const { slug, synonyms } = feat;
      for (const syn of synonyms) {
        if (matchSynonym(normName, syn)) {
          matchedSlugs.push(slug);
          break;
        }
      }
    }
    return matchedSlugs;
  } else {
    const matchedSlugs = [];
    let isActive = false;
    let normVal = '';
    if (rawValue !== null && rawValue !== undefined) {
      normVal = normalize(rawValue);
      if (normVal === 'da' || normVal === 'true' || normVal === 't') {
        isActive = true;
      }
    }
    const featureDictionary = mappingsData.featureDictionary || [];
    for (const feat of featureDictionary) {
      const { slug, synonyms } = feat;
      for (const syn of synonyms) {
        if (isActive && matchSynonym(normName, syn)) {
          matchedSlugs.push(slug);
          break;
        }
        if (normVal && matchSynonym(normVal, syn)) {
          matchedSlugs.push(slug);
          break;
        }
      }
    }
    return matchedSlugs;
  }
}

function mapEnumFromBooleanAttrs(concept, rawAttrs, rawAttrTypes) {
  const sources = mappingsData.fieldSources[concept] || [];
  const candidates = [];
  for (const source of sources) {
    const normSource = normalize(source);
    if (normSource in rawAttrs) {
      const val = rawAttrs[normSource];
      const type = rawAttrTypes ? rawAttrTypes[normSource] : undefined;
      const isBool = type === 'BOOLEAN' || typeof val === 'boolean';
      if (isBool && isBooleanTrue(val)) {
        const res = mapEnum(concept, source); // use name as key
        if (res.value !== null) {
          candidates.push(res.value);
        }
      }
    }
  }
  if (candidates.length === 0) {
    return { value: null, unmapped: false };
  }
  // Find the best candidate based on CONCEPT_KEYS priority
  const keys = CONCEPT_KEYS[concept] || [];
  let bestCandidate = null;
  let bestIdx = Infinity;
  for (const cand of candidates) {
    const idx = keys.indexOf(cand);
    if (idx !== -1 && idx < bestIdx) {
      bestIdx = idx;
      bestCandidate = cand;
    }
  }
  if (bestCandidate !== null) {
    return { value: bestCandidate, unmapped: false };
  }
  return { value: candidates[0], unmapped: false };
}

function matchesWithWordBoundary(normTitle, normTerm) {
  let idx = normTitle.indexOf(normTerm);
  while (idx !== -1) {
    const charBefore = idx > 0 ? normTitle[idx - 1] : ' ';
    const charAfter = idx + normTerm.length < normTitle.length ? normTitle[idx + normTerm.length] : ' ';
    const isBeforeAlphaNum = /[a-z0-9]/.test(charBefore);
    const isAfterAlphaNum = /[a-z0-9]/.test(charAfter);
    if (!isBeforeAlphaNum && !isAfterAlphaNum) {
      return true;
    }
    idx = normTitle.indexOf(normTerm, idx + 1);
  }
  return false;
}

function mapMakeFromTitle(title, dbMakes) {
  if (!title || !dbMakes) return null;
  const normTitle = normalize(title);
  
  const candidates = [];
  // Add database makes (names and slugs)
  for (const m of dbMakes) {
    if (m.name) candidates.push({ text: m.name, slug: m.slug });
    if (m.slug) candidates.push({ text: m.slug, slug: m.slug });
  }
  
  // Add aliases
  const aliases = mappingsData.titleMakeAliases || {};
  for (const [alias, targetSlug] of Object.entries(aliases)) {
    candidates.push({ text: alias, slug: targetSlug });
  }
  
  // Normalize and filter duplicates / empty
  const uniqueCandidates = [];
  const seen = new Set();
  for (const cand of candidates) {
    const normText = normalize(cand.text);
    if (!normText) continue;
    const key = normText + '::' + cand.slug;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueCandidates.push({ normText, slug: cand.slug });
    }
  }
  
  // Sort by normText length descending
  uniqueCandidates.sort((a, b) => b.normText.length - a.normText.length);
  
  // Match with word boundary check
  for (const cand of uniqueCandidates) {
    if (matchesWithWordBoundary(normTitle, cand.normText)) {
      return cand.slug;
    }
  }
  
  return null;
}

function crossFieldFixups(rawListing, transformedRecord, featureSlugs, mappedAttributes) {
  const reconciliationLogs = [];
  const localMappedAttrs = mappedAttributes || new Set();

  // Rule 1: transmisie -> drivetrain if value matches drivetrain
  const transmisieRaw = rawListing.attributes['transmisie'];
  if (transmisieRaw) {
    const dtMapped = mapEnum('drivetrain', transmisieRaw).value;
    if (dtMapped) {
      transformedRecord.drivetrain = dtMapped;
    }
  }

  // Generalized Boolean concepts routing (airConditioning, drivetrain, gearbox)
  const concepts = ['airConditioning', 'drivetrain', 'gearbox'];
  for (const concept of concepts) {
    const res = mapEnumFromBooleanAttrs(concept, rawListing.attributes, rawListing.attributeTypes);
    if (res.value !== null) {
      const keys = CONCEPT_KEYS[concept] || [];
      const currentIdx = keys.indexOf(transformedRecord[concept]);
      const newIdx = keys.indexOf(res.value);
      if (transformedRecord[concept] === null || (newIdx !== -1 && newIdx < currentIdx)) {
        transformedRecord[concept] = res.value;
      }
    }
    // Mark the contributing boolean attributes as mapped
    const sources = mappingsData.fieldSources[concept] || [];
    for (const source of sources) {
      const normSource = normalize(source);
      if (normSource in rawListing.attributes) {
        const val = rawListing.attributes[normSource];
        const type = rawListing.attributeTypes ? rawListing.attributeTypes[normSource] : undefined;
        const isBool = type === 'BOOLEAN' || typeof val === 'boolean';
        if (isBool) {
          localMappedAttrs.add(normSource);
        }
      }
    }
  }

  // Rule 3, 4, 5: Senzori parcare STRING
  const senzoriRaw = rawListing.attributes['senzori parcare'];
  if (senzoriRaw && typeof senzoriRaw === 'string') {
    const normSenzori = normalize(senzoriRaw);
    if (normSenzori.includes('fata') && normSenzori.includes('spate')) {
      if (!featureSlugs.includes('senzori-parcare-fata')) featureSlugs.push('senzori-parcare-fata');
      if (!featureSlugs.includes('senzori-parcare-spate')) featureSlugs.push('senzori-parcare-spate');
    }
    if (normSenzori.includes('360')) {
      if (!featureSlugs.includes('camera-360')) featureSlugs.push('camera-360');
    } else if (normSenzori.includes('camera') || normSenzori.includes('marsarier')) {
      if (!featureSlugs.includes('camera-marsarier')) featureSlugs.push('camera-marsarier');
    }
    if (normSenzori === 'da' || normSenzori === 'true' || normSenzori === 't') {
      if (!featureSlugs.includes('senzori-parcare')) featureSlugs.push('senzori-parcare');
    }
  }

  // Rule 6: pilot automat STRING 'da'
  const pilotRaw = rawListing.attributes['pilot automat'];
  if (pilotRaw && typeof pilotRaw === 'string') {
    const normPilot = normalize(pilotRaw);
    if (normPilot === 'da' || normPilot === 'true' || normPilot === 't') {
      if (!featureSlugs.includes('pilot-automat')) featureSlugs.push('pilot-automat');
    }
  }

  // Generic Rule: Boolean fixed fields mapping
  const booleanFields = ['vatDeductible', 'noAccidents', 'serviceBook', 'firstOwner', 'registeredInRo'];
  for (const field of booleanFields) {
    const sources = mappingsData.fieldSources[field] || [];
    let hasAnySource = false;
    let fieldVal = false;
    for (const source of sources) {
      const normSource = normalize(source);
      if (normSource in rawListing.attributes) {
        hasAnySource = true;
        const val = rawListing.attributes[normSource];
        if (isBooleanTrue(val)) {
          fieldVal = true;
        }
        localMappedAttrs.add(normSource);
      }
    }
    if (hasAnySource) {
      transformedRecord[field] = fieldVal;
    }
  }

  // Rule 8, 9: Upholstery boolean attributes
  if (transformedRecord.upholstery === null) {
    const leatherAttrs = ['tapiterie piele', 'interior piele', 'interior din piele', 'scaune piele'];
    const isLeather = leatherAttrs.some(attr => isBooleanTrue(rawListing.attributes[normalize(attr)]));
    if (isLeather) {
      transformedRecord.upholstery = 'LEATHER';
      for (const attr of leatherAttrs) {
        const norm = normalize(attr);
        if (norm in rawListing.attributes) localMappedAttrs.add(norm);
      }
    } else {
      const alcantaraAttrs = ['tapiterie alcantara'];
      const isAlcantara = alcantaraAttrs.some(attr => isBooleanTrue(rawListing.attributes[normalize(attr)]));
      if (isAlcantara) {
        transformedRecord.upholstery = 'ALCANTARA';
        for (const attr of alcantaraAttrs) {
          const norm = normalize(attr);
          if (norm in rawListing.attributes) localMappedAttrs.add(norm);
        }
      } else {
        const fabricAttrs = ['tapiterie stofa', 'tapiterie panza', 'interior stofa'];
        const isFabric = fabricAttrs.some(attr => isBooleanTrue(rawListing.attributes[normalize(attr)]));
        if (isFabric) {
          transformedRecord.upholstery = 'FABRIC';
          for (const attr of fabricAttrs) {
            const norm = normalize(attr);
            if (norm in rawListing.attributes) localMappedAttrs.add(norm);
          }
        } else {
          const partialAttrs = ['tapiterie mixta', 'tapiterie partiala piele', 'interior partial piele'];
          const isPartial = partialAttrs.some(attr => isBooleanTrue(rawListing.attributes[normalize(attr)]));
          if (isPartial) {
            transformedRecord.upholstery = 'PARTIAL_LEATHER';
            for (const attr of partialAttrs) {
              const norm = normalize(attr);
              if (norm in rawListing.attributes) localMappedAttrs.add(norm);
            }
          }
        }
      }
    }
  }

  // Rule 10: garantie BOOLEAN vs NUMBER
  const garantieFields = mappingsData.fieldSources.warrantyMonths;
  for (const field of garantieFields) {
    const normField = normalize(field);
    if (!(normField in rawListing.attributes)) continue;
    const val = rawListing.attributes[normField];
    const type = rawListing.attributeTypes ? rawListing.attributeTypes[normField] : undefined;
    const isBool = type === 'BOOLEAN' || typeof val === 'boolean';
    
    if (isBool) {
      if (isBooleanTrue(val)) {
        if (!featureSlugs.includes('garantie-inclusa')) {
          featureSlugs.push('garantie-inclusa');
        }
      }
      localMappedAttrs.add(normField);
    } else {
      if (isBooleanTrue(val)) {
        if (!featureSlugs.includes('garantie-inclusa')) {
          featureSlugs.push('garantie-inclusa');
        }
        localMappedAttrs.add(normField);
      } else {
        const numericRes = mapNumeric('warrantyMonths', val);
        if (numericRes.value !== null) {
          transformedRecord.warrantyMonths = numericRes.value;
          if (!featureSlugs.includes('garantie-inclusa')) {
            featureSlugs.push('garantie-inclusa');
          }
          localMappedAttrs.add(normField);
        }
      }
    }
  }

  // Rule 11: price fix vs EAV pret reconciliation
  const eavPretRaw = rawListing.attributes['pret'] || rawListing.attributes['preț'];
  if (eavPretRaw && rawListing.price !== null) {
    const eavPretNumRes = mapNumeric('price', eavPretRaw);
    if (eavPretNumRes.value !== null && Math.abs(eavPretNumRes.value - rawListing.price) > 0.01) {
      reconciliationLogs.push({
        listingId: rawListing.id,
        fixedPrice: rawListing.price,
        eavPrice: eavPretNumRes.value
      });
    }
  }

  return { reconciliationLogs };
}

module.exports = {
  normalize,
  isBooleanTrue,
  mapEnum,
  mapNumeric,
  mapMake,
  mapModel,
  mapFeatures,
  mapEnumFromBooleanAttrs,
  mapMakeFromTitle,
  crossFieldFixups,
  cleanModelName,
  slugify,
  mappingsData
};
