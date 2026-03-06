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


export const getReadableAddress = async (latitude, longitude) => {
  if (!latitude || !longitude) return "Unknown Location";

  const cacheKey = `${latitude},${longitude}`;

  // If we already know this address, return it INSTANTLY
  if (addressCache[cacheKey]) return addressCache[cacheKey];
  
  // If we are currently looking it up, wait for the result
  if (addressPromises[cacheKey]) return addressPromises[cacheKey];

  // Otherwise, put it in the Queue
  addressPromises[cacheKey] = (async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
      
      // Use our safe queue instead of standard fetch
      const data = await fetchWithQueue(url);
      
      const addr = data.address || {};
      
      // Philippine addressing logic (Added 'hamlet' as OSM often puts sitios/puroks here)
      const road = addr.road || "";
      const barangay = addr.village || addr.suburb || addr.neighbourhood || addr.poblacion || addr.hamlet || "";
      const townCity = addr.city || addr.town || addr.municipality || "";
      const province = addr.state || "";
      
      const fullAddress = [road, barangay, townCity, province]
        .filter(part => part !== "" && part !== undefined)
        .join(', ');

      const finalAddress = fullAddress || "Exact Location Identified";
      
      // Save to instant memory bank for next time
      addressCache[cacheKey] = finalAddress;
      return finalAddress;

    } catch (error) {
      console.error("Geocoding failed:", error);
      delete addressPromises[cacheKey]; 
      return "Precision Coordinates Pinpointed";
    }
  })();

  return addressPromises[cacheKey];
};