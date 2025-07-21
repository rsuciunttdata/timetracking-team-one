import { Component, signal, effect } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatOptionModule } from '@angular/material/core';
import { TimesheetTableComponent } from '../../components/timesheet-table/timesheet-table.component';
import { TimeEntryService } from '../../services/time-entry.service';
import { TimeEntry } from '../../interfaces/time-entry.interface';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  selector: 'app-employer-dashboard',
  imports: [MatFormFieldModule, MatOptionModule, TimesheetTableComponent, CommonModule, MatSelectModule, MatIconModule, MatToolbarModule],
  templateUrl: './employer-dashboard.html',
  styleUrl: './employer-dashboard.css'
})
export class EmployerDashboard {
  username: string | null;

  users = signal<{ id: string; name: string }[]>([
    { id: 'u1', name: 'User 1' },
    { id: 'u2', name: 'User 2' },
    { id: 'u3', name: 'User 3' }
  ]);



  selectedUserId = signal<string | null>(null);
  entries = signal<TimeEntry[]>([]);

  constructor(private timeEntryService: TimeEntryService, private router: Router, private authService: AuthService) {
    effect(() => {
      const userId = this.selectedUserId();
      if (userId) {
        this.loadEntries(userId);
      }
    });
    this.username = this.authService.getUsername();

  }



  onUserSelect(userId: string) {
    this.selectedUserId.set(userId);
  }

  loadEntries(userId: string) {
    this.timeEntryService.getTimeEntries({ page: 1, pageSize: 100 }, { userId }).subscribe(res => {
      this.entries.set(res.data);
    });
  }

  validateEntry(entry: TimeEntry) {
    console.log(`Validated entry ${entry.id}`);
    // TODO: actualizare stare (ex: status: 'validated')
  }

  requestEdit(entry: TimeEntry) {
    console.log(`Request modification for entry ${entry.id}`);
    // TODO: marcaj stare sau comentariu
  }

  selectedUserName(): string {
    const user = this.users().find(u => u.id === this.selectedUserId());
    return user ? user.name : '';
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

}
