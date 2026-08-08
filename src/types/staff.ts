export type StaffMember = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  dateBirth: string;
  salary: number;
  role: "ADMIN" | "EMPLOYEE";
  createdBy: { firstName: string; lastName: string } | null;
};