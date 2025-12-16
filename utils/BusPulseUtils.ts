// --- Time Utilities ---

// Returns YYYY-MM-DD for the current "Logical Day" (starts at 04:00 AM)
export const getLogicalDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  // Subtract 4 hours to shift the day boundary
  date.setHours(date.getHours() - 4);
  return date.toISOString().split('T')[0];
};

// Returns "Minutes of Day" (0-1439) from timestamp
export const getVirtualMoD = (timestamp: number): number => {
  const date = new Date(timestamp);
  return date.getHours() * 60 + date.getMinutes();
};

// --- Magnet Algorithm ---

/**
 * Merges new ETA predictions into an existing history log using a Greedy Magnet approach.
 * @param existingArrivals Array of absolute MoD (Minutes of Day)
 * @param newEtaList Array of relative minutes (e.g., [2, 15])
 * @param currentMoD Current time in MoD
 * @param threshold Minutes window to consider as "same bus" (default 5)
 */
export const runGreedyMagnet = (
  existingArrivals: number[],
  newEtaList: number[],
  currentMoD: number,
  threshold: number = 5
): number[] => {
  // 1. Convert new ETAs to absolute MoD
  const newArrivals = newEtaList.map(eta => currentMoD + eta);

  // 2. Clone existing to avoid mutation
  let merged = [...existingArrivals];

  // 3. Process each new arrival
  for (const newArr of newArrivals) {
    let matched = false;

    // Try to find a close match in existing data (Magnet effect)
    for (let i = 0; i < merged.length; i++) {
      if (Math.abs(merged[i] - newArr) <= threshold) {
        // Found a match: Update it to the latest prediction (or average, here we take latest)
        merged[i] = newArr; 
        matched = true;
        break;
      }
    }

    // If no magnet match, append as new data point
    if (!matched) {
      merged.push(newArr);
    }
  }

  // 4. Sort and Deduplicate strict exact duplicates just in case
  return Array.from(new Set(merged)).sort((a, b) => a - b);
};