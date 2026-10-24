import type { Module } from '../../src/tools.js';
import { getRecipe } from './get.js';
import { searchRecipes } from './search.js';
import { createRecipe, deleteRecipe, updateRecipe } from './write.js';

/** Spec 023: the family's recipes. */
export const recipes: Module = {
  name: 'recipes',
  instructions:
    'Recipes: search_recipes finds the family’s recipes (by words, season, total time, cuisine or who added them) and get_recipe reads one: as_shown is what the member sees (scaled, variants applied; quote its amounts and temperatures, never convert or scale them yourself), for_editing is what you change and send back. Link to the recipe in the app when you mention one. create_recipe saves a new one and update_recipe changes one, variants (versions and options) included; delete_recipe moves one to Recently deleted (restorable for 30 days). Before saving, read create_recipe’s description: it says how the app shows a recipe, which you can’t see from here.',
  tools: [searchRecipes, getRecipe, createRecipe, updateRecipe, deleteRecipe],
};
