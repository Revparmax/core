export const scaleLegacyHundredths = (
  value: number | undefined
): number | undefined => (value === undefined ? undefined : value / 100);

export const legacyPercentHundredthsToRatio = (
  value: number | undefined
): number | undefined => {
  const percent = scaleLegacyHundredths(value);
  return percent === undefined ? undefined : percent / 100;
};

export const occupancyRatio = (
  occupiedRooms: number | undefined,
  totalRooms: number | undefined
): number | undefined =>
  occupiedRooms === undefined || totalRooms === undefined || totalRooms <= 0
    ? undefined
    : occupiedRooms / totalRooms;
