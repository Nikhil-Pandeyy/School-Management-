/**
 * Generates a 5-digit unique ID (10000-99999).
 * In a production app, we would verify uniqueness against the database.
 */
export const generateUniqueId = async (schoolId: string): Promise<string> => {
  // Call our backend API for unified generation
  try {
    const response = await fetch('/api/generate-id');
    const data = await response.json();
    return data.id;
  } catch {
    const yearPrefix = new Date().getFullYear().toString().slice(-2);
    return yearPrefix + Math.floor(1000 + Math.random() * 9000).toString();
  }
};
