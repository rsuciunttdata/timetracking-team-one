/**
 * Time Entry interfaces and types
 */

export type EntryStatus = 'completed_unsent' | 'completed_partially' | 'send_for_validation' | 'approved' | 'rejected' | 'placeholder';

export interface TimeEntry {
  id: string;
  userId: string;
  date: Date;
  startTime: string; // Format: "HH:mm"
  endTime: string;   // Format: "HH:mm"
  breakDuration: string; // Format: "HH:mm"
  createdAt: Date;
  updatedAt: Date;
  status: EntryStatus;
}

export interface CreateTimeEntryRequest {
  userId: string;
  date: Date;
  startTime: string;
  endTime: string;
  breakDuration: string;
}

export interface UpdateTimeEntryRequest extends Partial<CreateTimeEntryRequest> {
  id: string;
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
