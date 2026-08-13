"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

const selectClass =
  "w-full rounded-xl border border-black/10 bg-white/70 px-3.5 py-2.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-white/10 dark:bg-white/5";

export function TransportFields({ clientAddress }: { clientAddress: string | null }) {
  const [deliveryType, setDeliveryType] = useState<"address" | "pickup">("address");
  const [sameAsClient, setSameAsClient] = useState(false);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">¿Cómo recibe el proveedor?</label>
        <select
          name="delivery_type"
          className={selectClass}
          value={deliveryType}
          onChange={(e) => setDeliveryType(e.target.value as "address" | "pickup")}
        >
          <option value="address">A domicilio</option>
          <option value="pickup">Ocurre (recolecta en oficinas de la transportista)</option>
        </select>
      </div>

      {deliveryType === "address" && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="delivery_same_as_client"
              checked={sameAsClient}
              onChange={(e) => setSameAsClient(e.target.checked)}
            />
            Es la misma dirección de la empresa del cliente
            {clientAddress ? ` (${clientAddress})` : ""}
          </label>
          {!sameAsClient && (
            <Input
              name="delivery_address"
              placeholder="Dirección de entrega"
              required={deliveryType === "address"}
            />
          )}
        </div>
      )}
    </div>
  );
}
