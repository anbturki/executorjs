import { WorkflowContext } from '../WorkflowContext';

describe('WorkflowContext', () => {
  describe('initialization', () => {
    it('should initialize with required properties', () => {
      const context = new WorkflowContext({
        workflowName: 'test-workflow',
      });

      expect(context.workflowId).toBeDefined();
      expect(context.workflowName).toBe('test-workflow');
      expect(context.startTime).toBeInstanceOf(Date);
      expect(context.errors).toEqual([]);
      expect(context.metadata).toEqual({});
    });

    it('should accept optional properties', () => {
      const input = { data: 'test' };
      const metadata = { meta: 'data' };
      const workflowId = 'custom-id';

      const context = new WorkflowContext({
        workflowName: 'test-workflow',
        workflowId,
        input,
        metadata,
      });

      expect(context.workflowId).toBe(workflowId);
      expect(context.input).toEqual(input);
      expect(context.metadata).toEqual(metadata);
    });
  });

  describe('error handling', () => {
    let context: WorkflowContext;

    beforeEach(() => {
      context = new WorkflowContext({ workflowName: 'test-workflow' });
    });

    it('should add errors with correct format', () => {
      const error = new Error('Test error');
      context.addError('test-step', error);

      expect(context.errors).toHaveLength(1);
      expect(context.errors[0]).toMatchObject({
        step: 'test-step',
        message: 'Test error',
        details: error,
      });
      expect(context.errors[0].timestamp).toBeInstanceOf(Date);
    });

    it('should handle non-Error objects', () => {
      context.addError('test-step', 'string error');
      expect(context.errors[0].message).toBe('string error');
    });

    it('should track successful state', () => {
      expect(context.successful).toBe(true);
      context.addError('test-step', 'error');
      expect(context.successful).toBe(false);
    });
  });

  describe('workflow completion', () => {
    let context: WorkflowContext;

    beforeEach(() => {
      context = new WorkflowContext({ workflowName: 'test-workflow' });
    });

    it('should track completion time', () => {
      expect(context.endTime).toBeUndefined();
      expect(context.durationMs).toBeUndefined();

      context.complete();

      expect(context.endTime).toBeInstanceOf(Date);
      expect(typeof context.durationMs).toBe('number');
      expect(context.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should calculate duration correctly', async () => {
      const delay = 100;
      await new Promise(resolve => setTimeout(resolve, delay));
      context.complete();

      expect(context.durationMs).toBeGreaterThanOrEqual(delay);
    });
  });

  describe('metadata handling', () => {
    it('should handle metadata correctly', () => {
      const ctx = new WorkflowContext({
        workflowName: 'test',
        metadata: { key: 'value' },
      });
      expect(ctx.metadata.key).toBe('value');
    });
  });

  describe('type safety', () => {
    it('should handle typed input and result', () => {
      interface CustomInput {
        value: number;
      }
      interface CustomResult {
        processed: boolean;
      }

      const context = new WorkflowContext<CustomInput, CustomResult>({
        workflowName: 'test',
        input: { value: 42 },
      });

      expect(context.input?.value).toBe(42);
      context.result = { processed: true };
      expect(context.result.processed).toBe(true);
    });
  });

  describe('error details', () => {
    it('should preserve error stack trace', () => {
      const context = new WorkflowContext({ workflowName: 'test' });
      const error = new Error('Test error');
      context.addError('test-step', error);

      expect(context.errors[0].details).toBe(error);
      expect(context.errors[0].details.stack).toBeDefined();
    });

    it('should handle errors with custom properties', () => {
      const context = new WorkflowContext({ workflowName: 'test' });
      const error = new Error('Test error');
      (error as any).customProp = 'custom value';

      context.addError('test-step', error);
      expect((context.errors[0].details as any).customProp).toBe('custom value');
    });
  });

  describe('timing', () => {
    it('should have accurate duration measurements', async () => {
      const context = new WorkflowContext({ workflowName: 'test' });
      const delay = 50;

      await new Promise(resolve => setTimeout(resolve, delay));
      context.complete();

      expect(context.durationMs).toBeGreaterThanOrEqual(delay);
      expect(context.durationMs).toBeLessThan(delay + 100); // Allow some margin
    });
  });
});
