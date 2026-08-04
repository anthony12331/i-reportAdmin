export function formatWaitTime(created) {
  const createdAt = new Date(created).getTime();
  if (!createdAt) return "Unknown wait";

  const totalMinutes = Math.max(
    0,
    Math.floor((Date.now() - createdAt) / 60000),
  );
  if (totalMinutes < 1) return "Just reported";
  if (totalMinutes < 60) return `${totalMinutes}m waiting`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m waiting` : `${hours}h waiting`;
}
