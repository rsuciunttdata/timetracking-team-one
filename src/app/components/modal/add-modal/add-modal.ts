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
  userId?: string;
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
    if (values.startTime && values.endTime && values.breakDuration) {
      return this.calculateWorkedTime(values.startTime, values.endTime, values.breakDuration);
    }
    return '00:00';
  });

  ngOnInit(): void {
    this.initializeForm();
  }

  private initializeForm(): void {
    const prefilledDate = this.data?.prefilledDate || new Date();
    const currentTime = this.getCurrentTime();
    
    this.timeEntryForm = this.fb.group({
      date: [prefilledDate, [Validators.required]],
      startTime: [currentTime, [Validators.required, Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)]],
      endTime: ['', [Validators.required, Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)]],
      breakDuration: ['', [Validators.required, Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)]]
    });

    this.timeEntryForm.get('endTime')?.addValidators(this.endTimeValidator.bind(this));

    this.timeEntryForm.valueChanges.subscribe(values => {
      this.formValues.set(values);
    });

    this.formValues.set(this.timeEntryForm.value);
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

    if (endMinutes <= startMinutes) {
      return { endTimeBeforeStart: true };
    }

    return null;
  }

  onSave(): void {
    if (this.timeEntryForm.valid && !this.submitting()) {
      this.submitting.set(true);

      const formValue = this.timeEntryForm.value;
      const timeEntry: CreateTimeEntryRequest = {
        userId: this.data?.userId || 'current-user',
        date: formValue.date,
        startTime: formValue.startTime,
        endTime: formValue.endTime,
        breakDuration: formValue.breakDuration
      };

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
