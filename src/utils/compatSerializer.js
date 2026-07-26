// src/utils/compatSerializer.js

const COLOR_MAP = {
  BLACK: "Negru",
  GREY: "Gri",
  WHITE: "Alb",
  BLUE: "Albastru",
  RED: "Rosu",
  BROWN: "Maro",
  SILVER: "Argintiu",
  ORANGE: "Portocaliu",
  GREEN: "Verde",
  PURPLE: "Mov",
  GOLD: "Auriu",
  BEIGE: "Bej",
  YELLOW: "Galben",
  OTHER: "Alta"
};

const FUEL_TYPE_MAP = {
  PETROL: "Benzina",
  DIESEL: "Diesel",
  PETROL_LPG: "Benzina + GPL",
  LPG: "GPL",
  HYBRID: "Hibrid",
  PLUGIN_HYBRID: "Plug-in Hybrid",
  MILD_HYBRID: "Mild Hybrid",
  ELECTRIC: "Electric"
};

const GEARBOX_MAP = {
  MANUAL: "Manuala",
  AUTOMATIC: "Automata"
};

const DRIVETRAIN_MAP = {
  FWD: "Fata",
  RWD: "Spate",
  AWD: "Integrala"
};

const BODY_TYPE_MAP = {
  SUV: "SUV",
  SEDAN: "Berlina",
  HATCHBACK: "Hatchback",
  BREAK: "Break",
  COUPE: "Coupe",
  CABRIO: "Cabrio",
  MONOVOLUM: "Monovolum",
  VAN: "Van",
  PICKUP: "Pickup"
};

const POLLUTION_NORM_MAP = {
  EURO_1: "Euro 1",
  EURO_2: "Euro 2",
  EURO_3: "Euro 3",
  EURO_4: "Euro 4",
  EURO_5: "Euro 5",
  EURO_6: "Euro 6",
  EURO_6D: "Euro 6d",
  NON_EURO: "Non-Euro"
};

const UPHOLSTERY_MAP = {
  FABRIC: "Textil",
  VELOUR: "Velur",
  LEATHER: "Piele",
  PARTIAL_LEATHER: "Piele partiala",
  ALCANTARA: "Alcantara"
};

const AIR_CONDITIONING_MAP = {
  NONE: "Fara",
  MANUAL: "Aer conditionat manual",
  AUTOMATIC: "Climatizare automata",
  DUAL_ZONE: "Dublu climatronic",
  TRI_ZONE: "Climatronic 3 zone",
  QUAD_ZONE: "Climatronic 4 zone"
};

const COUNTRY_MAP = {
  DE: "Germania",
  FR: "Franta",
  RO: "Romania",
  IT: "Italia",
  BE: "Belgia",
  FI: "Finlanda"
};

const FEATURE_GROUP_MAP = {
  SAFETY: "Siguranță",
  COMFORT: "Confort și Interior",
  MULTIMEDIA: "Multimedia",
  EXTERIOR: "Exterior",
  SERVICES: "Servicii"
};

