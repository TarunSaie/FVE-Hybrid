import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Apple,
  Flame,
  Droplets,
  Plus,
  Trash2,
  Clock,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Dumbbell,
  Lock,
  Copy,
  Calendar,
} from 'lucide-react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { FVEBadge } from '@/components/common/FVEBadge';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';
import {
  DietPlan,
  DietMeal,
  Member,
  UserProfile,
  DayOfWeek,
  DAYS_OF_WEEK,
  DietPlanType,
} from '@/types';
import {
  openWhatsAppLink,
  buildDailyDietPlanWhatsAppMessage,
  getTodayDayOfWeek,
  getFriendlyErrorMessage,
} from '@/utils/format';
import { getLocalDateStr } from '@/utils/date';

interface DietPlanModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingDiet?: DietPlan | null;
  initialMemberId?: string;
  initialPTId?: string;
}

const DIET_PRESETS = [
  {
    name: 'Fat Loss — High Protein',
    goal: 'Fat Loss & Muscle Retention',
    calories: 1900,
    protein: 165,
    carbs: 160,
    fats: 50,
    water: 3.5,
    supplements: 'Whey Protein Isolate (1 scoop post-workout), Multivitamin, Omega-3 Fish Oil',
    instructions: 'Maintain a 300-400 kcal deficit. Drink 500ml water upon waking. Stop eating 2 hours before bedtime.',
    meals: [
      { name: 'Breakfast', time: '08:00 AM', items: '4 boiled egg whites + 1 whole egg, 2 slices whole wheat toast, 1 black coffee or green tea' },
      { name: 'Mid-Morning Snack', time: '11:00 AM', items: '1 apple or bowl of papaya, 10-12 raw almonds' },
      { name: 'Lunch', time: '01:30 PM', items: '150g grilled chicken breast (or 200g low-fat paneer/tofu), 1 cup brown rice, large bowl green salad' },
      { name: 'Evening / Pre-Workout', time: '05:30 PM', items: '1 scoop whey protein in water or 1 banana + black coffee' },
      { name: 'Dinner', time: '08:30 PM', items: '150g grilled fish or boiled soya chunks, sautéed broccoli, beans, and spinach' },
    ],
  },
  {
    name: 'Lean Muscle Bulk',
    goal: 'Lean Muscle Hypertrophy',
    calories: 2700,
    protein: 180,
    carbs: 320,
    fats: 70,
    water: 4.0,
    supplements: 'Whey Protein, Creatine Monohydrate (5g daily), Ashwagandha, Multivitamin',
    instructions: 'Caloric surplus of +300 kcal. Take creatine daily with carbohydrates. Prioritize 7-8 hours deep sleep for maximum protein synthesis.',
    meals: [
      { name: 'Breakfast', time: '08:00 AM', items: '3 whole eggs + 3 egg whites omelette, 1 cup rolled oats with peanut butter and 1 sliced banana' },
      { name: 'Mid-Morning Snack', time: '11:30 AM', items: '1 cup Greek yogurt or hung curd with berries and chia seeds' },
      { name: 'Lunch', time: '01:30 PM', items: '200g chicken breast or paneer, 2 cups basmati rice or 3 chapatis, 1 cup dal, salad' },
      { name: 'Pre-Workout Snack', time: '05:00 PM', items: '2 brown bread slices with peanut butter and sliced banana' },
      { name: 'Post-Workout Shake', time: '07:00 PM', items: '1 scoop whey protein isolate + 5g creatine in water or milk' },
      { name: 'Dinner', time: '09:00 PM', items: '180g paneer or grilled fish, 2 chapatis, mixed steamed vegetables and curd' },
    ],
  },
  {
    name: 'Vegetarian High-Protein',
    goal: 'Vegetarian Muscle Building & Toning',
    calories: 2150,
    protein: 145,
    carbs: 235,
    fats: 60,
    water: 3.5,
    supplements: 'Plant / Whey Protein (1 scoop), Vitamin B12, Vitamin D3, Creatine Monohydrate',
    instructions: 'Combine diverse protein sources (soya, paneer, sprouts, dal) to ensure a complete amino acid profile throughout the day.',
    meals: [
      { name: 'Breakfast', time: '08:00 AM', items: '1.5 cups moong dal chilla with 50g paneer filling, green mint chutney, green tea' },
      { name: 'Mid-Morning Snack', time: '11:00 AM', items: '1 bowl boiled sprouts salad with cucumber, tomato, lime, and roasted flax seeds' },
      { name: 'Lunch', time: '01:30 PM', items: '150g grilled low-fat paneer, 1 cup thick yellow dal, 2 multigrain rotis, fresh cucumber salad' },
      { name: 'Evening / Pre-Workout', time: '05:30 PM', items: '1 scoop whey protein with water or almond milk, 1 banana, 5 walnuts' },
      { name: 'Dinner', time: '08:30 PM', items: '60g Nutrela soya chunks curry (cooked with veggies), 1 bowl stir-fried tofu or paneer' },
    ],
  },
  {
    name: 'Clean Maintenance',
    goal: 'Endurance, Mobility & Body Recomposition',
    calories: 2200,
    protein: 150,
    carbs: 225,
    fats: 65,
    water: 3.2,
    supplements: 'Multivitamin, Omega-3, Electrolytes on heavy training days',
    instructions: 'Eat balanced whole foods. Keep hydration consistent throughout training sessions. Limit processed oils and refined sugars.',
    meals: [
      { name: 'Breakfast', time: '08:00 AM', items: '2 boiled eggs or tofu scramble, 1 avocado/peanut butter toast, seasonal fruit' },
      { name: 'Mid-Morning Snack', time: '11:00 AM', items: 'Handful of mixed nuts (almonds, walnuts) and 1 glass coconut water' },
      { name: 'Lunch', time: '01:30 PM', items: 'Grilled chicken/paneer bowl with quinoa or brown rice, steamed broccoli' },
      { name: 'Evening Snack', time: '05:30 PM', items: 'Roasted makhana or boiled chana with lemon and green tea' },
      { name: 'Dinner', time: '08:30 PM', items: 'Clear vegetable or chicken soup, 150g grilled protein with mixed vegetable stir-fry' },
    ],
  },
];

