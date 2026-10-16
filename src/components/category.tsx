import {
  ShoppingBasket,
  Utensils,
  Bus,
  ReceiptText,
  HeartPulse,
  ShoppingBag,
  Shapes,
} from "lucide-react";
import type { Category } from "@/lib/expenses";

export const CATEGORY_STYLE: Record<
  Category,
  { color: string; bg: string; icon: typeof ShoppingBasket }
> = {
  Groceries: { color: "#4f7659", bg: "#eaf0e5", icon: ShoppingBasket },
  "Food & Drinks": { color: "#bb6839", bg: "#faeadc", icon: Utensils },
  Transport: { color: "#6684a1", bg: "#e9eff5", icon: Bus },
  Bills: { color: "#9b7f43", bg: "#f5efdb", icon: ReceiptText },
  Health: { color: "#ac6d7d", bg: "#f6e9ed", icon: HeartPulse },
  Shopping: { color: "#8b76a7", bg: "#efeaf5", icon: ShoppingBag },
  Other: { color: "#7c817e", bg: "#eceee9", icon: Shapes },
};
export function CategoryIcon({ category }: { category: Category }) {
  const { color, bg, icon: Icon } = CATEGORY_STYLE[category];
  return (
    <span className="category-icon" style={{ color, background: bg }}>
      <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
    </span>
  );
}
