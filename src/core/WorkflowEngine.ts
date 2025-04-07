import { WorkflowContext, WorkflowContextOptions } from './WorkflowContext';
import { WorkflowStep } from './WorkflowStep';
import { WorkflowObserver } from './WorkflowObserver';

/**
 * Options for workflow engine configuration.
 */
export interface WorkflowEngineOptions<TInput, TResult>
  extends Omit<WorkflowContextOptions<TInput, TResult>, 'input'> {
  /** If true, execution will continue even if steps fail */
  continueOnError?: boolean;
  /** Maximum number of parallel steps to execute (default: 1) */
  maxConcurrency?: number;
}

/**
 * Core engine for executing workflow steps.
 */
export class WorkflowEngine<TInput = any, TResult = any> {
  private steps: WorkflowStep<WorkflowContext<TInput, TResult>>[] = [];
  private observers: WorkflowObserver<WorkflowContext<TInput, TResult>>[] = [];
  private options: WorkflowEngineOptions<TInput, TResult>;

  /**
   * Creates a new workflow engine.
   */
  constructor(options: WorkflowEngineOptions<TInput, TResult>) {
    this.options = {
      ...options,
      continueOnError: options.continueOnError ?? false,
      maxConcurrency: options.maxConcurrency ?? 1,
    };
  }

  /**
   * Adds a step to the workflow.
   * Steps are executed in the order they are added.
   */
  addStep(step: WorkflowStep<WorkflowContext<TInput, TResult>>): this {
    this.steps.push(step);
    return this;
  }

  /**
   * Adds multiple steps to the workflow.
   */
  addSteps(steps: WorkflowStep<WorkflowContext<TInput, TResult>>[]): this {
    this.steps.push(...steps);
    return this;
  }

  /**
   * Adds an observer to the workflow.
   */
  addObserver(observer: WorkflowObserver<WorkflowContext<TInput, TResult>>): this {
    this.observers.push(observer);
    return this;
  }

  /**
   * Adds multiple observers to the workflow.
   */
  addObservers(observers: WorkflowObserver<WorkflowContext<TInput, TResult>>[]): this {
    this.observers.push(...observers);
    return this;
  }

  /**
   * Executes the workflow with the provided input.
   */
  async execute(input: TInput): Promise<WorkflowContext<TInput, TResult>> {
    // Create the workflow context
    const context = new WorkflowContext<TInput, TResult>({
      ...this.options,
      input,
    });

    // Notify observers that workflow is starting
    await this.notifyObservers('onWorkflowStart', context);

    // Execute each step in sequence (future: support parallel execution)
    for (const step of this.steps) {
      context.currentStepName = step.name;

      try {
        // Notify observers that step is starting
        await this.notifyObservers('onStepStart', step.name, context);

        // Execute the step
        await step.execute(context);

        // Notify observers that step completed successfully
        await this.notifyObservers('onStepComplete', step.name, context);
      } catch (error) {
        // Record the error
        context.addError(step.name, error);

        // Notify observers about the error
        await this.notifyObservers('onStepError', step.name, error, context);

        // Stop workflow execution unless continueOnError is true
        if (!this.options.continueOnError) {
          break;
        }
      }
    }

    // Mark workflow as complete
    context.complete();

    // Notify observers that workflow is complete
    await this.notifyObservers('onWorkflowComplete', context);

    return context;
  }

  /**
   * Helper method to notify observers of an event.
   */
  private async notifyObservers(
    eventName: keyof WorkflowObserver,
    context: WorkflowContext<TInput, TResult>
  ): Promise<void>;

  private async notifyObservers(
    eventName: 'onStepStart' | 'onStepComplete',
    stepName: string,
    context: WorkflowContext<TInput, TResult>
  ): Promise<void>;

  private async notifyObservers(
    eventName: 'onStepError',
    stepName: string,
    error: any,
    context: WorkflowContext<TInput, TResult>
  ): Promise<void>;

  private async notifyObservers(eventName: keyof WorkflowObserver, ...args: any[]): Promise<void> {
    for (const observer of this.observers) {
      const method = observer[eventName];
      if (typeof method === 'function') {
        try {
          await (method as Function).apply(observer, args);
        } catch (error) {
          console.error(`Error in workflow observer (${eventName})`, error);
        }
      }
    }
  }
}
