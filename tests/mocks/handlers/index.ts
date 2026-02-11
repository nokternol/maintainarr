import { authHandlers } from './auth';
import { backdropsHandlers } from './backdrops';

export const handlers = [...authHandlers, ...backdropsHandlers];
