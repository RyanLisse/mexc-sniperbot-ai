"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  type CreateConfigurationRequest,
  useCreateConfiguration,
} from "@/hooks/use-configurations";

const SYMBOL_PATTERN = /^[A-Z0-9]+USDT$/;

const configurationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  quoteAmount: z.coerce.number().positive("Must be positive").max(100_000),
  maxTradesPerHour: z.coerce.number().int().positive().max(100),
  maxDailySpend: z.coerce.number().positive().max(1_000_000),
  recvWindow: z.coerce.number().int().positive().max(1000),
  safetyEnabled: z.boolean(),
});

type ConfigurationFormData = z.infer<typeof configurationSchema>;

type ConfigurationFormProps = {
  onSuccess?: () => void;
  onCancel?: () => void;
};

/**
 * Configuration form component using React Hook Form
 */
export function ConfigurationForm({
  onSuccess,
  onCancel,
}: ConfigurationFormProps) {
  const createConfig = useCreateConfiguration();
  const [symbolInput, setSymbolInput] = useState("");
  const [symbols, setSymbols] = useState<string[]>([]);

  const form = useForm<ConfigurationFormData>({
    resolver: zodResolver(configurationSchema),
    defaultValues: {
      name: "",
      quoteAmount: 100,
      maxTradesPerHour: 10,
      maxDailySpend: 1000,
      recvWindow: 1000,
      safetyEnabled: true,
    },
  });

  const onSubmit = (data: ConfigurationFormData) => {
    if (symbols.length === 0) {
      return;
    }

    const configData: CreateConfigurationRequest = {
      ...data,
      symbols,
    };

    createConfig.mutate(configData, {
      onSuccess: () => {
        form.reset();
        setSymbols([]);
        onSuccess?.();
      },
    });
  };

  const addSymbol = () => {
    const symbol = symbolInput.trim().toUpperCase();
    if (!symbol) {
      return;
    }

    if (!SYMBOL_PATTERN.test(symbol)) {
      return;
    }

    if (!symbols.includes(symbol)) {
      setSymbols([...symbols, symbol]);
      setSymbolInput("");
    }
  };

  const removeSymbol = (symbol: string) => {
    setSymbols(symbols.filter((s) => s !== symbol));
  };

  const handleSymbolKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSymbol();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Configuration Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Aggressive Sniper" {...field} />
                </FormControl>
                <FormDescription>
                  A descriptive name for this configuration
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Symbols */}
          <div className="space-y-2">
            <FormLabel>Trading Symbols</FormLabel>
            <div className="flex gap-2">
              <Input
                onChange={(e) => setSymbolInput(e.target.value)}
                onKeyDown={handleSymbolKeyPress}
                placeholder="e.g., BTCUSDT"
                value={symbolInput}
              />
              <Button onClick={addSymbol} size="icon" type="button">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {symbols.map((symbol) => (
                <Badge key={symbol} variant="secondary">
                  {symbol}
                  <button
                    className="ml-2 hover:text-red-600"
                    onClick={() => removeSymbol(symbol)}
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            {symbols.length === 0 && (
              <p className="text-gray-500 text-sm">
                Add at least one USDT trading pair
              </p>
            )}
          </div>

          {/* Quote Amount */}
          <FormField
            control={form.control}
            name="quoteAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quote Amount (USDT)</FormLabel>
                <FormControl>
                  <Input placeholder="100" type="number" {...field} />
                </FormControl>
                <FormDescription>
                  Amount of USDT to spend per trade
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Max Trades Per Hour */}
          <FormField
            control={form.control}
            name="maxTradesPerHour"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Trades Per Hour</FormLabel>
                <FormControl>
                  <Input placeholder="10" type="number" {...field} />
                </FormControl>
                <FormDescription>
                  Rate limit for trade execution
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Max Daily Spend */}
          <FormField
            control={form.control}
            name="maxDailySpend"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Daily Spend (USDT)</FormLabel>
                <FormControl>
                  <Input placeholder="1000" type="number" {...field} />
                </FormControl>
                <FormDescription>Total spending cap per day</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Recv Window */}
          <FormField
            control={form.control}
            name="recvWindow"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Recv Window (ms)</FormLabel>
                <FormControl>
                  <Input placeholder="1000" type="number" {...field} />
                </FormControl>
                <FormDescription>
                  MEXC request validity window (max 1000ms)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Safety Enabled */}
          <FormField
            control={form.control}
            name="safetyEnabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Safety Constraints
                  </FormLabel>
                  <FormDescription>
                    Enforce spending and rate limits
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </CardContent>

        <CardFooter className="flex justify-between">
          {onCancel && (
            <Button onClick={onCancel} type="button" variant="outline">
              Cancel
            </Button>
          )}
          <Button
            className="ml-auto"
            disabled={createConfig.isPending || symbols.length === 0}
            type="submit"
          >
            {createConfig.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Configuration"
            )}
          </Button>
        </CardFooter>
      </form>
    </Form>
  );
}
