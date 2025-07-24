import { Component, OnInit, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';

import { TimesheetTableComponent } from '../components/timesheet-table/timesheet-table.component';
import { AddModal } from '../components/modal/add-modal/add-modal';
import { EditModal } from '../components/modal/edit-modal/edit-modal';
import { TimeEntryService } from '../services/time-entry.service';
import { TimeEntry } from '../interfaces/time-entry.interface';

import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-timesheet-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatSnackBarModule,
    MatDialogModule,
    TimesheetTableComponent,
  ],
  templateUrl: './timesheet-page.component.html',
  styleUrls: ['./timesheet-page.component.css']
})
export class TimesheetPageComponent implements OnInit {
  private timeEntryService = inject(TimeEntryService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private authService = inject(AuthService);
  private router = inject(Router);

  @ViewChild(TimesheetTableComponent) timesheetTable!: TimesheetTableComponent;

  // Signals for reactive state management
  private startDateSignal = signal<Date | null>(null);
  private endDateSignal = signal<Date | null>(null);
  private summaryDataSignal = signal<{ totalEntries: number; totalHours: string }>({ totalEntries: 0, totalHours: '0:00' });
  private allTimeEntriesSignal = signal<TimeEntry[]>([]);

  // Computed signals for summary cards
  todaySummary = computed(() => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    return this.calculateSummaryForDateRange(startOfDay, endOfDay);
  });

