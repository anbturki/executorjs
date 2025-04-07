# StepJS

A lightweight, flexible workflow engine for Node.js applications focused on simplicity and extensibility.

## Features

- **Modular Design**: Build workflows by composing independent, reusable steps
- **Type Safety**: Written in TypeScript with full type definitions
- **Observable Execution**: Monitor workflow execution with built-in observers
- **Extensible Core**: Easily extend with custom steps and observers

## Installation

```bash
npm install stepjs
```

## Quick Start

```typescript
import { 
  WorkflowEngine, 
  BasicStep,
  ConsoleObserver,
  WorkflowContext
} from 'stepjs';

// Define input and result types
interface MyInput {
  value: number;
}

interface MyResult {
  calculatedValue: number;
}

// Create a workflow engine
const workflow = new WorkflowEngine<MyInput, MyResult>({
  workflowName: 'simple-calculation'
});

// Add steps
workflow.addStep(
  new BasicStep('multiply-by-two', async (context) => {
    const inputValue = context.input?.value || 0;
    context.metadata.intermediate = inputValue * 2;
  })
);

workflow.addStep(
  new BasicStep('add-ten', async (context) => {
    const intermediate = context.metadata.intermediate || 0;
    context.result = {
      calculatedValue: intermediate + 10
    };
  })
);

// Add observers
workflow.addObserver(new ConsoleObserver());
workflow.addObserver(new PerformanceObserver());

// Execute the workflow
async function run() {
  try {
    const context = await workflow.execute({ value: 5 });
    console.log(`Result: ${context.result?.calculatedValue}`);
    console.log(`Workflow ID: ${context.workflowId}`);
    console.log(`Execution time: ${context.durationMs}ms`);
  } catch (error) {
    console.error('Workflow failed:', error);
  }
}

run();
```

## Using WorkflowFactory

For more streamlined workflow creation, use the `WorkflowFactory`:

```typescript
import { 
  WorkflowFactory,
  BasicStep, 
  ConditionalStep,
  ConsoleObserver, 
  PerformanceObserver
} from 'stepjs';

// Define input and result types
interface OrderInput {
  orderId: string;
  amount: number;
  userId: string;
}

interface OrderResult {
  status: 'approved' | 'rejected';
  transactionId?: string;
  message: string;
}

// Define steps
const validateOrder = new BasicStep<WorkflowContext<OrderInput, OrderResult>>(
  'validate-order',
  async (context) => {
    if (!context.input) throw new Error('No input data');
    
    const { orderId, amount, userId } = context.input;
    // Simple validation
    if (!orderId || amount <= 0 || !userId) {
      throw new Error('Invalid order data');
    }
    
    context.metadata.validationPassed = true;
  }
);

const processPayment = new ConditionalStep<WorkflowContext<OrderInput, OrderResult>>(
  'process-payment',
  // Only process if validation passed
  (context) => context.metadata.validationPassed === true,
  // Process payment (true branch)
  new BasicStep('payment-processing', async (context) => {
    if (!context.input) return;
    
    // Mock payment processing
    const transactionId = `tx-${Date.now()}`;
    context.metadata.transactionId = transactionId;
    context.metadata.paymentSuccessful = true;
    
    // Build result
    context.result = {
      status: 'approved',
      transactionId,
      message: 'Payment processed successfully'
    };
  }),
  // Skip payment (false branch)
  new BasicStep('payment-skipped', async (context) => {
    context.result = {
      status: 'rejected',
      message: 'Order validation failed'
    };
  })
);

// Create a workflow using the factory
const orderWorkflow = WorkflowFactory.createWorkflow<OrderInput, OrderResult>({
  workflowName: 'order-processing',
  steps: [validateOrder, processPayment],
  observers: [new ConsoleObserver(), new PerformanceObserver()],
  // Optional configuration
  continueOnError: false
});

// Execute the workflow
async function processOrder(orderData: OrderInput) {
  const context = await orderWorkflow.execute(orderData);
  console.log(`Workflow ID: ${context.workflowId}`);
  return context.result;
}

// Usage
processOrder({
  orderId: 'ORD-12345',
  amount: 99.99,
  userId: 'user-789'
})
  .then(result => console.log('Order processed:', result))
  .catch(error => console.error('Order processing failed:', error));
```

The factory approach provides a cleaner, more declarative way to create workflows, especially when they involve multiple steps and observers.

## Core Concepts

