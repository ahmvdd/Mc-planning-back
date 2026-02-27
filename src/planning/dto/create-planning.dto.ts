export class CreatePlanningDto {
  date!: string;
  shift!: string;
  employeeId?: number;
  note?: string;
  planningId?: number;
}
