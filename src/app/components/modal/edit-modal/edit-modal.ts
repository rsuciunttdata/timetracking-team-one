import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { TimeEntry, UpdateTimeEntryRequest, CreateTimeEntryRequest } from '../../../interfaces/time-entry.interface';
import { TimeEntryService } from '../../../services/time-entry.service';

interface EditModalData {
  timeEntry: TimeEntry;
}

interface FieldValidation {
  errors: string[];
  warnings: string[];
}

@Component({
  selector: 'app-edit-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './edit-modal.html',
  styleUrl: './edit-modal.css'
})
export class EditModal implements OnInit {
  private dialogRef = inject(MatDialogRef<EditModal>);
  private fb = inject(FormBuilder);
  private data = inject(MAT_DIALOG_DATA) as EditModalData;
  private timeEntryService = inject(TimeEntryService);

  // Form and signals
  timeEntryForm!: FormGroup;
  private formValues = signal<any>({});
  private submitting = signal(false);
private currentEntryId = signal<string>(this.data.timeEntry.id);

protected formWarnings = signal<{ [key: string]: string[] }>({});

  // Computed signals
  isFormValid = computed(() => this.timeEntryForm?.valid || false);
  isSubmitting = computed(() => this.submitting());
isNewEntry = computed(() => !this.currentEntryId());
modalTitle = computed(() => this.isNewEntry() ? 'Create Time Entry' : 'Edit Time Entry');
isDifferentDate = computed(() => {
  if (!this.timeEntryForm) return false;
  const selectedDate = this.timeEntryForm.get('date')?.value;
  const originalDate = this.data.timeEntry.date;
  return selectedDate && !this.isSameDate(new Date(selectedDate), new Date(originalDate));
});
hasWarnings = computed(() => {
  const warnings = this.formWarnings();
  return Object.values(warnings).some(warningList => warningList.length > 0);
});

previewWorkedTime = computed(() => {
  const values = this.formValues();
  if (values.startTime && values.endTime && values.breakStartTime && values.breakEndTime) {
    return this.calculateWorkedTime(values.startTime, values.endTime, values.breakStartTime, values.breakEndTime);
  }
  if (values.startTime && values.endTime) {
    return this.calculateWorkedTime(values.startTime, values.endTime, values.breakDuration || '');
  }
  return '00:00';
});
    }
    return '00:00';
  });

  // Validation getters for template
  get startTimeValidation(): FieldValidation {
    const control = this.timeEntryForm?.get('startTime');
    const errors: string[] = [];
    const warnings: string[] = [];

    if (control?.errors && control.touched) {
      if (control.errors['required']) errors.push('Start time is required');
      if (control.errors['pattern']) errors.push('Invalid time format (HH:MM)');
    }

    return { errors, warnings };
  }

  get endTimeValidation(): FieldValidation {
    const control = this.timeEntryForm?.get('endTime');
    const errors: string[] = [];
    const warnings: string[] = [];

    if (control?.errors && control.touched) {
      if (control.errors['pattern']) errors.push('Invalid time format (HH:MM)');
      if (control.errors['endTimeBeforeStart']) errors.push('End time must be after start time');
      if (control.errors['workDayTooLong']) warnings.push('Work day exceeds 12 hours');
    }

    return { errors, warnings };
  }

  get breakStartTimeValidation(): FieldValidation {
    const control = this.timeEntryForm?.get('breakStartTime');
    const errors: string[] = [];
    const warnings: string[] = [];

    if (control?.errors && control.touched) {
      if (control.errors['pattern']) errors.push('Invalid time format (HH:MM)');
      if (control.errors['breakOutsideWorkHours']) errors.push('Break must be within work hours');
      if (control.errors['incompleteBreakTime']) errors.push('Both break start and end times are required');
    }

    return { errors, warnings };
  }

  get breakEndTimeValidation(): FieldValidation {
    const control = this.timeEntryForm?.get('breakEndTime');
    const errors: string[] = [];
    const warnings: string[] = [];

    if (control?.errors && control.touched) {
      if (control.errors['pattern']) errors.push('Invalid time format (HH:MM)');
      if (control.errors['breakEndTimeBeforeStart']) errors.push('Break end time must be after break start time');
      if (control.errors['breakOutsideWorkHours']) errors.push('Break must be within work hours');
      if (control.errors['incompleteBreakTime']) errors.push('Both break start and end times are required');
      if (control.errors['breakTooLong']) warnings.push('Break duration is unusually long (>4 hours)');
    }

    return { errors, warnings };
  }

  ngOnInit(): void {
    this.initializeForm();
  }

  private initializeForm(): void {
    const entry = this.data.timeEntry;
    
    let breakStartTime = '';
    let breakEndTime = '';
    
    if (entry.breakDuration && entry.startTime) {
      const workStartMinutes = this.parseTime(entry.startTime);
      const breakDurationMinutes = this.parseTime(entry.breakDuration || '00:00');
      const breakStartMinutes = workStartMinutes + 240; // 4 hours after start
      const breakEndMinutes = breakStartMinutes + breakDurationMinutes;
      
      breakStartTime = this.minutesToTime(breakStartMinutes);
      breakEndTime = this.minutesToTime(breakEndMinutes);
    }
    
    this.timeEntryForm = this.fb.group({
      date: [entry.date, [Validators.required]],
startTime: [entry.startTime, [
  Validators.required,
  Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
]],
endTime: [entry.endTime || '', [
  Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
]],
breakDuration: [entry.breakDuration || '', [
  Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
]],
breakStartTime: [breakStartTime, [
  Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
]],
breakEndTime: [breakEndTime, [
  Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
]]
    });

    // Add cross-field validators
    this.timeEntryForm.get('endTime')?.addValidators([
      this.endTimeValidator.bind(this)
    ]);
    
    this.timeEntryForm.get('breakStartTime')?.addValidators([
      this.breakStartTimeValidator.bind(this)
    ]);
    
    this.timeEntryForm.get('breakEndTime')?.addValidators([
      this.breakEndTimeValidator.bind(this)
    ]);

    // Watch for date changes and populate data for that date
    this.timeEntryForm.get('date')?.valueChanges.subscribe(newDate => {
      console.log('📅 Date changed to:', newDate);
      if (newDate) {
        this.loadDataForDate(new Date(newDate));
      }
    });

    this.timeEntryForm.valueChanges.subscribe(values => {
      console.log('📝 Form values changed:', values);
      this.formValues.set(values);
      this.updateWarnings();
      this.revalidateTimeFields();
    });

    this.formValues.set(this.timeEntryForm.value);
  }

  private updateWarnings(): void {
    const warnings: { [key: string]: string[] } = {};
    const values = this.formValues();

    // Check for work day duration warning
    if (values.startTime && values.endTime) {
      const startMinutes = this.parseTime(values.startTime);
      const endMinutes = this.parseTime(values.endTime);
      const workDuration = endMinutes - startMinutes;

      if (workDuration > 12 * 60) { // > 12 hours
        warnings['workDuration'] = ['Work day exceeds 12 hours'];
      } else if (workDuration > 10 * 60) { // > 10 hours but <= 12
        warnings['workDuration'] = ['Work day is longer than usual (>10 hours)'];
      }
    }

    // Check for break duration warning
    if (values.breakStartTime && values.breakEndTime) {
      const breakStart = this.parseTime(values.breakStartTime);
      const breakEnd = this.parseTime(values.breakEndTime);
      const breakDuration = breakEnd - breakStart;

      if (breakDuration > 4 * 60) { // > 4 hours
        warnings['breakDuration'] = ['Break duration is unusually long (>4 hours)'];
      } else if (breakDuration > 2 * 60) { // > 2 hours but <= 4
        warnings['breakDuration'] = ['Break duration is longer than usual (>2 hours)'];
      }
    }

    this.formWarnings.set(warnings);
  }

  private revalidateTimeFields(): void {
    const endTimeControl = this.timeEntryForm.get('endTime');
    const breakStartControl = this.timeEntryForm.get('breakStartTime');
    const breakEndControl = this.timeEntryForm.get('breakEndTime');

    if (endTimeControl && endTimeControl.value) {
      endTimeControl.updateValueAndValidity({ emitEvent: false });
    }
    if (breakStartControl && breakStartControl.value) {
      breakStartControl.updateValueAndValidity({ emitEvent: false });
    }
    if (breakEndControl && breakEndControl.value) {
      breakEndControl.updateValueAndValidity({ emitEvent: false });
    }
  }

  private endTimeValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value || !this.timeEntryForm) {
      return null;
    }

    const startTime = this.timeEntryForm.get('startTime')?.value;
    if (!startTime) {
      return null;
    }

    const startMinutes = this.parseTime(startTime);
    const endMinutes = this.parseTime(control.value);

    // ERRORS (prevent form submission)
    if (endMinutes <= startMinutes) {
      return { endTimeBeforeStart: true };
    }

    // Work day cannot exceed 24 hours (error)
    const workDurationMinutes = endMinutes - startMinutes;
    if (workDurationMinutes > 24 * 60) {
      return { workDayTooLong: true };
    }

    return null;
  }

  private breakStartTimeValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value || !this.timeEntryForm) {
      return null;
    }

    const startTime = this.timeEntryForm.get('startTime')?.value;
    const endTime = this.timeEntryForm.get('endTime')?.value;
    const breakEndTime = this.timeEntryForm.get('breakEndTime')?.value;

    // ERRORS (prevent form submission)
    if (control.value && !breakEndTime) {
      return { incompleteBreakTime: true };
    }

    if (startTime && endTime) {
      const startMinutes = this.parseTime(startTime);
      const endMinutes = this.parseTime(endTime);
      const breakStartMinutes = this.parseTime(control.value);

      if (breakStartMinutes <= startMinutes || breakStartMinutes >= endMinutes) {
        return { breakOutsideWorkHours: true };
      }
    }

    return null;
  }

  private breakEndTimeValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value || !this.timeEntryForm) {
      return null;
    }

    const startTime = this.timeEntryForm.get('startTime')?.value;
    const endTime = this.timeEntryForm.get('endTime')?.value;
    const breakStartTime = this.timeEntryForm.get('breakStartTime')?.value;

    // ERRORS (prevent form submission)
    if (control.value && !breakStartTime) {
      return { incompleteBreakTime: true };
    }

    if (breakStartTime) {
      const breakStartMinutes = this.parseTime(breakStartTime);
      const breakEndMinutes = this.parseTime(control.value);

      if (breakEndMinutes <= breakStartMinutes) {
        return { breakEndTimeBeforeStart: true };
      }

      // Break cannot exceed work duration (error)
      if (startTime && endTime) {
        const startMinutes = this.parseTime(startTime);
        const endMinutes = this.parseTime(endTime);
        const breakDuration = breakEndMinutes - breakStartMinutes;
        const workDuration = endMinutes - startMinutes;

        if (breakDuration >= workDuration) {
          return { breakTooLong: true };
        }
      }
    }

    if (startTime && endTime) {
      const startMinutes = this.parseTime(startTime);
      const endMinutes = this.parseTime(endTime);
      const breakEndMinutes = this.parseTime(control.value);

      if (breakEndMinutes <= startMinutes || breakEndMinutes >= endMinutes) {
        return { breakOutsideWorkHours: true };
      }
    }

    return null;
  }

  /**
   * Load time entry data for a specific date
   */
  private loadDataForDate(selectedDate: Date): void {
    console.log('🔄 Loading data for date:', selectedDate);
    
    const currentDate = new Date(this.data.timeEntry.date);
    if (this.isSameDate(selectedDate, currentDate)) {
      console.log('⏭️ Skipping reload - same date as current entry');
      return;
    }

    // Format date for API query (YYYY-MM-DD)
    const dateString = selectedDate.toISOString().split('T')[0];
    
    // TODO: Optimize - Add date filtering to API
    // Instead of: getTimeEntries(pagination)
    // Use: getTimeEntriesByDate(dateString) or getTimeEntries({date: dateString, ...pagination}) 
    // Maybe with a new service method when Backend is implemented
    
    const pagination = { page: 1, pageSize: 100 };
    
    this.timeEntryService.getTimeEntries(pagination).subscribe({
      next: (response) => {
        console.log('📊 Got entries response:', response.data.length, 'entries');
        
        // OPTIMIZATION NEEDED: This linear search could be improved
        // Current: O(n) - checks each entry sequentially
        // Better: Server-side filtering by date would be O(1) ✅
        const entryForDate = response.data.find(entry => {
          const entryDate = new Date(entry.date);
          const isDateMatch = this.isSameDate(entryDate, selectedDate);
          const currentUserId = localStorage.getItem('userId');
          const isAdmin = localStorage.getItem('role') === 'admin';
          const isUserMatch = isAdmin || entry.userId === currentUserId;
          return isDateMatch && isUserMatch;
        });

        if (entryForDate) {
          console.log('✅ Found entry for date:', entryForDate);
          this.currentEntryId.set(entryForDate.id);
          this.populateFormWithEntry(entryForDate);
        } else {
          console.log('❌ No entry found for this date, creating new entry template');
          this.currentEntryId.set('');
          this.populateFormWithDefaults();
        }
      },
      error: (error) => {
        console.error('Error loading entries for date:', error);
        this.populateFormWithDefaults();
      }
    });
  }

  /**
   * Check if two dates are the same (ignoring time)
   */
  private isSameDate(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  /**
   * Populate form with data from a specific entry
   */
  private populateFormWithEntry(entry: TimeEntry): void {
    console.log('📝 Populating form with entry:', entry);
    this.timeEntryForm.patchValue({
      startTime: entry.startTime,
      endTime: entry.endTime || '',
      breakDuration: entry.breakDuration || ''
    }, { emitEvent: false });
    
    this.formValues.set(this.timeEntryForm.value);
    console.log('📝 Form updated with values:', this.timeEntryForm.value);
  }

  /**
   * Populate form with default/empty values for a new entry
   */
  private populateFormWithDefaults(): void {
    console.log('🆕 Populating form with defaults');
    this.timeEntryForm.patchValue({
      startTime: '',
      endTime: '',
      breakDuration: ''
    }, { emitEvent: false });

    this.formValues.set(this.timeEntryForm.value);
    console.log('🆕 Form updated with default values:', this.timeEntryForm.value);
  }

  onSave(): void {
    if (this.timeEntryForm.valid && !this.submitting()) {
      this.submitting.set(true);

      const formValue = this.timeEntryForm.value;
const currentEntry = this.currentEntryId();
const formValue = this.timeEntryForm.getRawValue();

const baseRequest = {
  date: new Date(formValue.date),
  startTime: formValue.startTime,
  endTime: formValue.endTime || '',
  breakDuration: formValue.breakDuration || ''
};

// Compute breakDuration from breakStartTime and breakEndTime if available
if (formValue.breakStartTime && formValue.breakEndTime) {
  const breakStart = this.parseTime(formValue.breakStartTime);
  const breakEnd = this.parseTime(formValue.breakEndTime);
  const breakDurationMinutes = breakEnd - breakStart;

  if (breakDurationMinutes > 0) {
    const breakHours = Math.floor(breakDurationMinutes / 60);
    const breakMins = breakDurationMinutes % 60;
    baseRequest.breakDuration = `${breakHours.toString().padStart(2, '0')}:${breakMins.toString().padStart(2, '0')}`;
  }
}

if (currentEntry) {
  // Update existing entry
  const updateRequest: UpdateTimeEntryRequest = {
    id: currentEntry,
    ...baseRequest
  };

  this.timeEntryService.updateTimeEntry(updateRequest).subscribe({
    next: (updatedEntry) => {
      this.submitting.set(false);
      this.dialogRef.close({ action: 'update', data: updatedEntry });
    },
    error: (error) => {
      console.error('Error updating time entry:', error);
      this.submitting.set(false);
    }
  });
} else {
  // Create new entry
  const createRequest = {
    ...baseRequest
  };

  this.timeEntryService.createTimeEntry(createRequest).subscribe({
    next: (newEntry) => {
      this.submitting.set(false);
      this.dialogRef.close({ action: 'create', data: newEntry });
    },
    error: (error) => {
      console.error('Error creating time entry:', error);
      this.submitting.set(false);
    }
  });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onDelete(): void {
    const currentEntry = this.currentEntryId();
    
    if (!currentEntry) {
      // No entry to delete for this date
      return;
    }

    if (confirm('Are you sure you want to delete this time entry?')) {
      this.submitting.set(true);
      
const currentEntry = this.currentEntryId();

this.timeEntryService.deleteTimeEntry(currentEntry).subscribe({
  next: () => {
    this.submitting.set(false);
    this.dialogRef.close({ action: 'delete', data: { id: currentEntry } });
  },
  error: (error) => {
    console.error('Error deleting time entry:', error);
    this.submitting.set(false);
  }
});

        },
        error: (error) => {
          console.error('Error deleting time entry:', error);
          this.submitting.set(false);
        }
      });
    }
  }


  private calculateWorkedTime(startTime: string, endTime: string, breakStartTime: string, breakEndTime: string): string {
        // Validate input times
    if (!startTime || !endTime) {
      return '00:00';
    }
    const start = this.parseTime(startTime);
    const end = this.parseTime(endTime);
    const breakStart = this.parseTime(breakStartTime);
    const breakEnd = this.parseTime(breakEndTime);

    const breakDuration = breakEnd - breakStart;
    
    if (breakDuration < 0) {
      return '00:00';
    }

    // If parsing failed, return 00:00
    if (start === 0 && startTime !== '00:00') {
      return '00:00';
    }
    if (end === 0 && endTime !== '00:00') {
      return '00:00';
    }
    /*
    * DEPRECATED: Overnight work is no longer an option.
    */
    // Handle overnight work (end time is next day)
    let totalMinutes: number;
    if (end < start) {
      // Overnight shift: add 24 hours to end time
      totalMinutes = (end + 24 * 60) - start - breakTime;
    } else {
      // Same day shift
      totalMinutes = end - start - breakTime;
    }
    
    // Ensure we don't have negative time
    if (totalMinutes < 0) {
      return '00:00';
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  private parseTime(timeString: string): number {
    // Handle empty or undefined strings
    if (!timeString || timeString.trim() === '') return 0;
    
    // Handle strings that don't contain ':'
    if (!timeString.includes(':')) return 0;
    
    const parts = timeString.split(':');
    if (parts.length !== 2) return 0;
    
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    
    // Validate parsed numbers
    if (isNaN(hours) || isNaN(minutes)) return 0;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return 0;
    
    return hours * 60 + minutes;
  }

  private minutesToTime(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
}