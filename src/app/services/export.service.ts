import { Injectable } from '@angular/core';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { TimeEntry } from '../interfaces/time-entry.interface';

export interface ExportOptions {
  filename?: string;
  includeSummary?: boolean;
  worksheetName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  /**
   * Export time entries to Excel with professional formatting
   */
  async exportTimeEntriesToExcel(
    entries: TimeEntry[], 
    options: ExportOptions = {}
  ): Promise<void> {
    
    const {
      filename = this.generateDefaultFilename(),
      includeSummary = true,
      worksheetName = 'Time Entries'
    } = options;

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(worksheetName);

      // Set up columns with proper formatting
      this.setupWorksheetColumns(worksheet);

      // Add and format header row
      this.formatHeaderRow(worksheet);

      // Generate complete date range with entries and weekend placeholders
      const completeEntries = this.generateCompleteEntries(entries);

      // Add data rows with conditional formatting
      this.addDataRows(worksheet, completeEntries);

      // Add summary section if requested (only count real entries)
      if (includeSummary) {
        this.addSummarySection(worksheet, entries, completeEntries);
      }

      // Apply additional styling
      this.applyWorksheetStyling(worksheet);

      // Generate and save the file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      saveAs(blob, `${filename}.xlsx`);

    } catch (error) {
      console.error('Error generating Excel file:', error);
      throw new Error('Failed to export Excel file. Please try again.');
    }
  }

  /**
   * Generate complete entries including weekends for date range
   */
  private generateCompleteEntries(entries: TimeEntry[]): TimeEntry[] {
    if (entries.length === 0) {
      return [];
    }

    // Find the date range from the entries
    const dates = entries.map(entry => new Date(entry.date));
    const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const endDate = new Date(Math.max(...dates.map(d => d.getTime())));

    // Generate all dates in the range
    const allDatesInRange = this.generateDateRange(startDate, endDate);
    
    // Create a map of existing entries by date string
    const existingEntries = new Map<string, TimeEntry>();
    entries.forEach(entry => {
      const dateStr = new Date(entry.date).toDateString();
      existingEntries.set(dateStr, entry);
    });

    // Generate complete entries with placeholders for missing dates (only weekends)
    const completeEntries: TimeEntry[] = allDatesInRange.map(date => {
      const dateStr = date.toDateString();
      const existingEntry = existingEntries.get(dateStr);
      
      if (existingEntry) {
        return existingEntry;
      } else if (this.isWeekendDay(date)) {
        // Only create placeholders for weekend days
        return {
          id: `weekend-placeholder-${date.toISOString()}`,
          userId: 'placeholder',
          date: date,
          startTime: '',
          endTime: '',
          breakDuration: '',
          createdAt: new Date(),
          updatedAt: new Date()
        };
      } else {
        // Skip non-weekend days that don't have entries
        return null;
      }
    }).filter((entry): entry is TimeEntry => entry !== null);

    return completeEntries;
  }

  /**
   * Generate date range between start and end dates
   */
  private generateDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    while (currentDate <= end) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  }

  /**
   * Setup worksheet columns with proper widths
   */
  private setupWorksheetColumns(worksheet: ExcelJS.Worksheet): void {
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 18 },
      { header: 'Day of Week', key: 'dayOfWeek', width: 15 },
      { header: 'Start Time', key: 'startTime', width: 12 },
      { header: 'End Time', key: 'endTime', width: 12 },
      { header: 'Break Duration', key: 'breakDuration', width: 15 },
      { header: 'Total Worked', key: 'totalWorked', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Created Date', key: 'created', width: 20 }
    ];
  }

  /**
   * Format the header row with colors and styling
   */
  private formatHeaderRow(worksheet: ExcelJS.Worksheet): void {
    const headerRow = worksheet.getRow(1);
    
    headerRow.font = { 
      bold: true, 
      color: { argb: 'FFFFFFFF' },
      size: 12
    };
    
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' } // Blue background
    };

    headerRow.alignment = {
      vertical: 'middle',
      horizontal: 'center'
    };

    headerRow.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };

    // Set header row height
    headerRow.height = 25;
  }

  /**
   * Add data rows with conditional formatting based on status
   */
  private addDataRows(worksheet: ExcelJS.Worksheet, entries: TimeEntry[]): void {
    entries.forEach((entry, index) => {
      const rowData = {
        date: this.formatDate(entry.date),
        dayOfWeek: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(entry.date)),
        startTime: entry.startTime || '',
        endTime: entry.endTime || '',
        breakDuration: entry.breakDuration || '',
        totalWorked: this.calculateWorkedTime(entry.startTime, entry.endTime, entry.breakDuration),
        status: this.getStatusText(entry),
        created: new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }).format(new Date(entry.createdAt))
      };

      const row = worksheet.addRow(rowData);
      const rowNumber = index + 2; // +2 because Excel is 1-indexed and we have a header row

      // Format the row
      this.formatDataRow(worksheet, rowNumber, entry);
    });
  }

  /**
   * Format individual data rows with conditional colors
   */
  private formatDataRow(worksheet: ExcelJS.Worksheet, rowNumber: number, entry: TimeEntry): void {
    const row = worksheet.getRow(rowNumber);
    
    // Set row height
    row.height = 20;

    // Check if it's a weekend
    const isWeekend = this.isWeekendDay(entry.date);
    
    // Apply alternating row colors
    const isEvenRow = rowNumber % 2 === 0;
    let baseFillColor = isEvenRow ? 'FFF8FAFC' : 'FFFFFFFF'; // Light gray for even rows
    
    // Override with weekend color if it's a weekend
    if (isWeekend) {
      baseFillColor = 'FFFEF3C7'; // Light yellow for weekends
    }

    // Apply base formatting to all cells
    row.eachCell((cell, cellNumber) => {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
      
      // Apply base fill color to all cells except status column
      if (cellNumber !== 7) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: baseFillColor }
        };
      }

      // Special formatting for time columns
      if (cellNumber >= 3 && cellNumber <= 6) { // Start Time, End Time, Break, Total
        cell.font = { name: 'Consolas', size: 10 };
      }
    });

    // Special formatting for status column (7th column) - this should come after base formatting
    const statusCell = row.getCell(7);
    const status = this.getStatusText(entry);
    
    this.formatStatusCell(statusCell, status);
  }

  /**
   * Format status cell with color coding based on completion
   */
  private formatStatusCell(cell: ExcelJS.Cell, status: string): void {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    
    switch (status) {
      case 'Complete':
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF10B981' } // Green
        };
        break;
      case 'In Progress':
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF59E0B' } // Amber/Orange
        };
        break;
      case 'Pending':
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF6B7280' } // Gray
        };
        break;
      case 'No Entry':
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEF4444' } // Red
        };
        break;
      default:
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF6B7280' } // Gray
        };
    }
  }

  /**
   * Add summary section with totals and statistics
   */
  private addSummarySection(worksheet: ExcelJS.Worksheet, entries: TimeEntry[], completeEntries?: TimeEntry[]): void {
    const lastRowNumber = worksheet.rowCount;
    
    // Add spacing
    worksheet.addRow({});
    worksheet.addRow({});

    // Summary header
    const summaryHeaderRow = worksheet.addRow({ date: 'SUMMARY REPORT' });
    summaryHeaderRow.getCell(1).font = { 
      bold: true, 
      size: 14, 
      color: { argb: 'FFFFFFFF' }
    };
    summaryHeaderRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF7C3AED' } // Purple
    };
    
    // Merge cells for summary header
    worksheet.mergeCells(`A${summaryHeaderRow.number}:H${summaryHeaderRow.number}`);

    // Calculate summary data (exclude placeholder entries from work totals)
    const realEntries = entries.filter(entry => !this.isPlaceholderEntry(entry));
    const totalEntries = realEntries.length;
    const totalMinutes = realEntries.reduce((total, entry) => {
      const workedTime = this.calculateWorkedTime(entry.startTime, entry.endTime, entry.breakDuration);
      const [hours, minutes] = workedTime.split(':').map(Number);
      return total + (hours * 60) + minutes;
    }, 0);

    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const totalHoursFormatted = `${totalHours}:${remainingMinutes.toString().padStart(2, '0')}`;

    const averageHoursPerDay = totalEntries > 0 ? (totalMinutes / totalEntries / 60).toFixed(1) : '0';

    // Status breakdown (include all entries including placeholders for complete picture)
    const statusCounts = this.getStatusBreakdown(completeEntries || entries);

    // Add summary rows
    const summaryData = [
      { label: 'Total Entries', value: totalEntries.toString() },
      { label: 'Total Hours Worked', value: totalHoursFormatted },
      { label: 'Average Hours/Day', value: `${averageHoursPerDay} hours` },
      { label: 'Complete Days', value: statusCounts['Complete'].toString() },
      { label: 'In Progress Days', value: statusCounts['In Progress'].toString() },
      { label: 'Pending Days', value: statusCounts['Pending'].toString() },
      { label: 'Export Date', value: new Date().toLocaleDateString() }
    ];

    summaryData.forEach(item => {
      const row = worksheet.addRow({ date: item.label, dayOfWeek: item.value });
      row.getCell(1).font = { bold: true };
      row.getCell(2).font = { bold: true, color: { argb: 'FF2563EB' } };
    });
  }

  /**
   * Apply additional worksheet styling
   */
  private applyWorksheetStyling(worksheet: ExcelJS.Worksheet): void {
    // Freeze the header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Auto-filter on header row
    worksheet.autoFilter = {
      from: 'A1',
      to: 'H1'
    };

    // Set print options
    worksheet.pageSetup = {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToHeight: 0,
      fitToWidth: 1
    };
  }

  /**
   * Get status breakdown counts
   */
  private getStatusBreakdown(entries: TimeEntry[]): Record<string, number> {
    const counts = { Complete: 0, 'In Progress': 0, Pending: 0, 'No Entry': 0 };
    
    entries.forEach(entry => {
      const status = this.getStatusText(entry);
      counts[status as keyof typeof counts]++;
    });

    return counts;
  }

  /**
   * Generate default filename based on current date
   */
  private generateDefaultFilename(): string {
    const currentDate = new Date().toISOString().split('T')[0];
    return `timesheet_export_${currentDate}`;
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(date));
  }

  /**
   * Calculate worked time from start, end, and break duration
   */
  private calculateWorkedTime(startTime: string, endTime: string, breakDuration: string): string {
    const start = this.parseTime(startTime);
    const end = this.parseTime(endTime);
    const breakTime = this.parseTime(breakDuration);

    const totalMinutes = end - start - breakTime;
    
    if (totalMinutes < 0) {
      return '00:00';
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Parse time string to minutes
   */
  private parseTime(timeString: string): number {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Get status text based on entry data
   */
  private getStatusText(entry: TimeEntry): string {
    // Check if entry is null/undefined
    if (!entry) {
      return 'No Entry';
    }
    
    // Check if it's a weekend placeholder
    if (this.isPlaceholderEntry(entry)) {
      return 'No Entry';
    }
    
    if (!entry.startTime || !entry.endTime) {
      return 'Pending';
    }
    
    const workedTime = this.calculateWorkedTime(entry.startTime, entry.endTime, entry.breakDuration);
    const [hours] = workedTime.split(':').map(Number);
    
    if (hours >= 8) {
      return 'Complete';
    } else if (hours > 0) {
      return 'In Progress';
    } else {
      return 'Pending';
    }
  }

  /**
   * Check if entry is a placeholder
   */
  private isPlaceholderEntry(entry: TimeEntry): boolean {
    // Check if it's a weekend placeholder created for export
    return entry.id.startsWith('weekend-placeholder-') || entry.userId === 'placeholder';
  }

  /**
   * Check if date is weekend
   */
  private isWeekendDay(date: Date): boolean {
    const dayOfWeek = new Date(date).getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  /**
   * Generate filename with date range
   */
  generateFilenameWithDateRange(startDate?: Date, endDate?: Date): string {
    if (startDate && endDate) {
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      return `timesheet_${startStr}_to_${endStr}`;
    }
    return this.generateDefaultFilename();
  }

  /**
   * Generate filename for paginated export
   */
  generatePageFilename(pageIndex: number): string {
    const currentDate = new Date().toISOString().split('T')[0];
    return `timesheet_page_${pageIndex + 1}_${currentDate}`;
  }
}
