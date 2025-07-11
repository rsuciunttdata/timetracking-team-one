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
    const entry = this.data.timeEntry;
    
    this.timeEntryForm = this.fb.group({
      date: [entry.date, [Validators.required]],
      startTime: [entry.startTime, [Validators.required, Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)]],
      endTime: [entry.endTime, [Validators.required, Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)]],
      breakDuration: [entry.breakDuration, [Validators.required, Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)]]
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
      const timeEntry: UpdateTimeEntryRequest = {
        id: this.data.timeEntry.id,
        userId: this.data.timeEntry.userId,
        date: formValue.date,
        startTime: formValue.startTime,
        endTime: formValue.endTime,
        breakDuration: formValue.breakDuration
      };

      // Simulate API call delay
      setTimeout(() => {
        this.submitting.set(false);
        this.dialogRef.close(timeEntry);
      }, 500);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onDelete(): void {
    if (confirm('Are you sure you want to delete this time entry?')) {
      this.dialogRef.close({ delete: true, id: this.data.timeEntry.id });
    }
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
}
