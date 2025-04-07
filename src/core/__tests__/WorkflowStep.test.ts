import { WorkflowStep } from '../WorkflowStep';
import { WorkflowContext } from '../WorkflowContext';

describe('WorkflowStep', () => {
  describe('interface implementation', () => {
    it('should require name property', () => {
      class TestStep implements WorkflowStep<WorkflowContext> {
        public readonly name = 'test-step';
        
        async execute(context: WorkflowContext): Promise<void> {
          // Implementation for testing
        }
      }

      const step = new TestStep();
      expect(step.name).toBe('test-step');
    });

    it('should require execute method', () => {
      class TestStep implements WorkflowStep<WorkflowContext> {
        public readonly name = 'test-step';
        
        async execute(context: WorkflowContext): Promise<void> {
          // Implementation for testing
        }
      }

      const step = new TestStep();
      expect(step.execute).toBeDefined();
      expect(typeof step.execute).toBe('function');
    });

    it('should work with typed context', () => {
      interface CustomInput {
        value: number;
      }
      interface CustomResult {
        doubled: number;
      }

      class TypedStep implements WorkflowStep<WorkflowContext<CustomInput, CustomResult>> {
        public readonly name = 'typed-step';
        
        async execute(context: WorkflowContext<CustomInput, CustomResult>): Promise<void> {
          if (context.input) {
            context.result = { doubled: context.input.value * 2 };
          }
        }
      }

      const step = new TypedStep();
      expect(step.name).toBe('typed-step');
      expect(step.execute).toBeDefined();
    });
  });
}); 