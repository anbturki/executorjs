import { WorkflowContext } from './WorkflowContext';

/**
 * Interface for a workflow step.
 * Each step performs a discrete unit of work in the workflow.
 */
export interface WorkflowStep<TContext extends WorkflowContext = WorkflowContext> {
  /** Unique name for this step */
  readonly name: string;

  /**
   * Executes the step's logic.
   * @param context The workflow context
   * @returns A promise that resolves when the step completes
   */
  execute(context: TContext): Promise<void>;
}
