import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import api, { apiErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DailyProgressUpload({ onImported }) {
  const input = useRef(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("skip");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const importFile = async () => {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const csv_text = await file.text();
      const response = await api.post("/daily-progress/import", { csv_text, duplicate_mode: mode });
      setResult(response.data);
      toast.success(`${response.data.imported} records imported`);
      onImported();
    } catch (error) {
      setResult({ error: apiErr(error.response?.data?.detail || error.message) });
    } finally {
      setBusy(false);
    }
  };

  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setFile(null); setResult(null); } }}>
    <DialogTrigger asChild><Button className="h-11 lg:h-9"><Upload /> Upload CSV</Button></DialogTrigger>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader><DialogTitle>Upload daily progress CSV</DialogTitle><DialogDescription>The date inside each row is authoritative. Required headers: name, email, date, task type, assigned, created, remarks.</DialogDescription></DialogHeader>
      <div className="space-y-4 py-2">
        <input ref={input} type="file" accept=".csv,text/csv" className="block w-full rounded-lg border border-input bg-card p-3 text-sm" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        <div><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">When a logical record already exists</label>
          <Select value={mode} onValueChange={setMode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="skip">Skip existing records</SelectItem><SelectItem value="replace">Replace existing records</SelectItem></SelectContent></Select></div>
        {result && <div className={`rounded-lg border p-3 text-sm ${result.error || result.invalid ? "border-amber-500/30 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5"}`} aria-live="polite">
          {result.error ? result.error : <><p className="font-semibold">{result.imported} imported · {result.replaced} replaced · {result.duplicates} duplicates skipped · {result.invalid} invalid</p>
            {result.errors?.length > 0 && <ul className="mt-2 max-h-36 list-disc overflow-y-auto pl-5 text-xs">{result.errors.map((item) => <li key={`${item.row}-${item.error}`}>Row {item.row}: {item.error}</li>)}</ul>}</>}
        </div>}
      </div>
      <DialogFooter><Button className="h-11 lg:h-9" data-testid="daily-progress-upload-close" variant="outline" onClick={() => setOpen(false)}>Close</Button><Button className="h-11 lg:h-9" disabled={!file || busy} onClick={importFile}>{busy ? "Importing…" : "Import CSV"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
