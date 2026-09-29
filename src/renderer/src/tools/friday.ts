/** Friday, from four in the afternoon. */
export function isFridayAfternoon(now: Date): boolean {
  return now.getDay() === 5 && now.getHours() >= 16
}
