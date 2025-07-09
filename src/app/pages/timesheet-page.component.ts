import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';

import { TimesheetTableComponent } from '../components/timesheet-table/timesheet-table.component';
import { TimeEntryService } from '../services/time-entry.service';
import { TimeEntry } from '../interfaces/time-entry.interface';

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
    TimesheetTableComponent
  ],
  templateUrl: './timesheet-page.component.html',
  styleUrls: ['./timesheet-page.component.css']
})
export class TimesheetPageComponent implements OnInit {
  private timeEntryService = inject(TimeEntryService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  timeEntries: TimeEntry[] = [];
  filteredTimeEntries: TimeEntry[] = [];
  totalEntries: number = 0;
  isLoading: boolean = false;
  
  // Date range filters
  startDate: Date | null = null;
  endDate: Date | null = null;

  ngOnInit(): void {
    this.setDefaultDateRange();
    setTimeout(() => {
      this.loadTimeEntries();
    }, 0);
  }

  private setDefaultDateRange(): void {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    this.startDate = startOfMonth;
    this.endDate = today;
  }

  loadTimeEntries(): void {
    this.isLoading = true;
    this.cdr.detectChanges(); // Force change detection
    
    const pagination = { page: 1, pageSize: 100 };
    
    console.log('🔍 Making API call to:', this.timeEntryService);
    
    this.timeEntryService.getTimeEntries(pagination).subscribe({
      next: (response) => {
        console.log('✅ Received response:', response);
        this.timeEntries = response.data;
        this.totalEntries = response.total;
        this.applyDateFilter();
        this.isLoading = false;
        this.cdr.detectChanges(); // Force change detection
      },
      error: (error) => {
        console.error('❌ Error loading time entries:', error);
        this.snackBar.open('Error loading time entries', 'Close', { duration: 3000 });
        this.isLoading = false;
        this.cdr.detectChanges(); // Force change detection
      }
    });
  }

  applyDateFilter(): void {
    if (!this.startDate || !this.endDate) {
      this.filteredTimeEntries = [...this.timeEntries];
      return;
    }

    this.filteredTimeEntries = this.timeEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= this.startDate! && entryDate <= this.endDate!;
    });
  }

  onDateRangeChange(): void {
    this.applyDateFilter();
  }

  onEditEntry(entry: TimeEntry): void {
    // TODO: Open edit dialog
    this.snackBar.open(`Edit entry for ${entry.date}`, 'Close', { duration: 2000 });
  }

  onDeleteEntry(entry: TimeEntry): void {
    if (confirm('Are you sure you want to delete this time entry?')) {
      this.timeEntryService.deleteTimeEntry(entry.id).subscribe({
        next: () => {
          this.loadTimeEntries();
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

  getTotalWorkedHours(): string {
    const totalMinutes = this.filteredTimeEntries.reduce((total, entry) => {
      const workedTime = this.calculateWorkedTime(entry);
      const [hours, minutes] = workedTime.split(':').map(Number);
      return total + (hours * 60) + minutes;
    }, 0);

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  }

  private calculateWorkedTime(entry: TimeEntry): string {
    const startTime = this.timeStringToMinutes(entry.startTime);
    const endTime = this.timeStringToMinutes(entry.endTime);
    const breakMinutes = this.timeStringToMinutes(entry.breakDuration);
    
    const totalMinutes = endTime - startTime - breakMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }

  private timeStringToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return (hours * 60) + minutes;
  }
}
