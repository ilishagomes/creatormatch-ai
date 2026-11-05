/**
 * TOPIC TAXONOMY
 *
 * A hand-written dictionary that groups words into TOPICS, and topics into
 * FAMILIES. It lets "serum" in a brief match a creator tagged "skincare":
 *
 *   family "skincare"
 *     ├─ topic "Acne & oily skin"     acne, breakout, salicylic, oily skin…
 *     ├─ topic "Hydration"            moisturizer, moisturiser, dry skin…
 *     └─ topic "Active ingredients"   serum, retinol, vitamin c…
 *
 * Same topic   → exact match   (full credit)
 * Same family  → related match (half credit)
 * Otherwise    → no match
 *
 * "broad" topics (e.g. plain "fitness" or "reviews") tell us less about fit
 * than specific ones (e.g. "acne"), so they carry half the importance.
 *
 * Terms are written in singular, lower case; the tokenizer strips plurals and
 * punctuation from both sides before comparing.
 */

export type Family =
  | "skincare" | "beauty" | "fashion" | "fitness" | "technology" | "food" | "lifestyle"
  | "values" | "format";

export interface Topic {
  id: string;
  label: string;
  family: Family;
  specificity: "specific" | "broad";
  terms: string[];
}

export const TOPICS: Topic[] = [
  // ------------------------------------------------------------- skincare
  { id: "skincare.general", label: "Skincare", family: "skincare", specificity: "broad",
    terms: ["skincare", "skin care", "skincare routine", "skincare advice", "skin", "complexion", "affordable skincare"] },
  { id: "skincare.acne", label: "Acne & oily skin", family: "skincare", specificity: "specific",
    terms: ["acne", "acne prone", "breakout", "blemish", "pimple", "salicylic", "benzoyl", "oily skin", "pore", "blackhead"] },
  { id: "skincare.hydration", label: "Moisturising & hydration", family: "skincare", specificity: "specific",
    terms: ["moisturizer", "moisturiser", "moisturising", "moisturizing", "hydration", "hydrating", "dry skin", "skin barrier", "lotion"] },
  { id: "skincare.actives", label: "Serums & active ingredients", family: "skincare", specificity: "specific",
    terms: ["serum", "vitamin c", "retinol", "retinoid", "niacinamide", "hyaluronic", "aha", "bha", "exfoliant", "exfoliation", "ingredient", "active ingredient"] },
  { id: "skincare.sun", label: "Sun protection", family: "skincare", specificity: "specific",
    terms: ["sunscreen", "spf", "sun protection", "sunblock"] },
  { id: "skincare.ageing", label: "Anti-ageing", family: "skincare", specificity: "specific",
    terms: ["anti aging", "anti ageing", "wrinkle", "fine line", "aging", "ageing"] },
  { id: "skincare.cleansing", label: "Cleansing", family: "skincare", specificity: "specific",
    terms: ["cleanser", "face wash", "cleansing", "cleansing balm"] },
  { id: "skincare.sensitive", label: "Sensitive skin", family: "skincare", specificity: "specific",
    terms: ["sensitive skin", "fragrancefree", "rosacea", "eczema", "redness"] },
  { id: "skincare.derm", label: "Dermatology", family: "skincare", specificity: "specific",
    terms: ["dermatology", "dermatologist", "derm", "esthetician", "medical esthetician", "cosmetic procedure", "dark spot", "hyperpigmentation", "hair loss"] },
  { id: "skincare.kbeauty", label: "K-beauty", family: "skincare", specificity: "specific",
    terms: ["korean skincare", "k beauty"] },

  // --------------------------------------------------------------- beauty
  { id: "beauty.general", label: "Beauty", family: "beauty", specificity: "broad",
    terms: ["beauty", "glam", "beauty marketing"] },
  { id: "beauty.makeup", label: "Makeup", family: "beauty", specificity: "specific",
    terms: ["makeup", "make up", "foundation", "concealer", "lipstick", "lip gloss", "eyeshadow", "mascara", "cosmetic", "blush", "primer", "setting spray"] },
  { id: "beauty.hair", label: "Hair care", family: "beauty", specificity: "specific",
    terms: ["hair", "haircare", "hair care", "shampoo", "conditioner", "hair oil"] },
  { id: "beauty.inclusive", label: "Inclusive beauty", family: "beauty", specificity: "specific",
    terms: ["inclusive beauty", "dark skin", "dark skin representation", "shade range", "deeper skin tone"] },
  { id: "beauty.fragrance", label: "Fragrance", family: "beauty", specificity: "specific",
    terms: ["fragrance", "perfume", "scent", "candle"] },

  // -------------------------------------------------------------- fashion
  { id: "fashion.general", label: "Fashion & style", family: "fashion", specificity: "broad",
    terms: ["fashion", "style", "styling", "outfit", "wardrobe", "clothing", "apparel", "clothes"] },
  { id: "fashion.luxury", label: "Luxury & designer fashion", family: "fashion", specificity: "specific",
    terms: ["luxury fashion", "designer", "high fashion", "runway", "fashion week", "couture", "luxury"] },
  { id: "fashion.menswear", label: "Menswear", family: "fashion", specificity: "specific",
    terms: ["menswear", "men's fashion", "mens fashion"] },
  { id: "fashion.minimal", label: "Minimalist & capsule style", family: "fashion", specificity: "specific",
    terms: ["capsule wardrobe", "capsule collection", "minimalist style", "scandinavian style", "basics", "knitwear"] },
  { id: "fashion.accessories", label: "Accessories", family: "fashion", specificity: "specific",
    terms: ["accessory", "accessories", "handbag", "jewelry", "jewellery", "shoe", "sneaker", "bag"] },
  { id: "fashion.looks", label: "Lookbooks & concept looks", family: "fashion", specificity: "specific",
    terms: ["lookbook", "concept look", "outfit idea", "street style"] },

  // -------------------------------------------------------------- fitness
  { id: "fitness.general", label: "Fitness & exercise", family: "fitness", specificity: "broad",
    terms: ["fitness", "exercise", "workout", "training", "train", "sport", "athletic", "active lifestyle"] },
  { id: "fitness.strength", label: "Gym & strength training", family: "fitness", specificity: "specific",
    terms: ["gym", "strength training", "strength", "weightlifting", "lifting", "lift", "bodybuilding", "powerlifting", "muscle", "muscle building", "squat"] },
  { id: "fitness.cardio", label: "Running & cardio", family: "fitness", specificity: "specific",
    terms: ["running", "runner", "marathon", "jogging", "cardio", "hiit", "cycling"] },
  { id: "fitness.home", label: "Home workouts", family: "fitness", specificity: "specific",
    terms: ["home workout", "at home workout", "no equipment", "bodyweight", "beginner workout", "family fitness"] },
  { id: "fitness.mobility", label: "Pilates, yoga & core", family: "fitness", specificity: "specific",
    terms: ["pilates", "yoga", "toning", "ab workout", "abs", "stretching", "mobility"] },
  { id: "fitness.programmes", label: "Workout programmes & challenges", family: "fitness", specificity: "specific",
    terms: ["workout programme", "workout program", "training plan", "workout challenge", "fitness app", "workout app", "online coaching"] },
  { id: "fitness.activewear", label: "Activewear", family: "fitness", specificity: "specific",
    terms: ["activewear", "athleisure", "legging", "sports bra", "athletic apparel", "gym wear", "sportswear", "workout clothes", "training kit"] },
  { id: "fitness.women", label: "Women's fitness", family: "fitness", specificity: "specific",
    terms: ["women's fitness", "womens fitness", "postpartum fitness", "women who lift"] },
  { id: "fitness.nutrition", label: "Sports nutrition", family: "fitness", specificity: "specific",
    terms: ["nutrition", "protein", "macro", "supplement", "meal plan"] },

  // ----------------------------------------------------------- technology
  { id: "tech.general", label: "Consumer technology", family: "technology", specificity: "broad",
    terms: ["tech", "technology", "consumer technology", "consumer electronics", "electronics", "gadget", "device"] },
  { id: "tech.mobile", label: "Smartphones", family: "technology", specificity: "specific",
    terms: ["smartphone", "phone", "iphone", "android", "mobile"] },
  { id: "tech.computing", label: "Computers & software", family: "technology", specificity: "specific",
    terms: ["laptop", "pc", "computer", "pc hardware", "pc building", "computer component", "desktop", "linux", "software", "operating system", "keyboard", "monitor"] },
  { id: "tech.audio", label: "Audio", family: "technology", specificity: "specific",
    terms: ["headphone", "earbud", "speaker", "audio", "noise cancelling", "noise canceling"] },
  { id: "tech.camera", label: "Cameras", family: "technology", specificity: "specific",
    terms: ["camera", "photography", "lens"] },
  { id: "tech.wearables", label: "Wearables", family: "technology", specificity: "specific",
    terms: ["smartwatch", "wearable", "health gadget", "fitness tracker"] },
  { id: "tech.gaming", label: "Gaming", family: "technology", specificity: "specific",
    terms: ["gaming", "gamer", "video game", "console", "esport"] },
  { id: "tech.ai", label: "AI", family: "technology", specificity: "specific",
    terms: ["ai", "artificial intelligence"] },
  { id: "tech.ev", label: "Electric vehicles", family: "technology", specificity: "specific",
    terms: ["electric vehicle", "electric car"] },
  { id: "tech.apple", label: "Apple ecosystem", family: "technology", specificity: "specific",
    terms: ["apple", "ipad", "macbook", "mac"] },

  // ----------------------------------------------------------------- food
  { id: "food.general", label: "Cooking & recipes", family: "food", specificity: "broad",
    terms: ["food", "cooking", "cook", "recipe", "meal", "kitchen", "chef", "cookbook", "cuisine", "from scratch"] },
  { id: "food.baking", label: "Baking", family: "food", specificity: "specific",
    terms: ["baking", "bake", "bread", "pastry", "dessert", "cake"] },
  { id: "food.comfort", label: "Comfort & fast food", family: "food", specificity: "specific",
    terms: ["comfort food", "fast food", "fast food remake", "burger", "pizza", "pasta", "sauce"] },
  { id: "food.healthy", label: "Healthy eating", family: "food", specificity: "specific",
    terms: ["healthy recipe", "healthy eating", "healthy food", "wholesome"] },
  { id: "food.global", label: "Global cuisine", family: "food", specificity: "specific",
    terms: ["global cuisine", "world cuisine", "international cuisine"] },
  { id: "food.easy", label: "Easy & budget cooking", family: "food", specificity: "specific",
    terms: ["easy recipe", "quick meal", "budget meal", "cooking basic", "beginner cooking", "weeknight dinner"] },
  { id: "food.drinks", label: "Coffee & drinks", family: "food", specificity: "specific",
    terms: ["coffee", "tea", "matcha", "cold brew", "beverage", "drink", "cafe"] },
  { id: "food.snacks", label: "Snacks", family: "food", specificity: "specific",
    terms: ["snack", "protein bar", "granola", "muesli"] },
  { id: "food.dining", label: "Restaurants & food entertainment", family: "food", specificity: "specific",
    terms: ["restaurant", "restaurant review", "food challenge", "masterchef", "film and tv food"] },

  // ------------------------------------------------------------ lifestyle
  { id: "lifestyle.general", label: "Lifestyle", family: "lifestyle", specificity: "broad",
    terms: ["lifestyle", "vlog", "daily life", "day in the life"] },
  { id: "lifestyle.productivity", label: "Productivity", family: "lifestyle", specificity: "specific",
    terms: ["productivity", "time management", "study tip", "habit", "focus", "productivity app", "planner"] },
  { id: "lifestyle.growth", label: "Self-improvement & wellbeing", family: "lifestyle", specificity: "specific",
    terms: ["self improvement", "personal development", "self care", "positivity", "wellness", "wellbeing", "mental health", "mindfulness"] },
  { id: "lifestyle.minimalism", label: "Minimalism", family: "lifestyle", specificity: "specific",
    terms: ["minimalism", "minimalist", "digital minimalism", "declutter"] },
  { id: "lifestyle.business", label: "Business & learning", family: "lifestyle", specificity: "specific",
    terms: ["entrepreneurship", "entrepreneur", "small business", "book", "online course"] },
  { id: "lifestyle.travel", label: "Travel", family: "lifestyle", specificity: "specific",
    terms: ["travel", "holiday", "vacation"] },
  { id: "lifestyle.home", label: "Home", family: "lifestyle", specificity: "specific",
    // (plain "home" is deliberately excluded: "train at home" is not about home decor)
    terms: ["home decor", "interior", "home good", "kitchenware", "cookware"] },

  // ---------------------------------------------- values (cross-category)
  { id: "values.vegan", label: "Vegan & cruelty-free", family: "values", specificity: "specific",
    terms: ["vegan", "plant based", "cruelty free", "vegan skincare"] },
  { id: "values.sustainable", label: "Sustainability", family: "values", specificity: "specific",
    terms: ["sustainable", "sustainability", "eco friendly", "recycled"] },

  // ---------------------------------------------- content format (broad)
  { id: "format.reviews", label: "Honest reviews", family: "format", specificity: "broad",
    terms: ["review", "product review", "honest review", "honest", "unboxing", "tech unboxing", "tech test", "benchmark", "tested"] },
  { id: "format.education", label: "Education & explainers", family: "format", specificity: "broad",
    terms: ["education", "educator", "educational", "explain", "explainer", "science", "science based", "evidence based", "myth busting"] },
  { id: "format.tutorials", label: "Tutorials & routines", family: "format", specificity: "broad",
    terms: ["tutorial", "how to", "guide", "routine", "makeup tutorial"] },
  { id: "format.shortform", label: "Short-form video", family: "format", specificity: "broad",
    terms: ["short form video", "short", "reel"] },
  { id: "format.longform", label: "Long-form & podcasts", family: "format", specificity: "broad",
    terms: ["podcast", "documentary", "filmmaking", "interview"] },
  { id: "format.challenges", label: "Challenges & transformations", family: "format", specificity: "broad",
    terms: ["challenge", "transformation", "makeover"] },
  { id: "format.hauls", label: "Hauls & try-ons", family: "format", specificity: "broad",
    terms: ["haul", "try on"] },
];

export const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]));
