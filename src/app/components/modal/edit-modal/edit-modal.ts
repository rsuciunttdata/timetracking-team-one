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

import { TimeEntry, UpdateTimeEntryRequest } from '../../../interfaces/time-entry.interface';
import { TimeEntryService } from '../../../services/time-entry.service';

interface EditModalData {
  timeEntry: TimeEntry;
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

  ngOnInit(): void {
    this.initializeForm();
  }

  private initializeForm(): void {
    const entry = this.data.timeEntry;
    
    // Handle existing break duration for editing
    let breakStartTime = '';
    let breakEndTime = '';
    
    if (entry.breakDuration && entry.startTime) {
      const workStartMinutes = this.parseTime(entry.startTime);
      const breakDurationMinutes = this.parseTime(entry.breakDuration);
      const breakStartMinutes = workStartMinutes + 240; // 4 hours after start
      const breakEndMinutes = breakStartMinutes + breakDurationMinutes;
      
      breakStartTime = this.minutesToTime(breakStartMinutes);
      breakEndTime = this.minutesToTime(breakEndMinutes);
    }
    
    this.timeEntryForm = this.fb.group({
      date: [entry.date, [Validators.required]],
      startTime: [entry.startTime, [Validators.required, Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)]],
      endTime: [entry.endTime || '', [Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)]], // Optional
      breakStartTime: [breakStartTime, [Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)]], // Optional
      breakEndTime: [breakEndTime, [Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)]] // Optional
    });

    this.timeEntryForm.get('endTime')?.addValidators(this.endTimeValidator.bind(this));
    this.timeEntryForm.get('breakEndTime')?.addValidators(this.breakEndTimeValidator.bind(this));

    this.timeEntryForm.valueChanges.subscribe(values => {
      this.formValues.set(values);
    });
    this.formValues.set(this.timeEntryForm.value);
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

    if (endMinutes <= startMinutes) {
      return { endTimeBeforeStart: true };
    }

    return null;
  }

  private breakEndTimeValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value || !this.timeEntryForm) {
      return null; // Break end time is optional
    }

    const breakStartTime = this.timeEntryForm.get('breakStartTime')?.value;
    if (!breakStartTime) {
      return null;
    }

    const breakStartMinutes = this.parseTime(breakStartTime);
    const breakEndMinutes = this.parseTime(control.value);

    if (breakEndMinutes <= breakStartMinutes) {
      return { breakEndTimeBeforeStart: true };
    }

    return null;
  }

  onSave(): void {
    if (this.timeEntryForm.valid && !this.submitting()) {
      this.submitting.set(true);

      const formValue = this.timeEntryForm.value;
      
      const timeEntry: UpdateTimeEntryRequest = {
        id: this.data.timeEntry.id,
        date: new Date(formValue.date),
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
      this.timeEntryService.updateTimeEntry(timeEntry).subscribe({
        next: (updatedEntry) => {
          this.submitting.set(false);
          this.dialogRef.close({ action: 'update', data: updatedEntry });
        },
        error: (error) => {
          console.error('Error updating time entry:', error);
          this.submitting.set(false);
          // Could show error message to user here
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onDelete(): void {
    if (confirm('Are you sure you want to delete this time entry?')) {
      this.submitting.set(true);
      
      // Use the actual service to make HTTP request
      this.timeEntryService.deleteTimeEntry(this.data.timeEntry.id).subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogRef.close({ action: 'delete', data: { id: this.data.timeEntry.id } });
        },
        error: (error) => {
          console.error('Error deleting time entry:', error);
          this.submitting.set(false);
          // Could show error message to user here
        }
      });
    }
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

  private minutesToTime(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
}