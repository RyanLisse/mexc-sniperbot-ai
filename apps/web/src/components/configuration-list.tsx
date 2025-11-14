"use client";

import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Loader2, Trash2, XCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type Configuration,
  useConfigurations,
  useDeleteConfiguration,
} from "@/hooks/use-configurations";

type ConfigurationListProps = {
  onSelect?: (config: Configuration) => void;
  className?: string;
};

/**
 * Configuration list component with shadcn Table
 * Displays all configurations with delete functionality
 */
export function ConfigurationList({
  onSelect,
  className,
}: ConfigurationListProps) {
  const { data, isLoading, error } = useConfigurations(20, 0);
  const deleteConfig = useDeleteConfiguration();

  const configurations = data?.configurations || [];

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <p className="text-red-600">Failed to load configurations</p>
          <p className="text-gray-500 text-sm">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (configurations.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <p className="text-gray-600">No configurations yet</p>
          <p className="text-gray-500 text-sm">
            Create your first configuration to get started
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Configurations</CardTitle>
        <CardDescription>
          {configurations.length} configuration
          {configurations.length !== 1 ? "s" : ""} available
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Symbols</TableHead>
              <TableHead>Quote Amount</TableHead>
              <TableHead>Max Trades/Hr</TableHead>
              <TableHead>Daily Limit</TableHead>
              <TableHead>Safety</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {configurations.map((config) => (
              <TableRow
                className={onSelect ? "cursor-pointer hover:bg-gray-50" : ""}
                key={config.id}
                onClick={() => onSelect?.(config)}
              >
                <TableCell className="font-medium">{config.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {config.symbols.slice(0, 3).map((symbol) => (
                      <Badge className="text-xs" key={symbol} variant="outline">
                        {symbol}
                      </Badge>
                    ))}
                    {config.symbols.length > 3 && (
                      <Badge className="text-xs" variant="outline">
                        +{config.symbols.length - 3} more
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>${config.quoteAmount}</TableCell>
                <TableCell>{config.maxTradesPerHour}</TableCell>
                <TableCell>${config.maxDailySpend}</TableCell>
                <TableCell>
                  {config.safetyEnabled ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </TableCell>
                <TableCell className="text-gray-500 text-sm">
                  {formatDistanceToNow(new Date(config.createdAt), {
                    addSuffix: true,
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        onClick={(e) => e.stopPropagation()}
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Delete Configuration?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{config.name}"? This
                          action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => deleteConfig.mutate(config.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
