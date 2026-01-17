import React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(({ className, type, daliStyle, useCleanStyle = true, ...props }, ref) => { // Added useCleanStyle, deprecated daliStyle
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full border px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        useCleanStyle ? 'clean-input' : (daliStyle ? 'dali-input' : 'rounded-md border-input bg-background placeholder:text-muted-foreground'),
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };