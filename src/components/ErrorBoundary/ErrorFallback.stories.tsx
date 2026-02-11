import type { Story } from '@ladle/react';
import { ErrorFallback } from './ErrorFallback';

const sampleError = new Error('Something went wrong while fetching data from the API');
sampleError.stack = `Error: Something went wrong while fetching data from the API
    at fetchData (app.tsx:42:11)
    at async DataComponent (app.tsx:120:5)`;

export const Default: Story = () => <ErrorFallback error={sampleError} reset={() => {}} />;

export const CustomTitle: Story = () => (
  <ErrorFallback
    error={sampleError}
    reset={() => {}}
    title="Unable to Load Dashboard"
    description="The dashboard data could not be loaded. Please check your connection and try again."
  />
);

export const NetworkError: Story = () => (
  <ErrorFallback
    error={new Error('Network request failed')}
    reset={() => {}}
    title="Connection Error"
    description="Unable to reach the server. Please check your internet connection."
  />
);

export const PermissionError: Story = () => (
  <ErrorFallback
    error={new Error('Access denied')}
    reset={() => {}}
    title="Permission Denied"
    description="You do not have permission to access this resource. Please contact your administrator."
  />
);

export const LongErrorMessage: Story = () => (
  <ErrorFallback
    error={
      new Error(
        'A very long error message that contains lots of technical details about what went wrong in the system. This error occurred because multiple cascading failures happened in succession, starting with a database connection timeout, followed by a cache invalidation failure, and finally resulting in a complete service unavailability.'
      )
    }
    reset={() => {}}
    title="System Error"
    description="A critical system error has occurred. Our team has been notified and is working to resolve the issue."
  />
);

const errorWithLongStack = new Error('Component rendering failed');
errorWithLongStack.stack = `Error: Component rendering failed
    at renderComponent (React.tsx:1234:56)
    at mountComponent (React.tsx:2345:67)
    at performUnitOfWork (React.tsx:3456:78)
    at workLoopSync (React.tsx:4567:89)
    at renderRootSync (React.tsx:5678:90)
    at performSyncWorkOnRoot (React.tsx:6789:12)
    at flushSyncCallbacks (React.tsx:7890:23)
    at Object.flushSync (React.tsx:8901:34)
    at App.tsx:42:11
    at invokePassiveEffectCreate (React.tsx:9012:45)`;

export const LongStackTrace: Story = () => (
  <ErrorFallback error={errorWithLongStack} reset={() => {}} />
);
