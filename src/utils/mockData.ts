import { Recipe } from '@/types/recipe';

export const mockRecipe: Recipe = {
  id: 'mock-1',
  title: 'Crispy Garlic Parmesan Potatoes',
  sourceUrl: 'https://www.instagram.com/reel/C8XyZ/',
  extractedAt: new Date().toISOString(),
  servings: '4',
  prepTime: '10 mins',
  cookTime: '25 mins',
  ingredients: [
    { name: 'Baby Yukon Gold Potatoes', amount: '1.5', unit: 'lbs' },
    { name: 'Olive Oil', amount: '2', unit: 'tbsp' },
    { name: 'Garlic Powder', amount: '1', unit: 'tbsp' },
    { name: 'Parmesan Cheese', amount: '1/2', unit: 'cup' },
    { name: 'Sea Salt & Pepper', amount: 'to taste', unit: '' },
  ],
  instructions: [
    'Wash and cut potatoes into halves.',
    'Toss with oil, garlic powder, salt, pepper, and parmesan.',
    'Arrange cut-side down on baking sheet.',
    'Roast at 200°C for 25 minutes until golden and crispy.',
    'Serve hot with crispy cheese edges.',
  ],
};
