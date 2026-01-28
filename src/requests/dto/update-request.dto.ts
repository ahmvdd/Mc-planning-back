export class UpdateRequestDto {
  status?: 'pending' | 'approved' | 'rejected' | 'office';
  message?: string;
  documentUrl?: string;
  adminMessage?: string;
}
