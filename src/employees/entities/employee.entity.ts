export type EmployeeStatus = 'active' | 'inactive';

export interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  status: EmployeeStatus;
  password: string;
  refreshTokenHash?: string | null;
}
