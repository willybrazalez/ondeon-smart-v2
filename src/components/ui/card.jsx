import React from 'react';
import { cn } from "@/lib/utils";

const Card = React.forwardRef(({ className, useCleanStyle = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      useCleanStyle ? "clean-card" : "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props} />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef(({ className, useCleanStyle = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      useCleanStyle ? "flex flex-col space-y-1.5 p-4 sm:p-5" : "flex flex-col space-y-1.5 p-6",
      className
    )}
    {...props} />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef(({ className, useCleanStyle = false, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      useCleanStyle ? "text-lg font-semibold leading-none tracking-tight text-card-foreground" : "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}>
    {children}
  </h3>
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef(({ className, useCleanStyle = false, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      useCleanStyle ? "text-sm text-muted-foreground" : "text-sm text-muted-foreground",
      className
    )}
    {...props} />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef(({ className, useCleanStyle = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      useCleanStyle ? "p-4 sm:p-5 pt-0" : "p-6 pt-0",
      className
    )}
    {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef(({ className, useCleanStyle = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      useCleanStyle ? "flex items-center p-4 sm:p-5 pt-0" : "flex items-center p-6 pt-0",
      className
    )}
    {...props} />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };