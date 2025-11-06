"use client"

import React from "react"
import { Root as TabsRoot, List as TabsListPrimitive, Trigger as TabsTriggerPrimitive, Content as TabsContentPrimitive } from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsRoot

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsListPrimitive>,
  React.ComponentPropsWithoutRef<typeof TabsListPrimitive>
>(({ className, ...props }, ref) => (
  <TabsListPrimitive
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center rounded-md bg-muted h-10 p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsListPrimitive.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsTriggerPrimitive>,
  React.ComponentPropsWithoutRef<typeof TabsTriggerPrimitive>
>(({ className, ...props }, ref) => (
  <TabsTriggerPrimitive
    ref={ref}
    className={cn(
      "disabled:opacity-50 disabled:pointer-events-none data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring font-medium inline-flex items-center justify-center px-3 py-1.5 ring-offset-background rounded-sm text-sm transition-all whitespace-nowrap",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsTriggerPrimitive.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsContentPrimitive>,
  React.ComponentPropsWithoutRef<typeof TabsContentPrimitive>
>(({ className, ...props }, ref) => (
  <TabsContentPrimitive
    ref={ref}
    className={cn(
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring mt-2 ring-offset-background",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsContentPrimitive.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
