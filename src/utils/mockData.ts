import { Recipe } from '@/types/recipe';

type MockTemplate = Omit<Recipe, 'extractedAt' | 'collections' | 'savedAt'>;

// Cycled by Dashboard when useMock is true, so repeated demo extractions produce
// different cards (and eventually a duplicate, to exercise that state).
export const mockRecipePool: MockTemplate[] = [
  {
    id: 'mock-1',
    title: 'Crispy Garlic Parmesan Potatoes',
    sourceUrl: 'https://www.instagram.com/reel/C8XyZ/',
    servings: '4',
    prepTime: '10 mins',
    cookTime: '25 mins',
    tags: ['Potato', 'Vegetarian', 'Oven-baked'],
    ingredients: [
      { name: 'Baby Yukon Gold Potatoes', amount: '1.5', unit: 'lbs' },
      { name: 'Olive Oil', amount: '2', unit: 'tbsp' },
      { name: 'Garlic Powder', amount: '1', unit: 'tbsp' },
      { name: 'Parmesan Cheese', amount: '1/2', unit: 'cup' },
      { name: 'Sea Salt and Pepper', amount: 'to taste', unit: '' },
    ],
    instructions: [
      'Wash and cut potatoes into halves.',
      'Toss with oil, garlic powder, salt, pepper, and parmesan.',
      'Arrange cut-side down on baking sheet.',
      'Roast at 200°C for 25 minutes until golden and crispy.',
      'Serve hot with crispy cheese edges.',
    ],
  },
  {
    id: 'mock-2',
    title: 'Honey Garlic Salmon Bowls',
    sourceUrl: 'https://www.tiktok.com/@chef/video/example2',
    servings: '2',
    prepTime: '8 mins',
    cookTime: '15 mins',
    tags: ['Seafood', 'Quick'],
    ingredients: [
      { name: 'Salmon Fillets', amount: '2', unit: 'pieces' },
      { name: 'Honey', amount: '2', unit: 'tbsp' },
      { name: 'Soy Sauce', amount: '2', unit: 'tbsp' },
      { name: 'Garlic, minced', amount: '3', unit: 'cloves' },
      { name: 'Cooked Rice', amount: '2', unit: 'cups' },
    ],
    instructions: [
      'Whisk honey, soy sauce, and garlic in a bowl.',
      'Sear salmon skin-side down for 4 minutes.',
      'Flip and brush with the honey-garlic glaze.',
      'Cook 3 more minutes until glazed and flaky.',
      'Serve over rice with the pan sauce spooned on top.',
    ],
  },
  {
    id: 'mock-3',
    title: 'One-Pan Lemon Herb Chicken',
    sourceUrl: 'https://www.youtube.com/shorts/example3',
    servings: '4',
    prepTime: '12 mins',
    cookTime: '30 mins',
    tags: ['Chicken', 'Oven-baked'],
    ingredients: [
      { name: 'Chicken Thighs', amount: '4', unit: 'pieces' },
      { name: 'Lemon', amount: '1', unit: 'whole' },
      { name: 'Rosemary', amount: '2', unit: 'sprigs' },
      { name: 'Baby Potatoes', amount: '1', unit: 'lb' },
      { name: 'Olive Oil', amount: '2', unit: 'tbsp' },
    ],
    instructions: [
      'Toss potatoes and chicken with oil, lemon, and rosemary.',
      'Arrange in a single layer on a sheet pan.',
      'Roast at 200°C for 30 minutes.',
      'Rest the chicken for 5 minutes before serving.',
      'Spoon pan juices over the top.',
    ],
  },
];

// Kept for the existing API route contract (`useMock: true` returns this single recipe).
export const mockRecipe: Recipe = {
  ...mockRecipePool[0],
  extractedAt: new Date().toISOString(),
  collections: [],
  savedAt: null,
};
