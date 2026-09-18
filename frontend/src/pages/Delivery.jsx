import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2, ClipboardCheck, Factory, FileQuestion, FolderKanban, PackageCheck, TestTube2, Users,
} from "lucide-react";
import api, { apiErr } from "@/lib/api";
import { PageContainer, PageHeader } from "@/components/Page";
import KpiStat from "@/components/KpiStat";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DeliveryFilters from "@/components/delivery/DeliveryFilters";
import { ProjectBreakdown, TaskerContributions } from "@/components/delivery/DeliveryBreakdowns";
import FeedbackViews from "@/components/delivery/FeedbackViews";
import DeliveryRecords from "@/components/delivery/DeliveryRecords";

const EMPTY_FILTERS = { preset: "all" };
const DeliveryCharts = lazy(() => import("@/components/delivery/DeliveryCharts"));

function queryString(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (key !== "preset" && value) params.set(key, value);
  });
  return params.toString();
}

export default function Delivery() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const query = queryString(filters);
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["delivery", query],
    queryFn: () => api.get(`/delivery${query ? `?${query}` : ""}`).then((response) => response.data),
  });
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const kpis = data?.kpis;

  return <PageContainer>
    <PageHeader title="Delivery" subtitle="Trace every delivered task from project and type to tasker contribution and client feedback. Unique Task IDs are counted once; shared work divides one contribution unit equally across authors."
                right={<div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${isFetching ? "bg-amber-500" : "bg-emerald-500"}`} />{isFetching ? "Refreshing Deliveries sheet" : "Live from Deliveries sheet"}</div>} />
    <DeliveryFilters filters={filters} meta={data?.meta} onChange={setFilter} onReplace={setFilters}
                     onClear={() => setFilters(EMPTY_FILTERS)} />

    {error ? <div className="empty-state border-rose-500/30 text-rose-600">Unable to load delivery data: {apiErr(error.response?.data?.detail || error.message)}</div> :
     isLoading || !kpis ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-[132px] rounded-xl" />)}</div> : <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-8" data-testid="delivery-kpis">
        <KpiStat label="Tasks delivered" value={kpis.total_tasks} sub="Unique Task IDs" icon={PackageCheck} accent testid="delivery-total" />
        <KpiStat label="Production" value={kpis.production_tasks} sub="Production tasks" icon={Factory} testid="delivery-production" />
        <KpiStat label="Sample" value={kpis.sample_tasks} sub="Sample tasks" icon={TestTube2} testid="delivery-sample" />
        <KpiStat label="Taskers" value={kpis.total_taskers} sub="Contributing authors" icon={Users} testid="delivery-taskers" />
        <KpiStat label="Contribution units" value={kpis.contribution_units} sub="One per unique task" icon={ClipboardCheck} testid="delivery-units" />
        <KpiStat label="Projects" value={kpis.total_projects} sub="Delivered projects" icon={FolderKanban} testid="delivery-projects" />
        <KpiStat label="With feedback" value={kpis.with_feedback} sub={`${kpis.feedback_coverage}% coverage`} icon={CheckCircle2} testid="delivery-with-feedback" />
        <KpiStat label="Without feedback" value={kpis.without_feedback} sub="Displayed as NA" icon={FileQuestion} testid="delivery-without-feedback" />
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-card px-4 py-3 text-xs text-muted-foreground">
        <span><strong className="text-foreground">Contribution check:</strong> {data.taskers.reduce((sum, tasker) => sum + tasker.contribution, 0).toLocaleString("en-IN", { maximumFractionDigits: 4 })} attributed units across {kpis.contribution_units} delivered tasks.</span>
        <span>{data.task_types.map((type) => `${type.label}: ${type.count}`).join(" · ") || "No task types"}</span>
      </div>

      <Tabs defaultValue="analytics" className="space-y-4">
        <TabsList className="thin-scroll max-w-full justify-start overflow-x-auto" aria-label="Delivery sections">
          <TabsTrigger value="analytics">Delivery analytics</TabsTrigger>
          <TabsTrigger value="contributions">Tasker contributions</TabsTrigger>
          <TabsTrigger value="feedback">Client feedback</TabsTrigger>
          <TabsTrigger value="records">Detailed records</TabsTrigger>
        </TabsList>
        <TabsContent value="analytics" className="space-y-4">
          <Suspense fallback={<Skeleton className="h-[680px] rounded-xl" />}>
            <DeliveryCharts projects={data.projects} trend={data.trend} taskTypes={data.task_types} feedbackProjects={data.project_feedback} />
          </Suspense>
          <ProjectBreakdown projects={data.projects} taskTypes={data.task_types} />
        </TabsContent>
        <TabsContent value="contributions">
          <TaskerContributions taskers={data.taskers} projects={data.projects} tpms={data.tpms} podLeads={data.pod_leads} />
        </TabsContent>
        <TabsContent value="feedback">
          <FeedbackViews key={query} overall={data.overall_feedback} tasks={data.tasks} />
        </TabsContent>
        <TabsContent value="records">
          <DeliveryRecords key={query} tasks={data.tasks} />
        </TabsContent>
      </Tabs>
    </>}
  </PageContainer>;
}