  thisWeekSummary = computed(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0); // Start of day

    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (6 - today.getDay())); // End of current week (Saturday)
    endOfWeek.setHours(23, 59, 59, 999); // End of day

    return this.calculateSummaryForDateRange(startOfWeek, endOfWeek);
  });

  // Computed signals
  dateFilter = computed(() => ({
    startDate: this.startDateSignal(),
    endDate: this.endDateSignal()
  }));

  // Getters for template binding
  get startDate(): Date | null {
    return this.startDateSignal();
  }

  set startDate(value: Date | null) {
    this.startDateSignal.set(value);
  }

  get endDate(): Date | null {
    return this.endDateSignal();
  }

  set endDate(value: Date | null) {
    this.endDateSignal.set(value);
  }

  get username(): string | null {
    return this.authService.username();
  }

  ngOnInit(): void {
    this.setDefaultDateRange();
    this.loadTimeEntries();
  }

  private loadTimeEntries(): void {
    const pagination = { page: 1, pageSize: 100 };

    this.timeEntryService.getTimeEntries(pagination).subscribe({
      next: (response) => {
        this.allTimeEntriesSignal.set(response.data);
      },
      error: (error) => {
        console.error('Error loading time entries:', error);
      }
    });
  }

  private setDefaultDateRange(): void {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)

    this.startDateSignal.set(startOfWeek);
    this.endDateSignal.set(today);
  }

  onDateRangeChange(): void {
    console.log('Date range changed:', this.dateFilter());
  }

  clearDateFilters(): void {
    this.startDateSignal.set(null);
    this.endDateSignal.set(null);
  }

  // Quick filter methods
  setTodayFilter(): void {
    const today = new Date();
    // Normalize to start and end of day to ensure proper comparison
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    this.startDateSignal.set(startOfDay);
    this.endDateSignal.set(endOfDay);
  }

  setThisWeekFilter(): void {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0); // Start of day

    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (6 - today.getDay())); // End of current week (Saturday)
    endOfWeek.setHours(23, 59, 59, 999); // End of day

    this.startDateSignal.set(startOfWeek);
    this.endDateSignal.set(endOfWeek);
  }

  setThisMonthFilter(): void {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0); // Start of day

    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999); // End of day

    this.startDateSignal.set(startOfMonth);
    this.endDateSignal.set(endOfMonth);
  }

  setLast30DaysFilter(): void {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0); // Start of day

    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999); // End of day

    this.startDateSignal.set(thirtyDaysAgo);
    this.endDateSignal.set(endOfToday);
  }

  // Helper method to check if a quick filter is active
  isQuickFilterActive(filterType: 'today' | 'thisWeek' | 'thisMonth' | 'last30Days'): boolean {
    const currentStart = this.startDateSignal();
    const currentEnd = this.endDateSignal();

    if (!currentStart || !currentEnd) return false;

    const today = new Date();

    switch (filterType) {
      case 'today': {
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

        return this.isSameDateTime(currentStart, startOfDay) && this.isSameDateTime(currentEnd, endOfDay);
      }

      case 'thisWeek': {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
        endOfWeek.setHours(23, 59, 59, 999);

        return this.isSameDateTime(currentStart, startOfWeek) && this.isSameDateTime(currentEnd, endOfWeek);
      }

      case 'thisMonth': {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);

        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        return this.isSameDateTime(currentStart, startOfMonth) && this.isSameDateTime(currentEnd, endOfMonth);
      }

      case 'last30Days': {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        const endOfToday = new Date(today);
        endOfToday.setHours(23, 59, 59, 999);

        return this.isSameDateTime(currentStart, thirtyDaysAgo) && this.isSameDateTime(currentEnd, endOfToday);
      }

      default:
        return false;
    }
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate();
  }

  private isSameDateTime(date1: Date, date2: Date): boolean {
    return date1.getTime() === date2.getTime();
  }

  private calculateSummaryForDateRange(startDate: Date, endDate: Date): { entries: number; hours: string } {
    const allEntries = this.allTimeEntriesSignal();

    // Normalize the date range for comparison (ignore time components)
    const normalizedStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const normalizedEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);

    const filteredEntries = allEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      const normalizedEntryDate = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());

      return normalizedEntryDate >= normalizedStart && normalizedEntryDate <= normalizedEnd;
    });

    const totalMinutes = filteredEntries.reduce((total, entry) => {
      if (!entry.startTime || !entry.endTime) return total;

      const workedTime = this.calculateWorkedTime(entry.startTime, entry.endTime, entry.breakDuration || '0:00');
      const [hours, minutes] = workedTime.split(':').map(Number);
      return total + (hours * 60) + minutes;
    }, 0);

    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const hoursFormatted = `${totalHours}:${remainingMinutes.toString().padStart(2, '0')}`;

    return {
      entries: filteredEntries.length,
      hours: hoursFormatted
    };
  }

  private calculateWorkedTime(startTime: string, endTime: string, breakDuration: string): string {
    const start = this.parseTime(startTime);
    const end = this.parseTime(endTime);
    const breakTime = this.parseTime(breakDuration);

    const totalMinutes = end - start - breakTime;

    if (totalMinutes < 0) {
      return '0:00';
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  private parseTime(timeString: string): number {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  onEditEntry(entry: TimeEntry): void {
    const dialogRef = this.dialog.open(EditModal, {
      width: '500px',
      maxWidth: '90vw',
      data: { timeEntry: entry },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (result.delete) {
          this.snackBar.open('Time entry deleted successfully', 'Close', { duration: 3000 });
        } else {
          this.snackBar.open('Time entry updated successfully', 'Close', { duration: 3000 });
        }

        this.refreshAllData();
      }
    });
  }

  onDeleteEntry(entry: TimeEntry): void {
    if (confirm('Are you sure you want to delete this time entry?')) {
      this.timeEntryService.deleteTimeEntry(entry.id).subscribe({
        next: () => {
          this.snackBar.open('Time entry deleted successfully', 'Close', { duration: 3000 });
          this.refreshAllData();
        },
        error: (error) => {
          console.error('Error deleting time entry:', error);
          this.snackBar.open('Error deleting time entry', 'Close', { duration: 3000 });
        }
      });
    }
  }

  onAddNewEntry(): void {
    const dialogRef = this.dialog.open(AddModal, {
      width: '500px',
      maxWidth: '90vw',
      data: {
        prefilledDate: new Date(),
        userId: 'current-user' // This should come from auth service
      },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.snackBar.open('Time entry created successfully', 'Close', { duration: 3000 });
        this.refreshAllData();
      }
    });
  }

  onAddEntryForDate(date: Date): void {
    const dialogRef = this.dialog.open(AddModal, {
      width: '500px',
      maxWidth: '90vw',
      data: {
        prefilledDate: date,
        userId: 'current-user' // This should come from auth service
      },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.snackBar.open('Time entry created successfully', 'Close', { duration: 3000 });
        this.refreshAllData();
      }
    });
  }

  // Methods to handle summary data from table
  onSummaryDataReceived(summary: { totalEntries: number; totalHours: string }): void {
    this.summaryDataSignal.set(summary);
  }

  // Method to refresh all data
  refreshAllData(): void {
    this.loadTimeEntries();
    if (this.timesheetTable) {
      this.timesheetTable.refreshData();
    }
  }

  // Expose summary data for template
  get filteredTimeEntries(): { length: number } {
    return { length: this.summaryDataSignal().totalEntries };
  }

  getTotalWorkedHours(): string {
    return this.summaryDataSignal().totalHours;
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
