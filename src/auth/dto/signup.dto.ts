export class SignupDto {
  name!: string;
  email!: string;
  password!: string;
  role!: string;
  status?: 'active' | 'inactive';
  orgName?: string;
  orgCode?: string;
}