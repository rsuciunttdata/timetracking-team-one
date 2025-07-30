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
import { UserService, AppUser } from '../../services/user.service';

@Component({
  selector: 'app-employer-dashboard',
  imports: [MatFormFieldModule, MatOptionModule, TimesheetTableComponent, CommonModule, MatSelectModule, MatIconModule, MatToolbarModule],
  templateUrl: './employer-dashboard.html',
  styleUrl: './employer-dashboard.css'
})
export class EmployerDashboard {
  username: string | null;

  users = signal<AppUser[]>([]);

  selectedUserId = signal<string | null>(null);
  entries = signal<TimeEntry[]>([]);

  constructor(private timeEntryService: TimeEntryService, private router: Router, private authService: AuthService, private userService: UserService) {
    this.userService.getUsers().subscribe(users => {
      this.users.set(users);
    })

    effect(() => {
      const userId = this.selectedUserId();
      if (userId) {
        this.loadEntries(userId);
      }
    });
    this.username = this.authService.username();

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

  getTotalWorkedHours() {
    const entries = this.entries().filter(e => e.startTime && e.endTime);

    const totalMinutes = entries.reduce((sum, entry) => {
      const [h, m] = this.calculateWorkedTime(entry.startTime, entry.endTime, entry.breakDuration).split(':').map(Number);
      return sum + h * 60 + m;
    }, 0);

    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
  }

  calculateWorkedTime(start: string, end: string, breakDuration: string): string {
    const parse = (t: string) => {
      if (!t) return 0;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const total = parse(end) - parse(start) - parse(breakDuration);
    const h = Math.max(0, Math.floor(total / 60));
    const m = Math.max(0, total % 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
  }

}
