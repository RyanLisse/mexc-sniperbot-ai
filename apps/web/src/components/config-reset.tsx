"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useConfiguration } from "@/hooks/use-configuration";

export function ConfigReset() {
  const { resetConfiguration, isSubmitting } = useConfiguration();
  const [isOpen, setIsOpen] = useState(false);

  const handleReset = async () => {
    await resetConfiguration();
    setIsOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset Configuration</CardTitle>
        <CardDescription>Restore default trading parameters</CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Resetting will restore all settings to safe defaults. This action
            cannot be undone.
          </AlertDescription>
        </Alert>

        <Dialog onOpenChange={setIsOpen} open={isOpen}>
          <DialogTrigger asChild>
            <Button className="mt-4 w-full" variant="destructive">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to Defaults
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Configuration?</DialogTitle>
              <DialogDescription>
                Are you sure you want to reset all configuration settings to
                defaults? This will:
                <ul className="mt-2 list-inside list-disc space-y-1">
                  <li>Set enabled pairs to BTC/USDT and ETH/USDT</li>
                  <li>Set max purchase amount to $100 USDT</li>
                  <li>Set price tolerance to 1%</li>
                  <li>Set daily spending limit to $1000 USDT</li>
                  <li>Set max trades per hour to 10</li>
                  <li>Deactivate automated trading</li>
                </ul>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setIsOpen(false)} variant="outline">
                Cancel
              </Button>
              <Button
                disabled={isSubmitting}
                onClick={handleReset}
                variant="destructive"
              >
                {isSubmitting ? "Resetting..." : "Reset Configuration"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
