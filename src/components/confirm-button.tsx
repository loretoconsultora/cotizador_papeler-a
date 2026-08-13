"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type ConfirmButtonProps = React.ComponentProps<typeof Button> & {
  confirmMessage: string;
};

/**
 * Botón de submit que pide confirmación con window.confirm antes de dejar
 * pasar el envío del formulario. Pensado para acciones destructivas o
 * difíciles de revertir (eliminar, archivar) dentro de un <form action={...}>.
 */
export function ConfirmButton({
  confirmMessage,
  onClick,
  className,
  ...props
}: ConfirmButtonProps) {
  return (
    <Button
      type="submit"
      className={cn(className)}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...props}
    />
  );
}
