export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface RequestItem {
  id: number;
  employeeId: number;
  type: string;
  status: RequestStatus;
  message?: string;
  documentUrl?: string;
  createdAt: string;
}
