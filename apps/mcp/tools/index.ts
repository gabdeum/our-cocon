import type { Module } from '../src/tools.js';
import { groceries } from './groceries/index.js';
import { recipes } from './recipes/index.js';

/**
 * Every module's tools, in the order assistants see them. A new module (groceries, calendar, …)
 * is a folder in tools/ exporting a Module, added here.
 */
export const modules: readonly Module[] = [recipes, groceries];