function toLegacyListing(listing, { mode = 'search' } = {}) {
  if (!listing) return listing;

  const legacyListing = {
    id: listing.id,
    businessId: listing.businessId,
    title: listing.title,
    description: listing.description || null,
    price: listing.price || null,
    mileage: listing.mileage || null,
    status: listing.status,
    slug: listing.slug || null,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
    internalNotes: listing.internalNotes || null,
    purchasePrice: listing.purchasePrice || null,
    sellingPrice: listing.sellingPrice || null,
    otherCosts: listing.otherCosts || null,
    soldAt: listing.soldAt || null,
    autovitId: listing.autovitId ? listing.autovitId.toString() : null,
    autovitStatus: listing.autovitStatus || null,
    youtubeVideoId: listing.youtubeVideoId || null,
    categoryId: "legacy-vehicule",
    category: { name: "Vehicule" },
    activeReservation: (listing.reservations && listing.reservations[0])
      ? {
          id: listing.reservations[0].id,
          clientName: listing.reservations[0].clientName,
          clientPhone: listing.reservations[0].clientPhone,
          depositAmount: listing.reservations[0].depositAmount,
          expiresAt: listing.reservations[0].expiresAt
        }
      : null
  };

  // Images mapping
  if (mode === 'search') {
    legacyListing.images = (listing.images || []).map(img => ({ url: img.url }));
  } else {
    legacyListing.images = (listing.images || []).map(img => ({
      id: img.id,
      url: img.url,
      listingId: img.listingId,
      order: img.order
    }));
  }

  // Build EAV attributes
  const attributeValues = [];

  const addAttrValue = (key, name, type, val, groupName, groupId) => {
    if (val === null || val === undefined || val === '') return;

    const av = {
      id: `${listing.id}:${key}`,
      listingId: listing.id,
      attributeId: `attr:${key}`,
      stringValue: null,
      numberValue: null,
      booleanValue: null,
      attribute: {
        id: `attr:${key}`,
        name: name,
        type: type,
        categoryId: "legacy-vehicule",
        attributeGroupId: groupId || null,
        attributeGroup: groupName ? { name: groupName } : null
      }
    };

    if (type === 'STRING') av.stringValue = String(val);
    else if (type === 'NUMBER') av.numberValue = Number(val);
    else if (type === 'BOOLEAN') av.booleanValue = Boolean(val);

    attributeValues.push(av);
  };

  // 1. Make / Marca
  if (listing.make && listing.make.name) {
    addAttrValue('make', 'Marca', 'STRING', listing.make.name, 'Istoric și Stare', 'group:historystatus');
  } else if (listing.makeName) {
    addAttrValue('make', 'Marca', 'STRING', listing.makeName, 'Istoric și Stare', 'group:historystatus');
  }

  // 2. Model
  if (listing.model && listing.model.name) {
    addAttrValue('model', 'Model', 'STRING', listing.model.name, 'Istoric și Stare', 'group:historystatus');
  } else if (listing.modelName) {
    addAttrValue('model', 'Model', 'STRING', listing.modelName, 'Istoric și Stare', 'group:historystatus');
  }

  // 3. Year
  addAttrValue('year', 'An', 'NUMBER', listing.year, 'Istoric și Stare', 'group:historystatus');

  // 4. Mileage
  addAttrValue('mileage', 'Kilometraj', 'NUMBER', listing.mileage, 'Istoric și Stare', 'group:historystatus');

  // 5. Price
  addAttrValue('price', 'Pret', 'NUMBER', listing.price, 'Istoric și Stare', 'group:historystatus');

  // 6. engineCapacity
  addAttrValue('engineCapacity', 'Capacitate cilindrică', 'NUMBER', listing.engineCapacity, 'Informații Tehnice', 'group:techinfo');

  // 7. powerHp
  addAttrValue('powerHp', 'Putere (CP)', 'NUMBER', listing.powerHp, 'Informații Tehnice', 'group:techinfo');

  // 8. fuelType
  if (listing.fuelType) {
    const roFuel = FUEL_TYPE_MAP[listing.fuelType] || listing.fuelType;
    addAttrValue('fuelType', 'Combustibil', 'STRING', roFuel, 'Informații Tehnice', 'group:techinfo');
  }

  // 9. gearbox
  if (listing.gearbox) {
    const roGear = GEARBOX_MAP[listing.gearbox] || listing.gearbox;
    addAttrValue('gearbox', 'Cutie de viteze', 'STRING', roGear, 'Informații Tehnice', 'group:techinfo');
  }

  // 10. drivetrain
  if (listing.drivetrain) {
    const roDrive = DRIVETRAIN_MAP[listing.drivetrain] || listing.drivetrain;
    addAttrValue('drivetrain', 'Tractiune', 'STRING', roDrive, 'Informații Tehnice', 'group:techinfo');
  }

  // 11. bodyType
  if (listing.bodyType) {
    const roBody = BODY_TYPE_MAP[listing.bodyType] || listing.bodyType;
    addAttrValue('bodyType', 'Caroserie', 'STRING', roBody, 'Informații Tehnice', 'group:techinfo');
  }

  // 12. pollutionNorm
  if (listing.pollutionNorm) {
    const roPollution = POLLUTION_NORM_MAP[listing.pollutionNorm] || listing.pollutionNorm;
    addAttrValue('pollutionNorm', 'Norma de poluare', 'STRING', roPollution, 'Informații Tehnice', 'group:techinfo');
  }

  // 13. color
  if (listing.color || listing.colorDetail) {
    const roColor = listing.colorDetail || COLOR_MAP[listing.color] || listing.color;
    addAttrValue('color', 'Culoare', 'STRING', roColor, 'Informații Tehnice', 'group:techinfo');
  }

  // 14. upholstery
  if (listing.upholstery) {
    const roUpholstery = UPHOLSTERY_MAP[listing.upholstery] || listing.upholstery;
    addAttrValue('upholstery', 'Tapiterie', 'STRING', roUpholstery, 'Informații Tehnice', 'group:techinfo');
  }

  // 15. airConditioning
  if (listing.airConditioning) {
    const roAC = AIR_CONDITIONING_MAP[listing.airConditioning] || listing.airConditioning;
    addAttrValue('airConditioning', 'Climatizare', 'STRING', roAC, 'Informații Tehnice', 'group:techinfo');
  }

  // 16. doors
  addAttrValue('doors', 'Numar usi', 'NUMBER', listing.doors, 'Informații Tehnice', 'group:techinfo');

  // 17. seats
  addAttrValue('seats', 'Numar locuri', 'NUMBER', listing.seats, 'Informații Tehnice', 'group:techinfo');

  // 18. co2Emissions
  addAttrValue('co2Emissions', 'Emisii CO2', 'NUMBER', listing.co2Emissions, 'Informații Tehnice', 'group:techinfo');

  // 19. vin
  addAttrValue('vin', 'VIN', 'STRING', listing.vin, 'Istoric și Stare', 'group:historystatus');

  // 20. countryOfOrigin
  if (listing.countryOfOrigin) {
    const roCountry = COUNTRY_MAP[listing.countryOfOrigin] || listing.countryOfOrigin;
    addAttrValue('countryOfOrigin', 'Tara de origine', 'STRING', roCountry, 'Istoric și Stare', 'group:historystatus');
  }

  // 21. warrantyMonths
  addAttrValue('warrantyMonths', 'Garantie (luni)', 'NUMBER', listing.warrantyMonths, 'Istoric și Stare', 'group:historystatus');

  // 22. ownerCount
  addAttrValue('ownerCount', 'Numar proprietari', 'NUMBER', listing.ownerCount, 'Istoric și Stare', 'group:historystatus');

  // Booleans
  addAttrValue('vatDeductible', 'TVA deductibil', 'BOOLEAN', listing.vatDeductible, 'Istoric și Stare', 'group:historystatus');
  addAttrValue('noAccidents', 'Fara accident', 'BOOLEAN', listing.noAccidents, 'Istoric și Stare', 'group:historystatus');
  addAttrValue('serviceBook', 'Carte service', 'BOOLEAN', listing.serviceBook, 'Istoric și Stare', 'group:historystatus');
  addAttrValue('firstOwner', 'Primul proprietar', 'BOOLEAN', listing.firstOwner, 'Istoric și Stare', 'group:historystatus');
  addAttrValue('registeredInRo', 'Inmatriculat', 'BOOLEAN', listing.registeredInRo, 'Istoric și Stare', 'group:historystatus');

  // Features mapping
  if (listing.features && Array.isArray(listing.features)) {
    listing.features.forEach(feat => {
      const displayGroup = FEATURE_GROUP_MAP[feat.group] || null;
      addAttrValue(
        `feature:${feat.slug}`,
        feat.name,
        'BOOLEAN',
        true,
        displayGroup,
        feat.group ? `group:feature:${feat.group.toLowerCase()}` : null
      );
    });
  }

  // extraSpecs mapping
  if (listing.extraSpecs && typeof listing.extraSpecs === 'object') {
    Object.entries(listing.extraSpecs).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        addAttrValue(`extra:${key}`, key, 'STRING', String(value), null, null);
      }
    });
  }

  legacyListing.attributeValues = attributeValues;

  return legacyListing;
}

module.exports = {
  toLegacyListing
};
