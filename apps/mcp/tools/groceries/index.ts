import type { Module } from '../../src/tools.js';
import { addRecipeToGroceries } from './from-recipe.js';
import { listGroceries } from './list.js';
import { addGroceries, checkGrocery, clearDoneGroceries, removeGrocery } from './write.js';

/** Spec 024: the family's shared grocery list. */
export const groceries: Module = {
  name: 'groceries',
  instructions:
    'Groceries: the family shares one grocery list. list_groceries reads it by aisle (quote its amounts; never work them out). add_groceries adds items the member names, check_grocery ticks one off (by id or name), remove_grocery removes one and clear_done_groceries clears what’s ticked. add_recipe_to_groceries adds what a recipe needs: first ask which of its ingredients the family already has, and leave those out. Everything you change shows in the app as done by the member via you, and they can undo it.',
  tools: [listGroceries, addGroceries, checkGrocery, removeGrocery, clearDoneGroceries, addRecipeToGroceries],
};
