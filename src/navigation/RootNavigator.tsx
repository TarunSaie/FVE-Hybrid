import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/contexts/AuthContext';
import { FVELoading } from '@/components/common/FVELoading';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { AppTabs } from './AppTabs';
import { MemberDetailScreen } from '@/screens/members/MemberDetailScreen';
import { PaymentReceiptScreen } from '@/screens/payments/PaymentReceiptScreen';
import { QRScannerScreen } from '@/screens/attendance/QRScannerScreen';
import { MembershipPlansScreen } from '@/screens/plans/MembershipPlansScreen';
import { ExpensesScreen } from '@/screens/expenses/ExpensesScreen';
import { ReportsScreen } from '@/screens/reports/ReportsScreen';
import { StaffScreen } from '@/screens/staff/StaffScreen';
import { NotificationsScreen } from '@/screens/notifications/NotificationsScreen';
import { RootStackParamList } from './types';
import { useNotificationSoundListener } from '@/hooks/useNotificationSoundListener';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, loading } = useAuth();

  // Listen globally for incoming notifications and play chime sound
  useNotificationSoundListener();

  if (loading) {
    return <FVELoading message="AUTHENTICATING PROFILE" />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={AppTabs} />
          <Stack.Screen name="MemberDetail" component={MemberDetailScreen} />
          <Stack.Screen name="PaymentReceipt" component={PaymentReceiptScreen} />
          <Stack.Screen
            name="QRScanner"
            component={QRScannerScreen}
            options={{ presentation: 'fullScreenModal' }}
          />
          <Stack.Screen name="MembershipPlans" component={MembershipPlansScreen} />
          <Stack.Screen name="Expenses" component={ExpensesScreen} />
          <Stack.Screen name="Reports" component={ReportsScreen} />
          <Stack.Screen name="Staff" component={StaffScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
