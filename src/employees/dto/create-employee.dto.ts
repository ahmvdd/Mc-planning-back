export class CreateEmployeeDto {
  name!: string;
  email!: string;
  role!: string;
  status?: 'active' | 'inactive';
  password?: string;
}
