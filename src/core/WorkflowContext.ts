import { v4 as uuidv4 } from 'uuid';

/**
 * Represents a workflow error with detailed information.
 */
export interface WorkflowError {
  /** The name of the step where the error occurred */
  step: string;
  /** Error message */
  message: string;
  /** Optional additional error details */
  details?: any;
  /** Timestamp when the error occurred */
  timestamp: Date;
}

/**
 * Options for creating a workflow context.
 */
export interface WorkflowContextOptions<TInput, TResult> {
  /** Optional input ID (generated if not provided) */
  workflowId?: string;
  /** Unique name for the workflow */
  workflowName: string;
  /** Optional initial input data */
  input?: TInput;
  /** Optional initial result data */
  result?: TResult;
  /** Optional initial metadata */
  metadata?: Record<string, any>;
}

/**
 * Core context object that's passed through the workflow.
 * Contains all state and data for the workflow execution.
 */
export class WorkflowContext<TInput = any, TResult = any> {
  /** Unique identifier for this workflow execution */
  readonly workflowId: string;

  /** Identifier for the workflow definition */
  readonly workflowName: string;

  /** Input data for the workflow */
  input?: TInput;

  /** Output data from the workflow */
  result?: TResult;

  /** Errors that occurred during workflow execution */
  errors: WorkflowError[] = [];

  /** Additional contextual data shared between steps */
  metadata: Record<string, any> = {};

  /** Current step being executed (if any) */
  currentStepName?: string;

  /** Timestamp when the workflow started */
  readonly startTime: Date;

  /** Timestamp when the workflow completed (if it has) */
  endTime?: Date;

  /**
   * Creates a new workflow context.
   */
  constructor(options: WorkflowContextOptions<TInput, TResult>) {
    this.workflowId = options.workflowId ?? uuidv4();
    this.workflowName = options.workflowName;
    this.input = options.input;
    this.result = options.result;
    this.metadata = options.metadata ?? {};
    this.startTime = new Date();
  }

  /**
   * Adds an error to the context.
   */
  addError(step: string, error: any): void {
    this.errors.push({
      step,
      message: error instanceof Error ? error.message : String(error),
      details: error,
      timestamp: new Date(),
    });
  }

  /**
   * Sets the end time for the workflow.
   */
  complete(): void {
    this.endTime = new Date();
  }

  /**
   * Returns the duration of the workflow execution in milliseconds.
   */
  get durationMs(): number | undefined {
    if (!this.endTime) return undefined;
    return this.endTime.getTime() - this.startTime.getTime();
  }

  /**
   * Checks if the workflow executed successfully (no errors).
   */
  get successful(): boolean {
    return this.errors.length === 0;
  }
}
