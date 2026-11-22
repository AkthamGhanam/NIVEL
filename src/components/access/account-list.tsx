// Lista de cuentas para entrar: primero las registradas y luego las de demostración.
"use client";

import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { ArrowIcon } from "@/components/ui/icons";

export interface Account {
  readonly id: string;
  readonly name: string;
  readonly detail: string;
  readonly badge?: string;
  readonly registered: boolean;
}

export const FIRST_SHOWN = 5;

interface AccountListProps {
  readonly accounts: readonly Account[];
  readonly onPick: (id: string) => void;
  readonly pending: boolean;
}

function AccountRow({
  account,
  onPick,
  pending,
}: { readonly account: Account } & Omit<AccountListProps, "accounts">) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(account.id)}
        disabled={pending}
        className="group flex min-h-16 w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors duration-150 hover:bg-brand-tint disabled:opacity-60"
      >
        <Avatar name={account.name} tone={account.registered ? "brand" : "ink"} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-lg font-bold">
            {account.name}
            {account.badge ? <Tag tone="dark">{account.badge}</Tag> : null}
          </span>
          <span className="block text-sm text-muted">{account.detail}</span>
        </span>
        <span className="sr-only">Entrar como {account.name}</span>
        <span className="text-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-brand">
          <ArrowIcon />
        </span>
      </button>
    </li>
  );
}

function Group({ title, accounts, onPick, pending }: AccountListProps & { readonly title: string }) {
  const [all, setAll] = useState(false);
  if (accounts.length === 0) return null;
  const shown = all ? accounts : accounts.slice(0, FIRST_SHOWN);
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <h3 className="eyebrow px-3 text-muted">{title}</h3>
      <ul className="flex flex-col">
        {shown.map((account) => (
          <AccountRow key={account.id} account={account} onPick={onPick} pending={pending} />
        ))}
      </ul>
      {accounts.length > FIRST_SHOWN && !all ? (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="min-h-12 self-start rounded-control px-3 font-bold text-brand underline decoration-2"
        >
          Ver las {accounts.length} cuentas
        </button>
      ) : null}
    </section>
  );
}

export function AccountList({ accounts, onPick, pending }: AccountListProps) {
  const registered = accounts.filter((account) => account.registered);
  const demo = accounts.filter((account) => !account.registered);
  if (accounts.length === 0)
    return <p className="px-3 py-4 text-muted">Todavía no hay cuentas para mostrar.</p>;
  return (
    <div className="flex flex-col gap-5">
      <Group title="Cuentas registradas" accounts={registered} onPick={onPick} pending={pending} />
      <Group title="Cuentas de demostración" accounts={demo} onPick={onPick} pending={pending} />
    </div>
  );
}
