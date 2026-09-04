import React from 'react';
import { StyleSheet, Platform, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Home, Users, UserCheck, CreditCard, Settings } from 'lucide-react-native';
import { DashboardScreen } from '@/screens/dashboard/DashboardScreen';
import { MembersScreen } from '@/screens/members/MembersScreen';
import { AttendanceScreen } from '@/screens/attendance/AttendanceScreen';
import { PaymentsScreen } from '@/screens/payments/PaymentsScreen';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessTab } from '@/constants/permissions';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function AppTabs() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const role = user?.role;

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8);
  const tabBarHeight = 54 + bottomInset;

  const tabPressListener = {
    tabPress: () => {
      haptics.selection();
    },
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: tabBarHeight,
            paddingBottom: bottomInset,
          },
        ],
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView tint="dark" intensity={85} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.androidBackground]} />
          ),
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: '#8A92A6',
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      {canAccessTab(role, 'Dashboard') && (
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          listeners={tabPressListener}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Home size={23} color={color} strokeWidth={focused ? 2.4 : 1.7} />
            ),
          }}
        />
      )}

      {canAccessTab(role, 'Members') && (
        <Tab.Screen
          name="Members"
          component={MembersScreen}
          listeners={tabPressListener}
          options={{
            tabBarLabel: 'Members',
            tabBarIcon: ({ color, focused }) => (
              <Users size={23} color={color} strokeWidth={focused ? 2.4 : 1.7} />
            ),
          }}
        />
      )}

      {canAccessTab(role, 'Attendance') && (
        <Tab.Screen
          name="Attendance"
          component={AttendanceScreen}
          listeners={tabPressListener}
          options={{
            tabBarLabel: 'Attendance',
            tabBarIcon: ({ color, focused }) => (
              <UserCheck size={23} color={color} strokeWidth={focused ? 2.4 : 1.7} />
            ),
          }}
        />
      )}

      {canAccessTab(role, 'Payments') && (
        <Tab.Screen
          name="Payments"
          component={PaymentsScreen}
          listeners={tabPressListener}
          options={{
            tabBarLabel: 'Payments',
            tabBarIcon: ({ color, focused }) => (
              <CreditCard size={23} color={color} strokeWidth={focused ? 2.4 : 1.7} />
            ),
          }}
        />
      )}

      {canAccessTab(role, 'Settings') && (
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          listeners={tabPressListener}
          options={{
            tabBarLabel: 'More',
            tabBarIcon: ({ color, focused }) => (
              <Settings size={23} color={color} strokeWidth={focused ? 2.4 : 1.7} />
            ),
          }}
        />
      )}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#0B0D12',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    paddingTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 16,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  androidBackground: {
    backgroundColor: '#0B0D12',
  },
  tabItem: {
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: typography.fonts.inter,
    fontWeight: '600',
    fontSize: 10.5,
    letterSpacing: 0.3,
    marginTop: 3,
  },
});
