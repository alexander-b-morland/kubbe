// Kubbe's own dinner ideas, used when no AI key is set or the AI cannot be reached.
// Everyday dishes a shared flat can cook for a handful of people.

export type DishIdea = { title: string; ingredients: string[] };

type Contains = "meat" | "pork" | "fish" | "dairy" | "egg" | "gluten" | "nuts";

type Recipe = DishIdea & { contains: Contains[] };

export const COOKBOOK: readonly Recipe[] = [
  { title: "Tacos", ingredients: ["Minced beef", "Tortillas", "Taco spice", "Tomatoes", "Cucumber", "Sweetcorn", "Grated cheese", "Sour cream", "Salsa"], contains: ["meat", "dairy", "gluten"] },
  { title: "Bean tacos", ingredients: ["Black beans", "Tortillas", "Taco spice", "Tomatoes", "Avocado", "Sweetcorn", "Lime", "Salsa"], contains: ["gluten"] },
  { title: "Spaghetti bolognese", ingredients: ["Spaghetti", "Minced beef", "Onion", "Garlic", "Chopped tomatoes", "Carrot", "Parmesan"], contains: ["meat", "dairy", "gluten"] },
  { title: "Lentil bolognese", ingredients: ["Spaghetti", "Red lentils", "Onion", "Garlic", "Chopped tomatoes", "Carrot"], contains: ["gluten"] },
  { title: "Chicken curry with rice", ingredients: ["Chicken thighs", "Rice", "Onion", "Garlic", "Ginger", "Curry paste", "Coconut milk", "Spinach"], contains: ["meat"] },
  { title: "Chickpea curry with rice", ingredients: ["Chickpeas", "Rice", "Onion", "Garlic", "Ginger", "Curry paste", "Coconut milk", "Spinach"], contains: [] },
  { title: "Oven-baked salmon with potatoes", ingredients: ["Salmon fillets", "Potatoes", "Broccoli", "Lemon", "Butter", "Dill"], contains: ["fish", "dairy"] },
  { title: "Fish soup", ingredients: ["White fish", "Potatoes", "Carrot", "Leek", "Cream", "Fish stock", "Chives"], contains: ["fish", "dairy"] },
  { title: "Homemade pizza", ingredients: ["Pizza dough", "Tomato sauce", "Mozzarella", "Ham", "Mushrooms", "Bell pepper", "Oregano"], contains: ["meat", "pork", "dairy", "gluten"] },
  { title: "Vegetable pizza", ingredients: ["Pizza dough", "Tomato sauce", "Mozzarella", "Mushrooms", "Bell pepper", "Red onion", "Olives"], contains: ["dairy", "gluten"] },
  { title: "Lasagne", ingredients: ["Lasagne sheets", "Minced beef", "Chopped tomatoes", "Onion", "Milk", "Butter", "Flour", "Grated cheese"], contains: ["meat", "dairy", "gluten"] },
  { title: "Vegetable stir-fry with noodles", ingredients: ["Noodles", "Broccoli", "Carrot", "Bell pepper", "Spring onion", "Garlic", "Soy sauce", "Sesame oil"], contains: ["gluten"] },
  { title: "Chicken stir-fry with rice", ingredients: ["Chicken breast", "Rice", "Broccoli", "Carrot", "Bell pepper", "Garlic", "Soy sauce"], contains: ["meat", "gluten"] },
  { title: "Chili sin carne", ingredients: ["Kidney beans", "Black beans", "Chopped tomatoes", "Onion", "Garlic", "Bell pepper", "Chili", "Rice"], contains: [] },
  { title: "Chili con carne", ingredients: ["Minced beef", "Kidney beans", "Chopped tomatoes", "Onion", "Garlic", "Chili", "Rice"], contains: ["meat"] },
  { title: "Tomato soup with grilled cheese", ingredients: ["Chopped tomatoes", "Onion", "Garlic", "Vegetable stock", "Bread", "Cheese", "Butter"], contains: ["dairy", "gluten"] },
  { title: "Burgers with oven fries", ingredients: ["Burger patties", "Burger buns", "Potatoes", "Lettuce", "Tomatoes", "Cheese slices", "Ketchup"], contains: ["meat", "dairy", "gluten"] },
  { title: "Halloumi burgers with oven fries", ingredients: ["Halloumi", "Burger buns", "Potatoes", "Lettuce", "Tomatoes", "Red onion", "Chili mayo"], contains: ["dairy", "egg", "gluten"] },
  { title: "Pasta carbonara", ingredients: ["Spaghetti", "Bacon", "Eggs", "Parmesan", "Black pepper"], contains: ["meat", "pork", "dairy", "egg", "gluten"] },
  { title: "Pasta with pesto and tomatoes", ingredients: ["Pasta", "Pesto", "Cherry tomatoes", "Rocket", "Parmesan"], contains: ["dairy", "gluten", "nuts"] },
  { title: "Wraps with falafel", ingredients: ["Falafel", "Wraps", "Hummus", "Cucumber", "Tomatoes", "Red cabbage", "Garlic sauce"], contains: ["gluten"] },
  { title: "Shakshuka with bread", ingredients: ["Eggs", "Chopped tomatoes", "Bell pepper", "Onion", "Garlic", "Cumin", "Bread"], contains: ["egg", "gluten"] },
  { title: "Baked potatoes with toppings", ingredients: ["Large potatoes", "Sour cream", "Sweetcorn", "Grated cheese", "Spring onion", "Baked beans"], contains: ["dairy"] },
  { title: "Dal with rice", ingredients: ["Red lentils", "Rice", "Onion", "Garlic", "Ginger", "Turmeric", "Coconut milk", "Coriander"], contains: [] },
  { title: "Sausages with mashed potatoes", ingredients: ["Sausages", "Potatoes", "Milk", "Butter", "Peas", "Mustard"], contains: ["meat", "pork", "dairy"] },
  { title: "Fried rice", ingredients: ["Rice", "Eggs", "Peas", "Carrot", "Spring onion", "Garlic", "Soy sauce"], contains: ["egg", "gluten"] },
  { title: "Fish tacos", ingredients: ["White fish", "Tortillas", "Red cabbage", "Lime", "Avocado", "Sour cream", "Coriander"], contains: ["fish", "dairy", "gluten"] },
  { title: "Greek salad with pita", ingredients: ["Feta", "Cucumber", "Tomatoes", "Red onion", "Olives", "Pita bread", "Tzatziki"], contains: ["dairy", "gluten"] },
  { title: "Pancakes", ingredients: ["Flour", "Eggs", "Milk", "Butter", "Jam", "Sugar"], contains: ["dairy", "egg", "gluten"] },
  { title: "Roasted vegetables with couscous", ingredients: ["Couscous", "Sweet potato", "Courgette", "Red onion", "Chickpeas", "Lemon", "Parsley"], contains: ["gluten"] },
];

