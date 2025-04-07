import { WorkflowEngine, WorkflowEngineOptions } from '../core/WorkflowEngine';
import { WorkflowContext } from '../core/WorkflowContext';
import { WorkflowStep } from '../core/WorkflowStep';
import { WorkflowObserver } from '../core/WorkflowObserver';

/**
 * Factory for creating workflow engines with common configurations.
 */
export class WorkflowFactory {
  /**
   * Creates a new workflow engine with the provided configuration.
   */
  static createWorkflow<TInput = any, TResult = any>(
    options: WorkflowEngineOptions<TInput, TResult> & {
      steps?: WorkflowStep<WorkflowContext<TInput, TResult>>[];
      observers?: WorkflowObserver<WorkflowContext<TInput, TResult>>[];
    }
  ): WorkflowEngine<TInput, TResult> {
    const { steps, observers, ...engineOptions } = options;

    // Create the engine
    const engine = new WorkflowEngine<TInput, TResult>(engineOptions);

    // Add steps if provided
    if (steps && steps.length > 0) {
      engine.addSteps(steps);
    }

    // Add observers if provided
    if (observers && observers.length > 0) {
      engine.addObservers(observers);
    }

    return engine;
  }
}
