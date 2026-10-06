export interface AttendanceMessageTemplate {
  id: string;
  title: string;
  category: 'DAILY_ABSENT' | 'CONTINUOUS_ABSENT' | 'MOTIVATION' | 'ASSISTANCE';
  template: string;
}

export const ATTENDANCE_TEMPLATES: AttendanceMessageTemplate[] = [
  {
    id: 'daily_miss',
    title: 'Friendly Daily Check-in',
    category: 'DAILY_ABSENT',
    template: 'Hi {name}, we noticed you missed your workout today at FitVerse Elite! Consistency is the secret to great transformation. Hope to see you back tomorrow! 💪',
  },
  {
    id: 'continuous_absence',
    title: 'Continuous Absence (3+ Days)',
    category: 'CONTINUOUS_ABSENT',
    template: "Hi {name}, we have missed seeing you at FitVerse Elite over the past {days} days! We hope everything is well. Don't lose your fitness momentum—let us know if we can help you get back on track! 🏋️‍♂️",
  },
  {
    id: 'motivation_push',
    title: 'Workout Motivation',
    category: 'MOTIVATION',
    template: "Hey {name}! Your workout routine is waiting for you at FitVerse Elite. Consistency beats motivation every time. Let's make this week count! 🔥",
  },
  {
    id: 'schedule_support',
    title: 'Schedule & Timing Support',
    category: 'ASSISTANCE',
    template: "Hello {name}, greetings from FitVerse Elite! If your busy schedule is holding you back, let us adjust your workout timings or routine. We are here to support your fitness journey! 🌟",
  },
];

export function resolveAttendanceMessage(
  template: string,
  name: string,
  daysAbsent: number = 1
): string {
  const firstName = name.trim().split(' ')[0] || name;
  return template
    .replace(/{name}/g, firstName)
    .replace(/{days}/g, String(Math.max(1, daysAbsent)));
}