/** What the cookbook says a dish needs, when it knows a dish by that name. */
export function needsFromCookbook(title: string): string[] | null {
  const wanted = title.trim().toLowerCase();
  if (wanted.length < 3) return null;
  const found =
    COOKBOOK.find((recipe) => recipe.title.toLowerCase() === wanted) ??
    COOKBOOK.find((recipe) => recipe.title.toLowerCase().startsWith(wanted) || wanted.startsWith(recipe.title.toLowerCase()));
  return found ? [...found.ingredients] : null;
}

// What people write under "I don't eat", and what that rules out.
const RULED_OUT: readonly { words: RegExp; contains: Contains[] }[] = [
  { words: /\bvegan/i, contains: ["meat", "pork", "fish", "dairy", "egg"] },
  { words: /\bvegetarian|\bveggie/i, contains: ["meat", "pork", "fish"] },
  { words: /\bpescetarian|\bpescatarian/i, contains: ["meat", "pork"] },
  { words: /\bmeat|\bbeef|\bchicken/i, contains: ["meat", "pork"] },
  { words: /\bpork|\bbacon|\bham\b|\bhalal|\bkosher/i, contains: ["pork"] },
  { words: /\bfish|\bseafood|\bsalmon/i, contains: ["fish"] },
  { words: /\bdairy|\blactose|\bmilk|\bcheese/i, contains: ["dairy"] },
  { words: /\begg/i, contains: ["egg"] },
  { words: /\bgluten|\bwheat|\bcoeliac|\bceliac/i, contains: ["gluten"] },
  { words: /\bnut|\bpeanut/i, contains: ["nuts"] },
];

/** What a list of "I don't eat" texts rules out. */
export function ruledOut(avoids: readonly string[]): Set<Contains> {
  const out = new Set<Contains>();
  for (const text of avoids) {
    for (const rule of RULED_OUT) {
      if (rule.words.test(text)) rule.contains.forEach((kind) => out.add(kind));
    }
  }
  return out;
}

/**
 * A few dishes from the cookbook that everyone coming can eat and that were not
 * cooked recently. `random` is passed in so the choice can be tested.
 */
export function pickFromCookbook(
  avoids: readonly string[],
  recentTitles: readonly string[],
  count: number,
  random: () => number = Math.random,
): DishIdea[] {
  const out = ruledOut(avoids);
  const recent = new Set(recentTitles.map((title) => title.trim().toLowerCase()));
  const edible = COOKBOOK.filter((recipe) => !recipe.contains.some((kind) => out.has(kind)));
  const fresh = edible.filter((recipe) => !recent.has(recipe.title.toLowerCase()));
  // When everything edible was cooked recently, repeats are better than nothing.
  const pool = [...(fresh.length >= count ? fresh : edible)];
  const picked: DishIdea[] = [];
  while (picked.length < count && pool.length > 0) {
    const [recipe] = pool.splice(Math.floor(random() * pool.length), 1);
    picked.push({ title: recipe.title, ingredients: [...recipe.ingredients] });
  }
  return picked;
}
