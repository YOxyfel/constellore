# Constellore 3.0 storage contract

The runtime uses a deliberately small persistence boundary:

```js
{
  kind: "json" | "memory" | "postgres",
  async load(): object | null,
  async save(snapshot): void,
  health(): { kind, ready, contractVersion, lastError? }
}
```

`JsonGameStorage` is the zero-configuration local-beta adapter. It serializes writes and atomically renames a temporary file. It is not a production database and must not be used for a horizontally scaled or money-bearing deployment.

`migrations/001_v3_trust.sql` is the PostgreSQL 15+ target schema. A production adapter must use transactions and map service operations to normalized tables rather than rewriting the JSON snapshot. In particular:

- create a ranked attempt and enforce the partial unique active-attempt index in one transaction;
- append run, progression, economy, entitlement, and AI-review events using their unique idempotency keys;
- derive balances, permanent progression, and entitlements from event ledgers or transactionally maintained projections;
- admit only `verified` scores to public ladders;
- rotate and revoke expiring device sessions;
- keep AI proposals quarantined until an operator promotion event is committed;
- retain backups outside the primary database and test restoration regularly.

The SQL intentionally does not add a Node PostgreSQL dependency. Deployment still needs a managed PostgreSQL account, connection secret, TLS policy, migration runner, backup retention, monitoring, and a concrete adapter implementation. Billing fulfillment remains disabled until provider receipts/webhooks and refund reconciliation are implemented and tested.
