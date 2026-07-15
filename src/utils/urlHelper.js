// src/utils/urlHelper.js

/**
 * Builds the public URL for a listing based on the business's configuration and overrides.
 * @param {object} business - The business object containing id and listingUrlPattern.
 * @param {object} listing - The listing object containing id and slug.
 * @returns {string|null}
 */
function buildListingPublicUrl(business, listing) {
  if (!listing) return null;
  
  let link = (business && business.listingUrlPattern) || "https://example.com/anunt/{id}";
  
  const businessId = business ? business.id : null;
  if (businessId === "cmhomcpoi02x1ut2cpips3mo3") {
    link = "https://www.carsleasing.ro/stoc/{id}";
  }
  
  if (link.includes("{slug}")) {
    link = link.replace("{slug}", listing.slug || listing.id);
  }
  if (link.includes("{id}")) {
    link = link.replace("{id}", listing.id);
  }
  
  return link;
}

module.exports = {
  buildListingPublicUrl,
};
