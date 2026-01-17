import React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef(({ className, daliStyle, useCleanStyle = true, ...props }, ref) => { // Added useCleanStyle, deprecated daliStyle
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full border px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        useCleanStyle ? 'clean-input min-h-[100px]' : (daliStyle ? 'dali-input min-h-[100px]' : 'rounded-md border-input bg-background placeholder:text-muted-foreground'),
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };