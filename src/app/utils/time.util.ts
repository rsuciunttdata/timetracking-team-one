/**
 * Time utility functions for converting between string and integer time formats
 */
export class TimeUtil {
  
  /**
   * Convert time string (HH:mm) to minutes from midnight
   * @param timeString - Time in HH:mm format
   * @returns Minutes from midnight (0-1439)
   */
  static timeStringToMinutes(timeString: string): number {
    if (!timeString || !timeString.includes(':')) return 0;
    
    const [hours, minutes] = timeString.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes)) return 0;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return 0;
    
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes from midnight to time string (HH:mm)
   * @param minutes - Minutes from midnight (0-1439)
   * @returns Time string in HH:mm format
   */
  static minutesToTimeString(minutes: number): string {
    if (minutes < 0 || minutes >= 24 * 60) return '00:00';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Calculate worked minutes from start, end, and break duration
   * @param startMinutes - Start time in minutes from midnight
   * @param endMinutes - End time in minutes from midnight
   * @param breakMinutes - Break duration in minutes
   * @returns Total worked minutes
   */
  static calculateWorkedMinutes(startMinutes: number, endMinutes: number, breakMinutes: number = 0): number {
    if (startMinutes < 0 || endMinutes < 0 || endMinutes <= startMinutes) return 0;
    
    const totalMinutes = endMinutes - startMinutes - breakMinutes;
    
    return Math.max(0, totalMinutes);
  }

  /**
   * Calculate worked time from string times and return as time string
   * @param startTime - Start time as HH:mm string
   * @param endTime - End time as HH:mm string
   * @param breakDuration - Break duration in minutes (integer)
   * @returns Worked time as HH:mm string
   */
  static calculateWorkedTimeString(startTime: string, endTime: string, breakDuration: number = 0): string {
    const startMinutes = this.timeStringToMinutes(startTime);
    const endMinutes = this.timeStringToMinutes(endTime);
    const workedMinutes = this.calculateWorkedMinutes(startMinutes, endMinutes, breakDuration);
    
    return this.minutesToTimeString(workedMinutes);
  }
}
