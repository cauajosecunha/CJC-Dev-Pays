import { EventEmitter } from 'events';

class AppEventEmitter extends EventEmitter {}

export const appEvents = new AppEventEmitter();

export const EVENTS = {
  PAYMENT_CREATED: 'payment:created',
  PAYMENT_UPDATED: 'payment:updated',
  WEBHOOK_RECEIVED: 'webhook:received',
  WEBHOOK_DELIVERED: 'webhook:delivered',
  WEBHOOK_FAILED: 'webhook:failed',
};
