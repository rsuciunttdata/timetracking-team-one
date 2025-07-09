import { Component, OnInit, signal, computed, inject, ViewChild, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';

import { TimeEntry } from '../../interfaces/time-entry.interface';
import { TimeEntryService } from '../../services/time-entry.service';

@Component({
  selector: 'app-timesheet-table',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatChipsModule
  ],
  templateUrl: './timesheet-table.component.html',
  styleUrls: ['./timesheet-table.component.css']
})
export class TimesheetTableComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  
  // Outputs for parent communication
  @Output() editEntry = new EventEmitter<TimeEntry>();
  @Output() deleteEntry = new EventEmitter<TimeEntry>();
  
  private timeEntryService = inject(TimeEntryService);

  // Signals for state management
  private allEntries = signal<TimeEntry[]>([]);
  private loading = signal<boolean>(false);
  private sortState = signal<Sort>({ active: '', direction: '' });
  private pageState = signal<PageEvent>({ pageIndex: 0, pageSize: 10, length: 0 });

  // Computed signals
  sortedEntries = computed(() => {
    const entries = this.allEntries();
    const sort = this.sortState();

    if (!sort.active || sort.direction === '') {
      return entries;
    }

    return [...entries].sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      
      if (sort.active === 'date') {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return (dateA < dateB ? -1 : 1) * (isAsc ? 1 : -1);
      }
      
      return 0;
    });
  });

  displayedEntries = computed(() => {
    const entries = this.sortedEntries();
    const page = this.pageState();
    
    const startIndex = page.pageIndex * page.pageSize;
    const endIndex = startIndex + page.pageSize;
    
    return entries.slice(startIndex, endIndex);
  });

  // To always have the same number of rows in the table
  timeEntries = computed(() => {
    const entries = this.displayedEntries();
    const page = this.pageState();
    const emptyRows = Math.max(0, page.pageSize - entries.length);
    
    // Add empty rows to maintain table size
    const emptyEntries = Array(emptyRows).fill(null);
    return [...entries, ...emptyEntries];
  });

  isLoading = computed(() => this.loading());
  isEmpty = computed(() => !this.loading() && this.allEntries().length === 0);
  totalEntries = computed(() => this.allEntries().length);
  currentPageSize = computed(() => this.pageState().pageSize);
  currentPageIndex = computed(() => this.pageState().pageIndex);

  // Table configuration
  displayedColumns: string[] = ['date', 'startTime', 'endTime', 'breakDuration', 'totalWorkedTime', 'status', 'actions'];
  pageSizeOptions: number[] = [5, 10, 15];

  ngOnInit(): void {
    this.loadTimeEntries();
  }

  private loadTimeEntries(): void {
    this.loading.set(true);
    const pagination = { page: 1, pageSize: 100 }; // Load more entries for testing
    
    this.timeEntryService.getTimeEntries(pagination).subscribe({
      next: (response) => {
        this.allEntries.set(response.data);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading time entries:', error);
        this.loading.set(false);
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageState.set(event);
  }

  onSortChange(sort: Sort): void {
    this.sortState.set(sort);
  }

  onEditEntry(entry: TimeEntry): void {
    this.editEntry.emit(entry);
  }

  onDeleteEntry(entry: TimeEntry): void {
    this.deleteEntry.emit(entry);
  }

  onAddEntry(): void {
    // Emit event for parent component to handle
    console.log('Add entry clicked');
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(date));
  }

  calculateWorkedTime(startTime: string, endTime: string, breakDuration: string): string {
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

  getStatusText(entry: TimeEntry): string {
    const workedTime = this.calculateWorkedTime(entry.startTime, entry.endTime, entry.breakDuration);
    const [hours] = workedTime.split(':').map(Number);
    
    if (hours >= 8) {
      return 'Complete';
    } else if (hours >= 6) {
      return 'Partial';
    } else if (hours > 0) {
      return 'Minimal';
    } else {
      return 'Invalid';
    }
  }

  getStatusClass(entry: TimeEntry): string {
    const status = this.getStatusText(entry);
    
    switch (status) {
      case 'Complete':
        return 'bg-green-500 text-white';
      case 'Partial':
        return 'bg-yellow-500 text-white';
      case 'Minimal':
        return 'bg-orange-500 text-white';
      case 'Invalid':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  }

  private parseTime(timeString: string): number {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
