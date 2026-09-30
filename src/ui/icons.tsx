import { Activity, BedDouble, Droplet, Droplets, HeartPulse, Pill, Smile, Sparkles, Toilet, Utensils } from 'lucide-react';
import type { RoutineCategory } from '../core/types';

const MAP: Record<RoutineCategory, typeof Pill> = {
  medication: Pill,
  meal: Utensils,
  hydration: Droplet,
  sleep: BedDouble,
  exercise: Activity,
  stress_check: HeartPulse,
  mood: Smile,
  bowel: Toilet,
  bathroom: Droplets,
  custom: Sparkles,
};

export function CategoryIcon({ category, size = 20 }: { category: RoutineCategory; size?: number }) {
  const Icon = MAP[category] ?? Sparkles;
  return <Icon aria-hidden size={size} />;
}
