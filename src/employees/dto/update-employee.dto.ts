export class UpdateEmployeeDto {
  name?: string;
  email?: string;
  role?: string;
  status?: 'active' | 'inactive';
}
