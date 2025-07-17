import { Component, OnInit, OnChanges, signal, computed, inject, ViewChild, Input, Output, EventEmitter } from '@angular/core';
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
export class TimesheetTableComponent implements OnInit, OnChanges {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  
  // Inputs
  @Input() dateFilter: { startDate: Date | null; endDate: Date | null } | null = null;
  
  // Outputs for parent communication
  @Output() editEntry = new EventEmitter<TimeEntry>();
  @Output() deleteEntry = new EventEmitter<TimeEntry>();
  @Output() addEntry = new EventEmitter<void>();
  @Output() summaryData = new EventEmitter<{ totalEntries: number; totalHours: string }>();
  
  private timeEntryService = inject(TimeEntryService);

  // Signals for state management
  private allEntries = signal<TimeEntry[]>([]);
  private loading = signal<boolean>(false);
  private sortState = signal<Sort>({ active: '', direction: '' });
  private pageState = signal<PageEvent>({ pageIndex: 0, pageSize: 10, length: 0 });
  private dateFilterSignal = signal<{ startDate: Date | null; endDate: Date | null } | null>(null);

  // Computed signals
  filteredEntries = computed(() => {
    const entries = this.allEntries();
    const filter = this.dateFilterSignal();
    
    if (!filter || (!filter.startDate && !filter.endDate)) {
      return entries;
    }
    
    const filteredRealEntries = entries.filter(entry => {
      const entryDate = new Date(entry.date);
      const start = filter.startDate;
      const end = filter.endDate;
      
      if (start && end) {
        return entryDate >= start && entryDate <= end;
      } else if (start) {
        return entryDate >= start;
      } else if (end) {
        return entryDate <= end;
      }
      
      return true;
    });

    // Generate placeholder entries for missing dates in the range
    if (filter.startDate && filter.endDate) {
      const allDatesInRange = this.generateDateRange(filter.startDate, filter.endDate);
      const existingDates = new Set(filteredRealEntries.map(entry => 
        new Date(entry.date).toDateString()
      ));
      
      const placeholderEntries: TimeEntry[] = allDatesInRange
        .filter((date: Date) => !existingDates.has(date.toDateString()))
        .map((date: Date) => ({
          id: `placeholder-${date.toISOString()}`,
          userId: 'current-user',
          date: date,
          startTime: '',
          endTime: '',
          breakDuration: '',
          createdAt: new Date(),
          updatedAt: new Date()
        }));
      
      return [...filteredRealEntries, ...placeholderEntries]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    
    return filteredRealEntries;
  });

  sortedEntries = computed(() => {
    const entries = this.filteredEntries();
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

  timeEntries = computed(() => {
    const entries = this.displayedEntries();
    const page = this.pageState();
    const emptyRows = Math.max(0, page.pageSize - entries.length);
    
    const emptyEntries = Array(emptyRows).fill(null);
    return [...entries, ...emptyEntries];
  });

  isLoading = computed(() => this.loading());
  isEmpty = computed(() => !this.loading() && this.filteredEntries().length === 0);
  totalEntries = computed(() => this.filteredEntries().length);
  currentPageSize = computed(() => this.pageState().pageSize);
  currentPageIndex = computed(() => this.pageState().pageIndex);

  // Summary data computed signal
  summaryInfo = computed(() => {
    const entries = this.filteredEntries();
    const totalEntries = entries.length;
    
    const totalMinutes = entries.reduce((total, entry) => {
      const workedTime = this.calculateWorkedTime(entry.startTime, entry.endTime, entry.breakDuration);
      const [hours, minutes] = workedTime.split(':').map(Number);
      return total + (hours * 60) + minutes;
    }, 0);
    
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const totalHoursFormatted = `${totalHours}:${remainingMinutes.toString().padStart(2, '0')}`;
    
    const summary = { totalEntries, totalHours: totalHoursFormatted };
    
    setTimeout(() => this.summaryData.emit(summary), 0);
    
    return summary;
  });

  // Table configuration
  displayedColumns: string[] = ['date', 'startTime', 'endTime', 'breakDuration', 'totalWorkedTime', 'status', 'actions'];
  pageSizeOptions: number[] = [5, 10, 15];
  ngOnChanges(): void {
    if (this.dateFilter) {
      this.dateFilterSignal.set(this.dateFilter);
      setTimeout(() => this.summaryInfo(), 0);
    }
  }

  ngOnInit(): void {
    this.loadTimeEntries();
  }

  private loadTimeEntries(): void {
    this.loading.set(true);
    const pagination = { page: 1, pageSize: 100 };
    
    this.timeEntryService.getTimeEntries(pagination).subscribe({
      next: (response) => {
        this.allEntries.set(response.data);
        this.loading.set(false);
        this.summaryInfo();
      },
      error: (error) => {
        console.error('Error loading time entries:', error);
        this.loading.set(false);
      }
    });
  }

  refreshData(): void {
    this.loadTimeEntries();
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
    this.addEntry.emit();
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
    // Check if it's a placeholder entry
    if (this.isPlaceholderEntry(entry)) {
      return 'No Entry';
    }
    
    // If any required field is missing, it's not a complete entry
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

  getStatusClass(entry: TimeEntry): string {
    const status = this.getStatusText(entry);
    
    switch (status) {
      case 'Full Day':
        return 'status-full-day';
      case 'Partial Day':
        return 'status-partial-day';
      case 'Under Time':
        return 'status-under-time';
      case 'No Entry':
        return 'status-no-entry';
      default:
        return 'bg-gray-500 text-white';
    }
  }

  isPlaceholderEntry(entry: TimeEntry | null): boolean {
    if (!entry) return true;
    return entry.id.startsWith('placeholder-') || !entry.startTime || !entry.endTime;
  }

  isWeekendDay(date: Date): boolean {
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  shouldDisableActions(entry: TimeEntry | null): boolean {
    if (!entry) return true;
    return this.isWeekendDay(entry.date);
  }

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

  private parseTime(timeString: string): number {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
