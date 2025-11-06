"use client"

import * as React from "react"
import { Root, List, Trigger, Content } from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof List>,
  React.ComponentPropsWithoutRef<typeof List>
>(({ className, ...props }, ref) => (
  <List
    ref={ref}
    className={cn(
      "bg-muted inline-flex items-center justify-center rounded-md p-1 text-muted-foreground h-10",
      className
    )}
    {...props}
  />
))
TabsList.displayName = List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof Trigger>,
  React.ComponentPropsWithoutRef<typeof Trigger>
>(({ className, ...props }, ref) => (
  <Trigger
    ref={ref}
    className={cn(
      "data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring font-medium inline-flex items-center justify-center px-3 py-1.5 ring-offset-background rounded-sm text-sm transition-all whitespace-nowrap",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof Content>,
  React.ComponentPropsWithoutRef<typeof Content>
>(({ className, ...props }, ref) => (
  <Content
    ref={ref}
    className={cn(
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring mt-2 ring-offset-background",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
