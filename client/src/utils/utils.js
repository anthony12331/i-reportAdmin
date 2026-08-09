// 1. The Memory Bank (Cache)
const addressCache = {};
const addressPromises = {};

// 2. The Request Queue System
const requestQueue = [];
let isProcessingQueue = false;

const processQueue = async () => {
  // If already processing or queue is empty, stop.
  if (isProcessingQueue || requestQueue.length === 0) return;
  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    // Take the first request in line
    const { url, resolve, reject } = requestQueue.shift();

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "IncidentSystem/1.0 (Student Project)",
        },
      });

      if (!response.ok) throw new Error("API Limit");

      const data = await response.json();
      resolve(data); // Send the data back to the component waiting for it
    } catch (error) {
      reject(error);
    }

    // 3. The golden rule: Wait exactly 1 second before asking the next one.
    // This makes OpenStreetMap happy and prevents ALL 429 errors.
    await new Promise((r) => setTimeout(r, 1000));
  }

  isProcessingQueue = false;
};

// Helper to push requests into the line
const fetchWithQueue = (url) => {
  return new Promise((resolve, reject) => {
    requestQueue.push({ url, resolve, reject });
    processQueue(); // Start the line moving!
  });
};

const pickFirstText = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const formatLocationLabel = (data, formatLevel = "full") => {
  const addr = data.address || {};

  // 1. Highly specific local areas (Zone, Purok, Sitio, Subdivision)
  const zoneOrPurok = pickFirstText(
    addr.suburb,
    addr.neighbourhood,
    addr.quarter,
    addr.residential,
  );

  // 2. The actual Barangay
  const trueBarangay = pickFirstText(
    addr.village,
    addr.poblacion,
    addr.hamlet,
    addr.city_district, // For highly urbanized cities
  );

  // 3. Municipality / City
  const townCity = pickFirstText(
    addr.city,
    addr.town,
    addr.municipality,
    addr.county,
  );

  // 4. Province / Region / ZIP
  const province = pickFirstText(addr.state, addr.province);
  const region = pickFirstText(addr.region, addr.state_district);
  const zip = pickFirstText(addr.postcode);

  // 🚨 SMART FILTER: For Analytics Charts (Zone + Barangay + Town/City)
  if (formatLevel === "barangay") {
    let locationParts = [];

    if (zoneOrPurok) locationParts.push(zoneOrPurok);
    if (trueBarangay && trueBarangay !== zoneOrPurok) locationParts.push(trueBarangay);
    if (townCity) locationParts.push(townCity);
    if (locationParts.length === 0 && province) locationParts.push(province);

    return locationParts.length > 0 ? locationParts.join(", ") : "Unknown Area";
  }

  // 🚑 DEFAULT: Full exact street address for the Live Dispatch Dashboard
  const road = pickFirstText(
    addr.house_number && addr.road
      ? `${addr.house_number} ${addr.road}`
      : addr.road,
  );
  const country = pickFirstText(addr.country);

  const namedPlace = pickFirstText(
    data.name,
    data.namedetails?.name,
    data.namedetails?.["name:en"],
    addr.amenity,
    addr.building,
    addr.shop,
    addr.office,
    addr.place,
  );

  // If Nominatim provides a display_name, use it because it contains all details (ZIP, Region, etc)
  if (data.display_name) {
    const parts = data.display_name.split(',').map(s => s.trim()).filter(Boolean);
    const uniqueParts = [...new Set(parts)];
    
    if (namedPlace && !uniqueParts.includes(namedPlace)) {
      uniqueParts.unshift(namedPlace);
    }
    
    return uniqueParts.join(', ');
  }

  // Fallback if display_name is missing, we construct the most detailed string possible
  const fullAddress = [
    namedPlace,
    road,
    zoneOrPurok,
    trueBarangay,
    townCity,
    province,
    region,
    zip,
    country,
  ];

  const cleanAddress = [...new Set(fullAddress.filter(Boolean))].join(", ");

  return cleanAddress || "Location unavailable";
};

// We added "formatLevel" to the parameters!
export const getReadableAddress = async (
  latitude,
  longitude,
  formatLevel = "full",
) => {
  if (latitude == null || longitude == null) return "Unknown Location";

  // We add the formatLevel to the cache key so it doesn't mix up full addresses with short ones
  const cacheKey = `${latitude},${longitude}-${formatLevel}`;

  if (addressCache[cacheKey]) return addressCache[cacheKey];
  if (addressPromises[cacheKey]) return addressPromises[cacheKey];

  addressPromises[cacheKey] = (async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&namedetails=1&accept-language=en`;

      const data = await fetchWithQueue(url);

      // Pass the formatLevel into our label maker
      const finalAddress = formatLocationLabel(data, formatLevel);

      addressCache[cacheKey] = finalAddress;
      return finalAddress;
    } catch (error) {
      console.error("Geocoding failed:", error);
      return "Location unavailable";
    } finally {
      delete addressPromises[cacheKey];
    }
  })();

  return addressPromises[cacheKey];
};


