"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/utils/trpc";

export function AccountBalanceTable() {
  const queryClient = useQueryClient();
  const {
    data: balances,
    isLoading,
    dataUpdatedAt,
  } = useQuery(
    trpc.portfolio.getBalance.queryOptions(undefined, {
      refetchInterval: 10_000, // Refresh every 10 seconds
      refetchOnWindowFocus: true,
    })
  );

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: [["portfolio", "getBalance"]],
    });
    queryClient.refetchQueries({
      queryKey: [["portfolio", "getBalance"]],
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account Balance</CardTitle>
          <CardDescription>Current asset balances</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton className="h-12 w-full" key={i} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const balanceList = Array.isArray(balances) ? balances : [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Account Balance</CardTitle>
            <CardDescription>
              {dataUpdatedAt
                ? `Last updated: ${format(new Date(dataUpdatedAt), "HH:mm:ss")}`
                : "Current asset balances"}
            </CardDescription>
          </div>
          <Button onClick={handleRefresh} size="icon" variant="outline">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {balanceList.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No balances found
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">USD Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balanceList.map((balance) => (
                <TableRow key={balance.asset}>
                  <TableCell className="font-medium">{balance.asset}</TableCell>
                  <TableCell className="text-right font-mono">
                    {Number.parseFloat(balance.total).toLocaleString("en-US", {
                      maximumFractionDigits: 8,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    $
                    {balance.usdValue.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
