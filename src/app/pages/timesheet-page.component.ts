import { Component, OnInit, inject, signal, computed } from '@angular/core';
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

  // Signals for reactive state management
  private startDateSignal = signal<Date | null>(null);
  private endDateSignal = signal<Date | null>(null);
  private summaryDataSignal = signal<{ totalEntries: number; totalHours: string }>({ totalEntries: 0, totalHours: '0:00' });

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
    return this.authService.getUsername();
  }

  ngOnInit(): void {
    this.setDefaultDateRange();
  }

  private setDefaultDateRange(): void {
    const today = new Date();
    this.startDateSignal.set(today);
    this.endDateSignal.set(today);
  }

  onDateRangeChange(): void {
    // The table will automatically react to the dateFilter computed signal
    console.log('Date range changed:', this.dateFilter());
  }

  clearDateFilters(): void {
    this.startDateSignal.set(null);
    this.endDateSignal.set(null);
  }

  onEditEntry(entry: TimeEntry): void {
    // TODO: Open edit dialog
    this.snackBar.open(`Edit entry for ${entry.date}`, 'Close', { duration: 2000 });
  }

  onDeleteEntry(entry: TimeEntry): void {
    if (confirm('Are you sure you want to delete this time entry?')) {
      this.timeEntryService.deleteTimeEntry(entry.id).subscribe({
        next: () => {
          this.snackBar.open('Time entry deleted successfully', 'Close', { duration: 3000 });
        },
        error: (error) => {
          console.error('Error deleting time entry:', error);
          this.snackBar.open('Error deleting time entry', 'Close', { duration: 3000 });
        }
      });
    }
  }

  onAddNewEntry(): void {
    // TODO: Open add dialog
    this.snackBar.open('Add new entry dialog will open here', 'Close', { duration: 2000 });
  }

  // Methods to handle summary data from table
  onSummaryDataReceived(summary: { totalEntries: number; totalHours: string }): void {
    this.summaryDataSignal.set(summary);
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
