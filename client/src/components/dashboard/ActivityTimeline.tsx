import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { CalendarDays } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type ActivityRow = { period: string; label: string; orders: number; completed: number };

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function ActivityTimeline() {
  const [granularity, setGranularity] = useState<"day" | "month">("day");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return fmt(d);
  });
  const [to, setTo] = useState(() => fmt(new Date()));

  const { data = [], isLoading } = useQuery<ActivityRow[]>({
    queryKey: ["/api/dashboard/activity", granularity, from, to],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/dashboard/activity?granularity=${granularity}&from=${from}&to=${to}`
      );
      return res.json();
    },
    staleTime: 60000,
  });

  const totalOrders = data.reduce((s, r) => s + r.orders, 0);
  const totalCompleted = data.reduce((s, r) => s + r.completed, 0);

  // Switching granularity resets the range to a sensible default for that view
  const switchGranularity = (g: "day" | "month") => {
    setGranularity(g);
    const t = new Date();
    const f = new Date();
    if (g === "month") f.setMonth(f.getMonth() - 11);
    else f.setDate(f.getDate() - 29);
    setFrom(fmt(f));
    setTo(fmt(t));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center">
            <CalendarDays className="mr-2 h-5 w-5" />
            Activity Calendar
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-muted rounded-lg p-1">
              <Button
                variant={granularity === "day" ? "secondary" : "ghost"}
                size="sm"
                className="h-8"
                onClick={() => switchGranularity("day")}
                data-testid="button-activity-day"
              >
                Day
              </Button>
              <Button
                variant={granularity === "month" ? "secondary" : "ghost"}
                size="sm"
                className="h-8"
                onClick={() => switchGranularity("month")}
                data-testid="button-activity-month"
              >
                Month
              </Button>
            </div>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              data-testid="input-activity-from"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              data-testid="input-activity-to"
            />
          </div>
        </div>
        <div className="flex gap-4 text-sm mt-2">
          <span className="text-muted-foreground">
            Registered: <span className="font-semibold text-foreground">{totalOrders}</span>
          </span>
          <span className="text-muted-foreground">
            Completed: <span className="font-semibold text-foreground">{totalCompleted}</span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-72 flex items-center justify-center text-muted-foreground">Loading…</div>
        ) : data.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-muted-foreground">
            No activity in this range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" minTickGap={12} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="orders" name="Work Orders Registered" fill="#8884d8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" name="Jobs Completed" fill="#4db848" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
