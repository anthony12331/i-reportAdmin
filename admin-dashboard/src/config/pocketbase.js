import PocketBase from "pocketbase";

// Use environment variable with fallback to local development URL
const pbUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";
export const pb = new PocketBase(pbUrl);
