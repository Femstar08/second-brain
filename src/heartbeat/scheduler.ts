import { randomUUID } from "node:crypto";
import { CronExpressionParser } from "cron-parser";
import type { Database } from "../db.js";
import { logger } from "../logger.js";

export interface ScheduledTask {
  id: string;
  chatId: string;
  prompt: string;
  schedule: string;
  nextRun: number;
  lastRun: number | null;
  lastResult: string | null;
  status: string;
}

/**
 * Compute the next run time (unix seconds) from a cron expression.
 * Uses cron-parser v5 API (CronExpressionParser.parse).
 */
export function computeNextRun(cronExpression: string): number {
  const interval = CronExpressionParser.parse(cronExpression);
  return Math.floor(interval.next().getTime() / 1000);
}

/**
 * Insert a new scheduled task into the database.
 * If nextRun is not provided, it is computed from the cron schedule.
 */
export function createScheduledTask(
  db: Database,
  params: {
    chatId: string;
    prompt: string;
    schedule: string;
    nextRun?: number;
  },
): string {
  const id = randomUUID();
  const nextRun = params.nextRun ?? computeNextRun(params.schedule);
  db.prepare(
    `INSERT INTO scheduled_tasks (id, chat_id, prompt, schedule, next_run, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?)`,
  ).run(id, params.chatId, params.prompt, params.schedule, nextRun, Math.floor(Date.now() / 1000));
  return id;
}

/**
 * Return all active tasks whose next_run is at or before the current time.
 */
export function getDueTasks(db: Database): ScheduledTask[] {
  const now = Math.floor(Date.now() / 1000);
  return db
    .prepare(
      `SELECT id, chat_id AS chatId, prompt, schedule, next_run AS nextRun,
              last_run AS lastRun, last_result AS lastResult, status
       FROM scheduled_tasks
       WHERE status = 'active' AND next_run <= ?`,
    )
    .all(now) as ScheduledTask[];
}

/**
 * After a task runs, update its last_run, last_result, and compute the next run time.
 */
export function updateTaskAfterRun(db: Database, taskId: string, result: string): void {
  const task = db.prepare("SELECT schedule FROM scheduled_tasks WHERE id = ?").get(taskId) as
    | { schedule: string }
    | undefined;
  if (!task) {
    return;
  }

  const nextRun = computeNextRun(task.schedule);
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `UPDATE scheduled_tasks SET last_run = ?, last_result = ?, next_run = ? WHERE id = ?`,
  ).run(now, result, nextRun, taskId);
}

export type SendFn = (chatId: string, text: string) => Promise<void>;
export type RunFn = (prompt: string, chatId: string) => Promise<string>;

/** If the provider responds with just HEARTBEAT_OK, suppress the message to the channel. */
const HEARTBEAT_OK = /HEARTBEAT_OK/i;

/**
 * Start a polling loop that checks for due tasks every `intervalMs` milliseconds.
 * For each due task, runs the prompt via `run`, updates the DB, and sends the
 * result to the channel unless the response is a HEARTBEAT_OK suppression signal.
 */
export function startSchedulerLoop(
  db: Database,
  run: RunFn,
  send: SendFn,
  intervalMs = 60_000,
): { stop: () => void } {
  const timer = setInterval(async () => {
    const tasks = getDueTasks(db);
    for (const task of tasks) {
      logger.info({ taskId: task.id, prompt: task.prompt.slice(0, 50) }, "Running scheduled task");
      try {
        const result = await run(task.prompt, task.chatId);
        updateTaskAfterRun(db, task.id, result);

        // Only send if not a HEARTBEAT_OK response
        if (!HEARTBEAT_OK.test(result.trim())) {
          await send(task.chatId, result);
        }
      } catch (err) {
        logger.error({ err, taskId: task.id }, "Scheduled task failed");
        const message = err instanceof Error ? err.message : String(err);
        updateTaskAfterRun(db, task.id, `ERROR: ${message}`);
      }
    }
  }, intervalMs);

  return { stop: () => clearInterval(timer) };
}
