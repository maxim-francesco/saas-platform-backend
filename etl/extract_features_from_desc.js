// etl/extract_features_from_desc.js
// PURPOSE: Extract equipment features from a listing's free-text description and
// connect them (m2m) in saas_new. Strict word-boundary matching against the existing
// featureDictionary (no new slugs). DRY_RUN by default; pass --write to persist.
// Usage: node etl/extract_features_from_desc.js [--write] [--only <listingId>]
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const mappings = JSON.parse(fs.readFileSync(path.join(__dirname, 'etl_value_mappings.json'), 'utf8'));
const dict = mappings.featureDictionary;

const TARGET_IDS = ['cmg5io0nu00u6s52ch9n9kut2','cmg6mfhin01bns52cyjtokq63','cmgccwxdm001hp02fvtsws5rw'];

function normalize(str){
  if (str === null || str === undefined) return '';
  return str.toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
}

// STRICT matcher: plain synonyms must match as a whole word/phrase (bounded by non-alphanumeric),
// NOT as an arbitrary substring. prefix: matches at a token start. contains: matches substring (intended).
function lineMatchesSynonym(normLine, syn){
  if (syn.startsWith('prefix:')) {
    const p = syn.slice(7);
    // token-start: line starts with p, or a token in the line starts with p
    return normLine.split(/[^a-z0-9&]+/).some(tok => tok.startsWith(p)) || normLine.startsWith(p);
  }
  if (syn.startsWith('contains:')) {
    return normLine.includes(syn.slice(9));
  }
  // whole-phrase, word-bounded: build a regex \bsyn\b but treat & and / as literals
  const esc = syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(^|[^a-z0-9])' + esc + '($|[^a-z0-9])');
  return re.test(normLine);
}

function matchLine(normLine){
  const hits = [];
  for (const f of dict){
    for (const syn of f.synonyms){
      if (lineMatchesSynonym(normLine, syn)) { hits.push(f.slug); break; }
    }
  }
  return [...new Set(hits)];
}

// Resolve duplicate specificity: if a more specific slug matched on the same line,
// drop the generic one. Known pair: plafon-panoramic (specific) suppresses trapa (generic).
const SUPPRESS = { 'plafon-panoramic': ['trapa'] };

async function main(){
  const write = process.argv.includes('--write');
  const prisma = new PrismaClient();
  const dbFeatures = await prisma.feature.findMany();
  const slugToId = {}; dbFeatures.forEach(f=>slugToId[f.slug]=f.id);

  for (const id of TARGET_IDS){
    const listing = await prisma.listing.findUnique({ where:{ id }, select:{ id:true, title:true, description:true } });
    if (!listing || !listing.description){ console.log('=== '+id+' === NO DESCRIPTION'); continue; }
    // split into candidate lines/segments
    const segments = listing.description.split(/[\r\n]+|[•▪✔✅☑☐]|(?:^|\s)-\s/).map(normalize).filter(s=>s.length>2);
    const found = new Map(); // slug -> evidence line
    for (const seg of segments){
      const slugs = matchLine(seg);
      for (const s of slugs){ if(!found.has(s)) found.set(s, seg); }
    }
    // apply suppression
    for (const [specific, generics] of Object.entries(SUPPRESS)){
      if (found.has(specific)) for (const g of generics) found.delete(g);
    }
    // keep only slugs that exist as Features in DB
    const finalSlugs = [...found.keys()].filter(s=>slugToId[s]).sort();
    console.log('=== '+id+' ('+listing.title+') ===');
    finalSlugs.forEach(s=>console.log('  '+s+'  <= '+JSON.stringify(found.get(s))));
    console.log('  TOTAL: '+finalSlugs.length+(write?' [WRITING]':' [DRY-RUN]'));

    if (write){
      await prisma.listing.update({
        where:{ id },
        data:{ features:{ connect: finalSlugs.map(s=>({ id: slugToId[s] })) } }
      });
    }
  }
  await prisma.$disconnect();
  console.log(write ? '\nWRITE COMPLETE' : '\nDRY-RUN COMPLETE (no writes)');
}
main().catch(e=>{ console.error(e); process.exit(1); });