### Workflow Engine

The `WorkflowEngine` orchestrates the execution of steps and notifies observers of events.

```typescript
// Create a workflow engine
const workflow = new WorkflowEngine<InputType, ResultType>({
  workflowName: 'my-workflow'
});
```

### Workflow Context

The `WorkflowContext` passes data between steps and tracks workflow state:

- `workflowId`: Unique identifier for the workflow execution (auto-generated UUID)
- `workflowName`: Name of the workflow
- `input`: Input data (provided when executing the workflow)
- `result`: Output data (built during workflow execution)
- `metadata`: Shared state between steps
- `errors`: Collection of errors that occurred during execution
- `startTime` and `endTime`: Execution timestamps
- `durationMs`: Execution duration in milliseconds

```typescript
// Access workflow context in steps
const myStep = new BasicStep('example-step', async (context) => {
  console.log(`Workflow ID: ${context.workflowId}`);
  console.log(`Workflow Name: ${context.workflowName}`);
  
  // Use input data
  const inputValue = context.input?.someProperty;
  
  // Store intermediate data
  context.metadata.processedValue = transform(inputValue);
  
  // Set result
  context.result = {
    status: 'success',
    data: context.metadata.processedValue
  };
});
```

### Steps

Steps are the building blocks of a workflow, each performing a discrete task:

#### BasicStep

The simplest step type that executes a function:

```typescript
const validateInput = new BasicStep(
  'validate-input',
  async (context) => {
    if (!context.input?.userId) {
      throw new Error('User ID is required');
    }
    // Input is valid
    context.metadata.isValid = true;
  }
);
```

#### ConditionalStep

Executes different steps based on a condition:

```typescript
const routeByRole = new ConditionalStep(
  'route-by-role',
  // Condition function
  (context) => context.metadata.userRole === 'admin',
  // True branch
  new BasicStep('admin-action', async (context) => {
    context.metadata.permissions = 'full';
  }),
  // False branch
  new BasicStep('user-action', async (context) => {
    context.metadata.permissions = 'limited';
  })
);
```

### Observers

Observers monitor workflow execution and react to events:

#### ConsoleObserver

Logs workflow execution to the console:

```typescript
workflow.addObserver(new ConsoleObserver({
  // Optional configuration
  logLevel: 'info',
  logStepStart: true,
  logStepComplete: true,
  logStepError: true,
  logWorkflowStart: true,
  logWorkflowComplete: true
}));
```

#### PerformanceObserver

Tracks performance metrics for steps and the overall workflow:

```typescript
workflow.addObserver(new PerformanceObserver());

// After execution, performance metrics are available in the context
const metrics = context.metadata.performance;
console.log('Total execution time:', metrics.summary.total, 'ms');
console.log('Slowest step:', Object.keys(metrics.stepsByDuration)[0]);
```

## Error Handling

StepJS provides robust error handling:

```typescript
// Continue execution even if steps fail
const workflow = new WorkflowEngine({
  workflowName: 'resilient-workflow',
  continueOnError: true
});

// After execution
if (context.successful) {
  console.log('Workflow completed successfully');
} else {
  console.log('Workflow completed with errors:', context.errors);
  context.errors.forEach(error => {
    console.log(`Error in step ${error.step}: ${error.message}`);
    console.log(`Occurred at: ${error.timestamp}`);
  });
}
```

## Extending StepJS

StepJS is designed for extension. Create custom steps by implementing the `WorkflowStep` interface:

```typescript
import { WorkflowStep, WorkflowContext } from 'stepjs';

class DatabaseStep implements WorkflowStep {
  readonly name: string;
  
  constructor(name: string, private query: string) {
    this.name = name;
  }
  
  async execute(context: WorkflowContext): Promise<void> {
    // Database operation implementation
    const result = await db.executeQuery(this.query);
    context.metadata.queryResult = result;
  }
}
```

Create custom observers by implementing the `WorkflowObserver` interface:

```typescript
import { WorkflowObserver, WorkflowContext } from 'stepjs';

class MetricsObserver implements WorkflowObserver {
  onWorkflowComplete(context: WorkflowContext): void {
    metrics.recordExecutionTime(
      context.workflowName, 
      context.durationMs || 0,
      context.workflowId
    );
    
    metrics.recordOutcome(
      context.workflowName, 
      context.successful ? 'success' : 'failure',
      context.workflowId
    );
  }
}
```

## License

MIT