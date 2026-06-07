import { AutomationSchema } from '@app/lib/api/schemas';
import { isAuthenticated } from '@server/middleware/auth';
import type { AutomationRunService } from '@server/services/automationRunService';
import type { AutomationService } from '@server/services/automationService';
import { defineRoute } from '@server/utils/defineRoute';
import { z } from 'zod';
import type { AutomationScheduler } from '../../cron/automationScheduler';
import { automationSchemas } from './automations.schemas';

interface Cradle {
  automationService: AutomationService;
  automationRunService: AutomationRunService;
  automationScheduler: AutomationScheduler;
}

export function createAutomationHandlers(cradle: Cradle) {
  const { automationService, automationRunService, automationScheduler } = cradle;

  return {
    list: [
      isAuthenticated(),
      defineRoute({
        schemas: { ...automationSchemas.list, response: z.array(AutomationSchema) },
        handler: async ({ query }) => automationService.list({ kind: query.kind }),
      }),
    ],

    create: [
      isAuthenticated(),
      defineRoute({
        schemas: { ...automationSchemas.create, response: AutomationSchema },
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
        schemas: { ...automationSchemas.updateStatus, response: AutomationSchema },
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

    listRuns: [
      isAuthenticated(),
      defineRoute({
        schemas: automationSchemas.listRuns,
        handler: async ({ query }) => {
          const data = await automationRunService.listRuns(query);
          return { data, total: data.length };
        },
      }),
    ],
  };
}
