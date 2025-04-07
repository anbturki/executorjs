import { WorkflowContext } from '../core/WorkflowContext';

export interface Step {
  execute(context: WorkflowContext): Promise<void>;
}