export function DietPlanModal({
  visible,
  onClose,
  onSuccess,
  existingDiet,
  initialMemberId,
  initialPTId,
}: DietPlanModalProps) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Form State
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    existingDiet?.member_id || initialMemberId || ''
  );
  const [selectedPTId, setSelectedPTId] = useState<string>(
    existingDiet?.personal_training_id || initialPTId || ''
  );
  const [trainerId, setTrainerId] = useState<string>(existingDiet?.trainer_id || '');
  const [title, setTitle] = useState<string>(existingDiet?.title || 'Daily High-Protein Diet Plan');
  const [goal, setGoal] = useState<string>(existingDiet?.goal || 'Fat Loss & Lean Muscle');
  const [calories, setCalories] = useState<string>(existingDiet?.daily_calories ? String(existingDiet.daily_calories) : '2000');
  const [protein, setProtein] = useState<string>(existingDiet?.protein_grams ? String(existingDiet.protein_grams) : '160');
  const [carbs, setCarbs] = useState<string>(existingDiet?.carbs_grams ? String(existingDiet.carbs_grams) : '180');
  const [fats, setFats] = useState<string>(existingDiet?.fats_grams ? String(existingDiet.fats_grams) : '55');
  const [water, setWater] = useState<string>(existingDiet?.water_liters ? String(existingDiet.water_liters) : '3.5');

  // Plan Type & 7-Day Weekly Schedule
  const [planType, setPlanType] = useState<DietPlanType>(
    existingDiet?.plan_type || (existingDiet?.weekly_schedule ? 'WEEKLY' : 'WEEKLY')
  );
  const [activeDay, setActiveDay] = useState<DayOfWeek>(getTodayDayOfWeek());

  // Helper to calculate end date (e.g. +30 days for 1 month)
  const getEndDateAfterDays = (startStr: string, days: number = 30): string => {
    try {
      const parts = startStr.split('-').map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      d.setDate(d.getDate() + days);
      return getLocalDateStr(d);
    } catch {
      return '';
    }
  };

  const [startDate, setStartDate] = useState<string>(existingDiet?.start_date || getLocalDateStr());
  const [endDate, setEndDate] = useState<string>(
    existingDiet?.end_date || getEndDateAfterDays(existingDiet?.start_date || getLocalDateStr(), 30)
  );

  const defaultMeals: DietMeal[] = [
    { name: 'Breakfast', time: '08:30 AM', items: '4 boiled egg whites + 2 slices brown bread' },
    { name: 'Lunch', time: '01:30 PM', items: '150g grilled chicken/paneer + 1 cup brown rice + salad' },
    { name: 'Evening Snack', time: '05:30 PM', items: '1 scoop whey protein + 1 banana' },
    { name: 'Dinner', time: '08:30 PM', items: '150g fish/tofu + steamed veggies + 1 roti' },
  ];

  const [meals, setMeals] = useState<DietMeal[]>(
    existingDiet?.meals && existingDiet.meals.length > 0 ? existingDiet.meals : defaultMeals
  );

  const [weeklySchedule, setWeeklySchedule] = useState<Record<DayOfWeek, DietMeal[]>>(() => {
    const baseMeals = existingDiet?.meals && existingDiet.meals.length > 0 ? existingDiet.meals : defaultMeals;
    const schedule: Record<DayOfWeek, DietMeal[]> = {} as Record<DayOfWeek, DietMeal[]>;
    DAYS_OF_WEEK.forEach(day => {
      if (existingDiet?.weekly_schedule && existingDiet.weekly_schedule[day]?.length) {
        schedule[day] = existingDiet.weekly_schedule[day]!;
      } else {
        schedule[day] = baseMeals.map(m => ({ ...m }));
      }
    });
    return schedule;
  });

  const [instructions, setInstructions] = useState<string>(existingDiet?.instructions || '');
  const [supplements, setSupplements] = useState<string>(existingDiet?.supplements || '');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(existingDiet?.status || 'ACTIVE');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Active day's meals
  const currentMeals = planType === 'WEEKLY' ? (weeklySchedule[activeDay] || []) : meals;

  const setDurationMonths = (months: number) => {
    const days = months * 30;
    const newEnd = getEndDateAfterDays(startDate, days);
    setEndDate(newEnd);
    haptics.selection();
    Alert.alert('Duration Set', `Plan validity set to ${months} Month${months > 1 ? 's' : ''} (${days} Days).`);
  };

  // Query: Only members who have opted for Personal Training
  const { data: ptMembers = [], isLoading: ptMembersLoading } = useQuery({
    queryKey: ['mobile-pt-members-for-diet'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personal_training')
        .select(`
          id,
          member_id,
          trainer_id,
          package_name,
          status,
          members (id, full_name, mobile, profile_photo),
          trainer:user_profiles!personal_training_trainer_id_fkey(id, full_name, username)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching PT members for mobile diet plan:', error);
        return [];
      }

      // Deduplicate by member_id
      interface PTMemberOption {
        id: string;
        member_id: string;
        trainer_id: string | null;
        package_name: string;
        status: string;
        members: Member;
        trainer?: { id: string; full_name: string | null; username: string } | null;
      }

      const memberMap = new Map<string, PTMemberOption>();
      (data || []).forEach(pt => {
        if (!pt.member_id || !pt.members) return;
        const current = memberMap.get(pt.member_id);
        const ptOpt: PTMemberOption = {
          id: pt.id,
          member_id: pt.member_id,
          trainer_id: pt.trainer_id,
          package_name: pt.package_name,
          status: pt.status,
          members: (Array.isArray(pt.members) ? pt.members[0] : pt.members) as Member,
          trainer: Array.isArray(pt.trainer) ? pt.trainer[0] : pt.trainer,
        };
        if (!current || (current.status !== 'ACTIVE' && pt.status === 'ACTIVE')) {
          memberMap.set(pt.member_id, ptOpt);
        }
      });

      return Array.from(memberMap.values());
    },
    enabled: visible,
  });

  // Query: Trainers list
  const { data: trainers = [] } = useQuery<UserProfile[]>({
    queryKey: ['mobile-trainers-list-for-diet'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'TRAINER');
      if (error) throw error;
      return (data as unknown as UserProfile[]) || [];
    },
    enabled: visible,
  });

  // Automatically select first PT member if none selected
  useEffect(() => {
    if (!selectedMemberId && ptMembers.length > 0 && !initialMemberId) {
      setSelectedMemberId(ptMembers[0].member_id);
      setSelectedPTId(ptMembers[0].id);
      if (ptMembers[0].trainer_id) {
        setTrainerId(ptMembers[0].trainer_id);
      }
    } else if (selectedMemberId && ptMembers.length > 0) {
      const match = ptMembers.find(p => p.member_id === selectedMemberId);
      if (match) {
        setSelectedPTId(match.id);
        if (!trainerId && match.trainer_id) {
          setTrainerId(match.trainer_id);
        }
      }
    }
  }, [selectedMemberId, ptMembers, initialMemberId]);

  const currentMemberRecord = ptMembers.find(p => p.member_id === selectedMemberId)?.members as Member | undefined;
  const currentTrainerRecord = trainers.find(t => t.id === trainerId);

  // Apply Preset Template
  const handleApplyPreset = (preset: typeof DIET_PRESETS[0]) => {
    haptics.selection();
    setTitle(preset.name);
    setGoal(preset.goal);
    setCalories(String(preset.calories));
    setProtein(String(preset.protein));
    setCarbs(String(preset.carbs));
    setFats(String(preset.fats));
    setWater(String(preset.water));
    setSupplements(preset.supplements);
    setInstructions(preset.instructions);
    setMeals([...preset.meals]);
    setWeeklySchedule(prev => {
      const next = { ...prev };
      DAYS_OF_WEEK.forEach(day => {
        next[day] = preset.meals.map(m => ({ ...m }));
      });
      return next;
    });
  };

  // Add Meal
  const handleAddMeal = () => {
    haptics.light();
    const newMeal: DietMeal = {
      name: `Meal ${currentMeals.length + 1}`,
      time: '12:00 PM',
      items: '',
    };
    if (planType === 'WEEKLY') {
      setWeeklySchedule(prev => ({
        ...prev,
        [activeDay]: [...(prev[activeDay] || []), newMeal],
      }));
    } else {
      setMeals(prev => [...prev, newMeal]);
    }
  };

  // Remove Meal
  const handleRemoveMeal = (idx: number) => {
    haptics.selection();
    if (currentMeals.length <= 1) {
      Alert.alert('Notice', 'A diet plan must contain at least one meal.');
      return;
    }
    if (planType === 'WEEKLY') {
      setWeeklySchedule(prev => ({
        ...prev,
        [activeDay]: (prev[activeDay] || []).filter((_, i) => i !== idx),
      }));
    } else {
      setMeals(prev => prev.filter((_, i) => i !== idx));
    }
  };

  // Update Meal
  const handleUpdateMeal = (idx: number, field: keyof DietMeal, value: string) => {
    if (planType === 'WEEKLY') {
      setWeeklySchedule(prev => {
        const dayMeals = [...(prev[activeDay] || [])];
        dayMeals[idx] = { ...dayMeals[idx], [field]: value };
        return { ...prev, [activeDay]: dayMeals };
      });
    } else {
      setMeals(prev => {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], [field]: value };
        return copy;
      });
    }
  };

  // Copy active day meals to all other days
  const copyActiveDayToAll = () => {
    haptics.medium();
    const current = weeklySchedule[activeDay] || [];
    if (current.length === 0) {
      Alert.alert('Notice', `No meals configured for ${activeDay} to copy.`);
      return;
    }
    setWeeklySchedule(prev => {
      const next = { ...prev };
      DAYS_OF_WEEK.forEach(day => {
        next[day] = current.map(m => ({ ...m }));
      });
      return next;
    });
    Alert.alert('Copied', `Copied ${activeDay}'s meals to all 7 days of the week!`);
  };

  // Save Plan
  const handleSave = async (andSendWhatsApp = false) => {
    if (!selectedMemberId) {
      Alert.alert('Required', 'Please select a Personal Training member.');
      return;
    }
    if (!selectedPTId) {
      Alert.alert('Required', 'Member must have a valid Personal Training program.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a diet plan title.');
      return;
    }
    if (currentMeals.length === 0 || currentMeals.some(m => !m.name.trim() || !m.items.trim())) {
      Alert.alert('Required', `Please fill in both name and food items for all meals in ${planType === 'WEEKLY' ? activeDay : 'the plan'}.`);
      return;
    }

    setSubmitting(true);
    haptics.medium();
    try {
      const dietPayload = {
        member_id: selectedMemberId,
        personal_training_id: selectedPTId,
        trainer_id: trainerId || null,
        title: title.trim(),
        goal: goal.trim() || null,
        daily_calories: calories ? parseInt(calories, 10) : null,
        protein_grams: protein ? parseInt(protein, 10) : null,
        carbs_grams: carbs ? parseInt(carbs, 10) : null,
        fats_grams: fats ? parseInt(fats, 10) : null,
        water_liters: water ? parseFloat(water) : null,
        plan_type: planType,
        meals: currentMeals,
        weekly_schedule: planType === 'WEEKLY' ? weeklySchedule : null,
        instructions: instructions.trim() || null,
        supplements: supplements.trim() || null,
        status: status,
        start_date: startDate || getLocalDateStr(),
        end_date: endDate || null,
        updated_at: new Date().toISOString(),
      };

      let savedDiet: DietPlan;

      if (existingDiet?.id) {
        const { data, error } = await supabase
          .from('diet_plans')
          .update(dietPayload)
          .eq('id', existingDiet.id)
          .select('*, members(*), trainer:user_profiles!diet_plans_trainer_id_fkey(*)')
          .single();

        if (error) throw error;
        savedDiet = data as unknown as DietPlan;
      } else {
        const newId = `diet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const { data, error } = await supabase
          .from('diet_plans')
          .insert({
            id: newId,
            ...dietPayload,
            created_by: user?.id || null,
            created_at: new Date().toISOString(),
          })
          .select('*, members(*), trainer:user_profiles!diet_plans_trainer_id_fkey(*)')
          .single();

        if (error) throw error;
        savedDiet = data as unknown as DietPlan;
      }

      qc.invalidateQueries({ queryKey: ['mobile-diet-plans'] });
      qc.invalidateQueries({ queryKey: ['member-diet-plan'] });

      haptics.success();

      // If WhatsApp dispatch requested
      if (andSendWhatsApp) {
        const memberMobile = currentMemberRecord?.mobile || savedDiet.members?.mobile;
        const memberName = currentMemberRecord?.full_name || savedDiet.members?.full_name || 'Member';
        const coachName = currentTrainerRecord?.full_name || savedDiet.trainer?.full_name || user?.full_name || 'Team FitVerse Elite';

        if (!memberMobile) {
          Alert.alert('Saved', 'Diet plan saved, but member has no registered mobile number for WhatsApp.');
        } else {
          const msg = buildDailyDietPlanWhatsAppMessage(memberName, savedDiet, coachName, planType === 'WEEKLY' ? activeDay : undefined);
          openWhatsAppLink(memberMobile, msg);
        }
      } else {
        Alert.alert('Success', existingDiet ? 'Diet plan updated!' : 'Diet plan created!');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Error', getFriendlyErrorMessage(err, 'Failed to save diet plan.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FVEModal
      visible={visible}
      onClose={onClose}
      title={existingDiet ? 'EDIT DIET PLAN' : 'CREATE DIET PLAN'}
      subtitle="Exclusively for Personal Training members"
    >
      <ScrollView
        style={styles.modalScroll}
        contentContainerStyle={styles.modalScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* PT Gate Banner */}
        {ptMembers.length === 0 && !ptMembersLoading && (
          <View style={styles.warningBanner}>
            <AlertCircle size={18} color={colors.warning} />
            <Text style={styles.warningBannerText}>
              No Personal Training clients found. Diet plans can only be created for members with an active Personal Training program.
            </Text>
          </View>
        )}

        {/* Member Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>
            PT MEMBER <Text style={{ color: colors.error }}>*</Text>
          </Text>
          {initialMemberId ? (
            <View style={styles.staticMemberCard}>
              <Dumbbell size={16} color={colors.gold} />
              <Text style={styles.staticMemberName}>
                {currentMemberRecord?.full_name || 'Selected Member'}
              </Text>
              <FVEBadge label="PT CLIENT" color={colors.gold} bgColor="rgba(239, 161, 0, 0.12)" borderColor="rgba(239, 161, 0, 0.3)" size="sm" />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberChipsScroll}>
              {ptMembers.map(pt => {
                const isSelected = pt.member_id === selectedMemberId;
                return (
                  <TouchableOpacity
                    key={pt.id}
                    onPress={() => {
                      haptics.selection();
                      setSelectedMemberId(pt.member_id);
                      setSelectedPTId(pt.id);
                      if (pt.trainer_id) setTrainerId(pt.trainer_id);
                    }}
                    style={[styles.memberChip, isSelected && styles.memberChipSelected]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.memberChipName, isSelected && styles.memberChipNameSelected]}>
                      {pt.members?.full_name || 'Member'}
                    </Text>
                    <Text style={styles.memberChipPackage}>
                      {pt.package_name || 'PT'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Quick Presets */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>QUICK PRESET TEMPLATES</Text>
            <Sparkles size={13} color={colors.gold} />
          </View>
          <View style={styles.presetsGrid}>
            {DIET_PRESETS.map((p, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => handleApplyPreset(p)}
                style={styles.presetCard}
                activeOpacity={0.7}
              >
                <Text style={styles.presetTitle} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.presetSub}>
                  {p.calories} kcal · {p.protein}g P
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Plan Title & Goal */}
        <View style={styles.section}>
          <Text style={styles.label}>
            DIET PLAN TITLE <Text style={{ color: colors.error }}>*</Text>
          </Text>
          <FVEInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. High-Protein Shred Plan"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>FITNESS / DIET GOAL</Text>
          <FVEInput
            value={goal}
            onChangeText={setGoal}
            placeholder="e.g. Fat Loss & Lean Muscle"
          />
        </View>

        {/* Macros Row */}
        <View style={styles.macroContainer}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Flame size={14} color={colors.gold} />
              <Text style={styles.macroHeaderTitle}>TARGET DAILY MACROS</Text>
            </View>
            <Text style={styles.macroHeaderSub}>Sent in WhatsApp</Text>
          </View>

          <View style={styles.macroInputsRow}>
            <View style={styles.macroInputCol}>
              <Text style={styles.macroInputLabel}>Calories</Text>
              <TextInput
                value={calories}
                onChangeText={setCalories}
                keyboardType="numeric"
                placeholder="2000"
                placeholderTextColor={colors.textMuted}
                style={[styles.macroInput, { color: colors.gold, fontWeight: '700' }]}
              />
            </View>

            <View style={styles.macroInputCol}>
              <Text style={styles.macroInputLabel}>Protein (g)</Text>
              <TextInput
                value={protein}
                onChangeText={setProtein}
                keyboardType="numeric"
                placeholder="160"
                placeholderTextColor={colors.textMuted}
                style={styles.macroInput}
              />
            </View>

            <View style={styles.macroInputCol}>
              <Text style={styles.macroInputLabel}>Carbs (g)</Text>
              <TextInput
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="numeric"
                placeholder="180"
                placeholderTextColor={colors.textMuted}
                style={styles.macroInput}
              />
            </View>

            <View style={styles.macroInputCol}>
              <Text style={styles.macroInputLabel}>Fats (g)</Text>
              <TextInput
                value={fats}
                onChangeText={setFats}
                keyboardType="numeric"
                placeholder="55"
                placeholderTextColor={colors.textMuted}
                style={styles.macroInput}
              />
            </View>

            <View style={styles.macroInputCol}>
              <Text style={[styles.macroInputLabel, { color: colors.blue }]}>Water (L)</Text>
              <TextInput
                value={water}
                onChangeText={setWater}
                keyboardType="numeric"
                placeholder="3.5"
                placeholderTextColor={colors.textMuted}
                style={[styles.macroInput, { color: colors.blue, fontWeight: '700' }]}
              />
            </View>
          </View>
        </View>

        {/* Plan Duration & Validity */}
        <View style={styles.validityContainer}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} color={colors.blue} />
              <Text style={[styles.label, { color: colors.blue, marginBottom: 0 }]}>PLAN VALIDITY & DURATION</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                onPress={() => setDurationMonths(1)}
                style={styles.durationPresetChip}
                activeOpacity={0.7}
              >
                <Text style={styles.durationPresetText}>1M (30d)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDurationMonths(2)}
                style={styles.durationPresetChip}
                activeOpacity={0.7}
              >
                <Text style={styles.durationPresetText}>2M (60d)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDurationMonths(3)}
                style={styles.durationPresetChip}
                activeOpacity={0.7}
              >
                <Text style={styles.durationPresetText}>3M (90d)</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.dateInputsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dateInputLabel}>Start Date (YYYY-MM-DD)</Text>
              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                style={styles.dateTextInput}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dateInputLabel}>End Date (YYYY-MM-DD)</Text>
              <TextInput
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                style={styles.dateTextInput}
              />
            </View>
          </View>
        </View>

        {/* Schedule Mode & 7-Day Tabs */}
        <View style={styles.section}>
          <View style={styles.modeTabsRow}>
            <TouchableOpacity
              onPress={() => {
                haptics.selection();
                setPlanType('WEEKLY');
              }}
              style={[styles.modeTab, planType === 'WEEKLY' && styles.modeTabActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.modeTabText, planType === 'WEEKLY' && styles.modeTabTextActive]}>
                🗓️ 7-Day Weekly Schedule
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                haptics.selection();
                setPlanType('DAILY');
              }}
              style={[styles.modeTab, planType === 'DAILY' && styles.modeTabActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.modeTabText, planType === 'DAILY' && styles.modeTabTextActive]}>
                Single Daily Routine
              </Text>
            </TouchableOpacity>
          </View>

          {planType === 'WEEKLY' && (
            <View style={{ marginTop: 10 }}>
              <View style={[styles.rowBetween, { marginBottom: 8 }]}>
                <Text style={{ fontSize: 11, color: colors.textMuted, fontFamily: typography.fonts.inter }}>
                  Day schedule rotating for the month:
                </Text>
                <TouchableOpacity
                  onPress={copyActiveDayToAll}
                  style={styles.copyBtn}
                  activeOpacity={0.7}
                >
                  <Copy size={12} color={colors.blue} />
                  <Text style={styles.copyBtnText}>Copy {activeDay.slice(0, 3)} to All 7 Days</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabsScroll}>
                {DAYS_OF_WEEK.map(day => {
                  const isSelected = activeDay === day;
                  const isToday = day === getTodayDayOfWeek();
                  const count = (weeklySchedule[day] || []).length;
                  return (
                    <TouchableOpacity
                      key={day}
                      onPress={() => {
                        haptics.selection();
                        setActiveDay(day);
                      }}
                      style={[styles.dayTabChip, isSelected && styles.dayTabChipSelected]}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={[styles.dayTabChipText, isSelected && styles.dayTabChipTextSelected]}>
                          {day.slice(0, 3)}
                        </Text>
                        <View style={[styles.dayTabBadge, isSelected && styles.dayTabBadgeSelected]}>
                          <Text style={[styles.dayTabBadgeText, isSelected && styles.dayTabBadgeTextSelected]}>
                            {count}
                          </Text>
                        </View>
                      </View>
                      {isToday && (
                        <Text style={[styles.todayTag, isSelected && styles.todayTagSelected]}>
                          TODAY
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Dynamic Meals Schedule */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Apple size={15} color={colors.gold} />
              <Text style={styles.label}>
                {planType === 'WEEKLY' ? `${activeDay.toUpperCase()} MEALS (${currentMeals.length})` : `DAILY MEAL SCHEDULE (${currentMeals.length})`}
              </Text>
            </View>
            <TouchableOpacity onPress={handleAddMeal} style={styles.addMealBtn} activeOpacity={0.7}>
              <Plus size={12} color={colors.gold} />
              <Text style={styles.addMealBtnText}>Add Meal</Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 10, marginTop: 8 }}>
            {currentMeals.map((meal, idx) => (
              <View key={idx} style={styles.mealCard}>
                <View style={styles.mealCardHeader}>
                  <View style={styles.mealIndexBadge}>
                    <Text style={styles.mealIndexText}>{idx + 1}</Text>
                  </View>

                  <TextInput
                    value={meal.name}
                    onChangeText={val => handleUpdateMeal(idx, 'name', val)}
                    placeholder="e.g. Breakfast"
                    placeholderTextColor={colors.textMuted}
                    style={styles.mealNameInput}
                  />

                  <View style={styles.mealTimeWrapper}>
                    <Clock size={11} color={colors.textMuted} />
                    <TextInput
                      value={meal.time || ''}
                      onChangeText={val => handleUpdateMeal(idx, 'time', val)}
                      placeholder="08:30 AM"
                      placeholderTextColor={colors.textMuted}
                      style={styles.mealTimeInput}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={() => handleRemoveMeal(idx)}
                    style={styles.trashBtn}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={15} color={colors.error} />
                  </TouchableOpacity>
                </View>

                <TextInput
                  value={meal.items}
                  onChangeText={val => handleUpdateMeal(idx, 'items', val)}
                  placeholder="e.g. 4 boiled eggs, 2 brown bread slices"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={2}
                  style={styles.mealItemsInput}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Recommended Supplements */}
        <View style={styles.section}>
          <Text style={styles.label}>RECOMMENDED SUPPLEMENTS</Text>
          <TextInput
            value={supplements}
            onChangeText={setSupplements}
            placeholder="e.g. Whey Protein, Creatine 5g, Fish Oil"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={2}
            style={styles.textAreaInput}
          />
        </View>

        {/* Coach Instructions */}
        <View style={styles.section}>
          <Text style={styles.label}>COACH'S INSTRUCTIONS & HYDRATION NOTES</Text>
          <TextInput
            value={instructions}
            onChangeText={setInstructions}
            placeholder="e.g. Drink 3.5L water daily. Avoid refined sugars."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={2}
            style={styles.textAreaInput}
          />
        </View>

        {/* WhatsApp Verification Notice */}
        <View style={styles.phoneNotice}>
          {currentMemberRecord?.mobile ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={14} color={colors.success} />
              <Text style={{ fontSize: 12, color: colors.success, fontFamily: typography.fonts.inter }}>
                Member WhatsApp verified: {currentMemberRecord.mobile}
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={14} color={colors.warning} />
              <Text style={{ fontSize: 12, color: colors.warning, fontFamily: typography.fonts.inter }}>
                Mobile required on member profile to dispatch via WhatsApp
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            onPress={() => handleSave(true)}
            disabled={submitting || ptMembers.length === 0}
            style={[styles.whatsAppBtn, (submitting || ptMembers.length === 0) && { opacity: 0.5 }]}
            activeOpacity={0.8}
          >
            <MessageCircle size={16} color="#000" />
            <Text style={styles.whatsAppBtnText}>
              {submitting
                ? 'Saving...'
                : planType === 'WEEKLY'
                ? `Save & Send ${activeDay}'s Diet via WhatsApp`
                : 'Save & Send Daily Plan via WhatsApp'}
            </Text>
          </TouchableOpacity>

          <FVEButton
            title={submitting ? 'Saving...' : 'Save Plan Only'}
            onPress={() => handleSave(false)}
            loading={submitting}
            disabled={submitting || ptMembers.length === 0}
            variant="outline"
            size="md"
          />
        </View>
      </ScrollView>
    </FVEModal>
  );
}

const styles = StyleSheet.create({
  modalScroll: {
    maxHeight: 520,
  },
  modalScrollContent: {
    paddingBottom: 24,
  },
  section: {
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    fontFamily: typography.fonts.rajdhani,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.25)',
    marginBottom: 14,
  },
  warningBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.warning,
    fontFamily: typography.fonts.inter,
    lineHeight: 16,
  },
  staticMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  staticMemberName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fonts.rajdhani,
    marginLeft: 8,
  },
  memberChipsScroll: {
    flexDirection: 'row',
  },
  memberChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  memberChipSelected: {
    backgroundColor: 'rgba(239, 161, 0, 0.12)',
    borderColor: colors.gold,
  },
  memberChipName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fonts.rajdhani,
  },
  memberChipNameSelected: {
    color: colors.gold,
  },
  memberChipPackage: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: typography.fonts.inter,
    marginTop: 2,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetCard: {
    flexBasis: '48%',
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  presetTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fonts.rajdhani,
  },
  presetSub: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: typography.fonts.inter,
    marginTop: 2,
  },
  macroContainer: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  macroHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold,
    fontFamily: typography.fonts.rajdhani,
    letterSpacing: 0.5,
  },
  macroHeaderSub: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: typography.fonts.inter,
  },
  macroInputsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  macroInputCol: {
    flex: 1,
  },
  macroInputLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontFamily: typography.fonts.inter,
    marginBottom: 4,
    textAlign: 'center',
  },
  macroInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 12,
    color: colors.textPrimary,
    fontFamily: typography.fonts.rajdhani,
    textAlign: 'center',
  },
  addMealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 161, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.3)',
  },
  addMealBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold,
    fontFamily: typography.fonts.rajdhani,
  },
  mealCard: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 6,
  },
  mealCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mealIndexBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 161, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealIndexText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold,
    fontFamily: typography.fonts.rajdhani,
  },
  mealNameInput: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 12,
    color: colors.textPrimary,
    fontFamily: typography.fonts.inter,
  },
  mealTimeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 6,
    width: 85,
  },
  mealTimeInput: {
    flex: 1,
    paddingVertical: 4,
    fontSize: 11,
    color: colors.textPrimary,
    fontFamily: typography.fonts.rajdhani,
    textAlign: 'center',
  },
  trashBtn: {
    padding: 6,
  },
  mealItemsInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    padding: 8,
    fontSize: 11,
    color: colors.textPrimary,
    fontFamily: typography.fonts.inter,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  textAreaInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: colors.textPrimary,
    fontFamily: typography.fonts.inter,
    minHeight: 52,
    textAlignVertical: 'top',
  },
  phoneNotice: {
    paddingVertical: 8,
    marginBottom: 14,
  },
  actionsContainer: {
    gap: 10,
  },
  whatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#25D366',
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  whatsAppBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
    fontFamily: typography.fonts.rajdhani,
    letterSpacing: 0.5,
  },
  validityContainer: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 102, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 102, 255, 0.2)',
    marginBottom: 14,
  },
  durationPresetChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationPresetText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fonts.rajdhani,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  dateInputLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontFamily: typography.fonts.inter,
    marginBottom: 4,
  },
  dateTextInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    color: colors.textPrimary,
    fontFamily: typography.fonts.rajdhani,
  },
  modeTabsRow: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  modeTabActive: {
    backgroundColor: colors.gold,
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    fontFamily: typography.fonts.rajdhani,
  },
  modeTabTextActive: {
    color: '#000',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 102, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 102, 255, 0.3)',
  },
  copyBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.blue,
    fontFamily: typography.fonts.rajdhani,
  },
  dayTabsScroll: {
    flexDirection: 'row',
  },
  dayTabChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  dayTabChipSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  dayTabChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    fontFamily: typography.fonts.rajdhani,
  },
  dayTabChipTextSelected: {
    color: '#000',
  },
  dayTabBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dayTabBadgeSelected: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  dayTabBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    fontFamily: typography.fonts.rajdhani,
  },
  dayTabBadgeTextSelected: {
    color: '#000',
  },
  todayTag: {
    fontSize: 7,
    fontWeight: '700',
    color: colors.gold,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  todayTagSelected: {
    color: '#000',
  },
});
