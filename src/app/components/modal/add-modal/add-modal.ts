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

import { CreateTimeEntryRequest } from '../../../interfaces/time-entry.interface';
import { TimeEntryService } from '../../../services/time-entry.service';

interface AddModalData {
  prefilledDate?: Date;
}

@Component({
  selector: 'app-add-modal',
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
  templateUrl: './add-modal.html',
  styleUrl: './add-modal.css'
})
export class AddModal implements OnInit {
  private dialogRef = inject(MatDialogRef<AddModal>);
  private fb = inject(FormBuilder);
  private data = inject(MAT_DIALOG_DATA) as AddModalData;
  private timeEntryService = inject(TimeEntryService);

  // Form and signals
  timeEntryForm!: FormGroup;
  private formValues = signal<any>({});
  private submitting = signal(false);

  // Computed signals
  isFormValid = computed(() => this.timeEntryForm?.valid || false);
  isSubmitting = computed(() => this.submitting());
  previewWorkedTime = computed(() => {
    const values = this.formValues();
    if (values.startTime && values.endTime && values.breakStartTime && values.breakEndTime) {
      return this.calculateWorkedTime(values.startTime, values.endTime, values.breakStartTime, values.breakEndTime);
    }
    return '00:00';
  });

  // Validation error getters for template
  get startTimeError(): string | null {
    const control = this.timeEntryForm?.get('startTime');
    if (control?.errors && control.touched) {
      if (control.errors['required']) return 'Start time is required';
      if (control.errors['pattern']) return 'Invalid time format (HH:MM)';
    }
    return null;
  }

  get endTimeError(): string | null {
    const control = this.timeEntryForm?.get('endTime');
    if (control?.errors && control.touched) {
      if (control.errors['pattern']) return 'Invalid time format (HH:MM)';
      if (control.errors['endTimeBeforeStart']) return 'End time must be after start time';
      if (control.errors['workDayTooLong']) return 'Work day cannot exceed 24 hours';
    }
    return null;
  }

  get breakStartTimeError(): string | null {
    const control = this.timeEntryForm?.get('breakStartTime');
    if (control?.errors && control.touched) {
      if (control.errors['pattern']) return 'Invalid time format (HH:MM)';
      if (control.errors['breakOutsideWorkHours']) return 'Break must be within work hours';
      if (control.errors['incompleteBreakTime']) return 'Both break start and end times are required';
    }
    return null;
  }

  get breakEndTimeError(): string | null {
    const control = this.timeEntryForm?.get('breakEndTime');
    if (control?.errors && control.touched) {
      if (control.errors['pattern']) return 'Invalid time format (HH:MM)';
      if (control.errors['breakEndTimeBeforeStart']) return 'Break end time must be after break start time';
      if (control.errors['breakOutsideWorkHours']) return 'Break must be within work hours';
      if (control.errors['incompleteBreakTime']) return 'Both break start and end times are required';
      if (control.errors['breakTooLong']) return 'Break cannot exceed work hours';
    }
    return null;
  }

  ngOnInit(): void {
    this.initializeForm();
  }

  private initializeForm(): void {
    const prefilledDate = this.data?.prefilledDate || new Date();
    const currentTime = this.getCurrentTime();
    
    this.timeEntryForm = this.fb.group({
      date: [prefilledDate, [Validators.required]],
      startTime: [currentTime, [
        Validators.required, 
        Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      ]],
      endTime: ['', [
        Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      ]],
      breakStartTime: ['', [
        Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      ]],
      breakEndTime: ['', [
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

    // Subscribe to form changes
    this.timeEntryForm.valueChanges.subscribe(values => {
      this.formValues.set(values);
      // Revalidate dependent fields when any time field changes
      this.revalidateTimeFields();
    });

    this.formValues.set(this.timeEntryForm.value);
  }

  private revalidateTimeFields(): void {
    // Revalidate all time fields when any field changes
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
      return null; // End time is optional
    }

    const startTime = this.timeEntryForm.get('startTime')?.value;
    if (!startTime) {
      return null;
    }

    const startMinutes = this.parseTime(startTime);
    const endMinutes = this.parseTime(control.value);

    // End time must be after start time
    if (endMinutes <= startMinutes) {
      return { endTimeBeforeStart: true };
    }

    // Work day cannot exceed 24 hours
    const workDurationMinutes = endMinutes - startMinutes;
    if (workDurationMinutes > 24 * 60) {
      return { workDayTooLong: true };
    }

    return null;
  }

  private breakStartTimeValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value || !this.timeEntryForm) {
      return null; // Break start time is optional
    }

    const startTime = this.timeEntryForm.get('startTime')?.value;
    const endTime = this.timeEntryForm.get('endTime')?.value;
    const breakEndTime = this.timeEntryForm.get('breakEndTime')?.value;

    // If break start is provided but break end is not, show error
    if (control.value && !breakEndTime) {
      return { incompleteBreakTime: true };
    }

    // If we have work hours, validate break is within them
    if (startTime && endTime) {
      const startMinutes = this.parseTime(startTime);
      const endMinutes = this.parseTime(endTime);
      const breakStartMinutes = this.parseTime(control.value);

      // Break must be within work hours
      if (breakStartMinutes <= startMinutes || breakStartMinutes >= endMinutes) {
        return { breakOutsideWorkHours: true };
      }
    }

    return null;
  }

  private breakEndTimeValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value || !this.timeEntryForm) {
      return null; // Break end time is optional
    }

