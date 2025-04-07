import { WorkflowContext } from '../core/WorkflowContext';
import { WorkflowStep } from '../core/WorkflowStep';

/**
 * Type definition for the condition function.
 */
type ConditionFn<TContext extends WorkflowContext> = (
  context: TContext
) => boolean | Promise<boolean>;

/**
 * A step that conditionally executes one of two steps based on a condition.
 */
export class ConditionalStep<TContext extends WorkflowContext = WorkflowContext>
  implements WorkflowStep<TContext>
{
  readonly name: string;
  private condition: ConditionFn<TContext>;
  private trueStep: WorkflowStep<TContext>;
  private falseStep?: WorkflowStep<TContext>;

  /**
   * Creates a new conditional step.
   * @param name The name of the step
   * @param condition The condition function that determines which step to execute
   * @param trueStep The step to execute if the condition is true
   * @param falseStep Optional step to execute if the condition is false
   */
  constructor(
    name: string,
    condition: ConditionFn<TContext>,
    trueStep: WorkflowStep<TContext>,
    falseStep?: WorkflowStep<TContext>
  ) {
    this.name = name;
    this.condition = condition;
    this.trueStep = trueStep;
    this.falseStep = falseStep;
  }

  /**
   * Executes the appropriate step based on the condition.
   */
  async execute(context: TContext): Promise<void> {
    const result = await this.condition(context);

    if (result) {
      await this.trueStep.execute(context);
    } else if (this.falseStep) {
      await this.falseStep.execute(context);
    }
  }
}
