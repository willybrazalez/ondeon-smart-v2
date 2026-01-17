import React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react'; // Reverted to standard ChevronDown

import { cn } from '@/lib/utils';

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef(({ className, children, daliStyle, useCleanStyle = true, ...props }, ref) => ( // Added useCleanStyle
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-10 w-full items-center justify-between border px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      useCleanStyle ? 'clean-input' : (daliStyle ? 'dali-input' : 'rounded-md border-input bg-background'),
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-60 text-muted-foreground" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef(({ className, children, position = 'popper', daliStyle, useCleanStyle = true, ...props }, ref) => ( // Added useCleanStyle
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        'relative z-50 min-w-[8rem] overflow-hidden border shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        useCleanStyle ? 'bg-popover/90 backdrop-blur-md border-primary/40 text-popover-foreground rounded-lg clean-card shadow-clean-main p-1' : 
                       (daliStyle ? 'bg-popover/80 backdrop-blur-md border-primary/50 text-popover-foreground rounded-dali-soft dali-card shadow-dali-main p-1' : 'rounded-md bg-popover text-popover-foreground'),
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn('p-1', (useCleanStyle || daliStyle) ? '' : 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]')}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef(({ className, daliStyle, useCleanStyle = true, ...props }, ref) => ( // Added useCleanStyle
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      'py-1.5 pr-2 text-sm font-semibold font-sans', // Ensure font-sans
      useCleanStyle ? 'pl-3 text-primary/90' : (daliStyle ? 'pl-3 font-serif-dali text-secondary/90' : 'pl-8 text-muted-foreground'),
      className
    )}
    {...props} />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef(({ className, children, daliStyle, useCleanStyle = true, ...props }, ref) => ( // Added useCleanStyle
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 font-sans', // Ensure font-sans
      useCleanStyle 
        ? 'rounded-md pl-8 pr-2 focus:bg-accent/20 focus:text-accent-foreground data-[state=checked]:bg-accent/30 data-[state=checked]:text-accent-foreground' 
        : (daliStyle 
            ? 'rounded-dali-input pl-8 pr-2 focus:bg-primary/30 focus:text-primary-foreground data-[state=checked]:bg-primary/60 data-[state=checked]:text-primary-foreground font-serif-dali' 
            : 'rounded-sm pl-8 pr-2 focus:bg-accent focus:text-accent-foreground'),
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-primary" /> 
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef(({ className, daliStyle, useCleanStyle = true, ...props }, ref) => ( // Added useCleanStyle
  <SelectPrimitive.Separator
    ref={ref}
    className={cn(
      '-mx-1 my-1 h-px', 
      useCleanStyle ? 'bg-gradient-to-r from-transparent via-primary/30 to-transparent' : (daliStyle ? 'bg-gradient-to-r from-transparent via-primary/50 to-transparent' : 'bg-muted'),
      className
    )}
    {...props} />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
};