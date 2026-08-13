"use client";

import { useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { searchClientMatchAction } from "@/app/(app)/quotes/actions";

type Defaults = {
  client_name: string;
  company_name: string;
  phone: string;
  email: string;
  address: string;
};

/**
 * Campos de nombre/empresa/teléfono/correo/dirección con autocompletado: al
 * salir del campo de nombre o empresa, busca (entre los clientes del propio
 * vendedor) uno cuyo nombre o empresa coincida exactamente (sin distinguir
 * mayúsculas) y, si lo encuentra, precarga teléfono/correo/dirección — solo
 * en los campos que sigan vacíos, nunca pisa algo que el vendedor ya escribió.
 */
export function ClientDataFields({
  defaults,
  disabled,
}: {
  defaults: Defaults;
  disabled?: boolean;
}) {
  const [phone, setPhone] = useState(defaults.phone);
  const [email, setEmail] = useState(defaults.email);
  const [address, setAddress] = useState(defaults.address);
  const [matched, setMatched] = useState(false);
  const [, startTransition] = useTransition();

  const nameRef = useRef<HTMLInputElement>(null);
  const companyRef = useRef<HTMLInputElement>(null);

  function lookup() {
    const name = nameRef.current?.value ?? "";
    const company = companyRef.current?.value ?? "";
    if (!name.trim() && !company.trim()) return;

    startTransition(async () => {
      const match = await searchClientMatchAction(name, company);
      if (!match) return;
      let filledSomething = false;
      setPhone((prev) => {
        if (prev || !match.phone) return prev;
        filledSomething = true;
        return match.phone;
      });
      setEmail((prev) => {
        if (prev || !match.email) return prev;
        filledSomething = true;
        return match.email;
      });
      setAddress((prev) => {
        if (prev || !match.address) return prev;
        filledSomething = true;
        return match.address;
      });
      if (filledSomething) setMatched(true);
    });
  }

  return (
    <>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Nombre del cliente</label>
        <Input
          ref={nameRef}
          name="client_name"
          defaultValue={defaults.client_name}
          required
          disabled={disabled}
          onBlur={lookup}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Empresa</label>
        <Input
          ref={companyRef}
          name="company_name"
          defaultValue={defaults.company_name}
          required
          disabled={disabled}
          onBlur={lookup}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Teléfono</label>
        <Input
          name="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Correo</label>
        <Input
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <label className="text-sm font-medium">Dirección de la empresa</label>
        <Input
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={disabled}
        />
        {matched && (
          <p className="text-xs text-brand-blue">
            Encontramos un cliente tuyo con ese nombre o empresa y precargamos sus datos —
            revísalos y ajusta lo que haga falta.
          </p>
        )}
      </div>
    </>
  );
}
