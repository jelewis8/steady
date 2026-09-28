import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { MEAL_LABELS } from '../../core/defaults';
import { addDays, dateKeyOf, formatIsoClock, relativeDay, todayKey } from '../../core/time';
import type { MealType } from '../../core/types';
import { useMeals, usePrefs } from '../../data/hooks';
import { deleteMeal, guessMealType, logMeal, updatePreferences } from '../../data/repo';
import { toast } from '../../state/ui';
import { Button, Card, CardTitle, Disclaimer, Field, IconButton, Input, PageHeader, Segmented, TextArea } from '../../ui/kit';
import { WaterCard } from '../today/TodayCards';

export function DietPage() {
  const prefs = usePrefs();
  const today = todayKey();
  const meals = useMeals(addDays(today, -13), today).sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  const [type, setType] = useState<MealType>(guessMealType(new Date()));
  const [foods, setFoods] = useState('');
  const [carbs, setCarbs] = useState('');
  const [newTrigger, setNewTrigger] = useState('');
  const dietMode = prefs?.dietMode ?? 'none';
  const triggerFoods = prefs?.triggerFoods ?? [];

  async function save() {
    const undo = await logMeal({ mealType: type, foods, carbsGrams: carbs === '' ? null : Number(carbs) }, triggerFoods);
    toast(`${MEAL_LABELS[type]} logged.`, undo);
    setFoods('');
    setCarbs('');
  }

  const flagged = triggerFoods.filter((f) => f && foods.toLowerCase().includes(f.toLowerCase()));

  return (
    <div className="grid gap-4">
      <PageHeader title="Food & water" back="/more" subtitle="Regular meals and steady water help keep things even." />
      <WaterCard today={today} />

      <Card labelledBy="meal-h">
        <CardTitle id="meal-h">Log a meal</CardTitle>
        <div className="grid gap-4">
          <Segmented
            label="Which meal?"
            value={type}
            onChange={setType}
            columns={4}
            options={(Object.keys(MEAL_LABELS) as MealType[]).map((m) => ({ value: m, label: MEAL_LABELS[m] }))}
          />
          <Field label="What did you have? (optional)">
            {(id) => <TextArea id={id} value={foods} onChange={(e) => setFoods(e.target.value)} className="min-h-20" />}
          </Field>
          {flagged.length > 0 && (
            <p className="rounded-xl border-2 border-attn-line bg-attn-bg p-3 font-bold text-attn-ink" role="status">
              ⚑ Contains something on your watch list: {flagged.join(', ')}
            </p>
          )}
          {dietMode !== 'none' && (
            <Field label="Carbs (grams)" hint="Shown because a diet mode is on.">
              {(id, d) => <Input id={id} aria-describedby={d} type="number" inputMode="numeric" min={0} value={carbs} onChange={(e) => setCarbs(e.target.value)} />}
            </Field>
          )}
          <Button variant="primary" size="lg" onClick={save}>
            Save {MEAL_LABELS[type].toLowerCase()}
          </Button>
        </div>
      </Card>

      <Card labelledBy="watch-h">
        <CardTitle id="watch-h">Foods I watch for</CardTitle>
        <p className="mb-2 text-ink-2">Anything you think might be a trigger for you. Meals that mention them get flagged.</p>
        <ul className="mb-2 flex flex-wrap gap-2">
          {triggerFoods.map((f) => (
            <li key={f}>
              <Button variant="quiet" aria-label={`Remove ${f} from watch list`} onClick={() => updatePreferences({ triggerFoods: triggerFoods.filter((x) => x !== f) })}>
                {f} ✕
              </Button>
            </li>
          ))}
          {triggerFoods.length === 0 && <li className="text-ink-2">Nothing yet</li>}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = newTrigger.trim();
            if (v) void updatePreferences({ triggerFoods: [...new Set([...triggerFoods, v])] });
            setNewTrigger('');
          }}
        >
          <Input aria-label="Add a food to watch for" placeholder="e.g. energy drinks" value={newTrigger} onChange={(e) => setNewTrigger(e.target.value)} />
          <Button type="submit">Add</Button>
        </form>
      </Card>

      <section aria-labelledby="recent-h">
        <h2 id="recent-h" className="mb-2 text-lg font-bold">
          Recent meals
        </h2>
        {meals.length === 0 ? (
          <p className="text-ink-2">Meals you tick off in your checklist or log here show up below.</p>
        ) : (
          <ul className="grid gap-2">
            {meals.slice(0, 30).map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-2xl border-2 border-line bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold">
                    {MEAL_LABELS[m.mealType]} · {relativeDay(dateKeyOf(m.timestamp))} {formatIsoClock(m.timestamp)}
                  </div>
                  {m.foods && <div className="text-ink-2">{m.foods}</div>}
                  {m.triggerFoodsFlagged.length > 0 && <div className="font-bold text-attn-ink">⚑ {m.triggerFoodsFlagged.join(', ')}</div>}
                  {m.carbsGrams != null && <div className="text-sm text-ink-2">{m.carbsGrams} g carbs</div>}
                </div>
                <IconButton
                  label={`Delete ${MEAL_LABELS[m.mealType]} entry`}
                  onClick={async () => {
                    const undo = await deleteMeal(m.id);
                    toast('Meal deleted.', undo);
                  }}
                >
                  <Trash2 aria-hidden size={22} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Disclaimer>
        These are tracking aids, not medical nutrition therapy. Diets like keto, MAD or LGIT should only be followed with your epilepsy team and a
        dietitian.
      </Disclaimer>
    </div>
  );
}
