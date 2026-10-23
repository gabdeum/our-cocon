import type { Module } from '../../src/tools.js';
import { getRecipe } from './get.js';
import { searchRecipes } from './search.js';
import { createRecipe, deleteRecipe, updateRecipe } from './write.js';

/** Spec 023: the family's recipes. */
export const recipes: Module = {
  name: 'recipes',
  instructions:
    'Recipes: search_recipes finds the family’s recipes (by words, season, total time, cuisine or who added them) and get_recipe reads one, scaled and with variants applied. Amounts and temperatures come written out: quote them, never convert or scale them yourself. Link to the recipe in the app when you mention one. create_recipe saves a new one and update_recipe changes one, variants (versions and options) included; delete_recipe moves one to Recently deleted (restorable for 30 days). Before saving, check you know how many it serves and each amount and unit; ask the member when one is missing.',
  tools: [searchRecipes, getRecipe, createRecipe, updateRecipe, deleteRecipe],
};
