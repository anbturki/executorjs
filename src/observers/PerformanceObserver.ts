import { WorkflowContext } from '../core/WorkflowContext';
import { WorkflowObserver } from '../core/WorkflowObserver';

/**
 * Observer that tracks performance metrics for workflow execution.
 */
export class PerformanceObserver<TContext extends WorkflowContext = WorkflowContext>
  implements WorkflowObserver<TContext>
{
  private stepStartTimes: Record<string, number> = {};

  /**
   * Tracks the start time of a step.
   */
  onStepStart(stepName: string, context: TContext): void {
    this.stepStartTimes[`${context.workflowId}:${stepName}`] = Date.now();
  }

  /**
   * Records the duration of a completed step.
   */
  onStepComplete(stepName: string, context: TContext): void {
    const startTime = this.stepStartTimes[`${context.workflowId}:${stepName}`];
    if (!startTime) return;

    const duration = Date.now() - startTime;
    this.recordStepDuration(stepName, duration, context);

    // Clean up start time
    delete this.stepStartTimes[`${context.workflowId}:${stepName}`];
  }

  /**
   * Records the duration of a failed step.
   */
  onStepError(stepName: string, error: any, context: TContext): void {
    // Still record duration even for errors
    this.onStepComplete(stepName, context);
  }

  /**
   * Computes summary statistics for the entire workflow.
   */
  onWorkflowComplete(context: TContext): void {
    // Get the performance metrics
    const metrics = this.getPerformanceMetrics(context);

    if (!metrics || !metrics.steps || Object.keys(metrics.steps).length === 0) {
      return;
    }

    // Calculate overall statistics
    const stepDurations = Object.values(metrics.steps) as number[];

    metrics.summary = {
      total: stepDurations.reduce((sum, duration) => sum + duration, 0),
      average: stepDurations.reduce((sum, duration) => sum + duration, 0) / stepDurations.length,
      max: Math.max(...stepDurations),
      min: Math.min(...stepDurations),
      count: stepDurations.length,
    };

    // Sort steps by duration (descending)
    metrics.stepsByDuration = Object.entries(metrics.steps)
      .sort(([, durationA], [, durationB]) => (durationB as number) - (durationA as number))
      .reduce(
        (result, [step, duration]) => {
          result[step] = duration;
          return result;
        },
        {} as Record<string, number>
      );
  }

  /**
   * Records the duration of a step in the context.
   */
  private recordStepDuration(stepName: string, duration: number, context: TContext): void {
    // Initialize performance metrics in context if not exist
    if (!context.metadata.performance) {
      context.metadata.performance = { steps: {} };
    }

    // Record step duration
    context.metadata.performance.steps[stepName] = duration;
  }

  /**
   * Gets the performance metrics from the context.
   */
  private getPerformanceMetrics(context: TContext): {
    steps: Record<string, number>;
    summary?: {
      total: number;
      average: number;
      max: number;
      min: number;
      count: number;
    };
    stepsByDuration?: Record<string, number>;
  } {
    return context.metadata.performance || { steps: {} };
  }
}
