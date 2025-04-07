import { WorkflowContext } from '../core/WorkflowContext';
import { WorkflowObserver } from '../core/WorkflowObserver';

/**
 * Options for console observer configuration.
 */
export interface ConsoleObserverOptions {
    /** Whether to log step start events */
    logStepStart?: boolean;
    /** Whether to log step complete events */
    logStepComplete?: boolean;
    /** Whether to log step error events */
    logStepError?: boolean;
    /** Whether to log workflow start events */
    logWorkflowStart?: boolean;
    /** Whether to log workflow complete events */
    logWorkflowComplete?: boolean;
    /** Whether to use console.time for performance measurements */
    useConsoleTime?: boolean;
    /** Log level for normal messages */
    logLevel?: 'log' | 'info' | 'debug';
}

/**
 * Observer that logs workflow execution to the console.
 */
export class ConsoleObserver<TContext extends WorkflowContext = WorkflowContext>
    implements WorkflowObserver<TContext> {

    private options: Required<ConsoleObserverOptions>;

    /**
     * Creates a new console observer.
     */
    constructor(options: ConsoleObserverOptions = {}) {
        this.options = {
            logStepStart: true,
            logStepComplete: true,
            logStepError: true,
            logWorkflowStart: true,
            logWorkflowComplete: true,
            useConsoleTime: true,
            logLevel: 'log',
            ...options
        };
    }

    /**
     * Logs the start of a workflow step.
     */
    onStepStart(stepName: string, context: TContext): void {
        if (!this.options.logStepStart) return;

        const message = `[${context.workflowId}] Starting step: ${stepName}`;

        console[this.options.logLevel](message);

        if (this.options.useConsoleTime) {
            console.time(`[${context.workflowId}] ${stepName}`);
        }
    }

    /**
     * Logs the successful completion of a workflow step.
     */
    onStepComplete(stepName: string, context: TContext): void {
        if (!this.options.logStepComplete) return;

        if (this.options.useConsoleTime) {
            console.timeEnd(`[${context.workflowId}] ${stepName}`);
        }

        console[this.options.logLevel](`[${context.workflowId}] Completed step: ${stepName}`);
    }

    /**
     * Logs an error that occurred during a workflow step.
     */
    onStepError(stepName: string, error: any, context: TContext): void {
        if (!this.options.logStepError) return;

        if (this.options.useConsoleTime) {
            console.timeEnd(`[${context.workflowId}] ${stepName}`);
        }

        console.error(`[${context.workflowId}] Error in step ${stepName}:`, error);
    }

    /**
     * Logs the start of a workflow.
     */
    onWorkflowStart(context: TContext): void {
        if (!this.options.logWorkflowStart) return;

        console[this.options.logLevel](
            `[${context.workflowId}] Starting workflow: ${context.workflowId}`,
            context.input ? `with input: ${JSON.stringify(context.input)}` : ''
        );

        if (this.options.useConsoleTime) {
            console.time(`[${context.workflowId}] Workflow ${context.workflowId}`);
        }
    }

    /**
     * Logs the completion of a workflow.
     */
    onWorkflowComplete(context: TContext): void {
        if (!this.options.logWorkflowComplete) return;

        if (this.options.useConsoleTime) {
            console.timeEnd(`[${context.workflowId}] Workflow ${context.workflowId}`);
        }

        const status = context.errors.length === 0 ? 'successfully' : `with ${context.errors.length} errors`;

        console[this.options.logLevel](
            `[${context.workflowId}] Workflow ${context.workflowId} completed ${status} in ${context.durationMs}ms`
        );

        if (context.errors.length > 0) {
            console.error(`[${context.workflowId}] Workflow errors:`, context.errors);
        }
    }
}

