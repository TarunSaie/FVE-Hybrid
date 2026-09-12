export interface AuthUser {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
  phone: string | null;
  isStaffProfile?: boolean;
}

export interface Member {
  id: string;
  member_id?: string | null;
  full_name: string;
  mobile: string | null;
  email: string | null;
  age: number | null;
  date_of_birth?: string | null;
  gender: string | null;
  address: string | null;
  emergency_contact: string | null;
  profile_photo: string | null;
  joining_date: string | null;
  notes: string | null;
  height: string | null;
  weight: string | null;
  blood_group: string | null;
  qr_code: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberWithMembership extends Member {
  membership_id?: string | null;
  plan_id?: string | null;
  membership_start_date?: string | null;
  membership_expiry_date?: string | null;
  membership_status?: string | null;
  plan_name?: string | null;
  expiry_sort_group?: number | null;
  member_id_num?: number | null;
}

export interface MembershipPlan {
  id: string;
  name: string;
  duration_type: string;
  duration_days: number;
  price: number;
  features: string[] | null;
  active: boolean | null;
  visit_day_limit?: number | null;
  created_at: string;
}

export interface Membership {
  id: string;
  member_id: string;
  plan_id: string;
  start_date: string;
  expiry_date: string;
  status: string | null;
  visit_day_limit?: number | null;
  visit_days_used?: number | null;
  created_at: string;
  membership_plans?: MembershipPlan;
  members?: Member;
}

export interface Payment {
  id: string;
  member_id: string;
  membership_id: string | null;
  amount: number;
  payment_method: string;
  transaction_reference: string | null;
  received_by: string | null;
  payment_date: string | null;
  receipt_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string | null;
  members?: Member;
  memberships?: Membership & { membership_plans?: MembershipPlan };
}

export interface Attendance {
  id: string;
  member_id: string;
  date: string | null;
  check_in_time: string | null;
  marked_by: string | null;
  check_in_method: 'QR' | 'MANUAL' | string | null;
  manual_note: string | null;
  created_at: string;
  members?: Member;
}

export interface Expense {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string | null;
  created_by: string | null;
  created_at: string;
}

export interface WorkoutPlan {
  id: string;
  member_id: string;
  trainer_id: string | null;
  title: string;
  description: string | null;
  exercises: unknown;
  created_at: string;
  members?: Member;
}

export interface Notification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: string | null;
  read: boolean | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  username: string | null;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  avatar_url: string | null;
}

export type UserRole = 'OWNER' | 'ADMIN' | 'RECEPTIONIST' | 'TRAINER' | 'ATTENDANCE_SCANNER';

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer'] as const;
export const EXPENSE_CATEGORIES = ['Rent', 'Electricity', 'Equipment', 'Salaries', 'Maintenance', 'Marketing', 'Other'] as const;
export const MEMBERSHIP_STATUSES = ['ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'HOLD'] as const;
export const USER_ROLES: UserRole[] = ['OWNER', 'ADMIN', 'RECEPTIONIST', 'TRAINER', 'ATTENDANCE_SCANNER'];
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export type PersonalTrainingStatus = 'REQUESTED' | 'PENDING_PAYMENT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface PersonalTrainingPlan {
  id: string;
  name: string;
  total_sessions: number;
  duration_days: number;
  price: string | number;
  description?: string | null;
  features?: string[] | string | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PersonalTraining {
  id: string;
  member_id: string;
  membership_id: string | null;
  trainer_id: string | null;
  package_name: string;
  total_sessions: number;
  sessions_completed: number;
  price: string | number;
  status: PersonalTrainingStatus;
  start_date: string | null;
  expiry_date: string | null;
  special_goals: string | null;
  notes: string | null;
  payment_id: string | null;
  created_at: string;
  updated_at?: string | null;
  members?: Member;
  memberships?: Membership & { membership_plans?: MembershipPlan };
  trainer?: UserProfile;
  payments?: Payment;
}

export type PTSessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface PTSession {
  id: string;
  personal_training_id: string;
  member_id: string;
  trainer_id: string;
  session_date: string;
  start_time: string;
  end_time?: string | null;
  status: PTSessionStatus;
  workout_notes?: string | null;
  feedback?: string | null;
  completed_at?: string | null;
  created_by?: string | null;
  created_at: string;
  members?: Member;
  trainer?: UserProfile;
  personal_training?: PersonalTraining;
}

export type PlanChangeStatus = 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
export type PlanChangeValidityMode = 'FROM_START_DATE' | 'FROM_EXPIRY' | 'FROM_TODAY' | 'CUSTOM';

export interface PlanChangeRequest {
  id: string;
  member_id: string;
  membership_id: string | null;
  current_plan_id: string | null;
  requested_plan_id: string;
  amount_already_paid: string | number;
  new_plan_price: string | number;
  balance_amount: string | number;
  validity_mode: PlanChangeValidityMode;
  calculated_expiry_date: string | null;
  status: PlanChangeStatus;
  notes: string | null;
  rejection_reason?: string | null;
  requested_by_role?: string | null;
  requested_by?: string | null;
  approved_by?: string | null;
  payment_id?: string | null;
  created_at: string;
  updated_at?: string | null;
  members?: Member;
  current_plan?: MembershipPlan;
  requested_plan?: MembershipPlan;
  memberships?: Membership & { membership_plans?: MembershipPlan };
  payments?: Payment;
  approver?: UserProfile;
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export interface DietMeal {
  name: string;
  time?: string;
  items: string;
}

export type DietPlanStatus = 'ACTIVE' | 'INACTIVE';
export type DietPlanType = 'DAILY' | 'WEEKLY';

export interface DietPlan {
  id: string;
  member_id: string;
  personal_training_id: string;
  trainer_id?: string | null;
  title: string;
  goal?: string | null;
  daily_calories?: number | null;
  protein_grams?: number | null;
  carbs_grams?: number | null;
  fats_grams?: number | null;
  water_liters?: number | null;
  plan_type?: DietPlanType;
  meals: DietMeal[];
  weekly_schedule?: Partial<Record<DayOfWeek, DietMeal[]>> | null;
  instructions?: string | null;
  supplements?: string | null;
  status: DietPlanStatus;
  start_date?: string | null;
  end_date?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
  members?: Member;
  personal_training?: PersonalTraining;
  trainer?: UserProfile;
}

