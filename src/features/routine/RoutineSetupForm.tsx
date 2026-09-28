import { MEAL_LABELS, type RoutineSetup } from '../../core/defaults';
import type { MealType } from '../../core/types';
import { Field, Input, Toggle } from '../../ui/kit';

/** Simple "build my day" form: wake, bed, meals. Used in onboarding and the schedule editor. */
export function RoutineSetupForm({ value, onChange }: { value: RoutineSetup; onChange: (v: RoutineSetup) => void }) {
  const set = (p: Partial<RoutineSetup>) => onChange({ ...value, ...p });
  const meal = (type: MealType) => value.meals.find((m) => m.type === type);
  const setMeal = (type: MealType, time: string | null) => {
    const rest = value.meals.filter((m) => m.type !== type);
    set({ meals: time ? [...rest, { type, time }] : rest });
  };
  const defaults: Record<MealType, string> = { breakfast: '07:30', lunch: '12:30', dinner: '18:30', snack: '15:30' };

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="I usually wake at">{(id) => <Input id={id} type="time" value={value.wakeTime} onChange={(e) => set({ wakeTime: e.target.value })} />}</Field>
        <Field label="Bedtime">{(id) => <Input id={id} type="time" value={value.bedTime} onChange={(e) => set({ bedTime: e.target.value })} />}</Field>
      </div>
      {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((t) => (
        <div key={t} className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Toggle label={MEAL_LABELS[t]} checked={!!meal(t)} onChange={(on) => setMeal(t, on ? defaults[t] : null)} />
          {meal(t) && (
            <Input type="time" aria-label={`${MEAL_LABELS[t]} time`} value={meal(t)!.time} onChange={(e) => setMeal(t, e.target.value)} className="w-36" />
          )}
        </div>
      ))}
      <Toggle label="Water reminders through the day" checked={value.water} onChange={(v) => set({ water: v })} />
      <Toggle label="Wind-down before bed" hint="Dim lights, screens away" checked={value.windDown} onChange={(v) => set({ windDown: v })} />
      <Toggle label="Evening check-in" hint="Stress and mood — helps find patterns" checked={value.checkIn} onChange={(v) => set({ checkIn: v })} />
      <Toggle label="Short walk or stretch" checked={!!value.movement} onChange={(v) => set({ movement: v ? '16:00' : null })} />
    </div>
  );
}
