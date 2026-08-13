import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export default async function QuotesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select(
      "id, folio, client_name_snapshot, company_name_snapshot, status, outcome, grand_total, created_at"
    )
    .order("created_at", { ascending: false });

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

      <section className="space-y-3">
        {quotes.length === 0 && (
          <GlassCard className="text-sm text-[var(--ink-muted)]">
            Todavía no tienes cotizaciones. Da clic en &quot;Nueva cotización&quot;
            para crear la primera.
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
