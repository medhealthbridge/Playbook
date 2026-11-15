import { peso } from "./Portal";

/** Quantity inputs named `rent_<itemId>`; the server looks prices up itself. */
export function RentalFields({ items, defaults = {} }: { items: { id: string; name: string; price_cents: number }[]; defaults?: Record<string, number> }) {
  if (items.length === 0) return null;
  return (
    <fieldset className="form-section">
      <legend className="label">Rent equipment (optional)</legend>
      {items.map((it) => (
        <div key={it.id} className="rental-row">
          <label htmlFor={`rent_${it.id}`}>{it.name} · {peso(it.price_cents)} each</label>
          <input id={`rent_${it.id}`} name={`rent_${it.id}`} type="number" min={0} max={20} className="input" defaultValue={defaults[it.id] ?? 0} />
        </div>
      ))}
    </fieldset>
  );
}
