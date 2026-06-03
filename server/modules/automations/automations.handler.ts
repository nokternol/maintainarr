import { isAuthenticated } from '@server/middleware/auth';
import type { AutomationService } from '@server/services/automationService';
import { defineRoute } from '@server/utils/defineRoute';
import type { AutomationScheduler } from '../../cron/automationScheduler';
import { automationSchemas } from './automations.schemas';

interface Cradle {
  automationService: AutomationService;
  automationScheduler: AutomationScheduler;
}

export function createAutomationHandlers(cradle: Cradle) {
  const { automationService, automationScheduler } = cradle;

  return {
    list: [
      isAuthenticated(),
      defineRoute({
        handler: async () => automationService.list(),
      }),
    ],

    create: [
      isAuthenticated(),
      defineRoute({
        schemas: automationSchemas.create,
        handler: async ({ body }) => {
          const automation = await automationService.create(body);
          automationScheduler.schedule({
            id: automation.id,
            name: automation.name,
            schedule: automation.schedule,
          });
          return automation;
        },
      }),
    ],

    updateStatus: [
      isAuthenticated(),
      defineRoute({
        schemas: automationSchemas.updateStatus,
        handler: async ({ params, body }) => {
          const automation = await automationService.updateStatus(params.id, body.status);
          if (body.status === 'active') {
            automationScheduler.schedule({
              id: automation.id,
              name: automation.name,
              schedule: automation.schedule,
            });
          } else {
            automationScheduler.unschedule(automation.id);
          }
          return automation;
        },
      }),
    ],

    delete: [
      isAuthenticated(),
      defineRoute({
        schemas: automationSchemas.delete,
        handler: async ({ params }) => {
          automationScheduler.unschedule(params.id);
          await automationService.delete(params.id);
          return null;
        },
      }),
    ],
  };
}
