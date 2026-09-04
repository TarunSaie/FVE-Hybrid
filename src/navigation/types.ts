import { NavigatorScreenParams } from '@react-navigation/native';
import { MemberWithMembership, Payment } from '@/types';

export type MainTabParamList = {
  Dashboard: undefined;
  Members: undefined;
  Attendance: undefined;
  Payments: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  MemberDetail: { memberId: string; initialMember?: MemberWithMembership };
  PaymentReceipt: { paymentId?: string; payment?: Payment };
  QRScanner: undefined;
  MembershipPlans: undefined;
  Expenses: undefined;
  Reports: undefined;
  Staff: undefined;
  Notifications: undefined;
};
