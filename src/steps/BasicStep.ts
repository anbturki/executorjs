import { WorkflowContext } from '../core/WorkflowContext';
import { WorkflowStep } from '../core/WorkflowStep';

/**
 * Type definition for the step execution function.
 */
type StepExecutor<TContext extends WorkflowContext> = (context: TContext) => Promise<void> | void;

/**
 * A simple step implementation that uses a function for execution.
 */
export class BasicStep<TContext extends WorkflowContext = WorkflowContext>
  implements WorkflowStep<TContext>
{
  readonly name: string;
  private executor: StepExecutor<TContext>;

  /**
   * Creates a new basic step.
   * @param name The name of the step
   * @param executor The function to execute for this step
   */
  constructor(name: string, executor: StepExecutor<TContext>) {
    this.name = name;
    this.executor = executor;
  }

  /**
   * Executes the step.
   */
  async execute(context: TContext): Promise<void> {
    await this.executor(context);
  }
}
