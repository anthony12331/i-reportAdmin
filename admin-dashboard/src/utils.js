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
          'User-Agent': 'LagonglongIncidentSystem/1.0 (Student Project)' 
        }
      });
      
      if (!response.ok) throw new Error("API Limit");
      
      const data = await response.json();
      resolve(data); // Send the data back to the component waiting for it
    } catch (error) {
      reject(error);
    }
    
    // 3. The golden rule: Wait exactly 1 second before asking the next one.
    // This makes OpenStreetMap happy and prevents ALL 429 errors.
    await new Promise(r => setTimeout(r, 1000));
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
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const formatLocationLabel = (data) => {
  const addr = data.address || {};
  const namedPlace = pickFirstText(
    data.name,
    data.namedetails?.name,
    data.namedetails?.['name:en'],
    data.namedetails?.['name:fil'],
    addr.amenity,
    addr.building,
    addr.shop,
    addr.office,
    addr.tourism,
    addr.leisure,
    addr.place
  );

  const road = pickFirstText(addr.house_number && addr.road ? `${addr.house_number} ${addr.road}` : addr.road);
  const barangay = pickFirstText(
    addr.village,
    addr.suburb,
    addr.neighbourhood,
    addr.city_district,
    addr.poblacion,
    addr.hamlet
  );
  const townCity = pickFirstText(addr.city, addr.town, addr.municipality, addr.county);
  const province = pickFirstText(addr.state, addr.region);
  const country = pickFirstText(addr.country);

  const fullAddress = [road, barangay, townCity, province, country]
    .filter(Boolean)
    .join(', ');

  return namedPlace || fullAddress || pickFirstText(data.display_name) || 'Location unavailable';
};

export const getReadableAddress = async (latitude, longitude) => {
  if (latitude == null || longitude == null) return "Unknown Location";

  const cacheKey = `${latitude},${longitude}`;

  // If we already know this address, return it INSTANTLY
  if (addressCache[cacheKey]) return addressCache[cacheKey];
  
  // If we are currently looking it up, wait for the result
  if (addressPromises[cacheKey]) return addressPromises[cacheKey];

  // Otherwise, put it in the Queue
  addressPromises[cacheKey] = (async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&namedetails=1&accept-language=en`;
      
      // Use our safe queue instead of standard fetch
      const data = await fetchWithQueue(url);

      const finalAddress = formatLocationLabel(data);
      
      // Save to instant memory bank for next time
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
