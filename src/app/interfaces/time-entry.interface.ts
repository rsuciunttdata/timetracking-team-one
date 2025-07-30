/**
 * Time Entry interfaces and types
 */

export interface TimeEntry {
  id: string;
  userId: string;
  date: Date;
  startTime: string; // Required - Format: "HH:mm"
  endTime?: string;   // Optional - Format: "HH:mm"
  breakDuration?: string; // Optional - Format: "HH:mm"
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTimeEntryRequest {
  date: Date;
  startTime: string; // Required
  endTime?: string;   // Optional
  breakDuration?: string; // Optional
}

export interface CreateTimeEntryRequestWithUser extends CreateTimeEntryRequest {
  userId: string;
}

export interface UpdateTimeEntryRequest extends Partial<CreateTimeEntryRequest> {
  id: string;
  userId?: string; 
}

export interface TimeEntryFormData {
  date: Date;
  startTime: string; // Required
  endTime?: string;   // Optional
  breakStartTime?: string; // Optional
  breakEndTime?: string;   // Optional
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
