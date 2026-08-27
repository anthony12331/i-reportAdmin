const DETAIL_IGNORED_KEYS = new Set([
  "id",
  "collectionId",
  "collectionName",
  "created",
  "updated",
  "emailVisibility",
  "verified",
  "user_id",
  "status",
  "selfie",
  "id_photo",
  "password",
  "token",
  "avatar",
  "profile",
  "role",
  "first_name",
  "middle_name",
  "last_name",
  "contact_number",
  "contactNumber",
  "contact",
  "barangay",
  "baranggay",
  "date_time",
  "dateTime",
  "municipality",
  "province",
  "extension",
]);

function formatFieldLabel(field) {
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatBooleanValue(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return value;
}

function formatDateTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;

  return `${year}-${month}-${day} ${hours}:${minutes}${period}`;
}

function normalizeKey(key) {
  switch (key) {
    case "baranggay":
    case "barangay":
      return "barangay";
    case "contactNumber":
    case "contact":
    case "contact_number":
      return "contact_number";
    case "dateTime":
    case "date_time":
      return "date_time";
    default:
      return key;
  }
}

export function buildVerifiedUsersFilter(searchTerm = "", filters = {}) {
  const status = filters.status || "verified";
  let filterString = status === "all" ? "" : `status = "${status}"`;
  const trimmedSearch = searchTerm.trim();
  const trimmedBarangay = (filters.barangay || "").trim();
  const trimmedMunicipality = (filters.municipality || "").trim();
  const registrationDate = filters.registrationDate || "";

  if (trimmedSearch) {
    const searchEscaped = trimmedSearch.replace(/"/g, '\\"');
    const searchParts = [
      `first_name ~ "${searchEscaped}"`,
      `last_name ~ "${searchEscaped}"`,
    ];

    if (/^\d+$/.test(trimmedSearch)) {
      searchParts.push(`contact_number = ${trimmedSearch}`);
      searchParts.push(`user_id = ${trimmedSearch}`);
    }

    filterString += `${filterString ? " && " : ""}(${searchParts.join(" || ")})`;
  }

  if (trimmedBarangay) {
    const barangayEscaped = trimmedBarangay.replace(/"/g, '\\"');
    filterString += `${filterString ? " && " : ""}baranggay ~ "${barangayEscaped}"`;
  }

  if (trimmedMunicipality) {
    const municipalityEscaped = trimmedMunicipality.replace(/"/g, '\\"');
    filterString += `${filterString ? " && " : ""}municipality ~ "${municipalityEscaped}"`;
  }

  if (registrationDate) {
    filterString += `${filterString ? " && " : ""}date_time >= "${registrationDate} 00:00:00" && date_time <= "${registrationDate} 23:59:59"`;
  }

  return filterString;
}

export function getVerifiedUserDetails(user) {
  if (!user) return [];

  const fullName =
    `${user.first_name || ""} ${user.middle_name || ""} ${user.last_name || ""}`.trim();
  const detailRows = [
    {
      label: "Full Name",
      value: user.extension ? `${fullName}, ${user.extension}` : fullName,
    },
    { label: "Email", value: user.email },
    { label: "Age", value: user.age },
    {
      label: "Contact Number",
      value: user.contact_number || user.contactNumber || user.contact,
    },
    { label: "Barangay", value: user.baranggay || user.barangay },
    { label: "Municipality", value: user.municipality },
    { label: "Province", value: user.province },
    { label: "Registration Date", value: formatDateTime(user.created) },
  ];

  const extraFields = Object.entries(user)
    .map(([key, value]) => [normalizeKey(key), value])
    .filter(
      ([key, value]) =>
        !DETAIL_IGNORED_KEYS.has(key) &&
        value != null &&
        value !== "" &&
        typeof value !== "object",
    )
    .map(([key, value]) => ({
      label: formatFieldLabel(key),
      value: formatBooleanValue(value),
    }));

  const combined = [...detailRows, ...extraFields].filter(
    (item) =>
      item.value !== undefined &&
      item.value !== null &&
      String(item.value).trim() !== "",
  );

  const seen = new Set();
  return combined.filter((item) => {
    const signature = `${item.label.trim().toLowerCase()}|${String(item.value).trim()}`;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}
