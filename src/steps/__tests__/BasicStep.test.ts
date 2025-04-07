import { BasicStep } from '../BasicStep';
import { WorkflowContext } from '../../core/WorkflowContext';

describe('BasicStep', () => {
  describe('initialization', () => {
    it('should create step with name and executor', () => {
      const step = new BasicStep('test-step', async () => {});
      expect(step.name).toBe('test-step');
      expect(step.execute).toBeDefined();
    });
  });

  describe('execution', () => {
    it('should execute the provided function', async () => {
      const mockFn = jest.fn();
      const step = new BasicStep('test-step', mockFn);
      const context = new WorkflowContext({ workflowName: 'test' });

      await step.execute(context);
      expect(mockFn).toHaveBeenCalledWith(context);
    });

    it('should handle synchronous executors', async () => {
      let executed = false;
      const step = new BasicStep('test-step', () => {
        executed = true;
      });

      await step.execute(new WorkflowContext({ workflowName: 'test' }));
      expect(executed).toBe(true);
    });

    it('should handle asynchronous executors', async () => {
      let executed = false;
      const step = new BasicStep('test-step', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        executed = true;
      });

      await step.execute(new WorkflowContext({ workflowName: 'test' }));
      expect(executed).toBe(true);
    });
  });

  describe('type safety', () => {
    it('should work with typed context', async () => {
      interface CustomInput {
        value: number;
      }
      interface CustomResult {
        doubled: number;
      }

      const step = new BasicStep<WorkflowContext<CustomInput, CustomResult>>(
        'typed-step',
        async context => {
          if (context.input) {
            context.result = { doubled: context.input.value * 2 };
          }
        }
      );

      const context = new WorkflowContext<CustomInput, CustomResult>({
        workflowName: 'test',
        input: { value: 21 },
      });

      await step.execute(context);
      expect(context.result?.doubled).toBe(42);
    });

    it('should handle errors in executor', async () => {
      const error = new Error('Test error');
      const step = new BasicStep('error-step', () => {
        throw error;
      });

      const context = new WorkflowContext({ workflowName: 'test' });
      await expect(step.execute(context)).rejects.toThrow(error);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined context values', async () => {
      const step = new BasicStep<WorkflowContext<{ optional?: string }>>(
        'optional-step',
        async context => {
          // Should not throw when accessing undefined values
          const value = context.input?.optional;
          expect(value).toBeUndefined();
        }
      );

      const context = new WorkflowContext({ workflowName: 'test' });
      await expect(step.execute(context)).resolves.not.toThrow();
    });

    it('should preserve executor context', async () => {
      class TestClass {
        private value = 'test';

        getStep() {
          return new BasicStep('context-step', () => {
            expect(this.value).toBe('test');
          });
        }
      }

      const testInstance = new TestClass();
      const step = testInstance.getStep();
      const context = new WorkflowContext({ workflowName: 'test' });

      await expect(step.execute(context)).resolves.not.toThrow();
    });
  });
});
