import React, { useRef, useCallback } from 'react';
import { StyleSheet, Platform, View, Pressable, Animated, Text } from 'react-native';
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

interface TabButtonProps {
  children: React.ReactNode;
  onPress?: (...args: any[]) => void;
  onLongPress?: ((...args: any[]) => void) | null;
  style?: any;
  accessibilityState?: { selected?: boolean };
}

function AnimatedTabButton({
  children,
  onPress,
  onLongPress,
  style,
  accessibilityState,
}: TabButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.84,
      useNativeDriver: true,
      speed: 50,
      bounciness: 2,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 22,
      bounciness: 10,
    }).start();
  }, [scale]);

  const handlePress = useCallback(() => {
    haptics.selection();
    onPress?.();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, styles.tabButton]}
      android_ripple={{
        color: 'rgba(239,161,0,0.12)',
        borderless: true,
        radius: 32,
      }}
      accessibilityState={accessibilityState}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}

interface TabIconProps {
  icon: React.ReactNode;
  focused: boolean;
}

function TabIcon({ icon, focused }: TabIconProps) {
  return (
    <View style={styles.iconWrap}>
      {focused && <View style={styles.activePill} />}
      {icon}
    </View>
  );
}

export function AppTabs() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const role = user?.role;

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 12);
  const tabBarHeight = 58 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        lazy: false,

        tabBarStyle: [
          styles.tabBar,
          {
            height: tabBarHeight,
            paddingBottom: bottomInset,
          },
        ],

        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView tint="dark" intensity={90} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.androidBackground]} />
          ),

        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: 'rgba(138,146,166,0.7)',

        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarIconStyle: styles.tabIconStyle,
        tabBarButton: (props) => <AnimatedTabButton {...props} />,
      }}
    >
      {canAccessTab(role, 'Dashboard') && (
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            tabBarLabel: ({ color }) => (
              <Text style={[styles.tabLabel, { color }]}>Home</Text>
            ),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                focused={focused}
                icon={<Home size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />}
              />
            ),
          }}
        />
      )}

      {canAccessTab(role, 'Members') && (
        <Tab.Screen
          name="Members"
          component={MembersScreen}
          options={{
            tabBarLabel: ({ color }) => (
              <Text style={[styles.tabLabel, { color }]}>Members</Text>
            ),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                focused={focused}
                icon={<Users size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />}
              />
            ),
          }}
        />
      )}

      {canAccessTab(role, 'Attendance') && (
        <Tab.Screen
          name="Attendance"
          component={AttendanceScreen}
          options={{
            tabBarLabel: ({ color }) => (
              <Text style={[styles.tabLabel, { color }]}>Attendance</Text>
            ),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                focused={focused}
                icon={<UserCheck size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />}
              />
            ),
          }}
        />
      )}

      {canAccessTab(role, 'Payments') && (
        <Tab.Screen
          name="Payments"
          component={PaymentsScreen}
          options={{
            tabBarLabel: ({ color }) => (
              <Text style={[styles.tabLabel, { color }]}>Payments</Text>
            ),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                focused={focused}
                icon={<CreditCard size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />}
              />
            ),
          }}
        />
      )}

      {canAccessTab(role, 'Settings') && (
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarLabel: ({ color }) => (
              <Text style={[styles.tabLabel, { color }]}>More</Text>
            ),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                focused={focused}
                icon={<Settings size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />}
              />
            ),
          }}
        />
      )}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#0A0C10',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },

  androidBackground: {
    backgroundColor: '#0A0C10',
  },

  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },

  tabIconStyle: {
    alignSelf: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },

  tabLabel: {
    fontFamily: typography.fonts.inter,
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 0.2,
    textAlign: 'center',
    alignSelf: 'center',
    width: '100%',
    includeFontPadding: false,
  },

  iconWrap: {
    width: '100%',
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  activePill: {
    position: 'absolute',
    width: 44,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239,161,0,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(239,161,0,0.22)',
  },
});