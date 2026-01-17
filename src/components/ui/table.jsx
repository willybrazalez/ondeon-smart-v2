import React from "react"

import { cn } from "@/lib/utils"

const Table = React.forwardRef(({ className, daliStyle, useCleanStyle = true, ...props }, ref) => ( // Added useCleanStyle
  <div className={cn("relative w-full overflow-auto", (useCleanStyle || daliStyle) ? "p-0.5" : "")}> {/* Adjusted padding */}
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", (useCleanStyle || daliStyle) ? "border-collapse" : "", className)}
      {...props} />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef(({ className, daliStyle, useCleanStyle = true, ...props }, ref) => ( // Added useCleanStyle
  <thead ref={ref} className={cn((useCleanStyle || daliStyle) ? "[&_tr]:border-b [&_tr]:border-primary/25" : "[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef(({ className, daliStyle, useCleanStyle = true, ...props }, ref) => ( // Added useCleanStyle
  <tbody
    ref={ref}
    className={cn((useCleanStyle || daliStyle) ? "[&_tr:last-child]:border-0" : "[&_tr:last-child]:border-0", className)}
    {...props} />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef(({ className, daliStyle, useCleanStyle = true, ...props }, ref) => ( // Added useCleanStyle
  <tfoot
    ref={ref}
    className={cn(
      "font-medium",
      (useCleanStyle || daliStyle) ? "border-t border-primary/25 bg-card/60 text-primary-foreground" : "border-t bg-muted/50 [&>tr]:last:border-b-0",
      className
    )}
    {...props} />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef(({ className, daliStyle, useCleanStyle = true, ...props }, ref) => ( // Added useCleanStyle
  <tr
    ref={ref}
    className={cn(
      "transition-colors data-[state=selected]:bg-muted",
      (useCleanStyle || daliStyle) ? "border-b border-primary/15 hover:bg-primary/5 data-[state=selected]:bg-primary/10" : "border-b hover:bg-muted/50",
      className
    )}
    {...props} />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef(({ className, daliStyle, useCleanStyle = true, ...props }, ref) => ( // Added useCleanStyle
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 font-sans", // ensure font-sans
      (useCleanStyle || daliStyle) ? "text-primary" : "text-slate-300",
      className
    )}
    {...props} />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef(({ className, daliStyle, useCleanStyle = true, ...props }, ref) => ( // Added useCleanStyle
  <td
    ref={ref}
    className={cn(
      "p-4 align-middle [&:has([role=checkbox])]:pr-0 font-sans", // ensure font-sans
      (useCleanStyle || daliStyle) ? "text-foreground/90" : "text-slate-200",
      className
    )}
    {...props} />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef(({ className, daliStyle, useCleanStyle = true, ...props }, ref) => ( // Added useCleanStyle
  <caption
    ref={ref}
    className={cn(
      "mt-4 text-sm text-muted-foreground font-sans", // ensure font-sans
      (useCleanStyle || daliStyle) ? "text-accent/80" : "text-slate-400",
      className
    )}
    {...props} />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}