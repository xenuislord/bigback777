import {
  RecipeSchema,
  type Recipe,
  type Ingredient,
} from "../../shared/src/index.ts";
// Original household recipes. Nutrition and ingredient costs are planning estimates,
// not USDA-verified calculations or observed retailer prices.
const foods: Record<
  string,
  [string, number, number, number, number, number, number]
> = {
  "ground beef": ["Meat & seafood", 1.25, 2.5, 0.26, 0, 0.16, 0],
  "beef chuck": ["Meat & seafood", 1.5, 2.5, 0.26, 0, 0.17, 0],
  "chicken breast": ["Meat & seafood", 1, 1.65, 0.31, 0, 0.036, 0],
  shrimp: ["Meat & seafood", 1.8, 0.99, 0.24, 0, 0.003, 0],
  salmon: ["Meat & seafood", 2.6, 2.08, 0.2, 0, 0.13, 0],
  cod: ["Meat & seafood", 2, 0.82, 0.18, 0, 0.007, 0],
  tuna: ["Meat & seafood", 1.3, 1.2, 0.26, 0, 0.01, 0],
  potato: ["Produce", 0.2, 0.77, 0.02, 0.17, 0.001, 0.022],
  rice: ["Pantry", 0.25, 3.65, 0.07, 0.8, 0.01, 0.01],
  pasta: ["Pantry", 0.3, 3.7, 0.13, 0.75, 0.015, 0.03],
  oats: ["Pantry", 0.3, 3.89, 0.17, 0.66, 0.07, 0.1],
  flour: ["Pantry", 0.15, 3.64, 0.1, 0.76, 0.01, 0.027],
  milk: ["Dairy & eggs", 0.12, 0.61, 0.032, 0.048, 0.033, 0],
  yogurt: ["Dairy & eggs", 0.4, 0.73, 0.1, 0.04, 0.02, 0],
  ricotta: ["Dairy & eggs", 0.9, 1.74, 0.11, 0.03, 0.13, 0],
  "cottage cheese": ["Dairy & eggs", 0.6, 0.98, 0.11, 0.034, 0.043, 0],
  cream: ["Dairy & eggs", 0.7, 3.4, 0.02, 0.03, 0.36, 0],
  butter: ["Dairy & eggs", 1, 7.17, 0.01, 0, 0.81, 0],
  cheddar: ["Dairy & eggs", 1.2, 4.03, 0.25, 0.01, 0.33, 0],
  parmesan: ["Dairy & eggs", 2, 4.3, 0.38, 0.04, 0.29, 0],
  mozzarella: ["Dairy & eggs", 1.1, 2.8, 0.28, 0.03, 0.17, 0],
  egg: ["Dairy & eggs", 35, 72, 6, 0.4, 5, 0],
  bread: ["Bakery", 0.5, 2.65, 0.09, 0.49, 0.03, 0.03],
  tortilla: ["Bakery", 0.5, 3.1, 0.08, 0.52, 0.08, 0.04],
  banana: ["Produce", 0.2, 0.89, 0.01, 0.23, 0.003, 0.026],
  strawberry: ["Produce", 0.7, 0.32, 0.007, 0.077, 0.003, 0.02],
  blueberry: ["Produce", 0.9, 0.57, 0.007, 0.14, 0.003, 0.024],
  orange: ["Produce", 0.25, 0.47, 0.009, 0.12, 0.001, 0.024],
  mango: ["Produce", 0.5, 0.6, 0.008, 0.15, 0.004, 0.016],
  peach: ["Produce", 0.5, 0.39, 0.009, 0.095, 0.003, 0.015],
  pineapple: ["Produce", 0.4, 0.5, 0.005, 0.13, 0.001, 0.014],
  apple: ["Produce", 0.25, 0.52, 0.003, 0.14, 0.002, 0.024],
  pear: ["Produce", 0.35, 0.57, 0.004, 0.15, 0.001, 0.03],
  lemon: ["Produce", 0.5, 0.29, 0.01, 0.09, 0.003, 0.028],
  lime: ["Produce", 0.6, 0.3, 0.007, 0.1, 0.002, 0.028],
  onion: ["Produce", 0.15, 0.4, 0.01, 0.09, 0.001, 0.017],
  carrot: ["Produce", 0.15, 0.41, 0.009, 0.1, 0.002, 0.028],
  zucchini: ["Produce", 0.3, 0.17, 0.012, 0.03, 0.003, 0.01],
  mushroom: ["Produce", 0.6, 0.22, 0.03, 0.03, 0.003, 0.01],
  spinach: ["Produce", 0.8, 0.23, 0.03, 0.036, 0.004, 0.022],
  tomato: ["Produce", 0.4, 0.18, 0.009, 0.039, 0.002, 0.012],
  peas: ["Frozen", 0.3, 0.81, 0.05, 0.14, 0.004, 0.05],
  garlic: ["Produce", 1, 1.49, 0.06, 0.33, 0.005, 0.02],
  "tomato passata": ["Pantry", 0.25, 0.3, 0.014, 0.06, 0.002, 0.015],
  "orange juice": ["Drinks", 0.2, 0.45, 0.007, 0.1, 0.002, 0],
  "apple juice": ["Drinks", 0.15, 0.46, 0.001, 0.11, 0, 0],
  honey: ["Pantry", 1, 3.04, 0, 0.82, 0, 0],
  sugar: ["Pantry", 0.15, 4, 0, 1, 0, 0],
  cocoa: ["Pantry", 1, 2.3, 0.2, 0.58, 0.14, 0.37],
  coffee: ["Drinks", 2, 0, 0, 0, 0, 0],
  vanilla: ["Pantry", 5, 2.8, 0, 0.12, 0, 0],
  cinnamon: ["Pantry", 3, 2.47, 0.04, 0.81, 0.01, 0.53],
  salt: ["Pantry", 0.1, 0, 0, 0, 0, 0],
  "olive oil": ["Pantry", 1.5, 8.84, 0, 0, 1, 0],
  gelatin: ["Pantry", 3, 3.35, 0.85, 0, 0, 0],
  "baking powder": ["Pantry", 1, 0.5, 0, 0.28, 0, 0],
  "white beans": ["Pantry", 0.3, 1.2, 0.08, 0.21, 0.005, 0.06],
  broth: ["Pantry", 0.12, 0.05, 0.005, 0, 0, 0],
  dill: ["Produce", 3, 0.43, 0.035, 0.07, 0.01, 0.02],
  parsley: ["Produce", 2, 0.36, 0.03, 0.06, 0.008, 0.03],
  "black pepper": ["Pantry", 3, 2.5, 0.1, 0.64, 0.03, 0.25],
};
export const costEstimate = (name: string, q: number, unit?: string) => {
  const food = foods[name];
  if (!food) return 0;
  const expected =
    name === "egg"
      ? "each"
      : [
            "milk",
            "cream",
            "orange juice",
            "apple juice",
            "broth",
            "olive oil",
            "vanilla",
          ].includes(name)
        ? "ml"
        : "g";
  if (unit && unit !== expected) return 0;
  return Math.round(q * food[1]);
};
const all: Recipe[] = [];
function add(
  title: string,
  category: Recipe["category"],
  minutes: number,
  parts: [string, number, string?][],
  steps: string[],
  tags: string[] = [],
  storage?: string,
) {
  const ingredients: Ingredient[] = parts.map(([name, quantity, unit]) => ({
    name,
    quantity,
    unit: (unit ||
      ([
        "milk",
        "cream",
        "orange juice",
        "apple juice",
        "broth",
        "olive oil",
        "vanilla",
      ].includes(name)
        ? "ml"
        : name === "egg"
          ? "each"
          : "g")) as Ingredient["unit"],
    department: foods[name]?.[0] || "Pantry",
  }));
  const totals = ingredients.reduce(
    (v, i) => {
      const f = foods[i.name];
      if (f)
        for (let k = 0; k < 6; k++) v[k] += i.quantity * (f[k + 1] as number);
      return v;
    },
    [0, 0, 0, 0, 0, 0],
  );
  const allergens = [
    ...(ingredients.some((i) =>
      [
        "milk",
        "yogurt",
        "cream",
        "butter",
        "ricotta",
        "cheddar",
        "parmesan",
        "mozzarella",
        "cottage cheese",
      ].includes(i.name),
    )
      ? ["Milk"]
      : []),
    ...(ingredients.some((i) =>
      ["flour", "bread", "pasta", "tortilla"].includes(i.name),
    )
      ? ["Wheat"]
      : []),
    ...(ingredients.some((i) => i.name === "egg") ? ["Egg"] : []),
    ...(ingredients.some((i) => i.name === "shrimp") ? ["Shellfish"] : []),
    ...(ingredients.some((i) => ["cod", "salmon", "tuna"].includes(i.name))
      ? ["Fish"]
      : []),
  ];
  const recipe = RecipeSchema.parse({
    title,
    category,
    minutes,
    servings: 3,
    description: `An original three-portion household ${category.toLowerCase()} with ${parts
      .slice(0, 3)
      .map((p) => p[0])
      .join(
        ", ",
      )}. Simple ingredients, clear steps, and room to make it yours.`,
    ingredients,
    steps,
    tags: [
      ...tags,
      ...(minutes <= 25 ? ["Quick"] : []),
      ...(totals[0] / 3 < 450 ? ["Budget"] : []),
      "Peat-inspired",
    ],
    allergens,
    equipment: steps.some((s) => s.includes("oven"))
      ? ["Oven", "Baking dish", "Saucepan"]
      : ["Stovetop", "Saucepan", "Skillet"],
    storage:
      storage ||
      "Refrigerate within 2 hours in a covered container. Use within 3–4 days and reheat leftovers to 165°F / 74°C.",
    costCents: Math.round(totals[0]),
    calories: Math.round(totals[1] / 3),
    protein: Math.round(totals[2] / 3),
    carbs: Math.round(totals[3] / 3),
    fat: Math.round(totals[4] / 3),
    fiber: Math.round(totals[5] / 3),
    compatibility: 80,
  });
  all.push({
    ...recipe,
    id: `recipe-${String(all.length + 1).padStart(3, "0")}`,
    favorite: false,
    rejected: false,
    rating: 0,
    version: 1,
  });
}
const riceStep =
  "Rinse the rice. Add it to a saucepan with twice its volume of water and a pinch of the measured salt. Bring to a boil, cover, and simmer on low for 15–18 minutes. Rest covered for 5 minutes.";
const potatoStep =
  "Cut the potatoes into 2 cm cubes. Cover with water, bring to a boil, and simmer for 12–15 minutes until tender. Drain well.";
const beefStep =
  "Warm a skillet over medium heat. Add the ground beef and diced onion. Cook for 8–10 minutes, breaking up the beef, until browned and at least 160°F / 71°C throughout. Drain excess fat if desired.";
const chickenStep =
  "Cut the chicken into bite-size pieces. Heat the butter in a skillet over medium heat. Add chicken and cook for 8–10 minutes, turning often, until the thickest pieces reach 165°F / 74°C.";
add(
  "Creamy beef & golden potatoes",
  "Dinner",
  35,
  [
    ["ground beef", 500],
    ["potato", 750],
    ["onion", 120],
    ["cream", 90],
    ["butter", 15],
    ["salt", 3],
  ],
  [
    potatoStep,
    beefStep,
    "Stir the cream into the beef. Simmer gently for 3 minutes.",
    "Fold in the drained potatoes and butter, warm through, and divide among three bowls.",
  ],
  ["Comfort food", "High protein"],
);
add(
  "Tomato beef rice bowls",
  "Dinner",
  30,
  [
    ["ground beef", 450],
    ["rice", 240],
    ["onion", 100],
    ["tomato passata", 300],
    ["parmesan", 45],
    ["salt", 3],
  ],
  [
    riceStep,
    beefStep,
    "Add the passata to the beef, cover, and simmer for 8 minutes.",
    "Spoon the beef over the rice and finish with grated parmesan.",
  ],
  ["Batch cooking", "High protein"],
);
add(
  "Cheesy beef stuffed potatoes",
  "Dinner",
  55,
  [
    ["ground beef", 450],
    ["potato", 900],
    ["onion", 100],
    ["cheddar", 90],
    ["yogurt", 100],
    ["salt", 3],
  ],
  [
    "Heat the oven to 425°F / 220°C. Prick the potatoes and bake on a tray for 45–50 minutes until soft.",
    beefStep,
    "Split the baked potatoes, fluff the insides, and add a spoonful of yogurt.",
    "Fill with the cooked beef and sprinkle with cheddar. Return to the oven for 3 minutes to melt.",
  ],
  ["Comfort food"],
);
add(
  "Beef & carrot cottage pie",
  "Dinner",
  55,
  [
    ["ground beef", 500],
    ["potato", 750],
    ["carrot", 200],
    ["onion", 100],
    ["milk", 120],
    ["butter", 30],
    ["broth", 150],
    ["salt", 3],
  ],
  [
    potatoStep,
    "Heat the oven to 400°F / 200°C.",
    beefStep,
    "Add finely diced carrots and broth to the beef. Cover and simmer for 12 minutes.",
    "Mash the potatoes with milk and butter. Spoon beef into a baking dish and spread the mash over it.",
    "Bake for 15 minutes until the top is lightly golden and filling is bubbling.",
  ],
  ["Batch cooking"],
);
add(
  "Ginger-free beef & zucchini rice",
  "Dinner",
  30,
  [
    ["ground beef", 450],
    ["zucchini", 350],
    ["rice", 240],
    ["onion", 100],
    ["butter", 15],
    ["salt", 3],
  ],
  [
    riceStep,
    beefStep,
    "Slice the zucchini into half moons. Stir into the beef with the butter and cook for 6–8 minutes until tender.",
    "Serve over the rice with pan juices.",
  ],
  ["Budget", "High protein"],
);
add(
  "Beef meatballs in creamy tomato sauce",
  "Dinner",
  40,
  [
    ["ground beef", 500],
    ["egg", 1],
    ["parmesan", 40],
    ["tomato passata", 350],
    ["cream", 60],
    ["rice", 210],
    ["salt", 3],
  ],
  [
    riceStep,
    "Mix beef, egg, half the parmesan, and salt. Form 15 small meatballs.",
    "Place the meatballs in a wide skillet with the passata. Bring to a simmer, cover, and cook for 18–20 minutes, turning once, until the centers reach 160°F / 71°C.",
    "Stir in the cream. Serve with rice and the remaining parmesan.",
  ],
  ["Comfort food"],
);
add(
  "Slow-simmered beef & potato stew",
  "Dinner",
  160,
  [
    ["beef chuck", 600],
    ["potato", 600],
    ["carrot", 200],
    ["onion", 150],
    ["broth", 600],
    ["butter", 15],
    ["salt", 3],
  ],
  [
    "Cut the beef chuck into 3 cm pieces and pat dry. Dice onion and carrots.",
    "Melt butter in a heavy pot. Brown beef in two batches for 6 minutes each; set aside.",
    "Soften onion and carrots in the pot for 5 minutes. Return beef, add broth and salt, and bring to a gentle simmer.",
    "Cover and cook on low for 1 hour 45 minutes. Add cubed potatoes and simmer for another 25–35 minutes until both meat and potatoes are fork-tender.",
    "Divide into three substantial portions, adding hot water if the stew is too thick.",
  ],
  ["Batch cooking"],
);
add(
  "Beef & ricotta skillet pasta",
  "Dinner",
  30,
  [
    ["ground beef", 450],
    ["pasta", 240],
    ["onion", 100],
    ["ricotta", 180],
    ["tomato passata", 250],
    ["salt", 3],
  ],
  [
    "Bring a large saucepan of water to a boil. Add pasta and cook according to package directions; reserve 150 ml cooking water and drain.",
    beefStep,
    "Add passata and simmer for 5 minutes. Fold in ricotta and enough reserved pasta water for a loose sauce.",
    "Toss with the pasta and heat for 2 minutes before serving.",
  ],
  ["High protein"],
);
add(
  "Lemon butter shrimp rice",
  "Dinner",
  25,
  [
    ["shrimp", 450],
    ["rice", 240],
    ["butter", 30],
    ["lemon", 80],
    ["garlic", 8],
    ["peas", 150],
    ["salt", 3],
  ],
  [
    riceStep,
    "Add peas to the rice for its last 4 minutes of cooking.",
    "Peel and devein shrimp. Mince garlic and zest and juice the lemon. Melt butter in a skillet, add garlic for 30 seconds, then shrimp.",
    "Cook shrimp for 2–3 minutes per side until opaque and 145°F / 63°C. Toss with lemon juice and zest and serve over pea rice.",
  ],
  ["High protein"],
);
add(
  "Creamy shrimp & potato chowder",
  "Dinner",
  35,
  [
    ["shrimp", 450],
    ["potato", 600],
    ["onion", 100],
    ["milk", 450],
    ["broth", 350],
    ["butter", 20],
    ["salt", 3],
  ],
  [
    "Dice onion and potatoes. Melt butter in a pot and soften onion for 4 minutes.",
    "Add potatoes and broth. Cover and simmer for 15 minutes until potatoes are soft.",
    "Mash a few potato pieces against the side of the pot to thicken the soup. Add milk and warm gently without boiling.",
    "Add peeled shrimp and simmer for 4–5 minutes until opaque and 145°F / 63°C. Season with the measured salt and divide among bowls.",
  ],
  ["Comfort food"],
);
add(
  "Shrimp tomato skillet with rice",
  "Dinner",
  30,
  [
    ["shrimp", 450],
    ["tomato", 400],
    ["rice", 240],
    ["garlic", 10],
    ["butter", 25],
    ["parsley", 10],
    ["salt", 3],
  ],
  [
    riceStep,
    "Chop tomatoes and mince garlic. Heat butter in a skillet and soften garlic for 30 seconds.",
    "Add tomatoes and salt; cook for 8 minutes until saucy.",
    "Add peeled shrimp and cook for 5–6 minutes, turning, until 145°F / 63°C. Finish with chopped parsley and serve over rice.",
  ],
  ["High protein"],
);
add(
  "Roasted salmon & lemon potatoes",
  "Dinner",
  40,
  [
    ["salmon", 500],
    ["potato", 750],
    ["lemon", 80],
    ["olive oil", 20],
    ["yogurt", 100],
    ["dill", 10],
    ["salt", 3],
  ],
  [
    "Heat the oven to 425°F / 220°C. Cut potatoes into thin wedges, toss with oil and half the salt, and roast on a tray for 20 minutes.",
    "Push potatoes to one side and add salmon. Season fish with remaining salt and sliced lemon.",
    "Roast for 12–15 more minutes until the salmon reaches 145°F / 63°C and potatoes are tender.",
    "Mix yogurt with chopped dill and serve alongside the salmon and potatoes.",
  ],
  ["High protein"],
);
add(
  "Cod in gentle tomato broth",
  "Dinner",
  30,
  [
    ["cod", 500],
    ["tomato passata", 350],
    ["broth", 300],
    ["potato", 600],
    ["onion", 100],
    ["butter", 15],
    ["salt", 3],
  ],
  [
    "Dice onion and potatoes into 1 cm pieces. Soften onion in butter for 4 minutes.",
    "Add broth, passata, potatoes, and salt. Simmer covered for 15 minutes until potatoes are almost tender.",
    "Cut cod into large pieces and place in the sauce. Cover and simmer for 7–9 minutes until opaque and 145°F / 63°C.",
    "Ladle fish and potatoes into bowls and spoon the tomato broth over them.",
  ],
  ["Budget"],
);
add(
  "Salmon & sweet pea rice bowls",
  "Dinner",
  30,
  [
    ["salmon", 450],
    ["rice", 240],
    ["peas", 200],
    ["butter", 20],
    ["lemon", 60],
    ["salt", 3],
  ],
  [
    riceStep,
    "Add peas to rice for the final 4 minutes.",
    "Melt butter in a skillet. Season salmon with salt and cook skin side down for 5–6 minutes. Turn and cook 3–5 minutes more until 145°F / 63°C.",
    "Flake the fish over the rice, leaving skin behind if desired. Finish with lemon juice and pan butter.",
  ],
  ["High protein"],
);
add(
  "Creamy chicken & mushroom rice",
  "Dinner",
  35,
  [
    ["chicken breast", 500],
    ["mushroom", 250],
    ["rice", 240],
    ["cream", 100],
    ["butter", 25],
    ["salt", 3],
  ],
  [
    riceStep,
    chickenStep,
    "Transfer chicken to a plate. Add sliced mushrooms to the pan and cook for 6 minutes until browned.",
    "Stir cream and 80 ml water into mushrooms. Return chicken, simmer for 3 minutes, season with salt, and serve with rice.",
  ],
  ["Comfort food", "High protein"],
);
add(
  "Lemon chicken potato tray",
  "Dinner",
  45,
  [
    ["chicken breast", 500],
    ["potato", 750],
    ["carrot", 250],
    ["lemon", 80],
    ["olive oil", 25],
    ["salt", 3],
  ],
  [
    "Heat the oven to 425°F / 220°C. Cut potatoes into 2 cm cubes and carrots into thin batons.",
    "Toss vegetables with half the oil and salt. Spread on a baking tray and roast for 15 minutes.",
    "Cut chicken into 3 cm chunks. Toss with remaining oil, salt, and lemon juice, then add to the tray.",
    "Roast for 20–25 minutes more, turning once, until vegetables are tender and the chicken reaches 165°F / 74°C.",
  ],
  ["Batch cooking"],
);
add(
  "Chicken & spinach parmesan pasta",
  "Dinner",
  30,
  [
    ["chicken breast", 450],
    ["pasta", 240],
    ["spinach", 150],
    ["parmesan", 60],
    ["milk", 200],
    ["butter", 20],
    ["salt", 3],
  ],
  [
    "Cook pasta according to package instructions, reserve 150 ml cooking water, and drain.",
    chickenStep,
    "Stir milk and salt into the chicken pan. Add spinach and cook for 2 minutes until wilted.",
    "Add pasta and parmesan. Toss over low heat, adding reserved water until silky.",
  ],
  ["High protein"],
);
add(
  "Baked ricotta spinach rice",
  "Dinner",
  45,
  [
    ["rice", 240],
    ["ricotta", 300],
    ["spinach", 200],
    ["egg", 3],
    ["parmesan", 60],
    ["milk", 150],
    ["salt", 3],
  ],
  [
    riceStep,
    "Heat the oven to 375°F / 190°C. Wilt spinach in a skillet with 30 ml water and squeeze out excess liquid.",
    "Whisk ricotta, eggs, milk, parmesan, and salt. Fold in cooked rice and spinach.",
    "Spread in a baking dish. Bake for 20–25 minutes until set and the center reaches 160°F / 71°C. Rest for 5 minutes and cut into three portions.",
  ],
  ["Vegetarian", "Batch cooking"],
);
add(
  "Potato & cheddar frittata",
  "Dinner",
  35,
  [
    ["potato", 600],
    ["egg", 9],
    ["milk", 100],
    ["cheddar", 90],
    ["butter", 20],
    ["onion", 100],
    ["salt", 3],
  ],
  [
    potatoStep,
    "Heat the oven to 375°F / 190°C. Melt butter in an oven-safe skillet and soften diced onion for 5 minutes.",
    "Whisk eggs, milk, and salt. Add drained potatoes to the skillet and pour over eggs. Sprinkle with cheddar.",
    "Cook on low for 3 minutes, then bake for 12–15 minutes until the center is set and reaches 160°F / 71°C. Slice into three wedges.",
  ],
  ["Vegetarian", "High protein"],
);
add(
  "White bean & tomato rice bake",
  "Dinner",
  40,
  [
    ["rice", 240],
    ["white beans", 500],
    ["tomato passata", 400],
    ["mozzarella", 150],
    ["onion", 100],
    ["olive oil", 15],
    ["salt", 3],
  ],
  [
    riceStep,
    "Heat the oven to 400°F / 200°C. Soften diced onion in oil for 5 minutes.",
    "Add cooked drained white beans, passata, and salt. Simmer for 6 minutes, then stir in cooked rice.",
    "Transfer to a baking dish, top with mozzarella, and bake for 12 minutes until bubbling.",
  ],
  ["Vegetarian", "Budget"],
);
add(
  "Banana vanilla breakfast oats",
  "Breakfast",
  15,
  [
    ["oats", 180],
    ["milk", 600],
    ["banana", 300],
    ["honey", 30],
    ["vanilla", 3],
  ],
  [
    "Combine oats and milk in a saucepan and bring just to a simmer.",
    "Cook on low for 7–9 minutes, stirring often, until creamy.",
    "Mash half the banana into the oats with vanilla. Divide among three bowls.",
    "Top with sliced remaining banana and drizzle with honey.",
  ],
  ["Vegetarian"],
);
add(
  "Strawberry yogurt breakfast bowls",
  "Breakfast",
  10,
  [
    ["yogurt", 600],
    ["strawberry", 450],
    ["oats", 90],
    ["honey", 30],
  ],
  [
    "Dry-toast oats in a skillet over medium heat for 4–5 minutes, stirring until fragrant. Cool.",
    "Wash and hull strawberries, then slice them.",
    "Divide yogurt among three bowls. Add strawberries and toasted oats.",
    "Drizzle each bowl with honey and serve promptly.",
  ],
  ["Vegetarian", "No oven"],
);
add(
  "Soft eggs & buttered toast",
  "Breakfast",
  15,
  [
    ["egg", 9],
    ["bread", 240],
    ["butter", 30],
    ["milk", 60],
    ["salt", 2],
  ],
  [
    "Beat eggs with milk and salt.",
    "Melt half the butter in a skillet over medium-low heat. Add eggs and stir gently for 5–7 minutes until set and 160°F / 71°C.",
    "Toast bread until golden and spread with remaining butter.",
    "Divide eggs and toast between three plates and serve hot.",
  ],
  ["Vegetarian", "High protein"],
);
add(
  "Cottage cheese peach bowls",
  "Breakfast",
  10,
  [
    ["cottage cheese", 600],
    ["peach", 450],
    ["honey", 30],
    ["cinnamon", 2],
  ],
  [
    "Wash peaches, remove stones, and cut into thin slices.",
    "Divide cottage cheese among three bowls.",
    "Arrange peaches on top. Drizzle with honey and dust with cinnamon.",
    "Serve chilled; use pasteurized cottage cheese.",
  ],
  ["Vegetarian", "High protein"],
);
add(
  "Apple cinnamon milk porridge",
  "Breakfast",
  20,
  [
    ["oats", 180],
    ["milk", 600],
    ["apple", 400],
    ["butter", 15],
    ["cinnamon", 3],
    ["honey", 30],
  ],
  [
    "Core and dice apples. Melt butter in a saucepan and soften apples for 5 minutes.",
    "Add milk, oats, cinnamon, and 150 ml water. Bring to a gentle simmer.",
    "Cook for 8–10 minutes, stirring frequently until the oats are tender.",
    "Stir in honey and divide into three bowls.",
  ],
  ["Vegetarian"],
);
add(
  "Ricotta banana pancakes",
  "Breakfast",
  25,
  [
    ["ricotta", 240],
    ["banana", 200],
    ["egg", 3],
    ["flour", 150],
    ["milk", 150],
    ["butter", 20],
    ["baking powder", 6],
  ],
  [
    "Mash banana and whisk with ricotta, eggs, and milk.",
    "Fold in flour and baking powder until no dry streaks remain; let stand for 3 minutes.",
    "Heat a nonstick skillet over medium-low heat and brush with butter. Add batter in 60 ml portions.",
    "Cook for 3 minutes per side until golden and the centers are fully set. Make 9 pancakes and divide among three plates.",
  ],
  ["Vegetarian"],
);
add(
  "Cheddar potato breakfast skillet",
  "Breakfast",
  30,
  [
    ["potato", 600],
    ["egg", 6],
    ["cheddar", 90],
    ["butter", 20],
    ["salt", 2],
  ],
  [
    potatoStep,
    "Melt butter in a large skillet. Add drained potatoes and fry for 5–7 minutes until golden.",
    "Make six wells and crack in eggs. Cover and cook on low for 6–8 minutes until whites and yolks are set.",
    "Scatter over cheddar and salt. Cover for 1 minute to melt, then serve in three portions.",
  ],
  ["Vegetarian"],
);
add(
  "Blueberry overnight oats",
  "Breakfast",
  10,
  [
    ["oats", 180],
    ["milk", 450],
    ["yogurt", 300],
    ["blueberry", 300],
    ["honey", 30],
  ],
  [
    "Stir oats, milk, yogurt, and honey in a bowl.",
    "Divide among three clean lidded jars and top with washed blueberries.",
    "Cover and refrigerate for at least 6 hours or overnight; active preparation takes 10 minutes.",
    "Stir before eating. Use within 2 days and keep refrigerated.",
  ],
  ["Vegetarian", "Make ahead"],
  "Keep refrigerated and use within 2 days.",
);
add(
  "Tuna potato lunch bowls",
  "Lunch",
  25,
  [
    ["tuna", 300],
    ["potato", 600],
    ["yogurt", 150],
    ["lemon", 60],
    ["dill", 10],
    ["salt", 2],
  ],
  [
    potatoStep,
    "Drain canned tuna and flake into a bowl.",
    "Mix yogurt with lemon juice, chopped dill, and salt.",
    "Toss warm potatoes with tuna and the dressing. Divide into three portions and serve warm or refrigerate promptly.",
  ],
  ["High protein"],
);
add(
  "Chicken rice lunch soup",
  "Lunch",
  35,
  [
    ["chicken breast", 400],
    ["rice", 150],
    ["carrot", 200],
    ["onion", 100],
    ["broth", 900],
    ["butter", 15],
    ["salt", 3],
  ],
  [
    "Dice onion and carrot. Melt butter in a pot and soften vegetables for 5 minutes.",
    "Add broth, rice, and 300 ml water. Simmer for 10 minutes.",
    "Cut chicken into 1 cm pieces, add to the soup, and simmer for 10–12 minutes until the rice is tender and chicken reaches 165°F / 74°C.",
    "Season with salt and divide into three bowls.",
  ],
  ["Batch cooking"],
);
add(
  "Tomato mozzarella toast",
  "Lunch",
  15,
  [
    ["bread", 300],
    ["mozzarella", 240],
    ["tomato", 400],
    ["olive oil", 15],
    ["salt", 2],
  ],
  [
    "Heat the oven broiler. Slice bread into six substantial pieces and toast lightly.",
    "Slice tomatoes and mozzarella. Brush toast with oil and arrange tomatoes and cheese on top.",
    "Broil for 3–5 minutes, watching constantly, until cheese melts.",
    "Season with salt and serve two toasts per person.",
  ],
  ["Vegetarian"],
);
add(
  "Egg & yogurt potato salad",
  "Lunch",
  30,
  [
    ["egg", 6],
    ["potato", 600],
    ["yogurt", 180],
    ["dill", 10],
    ["lemon", 60],
    ["salt", 2],
  ],
  [
    potatoStep,
    "Put eggs in a saucepan and cover with cold water. Bring to a boil, reduce to a simmer, and cook for 10 minutes. Cool in cold water and peel.",
    "Mix yogurt, chopped dill, lemon juice, and salt.",
    "Quarter eggs and combine gently with drained potatoes and dressing. Serve or refrigerate promptly.",
  ],
  ["Vegetarian"],
);
add(
  "Beef cheddar lunch wraps",
  "Lunch",
  25,
  [
    ["ground beef", 400],
    ["tortilla", 240],
    ["cheddar", 90],
    ["tomato", 200],
    ["onion", 80],
    ["salt", 2],
  ],
  [
    beefStep,
    "Dice tomatoes and grate cheddar. Warm tortillas briefly in a dry skillet.",
    "Divide cooked beef, tomato, and cheddar among six small tortillas.",
    "Fold in the sides and roll tightly. Return seam side down to the skillet for 1 minute to seal.",
  ],
  ["High protein"],
);
add(
  "White bean parmesan soup",
  "Lunch",
  25,
  [
    ["white beans", 600],
    ["broth", 700],
    ["carrot", 200],
    ["onion", 100],
    ["parmesan", 60],
    ["butter", 20],
    ["salt", 2],
  ],
  [
    "Use cooked or canned drained beans. Dice carrot and onion.",
    "Melt butter in a pot and soften vegetables for 6 minutes. Add broth and simmer for 10 minutes.",
    "Add beans and heat for 5 minutes. Mash one-third of the beans with a spoon for a creamy texture.",
    "Stir in parmesan and salt and serve in three bowls.",
  ],
  ["Vegetarian", "Budget"],
);
add(
  "Ricotta spinach quesadillas",
  "Lunch",
  20,
  [
    ["tortilla", 240],
    ["ricotta", 240],
    ["spinach", 150],
    ["mozzarella", 90],
    ["butter", 15],
    ["salt", 2],
  ],
  [
    "Wilt spinach in a skillet with 30 ml water for 2 minutes. Drain, squeeze dry, and chop.",
    "Mix spinach, ricotta, mozzarella, and salt. Spread over half of each of six tortillas and fold closed.",
    "Melt a little butter in the skillet over medium heat. Cook quesadillas for 2–3 minutes per side in batches until crisp and the filling is hot.",
    "Cut into wedges and serve two per person.",
  ],
  ["Vegetarian"],
);
add(
  "Creamy carrot rice soup",
  "Lunch",
  35,
  [
    ["carrot", 600],
    ["rice", 120],
    ["broth", 900],
    ["milk", 200],
    ["onion", 100],
    ["butter", 20],
    ["salt", 2],
  ],
  [
    "Dice onion and carrots. Soften onion in butter in a saucepan for 4 minutes.",
    "Add carrots, rice, broth, and salt. Cover and simmer for 22 minutes until rice and carrots are very tender.",
    "Remove from heat and blend carefully with an immersion blender.",
    "Stir in milk, warm gently for 2 minutes, and divide into three bowls.",
  ],
  ["Vegetarian"],
);
add(
  "Honey yogurt & strawberries",
  "Snack",
  5,
  [
    ["yogurt", 450],
    ["strawberry", 300],
    ["honey", 24],
  ],
  [
    "Wash and slice the strawberries.",
    "Divide yogurt into three small bowls.",
    "Add strawberries and a drizzle of honey to each bowl. Serve chilled.",
  ],
  ["Vegetarian"],
);
add(
  "Orange cottage cheese cups",
  "Snack",
  10,
  [
    ["cottage cheese", 450],
    ["orange", 450],
    ["honey", 15],
  ],
  [
    "Peel the oranges and cut away any seeds. Chop into bite-size pieces.",
    "Spoon cottage cheese into three bowls.",
    "Top with orange pieces and honey. Keep chilled until serving.",
  ],
  ["Vegetarian"],
);
add(
  "Warm cinnamon milk",
  "Snack",
  10,
  [
    ["milk", 750],
    ["honey", 30],
    ["cinnamon", 2],
    ["vanilla", 3],
  ],
  [
    "Warm milk with cinnamon in a small saucepan over medium-low heat, stirring for 5 minutes without boiling.",
    "Remove from the heat and stir in honey and vanilla.",
    "Pour into three heat-safe mugs and let cool to a comfortable drinking temperature.",
  ],
  ["Vegetarian"],
);
add(
  "Cheddar & apple plates",
  "Snack",
  5,
  [
    ["cheddar", 120],
    ["apple", 450],
  ],
  [
    "Wash and core apples, then slice thinly.",
    "Cut cheddar into small batons.",
    "Arrange apple and cheese on three plates and serve immediately.",
  ],
  ["Vegetarian", "No cook"],
);
add(
  "Vanilla banana yogurt dip",
  "Snack",
  10,
  [
    ["yogurt", 300],
    ["banana", 360],
    ["vanilla", 3],
    ["honey", 15],
  ],
  [
    "Stir yogurt with vanilla and honey until smooth.",
    "Peel bananas and slice into thick coins.",
    "Divide the dip and banana among three plates. Dip just before eating.",
  ],
  ["Vegetarian"],
);
add(
  "Buttery parmesan potato bites",
  "Snack",
  30,
  [
    ["potato", 450],
    ["butter", 20],
    ["parmesan", 40],
    ["salt", 2],
  ],
  [
    "Heat the oven to 425°F / 220°C. Cut potatoes into 1 cm cubes.",
    "Melt butter and toss with potatoes and salt on a baking tray.",
    "Roast for 20–25 minutes, turning halfway, until tender and crisp.",
    "Toss hot potatoes with finely grated parmesan and divide among three small bowls.",
  ],
  ["Vegetarian"],
);
add(
  "Hard-boiled eggs & fruit",
  "Snack",
  15,
  [
    ["egg", 6],
    ["orange", 450],
    ["salt", 1],
  ],
  [
    "Cover eggs with cold water in a saucepan. Bring to a boil, lower heat, and simmer for 10 minutes.",
    "Cool eggs in cold water for 3 minutes and peel.",
    "Peel oranges. Serve two eggs and one-third of the fruit per person with a small pinch of salt.",
  ],
  ["Vegetarian"],
);
add(
  "Mango ricotta cups",
  "Snack",
  10,
  [
    ["mango", 450],
    ["ricotta", 300],
    ["honey", 24],
    ["lime", 40],
  ],
  [
    "Peel mango, remove the stone, and dice the flesh.",
    "Beat ricotta with honey and the juice of the lime.",
    "Divide ricotta among three cups, top with mango, and serve chilled.",
  ],
  ["Vegetarian"],
);
add(
  "Vanilla milk rice pudding",
  "Dessert",
  40,
  [
    ["rice", 120],
    ["milk", 750],
    ["sugar", 45],
    ["vanilla", 5],
    ["cinnamon", 2],
  ],
  [
    "Rinse rice and combine with milk and 150 ml water in a heavy saucepan.",
    "Bring just to a simmer and cook on low for 30–35 minutes, stirring often, until rice is tender and creamy.",
    "Stir in sugar and vanilla. Cook for 2 more minutes.",
    "Divide into three bowls and sprinkle with cinnamon. Cool slightly before eating.",
  ],
  ["Vegetarian"],
);
add(
  "Baked cinnamon peaches",
  "Dessert",
  30,
  [
    ["peach", 600],
    ["butter", 24],
    ["sugar", 30],
    ["cinnamon", 2],
    ["yogurt", 180],
  ],
  [
    "Heat the oven to 375°F / 190°C. Halve peaches, remove stones, and place cut side up in a baking dish.",
    "Dot with butter and sprinkle with sugar and cinnamon. Add 30 ml water to the dish.",
    "Bake for 20–25 minutes until tender.",
    "Serve two peach halves per person with yogurt.",
  ],
  ["Vegetarian"],
);
add(
  "Orange juice gelatin cups",
  "Dessert",
  15,
  [
    ["orange juice", 600],
    ["gelatin", 12],
    ["sugar", 24],
  ],
  [
    "Sprinkle gelatin over 100 ml of the cold orange juice and let bloom for 5 minutes.",
    "Warm the remaining juice with sugar in a saucepan until steaming, without boiling.",
    "Remove from heat and whisk in bloomed gelatin until completely dissolved.",
    "Divide into three cups and refrigerate for at least 4 hours until set; active preparation is 15 minutes.",
  ],
  ["Make ahead"],
  "Refrigerate covered and use within 3 days.",
);
add(
  "Cocoa milk custard",
  "Dessert",
  30,
  [
    ["milk", 600],
    ["egg", 3],
    ["sugar", 60],
    ["cocoa", 24],
    ["vanilla", 3],
  ],
  [
    "Whisk eggs, sugar, and cocoa in a heat-safe bowl. Warm milk in a saucepan until steaming.",
    "Gradually whisk half the hot milk into the egg mixture. Return everything to the saucepan.",
    "Cook over low heat, stirring continuously, until the custard reaches 160°F / 71°C and lightly coats a spoon. Do not boil.",
    "Remove from heat, stir in vanilla, and divide into three bowls. Chill for 2 hours before serving.",
  ],
  ["Vegetarian"],
);
add(
  "Warm pear & ricotta dessert",
  "Dessert",
  25,
  [
    ["pear", 600],
    ["ricotta", 300],
    ["honey", 30],
    ["butter", 20],
    ["cinnamon", 2],
  ],
  [
    "Core pears and cut into thick slices. Melt butter in a skillet over medium-low heat.",
    "Add pears and cinnamon. Cook for 10–12 minutes, turning gently, until tender.",
    "Beat ricotta with honey and divide among three bowls.",
    "Spoon warm pears and pan juices over the ricotta.",
  ],
  ["Vegetarian"],
);
add(
  "Strawberry frozen yogurt bark",
  "Dessert",
  15,
  [
    ["yogurt", 450],
    ["strawberry", 250],
    ["honey", 40],
    ["vanilla", 3],
  ],
  [
    "Line a small tray with baking paper. Stir yogurt with honey and vanilla.",
    "Spread the mixture about 1 cm thick on the tray.",
    "Slice strawberries thinly and press them into the yogurt. Freeze for at least 4 hours; active preparation is 15 minutes.",
    "Break into pieces and divide into three portions. Let soften for 3 minutes before eating.",
  ],
  ["Vegetarian", "Make ahead"],
  "Freeze airtight for up to 2 weeks; eat promptly after thawing.",
);
add(
  "Apple oat crumble",
  "Dessert",
  40,
  [
    ["apple", 600],
    ["oats", 100],
    ["butter", 60],
    ["flour", 40],
    ["sugar", 60],
    ["cinnamon", 3],
  ],
  [
    "Heat the oven to 375°F / 190°C. Core and slice apples and place in a small baking dish.",
    "Toss apples with half the sugar, cinnamon, and 30 ml water.",
    "Rub butter into flour, oats, and remaining sugar until crumbly. Scatter over apples.",
    "Bake for 25–30 minutes until apples are tender and the topping is golden. Rest for 5 minutes and divide into three portions.",
  ],
  ["Vegetarian"],
);
add(
  "Banana cocoa milk pops",
  "Dessert",
  10,
  [
    ["banana", 300],
    ["milk", 300],
    ["cocoa", 15],
    ["honey", 30],
  ],
  [
    "Peel bananas and blend with milk, cocoa, and honey until completely smooth.",
    "Pour into six small freezer-pop molds and insert sticks.",
    "Freeze upright for at least 6 hours; active preparation is 10 minutes.",
    "Run the outside of each mold briefly under warm water to release. Serve two small pops per person.",
  ],
  ["Vegetarian", "Make ahead"],
  "Keep frozen for up to 2 weeks.",
);
add(
  "Orange vanilla milk cooler",
  "Drink",
  5,
  [
    ["orange juice", 450],
    ["milk", 450],
    ["vanilla", 3],
    ["honey", 15],
  ],
  [
    "Chill milk and orange juice before making the drink.",
    "Blend milk, juice, vanilla, and honey for 20 seconds.",
    "Pour immediately into three glasses. A slight natural separation is normal; stir before drinking.",
  ],
  ["Vegetarian"],
);
add(
  "Strawberry milk",
  "Drink",
  10,
  [
    ["strawberry", 300],
    ["milk", 600],
    ["honey", 30],
  ],
  [
    "Wash and hull strawberries.",
    "Blend strawberries with milk and honey until smooth.",
    "Divide among three glasses and serve cold.",
  ],
  ["Vegetarian"],
);
add(
  "Mango yogurt lassi",
  "Drink",
  5,
  [
    ["mango", 450],
    ["yogurt", 300],
    ["milk", 300],
    ["honey", 24],
  ],
  [
    "Peel mango and remove the stone.",
    "Blend mango, yogurt, milk, and honey for 30 seconds until smooth.",
    "Add cold water a tablespoon at a time if needed and pour into three glasses.",
  ],
  ["Vegetarian"],
);
add(
  "Comforting cocoa milk",
  "Drink",
  10,
  [
    ["milk", 750],
    ["cocoa", 24],
    ["sugar", 36],
    ["vanilla", 3],
  ],
  [
    "Whisk cocoa and sugar with 60 ml of the milk in a saucepan to make a smooth paste.",
    "Slowly add remaining milk while whisking. Heat over medium-low for 5 minutes until steaming.",
    "Stir in vanilla, pour into three mugs, and cool slightly before drinking.",
  ],
  ["Vegetarian"],
);
add(
  "Peach yogurt smoothie",
  "Drink",
  5,
  [
    ["peach", 450],
    ["yogurt", 300],
    ["milk", 300],
    ["honey", 24],
  ],
  [
    "Wash peaches, remove stones, and roughly chop.",
    "Blend peaches, yogurt, milk, and honey until smooth.",
    "Pour into three glasses. Serve promptly and refrigerate any remaining drink immediately.",
  ],
  ["Vegetarian"],
);
add(
  "Pineapple lime cooler",
  "Drink",
  10,
  [
    ["pineapple", 450],
    ["lime", 60],
    ["honey", 24],
  ],
  [
    "Remove pineapple skin and core, then dice the flesh.",
    "Blend pineapple with 450 ml cold water, lime juice, and honey.",
    "Strain only if preferred. Pour into three glasses and serve chilled.",
  ],
  ["Dairy free"],
);
add(
  "Gentle vanilla café au lait",
  "Drink",
  10,
  [
    ["coffee", 24],
    ["milk", 600],
    ["sugar", 30],
    ["vanilla", 3],
  ],
  [
    "Brew 300 ml coffee with the ground coffee using your usual filtered method; choose decaf if preferred.",
    "Warm milk with sugar and vanilla in a saucepan until steaming, without boiling.",
    "Divide coffee among three mugs and add the warm milk. Serve at a comfortable temperature.",
  ],
  ["Vegetarian"],
);
add(
  "Warm apple cinnamon cup",
  "Drink",
  15,
  [
    ["apple juice", 750],
    ["cinnamon", 3],
    ["orange", 120],
  ],
  [
    "Slice the orange and combine with apple juice and cinnamon in a saucepan.",
    "Warm gently for 8–10 minutes without boiling.",
    "Strain into three mugs and allow to cool slightly before drinking.",
  ],
  ["Dairy free"],
);
export const starterRecipes = all;