    const startTime = this.timeEntryForm.get('startTime')?.value;
    const endTime = this.timeEntryForm.get('endTime')?.value;
    const breakStartTime = this.timeEntryForm.get('breakStartTime')?.value;

    // If break end is provided but break start is not, show error
    if (control.value && !breakStartTime) {
      return { incompleteBreakTime: true };
    }

    // Break end must be after break start
    if (breakStartTime) {
      const breakStartMinutes = this.parseTime(breakStartTime);
      const breakEndMinutes = this.parseTime(control.value);

      if (breakEndMinutes <= breakStartMinutes) {
        return { breakEndTimeBeforeStart: true };
      }

      // Break cannot be longer than work duration
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

    // If we have work hours, validate break is within them
    if (startTime && endTime) {
      const startMinutes = this.parseTime(startTime);
      const endMinutes = this.parseTime(endTime);
      const breakEndMinutes = this.parseTime(control.value);

      // Break must be within work hours
      if (breakEndMinutes <= startMinutes || breakEndMinutes >= endMinutes) {
        return { breakOutsideWorkHours: true };
      }
    }

    return null;
  }

  onSave(): void {
    if (this.timeEntryForm.valid && !this.submitting()) {
      this.submitting.set(true);

      const formValue = this.timeEntryForm.value;
      
      const timeEntry: CreateTimeEntryRequest = {
        date: formValue.date,
        startTime: formValue.startTime
      };

      // Only add optional fields if they have values
      if (formValue.endTime) {
        timeEntry.endTime = formValue.endTime;
      }

      // Calculate break duration only if both break times are provided
      if (formValue.breakStartTime && formValue.breakEndTime) {
        const breakStart = this.parseTime(formValue.breakStartTime);
        const breakEnd = this.parseTime(formValue.breakEndTime);
        const breakDurationMinutes = breakEnd - breakStart;
        
        if (breakDurationMinutes > 0) {
          const breakHours = Math.floor(breakDurationMinutes / 60);
          const breakMins = breakDurationMinutes % 60;
          timeEntry.breakDuration = `${breakHours.toString().padStart(2, '0')}:${breakMins.toString().padStart(2, '0')}`;
        }
      }

      // Use the actual service to make HTTP request
      this.timeEntryService.createTimeEntry(timeEntry).subscribe({
        next: (createdEntry) => {
          this.submitting.set(false);
          this.dialogRef.close(createdEntry);
        },
        error: (error) => {
          console.error('Error creating time entry:', error);
          this.submitting.set(false);
          // Could show error message to user here
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  private calculateWorkedTime(startTime: string, endTime: string, breakStartTime: string, breakEndTime: string): string {
    const start = this.parseTime(startTime);
    const end = this.parseTime(endTime);
    const breakStart = this.parseTime(breakStartTime);
    const breakEnd = this.parseTime(breakEndTime);

    // Calculate break duration
    const breakDuration = breakEnd - breakStart;
    
    // If break times are invalid, return 00:00
    if (breakDuration < 0) {
      return '00:00';
    }

    const totalMinutes = end - start - breakDuration;
    
    if (totalMinutes < 0) {
      return '00:00';
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  private parseTime(timeString: string): number {
    if (!timeString || !timeString.includes(':')) return 0;
    
    const [hours, minutes] = timeString.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes)) return 0;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return 0;
    
    return hours * 60 + minutes;
  }

  private getCurrentTime(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
