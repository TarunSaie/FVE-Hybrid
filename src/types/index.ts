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

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'SOFT_DELETE' | string;
  entity_name: string;
  entity_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface RecordArchive {
  id: string;
  entity_name: string;
  entity_id: string;
  archived_by: string | null;
  archived_at: string;
  retention_until: string;
  restored_at: string | null;
  snapshot: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
}

export interface DataRetentionPolicy {
  table_name: string;
  retention_days: number;
  is_active: boolean;
  updated_at: string;
}

export interface BrandConfig {
  id: string;
  gym_name: string;
  slogan: string;
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  secondary_color: string;
  page_title_prefix: string;
  logo_alt: string;
  accent_text_color: string;
  theme_mode: 'dark' | 'light' | 'system';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
