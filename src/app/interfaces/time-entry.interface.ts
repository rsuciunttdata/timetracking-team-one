/**
 * Time Entry interfaces and types
 */

export type EntryStatus = 'completed_unsent' | 'completed_partially' | 'send_for_validation' | 'approved' | 'rejected' | 'placeholder';

export interface TimeEntry {
  id: string;
  userId: string;
  date: Date;
  startTime: string; // Required - Format: "HH:mm"
  endTime?: string;   // Optional - Format: "HH:mm"
  breakDuration?: number; // Optional - Duration in minutes
  createdAt: Date;
  updatedAt: Date;
  status: EntryStatus;
}

export interface CreateTimeEntryRequest {
  date: Date;
  startTime: string; // Required
  endTime?: string;   // Optional
  breakDuration?: number; // Optional - Duration in minutes
}

export interface CreateTimeEntryRequestWithUser extends CreateTimeEntryRequest {
  userId: string;
}

export interface UpdateTimeEntryRequest extends Partial<CreateTimeEntryRequest> {
  id: string;
  userId?: string; 
}

export interface TimeEntryFilter {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface TimeEntryResponse {
  data: TimeEntry[];
  total: number;
  page: number;
  pageSize: number;
}
