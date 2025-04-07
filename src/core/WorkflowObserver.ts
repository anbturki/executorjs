import { WorkflowContext } from './WorkflowContext';

/**
 * Interface for observing workflow execution events.
 * Observers can monitor and react to the workflow lifecycle without
 * affecting the core execution flow.
 */
export interface WorkflowObserver<TContext extends WorkflowContext = WorkflowContext> {
  /**
   * Called when a workflow step is about to start.
   * @param stepName The name of the step
   * @param context The workflow context
   */
  onStepStart?(stepName: string, context: TContext): void | Promise<void>;

  /**
   * Called when a workflow step has completed successfully.
   * @param stepName The name of the step
   * @param context The workflow context
   */
  onStepComplete?(stepName: string, context: TContext): void | Promise<void>;

  /**
   * Called when a workflow step has failed with an error.
   * @param stepName The name of the step
   * @param error The error that occurred
   * @param context The workflow context
   */
  onStepError?(stepName: string, error: any, context: TContext): void | Promise<void>;

  /**
   * Called when the entire workflow has completed (successfully or with errors).
   * @param context The workflow context
   */
  onWorkflowComplete?(context: TContext): void | Promise<void>;

  /**
   * Called when the workflow is about to start.
   * @param context The workflow context
   */
  onWorkflowStart?(context: TContext): void | Promise<void>;
}
