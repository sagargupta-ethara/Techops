import { lazy, Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, CheckCircle2, CircleGauge, Clock3, PackageCheck, Send, Users } from "lucide-react";
import api, { apiErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageContainer, PageHeader } from "@/components/Page";
import KpiStat from "@/components/KpiStat";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DailyProgressFilters from "@/components/daily-progress/DailyProgressFilters";
import DailyProgressUpload from "@/components/daily-progress/DailyProgressUpload";
import { MetricTable, RecordsTable, TaskerTable } from "@/components/daily-progress/DailyProgressTables";

const DailyProgressCharts = lazy(() => import("@/components/daily-progress/DailyProgressCharts"));
const EMPTY_FILTERS = { preset: "all" };
const number = (value) => Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 4 });

function queryString(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (key !== "preset" && value) params.set(key, value); });
  return params.toString();
}

export default function DailyProgress() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [period, setPeriod] = useState("daily");
  const query = queryString(filters);
  const { data, isLoading, isFetching, error } = useQuery({ queryKey: ["daily-progress", query], queryFn: () => api.get(`/daily-progress${query ? `?${query}` : ""}`).then((response) => response.data) });
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const reset = () => { setFilters(EMPTY_FILTERS); setPeriod("daily"); };
  const kpis = data?.kpis;

  return <PageContainer>
    <PageHeader eyebrow="Workflow throughput" title="Daily Progress" subtitle="Follow assigned work through creation and final delivery, by day, week, task type and tasker."
      right={<div className="flex items-center gap-2">{user?.role === "admin" && <DailyProgressUpload onImported={() => client.invalidateQueries({ queryKey: ["daily-progress"] })} />}<span className="hidden rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground md:block"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${isFetching ? "bg-amber-500" : "bg-emerald-500"}`} />{isFetching ? "Refreshing" : "Delivery linked"}</span></div>} />
    <DailyProgressFilters filters={filters} meta={data?.meta} onChange={setFilter} onReplace={setFilters} onClear={reset} />
    {error ? <div className="empty-state border-rose-500/30 text-rose-600">Unable to load Daily Progress: {apiErr(error.response?.data?.detail || error.message)}</div> :
      isLoading || !kpis ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="h-[132px] rounded-xl" />)}</div> : <>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-7" data-testid="daily-progress-kpis">
          <KpiStat label="Assigned" value={number(kpis.assigned)} sub="Tasks allocated" icon={Boxes} accent />
          <KpiStat label="Created" value={number(kpis.created)} sub={`${number(kpis.completion_pct)}% creation completion`} icon={CheckCircle2} />
          <KpiStat label="Delivered" value={number(kpis.delivered)} sub="Unique tasks / fractional by tasker" icon={Send} />
          <KpiStat label="Completion" value={`${number(kpis.completion_pct)}%`} sub="Created ÷ assigned" icon={CircleGauge} />
          <KpiStat label="Pending creation" value={number(kpis.pending_creation)} sub="Assigned − created" icon={Clock3} />
          <KpiStat label="Pending delivery" value={number(kpis.pending_delivery)} sub="Created − delivered" icon={PackageCheck} />
          <KpiStat label="Delivery rate" value={`${number(kpis.delivery_rate)}%`} sub="Delivered ÷ created" icon={Users} />
        </div>
        <div className="mb-6 grid gap-3 lg:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm"><strong className="text-foreground">Created to delivered:</strong> <span className="tabular">{number(kpis.delivered)} / {number(kpis.created)}</span> created tasks delivered. <span className="text-muted-foreground">{number(kpis.pending_delivery)} remain pending delivery.</span></div>
          <div className="rounded-xl border border-border/80 bg-card px-4 py-3 text-xs text-muted-foreground">Historical 14–17 Sep: supplied Ethara workbook. From 18 Sep: admin CSV uploads. Delivered: live Delivery sheet.</div>
        </div>
        <Tabs defaultValue="analytics" className="space-y-4">
          <TabsList className="thin-scroll h-11 max-w-full justify-start overflow-x-auto lg:h-9"><TabsTrigger className="h-full" value="analytics">Analytics</TabsTrigger><TabsTrigger className="h-full" value="breakdowns">Breakdowns</TabsTrigger><TabsTrigger className="h-full" value="taskers">Taskers</TabsTrigger><TabsTrigger className="h-full" value="records">Records</TabsTrigger></TabsList>
          <TabsContent value="analytics"><Suspense fallback={<Skeleton className="h-[660px] rounded-xl" />}><DailyProgressCharts daily={data.daily} weekly={data.weekly} taskTypes={data.task_types} /></Suspense></TabsContent>
          <TabsContent value="breakdowns" className="space-y-4">
            <div className="flex gap-2"><button className={`min-h-11 rounded-md px-3 py-2 text-sm lg:min-h-9 ${period === "daily" ? "bg-primary text-primary-foreground" : "border border-input"}`} onClick={() => setPeriod("daily")}>Daily</button><button className={`min-h-11 rounded-md px-3 py-2 text-sm lg:min-h-9 ${period === "weekly" ? "bg-primary text-primary-foreground" : "border border-input"}`} onClick={() => setPeriod("weekly")}>Weekly</button></div>
            <MetricTable title={`${period === "daily" ? "Daily" : "Weekly"} workflow`} subtitle={period === "daily" ? "One row per selected date." : "Monday–Sunday aggregation."} rows={data[period]} />
            <MetricTable title="Task type breakdown" subtitle="Assigned, created and delivered remain separate at every stage." rows={data.task_types} identityLabel="Task type" />
          </TabsContent>
          <TabsContent value="taskers"><TaskerTable rows={data.taskers} /></TabsContent>
          <TabsContent value="records"><RecordsTable rows={data.records} /></TabsContent>
        </Tabs>
      </>}
  </PageContainer>;
}
