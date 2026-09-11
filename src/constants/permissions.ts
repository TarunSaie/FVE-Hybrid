import type { UserRole } from '@/types';
import { colors } from './colors';

export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  RECEPTIONIST: 'Receptionist',
  TRAINER: 'Trainer',
  ATTENDANCE_SCANNER: 'Attendance Profile',
};

export const ROLE_BADGE_STYLES: Record<UserRole, { bg: string; text: string; border: string }> = {
  OWNER: { bg: colors.goldMuted, text: colors.gold, border: colors.goldBorder },
  ADMIN: { bg: colors.blueMuted, text: colors.blueLight, border: colors.blueBorder },
  RECEPTIONIST: { bg: colors.successMuted, text: colors.success, border: colors.successBorder },
  TRAINER: { bg: 'rgba(168, 85, 247, 0.15)', text: colors.roleTrainer, border: 'rgba(168, 85, 247, 0.35)' },
  ATTENDANCE_SCANNER: { bg: 'rgba(6, 182, 212, 0.15)', text: colors.roleScanner, border: 'rgba(6, 182, 212, 0.35)' },
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  OWNER: 'Email-verified owner with complete system access',
  ADMIN: 'Manage members, payments, attendance, reports, and expenses',
  RECEPTIONIST: 'Handle member registration, plans, payments, and check-ins',
  TRAINER: 'Access attendance and member-facing operational views',
  ATTENDANCE_SCANNER: 'Kiosk profile for QR attendance scanning only',
};

export const PAGE_PERMISSIONS: Record<UserRole, string[]> = {
  OWNER: [
    'Dashboard',
    'Members',
    'Membership Plans',
    'Payments',
    'Attendance',
    'Reports',
    'Expenses',
    'Staff',
    'Notifications',
    'Settings',
  ],
  ADMIN: [
    'Dashboard',
    'Members',
    'Membership Plans',
    'Payments',
    'Attendance',
    'Reports',
    'Expenses',
    'Notifications',
    'Settings',
  ],
  RECEPTIONIST: ['Members', 'Membership Plans', 'Payments', 'Attendance', 'Notifications', 'Settings'],
  TRAINER: ['Attendance', 'Notifications', 'Settings'],
  ATTENDANCE_SCANNER: ['Attendance'],
};

export const ROLE_ALLOWED_ROUTES: Record<UserRole, string[]> = {
  OWNER: [
    '/',
    '/members',
    '/plans',
    '/payments',
    '/attendance',
    '/scanner',
    '/reports',
    '/expenses',
    '/staff',
    '/notifications',
    '/settings',
  ],
  ADMIN: [
    '/',
    '/members',
    '/plans',
    '/payments',
    '/attendance',
    '/scanner',
    '/reports',
    '/expenses',
    '/notifications',
    '/settings',
  ],
  RECEPTIONIST: ['/members', '/plans', '/payments', '/attendance', '/scanner', '/notifications', '/settings'],
  TRAINER: ['/attendance', '/scanner', '/notifications', '/settings'],
  ATTENDANCE_SCANNER: ['/attendance', '/scanner'],
};

export const TAB_PERMISSIONS: Record<UserRole, string[]> = {
  OWNER: ['Dashboard', 'Members', 'Attendance', 'Payments', 'Settings'],
  ADMIN: ['Dashboard', 'Members', 'Attendance', 'Payments', 'Settings'],
  RECEPTIONIST: ['Members', 'Attendance', 'Payments', 'Settings'],
  TRAINER: ['Attendance', 'Settings'],
  ATTENDANCE_SCANNER: ['Attendance'],
};

export const OWNER_MANAGED_ROLES: UserRole[] = [
  'ADMIN',
  'RECEPTIONIST',
  'TRAINER',
  'ATTENDANCE_SCANNER',
];

export function isChirvexInternalUser(email?: string | null, role?: string | null): boolean {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const isChirvexEmail =
    normalizedEmail.endsWith('@chirvex.in') ||
    normalizedEmail.endsWith('@chirvex.tech') ||
    normalizedEmail.endsWith('@chirvex.co') ||
    normalizedEmail.includes('chirvex');

  if (isChirvexEmail) return true;

  return (role || '').toUpperCase() === 'CHIRVEX_ADMIN' || (role || '').toUpperCase() === 'CHIRVEX_DEVELOPER';
}

export function canAccessBrandStudio(role: string | null | undefined, email?: string | null): boolean {
  return isChirvexInternalUser(email, role);
}

export function getRouteKey(pathname: string): string {
  if (pathname === '/') return '/';
  if (pathname.startsWith('/members/')) return '/members';
  if (pathname === '/scanner') return '/scanner';
  return pathname;
}

export function canAccessRoute(role: string | null | undefined, pathname: string, email?: string | null): boolean {
  if (!role || !(role in ROLE_ALLOWED_ROUTES)) return false;
  if (pathname === '/branding') return canAccessBrandStudio(role, email);
  return ROLE_ALLOWED_ROUTES[role as UserRole].includes(getRouteKey(pathname));
}

export function canAccessTab(role: string | null | undefined, tabName: string): boolean {
  if (!role || !(role in TAB_PERMISSIONS)) return false;
  return TAB_PERMISSIONS[role as UserRole].includes(tabName);
}

export function getDefaultTabForRole(role: string | null | undefined): string {
  if (!role || !(role in TAB_PERMISSIONS)) return 'Login';
  return TAB_PERMISSIONS[role as UserRole][0] || 'Login';
}

