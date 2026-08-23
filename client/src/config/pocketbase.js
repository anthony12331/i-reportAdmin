import PocketBase from "pocketbase";

// Use environment variable with fallback to local development URL
const pbUrl = import.meta.env.VITE_POCKETBASE_URL || "https://api.ireportsystem.com";
export const pb = new PocketBase(pbUrl);
