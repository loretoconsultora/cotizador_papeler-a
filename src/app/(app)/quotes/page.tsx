import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { createQuoteAction } from "./actions";

type QuoteRow = {
  id: string;
  folio: string;
  client_name_snapshot: string;
  company_name_snapshot: string;
  status: string;
  outcome: string;
  grand_total: number;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  approved: "Aprobada",
  final: "Cotización final",
  invoiced: "Factura",
  ordered: "Pedido",
  closed: "Cerrada",
};

const OUTCOME_LABEL: Record<string, string> = {
  in_progress: "En seguimiento",
  won: "Ganada",
  lost: "Perdida",
};

function outcomeTone(outcome: string) {
  if (outcome === "won") return "green" as const;
  if (outcome === "lost") return "neutral" as const;
  return "sky" as const;
}

const selectClass =
  "rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-white/10 dark:bg-white/5";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    outcome?: string;
    company?: string;
    q?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const filters = await searchParams;
  const supabase = await createClient();

  const { data: companiesData } = await supabase.from("companies").select("id, name").order("name");
  const companies = companiesData ?? [];

  let quoteIdsFromCompany: string[] | null = null;
  if (filters.company) {
    const { data: matchingItems } = await supabase
      .from("quote_items")
      .select("quote_id")
      .eq("company_id", filters.company);
    quoteIdsFromCompany = Array.from(
      new Set((matchingItems ?? []).map((i) => i.quote_id as string))
    );
  }

  let query = supabase
    .from("quotes")
    .select(
      "id, folio, client_name_snapshot, company_name_snapshot, status, outcome, grand_total, created_at"
    )
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.outcome) query = query.eq("outcome", filters.outcome);
  if (filters.q) {
    query = query.or(
      `client_name_snapshot.ilike.%${filters.q}%,company_name_snapshot.ilike.%${filters.q}%`
    );
  }
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59`);
  if (quoteIdsFromCompany) {
    query = query.in("id", quoteIdsFromCompany.length ? quoteIdsFromCompany : ["-"]);
  }

  const { data } = await query;
  const quotes = (data ?? []) as QuoteRow[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cotizaciones</h1>
          <p className="text-sm text-[var(--ink-muted)]">
            Historial de todas tus cotizaciones.
          </p>
        </div>
        <form action={createQuoteAction}>
          <Button type="submit">Nueva cotización</Button>
        </form>
      </div>

      <GlassCard strong>
        <form className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" method="get">
          <Input name="q" placeholder="Cliente o empresa…" defaultValue={filters.q ?? ""} />
          <select name="status" defaultValue={filters.status ?? ""} className={selectClass}>
            <option value="">Todos los estatus</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select name="outcome" defaultValue={filters.outcome ?? ""} className={selectClass}>
            <option value="">Todos los resultados</option>
            {Object.entries(OUTCOME_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select name="company" defaultValue={filters.company ?? ""} className={selectClass}>
            <option value="">Todas las empresas</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input type="date" name="from" defaultValue={filters.from ?? ""} className={selectClass} />
          <div className="flex gap-2">
            <input type="date" name="to" defaultValue={filters.to ?? ""} className={selectClass + " flex-1"} />
            <Button type="submit" variant="secondary" className="px-3 py-2 text-sm">
              Filtrar
            </Button>
          </div>
        </form>
      </GlassCard>

      <section className="space-y-3">
        {quotes.length === 0 && (
          <GlassCard className="text-sm text-[var(--ink-muted)]">
            No hay cotizaciones que coincidan con estos filtros.
          </GlassCard>
        )}
        {quotes.map((q) => (
          <Link key={q.id} href={`/quotes/${q.id}`}>
            <GlassCard className="flex flex-wrap items-center justify-between gap-3 transition hover:bg-white/80">
              <div>
                <p className="font-medium">
                  {q.client_name_snapshot || "Cliente sin nombre"}{" "}
                  {q.company_name_snapshot && (
                    <span className="text-[var(--ink-muted)]">
                      · {q.company_name_snapshot}
                    </span>
                  )}
                </p>
                <p className="text-xs text-[var(--ink-muted)]">{q.folio}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="blue">{STATUS_LABEL[q.status] ?? q.status}</Badge>
                <Badge tone={outcomeTone(q.outcome)}>
                  {OUTCOME_LABEL[q.outcome] ?? q.outcome}
                </Badge>
                <span className="text-sm font-medium">
                  ${Number(q.grand_total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </GlassCard>
          </Link>
        ))}
      </section>
    </div>
  );
}
