export class CreateAvailabilityDto {
  dayOfWeek!: number; // 0 = lundi ... 6 = dimanche
  startTime!: string; // "09:00"
  endTime!: string; // "17:00"
}
