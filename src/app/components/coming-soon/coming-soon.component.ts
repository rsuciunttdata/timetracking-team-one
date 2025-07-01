import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule
  ],
  templateUrl: './coming-soon.component.html',
  styleUrls: ['./coming-soon.component.css']
})
export class ComingSoonComponent {
  features = [
    { name: 'Team Collaboration', icon: 'group', completed: true },
    { name: 'Time Tracking', icon: 'schedule', completed: false },
    { name: 'Members Managment', icon: 'analytics', completed: false },
    { name: 'Mobile Friendly', icon: 'phone_android', completed: false },
    { name: 'API Integration', icon: 'api', completed: false }
  ];

  completedFeatures = this.features.filter(f => f.completed).length;
  totalFeatures = this.features.length;
  progressPercentage = Math.round((this.completedFeatures / this.totalFeatures) * 100);

  getCurrentDate(): string {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}
